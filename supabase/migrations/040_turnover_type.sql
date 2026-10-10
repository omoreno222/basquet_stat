-- Turnover reasons, possession side, and one transaction for the capture play.

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS turnover_type TEXT,
  ADD COLUMN IF NOT EXISTS turnover_side TEXT;

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_turnover_type;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_turnover_type
  CHECK (
    turnover_type IS NULL
    OR turnover_type IN (
      'double_dribble',
      'travelling',
      'three_seconds',
      'five_seconds',
      'offensive_foul',
      'bad_pass',
      'ball_handling',
      'out_of_bounds'
    )
  );

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_turnover_side;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_turnover_side
  CHECK (turnover_side IS NULL OR turnover_side IN ('home', 'away'));

COMMENT ON COLUMN game_events.turnover_type IS 'Why the ball was lost. Null on turnovers recorded before this column existed.';
COMMENT ON COLUMN game_events.turnover_side IS 'Team that lost the ball. On an offensive foul the other id is the player who was fouled.';

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_one_actor;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_one_actor
  CHECK (
    player_id IS NULL
    OR opponent_player_id IS NULL
    OR (
      event_type = 'turnover'
      AND turnover_type = 'offensive_foul'
      AND turnover_side IN ('home', 'away')
    )
  );

CREATE OR REPLACE FUNCTION enforce_turnover_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'turnover' THEN
    IF NEW.turnover_type IS NOT NULL OR NEW.turnover_side IS NOT NULL THEN
      RAISE EXCEPTION 'turnover_shape';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.turnover_type IS NULL
    AND NEW.turnover_type IS NULL
    AND NEW.turnover_side IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.turnover_side IS NULL OR NEW.turnover_side NOT IN ('home', 'away') OR NEW.turnover_type IS NULL THEN
    RAISE EXCEPTION 'turnover_shape';
  END IF;

  IF NEW.turnover_type = 'offensive_foul' THEN
    IF NEW.foul_type IS DISTINCT FROM 'personal'
      OR NEW.player_id IS NULL
      OR NEW.opponent_player_id IS NULL THEN
      RAISE EXCEPTION 'turnover_shape';
    END IF;
  ELSE
    IF NEW.foul_type IS NOT NULL THEN
      RAISE EXCEPTION 'turnover_shape';
    END IF;
    IF NEW.turnover_side = 'home' AND (NEW.player_id IS NULL OR NEW.opponent_player_id IS NOT NULL) THEN
      RAISE EXCEPTION 'turnover_shape';
    END IF;
    IF NEW.turnover_side = 'away' AND (NEW.opponent_player_id IS NULL OR NEW.player_id IS NOT NULL) THEN
      RAISE EXCEPTION 'turnover_shape';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_turnover_event ON game_events;
CREATE TRIGGER enforce_turnover_event
  BEFORE INSERT OR UPDATE ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_turnover_event();

CREATE OR REPLACE FUNCTION capture_on_court(p_game_id UUID, p_period INTEGER, p_side TEXT)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids UUID[];
  v_sub RECORD;
  v_index INTEGER;
BEGIN
  IF p_side = 'home' THEN
    SELECT COALESCE(array_agg(player_id ORDER BY position_index), ARRAY[]::UUID[])
    INTO v_ids
    FROM game_period_lineups
    WHERE game_id = p_game_id
      AND period_number = p_period
      AND side = 'home'
      AND player_id IS NOT NULL;

    FOR v_sub IN
      SELECT player_id, player_out_id
      FROM game_events
      WHERE game_id = p_game_id
        AND period_number = p_period
        AND event_type = 'substitution'
        AND player_id IS NOT NULL
        AND player_out_id IS NOT NULL
      ORDER BY clock_remaining_ms DESC, created_at ASC
    LOOP
      v_index := array_position(v_ids, v_sub.player_out_id);
      IF v_index IS NOT NULL THEN
        v_ids[v_index] := v_sub.player_id;
      END IF;
    END LOOP;
  ELSE
    SELECT COALESCE(array_agg(l.opponent_player_id ORDER BY l.position_index), ARRAY[]::UUID[])
    INTO v_ids
    FROM game_period_lineups l
    JOIN game_opponent_players o ON o.id = l.opponent_player_id
    WHERE l.game_id = p_game_id
      AND l.period_number = p_period
      AND l.side = 'away'
      AND NOT o.is_coach;
  END IF;

  RETURN v_ids;
END;
$$;

CREATE OR REPLACE FUNCTION commit_capture_play(
  p_play TEXT,
  p_game_id UUID,
  p_period INTEGER,
  p_clock_remaining_ms INTEGER,
  p_coord_x NUMERIC,
  p_coord_y NUMERIC,
  p_side TEXT,
  p_reason TEXT,
  p_offender_id UUID,
  p_victim_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_event_id UUID;
  v_fouls INTEGER;
  v_court UUID[];
  v_other UUID[];
  v_max INTEGER;
  v_other_side TEXT;
BEGIN
  IF p_play IS DISTINCT FROM 'turnover' THEN
    RAISE EXCEPTION 'turnover_invalid';
  END IF;

  IF p_side NOT IN ('home', 'away')
    OR p_reason NOT IN (
      'double_dribble',
      'travelling',
      'three_seconds',
      'five_seconds',
      'offensive_foul',
      'bad_pass',
      'ball_handling',
      'out_of_bounds'
    )
    OR p_coord_x IS NULL
    OR p_coord_y IS NULL
    OR p_coord_x < 0
    OR p_coord_x > 1
    OR p_coord_y < 0
    OR p_coord_y > 1
    OR p_offender_id IS NULL THEN
    RAISE EXCEPTION 'turnover_invalid';
  END IF;

  v_max := CASE WHEN p_period <= 4 THEN 600000 ELSE 300000 END;
  IF p_period < 1 OR p_clock_remaining_ms < 0 OR p_clock_remaining_ms > v_max THEN
    RAISE EXCEPTION 'turnover_clock';
  END IF;

  IF p_reason = 'offensive_foul' AND p_victim_id IS NULL THEN
    RAISE EXCEPTION 'turnover_victim';
  END IF;
  IF p_reason <> 'offensive_foul' AND p_victim_id IS NOT NULL THEN
    RAISE EXCEPTION 'turnover_victim';
  END IF;

  SELECT * INTO v_game
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'turnover_invalid';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_game.slot_a_user_id THEN
    RAISE EXCEPTION 'turnover_slot';
  END IF;

  IF v_game.possession IS DISTINCT FROM p_side THEN
    RAISE EXCEPTION 'turnover_possession';
  END IF;

  IF v_game.current_period IS DISTINCT FROM p_period THEN
    RAISE EXCEPTION 'turnover_period';
  END IF;

  v_court := capture_on_court(p_game_id, p_period, p_side);
  IF NOT (p_offender_id = ANY(v_court)) THEN
    RAISE EXCEPTION 'turnover_player';
  END IF;

  v_other_side := CASE WHEN p_side = 'home' THEN 'away' ELSE 'home' END;

  IF p_reason = 'offensive_foul' THEN
    IF p_side = 'home' THEN
      SELECT COUNT(*) INTO v_fouls
      FROM game_events
      WHERE game_id = p_game_id
        AND player_id = p_offender_id
        AND (
          (event_type = 'foul' AND foul_type = 'personal')
          OR (event_type = 'turnover' AND turnover_type = 'offensive_foul' AND turnover_side = 'home')
        );
    ELSE
      SELECT COUNT(*) INTO v_fouls
      FROM game_events
      WHERE game_id = p_game_id
        AND opponent_player_id = p_offender_id
        AND (
          (event_type = 'foul' AND foul_type = 'personal')
          OR (event_type = 'turnover' AND turnover_type = 'offensive_foul' AND turnover_side = 'away')
        );
    END IF;

    IF v_fouls >= 5 THEN
      RAISE EXCEPTION 'turnover_eliminated';
    END IF;

    v_other := capture_on_court(p_game_id, p_period, v_other_side);
    IF NOT (p_victim_id = ANY(v_other)) THEN
      RAISE EXCEPTION 'turnover_victim';
    END IF;
  END IF;

  INSERT INTO game_events (
    game_id,
    player_id,
    opponent_player_id,
    event_type,
    period_number,
    clock_remaining_ms,
    elapsed_ms,
    coord_x,
    coord_y,
    is_offensive,
    turnover_type,
    turnover_side,
    foul_type,
    recorded_by_user_id
  ) VALUES (
    p_game_id,
    CASE
      WHEN p_side = 'home' THEN p_offender_id
      WHEN p_reason = 'offensive_foul' THEN p_victim_id
      ELSE NULL
    END,
    CASE
      WHEN p_side = 'away' THEN p_offender_id
      WHEN p_reason = 'offensive_foul' THEN p_victim_id
      ELSE NULL
    END,
    'turnover',
    p_period,
    p_clock_remaining_ms,
    v_max - p_clock_remaining_ms,
    p_coord_x,
    p_coord_y,
    true,
    p_reason,
    p_side,
    CASE WHEN p_reason = 'offensive_foul' THEN 'personal'::foul_type ELSE NULL END,
    auth.uid()
  )
  RETURNING id INTO v_event_id;

  UPDATE games
  SET
    possession = v_other_side,
    clock_running = false,
    clock_remaining_ms = p_clock_remaining_ms
  WHERE id = p_game_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION capture_on_court(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION capture_on_court(UUID, INTEGER, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION commit_capture_play(TEXT, UUID, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION commit_capture_play(TEXT, UUID, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION enforce_period_lineup()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fouls INTEGER;
BEGIN
  IF period_has_started(NEW.game_id, NEW.period_number) THEN
    RAISE EXCEPTION 'Cannot change the lineup after the period has started';
  END IF;

  IF NEW.side = 'home' THEN
    IF NOT EXISTS (
      SELECT 1 FROM game_squads
      WHERE game_id = NEW.game_id AND player_id = NEW.player_id
    ) THEN
      RAISE EXCEPTION 'Only a dressed player can start a period';
    END IF;

    SELECT COUNT(*) INTO v_fouls
    FROM game_events
    WHERE game_id = NEW.game_id
      AND (
        (
          player_id = NEW.player_id
          AND event_type = 'foul'
          AND foul_type = 'personal'
        )
        OR (
          player_id = NEW.player_id
          AND event_type = 'turnover'
          AND turnover_type = 'offensive_foul'
          AND turnover_side = 'home'
        )
      );

  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM game_opponent_players
      WHERE id = NEW.opponent_player_id
        AND game_id = NEW.game_id
        AND NOT is_coach
    ) THEN
      RAISE EXCEPTION 'Opponent coach cannot start a period';
    END IF;

    SELECT COUNT(*) INTO v_fouls
    FROM game_events
    WHERE game_id = NEW.game_id
      AND (
        (
          opponent_player_id = NEW.opponent_player_id
          AND event_type = 'foul'
          AND foul_type = 'personal'
        )
        OR (
          opponent_player_id = NEW.opponent_player_id
          AND event_type = 'turnover'
          AND turnover_type = 'offensive_foul'
          AND turnover_side = 'away'
        )
      );
  END IF;

  IF v_fouls >= 5 THEN
    RAISE EXCEPTION 'An eliminated player cannot start a period';
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO translations (key, locale, value) VALUES
  ('trke_turnover_menu_title', 'en', 'Turnover'),
  ('trke_turnover_menu_title', 'es', 'Pérdida'),
  ('trke_turnover_menu_title', 'ca', 'Pèrdua'),
  ('trke_turnover_log', 'en', 'Turnover'),
  ('trke_turnover_log', 'es', 'Pérdida'),
  ('trke_turnover_log', 'ca', 'Pèrdua'),
  ('trke_turnover_cancel', 'en', 'Cancel'),
  ('trke_turnover_cancel', 'es', 'Cancelar'),
  ('trke_turnover_cancel', 'ca', 'Cancel·la'),
  ('trke_turnover_double_dribble', 'en', 'Double dribble'),
  ('trke_turnover_double_dribble', 'es', 'Dobles'),
  ('trke_turnover_double_dribble', 'ca', 'Dobles'),
  ('trke_turnover_travelling', 'en', 'Travelling'),
  ('trke_turnover_travelling', 'es', 'Pasos'),
  ('trke_turnover_travelling', 'ca', 'Passos'),
  ('trke_turnover_three_seconds', 'en', '3 seconds'),
  ('trke_turnover_three_seconds', 'es', '3 segundos'),
  ('trke_turnover_three_seconds', 'ca', '3 segons'),
  ('trke_turnover_five_seconds', 'en', '5 seconds'),
  ('trke_turnover_five_seconds', 'es', '5 segundos'),
  ('trke_turnover_five_seconds', 'ca', '5 segons'),
  ('trke_turnover_offensive_foul', 'en', 'Offensive foul'),
  ('trke_turnover_offensive_foul', 'es', 'Falta en ataque'),
  ('trke_turnover_offensive_foul', 'ca', 'Falta en atac'),
  ('trke_turnover_bad_pass', 'en', 'Bad pass'),
  ('trke_turnover_bad_pass', 'es', 'Mal pase'),
  ('trke_turnover_bad_pass', 'ca', 'Mal passada'),
  ('trke_turnover_ball_handling', 'en', 'Ball handling'),
  ('trke_turnover_ball_handling', 'es', 'Manejo de balón'),
  ('trke_turnover_ball_handling', 'ca', 'Maneig de pilota'),
  ('trke_turnover_out_of_bounds', 'en', 'Out of bounds'),
  ('trke_turnover_out_of_bounds', 'es', 'Fuera de banda'),
  ('trke_turnover_out_of_bounds', 'ca', 'Fora de banda'),
  ('trke_turnover_hint_court', 'en', 'Tap the court where the ball was lost'),
  ('trke_turnover_hint_court', 'es', 'Puntee el campo donde se perdió el balón'),
  ('trke_turnover_hint_court', 'ca', 'Punxa la pista on s''ha perdut la pilota'),
  ('trke_turnover_hint_player', 'en', 'Choose the player who lost the ball'),
  ('trke_turnover_hint_player', 'es', 'Elige el jugador que perdió el balón'),
  ('trke_turnover_hint_player', 'ca', 'Tria el jugador que ha perdut la pilota'),
  ('trke_turnover_hint_reason', 'en', 'Choose why the ball was lost'),
  ('trke_turnover_hint_reason', 'es', 'Elige el motivo de la pérdida'),
  ('trke_turnover_hint_reason', 'ca', 'Tria el motiu de la pèrdua'),
  ('trke_turnover_hint_victim', 'en', 'Choose the player who was fouled'),
  ('trke_turnover_hint_victim', 'es', 'Elige el jugador que recibió la falta'),
  ('trke_turnover_hint_victim', 'ca', 'Tria el jugador que ha rebut la falta'),
  ('trke_turnover_hint_wrong_side', 'en', 'Only the team with the ball can turn it over'),
  ('trke_turnover_hint_wrong_side', 'es', 'Solo puede perder el balón el equipo que lo tiene'),
  ('trke_turnover_hint_wrong_side', 'ca', 'Només pot perdre la pilota l''equip que la té'),
  ('trke_turnover_hint_saved', 'en', 'Turnover saved. Press start clock.'),
  ('trke_turnover_hint_saved', 'es', 'Pérdida anotada. Pulsa start clock.'),
  ('trke_turnover_hint_saved', 'ca', 'Pèrdua anotada. Prem start clock.'),
  ('trke_turnover_hint_eliminated', 'en', 'That player is already eliminated'),
  ('trke_turnover_hint_eliminated', 'es', 'Ese jugador ya está eliminado'),
  ('trke_turnover_hint_eliminated', 'ca', 'Aquest jugador ja està eliminat'),
  ('trke_turnover_hint_possession', 'en', 'The ball changed hands. Turnover was not saved.'),
  ('trke_turnover_hint_possession', 'es', 'La posesión ha cambiado. No se ha anotado la pérdida.'),
  ('trke_turnover_hint_possession', 'ca', 'La possessió ha canviat. No s''ha anotat la pèrdua.'),
  ('trke_turnover_hint_error', 'en', 'Could not save the turnover'),
  ('trke_turnover_hint_error', 'es', 'No se ha podido anotar la pérdida'),
  ('trke_turnover_hint_error', 'ca', 'No s''ha pogut anotar la pèrdua')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
