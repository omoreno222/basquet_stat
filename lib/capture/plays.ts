import { z } from 'zod';

/**
 * Capture plays committed by commitCapturePlay.
 * A foul follows the same steps as a turnover: court point, player, then the ruling.
 */
export const turnoverReasons = [
  'double_dribble',
  'travelling',
  'three_seconds',
  'five_seconds',
  'out_of_bounds',
  'bad_pass',
  'bad_pass_lost',
  'ball_handling',
  'ball_handling_lost',
] as const;

export type TurnoverReason = (typeof turnoverReasons)[number];
export type CaptureSide = 'home' | 'away';
export type ClockViolation = 'shot_clock' | 'eight_seconds' | 'five_seconds';

export const turnoverReasonKey: Record<TurnoverReason, string> = {
  double_dribble: 'trke_turnover_double_dribble',
  travelling: 'trke_turnover_travelling',
  three_seconds: 'trke_turnover_three_seconds',
  five_seconds: 'trke_turnover_five_seconds',
  out_of_bounds: 'trke_turnover_out_of_bounds',
  bad_pass: 'trke_turnover_bad_pass',
  bad_pass_lost: 'trke_turnover_bad_pass_lost',
  ball_handling: 'trke_turnover_ball_handling',
  ball_handling_lost: 'trke_turnover_ball_handling_lost',
};

export const turnoverReasonFallback: Record<TurnoverReason, string> = {
  double_dribble: 'Double dribble',
  travelling: 'Travelling',
  three_seconds: '3 seconds',
  five_seconds: '5 seconds',
  out_of_bounds: 'Out of bounds',
  bad_pass: 'Bad pass',
  bad_pass_lost: 'Bad pass and loss',
  ball_handling: 'Ball handling',
  ball_handling_lost: 'Ball handling and loss',
};

const liveBallReasons = new Set<TurnoverReason>(['bad_pass_lost', 'ball_handling_lost']);

export function turnoverStopsClock(reason: TurnoverReason) {
  return !liveBallReasons.has(reason);
}

export const turnoverErrorCodes = [
  'turnover_invalid',
  'turnover_slot',
  'turnover_possession',
  'turnover_player',
  'turnover_eliminated',
  'turnover_clock',
  'turnover_period',
  'turnover_shape',
] as const;

export type TurnoverErrorCode = (typeof turnoverErrorCodes)[number];

export function turnoverErrorCode(message: string): TurnoverErrorCode {
  return turnoverErrorCodes.find((code) => message.includes(code)) ?? 'turnover_invalid';
}

export function otherCaptureSide(side: CaptureSide): CaptureSide {
  return side === 'home' ? 'away' : 'home';
}

export const foulKinds = [
  'personal',
  'disruptive',
  'flagrant',
  'disqualifying',
  'technical',
  'double',
] as const;

export type FoulKind = (typeof foulKinds)[number];

export const foulContexts = [
  'offensive',
  'no_shot',
  'shot_made',
  'shot_missed',
  'technical',
  'double',
] as const;

export type FoulContext = (typeof foulContexts)[number];
export type FreeThrowMark = 'made' | 'miss';

export const foulKindKey: Record<FoulKind, string> = {
  personal: 'trke_foul_personal',
  disruptive: 'trke_foul_disruptive',
  flagrant: 'trke_foul_flagrant',
  disqualifying: 'trke_foul_disqualifying',
  technical: 'trke_foul_technical',
  double: 'trke_foul_double',
};

export const foulKindFallback: Record<FoulKind, string> = {
  personal: 'Personal',
  disruptive: 'Disruptive',
  flagrant: 'Flagrant',
  disqualifying: 'Disqualifying',
  technical: 'Technical',
  double: 'Double foul',
};

const TEAM_FOUL_TYPES = new Set([
  'personal',
  'technical',
  'unsportsmanlike',
  'disruptive',
  'flagrant',
  'disqualifying',
  'double',
]);

const PLAYER_FOUL_TYPES = TEAM_FOUL_TYPES;

export function foulCountsForTeam(foulType: string | null | undefined) {
  return !!foulType && TEAM_FOUL_TYPES.has(foulType);
}

export function foulCountsForPlayer(foulType: string | null | undefined) {
  return !!foulType && PLAYER_FOUL_TYPES.has(foulType);
}

export function foulEjects(kind: FoulKind) {
  return kind === 'flagrant' || kind === 'disqualifying';
}

const COURT_LENGTH_M = 28;
const COURT_WIDTH_M = 15;
const RIM_FROM_BASELINE_M = 1.575;
const RIM_Y_M = 7.5;
const THREE_RADIUS_M = 6.75;
const CORNER_M = 0.9;
const THREE_MEET_M = RIM_FROM_BASELINE_M + Math.sqrt(
  THREE_RADIUS_M * THREE_RADIUS_M - (RIM_Y_M - CORNER_M) * (RIM_Y_M - CORNER_M),
);

export function homeAttacksRight(periodNumber: number, attackRightFirst: boolean) {
  return periodNumber <= 2 ? attackRightFirst : !attackRightFirst;
}

/** On the line counts as 3. World x/y are 0–1 across the court as drawn. */
export function shotValueFromWorld(worldX: number, worldY: number, attacksRight: boolean): 2 | 3 {
  const x = worldX * COURT_LENGTH_M;
  const y = worldY * COURT_WIDTH_M;
  const corner = y <= CORNER_M || y >= COURT_WIDTH_M - CORNER_M;
  if (attacksRight) {
    if (corner) return x >= COURT_LENGTH_M - THREE_MEET_M ? 3 : 2;
    const dist = Math.hypot(x - (COURT_LENGTH_M - RIM_FROM_BASELINE_M), y - RIM_Y_M);
    return dist >= THREE_RADIUS_M ? 3 : 2;
  }
  if (corner) return x <= THREE_MEET_M ? 3 : 2;
  const dist = Math.hypot(x - RIM_FROM_BASELINE_M, y - RIM_Y_M);
  return dist >= THREE_RADIUS_M ? 3 : 2;
}

export function storedCourtPoint(worldX: number, worldY: number, attackingRight: boolean) {
  return {
    x: attackingRight ? worldX : 1 - worldX,
    y: worldY,
  };
}

export function offenseAttacksRight(shootingSide: CaptureSide, periodNumber: number, attackRightFirst: boolean) {
  const homeRight = homeAttacksRight(periodNumber, attackRightFirst);
  return shootingSide === 'home' ? homeRight : !homeRight;
}

/** The 5th team foul of the period is already in the bonus, so 4 already charged means this one pays. */
export function foulFreeThrowCount(input: {
  kind: FoulKind;
  context: FoulContext;
  shotValue: 2 | 3 | null;
  teamFoulsBefore: number;
}): number {
  const { kind, context, shotValue, teamFoulsBefore } = input;
  if (kind === 'double' || context === 'double' || context === 'offensive') return 0;
  if (kind === 'technical' || context === 'technical') return 1;
  if (context === 'no_shot') {
    if (kind === 'personal') return teamFoulsBefore >= 4 ? 2 : 0;
    return 2;
  }
  if (context === 'shot_made') return 1;
  if (context === 'shot_missed') return shotValue === 3 ? 3 : 2;
  return 0;
}

export function foulNeedsOther(input: {
  kind: FoulKind;
  context: FoulContext;
  teamFoulsBefore: number;
}) {
  if (input.kind === 'double' || input.kind === 'technical') return true;
  if (input.kind === 'disruptive' || input.kind === 'flagrant' || input.kind === 'disqualifying') return true;
  if (input.context === 'shot_made' || input.context === 'shot_missed') return true;
  return input.kind === 'personal' && input.context === 'no_shot' && input.teamFoulsBefore >= 4;
}

export const foulErrorCodes = [
  'foul_invalid',
  'foul_slot',
  'foul_possession',
  'foul_player',
  'foul_victim',
  'foul_eliminated',
  'foul_period',
  'foul_shape',
] as const;

export type FoulErrorCode = (typeof foulErrorCodes)[number];

export function foulErrorCode(message: string): FoulErrorCode {
  return foulErrorCodes.find((code) => message.includes(code)) ?? 'foul_invalid';
}

const gameFields = {
  gameId: z.string().uuid(),
  periodNumber: z.number().int().min(1).max(20),
  clockRemainingMs: z.number().int().min(0).max(600000),
  side: z.enum(['home', 'away']),
};

const turnoverPlaySchema = z.object({
  play: z.literal('turnover'),
  ...gameFields,
  coordX: z.number().finite().min(0).max(1),
  coordY: z.number().finite().min(0).max(1),
  reason: z.enum(turnoverReasons),
  offenderId: z.string().uuid(),
});

const shotClockPlaySchema = z.object({
  play: z.literal('shot_clock'),
  ...gameFields,
});

const eightSecondsPlaySchema = z.object({
  play: z.literal('eight_seconds'),
  ...gameFields,
});

const fiveSecondsPlaySchema = z.object({
  play: z.literal('five_seconds'),
  ...gameFields,
});

const point = z.number().finite().min(0).max(1);

export const foulPlaySchema = z.object({
  play: z.literal('foul'),
  ...gameFields,
  coordX: point.nullable(),
  coordY: point.nullable(),
  kind: z.enum(foulKinds),
  context: z.enum(foulContexts),
  offenderId: z.string().uuid().nullable(),
  otherId: z.string().uuid().nullable(),
  coach: z.boolean(),
  throws: z.array(z.enum(['made', 'miss'])).max(3),
}).superRefine((value, context) => {
  const issue = (message: string, path: string) => {
    context.addIssue({ code: 'custom', message, path: [path] });
  };
  if (value.coach) {
    if (value.kind !== 'technical' || value.context !== 'technical' || value.offenderId || !value.otherId) {
      issue('foul_shape', 'coach');
    }
    if (value.coordX !== null || value.coordY !== null || value.throws.length !== 1) issue('foul_shape', 'throws');
    return;
  }
  if (!value.offenderId || value.coordX === null || value.coordY === null) issue('foul_player', 'offenderId');
  if (value.context === 'offensive') {
    if (value.kind !== 'personal' || value.otherId || value.throws.length !== 0) issue('foul_shape', 'context');
    return;
  }
  if (value.kind === 'double' || value.context === 'double') {
    if (value.kind !== 'double' || value.context !== 'double' || !value.otherId || value.throws.length !== 0) {
      issue('foul_shape', 'context');
    }
    return;
  }
  if (value.kind === 'technical' || value.context === 'technical') {
    if (value.kind !== 'technical' || value.context !== 'technical' || !value.otherId || value.throws.length !== 1) {
      issue('foul_victim', 'otherId');
    }
    return;
  }
  if (value.kind === 'personal' && value.context === 'no_shot') {
    if (value.throws.length !== 0 && value.throws.length !== 2) issue('foul_shape', 'throws');
    if (value.throws.length === 2 && !value.otherId) issue('foul_victim', 'otherId');
    if (value.throws.length === 0 && value.otherId) issue('foul_victim', 'otherId');
    return;
  }
  if (value.context === 'no_shot') {
    if (value.throws.length !== 2 || !value.otherId) issue('foul_shape', 'throws');
    return;
  }
  if (value.context === 'shot_made') {
    if (value.throws.length !== 1 || !value.otherId) issue('foul_shape', 'throws');
    return;
  }
  if (value.context === 'shot_missed') {
    if ((value.throws.length !== 2 && value.throws.length !== 3) || !value.otherId) issue('foul_shape', 'throws');
    return;
  }
  issue('foul_shape', 'context');
});

export const commitCapturePlaySchema = z.discriminatedUnion('play', [
  turnoverPlaySchema,
  shotClockPlaySchema,
  eightSecondsPlaySchema,
  fiveSecondsPlaySchema,
  foulPlaySchema,
]);

export type FoulPlayInput = z.infer<typeof foulPlaySchema>;
