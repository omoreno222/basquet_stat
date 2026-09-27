-- Migration 008: Admin is team_manager by design
-- Grants team_manager role to all existing admin users in profile_roles
-- Idempotent: ON CONFLICT DO NOTHING ensures safe re-runs

-- Product rule: Admin users manage the entire app, including live A/B capture.
-- This migration ensures all admins automatically have team_manager access.

-- Grant team_manager role to every profile that has admin role
INSERT INTO profile_roles (profile_id, role)
SELECT profile_id, 'team_manager'
FROM profile_roles
WHERE role = 'admin'
ON CONFLICT (profile_id, role) DO NOTHING;

-- Add comment to document the design decision
COMMENT ON TABLE profile_roles IS 'Multi-role support table. Users can have multiple roles. Admin users automatically have team_manager access (managed by migration 008).';
