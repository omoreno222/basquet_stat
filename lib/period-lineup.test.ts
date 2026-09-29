import { describe, expect, it } from 'vitest';
import { canStartPeriod, isEliminated, minimumToStart } from './period-lineup';

describe('minimumToStart', () => {
  it('requires five when nobody has fouled out', () => {
    expect(minimumToStart(0)).toBe(5);
  });

  it('drops to four after one elimination and stops at three', () => {
    expect(minimumToStart(1)).toBe(4);
    expect(minimumToStart(2)).toBe(3);
    expect(minimumToStart(4)).toBe(3);
  });
});

describe('canStartPeriod', () => {
  it('refuses four players when both teams are at full strength', () => {
    expect(canStartPeriod(4, 5, 0, 0)).toBe(false);
    expect(canStartPeriod(5, 5, 0, 0)).toBe(true);
  });

  it('allows four or three only for the side that has fouled players out', () => {
    expect(canStartPeriod(4, 5, 1, 0)).toBe(true);
    expect(canStartPeriod(3, 4, 2, 1)).toBe(true);
    expect(canStartPeriod(2, 5, 3, 0)).toBe(false);
  });
});

describe('isEliminated', () => {
  it('marks a player out on the fifth personal foul', () => {
    expect(isEliminated(4)).toBe(false);
    expect(isEliminated(5)).toBe(true);
  });
});
