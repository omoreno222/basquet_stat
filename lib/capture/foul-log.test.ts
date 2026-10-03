import { describe, expect, it } from 'vitest';
import { foulOrdinalCopy } from './plays';

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
