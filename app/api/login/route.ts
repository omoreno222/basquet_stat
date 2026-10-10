import { NextResponse } from 'next/server';
import { defaultRouteForRole } from '@/lib/route-access';

type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: { id: string };
};

function loginUrl(request: Request, error?: string) {
  const host = request.headers.get('host') || new URL(request.url).host;
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const url = new URL('/login', `${proto}://${host}`);
  if (error) url.searchParams.set('error', error);
  return url;
}

function destinationUrl(request: Request, path: string) {
  const host = request.headers.get('host') || new URL(request.url).host;
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  return new URL(path, `${proto}://${host}`);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return NextResponse.redirect(loginUrl(request, 'Email and password are required'), 303);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(loginUrl(request, 'Login is not configured'), 303);
  }

  const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  const authBody = await authResponse.json().catch(() => null);
  if (!authResponse.ok || !authBody?.access_token || !authBody?.user?.id) {
    const message = authBody?.error_description || authBody?.msg || 'Invalid login credentials';
    return NextResponse.redirect(loginUrl(request, message), 303);
  }
  const session = authBody as AuthSession;

  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?id=eq.${session.user.id}&select=role,must_change_password`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  );
  const profiles = await profileResponse.json().catch(() => null);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profileResponse.ok || !profile?.role) {
    const message = profiles?.message || profiles?.error || 'No profile found for user';
    return NextResponse.redirect(loginUrl(request, `Profile error: ${message}`), 303);
  }

  const nextPath = profile.must_change_password
    ? '/change-password'
    : defaultRouteForRole(profile.role);
  const response = NextResponse.redirect(destinationUrl(request, nextPath), 303);
  response.cookies.set('sb-access-token', session.access_token, {
    path: '/',
    maxAge: 60 * 60,
    sameSite: 'lax',
  });
  response.cookies.set('sb-refresh-token', session.refresh_token, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  });
  return response;
}
