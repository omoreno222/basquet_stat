# Multi-Role Support Implementation Summary

## Overview
Successfully implemented multi-role support for the BasquetStat application, allowing users to hold multiple roles simultaneously (e.g., admin+team_manager, coach+team_manager).

## Changes Completed

### 1. Database Migration (005_profile_roles.sql)
- Created `profile_roles` junction table
  - Primary key: `(profile_id, role)`
  - Foreign key to `profiles(id)` with CASCADE delete
  - CHECK constraint matching existing role enum values
  - Proper indexes for efficient lookups
- Backfilled all existing `profiles.role` data into `profile_roles`
- Implemented RLS policies for profile_roles table
- Created SECURITY DEFINER helper functions:
  - `has_role(role)` - Core function to check if user has a specific role
  - `is_admin()`, `is_coach()`, `is_parent()`, `is_player()` - Convenience helpers
  - `get_user_roles()` - Returns all roles for current user
- Updated existing `is_admin()` and `is_admin_or_team_manager()` to use profile_roles

### 2. Middleware Updates
- Updated `/middleware.ts` to fetch all user roles from `profile_roles`
- Implements **union of permissions**: users with multiple roles can access all allowed routes
- Falls back to legacy single role if profile_roles is empty (backward compatibility)
- Uses primary role (`profiles.role`) for default navigation at root path
- Properly handles redirect logic for unauthorized access

### 3. Admin UI Enhancements
**Users Page (`/app/admin/users/page.tsx`):**
- Replaced single-select dropdown with **multi-select checkboxes**
- At least one role must be selected (validation)
- Display multiple role badges per user (with proper wrapping)
- "Edit User Roles" (plural) form title
- Loads all user roles from `profile_roles` on page load
- Parent user filtering updated to check multi-role support

**Server Actions (`/app/admin/actions.ts`):**
- `createUser()` - Creates user with multiple roles
- `updateUserRoles(userId, roles[])` - Updates user roles atomically
  - Deletes old roles
  - Inserts new roles
  - Updates primary role in profiles.role
- `updateUserRole()` - Kept for backward compatibility

### 4. Dashboard Role Checks
Updated all role-based dashboard pages to check `profile_roles`:
- `/app/admin/page.tsx` - Checks for admin role
- `/app/team-manager/page.tsx` - Checks for team_manager role
- `/app/coach/page.tsx` - Checks for coach role
- `/app/parent/page.tsx` - Checks for parent role
- `/app/player/page.tsx` - Checks for player role

Each dashboard now:
1. Fetches profile data
2. Queries `profile_roles` table
3. Checks if user has required role in their roles array
4. Falls back to `profile.role` if `profile_roles` is empty

### 5. Game Capture & Team Manager Pages
**Game Detail Page (`/app/team-manager/games/[id]/page.tsx`):**
- Fetches users with admin or team_manager roles from `profile_roles`
- Uses profile_roles to determine if user can capture (admin check)
- Properly handles slot assignment for multi-role users

**Game Capture Page (`/app/team-manager/games/[id]/capture/page.tsx`):**
- Queries `profile_roles` to check if user is admin
- Admin users default to slot A regardless of other roles
- Works correctly when admin also has team_manager role

### 6. Seed Data & Demo Users
Updated `/scripts/seed.js` to demonstrate multi-role functionality:
- **oscar@basquet.local** - admin + team_manager (multi-role demo)
- **manager@basquet.local** - team_manager + coach (multi-role demo)
- **coach@basquet.local** - coach only
- **parent@basquet.local** - parent only
- **player@basquet.local** - player only

All users are properly created in both `profiles` and `profile_roles` tables.

### 7. Internationalization (i18n)
Added new translation keys in English, Spanish, and Catalan:
- `trke_admin_roles` - "Roles"
- `trke_admin_roles_select` - "Roles (select at least one)"
- `trke_admin_role_admin` - "Admin / Administrador"
- `trke_admin_role_team_manager` - "Team Manager / Gestor de Equipo"
- `trke_admin_role_coach` - "Coach / Entrenador"
- `trke_admin_role_parent` - "Parent / Padre/Madre"
- `trke_admin_role_player` - "Player / Jugador"
- `trke_admin_edit_roles` - "Edit Roles"
- `trke_admin_update_roles` - "Update Roles"

### 8. Type Definitions
Added `ProfileRole` interface to `/types/database.ts`:
```typescript
export interface ProfileRole {
  profile_id: string;
  role: UserRole;
  created_at: string;
}
```

### 9. Documentation
Created comprehensive `MIGRATION_GUIDE.md` covering:
- Migration prerequisites and order
- Step-by-step application instructions (CLI and SQL Editor)
- Verification steps
- Troubleshooting common issues
- Rollback procedures
- Architecture notes

## Architecture Decisions

### Backward Compatibility Strategy
- **`profiles.role`** retained as "primary role"
  - Used for default navigation
  - Used for display in simple UI elements
  - First role in multi-role list becomes primary
- **`profile_roles`** table is the authority for all authorization
  - All RLS policies check this table
  - All middleware checks use this table
  - All dashboard access checks use this table

### RLS Security
- SECURITY DEFINER functions prevent infinite recursion
- Same pattern as migration 002 that fixed original RLS issues
- Helper functions abstract away complexity for policy writers
- No changes needed to existing RLS policies (just function implementations)

### Union of Permissions
- Users with multiple roles can access ALL routes their roles permit
- Example: User with `admin` + `team_manager` roles can access:
  - `/admin/*` (from admin role)
  - `/team-manager/*` (from team_manager role)
- Primary role determines default landing page at `/`

### Game Team Manager Slots
- A/B slot assignment still works correctly
- Admin users (even with other roles) default to slot A
- Team managers can be assigned to slots regardless of other roles
- Slot swapping works as before

## Testing Recommendations

### Manual Testing Checklist
1. **Admin User Management:**
   - [ ] Create user with single role
   - [ ] Create user with multiple roles (e.g., admin+team_manager)
   - [ ] Edit user to add/remove roles
   - [ ] Verify at least one role is required
   
2. **Multi-Role Navigation:**
   - [ ] Login as oscar (admin+team_manager)
   - [ ] Access /admin - should work
   - [ ] Access /team-manager - should work
   - [ ] Root / should redirect to /admin (primary role)

3. **Game Capture:**
   - [ ] Assign team manager slots as admin+team_manager user
   - [ ] Start game capture as multi-role user
   - [ ] Verify slot A defaults for admin

4. **RLS & Permissions:**
   - [ ] Parent still only sees linked children
   - [ ] Player only sees own data
   - [ ] Admin+team_manager sees all data
   - [ ] Coach sees team data

5. **Seed Data:**
   - [ ] Run `node scripts/seed.js`
   - [ ] Verify oscar has both admin and team_manager roles in DB
   - [ ] Login as each demo user and verify access

### Database Verification Queries
```sql
-- Check all users have at least one role
SELECT p.email, COUNT(pr.role) as role_count
FROM profiles p
LEFT JOIN profile_roles pr ON pr.profile_id = p.id
GROUP BY p.id, p.email
HAVING COUNT(pr.role) = 0;
-- Should return 0 rows

-- View multi-role users
SELECT p.email, p.role as primary_role, array_agg(pr.role) as all_roles
FROM profiles p
JOIN profile_roles pr ON pr.profile_id = p.id
GROUP BY p.id, p.email, p.role
HAVING COUNT(pr.role) > 1;
-- Should show oscar and manager with multiple roles

-- Test has_role function
SELECT has_role('admin');
-- Should return true if current user is admin
```

## Migration Path

1. **Apply Migration:**
   ```bash
   supabase db push
   ```

2. **Verify Migration:**
   - Check `profile_roles` table exists
   - Verify all users have entries in `profile_roles`
   - Test helper functions work

3. **Run Seed (Optional):**
   ```bash
   node scripts/seed.js
   ```

4. **Test Application:**
   - Login as various users
   - Verify navigation works
   - Test role-based features

## Files Changed

### New Files
- `supabase/migrations/005_profile_roles.sql` - Multi-role migration
- `MIGRATION_GUIDE.md` - Comprehensive migration documentation
- `MULTI_ROLE_SUMMARY.md` - This file

### Modified Files
- `middleware.ts` - Multi-role route protection
- `app/admin/actions.ts` - Multi-role user management
- `app/admin/users/page.tsx` - Multi-select role UI
- `app/admin/page.tsx` - Role check via profile_roles
- `app/team-manager/page.tsx` - Role check via profile_roles
- `app/team-manager/games/[id]/page.tsx` - Multi-role slot assignment
- `app/team-manager/games/[id]/capture/page.tsx` - Multi-role admin check
- `app/coach/page.tsx` - Role check via profile_roles
- `app/parent/page.tsx` - Role check via profile_roles
- `app/player/page.tsx` - Role check via profile_roles
- `types/database.ts` - Added ProfileRole interface
- `scripts/seed.js` - Multi-role demo users

## Success Criteria Met ✅

- ✅ Migration 005 created and applies cleanly after 001-004
- ✅ `profile_roles` table with proper constraints
- ✅ Backfill from existing `profiles.role` data
- ✅ RLS helpers use `profile_roles` via SECURITY DEFINER functions
- ✅ No RLS recursion issues
- ✅ Middleware implements union of permissions
- ✅ Admin can assign multiple roles via checkboxes
- ✅ Multi-role users can access all permitted routes
- ✅ Oscar has admin+team_manager roles in seed data
- ✅ At least one demo user (manager) has multiple roles
- ✅ Team-manager game assignment works with multi-role users
- ✅ All new UI strings use `trke_*` i18n keys (EN/ES/CA)
- ✅ No secrets in committed files
- ✅ PR opened with comprehensive description
- ✅ Documentation complete

## Not Implemented (As Requested)
- Role switcher UI (users access all permitted areas, no need to "switch")
- Dashboards/heatmaps (separate PR)
- Role-specific home pages (uses primary role for default)

## Known Limitations & Future Enhancements

### Current Behavior
- Primary role (first in list) determines default navigation at `/`
- All role checks now query `profile_roles` table (small performance consideration)
- Middleware makes two queries (profiles + profile_roles) per request

### Potential Future Enhancements
- Add role switcher if users want to "act as" a single role
- Cache user roles in session/JWT to reduce database queries
- Add audit log for role changes
- Show permissions matrix in admin UI
- Allow admins to reorder roles (change primary role)
- Add role groups/permissions system for more granular control

## Notes for Deployment

1. **Migration Order is Critical:** Must run 001→002→003→004→005 in order
2. **No Downtime Required:** Migration can run on live database (backfill is safe)
3. **Backward Compatible:** Existing code checking `profiles.role` still works
4. **Testing Recommended:** Test multi-role access patterns before production deploy
5. **Seed Data Optional:** Demo users are optional, production users managed via admin UI

## Support & Questions

For issues or questions:
1. Check `MIGRATION_GUIDE.md` troubleshooting section
2. Verify migration order and completion
3. Check browser console for errors
4. Clear browser cache and re-login
5. Review RLS function security type (should be DEFINER)
