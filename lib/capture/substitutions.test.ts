import { describe, expect, it } from 'vitest';
import { onCourtAfterSubs, type SubstitutionEvent } from './substitutions';

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
