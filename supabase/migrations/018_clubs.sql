-- Migration 018: Clubs multi-tenancy and club_admin permissions
-- Depends on: 017_club_admin_role.sql (club_admin enum value must exist)

-- Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#FFFFFF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Add club_id to profiles (nullable for platform admins)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- Add club_id to profile_roles (nullable for platform-wide roles)
ALTER TABLE profile_roles ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;

-- Add club_id to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;

-- Add club_id to seasons
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;

-- Fix valid_role constraint to include club_admin
ALTER TABLE profile_roles DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE profile_roles ADD CONSTRAINT valid_role 
  CHECK (role IN ('admin', 'club_admin', 'team_manager', 'coach', 'parent', 'player'));

-- Indexes for club_id foreign keys
CREATE INDEX IF NOT EXISTS idx_profiles_club_id ON profiles(club_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_club_id ON profile_roles(club_id);
CREATE INDEX IF NOT EXISTS idx_teams_club_id ON teams(club_id);
CREATE INDEX IF NOT EXISTS idx_seasons_club_id ON seasons(club_id);

-- RLS Policies for clubs table

-- Platform admins can view all clubs
CREATE POLICY "Platform admins can view all clubs" ON clubs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role = 'admin'
        AND pr.club_id IS NULL
    )
  );

-- Club admins can view their own club
CREATE POLICY "Club admins can view their club" ON clubs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('club_admin', 'admin')
        AND pr.club_id = clubs.id
    )
  );

-- Platform admins can insert clubs
CREATE POLICY "Platform admins can insert clubs" ON clubs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role = 'admin'
        AND pr.club_id IS NULL
    )
  );

-- Platform admins can update any club
CREATE POLICY "Platform admins can update clubs" ON clubs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role = 'admin'
        AND pr.club_id IS NULL
    )
  );

-- Club admins can update their own club
CREATE POLICY "Club admins can update their club" ON clubs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('club_admin', 'admin')
        AND pr.club_id = clubs.id
    )
  );

-- Platform admins can delete clubs
CREATE POLICY "Platform admins can delete clubs" ON clubs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role = 'admin'
        AND pr.club_id IS NULL
    )
  );

-- Update existing policies to scope by club_id

-- Teams: Club admins and team managers can manage teams in their clubs
DROP POLICY IF EXISTS "Admins can manage teams" ON teams;
DROP POLICY IF EXISTS "Admins and team managers can manage teams" ON teams;

CREATE POLICY "Admins and team managers can manage teams in their clubs" ON teams
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin', 'team_manager')
        AND (pr.club_id IS NULL OR pr.club_id = teams.club_id)
    )
  );

-- Seasons: Club admins can manage seasons in their clubs
DROP POLICY IF EXISTS "Admins can manage seasons" ON seasons;
DROP POLICY IF EXISTS "Admins and team managers can manage seasons" ON seasons;

CREATE POLICY "Admins and team managers can manage seasons in their clubs" ON seasons
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin', 'team_manager')
        AND (pr.club_id IS NULL OR pr.club_id = seasons.club_id)
    )
  );

-- Games: Club admins and team managers can manage games in their clubs
DROP POLICY IF EXISTS "Admins can manage games" ON games;
DROP POLICY IF EXISTS "Team managers can manage their games" ON games;
DROP POLICY IF EXISTS "Admins and team managers can manage games" ON games;

CREATE POLICY "Admins and team managers can manage games in their clubs" ON games
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      JOIN teams t ON t.id = games.team_id
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin', 'team_manager')
        AND (pr.club_id IS NULL OR pr.club_id = t.club_id)
    )
  );

-- Players: Club admins and team managers can manage players in their clubs
DROP POLICY IF EXISTS "Admins can manage players" ON players;
DROP POLICY IF EXISTS "Team managers can manage their players" ON players;
DROP POLICY IF EXISTS "Admins and team managers can manage players" ON players;

CREATE POLICY "Admins and team managers can manage players in their clubs" ON players
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      JOIN teams t ON t.id = players.team_id
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin', 'team_manager')
        AND (pr.club_id IS NULL OR pr.club_id = t.club_id)
    )
  );

-- Game rosters: Club admins and team managers can manage game rosters in their clubs
DROP POLICY IF EXISTS "Admins can manage game rosters" ON game_rosters;
DROP POLICY IF EXISTS "Team managers can manage their game rosters" ON game_rosters;
DROP POLICY IF EXISTS "Admins and team managers can manage game rosters" ON game_rosters;

CREATE POLICY "Admins and team managers can manage game rosters in their clubs" ON game_rosters
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      JOIN games g ON g.id = game_rosters.game_id
      JOIN teams t ON t.id = g.team_id
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin', 'team_manager')
        AND (pr.club_id IS NULL OR pr.club_id = t.club_id)
    )
  );

-- Player game stats: Club admins and team managers can manage stats in their clubs
DROP POLICY IF EXISTS "Admins can manage player game stats" ON player_game_stats;
DROP POLICY IF EXISTS "Team managers can manage their player game stats" ON player_game_stats;
DROP POLICY IF EXISTS "Admins and team managers can manage player game stats" ON player_game_stats;

CREATE POLICY "Admins and team managers can manage player game stats in their clubs" ON player_game_stats
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      JOIN games g ON g.id = player_game_stats.game_id
      JOIN teams t ON t.id = g.team_id
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin', 'team_manager')
        AND (pr.club_id IS NULL OR pr.club_id = t.club_id)
    )
  );

-- Profiles: Platform admins can manage all profiles, club admins can manage their club's profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view profiles in their scope" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin')
        AND (pr.club_id IS NULL OR pr.club_id = profiles.club_id)
    )
  );

CREATE POLICY "Admins can manage profiles in their scope" ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin')
        AND (pr.club_id IS NULL OR pr.club_id = profiles.club_id)
    )
  );

-- Profile roles: Platform admins can manage all roles, club admins can manage roles in their club
DROP POLICY IF EXISTS "Admins can manage profile roles" ON profile_roles;

CREATE POLICY "Admins can manage profile roles in their scope" ON profile_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profile_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('admin', 'club_admin')
        AND (pr.club_id IS NULL OR pr.club_id = profile_roles.club_id)
    )
  );
