-- The game clock stored on games is a sample, not a ticking value.
-- clock_synced_at is the wall time of that sample. While clock_running,
-- viewers subtract the time since the stamp.

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS clock_synced_at timestamptz;

COMMENT ON COLUMN games.clock_synced_at IS
  'Wall time when clock_remaining_ms was sampled. While clock_running, remaining time is that sample minus the time since this stamp.';

CREATE OR REPLACE FUNCTION public.stamp_game_clock_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.clock_running IS TRUE THEN
      NEW.clock_synced_at := now();
    ELSE
      NEW.clock_synced_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.clock_running IS TRUE
     AND (
       NEW.clock_remaining_ms IS DISTINCT FROM OLD.clock_remaining_ms
       OR NEW.clock_running IS DISTINCT FROM OLD.clock_running
     ) THEN
    NEW.clock_synced_at := now();
  ELSIF NEW.clock_running IS NOT TRUE
     AND (
       NEW.clock_running IS DISTINCT FROM OLD.clock_running
       OR NEW.clock_remaining_ms IS DISTINCT FROM OLD.clock_remaining_ms
     ) THEN
    NEW.clock_synced_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_game_clock_sync ON games;
CREATE TRIGGER stamp_game_clock_sync
  BEFORE INSERT OR UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_game_clock_sync();

UPDATE games
SET clock_synced_at = updated_at
WHERE clock_running IS TRUE
  AND clock_synced_at IS NULL;
