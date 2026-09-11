-- Migration 002: Add live game clock state and enhance game tracking
-- This supports real-time game capture with clock management and current game state

-- Add clock state columns to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS clock_running BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS clock_remaining_ms INTEGER DEFAULT 600000,
ADD COLUMN IF NOT EXISTS current_period INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS possession TEXT CHECK (possession IN ('home', 'away'));

-- Add comments for clarity
COMMENT ON COLUMN games.clock_running IS 'Whether game clock is currently running';
COMMENT ON COLUMN games.clock_remaining_ms IS 'Milliseconds remaining in current period';
COMMENT ON COLUMN games.current_period IS 'Current period number (1-4 regular, 5+ overtime)';
COMMENT ON COLUMN games.possession IS 'Which team has possession (home=own team, away=opponent)';

-- Create index for active games
CREATE INDEX IF NOT EXISTS idx_games_status_live ON games(status) WHERE status = 'live';

-- Update game_events to ensure all required columns are present
ALTER TABLE game_events 
ADD COLUMN IF NOT EXISTS recorded_by_user_id UUID REFERENCES profiles(id);

COMMENT ON COLUMN game_events.recorded_by_user_id IS 'User who recorded this event (Slot A or B)';

-- Create index for recent events (for undo functionality)
CREATE INDEX IF NOT EXISTS idx_game_events_created_desc ON game_events(game_id, created_at DESC);
