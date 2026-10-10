/**
 * Points scored in each period, home–away, through the period now on the clock.
 * A later period appears only after a made basket is recorded there.
 */

export interface PartialEvent {
  event_type: string;
  made?: boolean | null;
  points?: number | null;
  period_number?: number | null;
  player_id?: string | null;
  opponent_player_id?: string | null;
}

export interface PeriodPartial {
  period: number;
  home: number;
  away: number;
}

export function periodPartials(events: readonly PartialEvent[], currentPeriod: number): PeriodPartial[] {
  const scores = new Map<number, PeriodPartial>();
  let through = Math.max(1, currentPeriod || 1);

  for (const event of events) {
    const period = event.period_number;
    if (period == null || period < 1) continue;
    if (event.event_type !== 'shot' && event.event_type !== 'free_throw') continue;
    if (event.made !== true) continue;
    const points = event.points ?? 0;
    if (points <= 0) continue;
    const home = !!event.player_id;
    const away = !!event.opponent_player_id;
    if (home === away) continue;

    if (period > through) through = period;
    const row = scores.get(period) ?? { period, home: 0, away: 0 };
    if (home) row.home += points;
    else row.away += points;
    scores.set(period, row);
  }

  const rows: PeriodPartial[] = [];
  for (let period = 1; period <= through; period += 1) {
    rows.push(scores.get(period) ?? { period, home: 0, away: 0 });
  }
  return rows;
}
