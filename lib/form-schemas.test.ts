import { describe, expect, it } from 'vitest';
import { opponentRosterSchema, teamSchema } from './form-schemas';

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

const gameId = '11111111-1111-4111-8111-111111111111';

function opponentPlayer(jersey: number | null, isCoach = false, name: string | null = null) {
  return { id: null, jersey_number: isCoach ? null : jersey, name, is_coach: isCoach };
}

describe('opponentRosterSchema', () => {
  it('stores a blank name as null and does not require a starting five', () => {
    const parsed = opponentRosterSchema.parse({
      game_id: gameId,
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
      players: [{ id: null, jersey_number: 4, name: 'Ana', is_coach: true }],
    });
    const playerWithoutJersey = opponentRosterSchema.safeParse({
      game_id: gameId,
      players: [{ id: null, jersey_number: null, name: 'Sol', is_coach: false }],
    });
    expect(coachWithJersey.success).toBe(false);
    expect(playerWithoutJersey.success).toBe(false);
  });

  it('rejects a duplicate jersey', () => {
    const parsed = opponentRosterSchema.safeParse({
      game_id: gameId,
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
      players: [4, 5, 7, 8].map((jersey) => opponentPlayer(jersey)),
    });
    const twoCoaches = opponentRosterSchema.safeParse({
      game_id: gameId,
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
      players: Array.from({ length: 13 }, (_, index) => opponentPlayer(index)),
    });
    const withCoach = opponentRosterSchema.safeParse({
      game_id: gameId,
      players: [
        ...Array.from({ length: 12 }, (_, index) => opponentPlayer(index)),
        opponentPlayer(20, true, 'Coach'),
      ],
    });
    const jersey = opponentRosterSchema.safeParse({
      game_id: gameId,
      players: [100, 5, 7, 8, 10].map((number) => opponentPlayer(number)),
    });
    const name = opponentRosterSchema.safeParse({
      game_id: gameId,
      players: [opponentPlayer(4, false, 'a'.repeat(81))],
    });
    expect(tooMany.success).toBe(false);
    expect(withCoach.success).toBe(true);
    expect(jersey.success).toBe(false);
    expect(name.success).toBe(false);
  });
});
