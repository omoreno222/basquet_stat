import { describe, expect, it } from 'vitest';
import { evaluateGame, formatRebound, formatShotLine, type EvalEvent, type EvalPerson } from './sampaio-eval';

const jasikevicius: EvalPerson = { id: 'j', name: 'Jasikevicius', jerseyNumber: 13 };
const teammate: EvalPerson = { id: 'mate', name: 'Mate', jerseyNumber: 4 };
const bench: EvalPerson = { id: 'bench', name: 'Bench', jerseyNumber: 20 };
const away: EvalPerson = { id: 'away', name: 'Away', jerseyNumber: 7 };

function shots(id: string, side: 'home' | 'away', made: number, misses: number, points: 2 | 3): EvalEvent[] {
  const actor = side === 'home'
    ? { player_id: id, opponent_player_id: null }
    : { player_id: null, opponent_player_id: id };
  const rows: EvalEvent[] = [];
  for (let i = 0; i < made; i += 1) {
    rows.push({ event_type: 'shot', ...actor, made: true, points });
  }
  for (let i = 0; i < misses; i += 1) {
    rows.push({ event_type: 'shot', ...actor, made: false, points });
  }
  return rows;
}

function freeThrows(id: string, side: 'home' | 'away', made: number, misses: number): EvalEvent[] {
  const actor = side === 'home'
    ? { player_id: id, opponent_player_id: null }
    : { player_id: null, opponent_player_id: id };
  const rows: EvalEvent[] = [];
  for (let i = 0; i < made; i += 1) {
    rows.push({ event_type: 'free_throw', ...actor, made: true, points: 1 });
  }
  for (let i = 0; i < misses; i += 1) {
    rows.push({ event_type: 'free_throw', ...actor, made: false, points: 0 });
  }
  return rows;
}

function rebounds(id: string | null, side: 'home' | 'away', offensive: boolean, count: number): EvalEvent[] {
  const rows: EvalEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({
      event_type: 'rebound',
      player_id: side === 'home' ? id : null,
      opponent_player_id: side === 'away' ? id : null,
      rebound_side: id ? null : 'away',
      is_offensive: offensive,
    });
  }
  return rows;
}

describe('evaluateGame', () => {
  it('reproduces the Jasikevicius line at 75.6 possessions', () => {
    const events: EvalEvent[] = [
      ...shots('j', 'home', 4, 8, 2),
      ...shots('j', 'home', 1, 0, 3),
      ...freeThrows('j', 'home', 2, 0),
      ...shots('mate', 'home', 0, 69, 2),
      ...freeThrows('mate', 'home', 0, 13),
      ...rebounds('j', 'home', false, 2),
      ...rebounds('mate', 'home', false, 21),
      ...rebounds('j', 'home', true, 1),
      ...rebounds('mate', 'home', true, 15),
      ...rebounds('away', 'away', true, 12),
      ...rebounds('away', 'away', false, 24),
      ...shots('away', 'away', 0, 81, 2),
      ...freeThrows('away', 'away', 0, 15),
    ];
    for (let i = 0; i < 4; i += 1) {
      events.push({
        event_type: 'foul',
        foul_side: 'home',
        foul_context: 'no_shot',
        player_id: 'j',
        opponent_player_id: null,
      });
    }
    events.push({
      event_type: 'foul',
      foul_side: 'away',
      foul_context: 'no_shot',
      player_id: null,
      opponent_player_id: 'away',
      foul_received_player_id: 'j',
    });
    for (let i = 0; i < 5; i += 1) {
      events.push({ event_type: 'assist', player_id: 'j', opponent_player_id: null });
    }
    for (let i = 0; i < 3; i += 1) {
      events.push({
        event_type: 'turnover',
        turnover_side: 'home',
        player_id: 'j',
        opponent_player_id: null,
      });
    }

    const result = evaluateGame({
      events,
      homePlayers: [jasikevicius, teammate, bench],
      homeSquadIds: ['j', 'bench'],
      awayPlayers: [away],
      awayRosterIds: ['away'],
    });

    expect(result.gamePossessions).toBeCloseTo(75.6, 5);
    expect(result.homePoints).toBe(13);
    const row = result.home.find((player) => player.id === 'j');
    expect(row).toBeDefined();
    expect(formatShotLine(row!.ftMade, row!.ftAtt, 'en')).toBe('2/2 100%');
    expect(formatShotLine(row!.twoMade, row!.twoAtt, 'en')).toBe('4/12 33.3%');
    expect(formatShotLine(row!.threeMade, row!.threeAtt, 'en')).toBe('1/1 100%');
    expect(formatRebound(row!.drb, row!.drbShare, 'en')).toBe('2 (8.7%)');
    expect(formatRebound(row!.orb, row!.orbShare, 'en')).toBe('1 (6.3%)');
    expect(row!.foulsCommitted).toBe(4);
    expect(row!.foulsReceived).toBe(1);
    expect(row!.assists).toBe(5);
    expect(row!.turnovers).toBe(3);
    expect(row!.points).toBe(13);

    const dressed = result.home.find((player) => player.id === 'bench');
    expect(formatShotLine(dressed!.twoMade, dressed!.twoAtt, 'en')).toBe('0/0');
    expect(formatRebound(dressed!.drb, dressed!.drbShare, 'en')).toBe('0 (0%)');
  });

  it('sorts by jersey and leaves a missing opponent name as the shirt number', () => {
    const result = evaluateGame({
      events: shots('b', 'home', 1, 0, 2),
      homePlayers: [
        { id: 'b', name: 'Big', jerseyNumber: 10 },
        { id: 'a', name: 'Ace', jerseyNumber: 4 },
        { id: 'z', name: 'Zone', jerseyNumber: null },
      ],
      homeSquadIds: ['b', 'a', 'z'],
      awayPlayers: [{ id: 'opp', name: '', jerseyNumber: 12 }],
      awayRosterIds: ['opp'],
    });

    expect(result.home.map((player) => player.jerseyNumber)).toEqual([4, 10, null]);
    expect(result.away[0]?.name).toBe('#12');
  });

  it('counts an unknown away rebound in the denominator and in possessions only', () => {
    const result = evaluateGame({
      events: [
        ...rebounds('j', 'home', false, 1),
        ...rebounds(null, 'away', true, 1),
      ],
      homePlayers: [jasikevicius],
      homeSquadIds: [],
      awayPlayers: [],
      awayRosterIds: [],
    });

    expect(result.away).toEqual([]);
    expect(formatRebound(result.home[0]!.drb, result.home[0]!.drbShare, 'en')).toBe('1 (100%)');
    expect(result.awayPossessions).toBeCloseTo(-1, 5);
  });

  it('counts an offensive foul as a turnover once, including when a turnover row is already in the group', () => {
    const alone = evaluateGame({
      events: [{
        event_type: 'foul',
        play_group_id: 'g1',
        foul_side: 'home',
        foul_context: 'offensive',
        player_id: 'j',
      }],
      homePlayers: [jasikevicius],
      homeSquadIds: [],
      awayPlayers: [],
      awayRosterIds: [],
    });
    expect(alone.homePossessions).toBe(1);
    expect(alone.home[0]?.foulsCommitted).toBe(1);
    expect(alone.home[0]?.turnovers).toBe(1);

    const paired = evaluateGame({
      events: [
        {
          event_type: 'foul',
          play_group_id: 'g1',
          foul_side: 'home',
          foul_context: 'offensive',
          player_id: 'j',
        },
        {
          event_type: 'turnover',
          play_group_id: 'g1',
          turnover_side: 'home',
          player_id: 'j',
        },
      ],
      homePlayers: [jasikevicius],
      homeSquadIds: [],
      awayPlayers: [],
      awayRosterIds: [],
    });
    expect(paired.homePossessions).toBe(1);
    expect(paired.home[0]?.turnovers).toBe(1);
    expect(paired.home[0]?.foulsCommitted).toBe(1);
  });

  it('counts a team clock violation only in the team possessions', () => {
    const result = evaluateGame({
      events: [{ event_type: 'turnover', turnover_side: 'home', turnover_type: 'shot_clock' } as EvalEvent],
      homePlayers: [jasikevicius],
      homeSquadIds: [],
      awayPlayers: [],
      awayRosterIds: [],
    });

    expect(result.home).toEqual([]);
    expect(result.homePossessions).toBe(1);
  });

  it('leaves a coach technical off the table', () => {
    const result = evaluateGame({
      events: [{
        event_type: 'foul',
        foul_side: 'home',
        foul_context: 'technical',
        coach_technical_side: 'home',
        player_id: null,
        opponent_player_id: null,
      }],
      homePlayers: [jasikevicius],
      homeSquadIds: [],
      awayPlayers: [],
      awayRosterIds: [],
    });

    expect(result.home).toEqual([]);
    expect(result.homePossessions).toBe(0);
    expect(result.homePoints).toBe(0);
  });

  it('blanks a made shot whose points are not 2 or 3', () => {
    const result = evaluateGame({
      events: [
        { event_type: 'shot', player_id: 'j', made: true, points: 4 },
        { event_type: 'shot', player_id: 'mate', made: false, points: 2 },
      ],
      homePlayers: [jasikevicius, teammate],
      homeSquadIds: [],
      awayPlayers: [away],
      awayRosterIds: [],
    });

    const row = result.home.find((player) => player.id === 'j');
    expect(formatShotLine(row!.twoMade, row!.twoAtt, 'en')).toBe('0/0');
    expect(formatShotLine(row!.threeMade, row!.threeAtt, 'en')).toBe('0/0');
    expect(row!.points).toBe(4);
  });

  it('blanks a ratio whose denominator is zero and keeps a real zero', () => {
    const result = evaluateGame({
      events: [
        { event_type: 'shot', player_id: 'j', made: true, points: 2 },
        { event_type: 'foul', foul_side: 'home', foul_context: 'no_shot', player_id: 'j' },
        { event_type: 'turnover', turnover_side: 'away', opponent_player_id: 'away' },
      ],
      homePlayers: [jasikevicius],
      homeSquadIds: ['j'],
      awayPlayers: [away],
      awayRosterIds: [],
    });

    const row = result.home[0];
    expect(formatShotLine(row!.ftMade, row!.ftAtt, 'en')).toBe('0/0');
    expect(formatShotLine(row!.twoMade, row!.twoAtt, 'en')).toBe('1/1 100%');
    expect(row!.foulsCommitted).toBe(1);
    expect(row!.foulsReceived).toBe(0);
    expect(row!.turnovers).toBe(0);
    expect(row!.points).toBe(2);
    expect(result.away[0]?.turnovers).toBe(1);
    expect(result.away[0]?.foulsCommitted).toBe(0);
  });

  it('formats a shot line without a percentage when nothing was attempted', () => {
    expect(formatShotLine(3, 5, 'en')).toBe('3/5 60%');
    expect(formatShotLine(1, 2, 'es')).toBe('1/2 50%');
    expect(formatShotLine(0, 0, 'en')).toBe('0/0');
    expect(formatShotLine(0, 1, 'en')).toBe('0/1 0%');
    expect(formatRebound(2, 20, 'en')).toBe('2 (20%)');
    expect(formatRebound(0, null, 'es')).toBe('0');
  });
});
