import { freeThrowNeedsRebound } from './free-throws';
import {
  otherCaptureSide,
  shotOnAttackingHalf,
  shotValueFromWorld,
  type CaptureSide,
  type FreeThrowMark,
  type ShotFoulKind,
} from './plays';

export type MissStep = 'court' | 'shooter' | 'rebound' | 'fouler' | 'kind' | 'ft' | 'ft_rebound';

export type MissDraft = {
  step: MissStep;
  personal: boolean;
  side: CaptureSide;
  shooterId: string | null;
  rebounderId: string | null;
  /** Opponent team rebound when the jersey is unknown. */
  unknownRebound: boolean;
  reboundSide: CaptureSide | null;
  foulerId: string | null;
  foulKind: ShotFoulKind | null;
  points: 2 | 3 | null;
  throwCount: 1 | 2 | 3 | null;
  ftMarks: FreeThrowMark[];
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
 * A clean miss follows the rebound. A personal follows the last free throw:
 * a make gives the ball to the fouling team, and a miss follows that rebound.
 */
export function missNextPossession(input: {
  shootingSide: CaptureSide;
  reboundSide: CaptureSide | null;
  personal: boolean;
  lastThrow: 'made' | 'miss' | null;
  foulKind?: ShotFoulKind | null;
}): CaptureSide | null {
  if (input.foulKind && input.foulKind !== 'personal') return input.shootingSide;
  if (input.personal) {
    if (input.lastThrow === 'made') return otherCaptureSide(input.shootingSide);
    if (input.lastThrow !== 'miss' || !input.reboundSide) return null;
    return reboundIsOffensive(input.shootingSide, input.reboundSide)
      ? input.shootingSide
      : otherCaptureSide(input.shootingSide);
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
    unknownRebound: false,
    reboundSide: null,
    foulerId: null,
    foulKind: null,
    points: null,
    throwCount: null,
    ftMarks: [],
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
      unknownRebound: false,
      reboundSide: null,
    };
  }
  return { ...draft, shooterId: playerId, unknownRebound: false, step: 'rebound' };
}

export function missChooseRebounder(
  draft: MissDraft,
  side: CaptureSide,
  playerId: string,
): { ok: true; draft: MissDraft; save: true } | { ok: false } {
  if (draft.step !== 'rebound' || draft.personal) return { ok: false };
  return {
    ok: true,
    draft: { ...draft, rebounderId: playerId, unknownRebound: false, reboundSide: side },
    save: true,
  };
}

/** Credits the rebound to the opponent team when the jersey is unknown. */
export function missChooseUnknownRebound(
  draft: MissDraft,
): { ok: true; draft: MissDraft; save: true } | { ok: false } {
  if (draft.step === 'rebound') {
    if (draft.personal) return { ok: false };
  } else if (draft.step === 'ft_rebound') {
    if (!draft.personal) return { ok: false };
    if (draft.foulKind && draft.foulKind !== 'personal') return { ok: false };
    if (!freeThrowNeedsRebound({ source: 'miss', kind: draft.foulKind ?? 'personal', throws: draft.ftMarks })) return { ok: false };
  } else {
    return { ok: false };
  }
  return {
    ok: true,
    draft: { ...draft, rebounderId: null, unknownRebound: true, reboundSide: 'away' },
    save: true,
  };
}

export function missChooseFtRebounder(
  draft: MissDraft,
  side: CaptureSide,
  playerId: string,
): { ok: true; draft: MissDraft; save: true } | { ok: false } {
  if (draft.step !== 'ft_rebound' || !draft.personal) return { ok: false };
  if (draft.foulKind && draft.foulKind !== 'personal') return { ok: false };
  if (!freeThrowNeedsRebound({ source: 'miss', kind: draft.foulKind ?? 'personal', throws: draft.ftMarks })) return { ok: false };
  return {
    ok: true,
    draft: { ...draft, rebounderId: playerId, unknownRebound: false, reboundSide: side },
    save: true,
  };
}

export function missChooseFouler(draft: MissDraft, playerId: string): MissDraft | null {
  if (draft.step !== 'fouler') return null;
  if (playerId === draft.shooterId) return null;
  if (draft.points !== 2 && draft.points !== 3) return null;
  return {
    ...draft,
    foulerId: playerId,
    foulKind: null,
    step: 'kind',
    throwCount: draft.points,
    ftMarks: [],
  };
}

export function missChooseFoulKind(draft: MissDraft, kind: ShotFoulKind): MissDraft | null {
  if (draft.step !== 'kind' || !draft.foulerId || (draft.throwCount !== 2 && draft.throwCount !== 3)) return null;
  return { ...draft, foulKind: kind, step: 'ft', ftMarks: [] };
}

/** `'cancel'` leaves the sequence. Anything else is the previous step. */
export function missStepBack(draft: MissDraft): MissDraft | 'cancel' {
  if (draft.step === 'court') return 'cancel';
  if (draft.step === 'shooter') {
    return { ...draft, step: 'court', points: null, coord: null };
  }
  if (draft.step === 'rebound') {
    return { ...draft, step: 'shooter', shooterId: null, rebounderId: null, unknownRebound: false, reboundSide: null };
  }
  if (draft.step === 'fouler') {
    return {
      ...draft,
      step: 'shooter',
      shooterId: null,
      foulerId: null,
      foulKind: null,
      rebounderId: null,
      unknownRebound: false,
      reboundSide: null,
      throwCount: null,
      ftMarks: [],
    };
  }
  if (draft.step === 'kind') {
    return { ...draft, step: 'fouler', foulerId: null, foulKind: null, throwCount: null, ftMarks: [] };
  }
  if (draft.step === 'ft_rebound') {
    return { ...draft, step: 'ft', rebounderId: null, unknownRebound: false, reboundSide: null };
  }
  if (draft.step === 'ft') {
    return { ...draft, step: 'kind', foulKind: null, ftMarks: [] };
  }
  return draft;
}
