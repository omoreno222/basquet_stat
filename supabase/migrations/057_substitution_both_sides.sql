-- One substitution row names who leaves and who enters, for either team.

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS opponent_player_out_id UUID
    REFERENCES game_opponent_players(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_game_events_opponent_player_out
  ON game_events(opponent_player_out_id);

COMMENT ON COLUMN game_events.opponent_player_out_id IS 'Opponent who leaves on a substitution. Paired with opponent_player_id, who enters.';

CREATE OR REPLACE FUNCTION enforce_substitution_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'substitution' THEN
    IF NEW.opponent_player_out_id IS NOT NULL THEN
      RAISE EXCEPTION 'substitution_shape';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.player_id IS NOT NULL
    AND NEW.player_out_id IS NOT NULL
    AND NEW.player_id <> NEW.player_out_id
    AND NEW.opponent_player_id IS NULL
    AND NEW.opponent_player_out_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.opponent_player_id IS NOT NULL
    AND NEW.opponent_player_out_id IS NOT NULL
    AND NEW.opponent_player_id <> NEW.opponent_player_out_id
    AND NEW.player_id IS NULL
    AND NEW.player_out_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM game_opponent_players p
      WHERE p.id = NEW.opponent_player_id
        AND p.game_id = NEW.game_id
        AND NOT p.is_coach
    )
    AND EXISTS (
      SELECT 1
      FROM game_opponent_players p
      WHERE p.id = NEW.opponent_player_out_id
        AND p.game_id = NEW.game_id
        AND NOT p.is_coach
    ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'substitution_shape';
END;
$$;

DROP TRIGGER IF EXISTS enforce_substitution_event ON game_events;
CREATE TRIGGER enforce_substitution_event
  BEFORE INSERT OR UPDATE ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_substitution_event();

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

    FOR v_sub IN
      SELECT opponent_player_id, opponent_player_out_id
      FROM game_events
      WHERE game_id = p_game_id
        AND period_number = p_period
        AND event_type = 'substitution'
        AND opponent_player_id IS NOT NULL
        AND opponent_player_out_id IS NOT NULL
      ORDER BY clock_remaining_ms DESC, created_at ASC
    LOOP
      v_index := array_position(v_ids, v_sub.opponent_player_out_id);
      IF v_index IS NOT NULL THEN
        v_ids[v_index] := v_sub.opponent_player_id;
      END IF;
    END LOOP;
  END IF;

  RETURN v_ids;
END;
$$;

INSERT INTO translations (key, locale, value) VALUES
  ('trke_sub_hint_out', 'en', 'Tap who leaves'),
  ('trke_sub_hint_out', 'es', 'Toca quién sale'),
  ('trke_sub_hint_out', 'ca', 'Toca qui surt'),
  ('trke_sub_hint_in', 'en', 'Tap who enters from the bench'),
  ('trke_sub_hint_in', 'es', 'Toca quién entra del banquillo'),
  ('trke_sub_hint_in', 'ca', 'Toca qui entra de la banqueta'),
  ('trke_sub_hint_saved', 'en', 'Substitution saved'),
  ('trke_sub_hint_saved', 'es', 'Cambio guardado'),
  ('trke_sub_hint_saved', 'ca', 'Canvi guardat'),
  ('trke_sub_hint_error', 'en', 'Could not save the substitution'),
  ('trke_sub_hint_error', 'es', 'No se ha podido guardar el cambio'),
  ('trke_sub_hint_error', 'ca', 'No s''ha pogut guardar el canvi'),
  ('trke_sub_hint_eliminated', 'en', 'That player is already out of the game'),
  ('trke_sub_hint_eliminated', 'es', 'Ese jugador ya está eliminado'),
  ('trke_sub_hint_eliminated', 'ca', 'Aquest jugador ja està eliminat'),
  ('trke_sub_hint_lineup', 'en', 'Set the lineup before a substitution'),
  ('trke_sub_hint_lineup', 'es', 'Pon el quinteto antes de un cambio'),
  ('trke_sub_hint_lineup', 'ca', 'Posa el quintet abans d''un canvi')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
