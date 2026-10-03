import { describe, expect, it } from 'vitest';
import {
  missChooseFouler,
  missChooseRebounder,
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
    })).toBeNull();
    expect(missNextPossession({
      shootingSide: 'home',
      reboundSide: null,
      personal: true,
      lastThrow: 'made',
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
    expect(fouled?.step).toBe('ft');
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
    expect(commitCapturePlaySchema.safeParse(miss({ rebounderId: null })).success).toBe(false);
  });

  it('accepts one, two, or three free throws only together with a fouler and no rebound', () => {
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      rebounderId: null,
      throws: ['made'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      rebounderId: null,
      throws: ['miss', 'made'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      rebounderId: null,
      throws: ['miss', 'miss', 'made'],
    })).success).toBe(true);
    expect(commitCapturePlaySchema.safeParse(miss({ throws: ['miss'] })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      rebounderId: null,
      throws: [],
    })).success).toBe(false);
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: fouler,
      rebounderId: rebounder,
      throws: ['made'],
    })).success).toBe(false);
  });

  it('rejects a foul charged to the shooter', () => {
    expect(commitCapturePlaySchema.safeParse(miss({
      foulerId: id,
      rebounderId: null,
      throws: ['made'],
    })).success).toBe(false);
  });
});
