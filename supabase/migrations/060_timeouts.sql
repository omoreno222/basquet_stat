-- Which team charged the timeout. Null on every other event.
-- game_events already has RLS from 055: club managers write, club members read.
-- This trigger is the cap, so a direct insert cannot skip the server action.

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS timeout_side TEXT;

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_timeout_side;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_timeout_side
  CHECK (timeout_side IS NULL OR timeout_side IN ('home', 'away'));

COMMENT ON COLUMN game_events.timeout_side IS 'Team that charged this timeout. Null unless event_type is timeout.';

CREATE OR REPLACE FUNCTION enforce_timeout_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  game_status TEXT;
  game_period INTEGER;
  window_from INTEGER;
  window_to INTEGER;
  cap INTEGER;
  used INTEGER;
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'timeout' THEN
    IF NEW.timeout_side IS NOT NULL THEN
      RAISE EXCEPTION 'timeout_shape';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.timeout_side IS NULL
    OR NEW.timeout_side NOT IN ('home', 'away')
    OR NEW.player_id IS NOT NULL
    OR NEW.opponent_player_id IS NOT NULL
    OR COALESCE(NEW.points, 0) <> 0
    OR NEW.turnover_type IS NOT NULL
    OR NEW.turnover_side IS NOT NULL
    OR NEW.foul_type IS NOT NULL
    OR NEW.foul_side IS NOT NULL
    OR NEW.coach_technical_side IS NOT NULL
  THEN
    RAISE EXCEPTION 'timeout_shape';
  END IF;

  SELECT status::TEXT, current_period
    INTO game_status, game_period
  FROM games
  WHERE id = NEW.game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'timeout_invalid';
  END IF;

  IF game_status = 'final' THEN
    RAISE EXCEPTION 'timeout_final';
  END IF;

  IF NEW.period_number IS DISTINCT FROM COALESCE(game_period, 1) THEN
    RAISE EXCEPTION 'timeout_period';
  END IF;

  IF NEW.clock_remaining_ms < 0 THEN
    RAISE EXCEPTION 'timeout_clock';
  END IF;

  IF NEW.period_number <= 4 AND NEW.clock_remaining_ms > 600000 THEN
    RAISE EXCEPTION 'timeout_clock';
  END IF;

  IF NEW.period_number > 4 AND NEW.clock_remaining_ms > 300000 THEN
    RAISE EXCEPTION 'timeout_clock';
  END IF;

  IF NEW.period_number <= 2 THEN
    window_from := 1;
    window_to := 2;
    cap := 2;
  ELSIF NEW.period_number <= 4 THEN
    window_from := 3;
    window_to := 4;
    cap := 3;
  ELSE
    window_from := NEW.period_number;
    window_to := NEW.period_number;
    cap := 1;
  END IF;

  SELECT COUNT(*)::INTEGER INTO used
  FROM game_events
  WHERE game_id = NEW.game_id
    AND event_type = 'timeout'
    AND timeout_side = NEW.timeout_side
    AND period_number BETWEEN window_from AND window_to
    AND (TG_OP = 'INSERT' OR id IS DISTINCT FROM NEW.id);

  IF used >= cap THEN
    RAISE EXCEPTION 'timeout_cap';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_events_enforce_timeout ON game_events;
CREATE TRIGGER game_events_enforce_timeout
  BEFORE INSERT OR UPDATE ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_timeout_event();

INSERT INTO translations (key, locale, value) VALUES
  ('trke_timeout_log', 'en', 'Timeout'),
  ('trke_timeout_log', 'es', 'Tiempo muerto'),
  ('trke_timeout_log', 'ca', 'Temps mort'),

  ('trke_timeout_hint', 'en', 'Timeout. Press start clock.'),
  ('trke_timeout_hint', 'es', 'Tiempo muerto. Pulsa start clock.'),
  ('trke_timeout_hint', 'ca', 'Temps mort. Prem start clock.'),

  ('trke_timeout_none_first_half', 'en', 'No more timeouts in the first two periods'),
  ('trke_timeout_none_first_half', 'es', 'No hay más TO para los dos primeros periodos'),
  ('trke_timeout_none_first_half', 'ca', 'No hi ha més TO per als dos primers períodes'),

  ('trke_timeout_none_second_half', 'en', 'No more timeouts in periods 3 and 4'),
  ('trke_timeout_none_second_half', 'es', 'No hay más TO para el tercer y cuarto periodo'),
  ('trke_timeout_none_second_half', 'ca', 'No hi ha més TO per al tercer i quart període'),

  ('trke_timeout_none_overtime', 'en', 'No more timeouts in this overtime'),
  ('trke_timeout_none_overtime', 'es', 'No hay más TO en esta prórroga'),
  ('trke_timeout_none_overtime', 'ca', 'No hi ha més TO en aquesta pròrroga'),

  ('trke_timeout_error', 'en', 'Could not save the timeout'),
  ('trke_timeout_error', 'es', 'No se ha podido guardar el tiempo muerto'),
  ('trke_timeout_error', 'ca', 'No s''ha pogut desar el temps mort'),

  ('trke_period_ended_notice', 'en', 'Period ended'),
  ('trke_period_ended_notice', 'es', 'Fin del periodo'),
  ('trke_period_ended_notice', 'ca', 'Fi del període'),

  ('trke_overtime_notice', 'en', 'The score is tied. Overtime starts.'),
  ('trke_overtime_notice', 'es', 'El marcador está empatado. Empieza la prórroga.'),
  ('trke_overtime_notice', 'ca', 'El marcador està empatat. Comença la pròrroga.'),

  ('trke_game_finished_notice', 'en', 'Game finished'),
  ('trke_game_finished_notice', 'es', 'Partido finalizado'),
  ('trke_game_finished_notice', 'ca', 'Partit finalitzat'),

  ('trke_notice_ok', 'en', 'OK'),
  ('trke_notice_ok', 'es', 'Vale'),
  ('trke_notice_ok', 'ca', 'D''acord')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
