import { describe, it, expect } from 'vitest';
import { isWithinRateLimit, getRateLimitRemaining } from './rate-limit';

describe('isWithinRateLimit', () => {
  it('should allow request if no previous request', () => {
    expect(isWithinRateLimit(null)).toBe(true);
  });

  it('should allow request if more than 15 minutes elapsed', () => {
    const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
    expect(isWithinRateLimit(sixteenMinutesAgo)).toBe(true);
  });

  it('should block request if less than 15 minutes elapsed', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    expect(isWithinRateLimit(tenMinutesAgo)).toBe(false);
  });

  it('should block request if exactly 14 minutes elapsed', () => {
    const fourteenMinutesAgo = new Date(Date.now() - 14 * 60 * 1000);
    expect(isWithinRateLimit(fourteenMinutesAgo)).toBe(false);
  });

  it('should allow request if exactly 15 minutes elapsed', () => {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    expect(isWithinRateLimit(fifteenMinutesAgo)).toBe(true);
  });

  it('should handle string timestamps', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(isWithinRateLimit(tenMinutesAgo)).toBe(false);

    const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000).toISOString();
    expect(isWithinRateLimit(sixteenMinutesAgo)).toBe(true);
  });
});

describe('getRateLimitRemaining', () => {
  it('should return 0 if no previous request', () => {
    expect(getRateLimitRemaining(null)).toBe(0);
  });

  it('should return 0 if more than 15 minutes elapsed', () => {
    const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
    expect(getRateLimitRemaining(sixteenMinutesAgo)).toBe(0);
  });

  it('should return remaining minutes if within rate limit', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const remaining = getRateLimitRemaining(tenMinutesAgo);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5);
  });

  it('should return 1 minute when 14 minutes have elapsed', () => {
    const fourteenMinutesAgo = new Date(Date.now() - 14 * 60 * 1000);
    const remaining = getRateLimitRemaining(fourteenMinutesAgo);
    expect(remaining).toBe(1);
  });

  it('should round up to nearest minute', () => {
    const fourteenMinutesThirtySecondsAgo = new Date(Date.now() - (14.5 * 60 * 1000));
    const remaining = getRateLimitRemaining(fourteenMinutesThirtySecondsAgo);
    expect(remaining).toBe(1);
  });

  it('should handle string timestamps', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const remaining = getRateLimitRemaining(tenMinutesAgo);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5);
  });
});
