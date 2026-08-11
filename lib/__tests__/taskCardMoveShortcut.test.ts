/**
 * taskCardMoveShortcut.test.ts — Wave B (2026-08-11), Blokk 2 + Blokk 3 additions to
 * components/TaskCard.tsx: the steps-variant "Move to Whenever/today" shortcut, and the
 * full editor's Time-of-day block tracking `hasStartDate`.
 *
 * TaskCard has no render-level test (same reason as PlanTaskCard/stableLayout.test.ts — the
 * behaviour these guard ("this control is gated by that condition", "this write uses that
 * shape") is structural, not something a shallow render can see without a heavy RN Testing
 * Library setup this repo doesn't otherwise carry for this file). Source-scan, same technique
 * lib/__tests__/stableLayout.test.ts and lib/__tests__/episodes.test.ts use.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { getTranslations } from '@/lib/i18n';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'components/TaskCard.tsx'), 'utf8');
const en = getTranslations('en');
const no = getTranslations('no');

describe('TaskCard — steps-variant move shortcut', () => {
  it('canExpand allows expansion for a non-recurring task even with no steps', () => {
    // Before this pass a steps-variant task with no steps had no expand arrow at all, so a
    // task without a checklist could never reach the move control. `!isRecurring` is the new
    // second reason to expand.
    expect(src).toMatch(/const canExpand = stepsOnly \? \(hasSteps && !stepped\) \|\| !isRecurring : true;/);
  });

  it('the move control is gated on stepsOnly && !isRecurring — never shown for a recurring task', () => {
    expect(src).toMatch(/\{stepsOnly && !isRecurring && \(/);
  });

  it('the button label switches on task.hasStartDate, worded both directions', () => {
    expect(src).toMatch(/label=\{task\.hasStartDate \? t\.taskMoveToWhenever : t\.taskMoveToToday\}/);
  });

  it('handleMoveSection writes the same {date, hasStartDate} pair every other write path uses', () => {
    const fn = src.slice(src.indexOf('function handleMoveSection'), src.indexOf('function handleMoveSection') + 300);
    expect(fn).toMatch(/update\(task\.id, \{ date: todayStr\(\), hasStartDate: !task\.hasStartDate \}\)/);
  });

  it('the move control sits inside the expanded body (a Collapsible keyed to `expanded`), not the collapsed row', () => {
    const idx = src.indexOf('stepsOnly && !isRecurring && (');
    const nearby = src.slice(idx, idx + 200);
    expect(nearby).toMatch(/<Collapsible open=\{expanded\}>/);
  });
});

describe('TaskCard — full editor: fields follow hasStartDate (Blokk 3)', () => {
  it('the main When picker wires toggleTimeOfDay as renderDayPicker\'s onToggle', () => {
    expect(src).toMatch(
      /renderDayPicker\(t\.taskWhenLabel, t\.taskWhenWhenever, toggleTimeOfDay\)/
    );
  });

  it('the recurring "Start from" boundary does NOT auto-toggle Time of day', () => {
    // Only the main (non-recurring) When picker should carry the third argument — Start
    // from means something else entirely for a recurring task (a scheduling boundary, not
    // "this task is now dated"), so flipping it must not silently open the time block.
    expect(src).toMatch(/renderDayPicker\(t\.taskStartFromLabel, t\.taskStartFromNone\)/);
    expect(src).not.toMatch(/renderDayPicker\(t\.taskStartFromLabel, t\.taskStartFromNone, /);
  });

  it('renderDayPicker forwards the flip to onToggle after writing hasStartDate', () => {
    const start = src.indexOf('function renderDayPicker');
    const body = src.slice(start, start + 900);
    expect(body).toMatch(/patch\(\{ hasStartDate: on \}\);/);
    expect(body).toMatch(/onToggle\?\.\(on\);/);
  });

  it('the Start/Finish block animates via Collapsible instead of a bare conditional', () => {
    // Was `{timeOpen && (<View style={styles.timeRow}>`. A bare conditional pops the block
    // in with no animation (DESIGN_RULES rule 9, "nothing jumps").
    expect(src).not.toMatch(/\{timeOpen && \(\s*<View style=\{styles\.timeRow\}/);
    expect(src).toMatch(/<Collapsible open=\{timeOpen\}>\s*<View style=\{styles\.timeRow\}/);
  });
});

describe('TaskCard — new i18n keys exist in both languages', () => {
  it('taskMoveToWhenever / taskMoveToToday are present in en and no', () => {
    expect(en.taskMoveToWhenever).toBeTruthy();
    expect(en.taskMoveToToday).toBeTruthy();
    expect(no.taskMoveToWhenever).toBeTruthy();
    expect(no.taskMoveToToday).toBeTruthy();
  });

  it('the Norwegian strings match the spec\'s exact wording', () => {
    expect(no.taskMoveToWhenever).toBe('Flytt til Når som helst');
    expect(no.taskMoveToToday).toBe('Flytt til i dag');
  });
});
