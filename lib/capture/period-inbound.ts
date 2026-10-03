export type TipWinner = 'home' | 'away';

/**
 * Who inbounds at the start of a period when no held ball has flipped the arrow.
 * Period 1 is the opening tip. Even periods go to the loser, odd periods to the winner.
 */
export function periodInbound(period: number, tipWinner: TipWinner): TipWinner | null {
  if (!Number.isInteger(period) || period <= 1) return null;
  const loser: TipWinner = tipWinner === 'home' ? 'away' : 'home';
  return period % 2 === 0 ? loser : tipWinner;
}
