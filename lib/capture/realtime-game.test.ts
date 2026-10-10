import { describe, expect, it } from 'vitest';
import { acceptGameUpdate } from './realtime-game';

describe('acceptGameUpdate', () => {
  it('accepts the first row and a row with no timestamp', () => {
    expect(acceptGameUpdate(null, '2026-10-09T12:00:00.000Z')).toBe(true);
    expect(acceptGameUpdate('2026-10-09T12:00:00.000Z', null)).toBe(true);
    expect(acceptGameUpdate('2026-10-09T12:00:00.000Z', undefined)).toBe(true);
  });

  it('drops a row written before the one already on screen', () => {
    expect(acceptGameUpdate(
      '2026-10-09T12:00:02.000Z',
      '2026-10-09T12:00:01.000Z',
    )).toBe(false);
  });

  it('keeps a row from the same millisecond and a later one', () => {
    expect(acceptGameUpdate(
      '2026-10-09T12:00:01.000Z',
      '2026-10-09T12:00:01.000Z',
    )).toBe(true);
    expect(acceptGameUpdate(
      '2026-10-09T12:00:01.000Z',
      '2026-10-09T12:00:02.000Z',
    )).toBe(true);
  });
});
