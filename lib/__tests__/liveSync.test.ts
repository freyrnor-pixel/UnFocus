/**
 * liveSync.test.ts — Tests for the Decision 038b LWW data model
 *
 * Covers the pure, DB-free parts: the last-write-wins resolver (incomingWins)
 * including the deterministic origin-device tiebreak, and the untrusted-input
 * guard (parseDelta). applyDelta/touchRow/softDelete are thin SQL over expo-sqlite
 * and are exercised at integration time, not here.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
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
    // People joined SyncTable on 2026-07-28 (to-do sharing phase 1). The guard is driven by
    // the SYNC_TABLES list now rather than a hardcoded two-table check, so this pins that
    // the widening actually reached parseDelta and didn't open the door to anything else.
    test('accepts the people table', () => {
      expect(parseDelta({ ...good, table: 'people', fields: { name: 'Sam' } })).not.toBeNull();
    });
    test('still rejects tables outside the whitelist', () => {
      for (const table of ['habits', 'medicines', 'app_meta', 'settings', '']) {
        expect(parseDelta({ ...good, table })).toBeNull();
      }
    });
  });

  // The receiver's view of the wire format — see the `is_self` note in lib/liveSync.ts.
  describe('people column whitelist', () => {
    const source = readFileSync(join(__dirname, '..', 'liveSync.ts'), 'utf8');
    const peopleBlock = source.slice(source.indexOf('people: ['), source.indexOf('};', source.indexOf('people: [')));

    test('is_self is NOT syncable', () => {
      // A peer's self row arriving with is_self=1 would give the receiving device two
      // "me" rows. If this ever needs to change, the receiver must translate the flag,
      // not accept it verbatim.
      expect(peopleBlock).not.toMatch(/['"]is_self['"]/);
    });
    test('device_id IS syncable', () => {
      // How the receiver tells a live person from one kept by hand — see usePeopleStore.
      expect(peopleBlock).toMatch(/['"]device_id['"]/);
    });
  });

  describe('task column whitelist', () => {
    const source = readFileSync(join(__dirname, '..', 'liveSync.ts'), 'utf8');
    const taskBlock = source.slice(source.indexOf('tasks: ['), source.indexOf('],', source.indexOf('tasks: [')));

    test('carries the person columns', () => {
      // Assignment used to be device-local, which made a shared list unusable: both phones
      // saw the task, neither could see whose it was.
      expect(taskBlock).toMatch(/['"]assignee_id['"]/);
      expect(taskBlock).toMatch(/['"]created_by_person_id['"]/);
    });
    test('does NOT carry the legacy assignee name mirror', () => {
      // `assignee` is a denormalised display copy of the person's name. Syncing it would
      // let a stale name overwrite a good one on the peer with no way to tell which is
      // current — the id is the truth, and the receiver derives the name from its own roster.
      expect(taskBlock).not.toMatch(/['"]assignee['"]/);
    });
  });
});
