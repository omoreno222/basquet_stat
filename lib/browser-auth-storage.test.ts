import { afterEach, describe, expect, it } from 'vitest';
import { browserAuthStorage } from './browser-auth-storage';

function token(payload: Record<string, unknown>) {
  const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${part}.sig`;
}

const jar = new Map<string, string>();

function installBrowser() {
  Object.assign(globalThis, {
    window: globalThis,
    document: {
      get cookie() {
        return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
      },
      set cookie(value: string) {
        const [pair] = value.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index);
        if (value.includes('max-age=0')) jar.delete(name);
        else jar.set(name, decodeURIComponent(pair.slice(index + 1)));
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    },
  });
}

installBrowser();

afterEach(() => {
  jar.clear();
});

describe('browserAuthStorage', () => {
  it('rebuilds a session from the login cookies', () => {
    const access = token({
      sub: '61a87438-edf8-493c-9c8b-e9394e8c442d',
      exp: 2_000_000_000,
      email: 'oscar@basquet.local',
      aud: 'authenticated',
      role: 'authenticated',
    });
    document.cookie = `sb-access-token=${encodeURIComponent(access)}; path=/`;
    document.cookie = 'sb-refresh-token=refresh-1; path=/';

    const raw = browserAuthStorage.getItem('sb-project-auth-token');
    const session = JSON.parse(raw || '{}');

    expect(session.access_token).toBe(access);
    expect(session.refresh_token).toBe('refresh-1');
    expect(session.expires_at).toBe(2_000_000_000);
    expect(session.user.email).toBe('oscar@basquet.local');
  });
});
