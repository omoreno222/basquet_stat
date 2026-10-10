/**
 * Postgres emits one games row per UPDATE, and the capture tablet writes the
 * clock and the score as separate updates. A clock row from before the score
 * write can arrive after it. `updated_at` moves forward on every write, so an
 * older timestamp is a stale picture of the whole row.
 *
 * The same timestamp is accepted: two writes in one millisecond are not ordered.
 * A missing timestamp is accepted so a payload without the column still applies.
 */
export function acceptGameUpdate(
  lastUpdatedAt: string | null,
  payloadUpdatedAt: string | null | undefined,
): boolean {
  if (!payloadUpdatedAt) return true;
  if (!lastUpdatedAt) return true;
  return payloadUpdatedAt >= lastUpdatedAt;
}
