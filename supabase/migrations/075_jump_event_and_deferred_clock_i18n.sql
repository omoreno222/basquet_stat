-- Who the jump result is about, and whether that team won it.
-- game_events already has RLS. This trigger refuses a jump row with the wrong shape.

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS jump_side TEXT,
  ADD COLUMN IF NOT EXISTS jump_won BOOLEAN;

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_jump_side;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_jump_side
  CHECK (jump_side IS NULL OR jump_side IN ('home', 'away'));

COMMENT ON COLUMN game_events.jump_side IS 'Team the jump result is about. Null unless event_type is jump.';
COMMENT ON COLUMN game_events.jump_won IS 'True when jump_side won the jump. Null unless event_type is jump.';

CREATE OR REPLACE FUNCTION enforce_jump_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'jump' THEN
    IF NEW.jump_side IS NOT NULL OR NEW.jump_won IS NOT NULL THEN
      RAISE EXCEPTION 'jump_shape';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.jump_side IS NULL
    OR NEW.jump_side NOT IN ('home', 'away')
    OR NEW.jump_won IS NULL
    OR NEW.player_id IS NOT NULL
    OR NEW.opponent_player_id IS NOT NULL
    OR COALESCE(NEW.points, 0) <> 0
    OR NEW.timeout_side IS NOT NULL
    OR NEW.turnover_type IS NOT NULL
    OR NEW.turnover_side IS NOT NULL
    OR NEW.foul_type IS NOT NULL
    OR NEW.foul_side IS NOT NULL
    OR NEW.period_number < 1
    OR NEW.period_number > 4
    OR NEW.clock_remaining_ms < 0
    OR NEW.clock_remaining_ms > 600000
  THEN
    RAISE EXCEPTION 'jump_shape';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_events_enforce_jump ON game_events;
CREATE TRIGGER game_events_enforce_jump
  BEFORE INSERT OR UPDATE ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_jump_event();

INSERT INTO translations (key, locale, value) VALUES
  ('trke_deferred_quarter', 'en', 'Quarter'),
  ('trke_deferred_quarter', 'es', 'Cuarto'),
  ('trke_deferred_quarter', 'ca', 'Quart'),

  ('trke_deferred_minute', 'en', 'Minute'),
  ('trke_deferred_minute', 'es', 'Minuto'),
  ('trke_deferred_minute', 'ca', 'Minut'),

  ('trke_deferred_jump_won', 'en', 'Jump won'),
  ('trke_deferred_jump_won', 'es', 'Salto ganado'),
  ('trke_deferred_jump_won', 'ca', 'Salt guanyat'),

  ('trke_deferred_jump_lost', 'en', 'Jump lost'),
  ('trke_deferred_jump_lost', 'es', 'Salto perdido'),
  ('trke_deferred_jump_lost', 'ca', 'Salt perdut')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
