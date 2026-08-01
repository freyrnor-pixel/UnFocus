/**
 * cardType.test.ts — unit tests for lib/cardType.ts, the per-item card-type rules
 * (2026-08-01, phase 1), plus the two cross-module promises those rules exist to keep:
 * a 'note' card contributes nothing to Energy, and a 'stepped' card spends its energy
 * proportionally per step instead of all at once on completion.
 *
 * The store-level half of the feature (lossless type switching, progress surviving a
 * remount, notes staying out of completion counts) lives in __tests__/taskCardTypes.test.ts,
 * which needs the DB mock. Everything here is pure — plain values in, numbers out.
 */
import {
  CARD_TYPES,
  DEFAULT_CARD_TYPE,
  currentStepIndex,
  energySpentFraction,
  isCompletable,
  orderedSteps,
  sanitizeCardType,
  steppedProgress,
  visibleStepNumber,
} from '@/lib/cardType';
import { energyDeltaForDay, plannedEnergyDeltaForDay } from '@/lib/energy';
import { isActiveOn } from '@/lib/growth';
import type { Task } from '@/store/useTaskStore';

const step = (orderIndex: number, done: boolean) => ({ orderIndex, done });

function task(overrides: Partial<Task>): Task {
  return {
    id: 't', title: 'T', date: '2026-07-15', taskType: 'start-at', done: false,
    recurring: 'none', recurringDays: [], weekInterval: 1, monthlyMode: 'day',
    monthDay: 1, monthOrdinal: 'first', monthWeekday: 0, energyEnabled: false,
    energyValue: 1, sortOrder: 0, hint: '', followsTaskId: null, hasStartDate: false,
    sharedOut: false, assignee: '', assigneeId: '', createdByPersonId: '',
    cardType: 'standard', steps: [], ...overrides,
  } as Task;
}

describe('sanitizeCardType', () => {
  it('accepts every real type', () => {
    for (const type of CARD_TYPES) expect(sanitizeCardType(type)).toBe(type);
  });

  it('falls back to standard for anything else, rather than throwing', () => {
    // A row from a newer build, an out-of-band write, or a peer on a different version.
    for (const bad of ['', null, undefined, 42, {}, 'STANDARD', 'checklist']) {
      expect(sanitizeCardType(bad)).toBe(DEFAULT_CARD_TYPE);
    }
    expect(DEFAULT_CARD_TYPE).toBe('standard');
  });

  it('offers exactly four types — a fifth is explicitly out of scope', () => {
    expect(CARD_TYPES).toEqual(['standard', 'simple', 'note', 'stepped']);
  });
});

describe('isCompletable', () => {
  it('is true for everything except a note', () => {
    expect(isCompletable('standard')).toBe(true);
    expect(isCompletable('simple')).toBe(true);
    expect(isCompletable('stepped')).toBe(true);
    expect(isCompletable('note')).toBe(false);
  });
});

describe('orderedSteps', () => {
  it('sorts by orderIndex without mutating the input', () => {
    const steps = [step(2, false), step(0, true), step(1, false)];
    expect(orderedSteps(steps).map((s) => s.orderIndex)).toEqual([0, 1, 2]);
    expect(steps.map((s) => s.orderIndex)).toEqual([2, 0, 1]);
  });
});

describe('currentStepIndex — the derived "which step am I on"', () => {
  it('is the first not-done step, in order and not in array position', () => {
    // Deliberately out of array order: the answer must come from orderIndex.
    expect(currentStepIndex([step(2, false), step(0, true), step(1, true)])).toBe(2);
  });

  it('is 0 when nothing has been done yet', () => {
    expect(currentStepIndex([step(0, false), step(1, false)])).toBe(0);
  });

  it('is one past the end when every step is done', () => {
    expect(currentStepIndex([step(0, true), step(1, true)])).toBe(2);
  });

  it('steps BACKWARDS when a completed step is un-ticked — the undo path', () => {
    const advanced = [step(0, true), step(1, true), step(2, false)];
    expect(currentStepIndex(advanced)).toBe(2);
    // Un-ticking step 1 is the whole of "back a step": no pointer is rewound because
    // there is no pointer.
    const undone = [step(0, true), step(1, false), step(2, false)];
    expect(currentStepIndex(undone)).toBe(1);
  });

  it('cannot disagree with the done flags, however they were changed', () => {
    // A step ticked from the widget / the done-cascade / a peer — no reconciliation needed.
    expect(currentStepIndex([step(0, true), step(1, false), step(2, true)])).toBe(1);
  });

  it('is 0 for no steps at all', () => {
    expect(currentStepIndex([])).toBe(0);
  });
});

describe('steppedProgress', () => {
  it('reports partial progress as a count, never as a shortfall', () => {
    expect(steppedProgress([step(0, true), step(1, true), step(2, false)])).toEqual({ done: 2, total: 3 });
    expect(steppedProgress([step(0, false)])).toEqual({ done: 0, total: 1 });
    expect(steppedProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe('visibleStepNumber — the row label', () => {
  it('names the step being shown, 1-based, so a fresh card reads "Step 1 of N"', () => {
    // The bug this exists to prevent: labelling a card that is showing its FIRST step
    // "Step 0 of 2", which reads as having failed to start rather than as not started yet.
    expect(visibleStepNumber([step(0, false), step(1, false)])).toBe(1);
  });

  it('advances as steps are ticked', () => {
    expect(visibleStepNumber([step(0, true), step(1, false)])).toBe(2);
  });

  it('is null once every step is done, so the caller says so in words instead', () => {
    expect(visibleStepNumber([step(0, true), step(1, true)])).toBeNull();
  });

  it('is null for no steps at all — there is no step to name', () => {
    expect(visibleStepNumber([])).toBeNull();
  });

  it('goes back down when a step is un-ticked', () => {
    expect(visibleStepNumber([step(0, true), step(1, true), step(2, false)])).toBe(3);
    expect(visibleStepNumber([step(0, true), step(1, false), step(2, false)])).toBe(2);
  });
});

describe('energySpentFraction', () => {
  it('is all-or-nothing on done for standard and simple cards', () => {
    expect(energySpentFraction('standard', false, [])).toBe(0);
    expect(energySpentFraction('standard', true, [])).toBe(1);
    expect(energySpentFraction('simple', true, [])).toBe(1);
  });

  it('ignores step progress on a standard card — proportional spend is stepped-only', () => {
    const half = [step(0, true), step(1, false)];
    expect(energySpentFraction('standard', false, half)).toBe(0);
  });

  it('is proportional per step on a stepped card', () => {
    expect(energySpentFraction('stepped', false, [step(0, false), step(1, false)])).toBe(0);
    expect(energySpentFraction('stepped', false, [step(0, true), step(1, false)])).toBe(0.5);
    expect(energySpentFraction('stepped', true, [step(0, true), step(1, true)])).toBe(1);
  });

  it('falls back to all-or-nothing for a stepped card with no steps yet', () => {
    expect(energySpentFraction('stepped', false, [])).toBe(0);
    expect(energySpentFraction('stepped', true, [])).toBe(1);
  });

  it('is always 0 for a note, even one carrying a done flag from before the switch', () => {
    expect(energySpentFraction('note', true, [])).toBe(0);
    expect(energySpentFraction('note', true, [step(0, true)])).toBe(0);
  });
});

// ── The cross-module promises ───────────────────────────────────────────────────────

describe('note cards are excluded from energy totals', () => {
  const D = '2026-07-15';

  it('contributes nothing to the day delta even when done and energy-enabled', () => {
    const note = task({ cardType: 'note', energyEnabled: true, energyValue: -5, done: true });
    expect(energyDeltaForDay(D, [note], [], [])).toBe(0);
  });

  it('contributes nothing to PLANNED energy either — it is not work now or later', () => {
    const note = task({ cardType: 'note', energyEnabled: true, energyValue: -5, hasStartDate: true });
    expect(plannedEnergyDeltaForDay(D, [note], [])).toBe(0);
    // Same task as an ordinary card is counted, so the exclusion is the card type's doing.
    const ordinary = task({ cardType: 'standard', energyEnabled: true, energyValue: -5, hasStartDate: true });
    expect(plannedEnergyDeltaForDay(D, [ordinary], [])).toBe(-5);
  });
});

describe('stepped cards spend energy proportionally in the day delta', () => {
  const D = '2026-07-15';

  it('spends per step rather than all at the end', () => {
    const steps = [step(0, true), step(1, true), step(2, false), step(3, false)];
    const t = task({ cardType: 'stepped', energyEnabled: true, energyValue: -4, steps: steps as never });
    // 2 of 4 steps done → half of -4.
    expect(energyDeltaForDay(D, [t], [], [])).toBe(-2);
  });

  it('rounds to one decimal so the meter never prints float noise', () => {
    const steps = [step(0, true), step(1, false), step(2, false)];
    const t = task({ cardType: 'stepped', energyEnabled: true, energyValue: 1, steps: steps as never });
    // 1/3 of 1 — the exact value is 0.333…, and the meter renders `current` raw.
    expect(energyDeltaForDay(D, [t], [], [])).toBe(0.3);
  });

  it('leaves every other card type on the old all-or-nothing behaviour', () => {
    const halfDone = [step(0, true), step(1, false)];
    const t = task({ cardType: 'standard', energyEnabled: true, energyValue: -4, done: false, steps: halfDone as never });
    expect(energyDeltaForDay(D, [t], [], [])).toBe(0);
  });

  it('still counts a stepped card at FULL value in the planned total', () => {
    const steps = [step(0, true), step(1, false)];
    const t = task({ cardType: 'stepped', energyEnabled: true, energyValue: -4, hasStartDate: true, steps: steps as never });
    // "If everything on the books happens" — all of its steps happening is all of its cost.
    expect(plannedEnergyDeltaForDay(D, [t], [])).toBe(-4);
  });
});

describe('note cards never make a day count as active for growth', () => {
  const D = '2026-07-15';

  it('is ignored even carrying a stale done flag from before the switch', () => {
    const note = task({ cardType: 'note', done: true, date: D });
    expect(isActiveOn(D, [note], [], [])).toBe(false);
  });

  it('an ordinary completed task on the same day still counts', () => {
    expect(isActiveOn(D, [task({ done: true, date: D })], [], [])).toBe(true);
  });
});
