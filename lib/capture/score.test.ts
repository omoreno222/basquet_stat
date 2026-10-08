import { describe, expect, it } from 'vitest';
import { scoreFromEvents } from './score';

describe('scoreFromEvents', () => {
  it('starts at zero', () => {
    expect(scoreFromEvents([])).toEqual({ home: 0, away: 0 });
  });

  it('adds made shots on each side and ignores a missed free throw and a rebound', () => {
    expect(scoreFromEvents([
      { event_type: 'shot', made: true, points: 2, player_id: 'home-1', opponent_player_id: null },
      { event_type: 'shot', made: true, points: 3, player_id: null, opponent_player_id: 'away-1' },
      { event_type: 'free_throw', made: false, points: 0, player_id: 'home-1', opponent_player_id: null },
      { event_type: 'rebound', made: null, points: 0, player_id: 'home-2', opponent_player_id: null },
      { event_type: 'free_throw', made: true, points: 1, player_id: null, opponent_player_id: 'away-2' },
    ])).toEqual({ home: 2, away: 4 });
  });
});
