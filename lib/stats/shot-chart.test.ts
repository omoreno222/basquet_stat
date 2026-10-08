import { describe, expect, it } from 'vitest';
import { shotChart } from './shot-chart';

describe('shotChart', () => {
  it('keeps a home make on the right half and folds an away miss onto it', () => {
    const chart = shotChart([
      { event_type: 'shot', player_id: 'home-1', opponent_player_id: null, made: true, coord_x: 0.87, coord_y: 0.23 },
      { event_type: 'shot', player_id: null, opponent_player_id: 'away-1', made: false, coord_x: 0.13, coord_y: 0.22 },
    ]);
    expect(chart.home).toEqual([{ x: 0.87, y: 0.23, made: true }]);
    expect(chart.away).toEqual([{ x: 0.87, y: 0.22, made: false }]);
  });

  it('folds a left-half coordinate and leaves y alone', () => {
    const chart = shotChart([
      { event_type: 'shot', player_id: 'home-1', made: true, coord_x: 0.32, coord_y: 0.67 },
    ]);
    expect(chart.home).toEqual([{ x: 0.68, y: 0.67, made: true }]);
  });

  it('reads numeric strings from the database', () => {
    const chart = shotChart([
      { event_type: 'shot', opponent_player_id: 'away-1', made: false, coord_x: '0.05', coord_y: '0.20' },
    ]);
    expect(chart.away).toEqual([{ x: 0.95, y: 0.2, made: false }]);
  });

  it('drops free throws, fouls, the midcourt line, and rows without one side', () => {
    const chart = shotChart([
      { event_type: 'free_throw', player_id: 'home-1', made: true, coord_x: null, coord_y: null },
      { event_type: 'foul', player_id: 'home-1', made: null, coord_x: 0.9, coord_y: 0.4 },
      { event_type: 'shot', player_id: 'home-1', made: true, coord_x: 0.5, coord_y: 0.4 },
      { event_type: 'shot', player_id: 'home-1', made: null, coord_x: 0.8, coord_y: 0.4 },
      { event_type: 'shot', player_id: 'home-1', opponent_player_id: 'away-1', made: true, coord_x: 0.8, coord_y: 0.4 },
      { event_type: 'shot', made: false, coord_x: 0.8, coord_y: 0.4 },
      { event_type: 'shot', player_id: 'home-1', made: true, coord_x: 1.2, coord_y: 0.4 },
      { event_type: 'shot', player_id: '', made: true, coord_x: 0.8, coord_y: 0.4 },
    ]);
    expect(chart.home).toEqual([]);
    expect(chart.away).toEqual([]);
  });
});
