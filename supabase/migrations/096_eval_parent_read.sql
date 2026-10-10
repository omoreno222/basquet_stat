-- Parents already see the game. The evaluation table needs every event
-- of that game, and the names of the teammates, or the rows come out wrong.

CREATE OR REPLACE FUNCTION get_user_children_team_ids()
RETURNS TABLE(team_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT p.team_id
  FROM players p
  WHERE p.id IN (
    SELECT ppl.player_id
    FROM parent_player_links ppl
    WHERE ppl.parent_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION get_user_children_team_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_user_children_team_ids() TO authenticated;

COMMENT ON FUNCTION get_user_children_team_ids() IS
  'Team ids of players linked to the current user as a parent';

DROP POLICY IF EXISTS "Parents can view game events of their children's teams"
  ON public.game_events;
CREATE POLICY "Parents can view game events of their children's teams"
  ON public.game_events
  FOR SELECT
  TO authenticated
  USING (
    game_id IN (
      SELECT g.id
      FROM public.games g
      WHERE g.team_id IN (SELECT get_user_children_team_ids())
    )
  );

DROP POLICY IF EXISTS "Parents can view teammates of their children"
  ON public.players;
CREATE POLICY "Parents can view teammates of their children"
  ON public.players
  FOR SELECT
  TO authenticated
  USING (
    team_id IN (SELECT get_user_children_team_ids())
  );
