import { describe, expect, it } from 'vitest';
import { awardedFreeThrows, freeThrowNeedsRebound, freeThrowSequenceReady } from './free-throws';
import { commitCapturePlaySchema } from './plays';

const gameId = '11111111-1111-4111-8111-111111111111';
const offenderId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const rebounderId = '44444444-4444-4444-8444-444444444444';

describe('free throw sequence', () => {
  it('is ready only when one, two, or three throws are all marked', () => {
    expect(freeThrowSequenceReady([])).toBe(false);
    expect(freeThrowSequenceReady([null])).toBe(false);
    expect(freeThrowSequenceReady(['miss', null])).toBe(false);
    expect(freeThrowSequenceReady(['made'])).toBe(true);
    expect(freeThrowSequenceReady(['miss', 'made'])).toBe(true);
    expect(freeThrowSequenceReady(['made', 'miss', 'miss'])).toBe(true);
    expect(freeThrowSequenceReady(['made', 'miss', 'miss', 'made'])).toBe(false);
  });

  it('asks for a rebound only when the last throw of a live personal sequence is missed', () => {
    expect(freeThrowNeedsRebound({ source: 'foul', kind: 'personal', context: 'no_shot', throws: ['miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'foul', kind: 'personal', context: 'no_shot', throws: ['made', 'miss'] })).toBe(true);
    expect(freeThrowNeedsRebound({ source: 'foul', kind: 'personal', context: 'no_shot', throws: ['miss', 'miss', 'miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'foul', kind: 'personal', context: 'no_shot', throws: ['miss', 'made'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'foul', kind: 'technical', context: 'technical', throws: ['miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'foul', kind: 'flagrant', context: 'no_shot', throws: ['miss', 'miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'foul', kind: 'disqualifying', context: 'no_shot', throws: ['miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'foul', kind: 'disruptive', context: 'no_shot', throws: ['miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'made', throws: ['miss'] })).toBe(true);
    expect(freeThrowNeedsRebound({ source: 'made', kind: 'flagrant', throws: ['miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'made', throws: ['made', 'miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'made', throws: ['made'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'miss', throws: ['miss', 'miss', 'miss'] })).toBe(true);
    expect(freeThrowNeedsRebound({ source: 'miss', kind: 'flagrant', throws: ['miss', 'miss'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'miss', throws: ['miss', 'made'] })).toBe(false);
    expect(freeThrowNeedsRebound({ source: 'miss', throws: [] })).toBe(false);
  });
});

describe('awarded free throws', () => {
  it('follows the foul and ignores the bonus on a shot', () => {
    expect(awardedFreeThrows({ kind: 'personal', context: 'shot_made', teamFoulsBefore: 0 })).toBe(1);
    expect(awardedFreeThrows({ kind: 'personal', context: 'shot_made', teamFoulsBefore: 6 })).toBe(1);
    expect(awardedFreeThrows({ kind: 'flagrant', context: 'shot_made', teamFoulsBefore: 0 })).toBe(1);
    expect(awardedFreeThrows({ kind: 'personal', context: 'shot_missed', teamFoulsBefore: 0, shotValue: 2 })).toBe(2);
    expect(awardedFreeThrows({ kind: 'disruptive', context: 'shot_missed', teamFoulsBefore: 1, shotValue: 3 })).toBe(3);
    expect(awardedFreeThrows({ kind: 'personal', context: 'no_shot', teamFoulsBefore: 3 })).toBe(0);
    expect(awardedFreeThrows({ kind: 'personal', context: 'no_shot', teamFoulsBefore: 4 })).toBe(2);
    expect(awardedFreeThrows({ kind: 'personal', context: 'offensive', teamFoulsBefore: 6 })).toBe(0);
    expect(awardedFreeThrows({ kind: 'double', context: 'double', teamFoulsBefore: 5 })).toBe(0);
    expect(awardedFreeThrows({ kind: 'technical', context: 'technical', teamFoulsBefore: 0 })).toBe(1);
    expect(awardedFreeThrows({ kind: 'flagrant', context: 'no_shot', teamFoulsBefore: 0 })).toBe(2);
    expect(awardedFreeThrows({ kind: 'disqualifying', context: 'no_shot', teamFoulsBefore: 2 })).toBe(2);
  });
});

describe('foul free-throw rebound schema', () => {
  function foul(overrides: Record<string, unknown> = {}) {
    return {
      play: 'foul',
      gameId,
      periodNumber: 1,
      clockRemainingMs: 500000,
      side: 'away',
      coordX: 0.2,
      coordY: 0.5,
      kind: 'personal',
      context: 'no_shot',
      offenderId,
      otherId,
      coach: false,
      throws: ['miss', 'miss'],
      ...overrides,
    };
  }

  it('requires a rebounder only for a personal bonus whose last free throw is missed', () => {
    expect(commitCapturePlaySchema.safeParse(foul()).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(foul({ rebounderId })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(foul({ unknownRebound: true })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(foul({ rebounderId, unknownRebound: true })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(foul({ throws: ['made', 'made'], unknownRebound: true })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(foul({ throws: ['made', 'miss'], rebounderId })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(foul({ throws: ['made', 'made'] })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(foul({ throws: ['made'] })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(foul({ throws: ['made', 'made'], rebounderId })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(foul({
      kind: 'disruptive',
      throws: ['miss', 'miss'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(foul({
      kind: 'technical',
      context: 'technical',
      throws: ['made', 'miss'],
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(foul({
      kind: 'technical',
      context: 'technical',
      throws: ['miss'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(foul({
      kind: 'technical',
      context: 'technical',
      throws: ['miss'],
      rebounderId,
    })).success).toBe(false);
  });
});
