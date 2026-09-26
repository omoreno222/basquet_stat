# Security Model Documentation

## Server-Side Security

### Admin Server Actions (app/admin/actions.ts)
**Status**: ✅ SECURED

All server actions that use SERVICE ROLE now verify admin authentication:
- `createUser()` - Creates users with auth + profile + roles
- `updateUserRoles()` - Updates user roles in profile_roles table  
- `linkParentToPlayer()` - Links parent profiles to player records
- `unlinkParentFromPlayer()` - Removes parent-player links

**Implementation**: 
- `lib/auth-server.ts` provides `assertAdmin()` helper
- Reads `sb-access-token` cookie (same pattern as middleware)
- Verifies user has `admin` role in `profile_roles` table
- Returns `{ error: 'Unauthorized' }` if not authenticated or not admin
- All service-role functions call `assertAdmin()` at the start

**Security Note**: 
- Middleware only protects page routes
- Server actions must enforce auth themselves
- Never trust client input for role checks
- Always use user-scoped client to query profile_roles

---

## RLS-Based Security

### Admin CRUD Pages (seasons, teams, players, games, translations)
**Status**: ✅ SECURED via RLS

All admin CRUD pages use browser client with RLS policies:
- `app/admin/seasons/page.tsx` - Client-side mutations with RLS
- `app/admin/teams/page.tsx` - Client-side mutations with RLS
- `app/admin/players/page.tsx` - Client-side mutations with RLS
- `app/admin/games/page.tsx` - Client-side mutations with RLS
- `app/admin/translations/page.tsx` - Client-side mutations with RLS

**RLS Policies** (from migrations 001, 002, 005):
```sql
-- Uses SECURITY DEFINER functions that check profile_roles table
CREATE POLICY "Admins can manage seasons" ON seasons 
  FOR ALL USING (is_admin());

CREATE POLICY "Admins can manage teams" ON teams 
  FOR ALL USING (is_admin());

CREATE POLICY "Admins can manage players" ON players 
  FOR ALL USING (is_admin());

CREATE POLICY "Admins and team managers can manage games" ON games 
  FOR ALL USING (is_admin_or_team_manager());

CREATE POLICY "Admins can manage translations" ON translations 
  FOR ALL USING (is_admin());
```

**Key Functions** (updated in migration 005 for multi-role support):
```sql
-- Checks profile_roles table, not profiles.role
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

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_team_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_role('admin') OR has_role('team_manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Live Capture Security

### Game Events & Game State Updates
**Status**: ⚠️ RLS-ONLY (admin/team_manager can write, no slot enforcement)

**Current Implementation**:
- Browser client writes directly to `games` and `game_events` tables
- RLS policies allow any user with `admin` or `team_manager` role
- No server-side enforcement of slot assignment

**RLS Policies**:
```sql
CREATE POLICY "Admins and team managers can manage games" ON games 
  FOR ALL USING (is_admin_or_team_manager());

CREATE POLICY "Team managers can manage events" ON game_events 
  FOR ALL USING (is_admin_or_team_manager());
```

**Residual Risk**:
- Any admin or team_manager can write to any game/event (not restricted to assigned slots)
- Trusts middleware + client-side logic to prevent unauthorized writes
- If an admin/team_manager bypasses UI, they could write to games they're not assigned to

**Mitigation Options** (for follow-up):
1. **Server actions for capture** - Move writes to server actions with slot checks:
   ```typescript
   export async function recordGameEvent(gameId, eventData) {
     const authCheck = await assertAdminOrTeamManager();
     if (authCheck.error) return { error: authCheck.error };
     
     // Check if user is assigned to Slot A or Slot B for this game
     const { data: game } = await supabase
       .from('games')
       .select('slot_a_user_id, slot_b_user_id')
       .eq('id', gameId)
       .single();
     
     if (game.slot_a_user_id !== authCheck.userId && 
         game.slot_b_user_id !== authCheck.userId &&
         !authCheck.isAdmin) {
       return { error: 'Not assigned to this game' };
     }
     
     // ... proceed with write
   }
   ```

2. **RLS policy with slot check** - Tighter RLS (more complex):
   ```sql
   CREATE POLICY "Only assigned users can manage game events" ON game_events
   FOR ALL USING (
     EXISTS (
       SELECT 1 FROM games 
       WHERE games.id = game_events.game_id
       AND (
         games.slot_a_user_id = auth.uid() OR
         games.slot_b_user_id = auth.uid() OR
         has_role('admin')  -- admins can always write
       )
     )
   );
   ```

**Current Stance**:
- RLS-only is acceptable for MVP with trusted admin/team_manager users
- Middleware prevents non-authenticated access
- Client-side logic prevents UI-level misuse
- Attack vector requires authenticated admin/team_manager deliberately bypassing UI
- Risk is low for internal/trusted user base
- Zero-trust hardening (server actions + slot checks) can be follow-up if needed

---

## Middleware Security

### Route Protection
**Status**: ✅ SECURED

Middleware protects page routes but does NOT protect server actions:
- Reads `sb-access-token` cookie
- Verifies token with Supabase `auth.getUser()`
- Checks `profile_roles` table for role-based route access
- Redirects to `/login` if not authenticated
- Redirects to user's primary route if accessing unauthorized area

**Key Point**: 
- Middleware ONLY protects pages, not API routes or server actions
- Server actions must have their own auth checks (via `assertAdmin()` etc)

**Admin Route Access** (from RBAC fix):
```typescript
const roleRoutes: Record<string, string[]> = {
  admin: ['/admin', '/team-manager', '/coach', '/parent', '/player'], // Admin can access all
  team_manager: ['/team-manager'],
  coach: ['/coach'],
  parent: ['/parent'],
  player: ['/player'],
};
```

---

## Summary Table

| Component | Auth Method | Status | Notes |
|-----------|-------------|--------|-------|
| Admin server actions | `assertAdmin()` | ✅ Secured | Service role writes require admin |
| Admin CRUD pages | RLS + `is_admin()` | ✅ Secured | Browser client respects RLS |
| Game/event writes | RLS + `is_admin_or_team_manager()` | ⚠️ RLS-only | No slot enforcement; acceptable for trusted users |
| Page routes | Middleware | ✅ Secured | Token + role check |
| API routes | None | ⚠️ N/A | No API routes currently exist |

---

## Operational Security Checklist (For Oscar)

### Post-Deploy Actions
1. **Rotate Supabase Keys** (if ever exposed)
   - Dashboard → Settings → API → Generate new service role key
   - Update Vercel env var `SUPABASE_SERVICE_ROLE_KEY`
   - Redeploy

2. **Verify RLS is Enabled**
   - Dashboard → Database → Tables
   - Check "RLS Enabled" column for all tables
   - If any are off, run migrations again

3. **Disable Open Signup** (if not already)
   - Dashboard → Authentication → Providers → Email
   - Uncheck "Enable sign ups" if only admin should create users
   - Or keep enabled + add email domain restrictions

4. **Review Policies**
   - Dashboard → Database → Tables → [table] → Policies
   - Verify policies match migration definitions
   - Test with non-admin user to confirm access is blocked

5. **Monitor Logs**
   - Dashboard → Logs → Query Performance
   - Watch for suspicious queries (e.g., mass deletes, role escalation attempts)

6. **Secrets Management**
   - Never commit `.env.local` or `SUPABASE_SERVICE_ROLE_KEY`
   - Use Vercel environment variables (encrypted at rest)
   - Use Cursor Cloud Agent secrets for development (if applicable)

---

## Testing Security

### Server Actions
```bash
# Test createUser without auth (should fail)
curl -X POST https://your-app.vercel.app/api/admin/createUser \
  -H "Content-Type: application/json" \
  -d '{"email":"hacker@evil.com","password":"123","role":"admin"}'
# Expected: "Unauthorized: Not authenticated"

# Test with non-admin user (should fail)
# Login as coach@basquet.local, get token, then:
curl -X POST ... (same as above but with coach's token)
# Expected: "Unauthorized: Admin access required"
```

### RLS Policies
```sql
-- Test as non-admin user in Supabase SQL Editor
SET request.jwt.claims = '{"sub":"<non-admin-user-id>"}';

-- Try to delete a season (should fail)
DELETE FROM seasons WHERE id = '<some-season-id>';
-- Expected: ERROR: new row violates row-level security policy

-- Try to update a game (should fail if not admin/team_manager)
UPDATE games SET status = 'final' WHERE id = '<some-game-id>';
-- Expected: ERROR: new row violates row-level security policy
```

### Middleware
```bash
# Try accessing /admin without auth
curl https://your-app.vercel.app/admin
# Expected: Redirect to /login

# Try accessing /team-manager as coach (should fail)
# Login as coach@basquet.local, then navigate to /team-manager
# Expected: Redirect to /coach
```

---

## Future Hardening (Optional)

1. **Slot-based event recording** - Server actions with slot checks
2. **Audit logging** - Track who created/updated/deleted what
3. **Rate limiting** - Prevent abuse of server actions
4. **CAPTCHA on signup** - If open signup is enabled
5. **2FA for admins** - Supabase supports TOTP
6. **API keys for external integrations** - If needed later
7. **Webhook signatures** - For external events (e.g., Stripe)

---

**Last Updated**: After security hardening (migration 008 + lib/auth-server.ts)
