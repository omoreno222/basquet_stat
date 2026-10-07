import { foulCountsForPlayer } from '@/lib/capture/plays';
import { isEliminated } from '@/lib/period-lineup';

export interface SubstitutionEvent {
  event_type: string;
  period_number: number;
  clock_remaining_ms: number;
  created_at?: string | null;
  player_id?: string | null;
  player_out_id?: string | null;
  opponent_player_id?: string | null;
  opponent_player_out_id?: string | null;
}

/** A moment in the log. More clock remaining is earlier in the same period. */
export interface CaptureInstant {
  period_number: number;
  clock_remaining_ms: number;
  created_at?: string | null;
}

export interface FoulClockEvent extends CaptureInstant {
  event_type: string;
  foul_type?: string | null;
  coach_technical_side?: string | null;
  player_id?: string | null;
  opponent_player_id?: string | null;
  turnover_type?: string | null;
  turnover_side?: string | null;
}

/** True when `event` is earlier in the game than `cutoff`. The cutoff itself is excluded. */
export function captureHappenedBefore(event: CaptureInstant, cutoff: CaptureInstant): boolean {
  if (event.period_number !== cutoff.period_number) return event.period_number < cutoff.period_number;
  if (event.clock_remaining_ms !== cutoff.clock_remaining_ms) {
    return event.clock_remaining_ms > cutoff.clock_remaining_ms;
  }
  const eventAt = event.created_at ?? '';
  const cutoffAt = cutoff.created_at ?? '';
  if (eventAt && cutoffAt && eventAt !== cutoffAt) return eventAt < cutoffAt;
  return false;
}

function substitutionPair(event: SubstitutionEvent, side: 'home' | 'away') {
  if (event.event_type !== 'substitution') return null;
  if (side === 'home') {
    if (!event.player_id || !event.player_out_id) return null;
    return { outId: event.player_out_id, inId: event.player_id };
  }
  if (!event.opponent_player_id || !event.opponent_player_out_id) return null;
  return { outId: event.opponent_player_out_id, inId: event.opponent_player_id };
}

/** Starters plus substitutions in the period, earlier clock first. */
export function onCourtAfterSubs(
  startingIds: string[],
  events: SubstitutionEvent[],
  period: number,
  side: 'home' | 'away',
): string[] {
  const subs = events
    .filter((event) => event.period_number === period && substitutionPair(event, side))
    .sort((a, b) => {
      if (a.clock_remaining_ms !== b.clock_remaining_ms) {
        return b.clock_remaining_ms - a.clock_remaining_ms;
      }
      if (a.created_at && b.created_at && a.created_at !== b.created_at) {
        return a.created_at < b.created_at ? -1 : 1;
      }
      return 0;
    });

  const lineup = [...startingIds];
  for (const event of subs) {
    const pair = substitutionPair(event, side);
    if (!pair) continue;
    const index = lineup.indexOf(pair.outId);
    if (index !== -1) lineup[index] = pair.inId;
  }
  return lineup;
}

/** Starters plus substitutions that happened before this play, not after it. */
export function onCourtBefore(
  startingIds: string[],
  events: SubstitutionEvent[],
  period: number,
  side: 'home' | 'away',
  cutoff: CaptureInstant,
): string[] {
  return onCourtAfterSubs(
    startingIds,
    events.filter((event) => captureHappenedBefore(event, cutoff)),
    period,
    side,
  );
}

/** Fouled out or ejected by a flagrant or disqualifying foul recorded before this play. */
export function playerEliminatedBefore(
  events: FoulClockEvent[],
  playerId: string,
  side: 'home' | 'away',
  cutoff: CaptureInstant,
): boolean {
  const prior = events.filter((event) => captureHappenedBefore(event, cutoff));
  const fouls = prior.filter((event) => {
    const onPlayer = side === 'home' ? event.player_id === playerId : event.opponent_player_id === playerId;
    if (!onPlayer || event.coach_technical_side) return false;
    if (event.event_type === 'foul' && foulCountsForPlayer(event.foul_type)) return true;
    return event.event_type === 'turnover'
      && (event.turnover_type === 'offensive_foul' || event.turnover_type === 'technical')
      && event.turnover_side === side;
  }).length;
  const ejected = prior.some((event) => {
    const onPlayer = side === 'home' ? event.player_id === playerId : event.opponent_player_id === playerId;
    return onPlayer
      && !event.coach_technical_side
      && event.event_type === 'foul'
      && (event.foul_type === 'flagrant' || event.foul_type === 'disqualifying');
  });
  return isEliminated(fouls) || ejected;
}
