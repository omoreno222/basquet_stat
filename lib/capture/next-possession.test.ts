import { describe, expect, it } from 'vitest';
import { foulNextPossession, madeNextPossession } from './next-possession';

describe('made next possession', () => {
  it('gives a clean basket to the other team', () => {
    expect(madeNextPossession({
      side: 'home',
      foulKind: null,
      foulerId: null,
      throws: [],
      liveRebound: false,
      reboundSide: null,
    })).toBe('away');
  });

  it('keeps the ball after an unsportsmanlike foul on the shot', () => {
    expect(madeNextPossession({
      side: 'home',
      foulKind: 'flagrant',
      foulerId: 'fouler',
      throws: ['made'],
      liveRebound: false,
      reboundSide: null,
    })).toBe('home');
  });

  it('follows a live rebound and clears the ball when the last throw is missed without one', () => {
    expect(madeNextPossession({
      side: 'away',
      foulKind: 'personal',
      foulerId: 'fouler',
      throws: ['miss'],
      liveRebound: true,
      reboundSide: 'home',
    })).toBe('home');
    expect(madeNextPossession({
      side: 'away',
      foulKind: 'personal',
      foulerId: 'fouler',
      throws: ['miss'],
      liveRebound: false,
      reboundSide: null,
    })).toBeNull();
  });
});

describe('foul next possession', () => {
  it('leaves the ball where it is on a technical or double foul', () => {
    expect(foulNextPossession({
      possession: 'home',
      side: 'away',
      kind: 'technical',
      context: 'technical',
      throws: ['made'],
      liveRebound: false,
      reboundSide: null,
    })).toEqual({ possession: 'home', changed: false });
    expect(foulNextPossession({
      possession: 'away',
      side: 'home',
      kind: 'double',
      context: 'double',
      throws: [],
      liveRebound: false,
      reboundSide: null,
    })).toEqual({ possession: 'away', changed: false });
  });

  it('inbounds to the other team on an offensive foul or a personal with no throws', () => {
    expect(foulNextPossession({
      possession: 'home',
      side: 'home',
      kind: 'personal',
      context: 'offensive',
      throws: [],
      liveRebound: false,
      reboundSide: null,
    })).toEqual({ possession: 'away', changed: true });
    expect(foulNextPossession({
      possession: 'home',
      side: 'away',
      kind: 'personal',
      context: 'no_shot',
      throws: [],
      liveRebound: false,
      reboundSide: null,
    })).toEqual({ possession: 'home', changed: true });
  });

  it('gives a made last throw to the fouling team and a live rebound to the rebounder', () => {
    expect(foulNextPossession({
      possession: 'home',
      side: 'away',
      kind: 'personal',
      context: 'no_shot',
      throws: ['miss', 'made'],
      liveRebound: false,
      reboundSide: null,
    })).toEqual({ possession: 'away', changed: true });
    expect(foulNextPossession({
      possession: 'home',
      side: 'away',
      kind: 'personal',
      context: 'no_shot',
      throws: ['made', 'miss'],
      liveRebound: true,
      reboundSide: 'home',
    })).toEqual({ possession: 'home', changed: true });
  });
});
