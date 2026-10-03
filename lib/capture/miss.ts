import {
  otherCaptureSide,
  shotOnAttackingHalf,
  shotValueFromWorld,
  type CaptureSide,
} from './plays';

export type MissStep = 'court' | 'shooter' | 'rebound' | 'fouler' | 'ft';

export type MissDraft = {
  step: MissStep;
  personal: boolean;
  side: CaptureSide;
  shooterId: string | null;
  rebounderId: string | null;
  reboundSide: CaptureSide | null;
  foulerId: string | null;
  points: 2 | 3 | null;
  throwCount: 1 | 2 | 3 | null;
  coord: { x: number; y: number } | null;
};

/** A personal on the miss stops the clock. A clean miss leaves it running. */
export function missStopsClock(personal: boolean): boolean {
  return personal;
}

/** The rebound is offensive when the shooting team keeps the ball. */
export function reboundIsOffensive(shootingSide: CaptureSide, reboundSide: CaptureSide): boolean {
  return shootingSide === reboundSide;
}

/**
 * A clean miss follows the rebound. Free throws replace that: the last make
 * gives the ball to the fouling team, and the last miss leaves it live.
 */
export function missNextPossession(input: {
  shootingSide: CaptureSide;
  reboundSide: CaptureSide | null;
  personal: boolean;
  lastThrow: 'made' | 'miss' | null;
}): CaptureSide | null {
  if (input.personal) {
    return input.lastThrow === 'made' ? otherCaptureSide(input.shootingSide) : null;
  }
  if (!input.reboundSide) return null;
  return reboundIsOffensive(input.shootingSide, input.reboundSide)
    ? input.shootingSide
    : otherCaptureSide(input.shootingSide);
}

export function openMiss(side: CaptureSide, personal: boolean): MissDraft {
  return {
    step: 'court',
    personal,
    side,
    shooterId: null,
    rebounderId: null,
    reboundSide: null,
    foulerId: null,
    points: null,
    throwCount: null,
    coord: null,
  };
}

export function missCourtTap(
  draft: MissDraft,
  worldX: number,
  worldY: number,
  attacksRight: boolean,
): { ok: true; draft: MissDraft } | { ok: false; reason: 'half' } {
  if (draft.step !== 'court') return { ok: false, reason: 'half' };
  if (!shotOnAttackingHalf(worldX, attacksRight)) return { ok: false, reason: 'half' };
  return {
    ok: true,
    draft: {
      ...draft,
      step: 'shooter',
      points: shotValueFromWorld(worldX, worldY, attacksRight),
      coord: { x: worldX, y: worldY },
    },
  };
}

export function missChooseShooter(draft: MissDraft, playerId: string): MissDraft | null {
  if (draft.step !== 'shooter') return null;
  if (draft.personal) {
    return {
      ...draft,
      shooterId: playerId,
      step: 'fouler',
      rebounderId: null,
      reboundSide: null,
    };
  }
  return { ...draft, shooterId: playerId, step: 'rebound' };
}

export function missChooseRebounder(
  draft: MissDraft,
  side: CaptureSide,
  playerId: string,
): { ok: true; draft: MissDraft; save: true } | { ok: false } {
  if (draft.step !== 'rebound' || draft.personal) return { ok: false };
  return {
    ok: true,
    draft: { ...draft, rebounderId: playerId, reboundSide: side },
    save: true,
  };
}

export function missChooseFouler(draft: MissDraft, playerId: string): MissDraft | null {
  if (draft.step !== 'fouler') return null;
  if (playerId === draft.shooterId) return null;
  return { ...draft, foulerId: playerId, step: 'ft', throwCount: null };
}

export function missChooseThrowCount(draft: MissDraft, count: 1 | 2 | 3): MissDraft | null {
  if (draft.step !== 'ft' || !draft.foulerId) return null;
  return { ...draft, throwCount: count };
}

/** `'cancel'` leaves the sequence. Anything else is the previous step. */
export function missStepBack(draft: MissDraft): MissDraft | 'cancel' {
  if (draft.step === 'court') return 'cancel';
  if (draft.step === 'shooter') {
    return { ...draft, step: 'court', points: null, coord: null };
  }
  if (draft.step === 'rebound') {
    return { ...draft, step: 'shooter', shooterId: null, rebounderId: null, reboundSide: null };
  }
  if (draft.step === 'fouler') {
    return {
      ...draft,
      step: 'shooter',
      shooterId: null,
      foulerId: null,
      rebounderId: null,
      reboundSide: null,
      throwCount: null,
    };
  }
  if (draft.throwCount) return { ...draft, throwCount: null };
  return { ...draft, step: 'fouler', foulerId: null, throwCount: null };
}
