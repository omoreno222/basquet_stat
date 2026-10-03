import type { CaptureSide } from './plays';

export interface TimeoutWindow {
  from: number;
  to: number;
  max: number;
}

/** Periods 1–2 share 2 timeouts, 3–4 share 3, and each overtime has 1. Unused ones do not carry. */
export function timeoutWindow(period: number): TimeoutWindow {
  if (period <= 2) return { from: 1, to: 2, max: 2 };
  if (period <= 4) return { from: 3, to: 4, max: 3 };
  return { from: period, to: period, max: 1 };
}

export function countTimeouts(
  events: ReadonlyArray<{
    event_type?: string | null;
    timeout_side?: string | null;
    period_number?: number | null;
  }>,
  side: CaptureSide,
  period: number,
): number {
  const window = timeoutWindow(period);
  return events.filter((event) => (
    event.event_type === 'timeout'
    && event.timeout_side === side
    && typeof event.period_number === 'number'
    && event.period_number >= window.from
    && event.period_number <= window.to
  )).length;
}

export type PeriodOutcome = 'next' | 'overtime' | 'final';

/** From the 4th period on, a tie starts another overtime. Anything earlier just advances. */
export function periodOutcome(period: number, homeScore: number, awayScore: number): PeriodOutcome {
  if (period < 4) return 'next';
  return homeScore === awayScore ? 'overtime' : 'final';
}
