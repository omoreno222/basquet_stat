-- A missed shot can end without a rebound.
-- lodged: the live ball sticks between the ring and the backboard.
-- That is a jump-ball situation, so the alternating-possession arrow reverses.
-- period_end: the period ended on the miss. The arrow stays where it is.

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS dead_ball TEXT;

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_dead_ball;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_dead_ball
  CHECK (dead_ball IS NULL OR dead_ball IN ('lodged', 'period_end'));

COMMENT ON COLUMN game_events.dead_ball IS
  'Missed shot with no rebound. lodged reverses the alternating-possession arrow. period_end does not.';

CREATE OR REPLACE FUNCTION enforce_dead_ball_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.dead_ball IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type IS DISTINCT FROM 'shot'
    OR NEW.made IS DISTINCT FROM FALSE
    OR NEW.dead_ball NOT IN ('lodged', 'period_end') THEN
    RAISE EXCEPTION 'dead_ball_shape';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_events_enforce_dead_ball ON game_events;
CREATE TRIGGER game_events_enforce_dead_ball
  BEFORE INSERT OR UPDATE ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_dead_ball_event();

INSERT INTO translations (key, locale, value) VALUES
  ('trke_miss_lodged', 'en', 'Ball lodged between the ring and the backboard'),
  ('trke_miss_lodged', 'es', 'Balón encajado entre el aro y el tablero'),
  ('trke_miss_lodged', 'ca', 'Pilota encallada entre l''aro i el tauler'),

  ('trke_miss_lodged_hint', 'en', 'Alternating-possession throw-in. The arrow reverses.'),
  ('trke_miss_lodged_hint', 'es', 'Saque por posesión alterna. La flecha cambia de sentido.'),
  ('trke_miss_lodged_hint', 'ca', 'Servei per possessió alterna. La fletxa canvia de sentit.'),

  ('trke_miss_period_end', 'en', 'End of the period'),
  ('trke_miss_period_end', 'es', 'Final de periodo'),
  ('trke_miss_period_end', 'ca', 'Final de període'),

  ('trke_miss_period_end_hint', 'en', 'No rebound. The arrow stays as it is.'),
  ('trke_miss_period_end_hint', 'es', 'Sin rebote. La flecha no cambia.'),
  ('trke_miss_period_end_hint', 'ca', 'Sense rebot. La fletxa no canvia.'),

  ('trke_miss_arrow', 'en', 'Record the opening jump before a lodged ball'),
  ('trke_miss_arrow', 'es', 'Apunta el salto inicial antes de un balón encajado'),
  ('trke_miss_arrow', 'ca', 'Apunta el salt inicial abans d''una pilota encallada')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
