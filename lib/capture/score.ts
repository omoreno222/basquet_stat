/** Points already stored on made shots and made free throws. */
export interface ScoringEvent {
  event_type: string;
  made?: boolean | null;
  points?: number | null;
  player_id?: string | null;
  opponent_player_id?: string | null;
}

/** Running score from the event log. A home player scores for the team; an opponent player scores for the other side. */
export function scoreFromEvents(events: ScoringEvent[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const event of events) {
    const scoring = (event.event_type === 'shot' || event.event_type === 'free_throw')
      && event.made
      && event.points;
    if (!scoring || !event.points) continue;
    if (event.player_id) home += event.points;
    else if (event.opponent_player_id) away += event.points;
  }
  return { home, away };
}
