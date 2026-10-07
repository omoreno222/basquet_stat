export type TipWinner = 'home' | 'away';

/**
 * Team the alternating-possession arrow points to during `period`,
 * after `lodgedBefore` balls have already lodged between the ring and the backboard.
 * The opening tip points the arrow at the team that did not win it.
 * Each later period start, and each lodged ball, uses that throw-in and reverses the arrow.
 */
export function arrowSide(tipWinner: TipWinner, period: number, lodgedBefore: number): TipWinner {
  const loser: TipWinner = tipWinner === 'home' ? 'away' : 'home';
  const consumed = Math.max(0, period - 1) + Math.max(0, lodgedBefore);
  return consumed % 2 === 0 ? loser : tipWinner;
}

/**
 * Who inbounds at the start of a period.
 * Period 1 is the opening tip. Later periods follow the arrow.
 */
export function periodInbound(period: number, tipWinner: TipWinner, lodgedBeforePeriod = 0): TipWinner | null {
  if (!Number.isInteger(period) || period <= 1) return null;
  return arrowSide(tipWinner, period - 1, lodgedBeforePeriod);
}
