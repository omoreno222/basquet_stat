-- The 5s button records a team violation, like 24s and 8s.
-- A 5s chosen from the turnover menu still belongs to a player.

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
  ELSIF NEW.turnover_type = 'five_seconds'
    AND NEW.player_id IS NULL
    AND NEW.opponent_player_id IS NULL THEN
    IF NEW.foul_type IS NOT NULL THEN
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

INSERT INTO translations (key, locale, value) VALUES
  ('trke_five_seconds_log', 'en', '5s'),
  ('trke_five_seconds_log', 'es', '5s'),
  ('trke_five_seconds_log', 'ca', '5s'),
  ('trke_five_seconds_hint', 'en', '5s violation. Press start clock.'),
  ('trke_five_seconds_hint', 'es', 'Falta de 5s. Pulsa start clock.'),
  ('trke_five_seconds_hint', 'ca', 'Falta de 5s. Prem start clock.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value;
