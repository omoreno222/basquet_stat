import { shotFoulLeavesBallWithOffense } from './free-throws';
import {
  otherCaptureSide,
  type CaptureSide,
  type FoulContext,
  type FoulKind,
  type FreeThrowMark,
  type ShotFoulKind,
} from './plays';

/** Where the ball goes after a made basket. Mirrors the live save. */
export function madeNextPossession(input: {
  side: CaptureSide;
  foulKind: ShotFoulKind | null | undefined;
  foulerId: string | null | undefined;
  throws: readonly FreeThrowMark[];
  liveRebound: boolean;
  reboundSide: CaptureSide | null;
}): CaptureSide | null {
  if (input.foulKind && shotFoulLeavesBallWithOffense(input.foulKind)) return input.side;
  if (input.liveRebound && input.reboundSide) return input.reboundSide;
  const lastThrow = input.throws[input.throws.length - 1];
  if (input.foulerId && lastThrow !== 'made') return null;
  return otherCaptureSide(input.side);
}

/** Where the ball goes after a foul that is not attached to a shot. */
export function foulNextPossession(input: {
  possession: CaptureSide | null;
  side: CaptureSide;
  kind: FoulKind;
  context: FoulContext;
  throws: readonly FreeThrowMark[];
  liveRebound: boolean;
  reboundSide: CaptureSide | null;
}): { possession: CaptureSide | null; changed: boolean } {
  if (input.kind === 'technical' || input.kind === 'double') {
    return { possession: input.possession, changed: false };
  }
  const other = otherCaptureSide(input.side);
  if (input.context === 'offensive' || input.kind !== 'personal') {
    return { possession: other, changed: true };
  }
  if (input.context === 'no_shot' && input.throws.length === 0) {
    return { possession: other, changed: true };
  }
  const lastThrow = input.throws[input.throws.length - 1];
  if (lastThrow === 'made') return { possession: input.side, changed: true };
  if (input.liveRebound && input.reboundSide) return { possession: input.reboundSide, changed: true };
  return { possession: null, changed: true };
}
