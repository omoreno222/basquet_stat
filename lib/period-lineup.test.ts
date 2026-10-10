import { describe, expect, it } from 'vitest';
import { canStartPeriod, isEliminated, requiredOnCourt } from './period-lineup';

describe('requiredOnCourt', () => {
  it('requires five while five or more players can still play', () => {
    expect(requiredOnCourt(5)).toBe(5);
    expect(requiredOnCourt(12)).toBe(5);
  });

  it('drops only when fewer than five players remain', () => {
    expect(requiredOnCourt(4)).toBe(4);
    expect(requiredOnCourt(3)).toBe(3);
    expect(requiredOnCourt(1)).toBe(3);
  });
});

describe('canStartPeriod', () => {
  it('refuses four players when five or more can still play', () => {
    expect(canStartPeriod(4, 5, 8, 8)).toBe(false);
    expect(canStartPeriod(5, 5, 8, 8)).toBe(true);
  });

  it('allows four or three only when that side has fewer than five players left', () => {
    expect(canStartPeriod(4, 5, 4, 8)).toBe(true);
    expect(canStartPeriod(3, 4, 3, 4)).toBe(true);
    expect(canStartPeriod(2, 5, 2, 8)).toBe(false);
  });
});

describe('isEliminated', () => {
  it('marks a player out on the fifth personal foul', () => {
    expect(isEliminated(4)).toBe(false);
    expect(isEliminated(5)).toBe(true);
  });
});
