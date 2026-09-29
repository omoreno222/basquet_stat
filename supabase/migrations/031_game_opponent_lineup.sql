-- Migration 031: Opponent starting five for one game.
-- The five jerseys that begin Q1. Extra jerseys stay on the bench.
-- Locked once the game has started, same rule as starting_lineups.

CREATE TABLE IF NOT EXISTS game_opponent_lineups (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  opponent_player_id UUID NOT NULL REFERENCES game_opponent_players(id) ON DELETE CASCADE,
  position_index SMALLINT NOT NULL CHECK (position_index BETWEEN 0 AND 4),
  PRIMARY KEY (game_id, opponent_player_id),
  UNIQUE (game_id, position_index)
);

CREATE INDEX IF NOT EXISTS idx_game_opponent_lineups_player
  ON game_opponent_lineups(opponent_player_id);

COMMENT ON TABLE game_opponent_lineups IS 'The five opposing jerseys that start the game. Not minutes and not substitutions.';
COMMENT ON COLUMN game_opponent_lineups.position_index IS 'Court order, 0 through 4.';

CREATE OR REPLACE FUNCTION enforce_opponent_lineup_same_game()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM game_opponent_players p
    WHERE p.id = NEW.opponent_player_id
      AND p.game_id = NEW.game_id
  ) THEN
    RAISE EXCEPTION 'Opponent player does not belong to this game';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_opponent_lineup_same_game ON game_opponent_lineups;
CREATE TRIGGER enforce_opponent_lineup_same_game
  BEFORE INSERT OR UPDATE ON game_opponent_lineups
  FOR EACH ROW
  EXECUTE FUNCTION enforce_opponent_lineup_same_game();

CREATE OR REPLACE FUNCTION prevent_opponent_lineup_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NOT check_game_not_started(NEW.game_id) THEN
    RAISE EXCEPTION 'Cannot modify the opponent starting five after the game has started';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_opponent_lineup_change ON game_opponent_lineups;
CREATE TRIGGER enforce_opponent_lineup_change
  BEFORE INSERT OR UPDATE ON game_opponent_lineups
  FOR EACH ROW
  EXECUTE FUNCTION prevent_opponent_lineup_change();

CREATE OR REPLACE FUNCTION prevent_opponent_lineup_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  IF NOT check_game_not_started(OLD.game_id) THEN
    RAISE EXCEPTION 'Cannot modify the opponent starting five after the game has started';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_opponent_lineup_delete ON game_opponent_lineups;
CREATE TRIGGER enforce_opponent_lineup_delete
  BEFORE DELETE ON game_opponent_lineups
  FOR EACH ROW
  EXECUTE FUNCTION prevent_opponent_lineup_delete();

-- A direct delete of a starter is refused once the game has started.
-- Cascades (deleting the game) pass through because trigger depth is greater than 1.
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

  IF NOT check_game_not_started(OLD.game_id) AND EXISTS (
    SELECT 1 FROM game_opponent_lineups
    WHERE opponent_player_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot remove an opponent starter after the game has started';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_opponent_player_delete ON game_opponent_players;
CREATE TRIGGER enforce_opponent_player_delete
  BEFORE DELETE ON game_opponent_players
  FOR EACH ROW
  EXECUTE FUNCTION prevent_opponent_player_delete();

ALTER TABLE game_opponent_lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view opponent lineups from their clubs" ON game_opponent_lineups;
CREATE POLICY "Users can view opponent lineups from their clubs"
  ON game_opponent_lineups
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

DROP POLICY IF EXISTS "Team managers can manage opponent lineups in their clubs" ON game_opponent_lineups;
CREATE POLICY "Team managers can manage opponent lineups in their clubs"
  ON game_opponent_lineups
  FOR ALL
  TO authenticated
  USING (
    is_platform_admin()
    OR game_id IN (
      SELECT g.id FROM games g
      JOIN teams t ON g.team_id = t.id
      WHERE t.club_id IN (SELECT get_user_managed_clubs())
    )
  );

ALTER TABLE game_opponent_lineups REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_opponent_lineups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_opponent_lineups;
  END IF;
END $$;
