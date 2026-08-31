/**
 * todoTriage.test.ts — the arithmetic behind dragging a Whenever row onto another card.
 *
 * ⚠️ **This file is the ONLY automated check that can see this feature.** Playwright cannot
 * activate `activateAfterLongPress` in the web build at all (AGENTS.md, measured 2026-08-07
 * against the app's own shipped drag), so the gesture is unreachable by `npm run preview` and
 * invisible to every screenshot. Splitting the decisions out of the gesture is what makes them
 * testable, and this is the test that pays for the split.
 */
import { triageTargetAt, triagePatch, type TriageZone } from '@/lib/todoTriage';

const ZONES: TriageZone[] = [
  { target: 'today', top: 100, bottom: 200 },
  { target: 'calendar', top: 200, bottom: 300 },
  { target: 'recurring', top: 400, bottom: 500 },
];

describe('triageTargetAt', () => {
  it('finds the card under the finger', () => {
    expect(triageTargetAt(150, ZONES)).toBe('today');
    expect(triageTargetAt(250, ZONES)).toBe('calendar');
    expect(triageTargetAt(450, ZONES)).toBe('recurring');
  });

  it('returns null off every card — which is the common case, not an edge one', () => {
    // Most of a drag happens inside the Whenever card itself, where the gesture belongs to the
    // reorder. If this ever returned a target there, dragging to reorder would retime the task.
    expect(triageTargetAt(50, ZONES)).toBeNull();
    expect(triageTargetAt(350, ZONES)).toBeNull();
    expect(triageTargetAt(600, ZONES)).toBeNull();
  });

  it('is half-open, so two abutting cards never both claim a pixel', () => {
    // `today` ends where `calendar` begins. A closed interval would make y=200 ambiguous and the
    // answer would depend on the order of the array.
    expect(triageTargetAt(200, ZONES)).toBe('calendar');
    expect(triageTargetAt(199.9, ZONES)).toBe('today');
  });

  it('has no zones to match before anything is measured', () => {
    expect(triageTargetAt(150, [])).toBeNull();
  });
});

describe('triagePatch', () => {
  const ctx = { today: '2026-09-01', calendarDate: '2026-10-15' };

  it('dates a task to today when dropped on Today', () => {
    expect(triagePatch('today', ctx)).toEqual({ date: '2026-09-01', hasStartDate: true });
  });

  it("uses the Calendar card's OWN date, which may not be in this month", () => {
    // The card owns its range, so a drop there must land inside whatever range is showing.
    // Assuming today would silently put the row on a card the user is not looking at.
    expect(triagePatch('calendar', ctx)).toEqual({ date: '2026-10-15', hasStartDate: true });
  });

  it('makes a task daily when dropped on Recurring', () => {
    expect(triagePatch('recurring', ctx)).toEqual({
      date: '2026-09-01',
      hasStartDate: true,
      recurring: 'daily',
    });
  });

  it('ALWAYS stamps a date — the bug this exists to prevent', () => {
    // An undated task's stored `date` is whatever day it was created on, because `hasStartDate:
    // false` is what undated means and `setTasksDated` deliberately leaves `date` alone. Flipping
    // the flag without stamping would land the task in the past.
    for (const target of ['today', 'calendar', 'recurring'] as const) {
      const patch = triagePatch(target, ctx);
      expect(typeof patch.date).toBe('string');
      expect(patch.hasStartDate).toBe(true);
    }
  });

  it('writes nothing but the scheduling fields', () => {
    // A drop retimes a task; it does not edit one. If this ever grows a `title` or a `done`, a
    // gesture nobody can test has started changing content.
    for (const target of ['today', 'calendar', 'recurring'] as const) {
      const keys = Object.keys(triagePatch(target, ctx)).sort();
      expect(keys.every((k) => ['date', 'hasStartDate', 'recurring'].includes(k))).toBe(true);
    }
  });
});
