import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_ROUTES = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get session from cookie
  const token = request.cookies.get('sb-access-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Create Supabase client with Authorization Bearer for RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Get user profile - RLS now works because we have Authorization header
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const role = profile.role;

    // Role-based route protection
    const roleRoutes: Record<string, string[]> = {
      admin: ['/admin'],
      team_manager: ['/team-manager'],
      coach: ['/coach'],
      parent: ['/parent'],
      player: ['/player'],
    };

    // Check if user is accessing their allowed routes
    const allowedRoutes = roleRoutes[role] || [];
    const isAccessingAllowedRoute = allowedRoutes.some(route => pathname.startsWith(route));

    // Root path handling
    if (pathname === '/') {
      const defaultRoute = allowedRoutes[0] || '/login';
      return NextResponse.redirect(new URL(defaultRoute, request.url));
    }

    // Block unauthorized access
    if (!isAccessingAllowedRoute && !PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
      const defaultRoute = allowedRoutes[0] || '/login';
      return NextResponse.redirect(new URL(defaultRoute, request.url));
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
