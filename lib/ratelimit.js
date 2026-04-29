/**
 * Lightweight in-memory rate limiter (sliding window).
 *
 * Caveats:
 *  - Works per-instance. Serverless cold starts reset the window,
 *    and scaled deployments don't share state. Good enough for dev and
 *    a first line of defense in production.
 *  - For production multi-instance, replace with Upstash/Redis-backed limiter.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // per key per window

const store = new Map(); // key -> number[] of timestamps

export function rateLimit(key, { max = MAX_REQUESTS, windowMs = WINDOW_MS } = {}) {
  if (!key) return { ok: true, remaining: max };

  const now = Date.now();
  const threshold = now - windowMs;
  const bucket = (store.get(key) || []).filter((t) => t > threshold);
  bucket.push(now);
  store.set(key, bucket);

  // Opportunistic cleanup to prevent unbounded growth
  if (store.size > 5000) {
    for (const [k, arr] of store) {
      const filtered = arr.filter((t) => t > threshold);
      if (filtered.length === 0) store.delete(k);
      else store.set(k, filtered);
    }
  }

  const count = bucket.length;
  return {
    ok: count <= max,
    remaining: Math.max(0, max - count),
    retryAfterMs: count > max ? windowMs : 0,
  };
}

/** Test-only: clears all buckets. Do not call in production code. */
export function _resetRateLimitStore() {
  store.clear();
}
