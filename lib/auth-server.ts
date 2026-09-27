/**
 * Server-side authentication helpers
 * 
 * CRITICAL: Server actions using SERVICE ROLE must verify auth themselves.
 * Middleware only protects page routes. Use these helpers in all server actions.
 */

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Get the authenticated user from the request cookies
 * Uses the same auth cookie pattern as middleware (sb-access-token)
 */
export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  if (!token) {
    return { user: null, error: 'No authentication token found' };
  }

  // Create a user-scoped client (anon key + auth token)
  // This respects RLS and validates the token
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message || 'Invalid token' };
  }

  return { user, error: null };
}

/**
 * Check if the authenticated user has a specific role
 * Uses profile_roles table for multi-role support
 */
export async function userHasRole(userId: string, role: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  if (!token) {
    return false;
  }

  // User-scoped client to respect RLS
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Check profile_roles table for multi-role support
  const { data, error } = await supabase
    .from('profile_roles')
    .select('role')
    .eq('profile_id', userId)
    .eq('role', role)
    .single();

  return !error && !!data;
}

/**
 * Assert that the current user is a platform admin (admin role with no club_id)
 * Platform admins can manage all clubs and global resources
 */
export async function assertPlatformAdmin() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return { error: 'Unauthorized: Not authenticated', userId: null };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  if (!token) {
    return { error: 'Unauthorized: Not authenticated', userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error: queryError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .is('club_id', null)
    .single();

  if (queryError || !data) {
    return { error: 'Unauthorized: Platform admin access required', userId: null };
  }

  return { error: null, userId: user.id };
}

/**
 * Assert that the current user is a club admin for the specified club
 * Platform admins pass this check for any club
 * Club admins pass only for their own club
 */
export async function assertClubAdmin(clubId: string) {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return { error: 'Unauthorized: Not authenticated', userId: null };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  if (!token) {
    return { error: 'Unauthorized: Not authenticated', userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Check if user is platform admin (admin with no club_id)
  const { data: platformAdmin } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .is('club_id', null)
    .single();

  if (platformAdmin) {
    return { error: null, userId: user.id, isPlatformAdmin: true };
  }

  // Check if user is club_admin for this specific club
  const { data: clubAdmin } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('user_id', user.id)
    .in('role', ['club_admin', 'admin'])
    .eq('club_id', clubId)
    .single();

  if (!clubAdmin) {
    return { error: 'Unauthorized: Club admin access required for this club', userId: null, isPlatformAdmin: false };
  }

  return { error: null, userId: user.id, isPlatformAdmin: false };
}

/**
 * Get the club ID(s) that the current user has access to
 * Returns null for platform admins (access to all clubs)
 * Returns array of club IDs for club-scoped users
 */
export async function getUserClubs() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return { error: 'Unauthorized: Not authenticated', clubIds: null, isPlatformAdmin: false };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  if (!token) {
    return { error: 'Unauthorized: Not authenticated', clubIds: null, isPlatformAdmin: false };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Check if user is platform admin
  const { data: platformAdmin } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .is('club_id', null)
    .single();

  if (platformAdmin) {
    return { error: null, clubIds: null, isPlatformAdmin: true };
  }

  // Get all clubs user has access to
  const { data: roles } = await supabase
    .from('profile_roles')
    .select('club_id')
    .eq('user_id', user.id)
    .not('club_id', 'is', null);

  const clubIds = [...new Set((roles || []).map(r => r.club_id).filter(Boolean))];

  return { error: null, clubIds, isPlatformAdmin: false };
}

/**
 * Assert that the current user is an admin
 * @deprecated Use assertPlatformAdmin() or assertClubAdmin(clubId) instead
 * Throws an error or returns an error object if not authenticated or not admin
 * 
 * Usage in server actions:
 * ```
 * export async function myServerAction() {
 *   const authCheck = await assertAdmin();
 *   if (authCheck.error) {
 *     return { error: authCheck.error };
 *   }
 *   // ... proceed with admin-only logic
 * }
 * ```
 */
export async function assertAdmin() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return { error: 'Unauthorized: Not authenticated', userId: null };
  }

  const isAdmin = await userHasRole(user.id, 'admin');

  if (!isAdmin) {
    return { error: 'Unauthorized: Admin access required', userId: null };
  }

  return { error: null, userId: user.id };
}

/**
 * Assert that the current user is an admin or team_manager
 * Used for actions that both roles should have access to
 */
export async function assertAdminOrTeamManager() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user) {
    return { error: 'Unauthorized: Not authenticated', userId: null };
  }

  const isAdmin = await userHasRole(user.id, 'admin');
  const isTeamManager = await userHasRole(user.id, 'team_manager');

  if (!isAdmin && !isTeamManager) {
    return { error: 'Unauthorized: Admin or Team Manager access required', userId: null };
  }

  return { error: null, userId: user.id, isAdmin, isTeamManager };
}
