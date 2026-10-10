import { describe, expect, it } from 'vitest';
import { periodPartials, type PartialEvent } from './period-partials';

function made(period: number, side: 'home' | 'away', points: number, type: 'shot' | 'free_throw' = 'shot'): PartialEvent {
  return {
    event_type: type,
    made: true,
    points,
    period_number: period,
    player_id: side === 'home' ? 'home-player' : null,
    opponent_player_id: side === 'away' ? 'away-player' : null,
  };
}

describe('periodPartials', () => {
  it('sums made baskets by period and keeps the live quarter even at 0–0', () => {
    const rows = periodPartials([
      made(1, 'home', 3),
      made(1, 'away', 2),
      { ...made(1, 'home', 2), made: false },
      made(1, 'away', 1, 'free_throw'),
    ], 2);

    expect(rows).toEqual([
      { period: 1, home: 3, away: 3 },
      { period: 2, home: 0, away: 0 },
    ]);
  });

  it('ignores misses, zero points, and events charged to both sides', () => {
    const rows = periodPartials([
      { ...made(1, 'home', 2), made: false },
      { ...made(1, 'home', 0), points: 0 },
      { ...made(1, 'home', 2), opponent_player_id: 'also-away' },
      { event_type: 'rebound', period_number: 1, player_id: 'home-player' },
    ], 1);

    expect(rows).toEqual([{ period: 1, home: 0, away: 0 }]);
  });

  it('shows a later period once a basket is recorded there', () => {
    const rows = periodPartials([
      made(1, 'home', 2),
      made(3, 'away', 3),
    ], 1);

    expect(rows).toEqual([
      { period: 1, home: 2, away: 0 },
      { period: 2, home: 0, away: 0 },
      { period: 3, home: 0, away: 3 },
    ]);
  });
});
