# Migration Guide: Multi-Role Support

This guide explains how to apply the multi-role support migrations to your basketball stats app.

## Overview

This PR introduces migration 005 which adds multi-role support, allowing users to have multiple roles simultaneously (e.g., admin + team_manager).

## Prerequisites

- Migrations 001-004 must already be applied to your database
- You should have a backup of your database before proceeding
- You need either:
  - Supabase CLI installed and configured, OR
  - Access to your Supabase project's SQL Editor

## Migration Order

The migrations must be applied in this order:
1. `001_initial_schema.sql` (should already be applied)
2. `002_fix_profiles_rls.sql` (should already be applied)
3. `003_live_game_clock.sql` (should already be applied)
4. `004_games_official.sql` (should already be applied)
5. **`005_profile_roles.sql`** ← NEW in this PR

## Applying Migration 005

### Option A: Using Supabase CLI (Recommended)

```bash
# Make sure you're in the project root
cd /path/to/basquet_stat

# Apply all pending migrations
supabase db push

# Or apply migrations manually
supabase db push --include-migrations 005_profile_roles.sql
```

### Option B: Using Supabase Dashboard SQL Editor

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of `supabase/migrations/005_profile_roles.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute

## What Migration 005 Does

### 1. Creates `profile_roles` Table
- Junction table linking profiles to multiple roles
- Primary key: `(profile_id, role)`
- Includes RLS policies

### 2. Backfills Existing Data
- Automatically copies all existing `profiles.role` values into `profile_roles`
- Ensures no users lose their current role
- Handles conflicts gracefully

### 3. Updates RLS Helper Functions
- Creates `has_role(role)` - check if user has a specific role
- Updates `is_admin()` to use `profile_roles`
- Updates `is_admin_or_team_manager()` to use `profile_roles`
- Adds `is_coach()`, `is_parent()`, `is_player()` helpers
- Adds `get_user_roles()` to fetch all user roles

### 4. Maintains Backward Compatibility
- `profiles.role` field is kept as "primary role"
- Used for default navigation and display
- All authorization now uses `profile_roles` table

## Verification Steps

After applying the migration, verify it worked correctly:

### 1. Check Tables Created

```sql
-- Should return a list of profile_roles
SELECT * FROM profile_roles LIMIT 10;

-- All users should have at least one role
SELECT 
  p.email,
  p.role as primary_role,
  array_agg(pr.role) as all_roles
FROM profiles p
LEFT JOIN profile_roles pr ON pr.profile_id = p.id
GROUP BY p.id, p.email, p.role;
```

### 2. Check Functions Created

```sql
-- Should return true if you're admin
SELECT has_role('admin');

-- Should return your roles
SELECT * FROM get_user_roles();
```

### 3. Test RLS Policies

```sql
-- As admin user, should see all profiles
SELECT COUNT(*) FROM profiles;

-- Should see your own roles
SELECT * FROM profile_roles WHERE profile_id = auth.uid();
```

## Post-Migration: Seed Data

After applying the migration, run the seed script to create demo users with multiple roles:

```bash
node scripts/seed.js
```

This creates:
- `oscar@basquet.local` - admin + team_manager (multi-role demo)
- `manager@basquet.local` - team_manager + coach (multi-role demo)
- `coach@basquet.local` - coach only
- `parent@basquet.local` - parent only
- `player@basquet.local` - player only

## Using Multi-Role Features

### Admin UI
1. Navigate to `/admin/users`
2. Click "Add User" or "Edit Roles" on existing user
3. Use checkboxes to select multiple roles
4. At least one role must be selected
5. First selected role becomes the "primary role" for display

### Multi-Role Access
Users with multiple roles can access all allowed routes:
- User with `admin` + `team_manager` → can access `/admin/*` AND `/team-manager/*`
- User with `coach` + `team_manager` → can access `/coach/*` AND `/team-manager/*`

### Primary Role
- The first role in the list is stored in `profiles.role`
- Used for default navigation when user visits `/`
- Displayed as the main role badge in some UIs

## Rollback (If Needed)

If you need to rollback migration 005:

```sql
-- WARNING: This will remove multi-role support

-- Drop functions
DROP FUNCTION IF EXISTS get_user_roles();
DROP FUNCTION IF EXISTS is_player();
DROP FUNCTION IF EXISTS is_parent();
DROP FUNCTION IF EXISTS is_coach();
DROP FUNCTION IF EXISTS has_role(user_role);

-- Restore original RLS functions
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

-- Drop table (cascades to indexes and policies)
DROP TABLE IF EXISTS profile_roles CASCADE;
```

**Note**: You'll also need to revert code changes in:
- `middleware.ts`
- `app/admin/users/page.tsx`
- `app/admin/actions.ts`
- `types/database.ts`

## Troubleshooting

### Issue: "relation profile_roles does not exist"
**Solution**: Migration 005 hasn't been applied. Run `supabase db push`.

### Issue: "Users have no roles in profile_roles"
**Solution**: The backfill step may have failed. Run manually:
```sql
INSERT INTO profile_roles (profile_id, role)
SELECT id, role FROM profiles
ON CONFLICT (profile_id, role) DO NOTHING;
```

### Issue: "RLS policy evaluation error"
**Solution**: Make sure helper functions were created with SECURITY DEFINER:
```sql
SELECT routine_name, security_type 
FROM information_schema.routines 
WHERE routine_name IN ('has_role', 'is_admin', 'is_admin_or_team_manager');
-- All should show 'DEFINER'
```

### Issue: "User can't access routes after migration"
**Solution**: Clear browser cache and re-login. The middleware needs fresh role data.

## Support

If you encounter issues:
1. Check migration order (001→002→003→004→005)
2. Verify all helper functions exist
3. Check RLS policies are active
4. Ensure backfill completed
5. Test with a fresh login

## Architecture Notes

### Why Keep `profiles.role`?
- Backward compatibility with existing code
- Default navigation needs a "primary" role
- Simple UI elements can show one role
- But ALL authorization uses `profile_roles`

### Security
- All RLS functions use SECURITY DEFINER to prevent recursion
- Same pattern as migration 002 that fixed original RLS issues
- Multi-role users still respect scope (e.g., parent only sees linked children)

### Performance
- Indexes on `profile_id` and `role` for fast lookups
- `has_role()` function is efficient with indexes
- No N+1 queries in middleware (single fetch of all roles)
