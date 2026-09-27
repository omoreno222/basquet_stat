-- Migration 021: Hardening for update_user_roles_safe
-- Lock at the very top and validate club existence

-- ============================================================================
-- HARDENED USER ROLE UPDATE FUNCTION
-- ============================================================================

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
  -- Advisory lock at the very top (before any checks)
  -- Prevents concurrent admin removals even if caller is demoted while waiting
  PERFORM pg_advisory_xact_lock(hashtext('update_user_roles_safe_admins'));

  -- Check if caller is platform admin
  SELECT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE profile_id = auth.uid()
      AND role = 'admin'
      AND club_id IS NULL
  ) INTO v_is_platform_admin;

  IF NOT v_is_platform_admin THEN
    RETURN json_build_object('error', 'Unauthorized: Platform admin access required');
  END IF;

  -- Validate input: check for empty array or NULL values
  IF coalesce(cardinality(p_roles), 0) = 0 OR array_position(p_roles, NULL) IS NOT NULL THEN
    RETURN json_build_object('error', 'At least one role must be selected');
  END IF;

  -- Check if target user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Validate club existence if provided
  IF p_club_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id) THEN
    RETURN json_build_object('error', 'Club not found');
  END IF;

  -- Get valid enum values for user_role
  SELECT array_agg(enumlabel::TEXT) INTO v_valid_roles
  FROM pg_enum
  WHERE enumtypid = 'user_role'::regtype;

  -- Validate each role against the enum
  FOR v_role IN SELECT unnest(p_roles) LOOP
    IF NOT (v_role = ANY(v_valid_roles)) THEN
      RETURN json_build_object('error', format('Invalid role: %s', v_role));
    END IF;
  END LOOP;

  -- Check if any non-admin role is being assigned without a club
  IF p_club_id IS NULL THEN
    FOR v_role IN SELECT unnest(p_roles) LOOP
      IF v_role <> 'admin' THEN
        RETURN json_build_object('error', 'Non-admin roles require a club to be selected');
      END IF;
    END LOOP;
  END IF;

  -- Check for club collision: if user already has any of these roles in a different club, reject
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

  -- Check if removing admin role would leave no platform admins
  IF NOT ('admin' = ANY(p_roles)) THEN
    -- Check if this user has admin role
    IF EXISTS (
      SELECT 1 FROM profile_roles
      WHERE profile_id = p_user_id
        AND role = 'admin'
        AND club_id IS NULL
    ) THEN
      -- Prevent users from removing their own admin role
      IF p_user_id = auth.uid() THEN
        RETURN json_build_object('error', 'Cannot remove your own admin role');
      END IF;

      -- Check if they're the last platform admin
      SELECT COUNT(*) = 1 INTO v_is_last_admin
      FROM profile_roles
      WHERE role = 'admin'
        AND club_id IS NULL;

      IF v_is_last_admin THEN
        RETURN json_build_object('error', 'Cannot remove the last platform administrator');
      END IF;
    END IF;
  END IF;

  -- Update primary role in profiles (use first role)
  UPDATE profiles
  SET role = p_roles[1]::user_role
  WHERE id = p_user_id;

  -- Delete roles that are no longer selected
  -- Only delete roles for the specific club being edited (or platform admin roles if p_club_id is NULL)
  DELETE FROM profile_roles
  WHERE profile_id = p_user_id
    AND (
      -- Delete non-admin roles not in the new list for this club
      (role <> 'admin' AND role::text <> ALL(p_roles) AND club_id = p_club_id)
      OR
      -- Delete platform admin role if not in new list
      (role = 'admin' AND NOT ('admin' = ANY(p_roles)) AND club_id IS NULL)
    );

  -- Upsert new roles with correct club_id
  -- Admin role always gets club_id = NULL, others get p_club_id
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

-- Revoke from public and anon, grant to authenticated
REVOKE ALL ON FUNCTION update_user_roles_safe(UUID, TEXT[], UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_user_roles_safe(UUID, TEXT[], UUID) TO authenticated;

COMMENT ON FUNCTION update_user_roles_safe(UUID, TEXT[], UUID) IS 'Safely update user roles with diff logic, enum validation, admin protection, and advisory locking. Platform admin only.';
