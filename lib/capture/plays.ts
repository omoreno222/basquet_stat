import { z } from 'zod';
import { FOUL_OUT } from '@/lib/period-lineup';
import { awardedFreeThrows, freeThrowNeedsRebound } from './free-throws';

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
  'turnover_final',
  'turnover_shape',
] as const;

export type TurnoverErrorCode = (typeof turnoverErrorCodes)[number];

export function turnoverErrorCode(message: string): TurnoverErrorCode {
  return turnoverErrorCodes.find((code) => message.includes(code)) ?? 'turnover_invalid';
}

export const timeoutErrorCodes = [
  'timeout_invalid',
  'timeout_slot',
  'timeout_period',
  'timeout_clock',
  'timeout_cap',
  'timeout_final',
  'timeout_shape',
] as const;

export type TimeoutErrorCode = (typeof timeoutErrorCodes)[number];

export function timeoutErrorCode(message: string): TimeoutErrorCode {
  if (message.toLowerCase().includes('finished game')) return 'timeout_final';
  return timeoutErrorCodes.find((code) => message.includes(code)) ?? 'timeout_invalid';
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

/** A foul on a shot is personal, or one of the three that also give the ball back. */
export const shotFoulKinds = ['personal', 'disruptive', 'flagrant', 'disqualifying'] as const;

export type ShotFoulKind = (typeof shotFoulKinds)[number];

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

const FOUL_ORDINAL_KEYS = [
  'trke_foul_ord_1',
  'trke_foul_ord_2',
  'trke_foul_ord_3',
  'trke_foul_ord_4',
  'trke_foul_ord_5',
] as const;

const FOUL_ORDINAL_FALLBACK = ['1st', '2nd', '3rd', '4th', '5th (Out)'] as const;

/** 1st through 4th, then 5th (Out). Later fouls stay on the fifth. */
export function foulOrdinalCopy(count: number): { key: string; fallback: string } | null {
  if (count < 1) return null;
  const slot = Math.min(count, 5) - 1;
  return { key: FOUL_ORDINAL_KEYS[slot], fallback: FOUL_ORDINAL_FALLBACK[slot] };
}

/** Team 24s, 8s, and inbound 5s count as a period team foul. A player 5s does not. */
export function clockViolationCountsAsTeamFoul(event: {
  turnover_type?: string | null;
  player_id?: string | null;
  opponent_player_id?: string | null;
}) {
  if (event.turnover_type === 'shot_clock' || event.turnover_type === 'eight_seconds') return true;
  return event.turnover_type === 'five_seconds'
    && !event.player_id
    && !event.opponent_player_id;
}

export function foulEjects(kind: string | null | undefined) {
  return kind === 'flagrant' || kind === 'disqualifying';
}

/** Fifth counting foul, or a flagrant or disqualifying foul, sends the player to the bench. */
export function playerMustLeaveAfterFoul(priorPersonalFouls: number, kind: string | null | undefined) {
  if (foulEjects(kind)) return true;
  if (!foulCountsForPlayer(kind)) return false;
  return priorPersonalFouls + 1 >= FOUL_OUT;
}

const COURT_LENGTH_M = 28;
const COURT_WIDTH_M = 15;
const RIM_FROM_BASELINE_M = 1.575;
const RIM_Y_M = 7.5;
const THREE_RADIUS_M = 6.75;
const CORNER_M = 0.9;
const KEY_WIDTH_M = 4.9;
const KEY_LENGTH_M = 5.8;
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

/** The midcourt line belongs to neither attack. The baseline of the attack is included. */
export function shotOnAttackingHalf(worldX: number, attacksRight: boolean): boolean {
  if (worldX < 0 || worldX > 1) return false;
  return attacksRight ? worldX > 0.5 : worldX < 0.5;
}

/** The paint line counts as inside the key. */
export function shotInPaint(worldX: number, worldY: number, attacksRight: boolean): boolean {
  const x = worldX * COURT_LENGTH_M;
  const y = worldY * COURT_WIDTH_M;
  const half = KEY_WIDTH_M / 2;
  if (y < RIM_Y_M - half || y > RIM_Y_M + half) return false;
  if (attacksRight) return x >= COURT_LENGTH_M - KEY_LENGTH_M;
  return x <= KEY_LENGTH_M;
}

/** A 2 inside the key needs an assist when a teammate is on the court. A 3 never does. */
export function madeAssistRequired(points: 2 | 3, inPaint: boolean, teammatesOnCourt: number): boolean {
  return points === 2 && inPaint && teammatesOnCourt > 0;
}

/** Every made basket stops the clock. The other team inbounds. */
export function madeStopsClock(_personal?: boolean): boolean {
  return true;
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

/** How many free throws this foul awards. The operator does not choose the count. */
export function foulThrowAllowance(input: {
  kind: FoulKind;
  context: FoulContext;
  teamFoulsBefore: number;
  shotValue?: 2 | 3 | null;
}): 0 | 1 | 2 | 3 {
  return awardedFreeThrows(input);
}

export function foulNeedsOther(input: {
  kind: FoulKind;
  context: FoulContext;
  teamFoulsBefore: number;
}) {
  if (input.kind === 'double' || input.kind === 'technical') return true;
  if (input.kind === 'disruptive' || input.kind === 'flagrant' || input.kind === 'disqualifying') return true;
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
  'foul_final',
  'foul_shape',
] as const;

export type FoulErrorCode = (typeof foulErrorCodes)[number];

export function foulErrorCode(message: string): FoulErrorCode {
  return foulErrorCodes.find((code) => message.includes(code)) ?? 'foul_invalid';
}

export const madeErrorCodes = [
  'made_invalid',
  'made_slot',
  'made_possession',
  'made_period',
  'made_half',
  'made_player',
  'made_assist',
  'made_foul',
  'made_eliminated',
  'made_final',
  'made_shape',
] as const;

export type MadeErrorCode = (typeof madeErrorCodes)[number];

export function madeErrorCode(message: string): MadeErrorCode {
  if (message.toLowerCase().includes('finished game')) return 'made_final';
  return madeErrorCodes.find((code) => message.includes(code)) ?? 'made_invalid';
}

export const substitutionErrorCodes = [
  'substitution_invalid',
  'substitution_slot',
  'substitution_period',
  'substitution_out',
  'substitution_in',
  'substitution_eliminated',
  'substitution_final',
  'substitution_shape',
] as const;

export type SubstitutionErrorCode = (typeof substitutionErrorCodes)[number];

export function substitutionErrorCode(message: string): SubstitutionErrorCode {
  return substitutionErrorCodes.find((code) => message.includes(code)) ?? 'substitution_invalid';
}

const gameFields = {
  gameId: z.string().uuid(),
  periodNumber: z.number().int().min(1).max(20),
  clockRemainingMs: z.number().int().min(0).max(600000),
  side: z.enum(['home', 'away']),
  /** Log a play at its own period and time without moving the live clock or possession. */
  backfill: z.boolean().optional(),
};

const turnoverPlaySchema = z.object({
  play: z.literal('turnover'),
  ...gameFields,
  coordX: z.number().finite().min(0).max(1),
  coordY: z.number().finite().min(0).max(1),
  reason: z.enum(turnoverReasons),
  offenderId: z.string().uuid(),
  /** Live-ball turnover: the clock was running at the whistle and should keep going. */
  resumeClock: z.boolean().optional(),
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

/** A required rebound is a named player or the opponent team with no player. */
function reboundChoice(
  needsRebound: boolean,
  rebounderId: string | null | undefined,
  unknownRebound: boolean | undefined,
): 'ok' | 'missing' | 'extra' | 'both' {
  const unknown = unknownRebound === true;
  const named = !!rebounderId;
  if (unknown && named) return 'both';
  if (needsRebound && !named && !unknown) return 'missing';
  if (!needsRebound && (named || unknown)) return 'extra';
  return 'ok';
}

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
  rebounderId: z.string().uuid().nullable().optional(),
  unknownRebound: z.boolean().optional(),
}).superRefine((value, context) => {
  const issue = (message: string, path: string) => {
    context.addIssue({ code: 'custom', message, path: [path] });
  };
  const needsRebound = freeThrowNeedsRebound({
    source: 'foul',
    kind: value.kind,
    context: value.context,
    throws: value.throws,
  });
  const choice = reboundChoice(needsRebound, value.rebounderId, value.unknownRebound);
  if (choice !== 'ok') issue('foul_shape', 'rebounderId');
  if (value.context === 'shot_made' || value.context === 'shot_missed') {
    issue('foul_shape', 'context');
    return;
  }
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
  issue('foul_shape', 'context');
});

const substitutionPlaySchema = z.object({
  play: z.literal('substitution'),
  ...gameFields,
  swaps: z.array(z.object({
    outId: z.string().uuid(),
    inId: z.string().uuid(),
  })).min(1).max(5),
});

const timeoutPlaySchema = z.object({
  play: z.literal('timeout'),
  ...gameFields,
});

const madePlaySchema = z.object({
  play: z.literal('made'),
  ...gameFields,
  coordX: point,
  coordY: point,
  shooterId: z.string().uuid(),
  assistId: z.string().uuid().nullable(),
  foulerId: z.string().uuid().nullable(),
  foulKind: z.enum(shotFoulKinds).nullable().optional(),
  throws: z.array(z.enum(['made', 'miss'])).max(3),
  rebounderId: z.string().uuid().nullable().optional(),
  unknownRebound: z.boolean().optional(),
}).superRefine((value, context) => {
  const issue = (message: string, path: string) => {
    context.addIssue({ code: 'custom', message, path: [path] });
  };
  if (value.assistId === value.shooterId) issue('made_assist', 'assistId');
  if (value.foulerId && (value.foulerId === value.shooterId || value.foulerId === value.assistId)) {
    issue('made_foul', 'foulerId');
  }
  const needsRebound = !!value.foulerId && freeThrowNeedsRebound({
    source: 'made',
    kind: value.foulKind ?? 'personal',
    throws: value.throws,
  });
  const choice = reboundChoice(needsRebound, value.rebounderId, value.unknownRebound);
  if (choice === 'missing') issue('made_foul', 'rebounderId');
  if (choice === 'extra' || choice === 'both') issue('made_shape', 'rebounderId');
  if (value.foulerId) {
    if (!value.foulKind || value.throws.length !== 1) issue('made_foul', 'throws');
    return;
  }
  if (value.foulKind || value.throws.length !== 0) issue('made_shape', 'throws');
});

const missPlaySchema = z.object({
  play: z.literal('miss'),
  ...gameFields,
  coordX: point,
  coordY: point,
  shooterId: z.string().uuid(),
  rebounderId: z.string().uuid().nullable(),
  unknownRebound: z.boolean().optional(),
  foulerId: z.string().uuid().nullable(),
  foulKind: z.enum(shotFoulKinds).nullable().optional(),
  deadBall: z.enum(['lodged', 'period_end']).nullable().optional(),
  throws: z.array(z.enum(['made', 'miss'])).max(3),
}).superRefine((value, context) => {
  const issue = (message: string, path: string) => {
    context.addIssue({ code: 'custom', message, path: [path] });
  };
  const deadBall = value.deadBall ?? null;
  if (value.foulerId) {
    if (deadBall) issue('miss_shape', 'rebounderId');
    if (value.foulerId === value.shooterId) issue('miss_foul', 'foulerId');
    if (!value.foulKind || (value.throws.length !== 2 && value.throws.length !== 3)) issue('miss_foul', 'throws');
    const needsRebound = freeThrowNeedsRebound({
      source: 'miss',
      kind: value.foulKind ?? 'personal',
      throws: value.throws,
    });
    const choice = reboundChoice(needsRebound, value.rebounderId, value.unknownRebound);
    if (choice === 'missing') issue('miss_rebound', 'rebounderId');
    if (choice === 'extra' || choice === 'both') issue('miss_shape', 'rebounderId');
    return;
  }
  const choice = reboundChoice(!deadBall, value.rebounderId, value.unknownRebound);
  if (choice === 'missing') issue('miss_rebound', 'rebounderId');
  if (choice === 'extra' || choice === 'both') issue('miss_shape', 'rebounderId');
  if (value.foulKind) issue('miss_shape', 'foulKind');
  if (deadBall) {
    if (value.throws.length !== 0) issue('miss_shape', 'throws');
    return;
  }
  if (value.throws.length !== 0) issue('miss_shape', 'throws');
});

export const missErrorCodes = [
  'miss_invalid',
  'miss_slot',
  'miss_possession',
  'miss_period',
  'miss_half',
  'miss_player',
  'miss_rebound',
  'miss_arrow',
  'miss_foul',
  'miss_eliminated',
  'miss_final',
  'miss_shape',
] as const;

export type MissErrorCode = (typeof missErrorCodes)[number];

export function missErrorCode(message: string): MissErrorCode {
  if (message.toLowerCase().includes('finished game')) return 'miss_final';
  return missErrorCodes.find((code) => message.includes(code)) ?? 'miss_invalid';
}

export const commitCapturePlaySchema = z.discriminatedUnion('play', [
  turnoverPlaySchema,
  shotClockPlaySchema,
  eightSecondsPlaySchema,
  fiveSecondsPlaySchema,
  foulPlaySchema,
  substitutionPlaySchema,
  timeoutPlaySchema,
  madePlaySchema,
  missPlaySchema,
]);

export type MadePlayInput = z.infer<typeof madePlaySchema>;

export type MissPlayInput = z.infer<typeof missPlaySchema>;

export type TimeoutPlayInput = z.infer<typeof timeoutPlaySchema>;

export type SubstitutionPlayInput = z.infer<typeof substitutionPlaySchema>;

export type FoulPlayInput = z.infer<typeof foulPlaySchema>;

export const placeMadeShotPointSchema = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
  coordX: z.number().finite().min(0).max(1),
  coordY: z.number().finite().min(0).max(1),
  assistId: z.string().uuid().nullable(),
  shooterId: z.string().uuid(),
});

export type PlaceMadeShotPointInput = z.infer<typeof placeMadeShotPointSchema>;

export const editJumpSchema = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
  jumpWon: z.boolean(),
  homePlayerId: z.string().uuid().nullable(),
  awayPlayerId: z.string().uuid().nullable(),
}).refine(
  (value) => (value.homePlayerId === null) === (value.awayPlayerId === null),
  { message: 'jump_need_both' },
);

export type EditJumpInput = z.infer<typeof editJumpSchema>;

export const editFoulReceivedSchema = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
  playerId: z.string().uuid().nullable(),
  offenderId: z.string().uuid().nullable(),
});

export type EditFoulReceivedInput = z.infer<typeof editFoulReceivedSchema>;

export const editMissedShotSchema = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
  coordX: z.number().finite().min(0).max(1),
  coordY: z.number().finite().min(0).max(1),
  shooterId: z.string().uuid(),
});

export type EditMissedShotInput = z.infer<typeof editMissedShotSchema>;

export const editFreeThrowsSchema = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
  marks: z.array(z.enum(['made', 'miss'])).min(1).max(3),
});

export type EditFreeThrowsInput = z.infer<typeof editFreeThrowsSchema>;

export const editSubstitutionSchema = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
  swaps: z.array(z.object({
    eventId: z.string().uuid(),
    outId: z.string().uuid(),
    inId: z.string().uuid(),
  })).min(1).max(5),
});

export type EditSubstitutionInput = z.infer<typeof editSubstitutionSchema>;

export const editReboundPlayerSchema = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export type EditReboundPlayerInput = z.infer<typeof editReboundPlayerSchema>;

export const deleteCapturePlaySchema = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
});

export type DeleteCapturePlayInput = z.infer<typeof deleteCapturePlaySchema>;
