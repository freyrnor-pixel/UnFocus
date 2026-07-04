/**
 * liveSync.test.ts — Tests for the Decision 038b LWW data model
 *
 * Covers the pure, DB-free parts: the last-write-wins resolver (incomingWins)
 * including the deterministic origin-device tiebreak, and the untrusted-input
 * guard (parseDelta). applyDelta/touchRow/softDelete are thin SQL over expo-sqlite
 * and are exercised at integration time, not here.
 */

import { incomingWins, parseDelta, RowDelta } from '@/lib/liveSync';

const T1 = '2026-07-04T10:00:00.000Z';
const T2 = '2026-07-04T10:00:05.000Z';

describe('Decision 038b — live-sync data model', () => {
  describe('incomingWins (LWW)', () => {
    test('missing local row: incoming always wins', () => {
      expect(incomingWins(null, { updatedAt: T1, originDeviceId: 'a' })).toBe(true);
    });
    test('newer timestamp wins', () => {
      expect(incomingWins({ updatedAt: T1, originDeviceId: 'a' }, { updatedAt: T2, originDeviceId: 'b' })).toBe(true);
    });
    test('older timestamp loses', () => {
      expect(incomingWins({ updatedAt: T2, originDeviceId: 'a' }, { updatedAt: T1, originDeviceId: 'b' })).toBe(false);
    });
    test('tie broken by greater origin device id', () => {
      expect(incomingWins({ updatedAt: T1, originDeviceId: 'devA' }, { updatedAt: T1, originDeviceId: 'devZ' })).toBe(true);
      expect(incomingWins({ updatedAt: T1, originDeviceId: 'devZ' }, { updatedAt: T1, originDeviceId: 'devA' })).toBe(false);
    });
    test('tie decision is symmetric across both devices', () => {
      const a = { updatedAt: T1, originDeviceId: 'devA' };
      const z = { updatedAt: T1, originDeviceId: 'devZ' };
      // Exactly one side accepts the other's write — no divergence.
      expect(incomingWins(a, z)).not.toBe(incomingWins(z, a));
    });
  });

  describe('parseDelta (untrusted input guard)', () => {
    const good: RowDelta = {
      table: 'tasks',
      id: 'x1',
      updatedAt: T1,
      originDeviceId: 'devA',
      deletedAt: null,
      fields: { title: 'buy milk' },
    };
    test('accepts a well-formed delta', () => {
      expect(parseDelta(good)).toEqual(good);
    });
    test('accepts a tombstone (deletedAt set)', () => {
      expect(parseDelta({ ...good, deletedAt: T2 })).not.toBeNull();
    });
    test('rejects an unknown table', () => {
      expect(parseDelta({ ...good, table: 'habits' })).toBeNull();
    });
    test('rejects missing id / bad types', () => {
      expect(parseDelta({ ...good, id: 42 })).toBeNull();
      expect(parseDelta({ ...good, fields: null })).toBeNull();
      expect(parseDelta({ ...good, deletedAt: 5 })).toBeNull();
    });
    test('rejects null / non-object', () => {
      expect(parseDelta(null)).toBeNull();
      expect(parseDelta('nope')).toBeNull();
    });
  });
});
