import { describe, expect, it } from 'vitest';
import { eventChart } from './event-chart';

describe('eventChart', () => {
  it('keeps a right-half turnover and folds a left-half one onto that half', () => {
    const chart = eventChart([
      { event_type: 'turnover', turnover_side: 'home', coord_x: 0.77, coord_y: 0.32 },
      { event_type: 'turnover', turnover_side: 'away', coord_x: 0.25, coord_y: 0.34 },
    ]);
    expect(chart.home).toEqual([{ x: 0.77, y: 0.32, kind: 'turnover' }]);
    expect(chart.away).toEqual([{ x: 0.75, y: 0.34, kind: 'turnover' }]);
  });

  it('keeps a shooting foul on the team that committed it', () => {
    const chart = eventChart([
      { event_type: 'foul', foul_side: 'away', foul_type: 'personal', coord_x: 0.78, coord_y: 0.26 },
    ]);
    expect(chart.away).toEqual([{ x: 0.78, y: 0.26, kind: 'foul' }]);
    expect(chart.home).toEqual([]);
  });

  it('puts a double foul on both teams at the equivalent right-half point', () => {
    const chart = eventChart([
      { event_type: 'foul', foul_side: 'home', coord_x: 0.19, coord_y: 0.73 },
      { event_type: 'foul', foul_side: 'away', coord_x: 0.19, coord_y: 0.73 },
    ]);
    expect(chart.home).toEqual([{ x: 0.81, y: 0.73, kind: 'foul' }]);
    expect(chart.away).toEqual([{ x: 0.81, y: 0.73, kind: 'foul' }]);
  });

  it('reads numeric strings from the database', () => {
    const chart = eventChart([
      { event_type: 'turnover', turnover_side: 'home', coord_x: '0.64', coord_y: '0.19' },
    ]);
    expect(chart.home).toEqual([{ x: 0.64, y: 0.19, kind: 'turnover' }]);
  });

  it('drops shots, clock violations, the midcourt line, and rows without a side', () => {
    const chart = eventChart([
      { event_type: 'shot', player_id: 'home-1', made: true, coord_x: 0.8, coord_y: 0.4 },
      { event_type: 'turnover', turnover_side: 'away', turnover_type: 'five_seconds', coord_x: null, coord_y: null },
      { event_type: 'foul', foul_side: 'home', coach_technical_side: 'home', coord_x: null, coord_y: null },
      { event_type: 'turnover', turnover_side: 'home', coord_x: 0.5, coord_y: 0.4 },
      { event_type: 'foul', foul_side: 'bench', coord_x: 0.2, coord_y: 0.4 },
      { event_type: 'turnover', coord_x: 0.2, coord_y: 0.4 },
      { event_type: 'foul', player_id: 'home-1', coord_x: 0.2, coord_y: 0.4 },
      { event_type: 'turnover', turnover_side: 'home', coord_x: 1.2, coord_y: 0.4 },
    ]);
    expect(chart.home).toEqual([]);
    expect(chart.away).toEqual([]);
  });
});
