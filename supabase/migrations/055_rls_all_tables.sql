-- RLS for every public table, ready to paste into the Supabase SQL editor.
-- Idempotent: drops the named policies and recreates them.
--
-- Who can see what
--   anon            SELECT on translations only (footer loads them before login)
--   authenticated   rows of their own club, team, or children
--   club admin      manage club, teams, players, roles, parent links
--   team manager    manage games and everything that hangs off a game
--   platform admin  manage every club
--
-- This also takes write grants away from anon. RLS already blocked those
-- writes; the grants were still sitting on every table.

BEGIN;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.translations TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_player_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_guest_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_opponent_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_opponent_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_period_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starting_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stints ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their clubs" ON public.clubs;
DROP POLICY IF EXISTS "Platform admins can manage all clubs" ON public.clubs;
DROP POLICY IF EXISTS "Club admins can update their club" ON public.clubs;

CREATE POLICY "Users can view their clubs"
  ON public.clubs
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_user_clubs()));

CREATE POLICY "Platform admins can manage all clubs"
  ON public.clubs
  FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Club admins can update their club"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (is_club_admin(id))
  WITH CHECK (is_club_admin(id));

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
DROP POLICY IF EXISTS "Users can view teams from their clubs" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams in their clubs" ON public.teams;

CREATE POLICY "Users can view teams from their clubs"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    (club_id IN (SELECT get_user_clubs()) AND has_privileged_club_role(club_id))
    OR is_platform_admin()
    OR id IN (SELECT get_user_player_team_ids())
    OR id IN (
      SELECT p.team_id FROM public.players p
      WHERE p.id IN (SELECT get_user_children_player_ids())
    )
  );

CREATE POLICY "Admins can manage teams in their clubs"
  ON public.teams
  FOR ALL
  TO authenticated
  USING (is_platform_admin() OR is_club_admin(club_id))
  WITH CHECK (is_platform_admin() OR is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
DROP POLICY IF EXISTS "Admins can manage players" ON public.players;
DROP POLICY IF EXISTS "Players can view their own team" ON public.players;
DROP POLICY IF EXISTS "Users can view players from their clubs" ON public.players;
DROP POLICY IF EXISTS "Admins can manage players in their clubs" ON public.players;

CREATE POLICY "Users can view players from their clubs"
  ON public.players
  FOR SELECT
  TO authenticated
  USING (
    (club_id IN (SELECT get_user_clubs()) AND has_privileged_club_role(club_id))
    OR team_id IN (SELECT get_user_player_team_ids())
    OR id IN (SELECT get_user_children_player_ids())
  );

CREATE POLICY "Admins can manage players in their clubs"
  ON public.players
  FOR ALL
  TO authenticated
  USING (is_platform_admin() OR is_club_admin(club_id))
  WITH CHECK (is_platform_admin() OR is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- profiles
-- Policies used to apply to PUBLIC (anon included). They now apply only
-- to signed-in users. A user still sees their own row; a platform admin
-- sees every row; a club admin sees members of the clubs they manage.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Club admins can view their club members" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Club admins can view their club members"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_managed_club_members()));

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- profile_roles
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own roles" ON public.profile_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.profile_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.profile_roles;
DROP POLICY IF EXISTS "Users can view roles in their clubs" ON public.profile_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their clubs" ON public.profile_roles;

CREATE POLICY "Users can view roles in their clubs"
  ON public.profile_roles
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR is_platform_admin()
    OR (
      club_id IN (SELECT get_user_clubs())
      AND has_privileged_club_role(club_id)
    )
  );

CREATE POLICY "Admins can manage roles in their clubs"
  ON public.profile_roles
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
  )
  WITH CHECK (
    is_platform_admin()
    OR (
      club_id IS NOT NULL
      AND has_club_role(club_id, 'club_admin')
      AND role IN ('club_admin', 'team_manager', 'coach', 'parent', 'player')
      AND club_id IN (SELECT get_user_managed_clubs())
    )
  );

-- ---------------------------------------------------------------------------
-- parent_player_links
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Parents can view their own links" ON public.parent_player_links;
DROP POLICY IF EXISTS "Admins can view all links" ON public.parent_player_links;
DROP POLICY IF EXISTS "Admins can manage links" ON public.parent_player_links;
DROP POLICY IF EXISTS "Users can view parent links in their clubs" ON public.parent_player_links;
DROP POLICY IF EXISTS "Admins can manage parent links in their clubs" ON public.parent_player_links;

CREATE POLICY "Users can view parent links in their clubs"
  ON public.parent_player_links
  FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
    OR player_id IN (
      SELECT id FROM public.players
      WHERE club_id IN (SELECT get_user_clubs())
    )
  );

CREATE POLICY "Admins can manage parent links in their clubs"
  ON public.parent_player_links
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR player_id IN (
      SELECT id FROM public.players
      WHERE club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR player_id IN (
      SELECT id FROM public.players
      WHERE club_id IN (SELECT get_user_managed_clubs())
    )
  );

-- ---------------------------------------------------------------------------
-- seasons
-- Was readable by anyone on the internet. Season names are only used
-- after login, so SELECT is now limited to signed-in users.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view seasons" ON public.seasons;
DROP POLICY IF EXISTS "Admins can manage seasons" ON public.seasons;
DROP POLICY IF EXISTS "Signed-in users can view seasons" ON public.seasons;

CREATE POLICY "Signed-in users can view seasons"
  ON public.seasons
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage seasons"
  ON public.seasons
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- translations
-- The root layout reads these with the anon key, before login.
-- Writes stay with platform admins.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view translations" ON public.translations;
DROP POLICY IF EXISTS "Admins can manage translations" ON public.translations;

CREATE POLICY "Anyone can view translations"
  ON public.translations
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage translations"
  ON public.translations
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- games and child tables
-- View: club staff, the player on that team, or a parent of a child on it.
-- Write: platform admin, or club admin / team manager of that club.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view games" ON public.games;
DROP POLICY IF EXISTS "Admins and team managers can manage games" ON public.games;
DROP POLICY IF EXISTS "Players can view their team games" ON public.games;
DROP POLICY IF EXISTS "Users can view games from their clubs" ON public.games;
DROP POLICY IF EXISTS "Admins and team managers can manage games in their clubs" ON public.games;

CREATE POLICY "Users can view games from their clubs"
  ON public.games
  FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT id FROM public.teams
      WHERE club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(club_id)
    )
    OR team_id IN (SELECT get_user_player_team_ids())
    OR team_id IN (
      SELECT p.team_id FROM public.players p
      WHERE p.id IN (SELECT get_user_children_player_ids())
    )
  );

CREATE POLICY "Admins and team managers can manage games in their clubs"
  ON public.games
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR team_id IN (
      SELECT id FROM public.teams
      WHERE club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR team_id IN (
      SELECT id FROM public.teams
      WHERE club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Anyone can view game events" ON public.game_events;
DROP POLICY IF EXISTS "Team managers can manage events" ON public.game_events;
DROP POLICY IF EXISTS "Players can view their team events" ON public.game_events;
DROP POLICY IF EXISTS "Users can view game events from their clubs" ON public.game_events;
DROP POLICY IF EXISTS "Team managers can manage events in their clubs" ON public.game_events;

CREATE POLICY "Users can view game events from their clubs"
  ON public.game_events
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR player_id IN (SELECT get_user_children_player_ids())
  );

CREATE POLICY "Team managers can manage events in their clubs"
  ON public.game_events
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Anyone can view game periods" ON public.game_periods;
DROP POLICY IF EXISTS "Admins and team managers can manage periods" ON public.game_periods;
DROP POLICY IF EXISTS "Players can view their team game periods" ON public.game_periods;
DROP POLICY IF EXISTS "Users can view game periods from their clubs" ON public.game_periods;
DROP POLICY IF EXISTS "Team managers can manage periods in their clubs" ON public.game_periods;

CREATE POLICY "Users can view game periods from their clubs"
  ON public.game_periods
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_teams())
    )
  );

CREATE POLICY "Team managers can manage periods in their clubs"
  ON public.game_periods
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Anyone authenticated can view game guest players" ON public.game_guest_players;
DROP POLICY IF EXISTS "Admins and team managers can add guest players" ON public.game_guest_players;
DROP POLICY IF EXISTS "Admins and team managers can delete guest players" ON public.game_guest_players;
DROP POLICY IF EXISTS "Players can view their team guest players" ON public.game_guest_players;
DROP POLICY IF EXISTS "Users can view game guest players from their clubs" ON public.game_guest_players;
DROP POLICY IF EXISTS "Team managers can manage guest players in their clubs" ON public.game_guest_players;

CREATE POLICY "Users can view game guest players from their clubs"
  ON public.game_guest_players
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_teams())
    )
  );

CREATE POLICY "Team managers can manage guest players in their clubs"
  ON public.game_guest_players
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Users can view opponent players from their clubs" ON public.game_opponent_players;
DROP POLICY IF EXISTS "Team managers can manage opponent players in their clubs" ON public.game_opponent_players;

CREATE POLICY "Users can view opponent players from their clubs"
  ON public.game_opponent_players
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (
        SELECT p.team_id FROM public.players p
        WHERE p.id IN (SELECT get_user_children_player_ids())
      )
    )
  );

CREATE POLICY "Team managers can manage opponent players in their clubs"
  ON public.game_opponent_players
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Users can view opponent lineups from their clubs" ON public.game_opponent_lineups;
DROP POLICY IF EXISTS "Team managers can manage opponent lineups in their clubs" ON public.game_opponent_lineups;

CREATE POLICY "Users can view opponent lineups from their clubs"
  ON public.game_opponent_lineups
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (
        SELECT p.team_id FROM public.players p
        WHERE p.id IN (SELECT get_user_children_player_ids())
      )
    )
  );

CREATE POLICY "Team managers can manage opponent lineups in their clubs"
  ON public.game_opponent_lineups
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Users can view squads from their clubs" ON public.game_squads;
DROP POLICY IF EXISTS "Team managers can manage squads in their clubs" ON public.game_squads;

CREATE POLICY "Users can view squads from their clubs"
  ON public.game_squads
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (
        SELECT p.team_id FROM public.players p
        WHERE p.id IN (SELECT get_user_children_player_ids())
      )
    )
  );

CREATE POLICY "Team managers can manage squads in their clubs"
  ON public.game_squads
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Users can view period lineups from their clubs" ON public.game_period_lineups;
DROP POLICY IF EXISTS "Team managers can manage period lineups in their clubs" ON public.game_period_lineups;

CREATE POLICY "Users can view period lineups from their clubs"
  ON public.game_period_lineups
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (
        SELECT p.team_id FROM public.players p
        WHERE p.id IN (SELECT get_user_children_player_ids())
      )
    )
  );

CREATE POLICY "Team managers can manage period lineups in their clubs"
  ON public.game_period_lineups
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Anyone can view starting lineups" ON public.starting_lineups;
DROP POLICY IF EXISTS "Team managers can manage starting lineups" ON public.starting_lineups;
DROP POLICY IF EXISTS "Players can view their team lineups" ON public.starting_lineups;
DROP POLICY IF EXISTS "Users can view starting lineups from their clubs" ON public.starting_lineups;
DROP POLICY IF EXISTS "Team managers can manage lineups in their clubs" ON public.starting_lineups;

CREATE POLICY "Users can view starting lineups from their clubs"
  ON public.starting_lineups
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR player_id IN (SELECT get_user_children_player_ids())
  );

CREATE POLICY "Team managers can manage lineups in their clubs"
  ON public.starting_lineups
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Anyone can view stints" ON public.stints;
DROP POLICY IF EXISTS "Team managers can manage stints" ON public.stints;
DROP POLICY IF EXISTS "Users can view stints from their clubs" ON public.stints;
DROP POLICY IF EXISTS "Team managers can manage stints in their clubs" ON public.stints;

CREATE POLICY "Users can view stints from their clubs"
  ON public.stints
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM public.games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR player_id IN (SELECT get_user_children_player_ids())
  );

CREATE POLICY "Team managers can manage stints in their clubs"
  ON public.stints
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

COMMIT;

-- Storage is separate from these tables. The avatars bucket is public, so
-- profile photos and club logos are reachable by URL even with storage RLS.
-- The app loads them with getPublicUrl(), so do not flip the bucket to
-- private unless those calls move to signed URLs.
