import type { FoulContext, FoulKind, FreeThrowMark, ShotFoulKind } from './plays';

/** Every awarded free throw has a made or miss mark. */
export function freeThrowSequenceReady(
  shots: readonly (FreeThrowMark | null)[],
): shots is FreeThrowMark[] {
  return shots.length >= 1
    && shots.length <= 3
    && shots.every((shot) => shot === 'made' || shot === 'miss');
}

/**
 * Free throws follow the foul, not a question.
 * Bonus is the fifth team foul of the period (`teamFoulsBefore >= 4`).
 * A made basket is always one more throw. A missed shot awards its own value.
 * A non-shooting personal awards two only in the bonus. Offensive and double award none.
 * A technical awards one. Disruptive, flagrant, and disqualifying ignore the bonus.
 */
export function awardedFreeThrows(input: {
  kind: FoulKind;
  context: FoulContext;
  teamFoulsBefore: number;
  shotValue?: 2 | 3 | null;
}): 0 | 1 | 2 | 3 {
  const { kind, context, teamFoulsBefore, shotValue } = input;
  if (kind === 'double' || context === 'double' || context === 'offensive') return 0;
  if (kind === 'technical' || context === 'technical') return 1;
  if (context === 'shot_made') return 1;
  if (context === 'shot_missed') return shotValue === 2 || shotValue === 3 ? shotValue : 0;
  if (kind === 'disruptive' || kind === 'flagrant' || kind === 'disqualifying') return 2;
  if (kind === 'personal' && context === 'no_shot') return teamFoulsBefore >= 4 ? 2 : 0;
  return 0;
}

/** Disruptive, flagrant, and disqualifying give the ball back to the offended team. */
export function shotFoulLeavesBallWithOffense(kind: ShotFoulKind): boolean {
  return kind !== 'personal';
}

function unsportsmanlike(kind: FoulKind | undefined) {
  return kind === 'disruptive' || kind === 'flagrant' || kind === 'disqualifying';
}

/**
 * The last miss leaves a live ball only for a personal bonus or a personal
 * on a shot. Technical and unsportsmanlike free throws stay dead.
 */
export function freeThrowNeedsRebound(input: {
  source: 'foul' | 'made' | 'miss';
  kind?: FoulKind;
  context?: FoulContext;
  throws: readonly FreeThrowMark[];
}): boolean {
  const last = input.throws[input.throws.length - 1];
  if (last !== 'miss') return false;
  const kind = input.kind ?? (input.source === 'foul' ? undefined : 'personal');
  if (unsportsmanlike(kind) || kind === 'technical' || kind === 'double') return false;
  if (input.source === 'made') return kind === 'personal' && input.throws.length === 1;
  if (input.source === 'miss') {
    return kind === 'personal' && (input.throws.length === 2 || input.throws.length === 3);
  }
  return kind === 'personal' && input.context === 'no_shot' && input.throws.length === 2;
}
