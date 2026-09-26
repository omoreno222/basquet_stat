-- Migration 009: Update game-related RLS policies to use SECURITY DEFINER functions
-- Ensures multi-role support for game_events, game_periods, and stints

-- Update game_events policy to use is_admin_or_team_manager()
DROP POLICY IF EXISTS "Team managers can manage events" ON game_events;

CREATE POLICY "Team managers can manage events" ON game_events 
  FOR ALL 
  USING (is_admin_or_team_manager());

-- Update game_periods policy to use is_admin_or_team_manager()
DROP POLICY IF EXISTS "Admins and team managers can manage periods" ON game_periods;

CREATE POLICY "Admins and team managers can manage periods" ON game_periods 
  FOR ALL 
  USING (is_admin_or_team_manager());

-- Update stints policy to use is_admin_or_team_manager()  
DROP POLICY IF EXISTS "Team managers can manage stints" ON stints;

CREATE POLICY "Team managers can manage stints" ON stints 
  FOR ALL 
  USING (is_admin_or_team_manager());

-- Add comment to document the security model
COMMENT ON TABLE game_events IS 'Game events recorded during live capture. RLS allows admin/team_manager to write. Future hardening: restrict to assigned slot users.';
COMMENT ON TABLE games IS 'Games table. RLS allows admin/team_manager to manage. Slot assignment (slot_a_user_id, slot_b_user_id) is for UI/workflow only, not enforced in RLS.';
