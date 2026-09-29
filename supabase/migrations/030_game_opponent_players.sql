-- Migration 030: Opponent jerseys for a single game
-- These rows are not players. They exist only so a game can attribute
-- baskets, fouls, rebounds and the rest to an opposing jersey number.
-- An optional name is whatever can be read on the shirt.

CREATE TABLE IF NOT EXISTS game_opponent_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  jersey_number SMALLINT NOT NULL CHECK (jersey_number BETWEEN 0 AND 99),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, jersey_number),
  CONSTRAINT game_opponent_players_name_len CHECK (
    name IS NULL OR char_length(name) BETWEEN 1 AND 80
  )
);

CREATE INDEX IF NOT EXISTS idx_game_opponent_players_game
  ON game_opponent_players(game_id);

COMMENT ON TABLE game_opponent_players IS 'Opposing jerseys registered for one game. Not part of the players roster.';
COMMENT ON COLUMN game_opponent_players.jersey_number IS 'Shirt number seen during this game. Unique within the game.';
COMMENT ON COLUMN game_opponent_players.name IS 'Optional text read from the shirt. Null when the name is unknown.';

-- Trim the name, reject a move to another game, and cap the roster at 12.
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

  IF TG_OP = 'INSERT' THEN
    -- Serialize roster inserts for this game so two writers cannot pass 12.
    PERFORM 1 FROM games WHERE id = NEW.game_id FOR UPDATE;

    SELECT COUNT(*) INTO v_count
    FROM game_opponent_players
    WHERE game_id = NEW.game_id;

    IF v_count >= 12 THEN
      RAISE EXCEPTION 'A game can have at most 12 opponent players';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_game_opponent_player ON game_opponent_players;
CREATE TRIGGER enforce_game_opponent_player
  BEFORE INSERT OR UPDATE ON game_opponent_players
  FOR EACH ROW
  EXECUTE FUNCTION enforce_game_opponent_player();

-- Events may belong to our player or to an opposing jersey, never both.
ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS opponent_player_id UUID
    REFERENCES game_opponent_players(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_game_events_opponent_player
  ON game_events(opponent_player_id);

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_one_actor;

ALTER TABLE game_events
  ADD CONSTRAINT game_events_one_actor
  CHECK (player_id IS NULL OR opponent_player_id IS NULL);

COMMENT ON COLUMN game_events.opponent_player_id IS 'Opposing jersey for this event. Mutually exclusive with player_id.';

CREATE OR REPLACE FUNCTION enforce_opponent_event_same_game()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.opponent_player_id IS NULL THEN
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS enforce_opponent_event_same_game ON game_events;
CREATE TRIGGER enforce_opponent_event_same_game
  BEFORE INSERT OR UPDATE OF opponent_player_id, game_id ON game_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_opponent_event_same_game();

ALTER TABLE game_opponent_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view opponent players from their clubs" ON game_opponent_players;
CREATE POLICY "Users can view opponent players from their clubs"
  ON game_opponent_players
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

DROP POLICY IF EXISTS "Team managers can manage opponent players in their clubs" ON game_opponent_players;
CREATE POLICY "Team managers can manage opponent players in their clubs"
  ON game_opponent_players
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

ALTER TABLE game_opponent_players REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_opponent_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_opponent_players;
  END IF;
END $$;
