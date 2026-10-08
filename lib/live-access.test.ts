import { describe, expect, it } from 'vitest';
import { isPlatformAdmin, userCanEditGame, userCanOpenLiveGame, userManagesClub } from './live-access';

const clubId = 'club-1';

describe('isPlatformAdmin', () => {
  it('accepts only an admin with no club', () => {
    expect(isPlatformAdmin([{ role: 'admin', club_id: null }])).toBe(true);
    expect(isPlatformAdmin([{ role: 'admin', club_id: clubId }])).toBe(false);
    expect(isPlatformAdmin([{ role: 'club_admin', club_id: null }])).toBe(false);
  });
});

describe('userManagesClub', () => {
  it('accepts a team manager, a club admin, or a platform admin', () => {
    expect(userManagesClub([
      { role: 'team_manager', club_id: clubId },
    ], clubId)).toBe(true);
    expect(userManagesClub([
      { role: 'club_admin', club_id: clubId },
    ], clubId)).toBe(true);
    expect(userManagesClub([
      { role: 'admin', club_id: null },
    ], clubId)).toBe(true);
  });

  it('rejects another club, a coach, and a missing club', () => {
    expect(userManagesClub([
      { role: 'team_manager', club_id: 'club-2' },
    ], clubId)).toBe(false);
    expect(userManagesClub([
      { role: 'coach', club_id: clubId },
    ], clubId)).toBe(false);
    expect(userManagesClub([
      { role: 'team_manager', club_id: clubId },
    ], null)).toBe(false);
  });
});

describe('userCanEditGame', () => {
  it('accepts a club admin of this club or a platform admin', () => {
    expect(userCanEditGame([{ role: 'club_admin', club_id: clubId }], clubId)).toBe(true);
    expect(userCanEditGame([{ role: 'admin', club_id: null }], clubId)).toBe(true);
    expect(userCanEditGame([{ role: 'admin', club_id: clubId }], clubId)).toBe(true);
  });

  it('rejects a team manager and an admin of another club', () => {
    expect(userCanEditGame([{ role: 'team_manager', club_id: clubId }], clubId)).toBe(false);
    expect(userCanEditGame([{ role: 'club_admin', club_id: 'club-2' }], clubId)).toBe(false);
    expect(userCanEditGame([{ role: 'club_admin', club_id: clubId }], null)).toBe(false);
  });
});

describe('userCanOpenLiveGame', () => {
  it('opens a live game for someone who manages the club', () => {
    expect(userCanOpenLiveGame({ status: 'live', managesClub: true })).toBe(true);
  });

  it('stays closed when the game is not live or the user does not manage the club', () => {
    expect(userCanOpenLiveGame({ status: 'scheduled', managesClub: true })).toBe(false);
    expect(userCanOpenLiveGame({ status: 'final', managesClub: true })).toBe(false);
    expect(userCanOpenLiveGame({ status: 'live', managesClub: false })).toBe(false);
  });
});
