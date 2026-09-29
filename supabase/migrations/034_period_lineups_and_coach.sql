-- Period lineups, the 12 who dress, and a coach on each bench.
-- The opponent coach is one more roster row, not one of the 12 who play.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_coach ON teams(coach_id);

COMMENT ON COLUMN teams.coach_id IS 'Head coach for this team. Must be a user with the coach role. Shown on the bench.';

CREATE OR REPLACE FUNCTION enforce_team_coach_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.coach_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profile_roles
    WHERE profile_id = NEW.coach_id
      AND role = 'coach'
      AND club_id IS NOT DISTINCT FROM NEW.club_id
  ) THEN
    RAISE EXCEPTION 'Team coach must be a user with the coach role in this club';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_team_coach_role ON teams;
CREATE TRIGGER enforce_team_coach_role
  BEFORE INSERT OR UPDATE OF coach_id, club_id ON teams
  FOR EACH ROW
  EXECUTE FUNCTION enforce_team_coach_role();

ALTER TABLE game_opponent_players
  ADD COLUMN IF NOT EXISTS is_coach BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN game_opponent_players.is_coach IS 'Opponent coach entered like a jersey row. Does not count toward the 12 and cannot start a period.';

CREATE UNIQUE INDEX IF NOT EXISTS game_opponent_players_one_coach
  ON game_opponent_players (game_id)
  WHERE is_coach;

CREATE OR REPLACE FUNCTION enforce_game_opponent_player()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.game_id IS DISTINCT FROM OLD.game_id THEN
    RAISE EXCEPTION 'Cannot move an opponent player to another game';
  END IF;

  NEW.name := NULLIF(btrim(NEW.name), '');
  IF NEW.name IS NOT NULL AND char_length(NEW.name) > 80 THEN
    RAISE EXCEPTION 'Opponent name must be at most 80 characters';
  END IF;

  IF NEW.is_coach THEN
    IF EXISTS (
      SELECT 1
      FROM game_opponent_players
      WHERE game_id = NEW.game_id
        AND is_coach
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'A game can have only one opponent coach';
    END IF;
  ELSIF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_coach) THEN
    PERFORM 1 FROM games WHERE id = NEW.game_id FOR UPDATE;

    SELECT COUNT(*) INTO v_count
    FROM game_opponent_players
    WHERE game_id = NEW.game_id
      AND NOT is_coach
      AND id IS DISTINCT FROM NEW.id;

    IF v_count >= 12 THEN
      RAISE EXCEPTION 'A game can have at most 12 opponent players';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS game_squads (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, player_id)
);

COMMENT ON TABLE game_squads IS 'The players from the team sheet who dress for this game. At most 12.';

CREATE OR REPLACE FUNCTION enforce_game_squad()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT check_game_not_started(NEW.game_id) THEN
    RAISE EXCEPTION 'Cannot change the dressed players after the game has started';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM games g
    JOIN players p ON p.team_id = g.team_id AND p.id = NEW.player_id
    WHERE g.id = NEW.game_id
  ) THEN
    RAISE EXCEPTION 'Player is not on this team';
  END IF;

  PERFORM 1 FROM games WHERE id = NEW.game_id FOR UPDATE;

  SELECT COUNT(*) INTO v_count
  FROM game_squads
  WHERE game_id = NEW.game_id
    AND player_id IS DISTINCT FROM NEW.player_id;

  IF v_count >= 12 THEN
    RAISE EXCEPTION 'A game can dress at most 12 players';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_game_squad ON game_squads;
CREATE TRIGGER enforce_game_squad
  BEFORE INSERT OR UPDATE ON game_squads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_game_squad();

CREATE OR REPLACE FUNCTION prevent_game_squad_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  IF NOT check_game_not_started(OLD.game_id) THEN
    RAISE EXCEPTION 'Cannot change the dressed players after the game has started';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_game_squad_delete ON game_squads;
CREATE TRIGGER enforce_game_squad_delete
  BEFORE DELETE ON game_squads
  FOR EACH ROW
  EXECUTE FUNCTION prevent_game_squad_delete();

CREATE OR REPLACE FUNCTION period_has_started(p_game_id UUID, p_period INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period INTEGER;
  v_clock INTEGER;
  v_running BOOLEAN;
  v_length INTEGER;
BEGIN
  SELECT current_period, clock_remaining_ms, clock_running
  INTO v_period, v_clock, v_running
  FROM games
  WHERE id = p_game_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_period > p_period THEN
    RETURN true;
  END IF;

  v_length := CASE WHEN p_period <= 4 THEN 600000 ELSE 300000 END;

  IF v_period = p_period AND (COALESCE(v_running, false) OR COALESCE(v_clock, v_length) < v_length) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM game_events
    WHERE game_id = p_game_id
      AND period_number = p_period
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION period_has_started(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION period_has_started(UUID, INTEGER) TO authenticated;

CREATE TABLE IF NOT EXISTS game_period_lineups (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL CHECK (period_number >= 1),
  side TEXT NOT NULL CHECK (side IN ('home', 'away')),
  position_index SMALLINT NOT NULL CHECK (position_index BETWEEN 0 AND 4),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  opponent_player_id UUID REFERENCES game_opponent_players(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, period_number, side, position_index),
  CHECK (
    (side = 'home' AND player_id IS NOT NULL AND opponent_player_id IS NULL)
    OR (side = 'away' AND opponent_player_id IS NOT NULL AND player_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS game_period_lineups_home_player
  ON game_period_lineups (game_id, period_number, player_id)
  WHERE player_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS game_period_lineups_away_player
  ON game_period_lineups (game_id, period_number, opponent_player_id)
  WHERE opponent_player_id IS NOT NULL;

COMMENT ON TABLE game_period_lineups IS 'Who is on the court at the start of a period. Editable until that period starts. Three, four, or five rows are allowed.';

CREATE OR REPLACE FUNCTION enforce_period_lineup()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fouls INTEGER;
BEGIN
  IF period_has_started(NEW.game_id, NEW.period_number) THEN
    RAISE EXCEPTION 'Cannot change the lineup after the period has started';
  END IF;

  IF NEW.side = 'home' THEN
    IF NOT EXISTS (
      SELECT 1 FROM game_squads
      WHERE game_id = NEW.game_id AND player_id = NEW.player_id
    ) THEN
      RAISE EXCEPTION 'Only a dressed player can start a period';
    END IF;

    SELECT COUNT(*) INTO v_fouls
    FROM game_events
    WHERE game_id = NEW.game_id
      AND player_id = NEW.player_id
      AND event_type = 'foul'
      AND foul_type = 'personal';

  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM game_opponent_players
      WHERE id = NEW.opponent_player_id
        AND game_id = NEW.game_id
        AND NOT is_coach
    ) THEN
      RAISE EXCEPTION 'Opponent coach cannot start a period';
    END IF;

    SELECT COUNT(*) INTO v_fouls
    FROM game_events
    WHERE game_id = NEW.game_id
      AND opponent_player_id = NEW.opponent_player_id
      AND event_type = 'foul'
      AND foul_type = 'personal';
  END IF;

  IF v_fouls >= 5 THEN
    RAISE EXCEPTION 'An eliminated player cannot start a period';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lineup ON game_period_lineups;
CREATE TRIGGER enforce_period_lineup
  BEFORE INSERT OR UPDATE ON game_period_lineups
  FOR EACH ROW
  EXECUTE FUNCTION enforce_period_lineup();

CREATE OR REPLACE FUNCTION prevent_period_lineup_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  IF period_has_started(OLD.game_id, OLD.period_number) THEN
    RAISE EXCEPTION 'Cannot change the lineup after the period has started';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lineup_delete ON game_period_lineups;
CREATE TRIGGER enforce_period_lineup_delete
  BEFORE DELETE ON game_period_lineups
  FOR EACH ROW
  EXECUTE FUNCTION prevent_period_lineup_delete();

CREATE OR REPLACE FUNCTION prevent_opponent_player_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM game_events
    WHERE opponent_player_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot remove an opponent player who already has actions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM game_period_lineups
    WHERE opponent_player_id = OLD.id
      AND period_has_started(game_id, period_number)
  ) THEN
    RAISE EXCEPTION 'Cannot remove an opponent player from a period that has started';
  END IF;

  IF NOT check_game_not_started(OLD.game_id) AND EXISTS (
    SELECT 1 FROM game_opponent_lineups
    WHERE opponent_player_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot remove an opponent starter after the game has started';
  END IF;

  RETURN OLD;
END;
$$;

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS coach_technical_side TEXT
    CHECK (coach_technical_side IN ('home', 'away'));

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_coach_technical;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_coach_technical
  CHECK (
    coach_technical_side IS NULL
    OR (
      player_id IS NULL
      AND opponent_player_id IS NULL
      AND event_type = 'foul'
      AND foul_type = 'technical'
    )
  );

COMMENT ON COLUMN game_events.coach_technical_side IS 'Technical foul charged to the home or away coach. No player is involved.';

ALTER TABLE game_squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_period_lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view squads from their clubs" ON game_squads;
CREATE POLICY "Users can view squads from their clubs"
  ON game_squads
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (
        SELECT p.team_id FROM players p
        WHERE p.id IN (SELECT get_user_children_player_ids())
      )
    )
  );

DROP POLICY IF EXISTS "Team managers can manage squads in their clubs" ON game_squads;
CREATE POLICY "Team managers can manage squads in their clubs"
  ON game_squads
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

DROP POLICY IF EXISTS "Users can view period lineups from their clubs" ON game_period_lineups;
CREATE POLICY "Users can view period lineups from their clubs"
  ON game_period_lineups
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_clubs())
        AND has_privileged_club_role(t.club_id)
    )
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (SELECT get_user_player_team_ids())
    )
    OR game_id IN (
      SELECT g.id FROM games g
      WHERE g.team_id IN (
        SELECT p.team_id FROM players p
        WHERE p.id IN (SELECT get_user_children_player_ids())
      )
    )
  );

DROP POLICY IF EXISTS "Team managers can manage period lineups in their clubs" ON game_period_lineups;
CREATE POLICY "Team managers can manage period lineups in their clubs"
  ON game_period_lineups
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  )
  WITH CHECK (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

ALTER TABLE game_squads REPLICA IDENTITY FULL;
ALTER TABLE game_period_lineups REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_squads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_squads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_period_lineups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_period_lineups;
  END IF;
END $$;
