import { describe, it, expect } from 'vitest';
import { decideAuthenticatedRoute } from '@/lib/route-access';

describe('decideAuthenticatedRoute', () => {
  it('lets every role open /profile', () => {
    for (const role of ['admin', 'club_admin', 'team_manager', 'coach', 'parent', 'player']) {
      const decision = decideAuthenticatedRoute({
        pathname: '/profile',
        roles: [role],
        primaryRole: role,
        mustChangePassword: false,
      });
      expect(decision).toEqual({ action: 'next' });
    }
  });

  it('lets every role open a profile uuid', () => {
    const decision = decideAuthenticatedRoute({
      pathname: '/profile/11111111-1111-4111-8111-111111111111',
      roles: ['player'],
      primaryRole: 'player',
      mustChangePassword: false,
    });
    expect(decision).toEqual({ action: 'next' });
  });

  it('still forces a password change before a profile uuid', () => {
    const decision = decideAuthenticatedRoute({
      pathname: '/profile/11111111-1111-4111-8111-111111111111',
      roles: ['player'],
      primaryRole: 'player',
      mustChangePassword: true,
    });
    expect(decision).toEqual({ action: 'redirect', to: '/change-password' });
  });

  it('still forces a password change before /profile', () => {
    const decision = decideAuthenticatedRoute({
      pathname: '/profile',
      roles: ['player'],
      primaryRole: 'player',
      mustChangePassword: true,
    });
    expect(decision).toEqual({ action: 'redirect', to: '/change-password' });
  });

  it('sends a player who opens an admin page back to /player', () => {
    const decision = decideAuthenticatedRoute({
      pathname: '/admin/users',
      roles: ['player'],
      primaryRole: 'player',
      mustChangePassword: false,
    });
    expect(decision).toEqual({ action: 'redirect', to: '/player' });
  });

  it('allows role areas and the pages linked under them', () => {
    expect(decideAuthenticatedRoute({
      pathname: '/admin/clubs',
      roles: ['admin'],
      primaryRole: 'admin',
      mustChangePassword: false,
    })).toEqual({ action: 'next' });

    expect(decideAuthenticatedRoute({
      pathname: '/team-manager/games/game-1/capture',
      roles: ['team_manager'],
      primaryRole: 'team_manager',
      mustChangePassword: false,
    })).toEqual({ action: 'next' });

    expect(decideAuthenticatedRoute({
      pathname: '/coach',
      roles: ['coach'],
      primaryRole: 'coach',
      mustChangePassword: false,
    })).toEqual({ action: 'next' });

    expect(decideAuthenticatedRoute({
      pathname: '/parent',
      roles: ['parent'],
      primaryRole: 'parent',
      mustChangePassword: false,
    })).toEqual({ action: 'next' });

    expect(decideAuthenticatedRoute({
      pathname: '/player',
      roles: ['player'],
      primaryRole: 'player',
      mustChangePassword: false,
    })).toEqual({ action: 'next' });
  });

  it('uses the union of roles when a user has more than one', () => {
    const decision = decideAuthenticatedRoute({
      pathname: '/coach',
      roles: ['team_manager', 'coach'],
      primaryRole: 'team_manager',
      mustChangePassword: false,
    });
    expect(decision).toEqual({ action: 'next' });
  });

  it('redirects / to the primary role dashboard', () => {
    const decision = decideAuthenticatedRoute({
      pathname: '/',
      roles: ['parent'],
      primaryRole: 'parent',
      mustChangePassword: false,
    });
    expect(decision).toEqual({ action: 'redirect', to: '/parent' });
  });
});
