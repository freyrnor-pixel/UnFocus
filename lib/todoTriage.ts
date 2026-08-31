/**
 * todoTriage.ts — where a Whenever row lands when you drag it onto another card, and what that
 * writes.
 *
 * ⚠️ **Pure and dependency-free ON PURPOSE, and the reason is a measurement, not tidiness.**
 * `AGENTS.md`: Playwright cannot activate `Gesture.Pan().activateAfterLongPress(400)` in the web
 * build **at all** — confirmed against the app's own shipped drag, which also moves nothing there
 * — so a drag-only capability is one no automated check in this repo can reach. The standing rule
 * that follows is *"split the arithmetic out into a pure function and test that instead"*
 * (`slotAtPoint()` in lib/designLab.ts is the worked example). This is that split: every decision
 * the gesture makes lives here and is unit-tested, and the gesture itself only supplies a number.
 *
 * The TAP equivalent is not in this file and does not need to be: a Whenever row already carries
 * `handleMoveSection` (→ Today) and its repeat picker (→ Recurring), and both predate this. The
 * rule that every drag has a tap equivalent is satisfied by those, not by something new here.
 *
 * Connections:
 *   Imports → nothing
 *   Used by → components/TodoSurface.tsx (the Whenever card's drag)
 *   Data    → none — it returns a patch, it does not write one
 *
 * Edit notes:
 *   - **A patch here must be a patch `store/useTaskStore.ts`'s `update()` would accept**, and the
 *     `date`/`hasStartDate` PAIR is the part to get right. See each branch's own note: moving TO a
 *     dated card must stamp `date`, because an undated task's stored date is whatever day it was
 *     created on and is often long past.
 *   - Zones are measured in WINDOW space at drag START, never at layout. A card scrolls inside a
 *     scrolling screen and a scroll fires no `onLayout`, so a zone captured at layout time is a
 *     zone that has since moved — the same trap `lib/useDragReorder.ts` documents for its rows.
 */

/** The cards a Whenever row can be dropped onto. Whenever itself is not one — that is a reorder. */
export type TriageTarget = 'today' | 'calendar' | 'recurring';

/** One card's drop area, in window coordinates, as measured at drag start. */
export type TriageZone = { target: TriageTarget; top: number; bottom: number };

/**
 * Which card the finger is over, or `null` for none.
 *
 * `null` is the common case and the important one: most of a drag happens inside the Whenever
 * card itself, where the gesture belongs to the reorder and this must keep its hands off. Zones
 * are half-open (`top <= y < bottom`) so two cards that abut cannot both claim the same pixel.
 */
export function triageTargetAt(y: number, zones: readonly TriageZone[]): TriageTarget | null {
  for (const z of zones) {
    if (y >= z.top && y < z.bottom) return z.target;
  }
  return null;
}

/** What a drop needs to know about the screen's current state. */
export type TriageContext = {
  /** Today, `YYYY-MM-DD`. */
  today: string;
  /**
   * The date a Calendar drop should use — the Calendar card owns its own range, so this is
   * whichever date in that range the screen decided a new row belongs on. Never assumed to be
   * today: the card may be showing next month.
   */
  calendarDate: string;
};

/** The fields a drop writes. Deliberately narrow — a drop retimes a task, it does not edit one. */
export type TriagePatch = {
  date?: string;
  hasStartDate?: boolean;
  recurring?: 'daily';
};

/**
 * The patch a drop onto `target` writes.
 *
 * ⚠️ **Every branch stamps `date`, and that is not redundant.** An undated task's stored `date` is
 * whatever day it happened to be created on — often long past — because `hasStartDate: false` is
 * what "undated" means in this model and `setTasksDated` deliberately leaves `date` alone so a
 * task parked from next Thursday keeps Thursday. Flipping `hasStartDate` without stamping would
 * land the task in the past, which is the one outcome a drag onto "Today" must not produce.
 */
export function triagePatch(target: TriageTarget, ctx: TriageContext): TriagePatch {
  switch (target) {
    case 'today':
      return { date: ctx.today, hasStartDate: true };
    case 'calendar':
      return { date: ctx.calendarDate, hasStartDate: true };
    case 'recurring':
      // Daily is the only honest default. The card selects on `recurring !== 'none'`, so ANY
      // value moves the row there — and of the four, daily is the one that needs no second
      // decision from the user (weekly needs weekdays, monthly needs a day-of-month). They can
      // change it on the row, which is where every other recurrence choice is already made.
      return { date: ctx.today, hasStartDate: true, recurring: 'daily' };
  }
}
