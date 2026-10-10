import { describe, expect, it } from 'vitest';
import {
  captureHappenedBefore,
  onCourtAfterSubs,
  onCourtBefore,
  playerEliminatedBefore,
  type FoulClockEvent,
  type SubstitutionEvent,
} from './substitutions';

const starters = ['a', 'b', 'c', 'd', 'e'];

function sub(partial: Partial<SubstitutionEvent> & Pick<SubstitutionEvent, 'clock_remaining_ms'>): SubstitutionEvent {
  return {
    event_type: 'substitution',
    period_number: 1,
    player_id: null,
    player_out_id: null,
    opponent_player_id: null,
    opponent_player_out_id: null,
    ...partial,
  };
}

describe('onCourtAfterSubs', () => {
  it('keeps the starters when nobody has been replaced', () => {
    expect(onCourtAfterSubs(starters, [], 1, 'home')).toEqual(starters);
  });

  it('replaces the player who leaves with the one who enters', () => {
    const events = [sub({
      clock_remaining_ms: 400000,
      player_out_id: 'b',
      player_id: 'f',
      created_at: '2026-01-01T00:00:00Z',
    })];
    expect(onCourtAfterSubs(starters, events, 1, 'home')).toEqual(['a', 'f', 'c', 'd', 'e']);
  });

  it('applies an earlier substitution before a later one at the same clock', () => {
    const events = [
      sub({
        clock_remaining_ms: 300000,
        player_out_id: 'f',
        player_id: 'g',
        created_at: '2026-01-01T00:00:02Z',
      }),
      sub({
        clock_remaining_ms: 300000,
        player_out_id: 'b',
        player_id: 'f',
        created_at: '2026-01-01T00:00:01Z',
      }),
    ];
    expect(onCourtAfterSubs(starters, events, 1, 'home')).toEqual(['a', 'g', 'c', 'd', 'e']);
  });

  it('uses opponent ids for the away team and ignores the other side', () => {
    const events = [
      sub({
        clock_remaining_ms: 500000,
        player_out_id: 'b',
        player_id: 'f',
      }),
      sub({
        clock_remaining_ms: 500000,
        opponent_player_out_id: 'b',
        opponent_player_id: 'z',
      }),
    ];
    expect(onCourtAfterSubs(starters, events, 1, 'away')).toEqual(['a', 'z', 'c', 'd', 'e']);
    expect(onCourtAfterSubs(starters, events, 1, 'home')).toEqual(['a', 'f', 'c', 'd', 'e']);
  });

  it('ignores a substitution from another period', () => {
    const events = [sub({
      period_number: 2,
      clock_remaining_ms: 100000,
      player_out_id: 'a',
      player_id: 'f',
    })];
    expect(onCourtAfterSubs(starters, events, 1, 'home')).toEqual(starters);
  });
});

describe('onCourtBefore', () => {
  const shot = { period_number: 1, clock_remaining_ms: 400000, created_at: '2026-01-01T00:05:00Z' };

  it('keeps a player who is replaced after the shot', () => {
    const events = [
      sub({
        clock_remaining_ms: 500000,
        player_out_id: 'b',
        player_id: 'f',
        created_at: '2026-01-01T00:01:00Z',
      }),
      sub({
        clock_remaining_ms: 200000,
        player_out_id: 'f',
        player_id: 'g',
        created_at: '2026-01-01T00:09:00Z',
      }),
    ];
    expect(onCourtBefore(starters, events, 1, 'home', shot)).toEqual(['a', 'f', 'c', 'd', 'e']);
  });

  it('applies a same-clock substitution only when it was recorded before the shot', () => {
    const events = [
      sub({
        clock_remaining_ms: 400000,
        player_out_id: 'b',
        player_id: 'f',
        created_at: '2026-01-01T00:04:00Z',
      }),
      sub({
        clock_remaining_ms: 400000,
        player_out_id: 'c',
        player_id: 'g',
        created_at: '2026-01-01T00:06:00Z',
      }),
    ];
    expect(onCourtBefore(starters, events, 1, 'home', shot)).toEqual(['a', 'f', 'c', 'd', 'e']);
  });

  it('treats an earlier period as before a later one even when the clock is lower', () => {
    expect(captureHappenedBefore(
      { period_number: 1, clock_remaining_ms: 1000, created_at: '2026-01-01T00:01:00Z' },
      { period_number: 2, clock_remaining_ms: 500000, created_at: '2026-01-01T00:20:00Z' },
    )).toBe(true);
  });
});

describe('playerEliminatedBefore', () => {
  const shot = { period_number: 2, clock_remaining_ms: 400000, created_at: '2026-01-01T00:10:00Z' };

  function foul(partial: Partial<FoulClockEvent> & Pick<FoulClockEvent, 'period_number' | 'clock_remaining_ms'>): FoulClockEvent {
    return {
      event_type: 'foul',
      foul_type: 'personal',
      player_id: 'b',
      created_at: '2026-01-01T00:01:00Z',
      ...partial,
    };
  }

  it('counts a flagrant from an earlier period and ignores one after the shot', () => {
    const events = [
      foul({
        period_number: 1,
        clock_remaining_ms: 1000,
        foul_type: 'flagrant',
        player_id: 'b',
        created_at: '2026-01-01T00:01:00Z',
      }),
      foul({
        period_number: 2,
        clock_remaining_ms: 100000,
        foul_type: 'flagrant',
        player_id: 'c',
        created_at: '2026-01-01T00:20:00Z',
      }),
    ];
    expect(playerEliminatedBefore(events, 'b', 'home', shot)).toBe(true);
    expect(playerEliminatedBefore(events, 'c', 'home', shot)).toBe(false);
  });
});
