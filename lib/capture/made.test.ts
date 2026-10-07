import { describe, expect, it } from 'vitest';
import {
  commitCapturePlaySchema,
  madeAssistRequired,
  madeStopsClock,
  shotInPaint,
  shotOnAttackingHalf,
  shotValueFromWorld,
} from './plays';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

function made(overrides: Record<string, unknown> = {}) {
  return {
    play: 'made',
    gameId: id,
    periodNumber: 1,
    clockRemainingMs: 500000,
    side: 'home',
    coordX: 0.9,
    coordY: 0.5,
    shooterId: id,
    assistId: other,
    foulerId: null,
    throws: [],
    ...overrides,
  };
}

describe('made shot geometry', () => {
  it('scores a layup on the attacking half as 2 inside the paint', () => {
    expect(shotOnAttackingHalf(0.92, true)).toBe(true);
    expect(shotInPaint(0.92, 0.5, true)).toBe(true);
    expect(shotValueFromWorld(0.92, 0.5, true)).toBe(2);
    expect(madeAssistRequired(2, true, 4)).toBe(true);
  });

  it('scores a mid-range 2 outside the paint without forcing an assist', () => {
    expect(shotInPaint(0.75, 0.5, true)).toBe(false);
    expect(shotValueFromWorld(0.75, 0.5, true)).toBe(2);
    expect(madeAssistRequired(2, false, 4)).toBe(false);
  });

  it('scores beyond the arc as 3 and never forces an assist', () => {
    expect(shotOnAttackingHalf(0.55, true)).toBe(true);
    expect(shotValueFromWorld(0.55, 0.5, true)).toBe(3);
    expect(madeAssistRequired(3, false, 4)).toBe(false);
  });

  it('rejects the other half and the midcourt line', () => {
    expect(shotOnAttackingHalf(0.4, true)).toBe(false);
    expect(shotOnAttackingHalf(0.5, true)).toBe(false);
    expect(shotOnAttackingHalf(0.5, false)).toBe(false);
  });

  it('mirrors the paint when that team attacks left', () => {
    expect(shotOnAttackingHalf(0.08, false)).toBe(true);
    expect(shotInPaint(0.08, 0.5, false)).toBe(true);
    expect(shotValueFromWorld(0.08, 0.5, false)).toBe(2);
    expect(shotOnAttackingHalf(0.7, false)).toBe(false);
  });

  it('counts the paint line as inside the key', () => {
    const x = (28 - 5.8) / 28;
    const y = (7.5 - 2.45) / 15;
    expect(shotInPaint(x, y, true)).toBe(true);
    expect(shotInPaint(x - 0.001, y, true)).toBe(false);
  });

  it('allows a paint basket with no assist only when nobody else is on the court', () => {
    expect(madeAssistRequired(2, true, 0)).toBe(false);
    expect(madeAssistRequired(2, true, 1)).toBe(true);
  });
});

describe('made play schema', () => {
  it('accepts a basket with an assist and no foul', () => {
    expect(commitCapturePlaySchema.safeParse(made()).success).toBe(true);
  });

  it('accepts one free throw with the foul kind, and a rebound only when that throw is missed', () => {
    const foulerId = '33333333-3333-4333-8333-333333333333';
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, foulKind: 'personal', throws: ['made'] })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, foulKind: 'personal', throws: ['miss'], rebounderId: other })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, foulKind: 'personal', throws: ['miss'], unknownRebound: true })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(made({
      foulerId,
      foulKind: 'personal',
      throws: ['miss'],
      rebounderId: other,
      unknownRebound: true,
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, foulKind: 'personal', throws: ['made'], unknownRebound: true })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, foulKind: 'personal', throws: ['miss'] })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, foulKind: 'flagrant', throws: ['miss'] })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(made({
      foulerId,
      foulKind: 'flagrant',
      throws: ['miss'],
      rebounderId: other,
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, throws: ['made'] })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, foulKind: 'personal', throws: ['made', 'miss'] })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(made({ throws: ['miss'] })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(made({ foulerId, foulKind: 'personal', throws: [] })).success).toBe(false);
  });

  it('stops the clock only when the basket includes a personal foul', () => {
    expect(madeStopsClock(false)).toBe(false);
    expect(madeStopsClock(true)).toBe(true);
  });

  it('rejects an assist or foul charged to the shooter', () => {
    expect(commitCapturePlaySchema.safeParse(made({ assistId: id })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(made({
      foulerId: id,
      foulKind: 'personal',
      throws: ['made'],
    })).success).toBe(false);
  });
});
