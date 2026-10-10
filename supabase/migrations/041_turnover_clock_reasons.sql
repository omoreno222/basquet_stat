-- More turnover reasons, technicals, and team 24s / 8s violations.
-- 040 is already applied. This file only extends it.

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
      'technical',
      'bad_pass',
      'bad_pass_lost',
      'ball_handling',
      'ball_handling_lost',
      'out_of_bounds',
      'shot_clock',
      'eight_seconds'
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
  ELSIF NEW.turnover_type = 'technical' THEN
    IF NEW.foul_type IS DISTINCT FROM 'technical'
      OR COALESCE(NEW.free_throws_awarded, 0) <> 1 THEN
      RAISE EXCEPTION 'turnover_shape';
    END IF;
    IF NEW.turnover_side = 'home' AND (NEW.player_id IS NULL OR NEW.opponent_player_id IS NOT NULL) THEN
      RAISE EXCEPTION 'turnover_shape';
    END IF;
    IF NEW.turnover_side = 'away' AND (NEW.opponent_player_id IS NULL OR NEW.player_id IS NOT NULL) THEN
      RAISE EXCEPTION 'turnover_shape';
    END IF;
  ELSIF NEW.turnover_type IN ('shot_clock', 'eight_seconds') THEN
    IF NEW.foul_type IS NOT NULL
      OR NEW.player_id IS NOT NULL
      OR NEW.opponent_player_id IS NOT NULL THEN
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
          AND turnover_type IN ('offensive_foul', 'technical')
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
          AND turnover_type IN ('offensive_foul', 'technical')
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
  ('trke_turnover_bad_pass_lost', 'en', 'Bad pass and loss'),
  ('trke_turnover_bad_pass_lost', 'es', 'Mal pase y pérdida'),
  ('trke_turnover_bad_pass_lost', 'ca', 'Mala passada i pèrdua'),
  ('trke_turnover_ball_handling_lost', 'en', 'Ball handling and loss'),
  ('trke_turnover_ball_handling_lost', 'es', 'Manejo y pérdida'),
  ('trke_turnover_ball_handling_lost', 'ca', 'Maneig i pèrdua'),
  ('trke_turnover_technical', 'en', 'Technical foul'),
  ('trke_turnover_technical', 'es', 'Falta técnica'),
  ('trke_turnover_technical', 'ca', 'Falta tècnica'),
  ('trke_turnover_one_free_throw', 'en', '1 free throw'),
  ('trke_turnover_one_free_throw', 'es', '1 tiro libre'),
  ('trke_turnover_one_free_throw', 'ca', '1 tir lliure'),
  ('trke_turnover_hint_saved_live', 'en', 'Turnover saved.'),
  ('trke_turnover_hint_saved_live', 'es', 'Pérdida anotada.'),
  ('trke_turnover_hint_saved_live', 'ca', 'Pèrdua anotada.'),
  ('trke_shot_clock_log', 'en', '24s'),
  ('trke_shot_clock_log', 'es', '24s'),
  ('trke_shot_clock_log', 'ca', '24s'),
  ('trke_eight_seconds_log', 'en', '8s'),
  ('trke_eight_seconds_log', 'es', '8s'),
  ('trke_eight_seconds_log', 'ca', '8s'),
  ('trke_shot_clock_hint', 'en', '24s violation. Press start clock.'),
  ('trke_shot_clock_hint', 'es', 'Falta de 24s. Pulsa start clock.'),
  ('trke_shot_clock_hint', 'ca', 'Falta de 24s. Prem start clock.'),
  ('trke_eight_seconds_hint', 'en', '8s violation. Press start clock.'),
  ('trke_eight_seconds_hint', 'es', 'Falta de 8s. Pulsa start clock.'),
  ('trke_eight_seconds_hint', 'ca', 'Falta de 8s. Prem start clock.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
