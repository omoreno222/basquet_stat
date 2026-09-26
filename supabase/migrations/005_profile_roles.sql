-- Migration 005: Multi-role support for users
-- Allows users to have multiple roles (e.g., admin+team_manager, coach+team_manager)

-- Create profile_roles junction table
CREATE TABLE profile_roles (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (profile_id, role),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'team_manager', 'coach', 'parent', 'player'))
);

-- Create index for efficient role lookups
CREATE INDEX idx_profile_roles_profile ON profile_roles(profile_id);
CREATE INDEX idx_profile_roles_role ON profile_roles(role);

-- Enable Row Level Security
ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profile_roles
-- Users can view their own roles
CREATE POLICY "Users can view their own roles" ON profile_roles 
  FOR SELECT 
  USING (profile_id = auth.uid());

-- Admins can view all roles (using existing is_admin() function)
CREATE POLICY "Admins can view all roles" ON profile_roles 
  FOR SELECT 
  USING (is_admin());

-- Admins can manage all roles
CREATE POLICY "Admins can manage roles" ON profile_roles 
  FOR ALL 
  USING (is_admin());

-- Backfill existing data from profiles.role into profile_roles
INSERT INTO profile_roles (profile_id, role)
SELECT id, role FROM profiles
ON CONFLICT (profile_id, role) DO NOTHING;

-- Update SECURITY DEFINER helper function to check profile_roles table
-- This replaces the old single-role check with multi-role support
CREATE OR REPLACE FUNCTION has_role(check_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profile_roles 
    WHERE profile_id = auth.uid() 
    AND role = check_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_role(user_role) TO authenticated;

-- Update is_admin() to use profile_roles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update is_admin_or_team_manager() to use profile_roles
CREATE OR REPLACE FUNCTION is_admin_or_team_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('admin') OR has_role('team_manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helper function to check if user is coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('coach');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_coach() TO authenticated;

-- Add helper function to check if user is parent
CREATE OR REPLACE FUNCTION is_parent()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('parent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_parent() TO authenticated;

-- Add helper function to check if user is player
CREATE OR REPLACE FUNCTION is_player()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('player');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_player() TO authenticated;

-- Add helper function to get all roles for current user (useful for UI)
CREATE OR REPLACE FUNCTION get_user_roles()
RETURNS SETOF user_role AS $$
BEGIN
  RETURN QUERY
  SELECT role FROM profile_roles 
  WHERE profile_id = auth.uid()
  ORDER BY role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_roles() TO authenticated;

-- Keep profiles.role as "primary role" for backward compatibility and display purposes
-- This is useful for default navigation and simple UI elements
-- However, ALL authorization must use profile_roles via has_role() or the helper functions

-- Add comment to document the migration approach
COMMENT ON TABLE profile_roles IS 'Multi-role support table. Users can have multiple roles. All RLS policies use has_role() to check this table.';
COMMENT ON COLUMN profiles.role IS 'Legacy single role field kept for backward compatibility and primary role display. Authorization uses profile_roles table.';
