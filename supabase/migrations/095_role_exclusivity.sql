-- A user can be a parent and a coach. A player cannot also be a coach or a parent.

CREATE OR REPLACE FUNCTION enforce_profile_role_compatibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_other user_role;
BEGIN
  IF NEW.role NOT IN ('player', 'coach', 'parent') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT role INTO v_other
    FROM profile_roles
    WHERE profile_id = NEW.profile_id
      AND NOT (profile_id = OLD.profile_id AND role = OLD.role)
      AND (
        (NEW.role = 'player' AND role IN ('coach', 'parent'))
        OR (NEW.role IN ('coach', 'parent') AND role = 'player')
      )
    LIMIT 1;
  ELSE
    SELECT role INTO v_other
    FROM profile_roles
    WHERE profile_id = NEW.profile_id
      AND (
        (NEW.role = 'player' AND role IN ('coach', 'parent'))
        OR (NEW.role IN ('coach', 'parent') AND role = 'player')
      )
    LIMIT 1;
  END IF;

  IF v_other IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'coach' OR v_other = 'coach' THEN
    RAISE EXCEPTION 'A user cannot be a player and a coach at the same time';
  END IF;

  RAISE EXCEPTION 'A user cannot be a parent and a player at the same time';
END;
$$;

REVOKE ALL ON FUNCTION enforce_profile_role_compatibility() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION enforce_profile_role_compatibility() TO authenticated;

DROP TRIGGER IF EXISTS enforce_profile_role_compatibility ON public.profile_roles;
CREATE TRIGGER enforce_profile_role_compatibility
  BEFORE INSERT OR UPDATE OF role, profile_id ON public.profile_roles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_profile_role_compatibility();

CREATE OR REPLACE FUNCTION update_user_roles_safe(
  p_user_id UUID,
  p_roles TEXT[],
  p_club_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_platform_admin BOOLEAN;
  v_is_last_admin BOOLEAN;
  v_role TEXT;
  v_valid_roles TEXT[];
  v_existing_club_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('update_user_roles_safe_admins'));

  SELECT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE profile_id = auth.uid()
      AND role = 'admin'
      AND club_id IS NULL
  ) INTO v_is_platform_admin;

  IF NOT v_is_platform_admin THEN
    RETURN json_build_object('error', 'Unauthorized: Platform admin access required');
  END IF;

  IF coalesce(cardinality(p_roles), 0) = 0 OR array_position(p_roles, NULL) IS NOT NULL THEN
    RETURN json_build_object('error', 'At least one role must be selected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF p_club_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id) THEN
    RETURN json_build_object('error', 'Club not found');
  END IF;

  SELECT array_agg(enumlabel::TEXT) INTO v_valid_roles
  FROM pg_enum
  WHERE enumtypid = 'user_role'::regtype;

  FOR v_role IN SELECT unnest(p_roles) LOOP
    IF NOT (v_role = ANY(v_valid_roles)) THEN
      RETURN json_build_object('error', format('Invalid role: %s', v_role));
    END IF;
  END LOOP;

  IF 'player' = ANY(p_roles) AND 'coach' = ANY(p_roles) THEN
    RETURN json_build_object('error', 'A user cannot be a player and a coach at the same time');
  END IF;

  IF 'player' = ANY(p_roles) AND 'parent' = ANY(p_roles) THEN
    RETURN json_build_object('error', 'A user cannot be a parent and a player at the same time');
  END IF;

  IF p_club_id IS NULL THEN
    FOR v_role IN SELECT unnest(p_roles) LOOP
      IF v_role <> 'admin' THEN
        RETURN json_build_object('error', 'Non-admin roles require a club to be selected');
      END IF;
    END LOOP;
  END IF;

  FOR v_role IN SELECT unnest(p_roles) LOOP
    IF v_role <> 'admin' THEN
      SELECT club_id INTO v_existing_club_id
      FROM profile_roles
      WHERE profile_id = p_user_id
        AND role = v_role::user_role
        AND club_id IS NOT NULL
        AND club_id <> p_club_id;

      IF v_existing_club_id IS NOT NULL THEN
        RETURN json_build_object('error', format('User already has role %s in another club', v_role));
      END IF;
    END IF;
  END LOOP;

  IF NOT ('admin' = ANY(p_roles)) THEN
    IF EXISTS (
      SELECT 1 FROM profile_roles
      WHERE profile_id = p_user_id
        AND role = 'admin'
        AND club_id IS NULL
    ) THEN
      IF p_user_id = auth.uid() THEN
        RETURN json_build_object('error', 'Cannot remove your own admin role');
      END IF;

      SELECT COUNT(*) = 1 INTO v_is_last_admin
      FROM profile_roles
      WHERE role = 'admin'
        AND club_id IS NULL;

      IF v_is_last_admin THEN
        RETURN json_build_object('error', 'Cannot remove the last platform administrator');
      END IF;
    END IF;
  END IF;

  UPDATE profiles
  SET role = p_roles[1]::user_role
  WHERE id = p_user_id;

  DELETE FROM profile_roles
  WHERE profile_id = p_user_id
    AND (
      (role <> 'admin' AND role::text <> ALL(p_roles) AND club_id = p_club_id)
      OR
      (role = 'admin' AND NOT ('admin' = ANY(p_roles)) AND club_id IS NULL)
    );

  FOR v_role IN SELECT unnest(p_roles) LOOP
    INSERT INTO profile_roles (profile_id, role, club_id)
    VALUES (
      p_user_id,
      v_role::user_role,
      CASE WHEN v_role = 'admin' THEN NULL ELSE p_club_id END
    )
    ON CONFLICT (profile_id, role)
    DO UPDATE SET club_id = EXCLUDED.club_id;
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION update_user_roles_safe(UUID, TEXT[], UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_user_roles_safe(UUID, TEXT[], UUID) TO authenticated;

INSERT INTO translations (key, locale, value) VALUES
  ('trke_role_player_coach_exclusive', 'en', 'A user cannot be a player and a coach at the same time'),
  ('trke_role_player_coach_exclusive', 'es', 'Un usuario no puede ser jugador y entrenador a la vez'),
  ('trke_role_player_coach_exclusive', 'ca', 'Un usuari no pot ser jugador i entrenador alhora'),
  ('trke_role_parent_player_exclusive', 'en', 'A user cannot be a parent and a player at the same time'),
  ('trke_role_parent_player_exclusive', 'es', 'Un usuario no puede ser padre y jugador a la vez'),
  ('trke_role_parent_player_exclusive', 'ca', 'Un usuari no pot ser pare i jugador alhora'),
  ('trke_role_exclusive_hint', 'en', 'A user cannot be a player and a coach, or a parent and a player, at the same time.'),
  ('trke_role_exclusive_hint', 'es', 'Un usuario no puede ser jugador y entrenador, ni padre y jugador, a la vez.'),
  ('trke_role_exclusive_hint', 'ca', 'Un usuari no pot ser jugador i entrenador, ni pare i jugador, alhora.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
