import { describe, expect, it } from 'vitest';
import { formatPossessionTime, possessionTime, type PossessionStamp } from './possession-time';

function stamp(
  partial: Partial<PossessionStamp> & Pick<PossessionStamp, 'possessionBefore' | 'clockRemainingMs'>,
): PossessionStamp {
  return {
    playGroupId: partial.playGroupId ?? null,
    periodNumber: partial.periodNumber ?? 1,
    clockRemainingMs: partial.clockRemainingMs,
    possessionBefore: partial.possessionBefore,
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
  };
}

describe('possessionTime', () => {
  it('counts a closed possession and leaves the open one out', () => {
    const result = possessionTime({
      currentPeriod: 1,
      possession: 'away',
      final: false,
      events: [
        stamp({ possessionBefore: null, clockRemainingMs: 600_000, createdAt: '2026-01-01T00:00:00.000Z' }),
        stamp({ possessionBefore: 'home', clockRemainingMs: 570_000, createdAt: '2026-01-01T00:00:30.000Z' }),
        stamp({ possessionBefore: 'away', clockRemainingMs: 540_000, createdAt: '2026-01-01T00:01:00.000Z' }),
      ],
    });
    expect(result.homeMs).toBe(30_000);
    expect(result.awayMs).toBe(0);
  });

  it('keeps an offensive rebound inside the same possession', () => {
    const result = possessionTime({
      currentPeriod: 1,
      possession: 'away',
      final: false,
      events: [
        stamp({ possessionBefore: null, clockRemainingMs: 600_000, createdAt: '2026-01-01T00:00:00.000Z' }),
        stamp({ possessionBefore: 'home', clockRemainingMs: 570_000, createdAt: '2026-01-01T00:00:30.000Z' }),
        stamp({ possessionBefore: 'home', clockRemainingMs: 540_000, createdAt: '2026-01-01T00:01:00.000Z' }),
      ],
    });
    expect(result.homeMs).toBe(60_000);
    expect(result.awayMs).toBe(0);
  });

  it('adds nothing while the clock is stopped', () => {
    const result = possessionTime({
      currentPeriod: 1,
      possession: 'away',
      final: false,
      events: [
        stamp({ possessionBefore: 'home', clockRemainingMs: 500_000, createdAt: '2026-01-01T00:00:00.000Z' }),
        stamp({ possessionBefore: 'home', clockRemainingMs: 500_000, createdAt: '2026-01-01T00:00:10.000Z' }),
        stamp({ possessionBefore: 'home', clockRemainingMs: 480_000, createdAt: '2026-01-01T00:00:30.000Z' }),
      ],
    });
    expect(result.homeMs).toBe(20_000);
  });

  it('does not count the live open possession', () => {
    const result = possessionTime({
      currentPeriod: 1,
      possession: 'home',
      final: false,
      events: [
        stamp({ possessionBefore: null, clockRemainingMs: 600_000, createdAt: '2026-01-01T00:00:00.000Z' }),
        stamp({ possessionBefore: 'home', clockRemainingMs: 540_000, createdAt: '2026-01-01T00:01:00.000Z' }),
      ],
    });
    expect(result.homeMs).toBe(0);
    expect(result.awayMs).toBe(0);
  });

  it('closes the previous period at its last stamp and does not cross periods', () => {
    const result = possessionTime({
      currentPeriod: 2,
      possession: 'away',
      final: false,
      events: [
        stamp({ periodNumber: 1, possessionBefore: null, clockRemainingMs: 120_000, createdAt: '2026-01-01T00:00:00.000Z' }),
        stamp({ periodNumber: 1, possessionBefore: 'home', clockRemainingMs: 60_000, createdAt: '2026-01-01T00:01:00.000Z' }),
        stamp({ periodNumber: 2, possessionBefore: null, clockRemainingMs: 600_000, createdAt: '2026-01-01T00:02:00.000Z' }),
        stamp({ periodNumber: 2, possessionBefore: 'away', clockRemainingMs: 540_000, createdAt: '2026-01-01T00:03:00.000Z' }),
      ],
    });
    expect(result.homeMs).toBe(60_000);
    expect(result.awayMs).toBe(0);
  });

  it('ignores a clock that moves backwards and a null possession', () => {
    const result = possessionTime({
      currentPeriod: 1,
      possession: 'home',
      final: false,
      events: [
        stamp({ possessionBefore: 'away', clockRemainingMs: 400_000, createdAt: '2026-01-01T00:00:00.000Z' }),
        stamp({ possessionBefore: null, clockRemainingMs: 450_000, createdAt: '2026-01-01T00:00:10.000Z' }),
        stamp({ possessionBefore: 'home', clockRemainingMs: 390_000, createdAt: '2026-01-01T00:00:20.000Z' }),
      ],
    });
    expect(result.homeMs).toBe(0);
    expect(result.awayMs).toBe(0);
  });

  it('collapses one play group into a single stamp', () => {
    const result = possessionTime({
      currentPeriod: 1,
      possession: 'away',
      final: false,
      events: [
        stamp({ playGroupId: 'tip', possessionBefore: null, clockRemainingMs: 600_000, createdAt: '2026-01-01T00:00:00.000Z' }),
        stamp({ playGroupId: 'shot', possessionBefore: 'home', clockRemainingMs: 560_000, createdAt: '2026-01-01T00:00:40.000Z' }),
        stamp({ playGroupId: 'shot', possessionBefore: 'home', clockRemainingMs: 560_000, createdAt: '2026-01-01T00:00:40.100Z' }),
      ],
    });
    expect(result.homeMs).toBe(40_000);
  });

  it('closes the last possession when the game is final', () => {
    const result = possessionTime({
      currentPeriod: 4,
      possession: 'home',
      final: true,
      events: [
        stamp({ periodNumber: 4, possessionBefore: null, clockRemainingMs: 30_000, createdAt: '2026-01-01T00:00:00.000Z' }),
        stamp({ periodNumber: 4, possessionBefore: 'away', clockRemainingMs: 10_000, createdAt: '2026-01-01T00:00:20.000Z' }),
      ],
    });
    expect(result.awayMs).toBe(20_000);
  });
});

describe('formatPossessionTime', () => {
  it('renders minutes and seconds', () => {
    expect(formatPossessionTime(90_000)).toBe('1:30');
    expect(formatPossessionTime(0)).toBe('0:00');
    expect(formatPossessionTime(5_600)).toBe('0:06');
  });
});
