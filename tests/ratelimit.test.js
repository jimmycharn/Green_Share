import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { rateLimit, _resetRateLimitStore } from '../lib/ratelimit.js';

describe('rateLimit', () => {
  beforeEach(() => {
    _resetRateLimitStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to max requests', () => {
    for (let i = 0; i < 60; i++) {
      const r = rateLimit('user-a:check_user', { max: 60, windowMs: 60_000 });
      expect(r.ok).toBe(true);
    }
  });

  it('blocks the (max+1)th request', () => {
    for (let i = 0; i < 60; i++) {
      rateLimit('user-b:check_user', { max: 60, windowMs: 60_000 });
    }
    const blocked = rateLimit('user-b:check_user', { max: 60, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('isolates buckets per key', () => {
    for (let i = 0; i < 60; i++) {
      rateLimit('user-c:action-a', { max: 60, windowMs: 60_000 });
    }
    const sameUserDiffAction = rateLimit('user-c:action-b', { max: 60, windowMs: 60_000 });
    expect(sameUserDiffAction.ok).toBe(true);
  });

  it('refills after window passes (sliding)', () => {
    for (let i = 0; i < 60; i++) {
      rateLimit('user-d:check_user', { max: 60, windowMs: 60_000 });
    }
    expect(rateLimit('user-d:check_user', { max: 60, windowMs: 60_000 }).ok).toBe(false);

    vi.advanceTimersByTime(61_000);

    expect(rateLimit('user-d:check_user', { max: 60, windowMs: 60_000 }).ok).toBe(true);
  });

  it('returns ok with empty key (no limiting)', () => {
    expect(rateLimit('', { max: 60, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit(null, { max: 60, windowMs: 60_000 }).ok).toBe(true);
  });
});
