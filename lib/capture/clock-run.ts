export type ClockFace = {
  running: boolean;
  remainingMs: number;
  lastMinute: boolean;
  left: string;
  right: string;
};

/** Above one minute the board shows mm:ss. In the final minute it shows ss:t. */
export function scoreboardClock(remainingMs: number): Pick<ClockFace, 'lastMinute' | 'left' | 'right'> {
  const ms = Math.max(0, remainingMs);
  if (ms < 60_000) {
    const seconds = Math.floor(ms / 1000);
    const tenth = Math.floor((ms % 1000) / 100);
    return {
      lastMinute: true,
      left: seconds.toString().padStart(2, '0'),
      right: String(tenth),
    };
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    lastMinute: false,
    left: minutes.toString().padStart(2, '0'),
    right: seconds.toString().padStart(2, '0'),
  };
}

export function clockFace(running: boolean, remainingMs: number): ClockFace {
  return { running, remainingMs, ...scoreboardClock(remainingMs) };
}

export function sameClockFace(a: ClockFace, b: ClockFace): boolean {
  return a.running === b.running
    && a.lastMinute === b.lastMinute
    && a.left === b.left
    && a.right === b.right;
}

/**
 * A running clock is an end timestamp, not a counter that loses time
 * whenever the timer callback is late.
 */
export function liveRemaining(
  running: boolean,
  remainingMs: number,
  endsAt: number | null,
  now: number,
): number {
  const raw = !running || endsAt == null ? remainingMs : endsAt - now;
  return Math.max(0, Math.round(raw));
}

/**
 * The stored remaining time is a sample, not a live counter.
 * While the clock is running, subtract the wall time since that sample.
 */
export function displayedRemaining(
  running: boolean,
  remainingMs: number,
  syncedAt: string | null | undefined,
  now: number,
): number {
  const base = Number.isFinite(remainingMs) ? remainingMs : 0;
  if (!running || !syncedAt) return Math.max(0, Math.round(base));
  const sampled = Date.parse(syncedAt);
  if (!Number.isFinite(sampled)) return Math.max(0, Math.round(base));
  const elapsed = Math.max(0, now - sampled);
  return Math.max(0, Math.round(base - elapsed));
}

export function formatGameClock(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
