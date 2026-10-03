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
