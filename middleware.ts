import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_ROUTES = ['/login', '/change-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get session from cookies
  const token = request.cookies.get('sb-access-token')?.value;
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;

  if (!token && !refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: token ? {
            Authorization: `Bearer ${token}`,
          } : {},
        },
      }
    );

    let user = null;
    let accessToken = token;
    let nextRefreshToken = refreshToken;
    let refreshed = false;

    // Try to get user with current token
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    }

    // If user is null and we have a refresh token, try to refresh the session.
    // Use a client without the expired bearer so refreshSession is not rejected.
    if (!user && refreshToken) {
      const refreshClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: refreshData, error: refreshError } = await refreshClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refreshError || !refreshData.session) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      user = refreshData.user;
      accessToken = refreshData.session.access_token;
      nextRefreshToken = refreshData.session.refresh_token;
      refreshed = true;
    }

    if (!user || !accessToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Match the login cookie flags (not httpOnly) so document.cookie login/logout can replace them.
    const attachSession = (res: NextResponse) => {
      if (refreshed && accessToken && nextRefreshToken) {
        res.cookies.set('sb-access-token', accessToken, {
          path: '/',
          sameSite: 'lax',
          maxAge: 60 * 60,
        });
        res.cookies.set('sb-refresh-token', nextRefreshToken, {
          path: '/',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
        });
      }
      return res;
    };

    // Forward the new access token on this request so server actions read it via cookies().
    const continueWithSession = () => {
      const headers = new Headers(request.headers);
      if (refreshed && accessToken && nextRefreshToken) {
        const jar = new Map(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]));
        jar.set('sb-access-token', accessToken);
        jar.set('sb-refresh-token', nextRefreshToken);
        headers.set(
          'cookie',
          Array.from(jar.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ')
        );
      }
      return attachSession(NextResponse.next({ request: { headers } }));
    };

    // Get user profile with must_change_password flag
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const { data: profile, error: profileError } = await userSupabase
      .from('profiles')
      .select('role, must_change_password')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return attachSession(NextResponse.redirect(new URL('/login', request.url)));
    }

    // Check if user must change password
    if (profile.must_change_password && pathname !== '/change-password') {
      return attachSession(NextResponse.redirect(new URL('/change-password', request.url)));
    }

    // Fetch all roles for multi-role support
    const { data: userRoles, error: rolesError } = await userSupabase
      .from('profile_roles')
      .select('role')
      .eq('profile_id', user.id);

    if (rolesError) {
      console.error('Roles fetch error:', rolesError);
      return attachSession(NextResponse.redirect(new URL('/login', request.url)));
    }

    // Extract role strings from profile_roles or fall back to legacy single role
    const roles = userRoles && userRoles.length > 0 
      ? userRoles.map(r => r.role) 
      : [profile.role];

    // Role-based route protection
    const roleRoutes: Record<string, string[]> = {
      admin: ['/admin', '/team-manager', '/coach', '/parent', '/player'], // Admin can access all areas
      club_admin: ['/admin', '/team-manager', '/coach', '/parent', '/player'], // Club admin similar to admin
      team_manager: ['/team-manager'],
      coach: ['/coach'],
      parent: ['/parent'],
      player: ['/player'],
    };

    // Collect all allowed routes based on all user roles (union of permissions)
    const allowedRoutes = roles.flatMap(role => roleRoutes[role] || []);

    // Check if user is accessing any of their allowed routes
    const isAccessingAllowedRoute = allowedRoutes.some(route => pathname.startsWith(route));

    // Root path handling - use primary role (profiles.role) for default navigation
    if (pathname === '/') {
      const defaultRoute = roleRoutes[profile.role]?.[0] || '/login';
      return attachSession(NextResponse.redirect(new URL(defaultRoute, request.url)));
    }

    // Block unauthorized access
    if (!isAccessingAllowedRoute && !PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
      // Redirect to their primary role's default route
      const defaultRoute = roleRoutes[profile.role]?.[0] || '/login';
      return attachSession(NextResponse.redirect(new URL(defaultRoute, request.url)));
    }

    return continueWithSession();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
};
