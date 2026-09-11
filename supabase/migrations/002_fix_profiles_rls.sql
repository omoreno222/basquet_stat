-- Migration 002: Fix profiles RLS with SECURITY DEFINER helper functions
-- This migration adds helper functions to safely check user roles without RLS recursion

-- Create SECURITY DEFINER function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create SECURITY DEFINER function to check if user is admin or team manager
CREATE OR REPLACE FUNCTION is_admin_or_team_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'team_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_or_team_manager() TO authenticated;

-- Update profiles policies to use SECURITY DEFINER functions
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles 
  FOR SELECT 
  USING (is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles 
  FOR UPDATE 
  USING (is_admin());

CREATE POLICY "Admins can insert profiles" ON profiles 
  FOR INSERT 
  WITH CHECK (is_admin());

-- Update game policies to use SECURITY DEFINER functions
DROP POLICY IF EXISTS "Admins and team managers can manage games" ON games;

CREATE POLICY "Admins and team managers can manage games" ON games 
  FOR ALL 
  USING (is_admin_or_team_manager());
