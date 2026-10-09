const ACCESS_COOKIE = 'sb-access-token';
const REFRESH_COOKIE = 'sb-refresh-token';
const SESSION_COOKIE = 'sb-auth-session';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const part = document.cookie.split('; ').find((row) => row.startsWith(prefix));
  if (!part) return null;
  const raw = part.slice(prefix.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sessionFromTokens(access: string, refresh: string) {
  const payload = jwtPayload(access);
  const exp = typeof payload?.exp === 'number' ? payload.exp : Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: 3600,
    expires_at: exp,
    token_type: 'bearer',
    user: {
      id: typeof payload?.sub === 'string' ? payload.sub : '',
      aud: typeof payload?.aud === 'string' ? payload.aud : 'authenticated',
      role: typeof payload?.role === 'string' ? payload.role : 'authenticated',
      email: typeof payload?.email === 'string' ? payload.email : '',
      app_metadata: { provider: 'email' },
      user_metadata: {},
    },
  };
}

/**
 * The login response stores the Supabase session in cookies. The browser
 * client normally only looks in localStorage, so a tablet that just signed
 * in stays on "Loading...". This storage reads those cookies first.
 */
export const browserAuthStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(key);
    if (!key.endsWith('-auth-token')) return stored;

    const access = readCookie(ACCESS_COOKIE);
    const refresh = readCookie(REFRESH_COOKIE);
    const saved = readCookie(SESSION_COOKIE);
    if (!access || !refresh) return saved || stored;

    let session = sessionFromTokens(access, refresh);
    const source = saved || stored;
    if (source) {
      try {
        const parsed = JSON.parse(source) as { user?: unknown };
        if (parsed.user) session = { ...session, user: parsed.user as typeof session.user };
      } catch {
        // The token cookies are enough to rebuild the session.
      }
    }
    return JSON.stringify(session);
  },

  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
    if (!key.endsWith('-auth-token')) return;
    try {
      const session = JSON.parse(value) as { access_token?: string; refresh_token?: string };
      if (session.access_token) writeCookie(ACCESS_COOKIE, session.access_token, 60 * 60);
      if (session.refresh_token) writeCookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 7);
      writeCookie(SESSION_COOKIE, value, 60 * 60 * 24 * 7);
    } catch {
      // Leave the previous cookies in place.
    }
  },

  removeItem(key: string) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    if (!key.endsWith('-auth-token')) return;
    clearCookie(ACCESS_COOKIE);
    clearCookie(REFRESH_COOKIE);
    clearCookie(SESSION_COOKIE);
  },
};
