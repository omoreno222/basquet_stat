-- Up to three coaches on a team. No rank: each one counts the same.
-- The previous teams.coach_id value is copied, then the column is removed.

CREATE TABLE IF NOT EXISTS public.team_coaches (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_team_coaches_profile ON public.team_coaches(profile_id);

COMMENT ON TABLE public.team_coaches IS 'Coaches assigned to a team. At most 3. No hierarchy.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teams'
      AND column_name = 'coach_id'
  ) THEN
    INSERT INTO public.team_coaches (team_id, profile_id)
    SELECT id, coach_id
    FROM public.teams
    WHERE coach_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_team_coach_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id UUID;
  v_count INTEGER;
  v_exclude UUID;
BEGIN
  SELECT club_id INTO v_club_id
  FROM teams
  WHERE id = NEW.team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Each coach must be a user with the coach role in this club';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profile_roles
    WHERE profile_id = NEW.profile_id
      AND role = 'coach'
      AND club_id IS NOT DISTINCT FROM v_club_id
  ) THEN
    RAISE EXCEPTION 'Each coach must be a user with the coach role in this club';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_exclude := OLD.profile_id;
  ELSE
    v_exclude := NULL;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM team_coaches
  WHERE team_id = NEW.team_id
    AND profile_id IS DISTINCT FROM v_exclude;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'A team can have at most 3 coaches';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_team_coach_assignment ON public.team_coaches;
CREATE TRIGGER enforce_team_coach_assignment
  BEFORE INSERT OR UPDATE ON public.team_coaches
  FOR EACH ROW
  EXECUTE FUNCTION enforce_team_coach_assignment();

CREATE OR REPLACE FUNCTION enforce_team_club_coaches()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.club_id IS NOT DISTINCT FROM OLD.club_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM team_coaches tc
    WHERE tc.team_id = NEW.id
      AND NOT EXISTS (
        SELECT 1
        FROM profile_roles pr
        WHERE pr.profile_id = tc.profile_id
          AND pr.role = 'coach'
          AND pr.club_id IS NOT DISTINCT FROM NEW.club_id
      )
  ) THEN
    RAISE EXCEPTION 'Each coach must be a user with the coach role in this club';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_team_club_coaches ON public.teams;
CREATE TRIGGER enforce_team_club_coaches
  BEFORE UPDATE OF club_id ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION enforce_team_club_coaches();

CREATE OR REPLACE FUNCTION remove_team_coaches_when_role_drops()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
  v_club_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_profile_id := OLD.profile_id;
    v_club_id := OLD.club_id;
    IF OLD.role IS DISTINCT FROM 'coach' OR OLD.club_id IS NULL THEN
      RETURN OLD;
    END IF;
  ELSE
    IF OLD.role IS DISTINCT FROM 'coach' OR OLD.club_id IS NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.role = 'coach' AND NEW.club_id IS NOT DISTINCT FROM OLD.club_id AND NEW.profile_id IS NOT DISTINCT FROM OLD.profile_id THEN
      RETURN NEW;
    END IF;
    v_profile_id := OLD.profile_id;
    v_club_id := OLD.club_id;
  END IF;

  DELETE FROM team_coaches tc
  USING teams t
  WHERE tc.team_id = t.id
    AND tc.profile_id = v_profile_id
    AND t.club_id = v_club_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION remove_team_coaches_when_role_drops() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remove_team_coaches_when_role_drops() TO authenticated;

DROP TRIGGER IF EXISTS remove_team_coaches_when_role_drops ON public.profile_roles;
CREATE TRIGGER remove_team_coaches_when_role_drops
  AFTER DELETE OR UPDATE OF role, club_id, profile_id ON public.profile_roles
  FOR EACH ROW
  EXECUTE FUNCTION remove_team_coaches_when_role_drops();

ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view team coaches" ON public.team_coaches;
CREATE POLICY "Users can view team coaches"
  ON public.team_coaches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_coaches.team_id
        AND (
          (t.club_id IN (SELECT get_user_clubs()) AND has_privileged_club_role(t.club_id))
          OR is_platform_admin()
          OR t.id IN (SELECT get_user_player_team_ids())
          OR t.id IN (
            SELECT p.team_id
            FROM public.players p
            WHERE p.id IN (SELECT get_user_children_player_ids())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Club admins can manage team coaches" ON public.team_coaches;
CREATE POLICY "Club admins can manage team coaches"
  ON public.team_coaches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_coaches.team_id
        AND (is_platform_admin() OR is_club_admin(t.club_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_coaches.team_id
        AND (is_platform_admin() OR is_club_admin(t.club_id))
    )
  );

DROP TRIGGER IF EXISTS enforce_team_coach_role ON public.teams;
DROP FUNCTION IF EXISTS enforce_team_coach_role();
DROP INDEX IF EXISTS idx_teams_coach;
ALTER TABLE public.teams DROP COLUMN IF EXISTS coach_id;
