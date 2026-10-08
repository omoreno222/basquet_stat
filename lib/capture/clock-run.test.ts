import { describe, expect, it } from 'vitest';
import { clockFace, displayedRemaining, formatGameClock, liveRemaining, sameClockFace, scoreboardClock } from './clock-run';

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

describe('displayedRemaining', () => {
  const syncedAt = '2026-10-08T05:40:58.000Z';
  const now = Date.parse('2026-10-08T05:43:46.000Z');

  it('keeps a stopped clock on the stored time', () => {
    expect(displayedRemaining(false, 347_238, syncedAt, now)).toBe(347_238);
  });

  it('subtracts the wall time since the running sample', () => {
    expect(displayedRemaining(true, 559_663, syncedAt, now)).toBe(559_663 - 168_000);
  });

  it('does not add time when the sample is ahead of now', () => {
    expect(displayedRemaining(true, 559_663, '2026-10-08T05:44:00.000Z', now)).toBe(559_663);
  });

  it('uses the stored time when the sample is missing', () => {
    expect(displayedRemaining(true, 559_663, null, now)).toBe(559_663);
  });

  it('does not go below zero', () => {
    expect(displayedRemaining(true, 1_000, syncedAt, now)).toBe(0);
  });
});

describe('formatGameClock', () => {
  it('shows minutes and seconds', () => {
    expect(formatGameClock(559_663)).toBe('9:20');
    expect(formatGameClock(0)).toBe('0:00');
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
