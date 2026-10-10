export type ClockView = {
  running: boolean;
  remainingMs: number;
  period: number;
};

/**
 * The capture tablet writes the clock, and Postgres sends that row back.
 * The 3-second sync and the stop itself echo the value from when the
 * request left the tablet. The on-screen clock has already moved, so
 * applying the echo rewinds it or starts it again after a stop.
 *
 * Until this tablet takes the clock, a remote row is the source of truth.
 * After that, the tablet keeps the clock it is showing.
 */
export function nextClockFromRemote(local: ClockView, remote: ClockView, owned: boolean): ClockView {
  if (!owned) {
    return {
      running: remote.running,
      remainingMs: remote.remainingMs,
      period: remote.period,
    };
  }
  return local;
}
