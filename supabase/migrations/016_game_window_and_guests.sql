-- Migration 016: Game Window, Auto-Close, Guest Players, and Player Team Access
-- Adds game opening window (30 min before), configurable periods, auto-close, guest player support,
-- and expands player role RLS to allow viewing own team's stats

-- NOTE: Player accounts
-- The existing players.user_id column links player records to user accounts (profiles.id).
-- Admins should set this in /admin/users when a player has their own login.
-- A player can have both a parent account linked (via parent_player_links) and their own account (user_id).

-- Add team logo support
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN teams.logo_url IS 'Public URL to team logo image stored in avatars bucket under teams/<team_id>/';

-- Add regular_periods column (default 4 for FIBA: Q1, Q2, Q3, Q4)
ALTER TABLE games ADD COLUMN IF NOT EXISTS regular_periods SMALLINT NOT NULL DEFAULT 4;

-- Add max_overtimes column (default null = unlimited overtimes while tied)
ALTER TABLE games ADD COLUMN IF NOT EXISTS max_overtimes SMALLINT DEFAULT NULL;

COMMENT ON COLUMN games.regular_periods IS 'Number of regular periods/quarters (default 4 for FIBA: Q1-Q4, 10 min each)';
COMMENT ON COLUMN games.max_overtimes IS 'Maximum overtime periods allowed (default null = unlimited while tied; OT periods are 5 min each)';

-- Storage policies for team logos (stored in avatars bucket under teams/<team_id>/)
-- Admins can upload/delete team logos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload team logos'
  ) THEN
    CREATE POLICY "Admins can upload team logos"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = 'teams'
        AND is_admin()
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can update team logos'
  ) THEN
    CREATE POLICY "Admins can update team logos"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = 'teams'
        AND is_admin()
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can delete team logos'
  ) THEN
    CREATE POLICY "Admins can delete team logos"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = 'teams'
        AND is_admin()
      );
  END IF;
END $$;

-- Public can view team logos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view team logos'
  ) THEN
    CREATE POLICY "Anyone can view team logos"
      ON storage.objects
      FOR SELECT
      TO public
      USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = 'teams'
      );
  END IF;
END $$;

-- Create game_guest_players table for adding players from other teams
CREATE TABLE IF NOT EXISTS game_guest_players (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  jersey_override INTEGER,
  added_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_guest_players_game ON game_guest_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_guest_players_player ON game_guest_players(player_id);

COMMENT ON TABLE game_guest_players IS 'Guest players added to a game from other teams';
COMMENT ON COLUMN game_guest_players.jersey_override IS 'Optional jersey number override if duplicate in this game';
COMMENT ON COLUMN game_guest_players.added_by IS 'User who added this guest player';

-- RLS policies for game_guest_players
ALTER TABLE game_guest_players ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view guest players
CREATE POLICY "Anyone authenticated can view game guest players"
  ON game_guest_players
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins and team managers can add guest players
CREATE POLICY "Admins and team managers can add guest players"
  ON game_guest_players
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_team_manager());

-- Admins and team managers can remove guest players
CREATE POLICY "Admins and team managers can delete guest players"
  ON game_guest_players
  FOR DELETE
  TO authenticated
  USING (is_admin_or_team_manager());

-- Add game_guest_players to realtime publication
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname='supabase_realtime' AND tablename='game_guest_players'
  ) THEN 
    ALTER PUBLICATION supabase_realtime ADD TABLE game_guest_players; 
  END IF; 
END $$;

-- Function to check if game can start (30 minutes before scheduled time)
CREATE OR REPLACE FUNCTION can_start_game(p_game_id UUID, p_is_admin BOOLEAN DEFAULT false)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_game_date TIMESTAMPTZ;
  v_minutes_until_start INTEGER;
BEGIN
  -- Admin can always start
  IF p_is_admin THEN
    RETURN true;
  END IF;

  -- Get game date
  SELECT game_date INTO v_game_date
  FROM games
  WHERE id = p_game_id;

  IF v_game_date IS NULL THEN
    RETURN false;
  END IF;

  -- Calculate minutes until scheduled start (negative = game time has passed)
  v_minutes_until_start := EXTRACT(EPOCH FROM (v_game_date - NOW())) / 60;

  -- Allow starting from 30 minutes before scheduled time
  RETURN v_minutes_until_start <= 30;
END;
$$;

COMMENT ON FUNCTION can_start_game(UUID, BOOLEAN) IS 'Check if a game can be started (30 min before scheduled time, or admin override)';

-- Helper function: check if current user is a player on a specific team
CREATE OR REPLACE FUNCTION is_player_of_team(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND team_id = p_team_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION is_player_of_team(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_player_of_team(UUID) TO authenticated;

COMMENT ON FUNCTION is_player_of_team(UUID) IS 'Check if current user is a player on the specified team';

-- Helper function: get teams the current user plays for
CREATE OR REPLACE FUNCTION get_user_player_teams()
RETURNS TABLE(team_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT players.team_id
  FROM players
  WHERE players.user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION get_user_player_teams() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_player_teams() TO authenticated;

COMMENT ON FUNCTION get_user_player_teams() IS 'Get all teams the current user plays for';

-- Update players RLS: players can see teammates on their own teams
DROP POLICY IF EXISTS "Players can view their own team" ON players;
CREATE POLICY "Players can view their own team"
  ON players
  FOR SELECT
  TO authenticated
  USING (
    -- Player can see teammates on any team they belong to
    team_id IN (SELECT get_user_player_teams())
  );

-- Update games RLS: players can see their team's games
DROP POLICY IF EXISTS "Players can view their team games" ON games;
CREATE POLICY "Players can view their team games"
  ON games
  FOR SELECT
  TO authenticated
  USING (
    -- Player can see games for teams they belong to
    team_id IN (SELECT get_user_player_teams())
  );

-- Update game_events RLS: players can see events from their team's games
DROP POLICY IF EXISTS "Players can view their team events" ON game_events;
CREATE POLICY "Players can view their team events"
  ON game_events
  FOR SELECT
  TO authenticated
  USING (
    -- Player can see events from games of teams they belong to
    game_id IN (
      SELECT id FROM games
      WHERE team_id IN (SELECT get_user_player_teams())
    )
  );

-- Update starting_lineups RLS: players can see their team's lineups
DROP POLICY IF EXISTS "Players can view their team lineups" ON starting_lineups;
CREATE POLICY "Players can view their team lineups"
  ON starting_lineups
  FOR SELECT
  TO authenticated
  USING (
    -- Player can see lineups from games of teams they belong to
    game_id IN (
      SELECT id FROM games
      WHERE team_id IN (SELECT get_user_player_teams())
    )
  );

-- Update game_periods RLS: players can see periods from their team's games
DROP POLICY IF EXISTS "Players can view their team game periods" ON game_periods;
CREATE POLICY "Players can view their team game periods"
  ON game_periods
  FOR SELECT
  TO authenticated
  USING (
    -- Player can see periods from games of teams they belong to
    game_id IN (
      SELECT id FROM games
      WHERE team_id IN (SELECT get_user_player_teams())
    )
  );

-- Update game_guest_players RLS: players can see guests in their team's games
DROP POLICY IF EXISTS "Players can view their team guest players" ON game_guest_players;
CREATE POLICY "Players can view their team guest players"
  ON game_guest_players
  FOR SELECT
  TO authenticated
  USING (
    -- Player can see guests from games of teams they belong to
    game_id IN (
      SELECT id FROM games
      WHERE team_id IN (SELECT get_user_player_teams())
    )
  );

-- Function to check if game should auto-close
CREATE OR REPLACE FUNCTION should_auto_close_game(
  p_current_period INTEGER,
  p_regular_periods INTEGER,
  p_max_overtimes INTEGER,
  p_team_score INTEGER,
  p_opponent_score INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- If still in regular periods, don't close
  IF p_current_period < p_regular_periods THEN
    RETURN false;
  END IF;

  -- After regular periods
  IF p_current_period = p_regular_periods THEN
    -- If not tied, close
    IF p_team_score != p_opponent_score THEN
      RETURN true;
    END IF;
    -- If tied, continue to overtime (don't close yet)
    RETURN false;
  END IF;

  -- In overtime (period > regular_periods)
  DECLARE
    v_overtime_number INTEGER;
  BEGIN
    v_overtime_number := p_current_period - p_regular_periods;
    
    -- If no max overtimes (null), never auto-close in overtime while tied
    IF p_max_overtimes IS NULL THEN
      RETURN p_team_score != p_opponent_score;
    END IF;

    -- If reached max overtimes
    IF v_overtime_number >= p_max_overtimes THEN
      RETURN true; -- Close regardless of score
    END IF;

    -- In overtime but not at max yet
    -- Close if not tied, continue if tied
    RETURN p_team_score != p_opponent_score;
  END;
END;
$$;

COMMENT ON FUNCTION should_auto_close_game IS 'Determine if a game should automatically close based on period and score (FIBA: auto-close only when Q4/OT ends with score not tied; if tied, continue to next OT)';

-- Trigger to prevent game events when game is finished
CREATE OR REPLACE FUNCTION prevent_events_on_finished_game()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_game_status game_status;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if game is finished
  SELECT status INTO v_game_status
  FROM games
  WHERE id = NEW.game_id;

  IF v_game_status = 'final' THEN
    -- Check if user is admin (admins can make corrections)
    SELECT EXISTS (
      SELECT 1 FROM profile_roles
      WHERE profile_id = auth.uid() AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Cannot insert events into a finished game'
        USING HINT = 'The game has ended. Contact an administrator for corrections.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_events_on_finished_game ON game_events;
CREATE TRIGGER prevent_events_on_finished_game
  BEFORE INSERT ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_events_on_finished_game();

-- Translation keys for new features
INSERT INTO translations (key, locale, value)
VALUES
  -- Game opening window
  ('trke_start_game', 'en', 'Start Game'),
  ('trke_start_game', 'es', 'Iniciar Partido'),
  ('trke_start_game', 'ca', 'Iniciar Partit'),
  
  ('trke_opens_in', 'en', 'Opens in'),
  ('trke_opens_in', 'es', 'Se abre en'),
  ('trke_opens_in', 'ca', 'S''obre en'),
  
  ('trke_start_anyway', 'en', 'Start Anyway (Admin)'),
  ('trke_start_anyway', 'es', 'Iniciar de Todos Modos (Admin)'),
  ('trke_start_anyway', 'ca', 'Iniciar Igualment (Admin)'),
  
  ('trke_game_not_ready', 'en', 'Game cannot start yet'),
  ('trke_game_not_ready', 'es', 'El partido aún no puede comenzar'),
  ('trke_game_not_ready', 'ca', 'El partit encara no pot començar'),
  
  -- Auto-close
  ('trke_game_finished', 'en', 'Game Finished'),
  ('trke_game_finished', 'es', 'Partido Finalizado'),
  ('trke_game_finished', 'ca', 'Partit Finalitzat'),
  
  ('trke_final_score', 'en', 'Final Score'),
  ('trke_final_score', 'es', 'Resultado Final'),
  ('trke_final_score', 'ca', 'Resultat Final'),
  
  ('trke_game_ended', 'en', 'The game has ended'),
  ('trke_game_ended', 'es', 'El partido ha terminado'),
  ('trke_game_ended', 'ca', 'El partit ha acabat'),
  
  -- Menu/navigation
  ('trke_menu', 'en', 'Menu'),
  ('trke_menu', 'es', 'Menú'),
  ('trke_menu', 'ca', 'Menú'),
  
  ('trke_leave_game', 'en', 'Leave Game'),
  ('trke_leave_game', 'es', 'Salir del Partido'),
  ('trke_leave_game', 'ca', 'Sortir del Partit'),
  
  ('trke_return_to_dashboard', 'en', 'Return to Dashboard'),
  ('trke_return_to_dashboard', 'es', 'Volver al Panel'),
  ('trke_return_to_dashboard', 'ca', 'Tornar al Panell'),
  
  ('trke_clock_will_pause', 'en', 'The clock will be paused when you leave. Continue?'),
  ('trke_clock_will_pause', 'es', 'El cronómetro se pausará al salir. ¿Continuar?'),
  ('trke_clock_will_pause', 'ca', 'El cronòmetre es pausarà en sortir. Continuar?'),
  
  -- Guest players
  ('trke_add_guest_player', 'en', 'Add Guest Player'),
  ('trke_add_guest_player', 'es', 'Añadir Jugador Invitado'),
  ('trke_add_guest_player', 'ca', 'Afegir Jugador Convidat'),
  
  ('trke_guest', 'en', 'Guest'),
  ('trke_guest', 'es', 'Invitado'),
  ('trke_guest', 'ca', 'Convidat'),
  
  ('trke_search_players', 'en', 'Search Players'),
  ('trke_search_players', 'es', 'Buscar Jugadores'),
  ('trke_search_players', 'ca', 'Cercar Jugadors'),
  
  ('trke_from_other_teams', 'en', 'From Other Teams'),
  ('trke_from_other_teams', 'es', 'De Otros Equipos'),
  ('trke_from_other_teams', 'ca', 'D''Altres Equips'),
  
  ('trke_jersey_number_override', 'en', 'Jersey # Override'),
  ('trke_jersey_number_override', 'es', 'Dorsal Alternativo'),
  ('trke_jersey_number_override', 'ca', 'Dorsal Alternatiu'),
  
  ('trke_add_to_game', 'en', 'Add to Game'),
  ('trke_add_to_game', 'es', 'Añadir al Partido'),
  ('trke_add_to_game', 'ca', 'Afegir al Partit'),
  
  ('trke_guest_added', 'en', 'Guest player added'),
  ('trke_guest_added', 'es', 'Jugador invitado añadido'),
  ('trke_guest_added', 'ca', 'Jugador convidat afegit'),
  
  ('trke_remove_guest', 'en', 'Remove Guest'),
  ('trke_remove_guest', 'es', 'Eliminar Invitado'),
  ('trke_remove_guest', 'ca', 'Eliminar Convidat'),
  
  -- Periods/overtime
  ('trke_regulation', 'en', 'Regulation'),
  ('trke_regulation', 'es', 'Reglamentario'),
  ('trke_regulation', 'ca', 'Reglamentari'),
  
  ('trke_overtime', 'en', 'Overtime'),
  ('trke_overtime', 'es', 'Prórroga'),
  ('trke_overtime', 'ca', 'Pròrroga'),
  
  ('trke_period_count', 'en', 'Period {period}'),
  ('trke_period_count', 'es', 'Periodo {period}'),
  ('trke_period_count', 'ca', 'Període {period}'),
  
  -- Period labels (Q1-Q4, OT1, OT2...)
  ('trke_q1', 'en', 'Q1'),
  ('trke_q1', 'es', 'Q1'),
  ('trke_q1', 'ca', 'Q1'),
  
  ('trke_q2', 'en', 'Q2'),
  ('trke_q2', 'es', 'Q2'),
  ('trke_q2', 'ca', 'Q2'),
  
  ('trke_q3', 'en', 'Q3'),
  ('trke_q3', 'es', 'Q3'),
  ('trke_q3', 'ca', 'Q3'),
  
  ('trke_q4', 'en', 'Q4'),
  ('trke_q4', 'es', 'Q4'),
  ('trke_q4', 'ca', 'Q4'),
  
  ('trke_ot', 'en', 'OT{number}'),
  ('trke_ot', 'es', 'PR{number}'),
  ('trke_ot', 'ca', 'PR{number}'),
  
  -- Team logos
  ('trke_team_logo', 'en', 'Team Logo'),
  ('trke_team_logo', 'es', 'Logo del Equipo'),
  ('trke_team_logo', 'ca', 'Logo de l''Equip'),
  
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
  ('trke_logo_removed', 'ca', 'Logo eliminat amb èxit')

ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
