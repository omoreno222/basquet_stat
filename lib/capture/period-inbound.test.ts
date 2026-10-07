import { describe, expect, it } from 'vitest';
import { arrowSide, periodInbound } from './period-inbound';

describe('periodInbound', () => {
  it('leaves the opening period to the jump ball', () => {
    expect(periodInbound(1, 'home')).toBeNull();
    expect(periodInbound(0, 'away')).toBeNull();
  });

  it('gives even periods to the team that lost the tip', () => {
    expect(periodInbound(2, 'home')).toBe('away');
    expect(periodInbound(4, 'home')).toBe('away');
    expect(periodInbound(2, 'away')).toBe('home');
    expect(periodInbound(4, 'away')).toBe('home');
  });

  it('gives later odd periods, including the first overtime, to the tip winner', () => {
    expect(periodInbound(3, 'home')).toBe('home');
    expect(periodInbound(5, 'home')).toBe('home');
    expect(periodInbound(3, 'away')).toBe('away');
    expect(periodInbound(5, 'away')).toBe('away');
  });

  it('keeps alternating through a second overtime', () => {
    expect(periodInbound(6, 'home')).toBe('away');
    expect(periodInbound(6, 'away')).toBe('home');
  });

  it('reverses the next period when a ball lodged before it', () => {
    expect(periodInbound(2, 'home', 1)).toBe('home');
    expect(periodInbound(3, 'home', 1)).toBe('away');
    expect(periodInbound(2, 'away', 2)).toBe('away');
  });
});

describe('arrowSide', () => {
  it('gives the first alternating possession to the team that lost the tip', () => {
    expect(arrowSide('home', 1, 0)).toBe('away');
    expect(arrowSide('away', 1, 0)).toBe('home');
  });

  it('flips after each lodged ball and after each period start', () => {
    expect(arrowSide('home', 1, 1)).toBe('home');
    expect(arrowSide('home', 2, 0)).toBe('home');
    expect(arrowSide('home', 2, 1)).toBe('away');
  });
});
