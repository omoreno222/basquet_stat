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
