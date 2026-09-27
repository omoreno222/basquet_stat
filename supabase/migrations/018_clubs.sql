-- Migration 018: Multi-Club (Multi-Tenancy)
-- Depends on: 017_club_admin_role.sql (club_admin enum value must exist)
-- Transforms the application into a multi-tenant system where clubs are the primary tenants.
-- Each club has its own teams, players, users (except platform admin), and games.
-- Platform admin (Oscar) can create clubs and see everything.
-- Club admins can manage their own club's data but cannot see other clubs.

-- ============================================================================
-- PART 1: ENUMS AND CORE TABLES
-- ============================================================================

ALTER TABLE profile_roles DROP CONSTRAINT IF EXISTS valid_role;

-- Create team_category enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_category') THEN
    CREATE TYPE team_category AS ENUM ('premini', 'mini', 'infantil', 'cadete', 'junior', 'sub22', 'senior');
  END IF;
END $$;

-- Create team_gender enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_gender') THEN
    CREATE TYPE team_gender AS ENUM ('male', 'female', 'mixed');
  END IF;
END $$;

-- Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e40af',
  secondary_color TEXT DEFAULT '#f97316',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name);

COMMENT ON TABLE clubs IS 'Basketball clubs - the primary tenant entity';
COMMENT ON COLUMN clubs.logo_url IS 'Public URL to club logo stored in avatars bucket under clubs/<club_id>/';
COMMENT ON COLUMN clubs.primary_color IS 'Hex color code for club primary color (used in UI)';
COMMENT ON COLUMN clubs.secondary_color IS 'Hex color code for club secondary color (used in UI)';

-- ============================================================================
-- PART 2: ADD CLUB REFERENCES TO EXISTING TABLES
-- ============================================================================

-- Add club_id to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS club_id UUID;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS category team_category;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS gender team_gender;

-- Add club_id to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS club_id UUID;

-- Add club_id to profile_roles (null only for platform admin)
ALTER TABLE profile_roles ADD COLUMN IF NOT EXISTS club_id UUID;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_teams_club ON teams(club_id);
CREATE INDEX IF NOT EXISTS idx_players_club ON players(club_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_club ON profile_roles(club_id);

-- ============================================================================
-- PART 3: BACKFILL DEMO CLUB
-- ============================================================================

-- Create a demo club and assign all existing data to it
DO $$
DECLARE
  demo_club_id UUID;
  first_team_name TEXT;
BEGIN
  -- Check if clubs table is empty
  IF NOT EXISTS (SELECT 1 FROM clubs LIMIT 1) THEN
    -- Get the name of the first team to use as club name basis
    SELECT name INTO first_team_name FROM teams ORDER BY created_at LIMIT 1;
    
    -- Create demo club
    INSERT INTO clubs (id, name, short_name, primary_color, secondary_color)
    VALUES (
      uuid_generate_v4(),
      COALESCE(first_team_name || ' Basketball Club', 'Demo Basketball Club'),
      COALESCE(SUBSTRING(first_team_name FROM 1 FOR 3), 'DBC'),
      '#1e40af',
      '#f97316'
    )
    RETURNING id INTO demo_club_id;

    -- Assign all existing teams to demo club with default category/gender
    UPDATE teams 
    SET club_id = demo_club_id,
        category = 'senior',
        gender = 'mixed'
    WHERE club_id IS NULL;

    -- Assign all existing players to demo club
    UPDATE players 
    SET club_id = demo_club_id
    WHERE club_id IS NULL;

    -- Assign all non-admin roles to demo club (admin stays platform admin)
    UPDATE profile_roles
    SET club_id = demo_club_id
    WHERE club_id IS NULL AND role != 'admin';

    RAISE NOTICE 'Created demo club (%) and assigned all existing data', demo_club_id;
  END IF;
END $$;

-- ============================================================================
-- PART 4: ADD NOT NULL CONSTRAINTS AND FOREIGN KEYS
-- ============================================================================

-- Now that backfill is done, add NOT NULL constraints and foreign keys
ALTER TABLE teams 
  ALTER COLUMN club_id SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN gender SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teams_club' AND conrelid = 'teams'::regclass) THEN
    ALTER TABLE teams ADD CONSTRAINT fk_teams_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE players 
  ALTER COLUMN club_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_players_club' AND conrelid = 'players'::regclass) THEN
    ALTER TABLE players ADD CONSTRAINT fk_players_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- profile_roles.club_id stays nullable (null for platform admin only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profile_roles_club' AND conrelid = 'profile_roles'::regclass) THEN
    ALTER TABLE profile_roles ADD CONSTRAINT fk_profile_roles_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN teams.club_id IS 'Club this team belongs to';
COMMENT ON COLUMN teams.category IS 'Team category (premini, mini, infantil, cadete, junior, sub22, senior)';
COMMENT ON COLUMN teams.gender IS 'Team gender (male, female, mixed)';
COMMENT ON COLUMN players.club_id IS 'Club this player belongs to';
COMMENT ON COLUMN profile_roles.club_id IS 'Club this role is scoped to (null only for platform admin)';

-- 'admin' role is platform-level only (club admins must not be able to grant legacy is_admin())
ALTER TABLE profile_roles DROP CONSTRAINT IF EXISTS admin_role_is_platform_only;
ALTER TABLE profile_roles ADD CONSTRAINT admin_role_is_platform_only CHECK (role <> 'admin' OR club_id IS NULL);

-- ============================================================================
-- PART 5: SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================================

-- Check if user is platform admin (role='admin' with null club_id)
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profile_roles
    WHERE profile_id = auth.uid()
    AND role = 'admin'
    AND club_id IS NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

COMMENT ON FUNCTION is_platform_admin() IS 'Check if current user is platform admin (super admin)';

-- Check if user is admin of a specific club
CREATE OR REPLACE FUNCTION is_club_admin(p_club_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profile_roles
    WHERE profile_id = auth.uid()
    AND role IN ('admin', 'club_admin')
    AND (club_id = p_club_id OR club_id IS NULL) -- platform admin can access any club
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION is_club_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_club_admin(UUID) TO authenticated;

COMMENT ON FUNCTION is_club_admin(UUID) IS 'Check if current user is admin of specified club or platform admin';

-- Check if user has a specific role in a club
CREATE OR REPLACE FUNCTION has_club_role(p_club_id UUID, p_role user_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profile_roles
    WHERE profile_id = auth.uid()
    AND role = p_role
    AND (club_id = p_club_id OR club_id IS NULL) -- platform admin has all roles
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION has_club_role(UUID, user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_club_role(UUID, user_role) TO authenticated;

COMMENT ON FUNCTION has_club_role(UUID, user_role) IS 'Check if current user has specified role in club';

-- Get all clubs the current user has access to
CREATE OR REPLACE FUNCTION get_user_clubs()
RETURNS TABLE(club_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Platform admin sees all clubs
  IF is_platform_admin() THEN
    RETURN QUERY SELECT id FROM clubs;
  ELSE
    -- Regular users see only their clubs
    RETURN QUERY
    SELECT DISTINCT pr.club_id
    FROM profile_roles pr
    WHERE pr.profile_id = auth.uid()
    AND pr.club_id IS NOT NULL;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_user_clubs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_clubs() TO authenticated;

COMMENT ON FUNCTION get_user_clubs() IS 'Get all clubs the current user has access to';

-- Get clubs where current user is club_admin or team_manager (SECURITY DEFINER: avoids RLS recursion on profile_roles)
CREATE OR REPLACE FUNCTION get_user_managed_clubs()
RETURNS TABLE(club_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pr.club_id FROM profile_roles pr
  WHERE pr.profile_id = auth.uid()
    AND pr.role IN ('club_admin', 'team_manager')
    AND pr.club_id IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION get_user_managed_clubs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_managed_clubs() TO authenticated;

COMMENT ON FUNCTION get_user_managed_clubs() IS 'Get clubs where current user is club_admin or team_manager (RLS-safe)';

-- Get profile IDs that have roles in clubs the current user manages (SECURITY DEFINER: avoids RLS recursion)
CREATE OR REPLACE FUNCTION get_managed_club_members()
RETURNS TABLE(profile_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT pr.profile_id FROM profile_roles pr
  WHERE pr.club_id IN (SELECT get_user_managed_clubs())
    AND pr.club_id IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION get_managed_club_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_managed_club_members() TO authenticated;

COMMENT ON FUNCTION get_managed_club_members() IS 'Get profile IDs of users in clubs the current user manages (RLS-safe)';

-- Get player IDs for children linked to the current user (parent role)
CREATE OR REPLACE FUNCTION get_user_children_player_ids()
RETURNS TABLE(player_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ppl.player_id FROM parent_player_links ppl
  WHERE ppl.parent_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION get_user_children_player_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_children_player_ids() TO authenticated;

COMMENT ON FUNCTION get_user_children_player_ids() IS 'Get player IDs for children linked to current user as parent';

-- Get team IDs for teams the current user plays on (player role via players.user_id)
CREATE OR REPLACE FUNCTION get_user_player_team_ids()
RETURNS TABLE(team_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.team_id FROM players p
  WHERE p.user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION get_user_player_team_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_player_team_ids() TO authenticated;

COMMENT ON FUNCTION get_user_player_team_ids() IS 'Get team IDs where current user is a player';

-- Check if user has privileged club roles (club_admin, team_manager, coach, admin)
CREATE OR REPLACE FUNCTION has_privileged_club_role(p_club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles pr
    WHERE pr.profile_id = auth.uid()
      AND pr.role IN ('admin', 'club_admin', 'team_manager', 'coach')
      AND (pr.club_id = p_club_id OR pr.club_id IS NULL)
  );
$$;

REVOKE EXECUTE ON FUNCTION has_privileged_club_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_privileged_club_role(UUID) TO authenticated;

COMMENT ON FUNCTION has_privileged_club_role(UUID) IS 'Check if user has club-wide access role in specified club';

-- ============================================================================
-- PART 6: UPDATE RLS POLICIES
-- ============================================================================

-- Enable RLS on clubs
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Clubs RLS policies
DROP POLICY IF EXISTS "Users can view their clubs" ON clubs;
CREATE POLICY "Users can view their clubs"
  ON clubs
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_user_clubs()));

DROP POLICY IF EXISTS "Platform admins can manage all clubs" ON clubs;
CREATE POLICY "Platform admins can manage all clubs"
  ON clubs
  FOR ALL
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Club admins can update their club" ON clubs;
CREATE POLICY "Club admins can update their club"
  ON clubs
  FOR UPDATE
  TO authenticated
  USING (is_club_admin(id))
  WITH CHECK (is_club_admin(id));

-- Teams RLS policies (replace existing)
DROP POLICY IF EXISTS "Anyone can view teams" ON teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON teams;

DROP POLICY IF EXISTS "Users can view teams from their clubs" ON teams;
CREATE POLICY "Users can view teams from their clubs"
  ON teams
  FOR SELECT
  TO authenticated
  USING (club_id IN (SELECT get_user_clubs()));

DROP POLICY IF EXISTS "Admins can manage teams in their clubs" ON teams;
CREATE POLICY "Admins can manage teams in their clubs"
  ON teams
  FOR ALL
  TO authenticated
  USING (is_platform_admin() OR is_club_admin(club_id));

-- Players RLS policies (replace existing)
DROP POLICY IF EXISTS "Anyone can view players" ON players;
DROP POLICY IF EXISTS "Admins can manage players" ON players;
DROP POLICY IF EXISTS "Players can view their own team" ON players;

DROP POLICY IF EXISTS "Users can view players from their clubs" ON players;
CREATE POLICY "Users can view players from their clubs"
  ON players
  FOR SELECT
  TO authenticated
  USING (
    -- Platform admin, club admins, coaches, team managers see all players in their clubs
    (club_id IN (SELECT get_user_clubs()) AND has_privileged_club_role(club_id))
    -- Players see all players in their own team(s)
    OR team_id IN (SELECT get_user_player_team_ids())
    -- Parents see only their own children
    OR id IN (SELECT get_user_children_player_ids())
  );

DROP POLICY IF EXISTS "Admins can manage players in their clubs" ON players;
CREATE POLICY "Admins can manage players in their clubs"
  ON players
  FOR ALL
  TO authenticated
  USING (is_platform_admin() OR is_club_admin(club_id));

-- Games RLS policies (replace existing - games are club-scoped via team)
DROP POLICY IF EXISTS "Anyone can view games" ON games;
DROP POLICY IF EXISTS "Admins and team managers can manage games" ON games;
DROP POLICY IF EXISTS "Players can view their team games" ON games;

DROP POLICY IF EXISTS "Users can view games from their clubs" ON games;
CREATE POLICY "Users can view games from their clubs"
  ON games
  FOR SELECT
  TO authenticated
  USING (
    -- Platform admin, club admins, coaches, team managers see all games in their clubs
    team_id IN (
      SELECT id FROM teams 
      WHERE club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(club_id)
    )
    -- Players see games of their own team(s)
    OR team_id IN (SELECT get_user_player_team_ids())
    -- Parents see games of their children's teams
    OR team_id IN (
      SELECT p.team_id FROM players p
      WHERE p.id IN (SELECT get_user_children_player_ids())
    )
  );

DROP POLICY IF EXISTS "Admins and team managers can manage games in their clubs" ON games;
CREATE POLICY "Admins and team managers can manage games in their clubs"
  ON games
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR team_id IN (
      SELECT id FROM teams 
      WHERE club_id IN (
        SELECT get_user_managed_clubs()
      )
    )
  );

-- Game events RLS (replace existing)
DROP POLICY IF EXISTS "Anyone can view game events" ON game_events;
DROP POLICY IF EXISTS "Team managers can manage events" ON game_events;
DROP POLICY IF EXISTS "Players can view their team events" ON game_events;

DROP POLICY IF EXISTS "Users can view game events from their clubs" ON game_events;
CREATE POLICY "Users can view game events from their clubs"
  ON game_events
  FOR SELECT
  TO authenticated
  USING (
    -- Platform admin, club admins, coaches, team managers see all events in their clubs
    game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    -- Players see all events in their own team's games
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    -- Parents see only events of their own children
    OR player_id IN (SELECT get_user_children_player_ids())
  );

DROP POLICY IF EXISTS "Team managers can manage events in their clubs" ON game_events;
CREATE POLICY "Team managers can manage events in their clubs"
  ON game_events
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (
        SELECT get_user_managed_clubs()
      )
    )
  );

-- Starting lineups RLS
DROP POLICY IF EXISTS "Anyone can view starting lineups" ON starting_lineups;
DROP POLICY IF EXISTS "Team managers can manage starting lineups" ON starting_lineups;
DROP POLICY IF EXISTS "Players can view their team lineups" ON starting_lineups;

DROP POLICY IF EXISTS "Users can view starting lineups from their clubs" ON starting_lineups;
CREATE POLICY "Users can view starting lineups from their clubs"
  ON starting_lineups
  FOR SELECT
  TO authenticated
  USING (
    -- Platform admin, club admins, coaches, team managers see all lineups in their clubs
    game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    -- Players see all lineups in their own team's games
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    -- Parents see only lineups involving their own children
    OR player_id IN (SELECT get_user_children_player_ids())
  );

DROP POLICY IF EXISTS "Team managers can manage lineups in their clubs" ON starting_lineups;
CREATE POLICY "Team managers can manage lineups in their clubs"
  ON starting_lineups
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (
        SELECT get_user_managed_clubs()
      )
    )
  );

-- Game periods RLS
DROP POLICY IF EXISTS "Anyone can view game periods" ON game_periods;
DROP POLICY IF EXISTS "Admins and team managers can manage periods" ON game_periods;
DROP POLICY IF EXISTS "Players can view their team game periods" ON game_periods;

DROP POLICY IF EXISTS "Users can view game periods from their clubs" ON game_periods;
CREATE POLICY "Users can view game periods from their clubs"
  ON game_periods
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
    )
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (SELECT get_user_player_teams())
    )
  );

DROP POLICY IF EXISTS "Team managers can manage periods in their clubs" ON game_periods;
CREATE POLICY "Team managers can manage periods in their clubs"
  ON game_periods
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (
        SELECT get_user_managed_clubs()
      )
    )
  );

-- Game guest players RLS
DROP POLICY IF EXISTS "Anyone authenticated can view game guest players" ON game_guest_players;
DROP POLICY IF EXISTS "Admins and team managers can add guest players" ON game_guest_players;
DROP POLICY IF EXISTS "Admins and team managers can delete guest players" ON game_guest_players;
DROP POLICY IF EXISTS "Players can view their team guest players" ON game_guest_players;

DROP POLICY IF EXISTS "Users can view game guest players from their clubs" ON game_guest_players;
CREATE POLICY "Users can view game guest players from their clubs"
  ON game_guest_players
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
    )
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (SELECT get_user_player_teams())
    )
  );

DROP POLICY IF EXISTS "Team managers can manage guest players in their clubs" ON game_guest_players;
CREATE POLICY "Team managers can manage guest players in their clubs"
  ON game_guest_players
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (
        SELECT get_user_managed_clubs()
      )
    )
  );

-- Profile roles RLS (users can see roles in their clubs)
DROP POLICY IF EXISTS "Users can view their own roles" ON profile_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON profile_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON profile_roles;

DROP POLICY IF EXISTS "Users can view roles in their clubs" ON profile_roles;
CREATE POLICY "Users can view roles in their clubs"
  ON profile_roles
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR club_id IN (SELECT get_user_clubs())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Admins can manage roles in their clubs" ON profile_roles;
CREATE POLICY "Admins can manage roles in their clubs"
  ON profile_roles
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR (
      club_id IS NOT NULL 
      AND has_club_role(club_id, 'club_admin')
      AND role IN ('club_admin', 'team_manager', 'coach', 'parent', 'player')
      AND club_id IN (SELECT get_user_managed_clubs())
    )
  );

-- Parent player links RLS (scoped by player's club)
DROP POLICY IF EXISTS "Parents can view their own links" ON parent_player_links;
DROP POLICY IF EXISTS "Admins can view all links" ON parent_player_links;
DROP POLICY IF EXISTS "Admins can manage links" ON parent_player_links;

DROP POLICY IF EXISTS "Users can view parent links in their clubs" ON parent_player_links;
CREATE POLICY "Users can view parent links in their clubs"
  ON parent_player_links
  FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
    OR player_id IN (
      SELECT id FROM players WHERE club_id IN (SELECT get_user_clubs())
    )
  );

DROP POLICY IF EXISTS "Admins can manage parent links in their clubs" ON parent_player_links;
CREATE POLICY "Admins can manage parent links in their clubs"
  ON parent_player_links
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR player_id IN (
      SELECT id FROM players 
      WHERE club_id IN (
        SELECT get_user_managed_clubs()
      )
    )
  );

-- Profiles RLS: Add club admin access to their club members
DROP POLICY IF EXISTS "Club admins can view their club members" ON profiles;
CREATE POLICY "Club admins can view their club members"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT get_managed_club_members())
  );

-- Stints RLS (scoped by game's team's club)
DROP POLICY IF EXISTS "Anyone can view stints" ON stints;
DROP POLICY IF EXISTS "Team managers can manage stints" ON stints;

DROP POLICY IF EXISTS "Users can view stints from their clubs" ON stints;
CREATE POLICY "Users can view stints from their clubs"
  ON stints
  FOR SELECT
  TO authenticated
  USING (
    -- Platform admin, club admins, coaches, team managers see all stints in their clubs
    game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    -- Players see all stints in their own team's games
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    -- Parents see only stints of their own children
    OR player_id IN (SELECT get_user_children_player_ids())
  );

DROP POLICY IF EXISTS "Team managers can manage stints in their clubs" ON stints;
CREATE POLICY "Team managers can manage stints in their clubs"
  ON stints
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (
        SELECT get_user_managed_clubs()
      )
    )
  );

-- ============================================================================
-- PART 7: TRIGGERS FOR SAME-CLUB ENFORCEMENT
-- ============================================================================

-- Trigger: Guest players must be from the same club as the game's team
CREATE OR REPLACE FUNCTION enforce_same_club_guest_players()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_game_club_id UUID;
  v_player_club_id UUID;
BEGIN
  -- Get the club_id of the game's team
  SELECT t.club_id INTO v_game_club_id
  FROM games g
  JOIN teams t ON g.team_id = t.id
  WHERE g.id = NEW.game_id;

  -- Get the club_id of the guest player
  SELECT club_id INTO v_player_club_id
  FROM players
  WHERE id = NEW.player_id;

  -- Enforce same club
  IF v_game_club_id != v_player_club_id THEN
    RAISE EXCEPTION 'Guest player must be from the same club as the game team'
      USING HINT = 'Guest players can only be added from within the same club';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_same_club_guest_players ON game_guest_players;
CREATE TRIGGER enforce_same_club_guest_players
  BEFORE INSERT OR UPDATE ON game_guest_players
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_club_guest_players();

COMMENT ON FUNCTION enforce_same_club_guest_players() IS 'Ensure guest players are from the same club as the game';

-- Trigger: Players on a team must be from the same club as the team
CREATE OR REPLACE FUNCTION enforce_same_club_team_players()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_club_id UUID;
BEGIN
  -- Get the club_id of the team
  SELECT club_id INTO v_team_club_id
  FROM teams
  WHERE id = NEW.team_id;

  -- Enforce same club
  IF NEW.club_id != v_team_club_id THEN
    RAISE EXCEPTION 'Player must belong to the same club as the team'
      USING HINT = 'Players can only be assigned to teams within their club';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_same_club_team_players ON players;
CREATE TRIGGER enforce_same_club_team_players
  BEFORE INSERT OR UPDATE OF team_id, club_id ON players
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_club_team_players();

COMMENT ON FUNCTION enforce_same_club_team_players() IS 'Ensure players are on teams within their club';

-- ============================================================================
-- PART 8: STORAGE POLICIES FOR CLUB LOGOS
-- ============================================================================

-- Club logos stored in avatars bucket under clubs/<club_id>/
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload club logos'
  ) THEN
    CREATE POLICY "Admins can upload club logos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = 'clubs'
        AND (is_platform_admin() OR is_club_admin(((storage.foldername(name))[2])::UUID))
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can update club logos'
  ) THEN
    CREATE POLICY "Admins can update club logos"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = 'clubs'
        AND (is_platform_admin() OR is_club_admin(((storage.foldername(name))[2])::UUID))
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can delete club logos'
  ) THEN
    CREATE POLICY "Admins can delete club logos"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = 'clubs'
        AND (is_platform_admin() OR is_club_admin(((storage.foldername(name))[2])::UUID))
      );
  END IF;
END $$;

-- Public can view club logos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view club logos'
  ) THEN
    CREATE POLICY "Anyone can view club logos"
      ON storage.objects
      FOR SELECT
      TO public
      USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = 'clubs'
      );
  END IF;
END $$;

-- ============================================================================
-- PART 9: TRANSLATION KEYS
-- ============================================================================

INSERT INTO translations (key, locale, value)
VALUES
  -- Club management
  ('trke_clubs', 'en', 'Clubs'),
  ('trke_clubs', 'es', 'Clubes'),
  ('trke_clubs', 'ca', 'Clubs'),
  
  ('trke_club', 'en', 'Club'),
  ('trke_club', 'es', 'Club'),
  ('trke_club', 'ca', 'Club'),
  
  ('trke_my_club', 'en', 'My Club'),
  ('trke_my_club', 'es', 'Mi Club'),
  ('trke_my_club', 'ca', 'El Meu Club'),
  
  ('trke_add_club', 'en', 'Add Club'),
  ('trke_add_club', 'es', 'Añadir Club'),
  ('trke_add_club', 'ca', 'Afegir Club'),
  
  ('trke_club_name', 'en', 'Club Name'),
  ('trke_club_name', 'es', 'Nombre del Club'),
  ('trke_club_name', 'ca', 'Nom del Club'),
  
  ('trke_short_name', 'en', 'Short Name'),
  ('trke_short_name', 'es', 'Nombre Corto'),
  ('trke_short_name', 'ca', 'Nom Curt'),
  
  ('trke_club_logo', 'en', 'Club Logo'),
  ('trke_club_logo', 'es', 'Logo del Club'),
  ('trke_club_logo', 'ca', 'Logo del Club'),
  
  ('trke_primary_color', 'en', 'Primary Color'),
  ('trke_primary_color', 'es', 'Color Primario'),
  ('trke_primary_color', 'ca', 'Color Primari'),
  
  ('trke_secondary_color', 'en', 'Secondary Color'),
  ('trke_secondary_color', 'es', 'Color Secundario'),
  ('trke_secondary_color', 'ca', 'Color Secundari'),
  
  ('trke_switch_club', 'en', 'Switch Club'),
  ('trke_switch_club', 'es', 'Cambiar Club'),
  ('trke_switch_club', 'ca', 'Canviar Club'),
  
  ('trke_current_club', 'en', 'Current Club'),
  ('trke_current_club', 'es', 'Club Actual'),
  ('trke_current_club', 'ca', 'Club Actual'),
  
  -- Roles
  ('trke_role_club_admin', 'en', 'Club Admin'),
  ('trke_role_club_admin', 'es', 'Administrador del Club'),
  ('trke_role_club_admin', 'ca', 'Administrador del Club'),
  
  ('trke_role_platform_admin', 'en', 'Platform Admin'),
  ('trke_role_platform_admin', 'es', 'Administrador de Plataforma'),
  ('trke_role_platform_admin', 'ca', 'Administrador de Plataforma'),
  
  -- Team categories
  ('trke_category_premini', 'en', 'Pre-Mini'),
  ('trke_category_premini', 'es', 'Pre-Mini'),
  ('trke_category_premini', 'ca', 'Pre-Mini'),
  
  ('trke_category_mini', 'en', 'Mini'),
  ('trke_category_mini', 'es', 'Mini'),
  ('trke_category_mini', 'ca', 'Mini'),
  
  ('trke_category_infantil', 'en', 'Infantil'),
  ('trke_category_infantil', 'es', 'Infantil'),
  ('trke_category_infantil', 'ca', 'Infantil'),
  
  ('trke_category_cadete', 'en', 'Cadete'),
  ('trke_category_cadete', 'es', 'Cadete'),
  ('trke_category_cadete', 'ca', 'Cadet'),
  
  ('trke_category_junior', 'en', 'Junior'),
  ('trke_category_junior', 'es', 'Junior'),
  ('trke_category_junior', 'ca', 'Júnior'),
  
  ('trke_category_sub22', 'en', 'U-22'),
  ('trke_category_sub22', 'es', 'Sub-22'),
  ('trke_category_sub22', 'ca', 'Sub-22'),
  
  ('trke_category_senior', 'en', 'Senior'),
  ('trke_category_senior', 'es', 'Sénior'),
  ('trke_category_senior', 'ca', 'Sènior'),
  
  -- Team genders
  ('trke_gender_male', 'en', 'Male'),
  ('trke_gender_male', 'es', 'Masculino'),
  ('trke_gender_male', 'ca', 'Masculí'),
  
  ('trke_gender_female', 'en', 'Female'),
  ('trke_gender_female', 'es', 'Femenino'),
  ('trke_gender_female', 'ca', 'Femení'),
  
  ('trke_gender_mixed', 'en', 'Mixed'),
  ('trke_gender_mixed', 'es', 'Mixto'),
  ('trke_gender_mixed', 'ca', 'Mixt'),
  
  -- Logo actions (moved from teams to clubs)
  ('trke_upload_logo', 'en', 'Upload Logo'),
  ('trke_upload_logo', 'es', 'Subir Logo'),
  ('trke_upload_logo', 'ca', 'Pujar Logo'),
  
  ('trke_change_logo', 'en', 'Change Logo'),
  ('trke_change_logo', 'es', 'Cambiar Logo'),
  ('trke_change_logo', 'ca', 'Canviar Logo'),
  
  ('trke_remove_logo', 'en', 'Remove Logo'),
  ('trke_remove_logo', 'es', 'Eliminar Logo'),
  ('trke_remove_logo', 'ca', 'Eliminar Logo'),
  
  ('trke_logo_uploaded', 'en', 'Logo uploaded successfully'),
  ('trke_logo_uploaded', 'es', 'Logo subido con éxito'),
  ('trke_logo_uploaded', 'ca', 'Logo pujat amb èxit'),
  
  ('trke_logo_removed', 'en', 'Logo removed successfully'),
  ('trke_logo_removed', 'es', 'Logo eliminado con éxito'),
  ('trke_logo_removed', 'ca', 'Logo eliminat amb èxit'),
  
  -- Scorer's table marker
  ('trke_scorers_table', 'en', 'TABLE'),
  ('trke_scorers_table', 'es', 'MESA'),
  ('trke_scorers_table', 'ca', 'TAULA'),
  
  -- Choose attacking basket
  ('trke_choose_attacking_basket', 'en', 'Choose Attacking Basket'),
  ('trke_choose_attacking_basket', 'es', 'Elegir Canasta de Ataque'),
  ('trke_choose_attacking_basket', 'ca', 'Triar Cistella d''Atac'),
  
  ('trke_tap_basket_to_attack', 'en', 'Tap the basket your team will attack in Q1'),
  ('trke_tap_basket_to_attack', 'es', 'Toca la canasta que tu equipo atacará en Q1'),
  ('trke_tap_basket_to_attack', 'ca', 'Toca la cistella que el teu equip atacarà a Q1'),
  
  ('trke_left_basket', 'en', 'Left Basket'),
  ('trke_left_basket', 'es', 'Canasta Izquierda'),
  ('trke_left_basket', 'ca', 'Cistella Esquerra'),
  
  ('trke_right_basket', 'en', 'Right Basket'),
  ('trke_right_basket', 'es', 'Canasta Derecha'),
  ('trke_right_basket', 'ca', 'Cistella Dreta')

ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();

-- ============================================================================
-- PART 10: UPDATE TRIGGERS FOR UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS update_clubs_updated_at ON clubs;
CREATE TRIGGER update_clubs_updated_at 
  BEFORE UPDATE ON clubs
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration transforms the application into a multi-tenant system.
-- Platform admin (Oscar) can create clubs and see all data.
-- Club admins can manage their club's teams, players, users, and games.
-- All data is scoped by club except seasons (which remain global).
