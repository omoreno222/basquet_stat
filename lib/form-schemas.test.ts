import { describe, expect, it } from 'vitest';
import {
  incorporatePlayerSchema,
  opponentBenchAddSchema,
  opponentRosterSchema,
  parentPlayerExclusiveMessage,
  playerCoachExclusiveMessage,
  teamSchema,
  toggleUserRole,
  userCreateSchema,
} from './form-schemas';

const validTeam = {
  name: 'Senior A',
  season_id: '11111111-1111-4111-8111-111111111111',
  category: 'senior' as const,
  gender: 'mixed' as const,
};

describe('teamSchema fiba_short_name', () => {
  it('accepts an empty value', () => {
    const parsed = teamSchema.parse({ ...validTeam, fiba_short_name: '  ' });
    expect(parsed.fiba_short_name).toBeNull();
  });

  it('stores lowercase input as uppercase', () => {
    const parsed = teamSchema.parse({ ...validTeam, fiba_short_name: 'bar' });
    expect(parsed.fiba_short_name).toBe('BAR');
  });

  it('accepts digits and letters', () => {
    const parsed = teamSchema.parse({ ...validTeam, fiba_short_name: 'a1b' });
    expect(parsed.fiba_short_name).toBe('A1B');
  });

  it('rejects a value that is not exactly 3 alphanumeric characters', () => {
    expect(teamSchema.safeParse({ ...validTeam, fiba_short_name: 'BA' }).success).toBe(false);
    expect(teamSchema.safeParse({ ...validTeam, fiba_short_name: 'BARR' }).success).toBe(false);
    expect(teamSchema.safeParse({ ...validTeam, fiba_short_name: 'B-R' }).success).toBe(false);
  });
});

const coachA = '22222222-2222-4222-8222-222222222222';
const coachB = '33333333-3333-4333-8333-333333333333';
const coachC = '44444444-4444-4444-8444-444444444444';
const coachD = '55555555-5555-4555-8555-555555555555';

describe('teamSchema coach_ids', () => {
  it('accepts a team with no coaches', () => {
    const parsed = teamSchema.parse(validTeam);
    expect(parsed.coach_ids).toEqual([]);
  });

  it('accepts three coaches', () => {
    const parsed = teamSchema.parse({ ...validTeam, coach_ids: [coachA, coachB, coachC] });
    expect(parsed.coach_ids).toEqual([coachA, coachB, coachC]);
  });

  it('rejects a fourth coach', () => {
    const parsed = teamSchema.safeParse({ ...validTeam, coach_ids: [coachA, coachB, coachC, coachD] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe('A team can have at most 3 coaches');
  });

  it('rejects the same coach twice', () => {
    const parsed = teamSchema.safeParse({ ...validTeam, coach_ids: [coachA, coachA] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe('Each coach can only be added once');
  });
});

const gameId = '11111111-1111-4111-8111-111111111111';

function opponentPlayer(jersey: number | null, isCoach = false, name: string | null = null) {
  return { id: null, jersey_number: isCoach ? null : jersey, name, is_coach: isCoach };
}

describe('opponentRosterSchema', () => {
  it('stores a blank name as null and does not require a starting five', () => {
    const parsed = opponentRosterSchema.parse({
      game_id: gameId,
      color: '#737373',
      players: [
        opponentPlayer(4, false, '  '),
        opponentPlayer(5, false, 'Sol'),
        opponentPlayer(99, true, 'Coach'),
      ],
    });
    expect(parsed.players[0].name).toBeNull();
    expect(parsed.players[1].name).toBe('Sol');
    expect(parsed.players[2].is_coach).toBe(true);
    expect(parsed.players[2].jersey_number).toBeNull();
  });

  it('rejects a jersey on the coach and a player without one', () => {
    const coachWithJersey = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: [{ id: null, jersey_number: 4, name: 'Ana', is_coach: true }],
    });
    const playerWithoutJersey = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: [{ id: null, jersey_number: null, name: 'Sol', is_coach: false }],
    });
    expect(coachWithJersey.success).toBe(false);
    expect(playerWithoutJersey.success).toBe(false);
  });

  it('rejects a duplicate jersey', () => {
    const parsed = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: [4, 5, 7, 8, 4].map((jersey) => opponentPlayer(jersey)),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('duplicate jersey');
    }
  });

  it('accepts four players and rejects a second coach', () => {
    const four = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: [4, 5, 7, 8].map((jersey) => opponentPlayer(jersey)),
    });
    const twoCoaches = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: [
        opponentPlayer(4),
        opponentPlayer(1, true, 'Ana'),
        opponentPlayer(2, true, 'Luis'),
      ],
    });
    expect(four.success).toBe(true);
    expect(twoCoaches.success).toBe(false);
  });

  it('rejects a 13th player, jersey 100, and a long name', () => {
    const tooMany = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: Array.from({ length: 13 }, (_, index) => opponentPlayer(index)),
    });
    const withCoach = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: [
        ...Array.from({ length: 12 }, (_, index) => opponentPlayer(index)),
        opponentPlayer(20, true, 'Coach'),
      ],
    });
    const jersey = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: [100, 5, 7, 8, 10].map((number) => opponentPlayer(number)),
    });
    const name = opponentRosterSchema.safeParse({
      game_id: gameId,
      color: '#737373',
      players: [opponentPlayer(4, false, 'a'.repeat(81))],
    });
    expect(tooMany.success).toBe(false);
    expect(withCoach.success).toBe(true);
    expect(jersey.success).toBe(false);
    expect(name.success).toBe(false);
  });

  it('stores the jersey color in lowercase and rejects a bad color', () => {
    const parsed = opponentRosterSchema.parse({
      game_id: gameId,
      color: '#AbCDef',
      players: [opponentPlayer(4)],
    });
    expect(parsed.color).toBe('#abcdef');
    expect(opponentRosterSchema.safeParse({
      game_id: gameId,
      color: 'blue',
      players: [opponentPlayer(4)],
    }).success).toBe(false);
  });
});

describe('opponentBenchAddSchema', () => {
  it('stores a blank name as null', () => {
    const parsed = opponentBenchAddSchema.parse({
      game_id: gameId,
      jersey_number: 0,
      name: '  ',
      existing_jerseys: [4, 5],
    });
    expect(parsed.jersey_number).toBe(0);
    expect(parsed.name).toBeNull();
  });

  it('rejects a duplicate jersey', () => {
    const parsed = opponentBenchAddSchema.safeParse({
      game_id: gameId,
      jersey_number: 4,
      name: 'Sol',
      existing_jerseys: [4, 5],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe('duplicate jersey');
  });

  it('rejects a 13th player and a long name', () => {
    const full = opponentBenchAddSchema.safeParse({
      game_id: gameId,
      jersey_number: 20,
      name: null,
      existing_jerseys: Array.from({ length: 12 }, (_, index) => index),
    });
    const name = opponentBenchAddSchema.safeParse({
      game_id: gameId,
      jersey_number: 8,
      name: 'a'.repeat(81),
      existing_jerseys: [4],
    });
    const jersey = opponentBenchAddSchema.safeParse({
      game_id: gameId,
      jersey_number: 100,
      name: null,
      existing_jerseys: [],
    });
    expect(full.success).toBe(false);
    if (!full.success) expect(full.error.issues[0]?.message).toBe('at most 12 opponent players');
    expect(name.success).toBe(false);
    expect(jersey.success).toBe(false);
  });
});

function playerId(n: number) {
  return `22222222-2222-4222-8222-${n.toString(16).padStart(12, '0')}`;
}

describe('incorporatePlayerSchema', () => {
  it('accepts a team player when fewer than 12 are dressed', () => {
    const dressed = Array.from({ length: 11 }, (_, index) => playerId(index + 1));
    const parsed = incorporatePlayerSchema.parse({
      game_id: gameId,
      player_id: playerId(12),
      dressed_ids: dressed,
    });
    expect(parsed.player_id).toBe(playerId(12));
  });

  it('rejects a player who is already dressed', () => {
    const parsed = incorporatePlayerSchema.safeParse({
      game_id: gameId,
      player_id: playerId(1),
      dressed_ids: [playerId(1), playerId(2)],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe('already dressed');
  });

  it('rejects a 13th dressed player', () => {
    const parsed = incorporatePlayerSchema.safeParse({
      game_id: gameId,
      player_id: playerId(13),
      dressed_ids: Array.from({ length: 12 }, (_, index) => playerId(index + 1)),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe('at most 12 players');
  });
});

describe('user role exclusivity', () => {
  const user = {
    email: 'coach1@lestonna.com',
    full_name: 'Entrenador',
    club_id: '11111111-1111-4111-8111-111111111111',
  };

  it('accepts a parent who is also a coach', () => {
    expect(userCreateSchema.safeParse({ ...user, roles: ['parent', 'coach'] }).success).toBe(true);
    expect(toggleUserRole(['parent'], 'coach')).toEqual(['parent', 'coach']);
  });

  it('drops coach when player is selected', () => {
    expect(toggleUserRole(['coach', 'team_manager'], 'player')).toEqual(['team_manager', 'player']);
    const parsed = userCreateSchema.safeParse({ ...user, roles: ['player', 'coach'] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe(playerCoachExclusiveMessage);
  });

  it('drops player when parent is selected', () => {
    expect(toggleUserRole(['player'], 'parent')).toEqual(['parent']);
    const parsed = userCreateSchema.safeParse({ ...user, roles: ['parent', 'player'] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe(parentPlayerExclusiveMessage);
  });
});
