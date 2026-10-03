import { describe, expect, it } from 'vitest';
import { clockFace, liveRemaining, sameClockFace, scoreboardClock } from './clock-run';

describe('liveRemaining', () => {
  it('keeps a stopped clock on the frozen time', () => {
    expect(liveRemaining(false, 482_300, null, 1_000_000)).toBe(482_300);
  });

  it('reads a running clock from the wall-clock end, not from the last tick', () => {
    const endsAt = 1_000_000 + 482_300;
    expect(liveRemaining(true, 482_300, endsAt, 1_000_000 + 250)).toBe(482_050);
  });

  it('does not go below zero', () => {
    expect(liveRemaining(true, 100, 500, 900)).toBe(0);
  });
});

describe('scoreboardClock', () => {
  it('shows minutes and seconds above one minute', () => {
    expect(scoreboardClock(600_000)).toEqual({ lastMinute: false, left: '10', right: '00' });
    expect(scoreboardClock(599_001)).toEqual({ lastMinute: false, left: '10', right: '00' });
    expect(scoreboardClock(599_000)).toEqual({ lastMinute: false, left: '09', right: '59' });
  });

  it('shows seconds and tenths in the final minute', () => {
    expect(scoreboardClock(59_900)).toEqual({ lastMinute: true, left: '59', right: '9' });
  });
});

describe('sameClockFace', () => {
  it('treats two times in the same displayed second as one face', () => {
    expect(sameClockFace(clockFace(true, 590_200), clockFace(true, 590_050))).toBe(true);
  });

  it('changes when the clock stops', () => {
    expect(sameClockFace(clockFace(true, 590_200), clockFace(false, 590_200))).toBe(false);
  });
});
