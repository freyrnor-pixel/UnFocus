/**
 * taskRotation.test.ts — chores that take turns (2026-07-28, sharing phase 4).
 *
 * The property that matters most is DETERMINISM: the turn is a pure function of (rule,
 * date), so two paired phones agree without exchanging anything and no device ever writes
 * "advance the rotation". Everything else here guards the ways that could quietly break —
 * dates before the anchor, DST, week boundaries, and a roster slot left by a removed person.
 */
import {
  sanitizeRotationMode,
  periodsSince,
  rotationTurnIndex,
  rotationAssigneeFor,
  effectiveAssigneeId,
  isRotating,
  type RotationMode,
} from '@/lib/taskRotation';
import type { Task } from '@/store/useTaskStore';

function task(o: Partial<Task>): Task {
  return {
    id: 't', title: 'T', date: '2026-07-15', taskType: 'start-at', done: false,
    recurring: 'none', recurringDays: [], weekInterval: 1, monthlyMode: 'day',
    monthDay: 1, monthOrdinal: 'first', monthWeekday: 0, energyEnabled: false,
    energyValue: 1, sortOrder: 0, hint: '', followsTaskId: null, hasStartDate: true,
    sharedOut: false, assignee: '', assigneeId: '', createdByPersonId: '',
    tagIds: [], rotation: 'none', rotationPersonIds: [], rotationAnchor: '',
    steps: [], ...o,
  } as Task;
}

const ANCHOR = '2026-07-13'; // a Monday
const ROSTER = ['ann', 'bo', 'cy'];

describe('sanitizeRotationMode', () => {
  it('accepts the four real modes', () => {
    for (const m of ['none', 'daily', 'weekly', 'monthly'] as RotationMode[]) {
      expect(sanitizeRotationMode(m)).toBe(m);
    }
  });

  it('treats anything else as not rotating, rather than throwing', () => {
    // The column can arrive from another device or an older build.
    expect(sanitizeRotationMode('fortnightly')).toBe('none');
    expect(sanitizeRotationMode(undefined)).toBe('none');
    expect(sanitizeRotationMode(null)).toBe('none');
    expect(sanitizeRotationMode(7)).toBe('none');
  });
});

describe('periodsSince', () => {
  it('counts days', () => {
    expect(periodsSince('daily', ANCHOR, '2026-07-13')).toBe(0);
    expect(periodsSince('daily', ANCHOR, '2026-07-14')).toBe(1);
    expect(periodsSince('daily', ANCHOR, '2026-08-12')).toBe(30);
  });

  it('counts Mon–Sun weeks, so a turn changes at the same boundary as the rest of the app', () => {
    expect(periodsSince('weekly', ANCHOR, '2026-07-19')).toBe(0); // Sunday, same week
    expect(periodsSince('weekly', ANCHOR, '2026-07-20')).toBe(1); // next Monday
  });

  it('counts calendar months, not 30-day blocks', () => {
    expect(periodsSince('monthly', '2026-01-31', '2026-02-01')).toBe(1);
    expect(periodsSince('monthly', '2026-07-13', '2027-01-01')).toBe(6);
  });

  it('survives a DST boundary without dropping or gaining a day', () => {
    // Europe/Oslo springs forward 2026-03-29 and falls back 2026-10-25. Subtracting local
    // Dates across those yields 23/25 hours and floors to the wrong day.
    expect(periodsSince('daily', '2026-03-28', '2026-03-30')).toBe(2);
    expect(periodsSince('daily', '2026-10-24', '2026-10-26')).toBe(2);
  });

  it('is zero for a non-rotating task', () => {
    expect(periodsSince('none', ANCHOR, '2026-12-01')).toBe(0);
  });
});

describe('rotationTurnIndex', () => {
  it('walks the roster and wraps', () => {
    const at = (d: string) => rotationTurnIndex('daily', ANCHOR, 3, d);
    expect(at('2026-07-13')).toBe(0);
    expect(at('2026-07-14')).toBe(1);
    expect(at('2026-07-15')).toBe(2);
    expect(at('2026-07-16')).toBe(0);
  });

  it('wraps BACKWARDS before the anchor instead of going negative', () => {
    // The week view renders Monday even if rotation was switched on on Wednesday.
    expect(rotationTurnIndex('daily', ANCHOR, 3, '2026-07-12')).toBe(2);
    expect(rotationTurnIndex('daily', ANCHOR, 3, '2026-07-11')).toBe(1);
  });

  it('is null when there is nothing to rotate', () => {
    expect(rotationTurnIndex('none', ANCHOR, 3, '2026-07-15')).toBeNull();
    expect(rotationTurnIndex('daily', ANCHOR, 0, '2026-07-15')).toBeNull();
    expect(rotationTurnIndex('daily', '', 3, '2026-07-15')).toBeNull();
  });

  it('is the same answer for the same inputs — the whole reason nothing is stored', () => {
    // Two phones, no exchange, same result. Re-asking must never advance anything.
    const first = rotationTurnIndex('weekly', ANCHOR, 3, '2026-08-10');
    const again = rotationTurnIndex('weekly', ANCHOR, 3, '2026-08-10');
    expect(again).toBe(first);
  });
});

describe('rotationAssigneeFor', () => {
  const rotating = task({ rotation: 'daily', rotationPersonIds: ROSTER, rotationAnchor: ANCHOR });

  it('names the person whose turn it is', () => {
    expect(rotationAssigneeFor(rotating, '2026-07-13')).toBe('ann');
    expect(rotationAssigneeFor(rotating, '2026-07-14')).toBe('bo');
    expect(rotationAssigneeFor(rotating, '2026-07-15')).toBe('cy');
    expect(rotationAssigneeFor(rotating, '2026-07-16')).toBe('ann');
  });

  it('returns nothing for a task that does not rotate', () => {
    expect(rotationAssigneeFor(task({ assigneeId: 'ann' }), '2026-07-15')).toBe('');
  });

  it('keeps a removed person\'s slot rather than re-indexing everyone after them', () => {
    // Dropping the slot would silently change whose turn every future period is.
    const withGap = task({
      rotation: 'daily',
      rotationPersonIds: ['ann', 'gone', 'cy'],
      rotationAnchor: ANCHOR,
    });
    expect(rotationAssigneeFor(withGap, '2026-07-15')).toBe('cy');
  });
});

describe('effectiveAssigneeId', () => {
  it('prefers the rotation turn over the fixed assignee', () => {
    const t = task({
      assigneeId: 'fixed',
      rotation: 'daily',
      rotationPersonIds: ROSTER,
      rotationAnchor: ANCHOR,
    });
    expect(effectiveAssigneeId(t, '2026-07-14')).toBe('bo');
  });

  it('falls back to the fixed assignee, so every existing call site keeps its meaning', () => {
    expect(effectiveAssigneeId(task({ assigneeId: 'fixed' }), '2026-07-14')).toBe('fixed');
    expect(effectiveAssigneeId(task({}), '2026-07-14')).toBe('');
  });
});

describe('isRotating', () => {
  it('needs a mode AND at least two people to actually change hands', () => {
    expect(isRotating(task({ rotation: 'daily', rotationPersonIds: ROSTER }))).toBe(true);
    expect(isRotating(task({ rotation: 'daily', rotationPersonIds: ['ann'] }))).toBe(false);
    expect(isRotating(task({ rotation: 'none', rotationPersonIds: ROSTER }))).toBe(false);
  });
});
