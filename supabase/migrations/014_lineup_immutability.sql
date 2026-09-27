-- Migration 014: Lineup Immutability
-- Server-side enforcement: prevent starting lineup changes once game has started

-- Function to check if game has started (has events or clock has run)
CREATE OR REPLACE FUNCTION check_game_not_started(p_game_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_count INTEGER;
  v_clock_remaining_ms INTEGER;
BEGIN
  -- Check if any events exist for this game
  SELECT COUNT(*) INTO v_event_count
  FROM game_events
  WHERE game_id = p_game_id;
  
  -- Check current clock remaining
  SELECT clock_remaining_ms INTO v_clock_remaining_ms
  FROM games
  WHERE id = p_game_id;
  
  -- Game has NOT started if no events AND clock is at 10:00 (600000 ms)
  RETURN (v_event_count = 0 AND v_clock_remaining_ms >= 600000);
END;
$$;

-- Revoke execute from public/anon, grant only to authenticated
REVOKE EXECUTE ON FUNCTION check_game_not_started(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_game_not_started(uuid) TO authenticated;

-- Trigger function to enforce lineup immutability
CREATE OR REPLACE FUNCTION prevent_lineup_change_after_start()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip check if this is a cascaded trigger (depth > 1)
  -- Allows FK cascades (e.g., player/team delete) to proceed
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Allow changes only if game has not started
  IF NOT check_game_not_started(NEW.game_id) THEN
    RAISE EXCEPTION 'Cannot modify starting lineup after game has started'
      USING HINT = 'Use substitutions instead';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to starting_lineups table for INSERT and UPDATE
DROP TRIGGER IF EXISTS enforce_lineup_immutability ON starting_lineups;
CREATE TRIGGER enforce_lineup_immutability
  BEFORE INSERT OR UPDATE ON starting_lineups
  FOR EACH ROW
  EXECUTE FUNCTION prevent_lineup_change_after_start();

-- Also prevent DELETE of starting lineup after game starts
CREATE OR REPLACE FUNCTION prevent_lineup_delete_after_start()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip check if this is a cascaded delete (depth > 1)
  -- Allows FK cascades (e.g., player/team/season delete) to proceed
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  -- Allow deletion only if game has not started
  IF NOT check_game_not_started(OLD.game_id) THEN
    RAISE EXCEPTION 'Cannot delete starting lineup after game has started'
      USING HINT = 'Starting lineup is locked once game begins';
  END IF;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_lineup_delete_immutability ON starting_lineups;
CREATE TRIGGER enforce_lineup_delete_immutability
  BEFORE DELETE ON starting_lineups
  FOR EACH ROW
  EXECUTE FUNCTION prevent_lineup_delete_after_start();

-- Add clock_remaining_ms to game_periods for accurate minutes calculation
-- This records the exact clock time when the period ended (may not be 0:00)
ALTER TABLE game_periods ADD COLUMN IF NOT EXISTS clock_remaining_ms INTEGER DEFAULT 0;
