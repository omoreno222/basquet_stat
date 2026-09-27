/**
 * Rate limiting utilities for password reset
 */

const RATE_LIMIT_MINUTES = 15;

/**
 * Check if a password reset request is within rate limit
 * @param lastRequestTime The timestamp of the last request
 * @returns true if within rate limit (allowed), false if rate limited
 */
export function isWithinRateLimit(lastRequestTime: Date | string | null): boolean {
  if (!lastRequestTime) {
    return true; // No previous request, allow
  }

  const lastRequest = new Date(lastRequestTime);
  const now = new Date();
  const minutesElapsed = (now.getTime() - lastRequest.getTime()) / (1000 * 60);

  return minutesElapsed >= RATE_LIMIT_MINUTES;
}

/**
 * Get the time remaining until the next allowed request
 * @param lastRequestTime The timestamp of the last request
 * @returns Minutes remaining until next allowed request, or 0 if allowed now
 */
export function getRateLimitRemaining(lastRequestTime: Date | string | null): number {
  if (!lastRequestTime) {
    return 0;
  }

  const lastRequest = new Date(lastRequestTime);
  const now = new Date();
  const minutesElapsed = (now.getTime() - lastRequest.getTime()) / (1000 * 60);
  const remaining = RATE_LIMIT_MINUTES - minutesElapsed;

  return Math.max(0, Math.ceil(remaining));
}
