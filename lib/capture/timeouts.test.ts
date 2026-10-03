import { describe, expect, it } from 'vitest';
import { countTimeouts, periodOutcome, timeoutWindow } from './timeouts';

describe('timeoutWindow', () => {
  it('shares 2 timeouts across the first two periods', () => {
    expect(timeoutWindow(1)).toEqual({ from: 1, to: 2, max: 2 });
    expect(timeoutWindow(2)).toEqual({ from: 1, to: 2, max: 2 });
  });

  it('shares 3 timeouts across periods 3 and 4', () => {
    expect(timeoutWindow(3)).toEqual({ from: 3, to: 4, max: 3 });
    expect(timeoutWindow(4)).toEqual({ from: 3, to: 4, max: 3 });
  });

  it('gives each overtime its own timeout', () => {
    expect(timeoutWindow(5)).toEqual({ from: 5, to: 5, max: 1 });
    expect(timeoutWindow(6)).toEqual({ from: 6, to: 6, max: 1 });
  });
});

describe('countTimeouts', () => {
  const events = [
    { event_type: 'timeout', timeout_side: 'home', period_number: 1 },
    { event_type: 'timeout', timeout_side: 'home', period_number: 2 },
    { event_type: 'timeout', timeout_side: 'away', period_number: 1 },
    { event_type: 'timeout', timeout_side: 'home', period_number: 4 },
    { event_type: 'timeout', timeout_side: 'home', period_number: 5 },
    { event_type: 'shot', timeout_side: null, period_number: 1 },
  ];

  it('counts a team only inside the current window', () => {
    expect(countTimeouts(events, 'home', 2)).toBe(2);
    expect(countTimeouts(events, 'away', 2)).toBe(1);
    expect(countTimeouts(events, 'home', 3)).toBe(1);
    expect(countTimeouts(events, 'home', 5)).toBe(1);
    expect(countTimeouts(events, 'home', 6)).toBe(0);
  });
});

describe('periodOutcome', () => {
  it('advances the first three periods', () => {
    expect(periodOutcome(2, 10, 10)).toBe('next');
    expect(periodOutcome(3, 40, 38)).toBe('next');
  });

  it('starts overtime when the 4th period or an overtime ends tied', () => {
    expect(periodOutcome(4, 70, 70)).toBe('overtime');
    expect(periodOutcome(5, 80, 80)).toBe('overtime');
  });

  it('finishes the game when the score is not tied', () => {
    expect(periodOutcome(4, 71, 70)).toBe('final');
    expect(periodOutcome(5, 80, 82)).toBe('final');
  });
});
