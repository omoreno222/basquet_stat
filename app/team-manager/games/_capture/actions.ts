'use server';

import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { userManagesClub } from '@/lib/live-access';
import { isEliminated } from '@/lib/period-lineup';
import {
  clockViolationCountsAsTeamFoul,
  commitCapturePlaySchema,
  deleteCapturePlaySchema,
  foulCountsForPlayer,
  foulCountsForTeam,
  foulErrorCode,
  foulThrowAllowance,
  madeAssistRequired,
  madeErrorCode,
  madeStopsClock,
  missErrorCode,
  offenseAttacksRight,
  otherCaptureSide,
  editFoulReceivedSchema,
  editJumpSchema,
  placeMadeShotPointSchema,
  shotInPaint,
  shotOnAttackingHalf,
  shotValueFromWorld,
  storedCourtPoint,
  substitutionErrorCode,
  timeoutErrorCode,
  turnoverErrorCode,
  turnoverStopsClock,
  type CaptureSide,
  type ClockViolation,
  type FoulPlayInput,
  type MadePlayInput,
  type MissPlayInput,
  type SubstitutionPlayInput,
  type TimeoutPlayInput,
  type TurnoverReason,
} from '@/lib/capture/plays';
import { freeThrowNeedsRebound } from '@/lib/capture/free-throws';
import { missNextPossession, missStopsClock, reboundIsOffensive } from '@/lib/capture/miss';
import { foulNextPossession, madeNextPossession } from '@/lib/capture/next-possession';
import { arrowSide } from '@/lib/capture/period-inbound';
import { captureHappenedBefore, onCourtAfterSubs, onCourtBefore, playerEliminatedBefore } from '@/lib/capture/substitutions';
import { scoreFromEvents } from '@/lib/capture/score';
import { timeoutWindow } from '@/lib/capture/timeouts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CaptureClient = SupabaseClient;

type PlaySuccess = {
  id: string;
  possession?: CaptureSide | null;
  possessionChanged?: boolean;
  teamScore?: number;
  opponentScore?: number;
  groupId?: string;
};

/** A logged play keeps its own clock. The live game clock and possession stay put; the score still moves. */
function gameMomentPatch(
  backfill: boolean | undefined,
  patch: {
    team_score?: number;
    opponent_score?: number;
    possession?: CaptureSide | null;
    clock_running?: boolean;
    clock_remaining_ms?: number;
  },
) {
  if (!backfill) return patch;
  const next: { team_score?: number; opponent_score?: number } = {};
  if (patch.team_score !== undefined) next.team_score = patch.team_score;
  if (patch.opponent_score !== undefined) next.opponent_score = patch.opponent_score;
  return next;
}

function reboundRow(
  base: Record<string, unknown>,
  createdAt: string,
  rebounderId: string | null,
  reboundSide: CaptureSide,
  unknownRebound: boolean,
  shootingSide: CaptureSide,
) {
  const players = unknownRebound
    ? { player_id: null, opponent_player_id: null, rebound_side: 'away' as const }
    : reboundSide === 'home'
      ? { player_id: rebounderId, opponent_player_id: null, rebound_side: null }
      : { player_id: null, opponent_player_id: rebounderId, rebound_side: null };
  return {
    ...base,
    created_at: createdAt,
    ...players,
    event_type: 'rebound',
    points: 0,
    is_offensive: reboundIsOffensive(shootingSide, reboundSide),
  };
}

async function commitFoul(
  supabase: CaptureClient,
  userId: string,
  play: FoulPlayInput,
  game: {
    team_id: string;
    possession: string | null;
    current_period: number | null;
    attack_right_first: boolean | null;
    team_score: number | null;
    opponent_score: number | null;
  },
): Promise<PlaySuccess | { error: string }> {
  if (play.context === 'shot_made' || play.context === 'shot_missed') return { error: 'foul_shape' };

  const otherSide = otherCaptureSide(play.side);
  const liveBall = game.possession === 'home' || game.possession === 'away' ? game.possession : null;
  if (!play.backfill) {
    if (play.periodNumber !== (game.current_period || 1)) return { error: 'foul_period' };
    if (!liveBall) return { error: 'foul_possession' };
    if (play.context === 'offensive' && liveBall !== play.side) return { error: 'foul_shape' };
    if (play.kind === 'personal' && play.context !== 'offensive' && liveBall === play.side) {
      return { error: 'foul_shape' };
    }
  }
  const possession: CaptureSide | null = play.backfill
    ? (play.context === 'offensive' ? play.side : play.kind === 'personal' ? otherSide : liveBall)
    : liveBall;
  const attackRightFirst = game.attack_right_first !== false;

  const cutoff = {
    period_number: play.periodNumber,
    clock_remaining_ms: play.clockRemainingMs,
    created_at: new Date().toISOString(),
  };
  const { data: priorEvents, error: priorError } = await supabase
    .from('game_events')
    .select('event_type, foul_type, foul_side, coach_technical_side, player_id, opponent_player_id, player_out_id, opponent_player_out_id, turnover_type, turnover_side, period_number, clock_remaining_ms, created_at')
    .eq('game_id', play.gameId);
  if (priorError) return { error: 'foul_invalid' };

  const rows = priorEvents ?? [];
  const teamFoulsBefore = rows.filter((event) => {
    if (event.period_number !== play.periodNumber) return false;
    if (event.event_type === 'foul' && foulCountsForTeam(event.foul_type)) {
      if (event.foul_side === play.side || event.coach_technical_side === play.side) return true;
      if (!event.foul_side && !event.coach_technical_side) {
        if (play.side === 'home') return !!event.player_id && !event.opponent_player_id;
        return !!event.opponent_player_id && !event.player_id;
      }
    }
    return event.event_type === 'turnover'
      && event.turnover_side === play.side
      && (
        event.turnover_type === 'offensive_foul'
        || event.turnover_type === 'technical'
        || clockViolationCountsAsTeamFoul(event)
      );
  }).length;

  const allowance = foulThrowAllowance({
    kind: play.kind,
    context: play.context,
    teamFoulsBefore,
  });
  if (play.throws.length !== allowance) return { error: 'foul_shape' };

  if (play.offenderId && playerEliminatedBefore(rows, play.offenderId, play.side, cutoff)) return { error: 'foul_eliminated' };
  if (play.otherId && playerEliminatedBefore(rows, play.otherId, otherSide, cutoff)) return { error: 'foul_eliminated' };

  const { data: lineup, error: lineupError } = await supabase
    .from('game_period_lineups')
    .select('side, position_index, player_id, opponent_player_id')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber);
  if (lineupError) return { error: 'foul_invalid' };

  const homeStart = (lineup ?? [])
    .filter((row) => row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayStart = (lineup ?? [])
    .filter((row) => row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);
  const homeIds = onCourtBefore(homeStart, rows, play.periodNumber, 'home', cutoff);
  const awayIds = onCourtBefore(awayStart, rows, play.periodNumber, 'away', cutoff);

  const onCourt = (id: string, side: CaptureSide) => (side === 'home' ? homeIds : awayIds).includes(id);
  if (play.offenderId && !onCourt(play.offenderId, play.side)) return { error: 'foul_player' };
  if (play.otherId && !onCourt(play.otherId, otherSide)) return { error: 'foul_victim' };

  let reboundSide: CaptureSide | null = null;
  const rebounderId = play.rebounderId ?? null;
  const unknownRebound = play.unknownRebound === true;
  if (unknownRebound && rebounderId) return { error: 'foul_shape' };
  if (rebounderId) {
    const onHome = homeIds.includes(rebounderId);
    const onAway = awayIds.includes(rebounderId);
    if (onHome === onAway) return { error: 'foul_shape' };
    reboundSide = onHome ? 'home' : 'away';
    if (playerEliminatedBefore(rows, rebounderId, reboundSide, cutoff)) return { error: 'foul_eliminated' };
  } else if (unknownRebound) {
    reboundSide = 'away';
  }
  const liveRebound = freeThrowNeedsRebound({
    source: 'foul',
    kind: play.kind,
    context: play.context,
    throws: play.throws,
  });
  if (liveRebound && !reboundSide) return { error: 'foul_shape' };
  if (!liveRebound && (rebounderId || unknownRebound)) return { error: 'foul_shape' };

  const periodLength = play.periodNumber <= 4 ? 600000 : 300000;
  const groupId = crypto.randomUUID();
  const stored = play.coordX === null || play.coordY === null
    ? null
    : storedCourtPoint(
      play.coordX,
      play.coordY,
      offenseAttacksRight('home', play.periodNumber, attackRightFirst),
    );
  const clock = play.clockRemainingMs;
  const elapsed = periodLength - clock;
  const recordedAt = Date.now();
  let stamp = 0;
  const createdAt = () => new Date(recordedAt + stamp++).toISOString();
  const base = {
    game_id: play.gameId,
    period_number: play.periodNumber,
    clock_remaining_ms: clock,
    elapsed_ms: elapsed,
    play_group_id: groupId,
    recorded_by_user_id: userId,
  };
  const playerOf = (id: string, side: CaptureSide) => (
    side === 'home' ? { player_id: id, opponent_player_id: null } : { player_id: null, opponent_player_id: id }
  );

  const inserts: Record<string, unknown>[] = [];
  const foulRow = {
    ...base,
    event_type: 'foul',
    foul_type: play.kind,
    foul_side: play.side,
    foul_context: play.context,
    shot_value: null,
    free_throws_awarded: play.throws.length,
    possession_before: possession,
    coord_x: stored?.x ?? null,
    coord_y: stored?.y ?? null,
    is_offensive: play.context === 'offensive',
    coach_technical_side: play.coach ? play.side : null,
    ...(play.coach || !play.offenderId
      ? { player_id: null, opponent_player_id: null }
      : playerOf(play.offenderId, play.side)),
  };
  inserts.push({ ...foulRow, created_at: createdAt() });
  if (play.kind === 'double' && play.otherId) {
    inserts.push({
      ...foulRow,
      created_at: createdAt(),
      foul_side: otherSide,
      coach_technical_side: null,
      ...playerOf(play.otherId, otherSide),
    });
  }

  play.throws.forEach((mark) => {
    if (!play.otherId) return;
    const made = mark === 'made';
    inserts.push({
      ...base,
      created_at: createdAt(),
      ...playerOf(play.otherId, otherSide),
      event_type: 'free_throw',
      points: made ? 1 : 0,
      made,
      is_offensive: true,
    });
  });
  if (reboundSide && (rebounderId || unknownRebound)) {
    inserts.push(reboundRow(base, createdAt(), rebounderId, reboundSide, unknownRebound, otherSide));
  }

  const { data: inserted, error: insertError } = await supabase
    .from('game_events')
    .insert(inserts)
    .select('id');
  if (insertError || !inserted?.length) {
    return { error: foulErrorCode(insertError?.message ?? 'foul_invalid') };
  }

  let homePoints = 0;
  let awayPoints = 0;
  const addPoints = (side: CaptureSide, points: number) => {
    if (side === 'home') homePoints += points;
    else awayPoints += points;
  };
  play.throws.forEach((mark) => {
    if (mark === 'made') addPoints(otherSide, 1);
  });

  const teamScore = (game.team_score ?? 0) + homePoints;
  const opponentScore = (game.opponent_score ?? 0) + awayPoints;
  const decided = foulNextPossession({
    possession,
    side: play.side,
    kind: play.kind,
    context: play.context,
    throws: play.throws,
    liveRebound,
    reboundSide,
  });
  const nextPossession = decided.possession;
  const possessionChanged = decided.changed;

  const patch: {
    clock_running?: boolean;
    clock_remaining_ms?: number;
    team_score: number;
    opponent_score: number;
    possession?: CaptureSide | null;
  } = {
    team_score: teamScore,
    opponent_score: opponentScore,
  };
  if (!play.backfill && !liveRebound) {
    patch.clock_running = false;
    patch.clock_remaining_ms = clock;
  }
  if (!play.backfill && possessionChanged) patch.possession = nextPossession;

  const moment = gameMomentPatch(play.backfill, patch);
  if (Object.keys(moment).length) {
    const { error: updateError } = await supabase.from('games').update(moment).eq('id', play.gameId);
    if (updateError) {
      await supabase.from('game_events').delete().eq('play_group_id', groupId);
      return { error: 'foul_invalid' };
    }
  }

  return {
    id: inserted[0].id as string,
    groupId,
    possession: nextPossession,
    possessionChanged: play.backfill ? false : possessionChanged,
    teamScore,
    opponentScore,
  };
}

async function commitMade(
  supabase: CaptureClient,
  userId: string,
  play: MadePlayInput,
  game: {
    possession: string | null;
    current_period: number | null;
    attack_right_first: boolean | null;
    team_score: number | null;
    opponent_score: number | null;
    status: string | null;
  },
): Promise<PlaySuccess | { error: string }> {
  if (game.status === 'final') return { error: 'made_final' };
  if (!play.backfill && play.periodNumber !== (game.current_period || 1)) return { error: 'made_period' };
  if (!play.backfill && game.possession !== play.side) return { error: 'made_possession' };

  const attackRightFirst = game.attack_right_first !== false;
  const attacksRight = offenseAttacksRight(play.side, play.periodNumber, attackRightFirst);
  if (!shotOnAttackingHalf(play.coordX, attacksRight)) return { error: 'made_half' };
  const shotValue = shotValueFromWorld(play.coordX, play.coordY, attacksRight);
  const inPaint = shotInPaint(play.coordX, play.coordY, attacksRight);
  const otherSide = otherCaptureSide(play.side);

  const cutoff = {
    period_number: play.periodNumber,
    clock_remaining_ms: play.clockRemainingMs,
    created_at: new Date().toISOString(),
  };
  const { data: priorEvents, error: priorError } = await supabase
    .from('game_events')
    .select('event_type, foul_type, coach_technical_side, player_id, opponent_player_id, player_out_id, opponent_player_out_id, turnover_type, turnover_side, period_number, clock_remaining_ms, created_at')
    .eq('game_id', play.gameId);
  if (priorError) return { error: 'made_invalid' };

  const rows = priorEvents ?? [];
  if (playerEliminatedBefore(rows, play.shooterId, play.side, cutoff)) return { error: 'made_eliminated' };
  if (play.assistId && playerEliminatedBefore(rows, play.assistId, play.side, cutoff)) return { error: 'made_eliminated' };
  if (play.foulerId && playerEliminatedBefore(rows, play.foulerId, otherSide, cutoff)) return { error: 'made_eliminated' };

  const { data: lineup, error: lineupError } = await supabase
    .from('game_period_lineups')
    .select('side, position_index, player_id, opponent_player_id')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber);
  if (lineupError) return { error: 'made_invalid' };

  const homeStart = (lineup ?? [])
    .filter((row) => row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayStart = (lineup ?? [])
    .filter((row) => row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);
  const homeIds = onCourtBefore(homeStart, rows, play.periodNumber, 'home', cutoff);
  const awayIds = onCourtBefore(awayStart, rows, play.periodNumber, 'away', cutoff);
  const onCourt = (id: string, side: CaptureSide) => (side === 'home' ? homeIds : awayIds).includes(id);
  if (!onCourt(play.shooterId, play.side)) return { error: 'made_player' };
  const teammates = (play.side === 'home' ? homeIds : awayIds).filter((id) => id !== play.shooterId);
  if (play.assistId && !teammates.includes(play.assistId)) return { error: 'made_assist' };
  const availableMates = teammates.filter((id) => !playerEliminatedBefore(rows, id, play.side, cutoff));
  if (madeAssistRequired(shotValue, inPaint, availableMates.length) && !play.assistId) return { error: 'made_assist' };
  if (play.foulerId && !onCourt(play.foulerId, otherSide)) return { error: 'made_foul' };
  if (play.foulerId) {
    if (!play.foulKind || play.throws.length !== 1) return { error: 'made_foul' };
  } else if (play.foulKind || play.throws.length !== 0) {
    return { error: 'made_shape' };
  }

  let reboundSide: CaptureSide | null = null;
  const rebounderId = play.rebounderId ?? null;
  const unknownRebound = play.unknownRebound === true;
  if (unknownRebound && rebounderId) return { error: 'made_shape' };
  if (rebounderId) {
    const onHome = homeIds.includes(rebounderId);
    const onAway = awayIds.includes(rebounderId);
    if (onHome === onAway) return { error: 'made_foul' };
    reboundSide = onHome ? 'home' : 'away';
    if (playerEliminatedBefore(rows, rebounderId, reboundSide, cutoff)) return { error: 'made_eliminated' };
  } else if (unknownRebound) {
    reboundSide = 'away';
  }
  const liveRebound = !!play.foulerId && freeThrowNeedsRebound({
    source: 'made',
    kind: play.foulKind ?? 'personal',
    throws: play.throws,
  });
  if (liveRebound && !reboundSide) return { error: 'made_foul' };
  if (!liveRebound && (rebounderId || unknownRebound)) return { error: 'made_shape' };

  const periodLength = play.periodNumber <= 4 ? 600000 : 300000;
  const groupId = crypto.randomUUID();
  const stored = storedCourtPoint(
    play.coordX,
    play.coordY,
    offenseAttacksRight('home', play.periodNumber, attackRightFirst),
  );
  const clock = play.clockRemainingMs;
  const recordedAt = Date.now();
  let stamp = 0;
  const createdAt = () => new Date(recordedAt + stamp++).toISOString();
  const base = {
    game_id: play.gameId,
    period_number: play.periodNumber,
    clock_remaining_ms: clock,
    elapsed_ms: periodLength - clock,
    play_group_id: groupId,
    recorded_by_user_id: userId,
    possession_before: play.side,
  };
  const playerOf = (id: string, side: CaptureSide) => (
    side === 'home' ? { player_id: id, opponent_player_id: null } : { player_id: null, opponent_player_id: id }
  );

  const inserts: Record<string, unknown>[] = [{
    ...base,
    created_at: createdAt(),
    ...playerOf(play.shooterId, play.side),
    event_type: 'shot',
    points: shotValue,
    made: true,
    coord_x: stored.x,
    coord_y: stored.y,
    is_offensive: true,
  }];
  if (play.assistId) {
    inserts.push({
      ...base,
      created_at: createdAt(),
      ...playerOf(play.assistId, play.side),
      event_type: 'assist',
      points: 0,
      is_offensive: true,
    });
  }
  if (play.foulerId) {
    if (!play.foulKind) return { error: 'made_foul' };
    const foulKind = play.foulKind;
    inserts.push({
      ...base,
      created_at: createdAt(),
      ...playerOf(play.foulerId, otherSide),
      event_type: 'foul',
      foul_type: foulKind,
      foul_side: otherSide,
      foul_context: 'shot_made',
      shot_value: shotValue,
      free_throws_awarded: play.throws.length,
      coord_x: stored.x,
      coord_y: stored.y,
      is_offensive: false,
    });
    play.throws.forEach((mark) => {
      const madeThrow = mark === 'made';
      inserts.push({
        ...base,
        created_at: createdAt(),
        ...playerOf(play.shooterId, play.side),
        event_type: 'free_throw',
        points: madeThrow ? 1 : 0,
        made: madeThrow,
        is_offensive: true,
      });
    });
  }
  if (reboundSide && (rebounderId || unknownRebound)) {
    inserts.push(reboundRow(base, createdAt(), rebounderId, reboundSide, unknownRebound, play.side));
  }

  const { data: inserted, error: insertError } = await supabase
    .from('game_events')
    .insert(inserts)
    .select('id');
  if (insertError || !inserted?.length) {
    return { error: madeErrorCode(insertError?.message ?? 'made_invalid') };
  }

  let homePoints = 0;
  let awayPoints = 0;
  const addPoints = (side: CaptureSide, points: number) => {
    if (side === 'home') homePoints += points;
    else awayPoints += points;
  };
  addPoints(play.side, shotValue);
  play.throws.forEach((mark) => {
    if (mark === 'made') addPoints(play.side, 1);
  });

  const teamScore = (game.team_score ?? 0) + homePoints;
  const opponentScore = (game.opponent_score ?? 0) + awayPoints;
  const nextPossession = madeNextPossession({
    side: play.side,
    foulKind: play.foulKind,
    foulerId: play.foulerId,
    throws: play.throws,
    liveRebound,
    reboundSide,
  });
  const patch: {
    team_score: number;
    opponent_score: number;
    possession: CaptureSide | null;
    clock_running?: boolean;
    clock_remaining_ms?: number;
  } = {
    team_score: teamScore,
    opponent_score: opponentScore,
    possession: nextPossession,
  };
  if (!play.backfill && madeStopsClock(!!play.foulerId) && !liveRebound) {
    patch.clock_running = false;
    patch.clock_remaining_ms = clock;
  }

  const moment = gameMomentPatch(play.backfill, patch);
  const { error: updateError } = Object.keys(moment).length
    ? await supabase.from('games').update(moment).eq('id', play.gameId)
    : { error: null };
  if (updateError) {
    await supabase.from('game_events').delete().eq('play_group_id', groupId);
    return { error: 'made_invalid' };
  }

  return {
    id: inserted[0].id as string,
    groupId,
    possession: nextPossession,
    possessionChanged: !play.backfill,
    teamScore,
    opponentScore,
  };
}

async function commitMiss(
  supabase: CaptureClient,
  userId: string,
  play: MissPlayInput,
  game: {
    possession: string | null;
    current_period: number | null;
    attack_right_first: boolean | null;
    team_score: number | null;
    opponent_score: number | null;
    status: string | null;
    opening_tip_winner: string | null;
  },
): Promise<PlaySuccess | { error: string }> {
  if (game.status === 'final') return { error: 'miss_final' };
  if (!play.backfill && play.periodNumber !== (game.current_period || 1)) return { error: 'miss_period' };
  if (!play.backfill && game.possession !== play.side) return { error: 'miss_possession' };

  const attackRightFirst = game.attack_right_first !== false;
  const attacksRight = offenseAttacksRight(play.side, play.periodNumber, attackRightFirst);
  if (!shotOnAttackingHalf(play.coordX, attacksRight)) return { error: 'miss_half' };
  const shotValue = shotValueFromWorld(play.coordX, play.coordY, attacksRight);
  const otherSide = otherCaptureSide(play.side);

  const cutoff = {
    period_number: play.periodNumber,
    clock_remaining_ms: play.clockRemainingMs,
    created_at: new Date().toISOString(),
  };
  const { data: priorEvents, error: priorError } = await supabase
    .from('game_events')
    .select('event_type, foul_type, coach_technical_side, player_id, opponent_player_id, player_out_id, opponent_player_out_id, turnover_type, turnover_side, period_number, clock_remaining_ms, created_at, dead_ball')
    .eq('game_id', play.gameId);
  if (priorError) return { error: 'miss_invalid' };

  const rows = priorEvents ?? [];
  if (playerEliminatedBefore(rows, play.shooterId, play.side, cutoff)) return { error: 'miss_eliminated' };
  if (play.foulerId && playerEliminatedBefore(rows, play.foulerId, otherSide, cutoff)) return { error: 'miss_eliminated' };

  const { data: lineup, error: lineupError } = await supabase
    .from('game_period_lineups')
    .select('side, position_index, player_id, opponent_player_id')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber);
  if (lineupError) return { error: 'miss_invalid' };

  const homeStart = (lineup ?? [])
    .filter((row) => row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayStart = (lineup ?? [])
    .filter((row) => row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);
  const homeIds = onCourtBefore(homeStart, rows, play.periodNumber, 'home', cutoff);
  const awayIds = onCourtBefore(awayStart, rows, play.periodNumber, 'away', cutoff);
  const onCourt = (id: string, side: CaptureSide) => (side === 'home' ? homeIds : awayIds).includes(id);
  if (!onCourt(play.shooterId, play.side)) return { error: 'miss_player' };

  const deadBall = play.deadBall ?? null;
  const unknownRebound = play.unknownRebound === true;
  if (unknownRebound && (play.rebounderId || deadBall)) return { error: 'miss_shape' };
  let reboundSide: CaptureSide | null = null;
  let lodgedSide: CaptureSide | null = null;
  if (play.foulerId) {
    if (deadBall) return { error: 'miss_shape' };
    if (!play.foulKind || play.throws.length !== shotValue) return { error: 'miss_foul' };
    if (!onCourt(play.foulerId, otherSide)) return { error: 'miss_foul' };
    if (play.rebounderId) {
      const onHome = homeIds.includes(play.rebounderId);
      const onAway = awayIds.includes(play.rebounderId);
      if (onHome === onAway) return { error: 'miss_rebound' };
      reboundSide = onHome ? 'home' : 'away';
      if (playerEliminatedBefore(rows, play.rebounderId, reboundSide, cutoff)) return { error: 'miss_eliminated' };
    } else if (unknownRebound) {
      reboundSide = 'away';
    }
  } else if (play.rebounderId) {
    if (deadBall) return { error: 'miss_shape' };
    const onHome = homeIds.includes(play.rebounderId);
    const onAway = awayIds.includes(play.rebounderId);
    if (onHome === onAway) return { error: 'miss_rebound' };
    reboundSide = onHome ? 'home' : 'away';
    if (playerEliminatedBefore(rows, play.rebounderId, reboundSide, cutoff)) return { error: 'miss_eliminated' };
  } else if (unknownRebound) {
    reboundSide = 'away';
  } else if (deadBall === 'lodged') {
    const tip = game.opening_tip_winner;
    if (tip !== 'home' && tip !== 'away') return { error: 'miss_arrow' };
    const lodgedBefore = rows.filter((event) => (
      event.dead_ball === 'lodged' && captureHappenedBefore(event, cutoff)
    )).length;
    lodgedSide = arrowSide(tip, play.periodNumber, lodgedBefore);
  } else if (deadBall !== 'period_end') {
    return { error: 'miss_rebound' };
  }

  const liveRebound = !!play.foulerId && freeThrowNeedsRebound({
    source: 'miss',
    kind: play.foulKind ?? 'personal',
    throws: play.throws,
  });
  if (liveRebound && !reboundSide) return { error: 'miss_rebound' };
  if (play.foulerId && !liveRebound && (play.rebounderId || unknownRebound)) return { error: 'miss_shape' };

  const periodLength = play.periodNumber <= 4 ? 600000 : 300000;
  const groupId = crypto.randomUUID();
  const stored = storedCourtPoint(
    play.coordX,
    play.coordY,
    offenseAttacksRight('home', play.periodNumber, attackRightFirst),
  );
  const clock = play.clockRemainingMs;
  const recordedAt = Date.now();
  let stamp = 0;
  const createdAt = () => new Date(recordedAt + stamp++).toISOString();
  const base = {
    game_id: play.gameId,
    period_number: play.periodNumber,
    clock_remaining_ms: clock,
    elapsed_ms: periodLength - clock,
    play_group_id: groupId,
    recorded_by_user_id: userId,
    possession_before: play.side,
  };
  const playerOf = (id: string, side: CaptureSide) => (
    side === 'home' ? { player_id: id, opponent_player_id: null } : { player_id: null, opponent_player_id: id }
  );

  const inserts: Record<string, unknown>[] = [{
    ...base,
    created_at: createdAt(),
    ...playerOf(play.shooterId, play.side),
    event_type: 'shot',
    points: shotValue,
    made: false,
    coord_x: stored.x,
    coord_y: stored.y,
    is_offensive: true,
    dead_ball: deadBall,
  }];
  if (reboundSide && (play.rebounderId || unknownRebound) && !play.foulerId) {
    inserts.push(reboundRow(base, createdAt(), play.rebounderId, reboundSide, unknownRebound, play.side));
  }
  if (play.foulerId) {
    if (!play.foulKind) return { error: 'miss_foul' };
    const foulKind = play.foulKind;
    inserts.push({
      ...base,
      created_at: createdAt(),
      ...playerOf(play.foulerId, otherSide),
      event_type: 'foul',
      foul_type: foulKind,
      foul_side: otherSide,
      foul_context: 'shot_missed',
      shot_value: shotValue,
      free_throws_awarded: play.throws.length,
      coord_x: stored.x,
      coord_y: stored.y,
      is_offensive: false,
    });
    play.throws.forEach((mark) => {
      const madeThrow = mark === 'made';
      inserts.push({
        ...base,
        created_at: createdAt(),
        ...playerOf(play.shooterId, play.side),
        event_type: 'free_throw',
        points: madeThrow ? 1 : 0,
        made: madeThrow,
        is_offensive: true,
      });
    });
    if (reboundSide && (play.rebounderId || unknownRebound)) {
      inserts.push(reboundRow(base, createdAt(), play.rebounderId, reboundSide, unknownRebound, play.side));
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('game_events')
    .insert(inserts)
    .select('id');
  if (insertError || !inserted?.length) {
    return { error: missErrorCode(insertError?.message ?? 'miss_invalid') };
  }

  let homePoints = 0;
  let awayPoints = 0;
  const addPoints = (side: CaptureSide, points: number) => {
    if (side === 'home') homePoints += points;
    else awayPoints += points;
  };
  play.throws.forEach((mark) => {
    if (mark === 'made') addPoints(play.side, 1);
  });

  const teamScore = (game.team_score ?? 0) + homePoints;
  const opponentScore = (game.opponent_score ?? 0) + awayPoints;
  const lastThrow = play.throws[play.throws.length - 1] ?? null;
  const nextPossession = deadBall === 'lodged'
    ? lodgedSide
    : deadBall === 'period_end'
      ? null
      : missNextPossession({
        shootingSide: play.side,
        reboundSide,
        personal: !!play.foulerId,
        lastThrow,
        foulKind: play.foulKind,
      });
  const patch: {
    team_score: number;
    opponent_score: number;
    possession: CaptureSide | null;
    clock_running?: boolean;
    clock_remaining_ms?: number;
  } = {
    team_score: teamScore,
    opponent_score: opponentScore,
    possession: nextPossession,
  };
  if (!play.backfill && (missStopsClock(!!play.foulerId) || deadBall) && !liveRebound) {
    patch.clock_running = false;
    patch.clock_remaining_ms = clock;
  }

  const moment = gameMomentPatch(play.backfill, patch);
  const { error: updateError } = Object.keys(moment).length
    ? await supabase.from('games').update(moment).eq('id', play.gameId)
    : { error: null };
  if (updateError) {
    await supabase.from('game_events').delete().eq('play_group_id', groupId);
    return { error: 'miss_invalid' };
  }

  return {
    id: inserted[0].id as string,
    groupId,
    possession: nextPossession,
    possessionChanged: !play.backfill,
    teamScore,
    opponentScore,
  };
}

async function commitSubstitution(
  supabase: CaptureClient,
  userId: string,
  play: SubstitutionPlayInput,
  game: { team_id: string; current_period: number | null },
): Promise<PlaySuccess | { error: string }> {
  const swaps = play.swaps;
  const swapIds = swaps.flatMap((swap) => [swap.outId, swap.inId]);
  if (new Set(swapIds).size !== swapIds.length || swaps.some((swap) => swap.outId === swap.inId)) {
    return { error: 'substitution_shape' };
  }
  if (!play.backfill && play.periodNumber !== (game.current_period || 1)) return { error: 'substitution_period' };

  const { data: priorEvents, error: priorError } = await supabase
    .from('game_events')
    .select('*')
    .eq('game_id', play.gameId);
  if (priorError) return { error: 'substitution_invalid' };

  const rows = priorEvents ?? [];
  const eliminated = (id: string, side: CaptureSide) => {
    const fouls = rows.filter((event) => {
      const onPlayer = side === 'home' ? event.player_id === id : event.opponent_player_id === id;
      if (!onPlayer || event.coach_technical_side) return false;
      if (event.event_type === 'foul' && foulCountsForPlayer(event.foul_type)) return true;
      return event.event_type === 'turnover'
        && (event.turnover_type === 'offensive_foul' || event.turnover_type === 'technical')
        && event.turnover_side === side;
    }).length;
    const ejected = rows.some((event) => {
      const onPlayer = side === 'home' ? event.player_id === id : event.opponent_player_id === id;
      return onPlayer
        && !event.coach_technical_side
        && event.event_type === 'foul'
        && (event.foul_type === 'flagrant' || event.foul_type === 'disqualifying');
    });
    return isEliminated(fouls) || ejected;
  };
  if (swaps.some((swap) => eliminated(swap.inId, play.side))) return { error: 'substitution_eliminated' };

  const { data: lineup, error: lineupError } = await supabase
    .from('game_period_lineups')
    .select('side, position_index, player_id, opponent_player_id')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber);
  if (lineupError) return { error: 'substitution_invalid' };

  const starters = (lineup ?? [])
    .filter((row) => row.side === play.side && (play.side === 'home' ? row.player_id : row.opponent_player_id))
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => (play.side === 'home' ? row.player_id : row.opponent_player_id) as string);
  const court = [...onCourtAfterSubs(starters, rows, play.periodNumber, play.side)];
  for (const swap of swaps) {
    const index = court.indexOf(swap.outId);
    if (index === -1) return { error: 'substitution_out' };
    if (court.includes(swap.inId)) return { error: 'substitution_in' };
    court[index] = swap.inId;
  }

  const incoming = swaps.map((swap) => swap.inId);
  if (play.side === 'home') {
    const { data: squadRows, error: squadError } = await supabase
      .from('game_squads')
      .select('player_id')
      .eq('game_id', play.gameId);
    if (squadError) return { error: 'substitution_invalid' };
    const squad = new Set((squadRows ?? []).map((row) => row.player_id as string));
    const { data: roster, error: rosterError } = await supabase
      .from('players')
      .select('id, team_id')
      .in('id', incoming);
    if (rosterError) return { error: 'substitution_invalid' };
    const allowed = new Set(
      (roster ?? [])
        .filter((player) => player.team_id === game.team_id)
        .map((player) => player.id as string),
    );
    const dressed = (id: string) => allowed.has(id) && (squad.size === 0 || squad.has(id));
    if (incoming.some((id) => !dressed(id))) return { error: 'substitution_in' };
  } else {
    const { data: opponents, error: opponentsError } = await supabase
      .from('game_opponent_players')
      .select('id, is_coach')
      .eq('game_id', play.gameId)
      .in('id', incoming);
    if (opponentsError) return { error: 'substitution_invalid' };
    const available = new Set(
      (opponents ?? []).filter((player) => !player.is_coach).map((player) => player.id as string),
    );
    if (incoming.some((id) => !available.has(id))) return { error: 'substitution_in' };
  }

  const periodLength = play.periodNumber <= 4 ? 600000 : 300000;
  const groupId = crypto.randomUUID();
  const { data: inserted, error: insertError } = await supabase
    .from('game_events')
    .insert(swaps.map((swap) => ({
      game_id: play.gameId,
      event_type: 'substitution',
      period_number: play.periodNumber,
      clock_remaining_ms: play.clockRemainingMs,
      elapsed_ms: periodLength - play.clockRemainingMs,
      recorded_by_user_id: userId,
      play_group_id: groupId,
      ...(play.side === 'home'
        ? { player_id: swap.inId, player_out_id: swap.outId }
        : { opponent_player_id: swap.inId, opponent_player_out_id: swap.outId }),
    })))
    .select('id');
  if (insertError || !inserted?.length) {
    return { error: substitutionErrorCode(insertError?.message ?? 'substitution_invalid') };
  }
  return { id: inserted[0].id as string, groupId };
}

async function commitTimeout(
  supabase: CaptureClient,
  userId: string,
  play: TimeoutPlayInput,
  game: { current_period: number | null; status: string | null },
): Promise<PlaySuccess | { error: string }> {
  if (!play.backfill && (game.current_period || 1) !== play.periodNumber) return { error: 'timeout_period' };
  if (game.status === 'final') return { error: 'timeout_final' };
  const periodLength = play.periodNumber <= 4 ? 600000 : 300000;
  if (play.clockRemainingMs > periodLength) return { error: 'timeout_clock' };

  const quota = timeoutWindow(play.periodNumber);
  const { count, error: countError } = await supabase
    .from('game_events')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', play.gameId)
    .eq('event_type', 'timeout')
    .eq('timeout_side', play.side)
    .gte('period_number', quota.from)
    .lte('period_number', quota.to);
  if (countError) return { error: 'timeout_invalid' };
  if ((count ?? 0) >= quota.max) return { error: 'timeout_cap' };

  const { data: inserted, error: insertError } = await supabase
    .from('game_events')
    .insert({
      game_id: play.gameId,
      event_type: 'timeout',
      period_number: play.periodNumber,
      clock_remaining_ms: play.clockRemainingMs,
      elapsed_ms: periodLength - play.clockRemainingMs,
      points: 0,
      timeout_side: play.side,
      recorded_by_user_id: userId,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    return { error: timeoutErrorCode(insertError?.message ?? 'timeout_invalid') };
  }

  if (!play.backfill) {
    const { error: updateError } = await supabase
      .from('games')
      .update({
        clock_running: false,
        clock_remaining_ms: play.clockRemainingMs,
      })
      .eq('id', play.gameId);
    if (updateError) {
      await supabase.from('game_events').delete().eq('id', inserted.id);
      return { error: 'timeout_invalid' };
    }
  }

  return { id: inserted.id as string };
}

function capturePlayName(input: unknown) {
  if (!input || typeof input !== 'object' || !('play' in input)) return null;
  return input.play;
}

export async function commitCapturePlay(
  input: unknown,
): Promise<PlaySuccess | { error: string }> {
  const playName = capturePlayName(input);
  const parsed = commitCapturePlaySchema.safeParse(input);
  if (!parsed.success) {
    if (playName === 'foul') {
      const message = parsed.error.issues.find((issue) => foulErrorCode(issue.message) !== 'foul_invalid')?.message;
      return { error: message ? foulErrorCode(message) : 'foul_invalid' };
    }
    if (playName === 'made') {
      const message = parsed.error.issues.find((issue) => madeErrorCode(issue.message) !== 'made_invalid')?.message;
      return { error: message ? madeErrorCode(message) : 'made_invalid' };
    }
    if (playName === 'miss') {
      const message = parsed.error.issues.find((issue) => missErrorCode(issue.message) !== 'miss_invalid')?.message;
      return { error: message ? missErrorCode(message) : 'miss_invalid' };
    }
    if (playName === 'substitution') return { error: 'substitution_invalid' };
    if (playName === 'timeout') return { error: 'timeout_invalid' };
    return { error: 'turnover_invalid' };
  }

  const slotError = playName === 'foul'
    ? 'foul_slot'
    : playName === 'made'
      ? 'made_slot'
      : playName === 'miss'
        ? 'miss_slot'
        : playName === 'substitution'
          ? 'substitution_slot'
          : playName === 'timeout'
            ? 'timeout_slot'
            : 'turnover_slot';
  const invalidError = playName === 'foul'
    ? 'foul_invalid'
    : playName === 'made'
      ? 'made_invalid'
      : playName === 'miss'
        ? 'miss_invalid'
        : playName === 'substitution'
          ? 'substitution_invalid'
          : playName === 'timeout'
            ? 'timeout_invalid'
            : 'turnover_invalid';

  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return { error: slotError };

  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) return { error: slotError };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => token,
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const play = parsed.data;
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('team_id, possession, current_period, attack_right_first, team_score, opponent_score, status, opening_tip_winner')
    .eq('id', play.gameId)
    .single();

  if (gameError || !game) return { error: invalidError };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('club_id')
    .eq('id', game.team_id)
    .single();
  if (teamError || !team) return { error: invalidError };

  const { data: roles, error: rolesError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('profile_id', user.id);
  if (rolesError || !userManagesClub(roles ?? [], team.club_id)) {
    return { error: slotError };
  }

  if (game.status === 'final') {
    if (play.play === 'foul') return { error: 'foul_final' };
    if (play.play === 'made') return { error: 'made_final' };
    if (play.play === 'miss') return { error: 'miss_final' };
    if (play.play === 'substitution') return { error: 'substitution_final' };
    if (play.play === 'timeout') return { error: 'timeout_final' };
    return { error: 'turnover_final' };
  }

  if (play.play === 'foul') return commitFoul(supabase, user.id, play, game);
  if (play.play === 'made') return commitMade(supabase, user.id, play, game);
  if (play.play === 'miss') return commitMiss(supabase, user.id, play, game);
  if (play.play === 'substitution') return commitSubstitution(supabase, user.id, play, game);
  if (play.play === 'timeout') return commitTimeout(supabase, user.id, play, game);

  if (game.status === 'final') return { error: 'turnover_final' };
  if (!play.backfill && game.possession !== play.side) return { error: 'turnover_possession' };
  if (!play.backfill && (game.current_period || 1) !== play.periodNumber) return { error: 'turnover_period' };

  if (play.play === 'turnover') {
    const cutoff = {
      period_number: play.periodNumber,
      clock_remaining_ms: play.clockRemainingMs,
      created_at: new Date().toISOString(),
    };
    const { data: lineup, error: lineupError } = await supabase
      .from('game_period_lineups')
      .select('side, position_index, player_id, opponent_player_id')
      .eq('game_id', play.gameId)
      .eq('period_number', play.periodNumber);
    if (lineupError) return { error: 'turnover_invalid' };
    const { data: history, error: historyError } = await supabase
      .from('game_events')
      .select('event_type, foul_type, coach_technical_side, player_id, opponent_player_id, player_out_id, opponent_player_out_id, turnover_type, turnover_side, period_number, clock_remaining_ms, created_at')
      .eq('game_id', play.gameId);
    if (historyError) return { error: 'turnover_invalid' };
    const rows = history ?? [];
    const starters = (lineup ?? [])
      .filter((row) => row.side === play.side && (play.side === 'home' ? row.player_id : row.opponent_player_id))
      .sort((a, b) => a.position_index - b.position_index)
      .map((row) => (play.side === 'home' ? row.player_id : row.opponent_player_id) as string);
    const courtIds = onCourtBefore(starters, rows, play.periodNumber, play.side, cutoff);
    if (!courtIds.includes(play.offenderId)) return { error: 'turnover_player' };
    if (playerEliminatedBefore(rows, play.offenderId, play.side, cutoff)) return { error: 'turnover_eliminated' };
  }

  const periodLength = play.periodNumber <= 4 ? 600000 : 300000;
  const otherSide = otherCaptureSide(play.side);
  let playerId: string | null = null;
  let opponentId: string | null = null;
  let coordX: number | null = null;
  let coordY: number | null = null;
  let turnoverType: TurnoverReason | ClockViolation;
  let stopsClock = true;

  if (play.play === 'turnover') {
    playerId = play.side === 'home' ? play.offenderId : null;
    opponentId = play.side === 'away' ? play.offenderId : null;
    coordX = play.coordX;
    coordY = play.coordY;
    turnoverType = play.reason;
    stopsClock = turnoverStopsClock(play.reason);
  } else {
    turnoverType = play.play;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('game_events')
    .insert({
      game_id: play.gameId,
      player_id: playerId,
      opponent_player_id: opponentId,
      event_type: 'turnover',
      period_number: play.periodNumber,
      clock_remaining_ms: play.clockRemainingMs,
      elapsed_ms: periodLength - play.clockRemainingMs,
      coord_x: coordX,
      coord_y: coordY,
      is_offensive: true,
      turnover_type: turnoverType,
      turnover_side: play.side,
      recorded_by_user_id: user.id,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return { error: turnoverErrorCode(insertError?.message ?? 'turnover_invalid') };
  }

  if (!play.backfill) {
    const patch: { possession: CaptureSide; clock_running?: boolean; clock_remaining_ms?: number } = {
      possession: otherSide,
    };
    if (stopsClock) {
      patch.clock_running = false;
      patch.clock_remaining_ms = play.clockRemainingMs;
    }

    const { error: updateError } = await supabase
      .from('games')
      .update(patch)
      .eq('id', play.gameId);

    if (updateError) {
      await supabase.from('game_events').delete().eq('id', inserted.id);
      return { error: 'turnover_invalid' };
    }
  }

  return { id: inserted.id as string };
}

export async function deleteCapturePlay(
  input: unknown,
): Promise<{ teamScore: number; opponentScore: number; openingTipCleared: boolean } | { error: string }> {
  const parsed = deleteCapturePlaySchema.safeParse(input);
  if (!parsed.success) return { error: 'delete_invalid' };

  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return { error: 'delete_slot' };
  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) return { error: 'delete_slot' };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => token,
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { gameId, eventId } = parsed.data;
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('team_id, status')
    .eq('id', gameId)
    .single();
  if (gameError || !game) return { error: 'delete_invalid' };
  if (game.status === 'final') return { error: 'delete_final' };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('club_id')
    .eq('id', game.team_id)
    .single();
  if (teamError || !team) return { error: 'delete_invalid' };

  const { data: roles, error: rolesError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('profile_id', user.id);
  if (rolesError || !userManagesClub(roles ?? [], team.club_id)) return { error: 'delete_slot' };

  const { data: event, error: eventError } = await supabase
    .from('game_events')
    .select('id, play_group_id')
    .eq('id', eventId)
    .eq('game_id', gameId)
    .maybeSingle();
  if (eventError) return { error: 'delete_invalid' };
  if (!event) return { error: 'delete_missing' };

  const removal = event.play_group_id
    ? supabase.from('game_events').delete().eq('game_id', gameId).eq('play_group_id', event.play_group_id)
    : supabase.from('game_events').delete().eq('game_id', gameId).eq('id', event.id);
  const { error: deleteError } = await removal;
  if (deleteError) return { error: 'delete_invalid' };

  const { data: remaining, error: remainingError } = await supabase
    .from('game_events')
    .select('event_type, made, points, player_id, opponent_player_id')
    .eq('game_id', gameId);
  if (remainingError) return { error: 'delete_invalid' };

  const rows = remaining ?? [];
  const score = scoreFromEvents(rows);
  const openingTipCleared = !rows.some((row) => row.event_type === 'jump');
  const patch: { team_score: number; opponent_score: number; opening_tip_winner?: null } = {
    team_score: score.home,
    opponent_score: score.away,
  };
  if (openingTipCleared) patch.opening_tip_winner = null;
  const { error: scoreError } = await supabase.from('games').update(patch).eq('id', gameId);
  if (scoreError) return { error: 'delete_invalid' };

  return { teamScore: score.home, opponentScore: score.away, openingTipCleared };
}

export async function placeMadeShotPoint(
  input: unknown,
): Promise<{
  points: 2 | 3;
  coordX: number;
  coordY: number;
  teamScore: number;
  opponentScore: number;
  playGroupId: string;
  assist: { id: string; playerId: string | null; opponentPlayerId: string | null; createdAt: string } | null;
} | { error: string }> {
  const parsed = placeMadeShotPointSchema.safeParse(input);
  if (!parsed.success) return { error: 'shot_point_invalid' };

  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return { error: 'shot_point_slot' };
  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) return { error: 'shot_point_slot' };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => token,
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { gameId, eventId, coordX, coordY, assistId } = parsed.data;
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('team_id, attack_right_first, team_score, opponent_score')
    .eq('id', gameId)
    .single();
  if (gameError || !game) return { error: 'shot_point_invalid' };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('club_id')
    .eq('id', game.team_id)
    .single();
  const { data: roles, error: rolesError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('profile_id', user.id);
  if (teamError || !team || rolesError || !userManagesClub(roles ?? [], team.club_id)) {
    return { error: 'shot_point_slot' };
  }

  const { data: event, error: eventError } = await supabase
    .from('game_events')
    .select('id, game_id, event_type, made, points, player_id, opponent_player_id, period_number, play_group_id, coord_x, coord_y, clock_remaining_ms, elapsed_ms, created_at, possession_before')
    .eq('id', eventId)
    .eq('game_id', gameId)
    .single();
  if (eventError || !event || event.event_type !== 'shot' || event.made !== true) {
    return { error: 'shot_point_invalid' };
  }

  const side: CaptureSide | null = event.player_id
    ? 'home'
    : event.opponent_player_id
      ? 'away'
      : null;
  if (!side || (event.player_id && event.opponent_player_id)) return { error: 'shot_point_invalid' };

  const attackRightFirst = game.attack_right_first !== false;
  const attacksRight = offenseAttacksRight(side, event.period_number, attackRightFirst);
  if (!shotOnAttackingHalf(coordX, attacksRight)) return { error: 'shot_point_half' };

  const shotValue = shotValueFromWorld(coordX, coordY, attacksRight);
  const inPaint = shotInPaint(coordX, coordY, attacksRight);
  const shooterId = side === 'home' ? event.player_id : event.opponent_player_id;
  if (!shooterId || assistId === shooterId) return { error: 'shot_point_assist' };

  const cutoff = {
    period_number: event.period_number,
    clock_remaining_ms: event.clock_remaining_ms as number,
    created_at: event.created_at as string | null,
  };
  const { data: lineup, error: lineupError } = await supabase
    .from('game_period_lineups')
    .select('side, position_index, player_id, opponent_player_id')
    .eq('game_id', gameId)
    .eq('period_number', event.period_number);
  if (lineupError) return { error: 'shot_point_invalid' };

  const { data: history, error: historyError } = await supabase
    .from('game_events')
    .select('id, event_type, foul_type, coach_technical_side, player_id, opponent_player_id, player_out_id, opponent_player_out_id, turnover_type, turnover_side, period_number, clock_remaining_ms, created_at, play_group_id')
    .eq('game_id', gameId);
  if (historyError) return { error: 'shot_point_invalid' };

  const rows = history ?? [];
  const homeStart = (lineup ?? [])
    .filter((row) => row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayStart = (lineup ?? [])
    .filter((row) => row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);
  const courtIds = side === 'home'
    ? onCourtBefore(homeStart, rows, event.period_number, 'home', cutoff)
    : onCourtBefore(awayStart, rows, event.period_number, 'away', cutoff);
  const mates = courtIds.filter((id) => id !== shooterId && !playerEliminatedBefore(rows, id, side, cutoff));
  if (assistId && !mates.includes(assistId)) return { error: 'shot_point_assist' };
  if (madeAssistRequired(shotValue, inPaint, mates.length) && !assistId) return { error: 'shot_point_assist' };

  const stored = storedCourtPoint(coordX, coordY, offenseAttacksRight('home', event.period_number, attackRightFirst));
  const previousPoints = event.points === 3 ? 3 : 2;
  const playGroupId = (event.play_group_id as string | null) ?? crypto.randomUUID();

  const { error: shotError } = await supabase
    .from('game_events')
    .update({ points: shotValue, coord_x: stored.x, coord_y: stored.y, play_group_id: playGroupId })
    .eq('id', eventId)
    .eq('game_id', gameId);
  if (shotError) return { error: 'shot_point_invalid' };

  const revertShot = async () => {
    await supabase
      .from('game_events')
      .update({
        points: previousPoints,
        coord_x: event.coord_x,
        coord_y: event.coord_y,
        play_group_id: event.play_group_id,
      })
      .eq('id', eventId);
    if (!event.play_group_id) return;
    await supabase
      .from('game_events')
      .update({ shot_value: previousPoints })
      .eq('game_id', gameId)
      .eq('play_group_id', event.play_group_id)
      .eq('event_type', 'foul')
      .eq('foul_context', 'shot_made');
  };

  if (event.play_group_id) {
    const { error: foulError } = await supabase
      .from('game_events')
      .update({ shot_value: shotValue })
      .eq('game_id', gameId)
      .eq('play_group_id', event.play_group_id)
      .eq('event_type', 'foul')
      .eq('foul_context', 'shot_made');
    if (foulError) {
      await revertShot();
      return { error: 'shot_point_invalid' };
    }
  }

  const wantedHome = assistId && side === 'home' ? assistId : null;
  const wantedAway = assistId && side === 'away' ? assistId : null;
  const { data: assistRows, error: assistReadError } = event.play_group_id
    ? await supabase
      .from('game_events')
      .select('*')
      .eq('game_id', gameId)
      .eq('play_group_id', event.play_group_id)
      .eq('event_type', 'assist')
    : { data: [], error: null };
  if (assistReadError) {
    await revertShot();
    return { error: 'shot_point_invalid' };
  }
  const existingAssists = [...(assistRows ?? [])].sort((a, b) => {
    const aAt = String(a.created_at ?? '');
    const bAt = String(b.created_at ?? '');
    if (aAt !== bAt) return aAt < bAt ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
  const primary = existingAssists[0] ?? null;
  const extras = existingAssists.slice(1);
  const unchanged = !!primary
    && extras.length === 0
    && (primary.player_id ?? null) === wantedHome
    && (primary.opponent_player_id ?? null) === wantedAway;

  let assistOut: { id: string; playerId: string | null; opponentPlayerId: string | null; createdAt: string } | null = unchanged && primary
    ? {
      id: primary.id as string,
      playerId: wantedHome,
      opponentPlayerId: wantedAway,
      createdAt: String(primary.created_at),
    }
    : null;
  const deleted: typeof existingAssists = [];
  let insertedId: string | null = null;
  let updatedPrimary = false;

  async function undoAssist() {
    if (insertedId) await supabase.from('game_events').delete().eq('id', insertedId);
    if (updatedPrimary && primary) {
      await supabase
        .from('game_events')
        .update({ player_id: primary.player_id, opponent_player_id: primary.opponent_player_id })
        .eq('id', primary.id);
    }
    if (deleted.length) await supabase.from('game_events').insert(deleted);
  }

  if (!unchanged) {
    if (extras.length) {
      const { error: extraError } = await supabase
        .from('game_events')
        .delete()
        .in('id', extras.map((row) => row.id as string));
      if (extraError) {
        await revertShot();
        return { error: 'shot_point_invalid' };
      }
      deleted.push(...extras);
    }
    if (!assistId && primary) {
      const { error: deleteError } = await supabase.from('game_events').delete().eq('id', primary.id);
      if (deleteError) {
        await undoAssist();
        await revertShot();
        return { error: 'shot_point_invalid' };
      }
      deleted.push(primary);
      assistOut = null;
    } else if (assistId && primary) {
      const { error: updateError } = await supabase
        .from('game_events')
        .update({ player_id: wantedHome, opponent_player_id: wantedAway })
        .eq('id', primary.id);
      if (updateError) {
        await undoAssist();
        await revertShot();
        return { error: 'shot_point_invalid' };
      }
      updatedPrimary = true;
      assistOut = {
        id: primary.id as string,
        playerId: wantedHome,
        opponentPlayerId: wantedAway,
        createdAt: String(primary.created_at),
      };
    } else if (assistId) {
      const recordedAt = event.created_at ? new Date(event.created_at as string).getTime() + 1 : Date.now();
      const { data: inserted, error: insertError } = await supabase
        .from('game_events')
        .insert({
          game_id: gameId,
          period_number: event.period_number,
          clock_remaining_ms: event.clock_remaining_ms,
          elapsed_ms: event.elapsed_ms,
          play_group_id: playGroupId,
          recorded_by_user_id: user.id,
          possession_before: event.possession_before ?? side,
          created_at: new Date(recordedAt).toISOString(),
          player_id: wantedHome,
          opponent_player_id: wantedAway,
          event_type: 'assist',
          points: 0,
          is_offensive: true,
        })
        .select('id, created_at, player_id, opponent_player_id')
        .single();
      if (insertError || !inserted) {
        await undoAssist();
        await revertShot();
        return { error: 'shot_point_invalid' };
      }
      insertedId = inserted.id as string;
      assistOut = {
        id: inserted.id as string,
        playerId: (inserted.player_id as string | null) ?? null,
        opponentPlayerId: (inserted.opponent_player_id as string | null) ?? null,
        createdAt: String(inserted.created_at),
      };
    }
  }

  const delta = shotValue - previousPoints;
  let teamScore = game.team_score ?? 0;
  let opponentScore = game.opponent_score ?? 0;
  if (delta !== 0) {
    if (side === 'home') teamScore += delta;
    else opponentScore += delta;
    const { error: scoreError } = await supabase
      .from('games')
      .update({ team_score: teamScore, opponent_score: opponentScore })
      .eq('id', gameId);
    if (scoreError) {
      await undoAssist();
      await revertShot();
      return { error: 'shot_point_invalid' };
    }
  }

  return {
    points: shotValue,
    coordX: stored.x,
    coordY: stored.y,
    teamScore,
    opponentScore,
    playGroupId,
    assist: assistOut,
  };
}

export async function editJump(
  input: unknown,
): Promise<{
  jumpWon: boolean;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  openingTipWinner?: 'home' | 'away';
  possession?: 'home' | 'away';
} | { error: string }> {
  const parsed = editJumpSchema.safeParse(input);
  if (!parsed.success) {
    const needBoth = parsed.error.issues.some((issue) => issue.message === 'jump_need_both');
    return { error: needBoth ? 'jump_need_both' : 'jump_invalid' };
  }

  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return { error: 'jump_slot' };
  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) return { error: 'jump_slot' };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => token,
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { gameId, eventId, jumpWon, homePlayerId, awayPlayerId } = parsed.data;
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('team_id')
    .eq('id', gameId)
    .single();
  if (gameError || !game) return { error: 'jump_invalid' };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('club_id')
    .eq('id', game.team_id)
    .single();
  const { data: roles, error: rolesError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('profile_id', user.id);
  if (teamError || !team || rolesError || !userManagesClub(roles ?? [], team.club_id)) {
    return { error: 'jump_slot' };
  }

  const { data: event, error: eventError } = await supabase
    .from('game_events')
    .select('id, event_type, jump_side, jump_won, jump_home_player_id, jump_away_player_id')
    .eq('id', eventId)
    .eq('game_id', gameId)
    .single();
  if (eventError || !event || event.event_type !== 'jump') return { error: 'jump_invalid' };
  const side: CaptureSide | null = event.jump_side === 'home' || event.jump_side === 'away'
    ? event.jump_side
    : null;
  if (!side) return { error: 'jump_invalid' };

  const { data: jumps, error: jumpsError } = await supabase
    .from('game_events')
    .select('id, period_number, clock_remaining_ms, created_at')
    .eq('game_id', gameId)
    .eq('event_type', 'jump');
  if (jumpsError || !jumps?.length) return { error: 'jump_invalid' };
  const ordered = [...jumps].sort((a, b) => {
    if (a.period_number !== b.period_number) return a.period_number - b.period_number;
    if (a.clock_remaining_ms !== b.clock_remaining_ms) return b.clock_remaining_ms - a.clock_remaining_ms;
    if (a.created_at < b.created_at) return -1;
    if (a.created_at > b.created_at) return 1;
    return 0;
  });
  const earliest = ordered[0];
  const latest = ordered[ordered.length - 1];
  if (!ordered.some((jump) => jump.id === eventId)) return { error: 'jump_invalid' };

  const winner: CaptureSide = jumpWon ? side : otherCaptureSide(side);
  const previous = {
    jump_won: event.jump_won,
    jump_home_player_id: event.jump_home_player_id,
    jump_away_player_id: event.jump_away_player_id,
  };
  const { error: updateError } = await supabase
    .from('game_events')
    .update({
      jump_won: jumpWon,
      jump_home_player_id: homePlayerId,
      jump_away_player_id: awayPlayerId,
    })
    .eq('id', eventId)
    .eq('game_id', gameId);
  if (updateError) return { error: 'jump_invalid' };

  const patch: { opening_tip_winner?: CaptureSide; possession?: CaptureSide } = {};
  if (eventId === earliest.id) patch.opening_tip_winner = winner;
  if (eventId === latest.id) patch.possession = winner;
  if (patch.opening_tip_winner || patch.possession) {
    const { error: gameUpdateError } = await supabase.from('games').update(patch).eq('id', gameId);
    if (gameUpdateError) {
      await supabase.from('game_events').update(previous).eq('id', eventId).eq('game_id', gameId);
      return { error: 'jump_invalid' };
    }
  }

  return {
    jumpWon,
    homePlayerId,
    awayPlayerId,
    ...(patch.opening_tip_winner ? { openingTipWinner: patch.opening_tip_winner } : {}),
    ...(patch.possession ? { possession: patch.possession } : {}),
  };
}

export async function editFoulReceived(
  input: unknown,
): Promise<{ homePlayerId: string | null; awayPlayerId: string | null } | { error: string }> {
  const parsed = editFoulReceivedSchema.safeParse(input);
  if (!parsed.success) return { error: 'foul_received_invalid' };

  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return { error: 'foul_received_slot' };
  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) return { error: 'foul_received_slot' };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => token,
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { gameId, eventId, playerId } = parsed.data;
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('team_id')
    .eq('id', gameId)
    .single();
  if (gameError || !game) return { error: 'foul_received_invalid' };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('club_id')
    .eq('id', game.team_id)
    .single();
  const { data: roles, error: rolesError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('profile_id', user.id);
  if (teamError || !team || rolesError || !userManagesClub(roles ?? [], team.club_id)) {
    return { error: 'foul_received_slot' };
  }

  const { data: event, error: eventError } = await supabase
    .from('game_events')
    .select('id, event_type, foul_side')
    .eq('id', eventId)
    .eq('game_id', gameId)
    .single();
  const side: CaptureSide | null = event?.foul_side === 'home' || event?.foul_side === 'away'
    ? event.foul_side
    : null;
  if (eventError || !event || event.event_type !== 'foul' || !side) return { error: 'foul_received_invalid' };

  let homePlayerId: string | null = null;
  let awayPlayerId: string | null = null;
  if (playerId) {
    if (side === 'home') {
      const { data: opponent, error: opponentError } = await supabase
        .from('game_opponent_players')
        .select('id')
        .eq('id', playerId)
        .eq('game_id', gameId)
        .eq('is_coach', false)
        .maybeSingle();
      if (opponentError || !opponent) return { error: 'foul_received_invalid' };
      awayPlayerId = playerId;
    } else {
      const { data: dressed, error: dressedError } = await supabase
        .from('game_squads')
        .select('player_id')
        .eq('game_id', gameId)
        .eq('player_id', playerId)
        .maybeSingle();
      if (dressedError || !dressed) return { error: 'foul_received_invalid' };
      homePlayerId = playerId;
    }
  }

  const { error: updateError } = await supabase
    .from('game_events')
    .update({
      foul_received_player_id: homePlayerId,
      foul_received_opponent_player_id: awayPlayerId,
    })
    .eq('id', eventId)
    .eq('game_id', gameId);
  if (updateError) return { error: 'foul_received_invalid' };

  return { homePlayerId, awayPlayerId };
}
