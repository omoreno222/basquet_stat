import { describe, expect, it } from 'vitest';
import { foulOrdinalCopy, playerMustLeaveAfterFoul } from './plays';

describe('foulOrdinalCopy', () => {
  it('names the first four fouls and marks the fifth as out', () => {
    expect(foulOrdinalCopy(1)?.fallback).toBe('1st');
    expect(foulOrdinalCopy(2)?.fallback).toBe('2nd');
    expect(foulOrdinalCopy(3)?.fallback).toBe('3rd');
    expect(foulOrdinalCopy(4)?.fallback).toBe('4th');
    expect(foulOrdinalCopy(5)?.fallback).toBe('5th (Out)');
  });

  it('keeps a later foul on the fifth', () => {
    expect(foulOrdinalCopy(6)?.fallback).toBe('5th (Out)');
  });

  it('skips a missing count', () => {
    expect(foulOrdinalCopy(0)).toBeNull();
  });
});

describe('playerMustLeaveAfterFoul', () => {
  it('keeps a player on the court through four personals', () => {
    expect(playerMustLeaveAfterFoul(3, 'personal')).toBe(false);
    expect(playerMustLeaveAfterFoul(4, 'personal')).toBe(true);
  });

  it('counts every player foul toward the fifth', () => {
    expect(playerMustLeaveAfterFoul(4, 'technical')).toBe(true);
    expect(playerMustLeaveAfterFoul(4, 'disruptive')).toBe(true);
    expect(playerMustLeaveAfterFoul(4, 'double')).toBe(true);
  });

  it('sends a player out on the first flagrant or disqualifying foul', () => {
    expect(playerMustLeaveAfterFoul(0, 'flagrant')).toBe(true);
    expect(playerMustLeaveAfterFoul(0, 'disqualifying')).toBe(true);
  });

  it('ignores a coach technical with no player foul', () => {
    expect(playerMustLeaveAfterFoul(4, null)).toBe(false);
  });
});
