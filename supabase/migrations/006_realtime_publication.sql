-- Migration 006: Enable Realtime for live game capture
-- Configures Supabase Realtime publication for games and game_events tables
-- Required for dual-tablet A/B slot synchronization

-- Ensure tables are added to the supabase_realtime publication
-- This allows postgres_changes events to be broadcast via Supabase Realtime

-- Check if publication exists and add tables safely
DO $$
BEGIN
  -- Add games table to realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE games;
  END IF;

  -- Add game_events table to realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'game_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_events;
  END IF;
END $$;

-- Set REPLICA IDENTITY FULL for filtered postgres_changes subscriptions
-- This ensures all columns are included in UPDATE events, which is required
-- when using filters like `filter: "game_id=eq.{gameId}"`
ALTER TABLE games REPLICA IDENTITY FULL;
ALTER TABLE game_events REPLICA IDENTITY FULL;

-- Verify RLS policies allow authenticated scorers to receive Realtime events
-- The existing SELECT policies already allow this:
-- - games: "Anyone can view games"
-- - game_events: "Anyone can view game events"
-- These policies work with Realtime subscriptions for authenticated users

-- Add indexes to support Realtime filtering (already exist but documented here)
-- idx_game_events_game on game_events(game_id) - supports filter game_id=eq.X
-- games table filtered by id (primary key) - inherently efficient

COMMENT ON TABLE games IS 'Basketball game records with live clock state and Realtime sync enabled';
COMMENT ON TABLE game_events IS 'Game event records (shots, fouls, etc.) with Realtime sync enabled';
