/**
 * taskRepeatAfterDone.test.ts — "repeat N days after it's done" (2026-10-26, lib/taskReset.ts).
 *
 * Connections:
 *   Imports → lib/taskReset
 *   Used by → jest
 *   Data    → none
 */
import { isWashedAway, nextAfterDoneDate, recurringResetPatch, type ResettableTask } from '@/lib/taskReset';

function task(over: Partial<ResettableTask> = {}): ResettableTask {
  return {
    recurring: 'none',
    date: '2026-10-01',
    hasStartDate: true,
    recurringDays: [],
    weekInterval: 1,
    monthlyMode: 'day',
    monthDay: 1,
    monthOrdinal: 'first',
    monthWeekday: 0,
    done: true,
    doneAt: '09:00',
    doneOn: '2026-10-20',
    repeatAfterDays: 7,
    ...over,
  };
}

describe('repeat after done', () => {
  it('stays done until done_on + N', () => {
    expect(recurringResetPatch(task(), '2026-10-26')).toBeNull();
  });

  it('comes back dated done_on + N, to do again', () => {
    expect(recurringResetPatch(task(), '2026-10-27')).toEqual({
      date: '2026-10-27',
      hasStartDate: true,
      done: false,
      doneAt: '',
      doneOn: '',
    });
  });

  it('a late open still dates it on the day it came due (no pile-up, no lateness)', () => {
    expect(recurringResetPatch(task(), '2026-11-15')?.date).toBe('2026-10-27');
  });

  it('done late moves the next one along', () => {
    expect(nextAfterDoneDate(task({ doneOn: '2026-11-03' }))).toBe('2026-11-10');
  });

  it('off, not done, or no done_on → no patch', () => {
    expect(recurringResetPatch(task({ repeatAfterDays: 0 }), '2026-12-01')).toBeNull();
    expect(recurringResetPatch(task({ done: false }), '2026-12-01')).toBeNull();
    expect(recurringResetPatch(task({ doneOn: '' }), '2026-12-01')).toBeNull();
    expect(recurringResetPatch(task({ repeatAfterDays: undefined }), '2026-12-01')).toBeNull();
  });

  it('a plain one-off is untouched (the rule is opt-in)', () => {
    expect(recurringResetPatch(task({ repeatAfterDays: 0, done: true }), '2027-01-01')).toBeNull();
  });

  it('never washes away', () => {
    const base = { date: '2026-10-01', done: false, recurring: 'none' as const, hasStartDate: true, cardType: 'standard' as const, lastActedAt: '2026-09-01T00:00:00.000Z' };
    expect(isWashedAway({ ...base, repeatAfterDays: 7 }, '2026-10-26', Date.parse('2026-10-26T12:00:00Z'))).toBe(false);
    expect(isWashedAway({ ...base, repeatAfterDays: 0 }, '2026-10-26', Date.parse('2026-10-26T12:00:00Z'))).toBe(true);
  });
});
