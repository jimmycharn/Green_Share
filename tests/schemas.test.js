import { describe, it, expect } from 'vitest';
import { validateAction } from '../lib/schemas.js';

describe('validateAction', () => {
  it('passes through actions without a schema (by design)', () => {
    // validateAction intentionally returns ok=true for unknown actions —
    // the action dispatcher in app/api/action/route.js is responsible for
    // rejecting unknown actions. This keeps schemas.js focused on shape
    // validation only.
    const r = validateAction('SOMETHING_BAD', { arbitrary: 'payload' });
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ arbitrary: 'payload' });
  });

  describe('check_user', () => {
    it('accepts valid line_id', () => {
      const r = validateAction('check_user', { line_id: 'U1234567890abcdef' });
      expect(r.ok).toBe(true);
      expect(r.data.line_id).toBe('U1234567890abcdef');
    });

    it('rejects missing line_id', () => {
      const r = validateAction('check_user', {});
      expect(r.ok).toBe(false);
      expect(r.message).toContain('line_id');
    });

    it('rejects empty line_id', () => {
      const r = validateAction('check_user', { line_id: '' });
      expect(r.ok).toBe(false);
    });
  });

  describe('register', () => {
    it('accepts complete payload', () => {
      const r = validateAction('register', {
        line_id: 'U1234567890abcdef',
        name: 'Test User',
        nickname: 'Test',
        phone: '0812345678',
        bank_account: '1234567890',
        role: 'MEMBER',
      });
      expect(r.ok).toBe(true);
    });

    it('rejects invalid role', () => {
      const r = validateAction('register', {
        line_id: 'U1234567890abcdef',
        name: 'Test',
        nickname: 'T',
        phone: '0812345678',
        bank_account: '123',
        role: 'HACKER',
      });
      expect(r.ok).toBe(false);
    });
  });

  describe('submit_bid', () => {
    it('coerces numeric strings', () => {
      const r = validateAction('submit_bid', {
        circle_id: 'C0001',
        member_id: 'M0001',
        period: '3',
        bid_amount: '500.5',
      });
      expect(r.ok).toBe(true);
      expect(r.data.period).toBe(3);
      expect(r.data.bid_amount).toBe(500.5);
    });

    it('rejects negative bid', () => {
      const r = validateAction('submit_bid', {
        circle_id: 'C0001',
        member_id: 'M0001',
        period: 1,
        bid_amount: -10,
      });
      expect(r.ok).toBe(false);
    });
  });
});
