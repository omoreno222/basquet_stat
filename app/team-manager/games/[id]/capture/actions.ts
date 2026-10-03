'use server';

import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { userManagesClub } from '@/lib/live-access';
import { isEliminated } from '@/lib/period-lineup';
import {
  commitCapturePlaySchema,
  foulCountsForPlayer,
  foulCountsForTeam,
  foulErrorCode,
  foulFreeThrowCount,
  offenseAttacksRight,
  otherCaptureSide,
  shotValueFromWorld,
  storedCourtPoint,
  turnoverErrorCode,
  turnoverStopsClock,
  type CaptureSide,
  type ClockViolation,
  type FoulPlayInput,
  type TurnoverReason,
} from '@/lib/capture/plays';

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

  const otherSide = otherCaptureSide(play.side);
  const attackRightFirst = game.attack_right_first !== false;
  const shotValue = play.context === 'shot_made' || play.context === 'shot_missed'
    ? shotValueFromWorld(
      play.coordX ?? 0,
      play.coordY ?? 0,
      offenseAttacksRight(otherSide, play.periodNumber, attackRightFirst),
    )
    : null;

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
      && (event.turnover_type === 'offensive_foul' || event.turnover_type === 'technical')
      && event.turnover_side === play.side;
  }).length;

  const expectedThrows = foulFreeThrowCount({
    kind: play.kind,
    context: play.context,
    shotValue,
    teamFoulsBefore,
  });
  if (play.throws.length !== expectedThrows) return { error: 'foul_shape' };

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
    .select('player_id, player_out_id, clock_remaining_ms, created_at')
    .eq('game_id', play.gameId)
    .eq('period_number', play.periodNumber)
    .eq('event_type', 'substitution');
  if (subsError) return { error: 'foul_invalid' };

  const homeIds = (lineup ?? [])
    .filter((row) => row.side === 'home' && row.player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.player_id as string);
  const awayIds = (lineup ?? [])
    .filter((row) => row.side === 'away' && row.opponent_player_id)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => row.opponent_player_id as string);
  const orderedSubs = [...(subs ?? [])].sort((a, b) => {
    if (a.clock_remaining_ms !== b.clock_remaining_ms) return b.clock_remaining_ms - a.clock_remaining_ms;
    if (a.created_at && b.created_at && a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return 0;
  });
  for (const sub of orderedSubs) {
    if (!sub.player_id || !sub.player_out_id) continue;
    const index = homeIds.indexOf(sub.player_out_id);
    if (index !== -1) homeIds[index] = sub.player_id;
  }

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
  if (shotValue && play.otherId && (play.context === 'shot_made' || play.context === 'shot_missed')) {
    const made = play.context === 'shot_made';
    inserts.push({
      ...base,
      ...playerOf(play.otherId, otherSide),
      event_type: 'shot',
      points: made ? shotValue : 0,
      made,
      coord_x: stored?.x ?? null,
      coord_y: stored?.y ?? null,
      is_offensive: true,
    });
  }

  const foulRow = {
    ...base,
    event_type: 'foul',
    foul_type: play.kind,
    foul_side: play.side,
    foul_context: play.context,
    shot_value: shotValue,
    free_throws_awarded: expectedThrows,
    possession_before: possession,
    coord_x: stored?.x ?? null,
    coord_y: stored?.y ?? null,
    is_offensive: play.context === 'offensive',
    coach_technical_side: play.coach ? play.side : null,
    ...(play.coach || !play.offenderId
      ? { player_id: null, opponent_player_id: null }
      : playerOf(play.offenderId, play.side)),
  };
  inserts.push(foulRow);
  if (play.kind === 'double' && play.otherId) {
    inserts.push({
      ...foulRow,
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
  if (shotValue && play.context === 'shot_made') addPoints(otherSide, shotValue);
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
  } else if (play.context === 'no_shot' && expectedThrows === 0) {
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

export async function commitCapturePlay(
  input: unknown,
): Promise<PlaySuccess | { error: string }> {
  const foulAttempt = !!input && typeof input === 'object' && 'play' in input && input.play === 'foul';
  const parsed = commitCapturePlaySchema.safeParse(input);
  if (!parsed.success) {
    if (!foulAttempt) return { error: 'turnover_invalid' };
    const message = parsed.error.issues.find((issue) => foulErrorCode(issue.message) !== 'foul_invalid')?.message;
    return { error: message ? foulErrorCode(message) : 'foul_invalid' };
  }

  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return { error: foulAttempt ? 'foul_slot' : 'turnover_slot' };

  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) return { error: foulAttempt ? 'foul_slot' : 'turnover_slot' };

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
    .select('team_id, possession, current_period, attack_right_first, team_score, opponent_score')
    .eq('id', play.gameId)
    .single();

  if (gameError || !game) return { error: foulAttempt ? 'foul_invalid' : 'turnover_invalid' };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('club_id')
    .eq('id', game.team_id)
    .single();
  if (teamError || !team) return { error: foulAttempt ? 'foul_invalid' : 'turnover_invalid' };

  const { data: roles, error: rolesError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('profile_id', user.id);
  if (rolesError || !userManagesClub(roles ?? [], team.club_id)) {
    return { error: foulAttempt ? 'foul_slot' : 'turnover_slot' };
  }

  if (play.play === 'foul') return commitFoul(supabase, user.id, play, game);

  if (game.possession && game.possession !== play.side) return { error: 'turnover_possession' };
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
