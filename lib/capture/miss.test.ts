import { describe, expect, it } from 'vitest';
import {
  missChooseFouler,
  missChooseFoulKind,
  missChooseFtRebounder,
  missChooseRebounder,
  missChooseUnknownRebound,
  missChooseShooter,
  missCourtTap,
  missNextPossession,
  missStepBack,
  missStopsClock,
  openMiss,
  reboundIsOffensive,
} from './miss';
import { commitCapturePlaySchema } from './plays';

const id = '11111111-1111-4111-8111-111111111111';
const rebounder = '22222222-2222-4222-8222-222222222222';
const fouler = '33333333-3333-4333-8333-333333333333';

function miss(overrides: Record<string, unknown> = {}) {
  return {
    play: 'miss',
    gameId: id,
    periodNumber: 1,
    clockRemainingMs: 500000,
    side: 'home',
    coordX: 0.9,
    coordY: 0.5,
    shooterId: id,
    rebounderId: rebounder,
    foulerId: null,
    throws: [],
    ...overrides,
  };
}

describe('miss possession and clock', () => {
  it('keeps the ball on an offensive rebound and flips it on a defensive one', () => {
    expect(reboundIsOffensive('home', 'home')).toBe(true);
    expect(reboundIsOffensive('home', 'away')).toBe(false);
    expect(missNextPossession({
      shootingSide: 'away',
      reboundSide: 'away',
      personal: false,
      lastThrow: null,
    })).toBe('away');
    expect(missNextPossession({
      shootingSide: 'home',
      reboundSide: 'away',
      personal: false,
      lastThrow: null,
    })).toBe('away');
  });

  it('lets the last free throw decide the ball when the miss includes a personal', () => {
    expect(missNextPossession({
      shootingSide: 'home',
      reboundSide: 'home',
      personal: true,
      lastThrow: 'made',
    })).toBe('away');
    expect(missNextPossession({
      shootingSide: 'home',
      reboundSide: 'away',
      personal: true,
      lastThrow: 'miss',
    })).toBe('away');
    expect(missNextPossession({
      shootingSide: 'home',
      reboundSide: 'home',
      personal: true,
      lastThrow: 'miss',
    })).toBe('home');
    expect(missNextPossession({
      shootingSide: 'home',
      reboundSide: null,
      personal: true,
      lastThrow: 'miss',
    })).toBeNull();
    expect(missNextPossession({
      shootingSide: 'home',
      reboundSide: null,
      personal: true,
      lastThrow: 'made',
    })).toBe('away');
    expect(missNextPossession({
      shootingSide: 'home',
      reboundSide: null,
      personal: true,
      lastThrow: 'miss',
      foulKind: 'flagrant',
    })).toBe('home');
    expect(missNextPossession({
      shootingSide: 'away',
      reboundSide: 'home',
      personal: true,
      lastThrow: 'made',
      foulKind: 'disqualifying',
    })).toBe('away');
  });

  it('stops the clock only for a personal foul', () => {
    expect(missStopsClock(false)).toBe(false);
    expect(missStopsClock(true)).toBe(true);
  });
});

describe('miss sequence', () => {
  it('walks court, shooter, and rebound, then saves a clean miss', () => {
    const opened = openMiss('home', false);
    const tapped = missCourtTap(opened, 0.9, 0.5, true);
    expect(tapped.ok && tapped.draft.points).toBe(2);
    if (!tapped.ok) return;
    const shooting = missChooseShooter(tapped.draft, id);
    expect(shooting?.step).toBe('rebound');
    if (!shooting) return;
    const grabbed = missChooseRebounder(shooting, 'home', id);
    expect(grabbed.ok && grabbed.save).toBe(true);
  });

  it('rejects the other half and steps back one stage at a time', () => {
    const opened = openMiss('away', true);
    expect(missCourtTap(opened, 0.9, 0.5, false).ok).toBe(false);
    const tapped = missCourtTap(opened, 0.1, 0.5, false);
    expect(tapped.ok).toBe(true);
    if (!tapped.ok) return;
    const shooting = missChooseShooter(tapped.draft, id);
    expect(shooting?.step).toBe('fouler');
    expect(shooting?.rebounderId).toBeNull();
    if (!shooting) return;
    expect(missChooseRebounder(shooting, 'home', rebounder).ok).toBe(false);
    expect(missChooseFouler(shooting, id)).toBeNull();
    const fouled = missChooseFouler(shooting, fouler);
    expect(fouled?.step).toBe('kind');
    expect(fouled?.throwCount).toBe(2);
    if (!fouled) return;
    const back = missStepBack(fouled);
    expect(back).not.toBe('cancel');
    if (back === 'cancel') return;
    expect(back.step).toBe('fouler');
    const backShooter = missStepBack(back);
    expect(backShooter).not.toBe('cancel');
    if (backShooter === 'cancel') return;
    expect(backShooter.step).toBe('shooter');
    expect(backShooter.shooterId).toBeNull();
    expect(missStepBack(opened)).toBe('cancel');
  });
});

describe('miss play schema', () => {
  it('accepts a miss with a rebound and no free throws', () => {
    expect(commitCapturePlaySchema.safeParse(miss()).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({ rebounderId: id })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({ rebounderId: null, unknownRebound: true })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({ rebounderId: null })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({ unknownRebound: true })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({ rebounderId: null, unknownRebound: true, deadBall: 'lodged' })).success).toBe(false);
  });

  it('accepts a miss with no rebound when the ball lodges or the period ends', () => {
    expect(commitCapturePlaySchema.safeParse(miss({ rebounderId: null, deadBall: 'lodged' })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({ rebounderId: null, deadBall: 'period_end' })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({ rebounderId: id, deadBall: 'lodged' })).success).toBe(false);
  });

  it('accepts free throws with a fouler, and a rebound only when the last personal one is missed', () => {
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: null,
      throws: ['miss', 'made'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: null,
      throws: ['miss', 'miss', 'made'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: null,
      throws: ['made'],
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: rebounder,
      throws: ['miss', 'miss'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: rebounder,
      throws: ['made', 'miss'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'flagrant',
      rebounderId: null,
      throws: ['miss', 'miss'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'flagrant',
      rebounderId: rebounder,
      throws: ['miss', 'miss'],
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: null,
      unknownRebound: true,
      throws: ['miss', 'miss'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: rebounder,
      unknownRebound: true,
      throws: ['miss', 'miss'],
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: null,
      unknownRebound: true,
      throws: ['made', 'made'],
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: null,
      throws: ['miss', 'miss'],
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({ throws: ['miss'] })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: null,
      throws: [],
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      foulKind: 'personal',
      rebounderId: rebounder,
      throws: ['made', 'made'],
    })).success).toBe(false);
  });

  it('steps back from a free-throw rebound to the marked sequence', () => {
    const opened = openMiss('home', true);
    const tapped = missCourtTap(opened, 0.9, 0.5, true);
    if (!tapped.ok) return;
    const shooting = missChooseShooter(tapped.draft, id);
    if (!shooting) return;
    const fouled = missChooseFouler(shooting, fouler);
    if (!fouled) return;
    const counted = missChooseFoulKind(fouled, 'personal');
    if (!counted) return;
    const draft = { ...counted, step: 'ft_rebound' as const, ftMarks: ['made', 'miss'] as ('made' | 'miss')[] };
    expect(missChooseFtRebounder(draft, 'away', rebounder).ok).toBe(true);
    const unknown = missChooseUnknownRebound(draft);
    expect(unknown.ok && unknown.draft.unknownRebound).toBe(true);
    expect(unknown.ok && unknown.draft.reboundSide).toBe('away');
    expect(unknown.ok && unknown.draft.rebounderId).toBeNull();
    expect(missChooseUnknownRebound({ ...draft, ftMarks: ['made'] }).ok).toBe(false);
    const back = missStepBack(draft);
    expect(back).not.toBe('cancel');
    if (back === 'cancel') return;
    expect(back.step).toBe('ft');
    expect(back.ftMarks).toEqual(['made', 'miss']);
    expect(back.rebounderId).toBeNull();
  });

  it('rejects a foul charged to the shooter', () => {
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: id,
      foulKind: 'personal',
      rebounderId: null,
      throws: ['miss', 'made'],
    })).success).toBe(false);
  });
});
