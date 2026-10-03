'use server';

import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { userManagesClub } from '@/lib/live-access';
import { isEliminated } from '@/lib/period-lineup';
import {
  clockViolationCountsAsTeamFoul,
  commitCapturePlaySchema,
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
import { missNextPossession, missStopsClock, reboundIsOffensive } from '@/lib/capture/miss';
import { onCourtAfterSubs } from '@/lib/capture/substitutions';
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
  if (play.periodNumber !== (game.current_period || 1)) return { error: 'foul_period' };
  if (game.possession !== 'home' && game.possession !== 'away') return { error: 'foul_possession' };
  const possession = game.possession;
  if (play.context === 'offensive' && possession !== play.side) return { error: 'foul_shape' };
  if (play.kind === 'personal' && play.context !== 'offensive' && possession === play.side) {
    return { error: 'foul_shape' };
  }
  if (play.context === 'shot_made' || play.context === 'shot_missed') return { error: 'foul_shape' };

  const otherSide = otherCaptureSide(play.side);
  const attackRightFirst = game.attack_right_first !== false;

  const { data: priorEvents, error: priorError } = await supabase
    .from('game_events')
    .select('event_type, foul_type, foul_side, coach_technical_side, player_id, opponent_player_id, turnover_type, turnover_side, period_number')
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
  if (allowance === 0) {
    if (play.throws.length !== 0) return { error: 'foul_shape' };
  } else if (play.throws.length < 1 || play.throws.length > 3) {
    return { error: 'foul_shape' };
  }

  const charged = (id: string, side: CaptureSide) => {
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
        && event.event_type === 'foul'
        && (event.foul_type === 'flagrant' || event.foul_type === 'disqualifying');
    });
    return isEliminated(fouls) || ejected;
  };

  if (play.offenderId && charged(play.offenderId, play.side)) return { error: 'foul_eliminated' };
  if (play.otherId && play.kind !== 'double' && charged(play.otherId, otherSide)) return { error: 'foul_eliminated' };
  if (play.kind === 'double' && play.otherId && charged(play.otherId, otherSide)) return { error: 'foul_eliminated' };

  const { data: lineup, error: lineupError } = await supabase
    .from('game_period_lineups')
    .select('side, position_index, player_id, opponent_player_id')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber);
  if (lineupError) return { error: 'foul_invalid' };

  const { data: subs, error: subsError } = await supabase
    .from('game_events')
    .select('*')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber)
    .eq('event_type', 'substitution');
  if (subsError) return { error: 'foul_invalid' };

  const homeStart = (lineup ?? [])
    .filter((row) => row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayStart = (lineup ?? [])
    .filter((row) => row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);
  const homeIds = onCourtAfterSubs(homeStart, subs ?? [], play.periodNumber, 'home');
  const awayIds = onCourtAfterSubs(awayStart, subs ?? [], play.periodNumber, 'away');

  const onCourt = (id: string, side: CaptureSide) => (side === 'home' ? homeIds : awayIds).includes(id);
  if (play.offenderId && !onCourt(play.offenderId, play.side)) return { error: 'foul_player' };
  if (play.otherId && !onCourt(play.otherId, otherSide)) return { error: 'foul_victim' };

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
  const lastThrow = play.throws[play.throws.length - 1];
  let nextPossession: CaptureSide | null = possession;
  let possessionChanged = false;
  if (play.kind === 'technical' || play.kind === 'double') {
    nextPossession = possession;
  } else if (play.context === 'offensive' || play.kind !== 'personal') {
    nextPossession = otherSide;
    possessionChanged = true;
  } else if (play.context === 'no_shot' && play.throws.length === 0) {
    nextPossession = otherSide;
    possessionChanged = true;
  } else if (lastThrow === 'made') {
    nextPossession = play.side;
    possessionChanged = true;
  } else {
    nextPossession = null;
    possessionChanged = true;
  }

  const patch: {
    clock_running: boolean;
    clock_remaining_ms: number;
    team_score: number;
    opponent_score: number;
    possession?: CaptureSide | null;
  } = {
    clock_running: false,
    clock_remaining_ms: clock,
    team_score: teamScore,
    opponent_score: opponentScore,
  };
  if (possessionChanged) patch.possession = nextPossession;

  const { error: updateError } = await supabase.from('games').update(patch).eq('id', play.gameId);
  if (updateError) {
    await supabase.from('game_events').delete().eq('play_group_id', groupId);
    return { error: 'foul_invalid' };
  }

  return {
    id: inserted[0].id as string,
    groupId,
    possession: nextPossession,
    possessionChanged,
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
  if (play.periodNumber !== (game.current_period || 1)) return { error: 'made_period' };
  if (game.possession !== play.side) return { error: 'made_possession' };

  const attackRightFirst = game.attack_right_first !== false;
  const attacksRight = offenseAttacksRight(play.side, play.periodNumber, attackRightFirst);
  if (!shotOnAttackingHalf(play.coordX, attacksRight)) return { error: 'made_half' };
  const shotValue = shotValueFromWorld(play.coordX, play.coordY, attacksRight);
  const inPaint = shotInPaint(play.coordX, play.coordY, attacksRight);
  const otherSide = otherCaptureSide(play.side);

  const { data: priorEvents, error: priorError } = await supabase
    .from('game_events')
    .select('event_type, foul_type, coach_technical_side, player_id, opponent_player_id, turnover_type, turnover_side')
    .eq('game_id', play.gameId);
  if (priorError) return { error: 'made_invalid' };

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
  if (eliminated(play.shooterId, play.side)) return { error: 'made_eliminated' };
  if (play.assistId && eliminated(play.assistId, play.side)) return { error: 'made_eliminated' };
  if (play.foulerId && eliminated(play.foulerId, otherSide)) return { error: 'made_eliminated' };

  const { data: lineup, error: lineupError } = await supabase
    .from('game_period_lineups')
    .select('side, position_index, player_id, opponent_player_id')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber);
  if (lineupError) return { error: 'made_invalid' };

  const { data: subs, error: subsError } = await supabase
    .from('game_events')
    .select('*')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber)
    .eq('event_type', 'substitution');
  if (subsError) return { error: 'made_invalid' };

  const homeStart = (lineup ?? [])
    .filter((row) => row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayStart = (lineup ?? [])
    .filter((row) => row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);
  const homeIds = onCourtAfterSubs(homeStart, subs ?? [], play.periodNumber, 'home');
  const awayIds = onCourtAfterSubs(awayStart, subs ?? [], play.periodNumber, 'away');
  const onCourt = (id: string, side: CaptureSide) => (side === 'home' ? homeIds : awayIds).includes(id);
  if (!onCourt(play.shooterId, play.side)) return { error: 'made_player' };
  const teammates = (play.side === 'home' ? homeIds : awayIds).filter((id) => id !== play.shooterId);
  if (play.assistId && !teammates.includes(play.assistId)) return { error: 'made_assist' };
  const availableMates = teammates.filter((id) => !eliminated(id, play.side));
  if (madeAssistRequired(shotValue, inPaint, availableMates.length) && !play.assistId) return { error: 'made_assist' };
  if (play.foulerId && !onCourt(play.foulerId, otherSide)) return { error: 'made_foul' };

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
    inserts.push({
      ...base,
      created_at: createdAt(),
      ...playerOf(play.foulerId, otherSide),
      event_type: 'foul',
      foul_type: 'personal',
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
  const lastThrow = play.throws[play.throws.length - 1];
  const nextPossession: CaptureSide | null = play.foulerId && lastThrow !== 'made'
    ? null
    : otherSide;
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
  if (madeStopsClock(!!play.foulerId)) {
    patch.clock_running = false;
    patch.clock_remaining_ms = clock;
  }

  const { error: updateError } = await supabase
    .from('games')
    .update(patch)
    .eq('id', play.gameId);
  if (updateError) {
    await supabase.from('game_events').delete().eq('play_group_id', groupId);
    return { error: 'made_invalid' };
  }

  return {
    id: inserted[0].id as string,
    groupId,
    possession: nextPossession,
    possessionChanged: true,
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
  },
): Promise<PlaySuccess | { error: string }> {
  if (game.status === 'final') return { error: 'miss_final' };
  if (play.periodNumber !== (game.current_period || 1)) return { error: 'miss_period' };
  if (game.possession !== play.side) return { error: 'miss_possession' };

  const attackRightFirst = game.attack_right_first !== false;
  const attacksRight = offenseAttacksRight(play.side, play.periodNumber, attackRightFirst);
  if (!shotOnAttackingHalf(play.coordX, attacksRight)) return { error: 'miss_half' };
  const shotValue = shotValueFromWorld(play.coordX, play.coordY, attacksRight);
  const otherSide = otherCaptureSide(play.side);

  const { data: priorEvents, error: priorError } = await supabase
    .from('game_events')
    .select('event_type, foul_type, coach_technical_side, player_id, opponent_player_id, turnover_type, turnover_side')
    .eq('game_id', play.gameId);
  if (priorError) return { error: 'miss_invalid' };

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
  if (eliminated(play.shooterId, play.side)) return { error: 'miss_eliminated' };
  if (play.foulerId && eliminated(play.foulerId, otherSide)) return { error: 'miss_eliminated' };

  const { data: lineup, error: lineupError } = await supabase
    .from('game_period_lineups')
    .select('side, position_index, player_id, opponent_player_id')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber);
  if (lineupError) return { error: 'miss_invalid' };

  const { data: subs, error: subsError } = await supabase
    .from('game_events')
    .select('*')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber)
    .eq('event_type', 'substitution');
  if (subsError) return { error: 'miss_invalid' };

  const homeStart = (lineup ?? [])
    .filter((row) => row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayStart = (lineup ?? [])
    .filter((row) => row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);
  const homeIds = onCourtAfterSubs(homeStart, subs ?? [], play.periodNumber, 'home');
  const awayIds = onCourtAfterSubs(awayStart, subs ?? [], play.periodNumber, 'away');
  const onCourt = (id: string, side: CaptureSide) => (side === 'home' ? homeIds : awayIds).includes(id);
  if (!onCourt(play.shooterId, play.side)) return { error: 'miss_player' };

  let reboundSide: CaptureSide | null = null;
  if (play.foulerId) {
    if (!onCourt(play.foulerId, otherSide)) return { error: 'miss_foul' };
  } else if (play.rebounderId) {
    const onHome = homeIds.includes(play.rebounderId);
    const onAway = awayIds.includes(play.rebounderId);
    if (onHome === onAway) return { error: 'miss_rebound' };
    reboundSide = onHome ? 'home' : 'away';
    if (eliminated(play.rebounderId, reboundSide)) return { error: 'miss_eliminated' };
  } else {
    return { error: 'miss_rebound' };
  }

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
  }];
  if (play.rebounderId && reboundSide) {
    inserts.push({
      ...base,
      created_at: createdAt(),
      ...playerOf(play.rebounderId, reboundSide),
      event_type: 'rebound',
      points: 0,
      is_offensive: reboundIsOffensive(play.side, reboundSide),
    });
  }
  if (play.foulerId) {
    inserts.push({
      ...base,
      created_at: createdAt(),
      ...playerOf(play.foulerId, otherSide),
      event_type: 'foul',
      foul_type: 'personal',
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
  const nextPossession = missNextPossession({
    shootingSide: play.side,
    reboundSide,
    personal: !!play.foulerId,
    lastThrow,
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
  if (missStopsClock(!!play.foulerId)) {
    patch.clock_running = false;
    patch.clock_remaining_ms = clock;
  }

  const { error: updateError } = await supabase
    .from('games')
    .update(patch)
    .eq('id', play.gameId);
  if (updateError) {
    await supabase.from('game_events').delete().eq('play_group_id', groupId);
    return { error: 'miss_invalid' };
  }

  return {
    id: inserted[0].id as string,
    groupId,
    possession: nextPossession,
    possessionChanged: true,
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
  if (play.periodNumber !== (game.current_period || 1)) return { error: 'substitution_period' };

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
  if ((game.current_period || 1) !== play.periodNumber) return { error: 'timeout_period' };
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
    .select('team_id, possession, current_period, attack_right_first, team_score, opponent_score, status')
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

  if (play.play === 'foul') return commitFoul(supabase, user.id, play, game);
  if (play.play === 'made') return commitMade(supabase, user.id, play, game);
  if (play.play === 'miss') return commitMiss(supabase, user.id, play, game);
  if (play.play === 'substitution') return commitSubstitution(supabase, user.id, play, game);
  if (play.play === 'timeout') return commitTimeout(supabase, user.id, play, game);

  if (game.possession !== play.side) return { error: 'turnover_possession' };
  if ((game.current_period || 1) !== play.periodNumber) return { error: 'turnover_period' };

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

  return { id: inserted.id as string };
}
