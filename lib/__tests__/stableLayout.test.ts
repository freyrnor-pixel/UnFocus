/**
 * stableLayout.test.ts — DESIGN_RULES rules 8 and 9 on the one card that broke them worst.
 *
 * Rule 9 says "layout is stable — nothing jumps... reserve space for things that load
 * asynchronously so the layout doesn't shift under the user's thumb." Rule 8 says "same
 * element, same position, every screen." components/PlanTaskCard.tsx violated both, and the
 * violation was the origin of the 2026-08-03 usability review: typing ONE task into an empty
 * day changed seven things about the card at once, and the field you had just typed into was
 * one of them — it moved from the bottom of the card to the top.
 *
 * Three causes, all fixed, all guarded here:
 *
 *   1. **Two mount points for the type line.** PadSheet's `typeRow` (the pad's first rule,
 *      i.e. the TOP) whenever the ruled list was drawn, and a standalone PadSheet AFTER the
 *      body for the three states that draw something else — the timeline layout, an empty day
 *      and an all-done day. Home defaults to the ruled list and the To-do tab to the timeline,
 *      so the same component also put its input in different places on the two surfaces.
 *   2. **The header summary and progress bar were conditional.** Gated on
 *      `countableTasks.length > 0`, so the first task of the day made a subtitle and a 4px bar
 *      appear from nothing and pushed the body down.
 *   3. **"Nothing fixed left today." contradicted the screen** (rule 25 — empty states give
 *      direction, not mood). It was gated on the TIMED task count alone, so a day holding only
 *      untimed tasks printed it directly beneath the list of things that were left today.
 *
 * These are all structural, so the guards are source scans — the same technique
 * lib/__tests__/episodes.test.ts and lib/__tests__/dayLog.test.ts use to keep a product
 * promise true when nothing else in the codebase can express it. A behavioural test can't see
 * "this JSX node is mounted in two places".
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Source with the JSDoc header stripped — the header legitimately DESCRIBES the old shape. */
function code(rel: string): string {
  const src = read(rel);
  return src.startsWith('/**') ? src.slice(src.indexOf('*/') + 2) : src;
}

describe('PlanTaskCard — the type line has exactly one position', () => {
  const src = code('components/PlanTaskCard.tsx');

  it('mounts the type row in exactly one place', () => {
    // Both the old mounts passed `typeRow={typeRow}`. One node, one mount, one position —
    // if a second appears, the field moves again under some state the reviewer didn't walk.
    expect([...src.matchAll(/typeRow=\{typeRow\}/g)]).toHaveLength(1);
  });

  it('that mount is hoisted above the body branch, not inside one of its arms', () => {
    const mount = src.indexOf('typeRow={typeRow}');
    const bodyBranch = src.indexOf('{showEmpty ? (');
    expect(mount).toBeGreaterThan(-1);
    expect(bodyBranch).toBeGreaterThan(-1);
    // Above the branch => the same position in all four states (empty / all-done / ruled
    // list / timeline) rather than one position per arm.
    expect(mount).toBeLessThan(bodyBranch);
  });

  it('the ruled-list PadSheet no longer draws its own type row', () => {
    // The pad list is the arm that used to put the line at the TOP while the other three put
    // it at the bottom; it now inherits the hoisted one like everybody else.
    expect(src).toMatch(/<PadSheet state=\{state\}>/);
    expect(src).not.toMatch(/<PadSheet state=\{state\} typeRow=/);
  });
});

describe('PlanTaskCard — the Home header reserves its space', () => {
  const src = code('components/PlanTaskCard.tsx');

  it('does not gate the summary or the progress bar on there being tasks', () => {
    // The exact shape of the old bug. Either gate reintroduces the pop-in.
    expect(src).not.toMatch(/\{countableTasks\.length > 0 && \(/);
  });

  it('keeps the progress bar mounted and feeds it 0 on an empty day', () => {
    expect(src).toMatch(/value=\{countableTasks\.length > 0 \? doneTasks\.length \/ countableTasks\.length : 0\}/);
  });

  it('keeps the summary line mounted, blank rather than absent', () => {
    // A blank string still occupies the line box; an absent node does not, which is the
    // difference between "reserved" and "jumps".
    expect(src).toMatch(/countableTasks\.length > 0 \? t\.pad\.summary\([^)]*\) : ' '/);
  });
});

describe('PlanTaskCard — "nothing left" never contradicts a visible task', () => {
  const src = code('components/PlanTaskCard.tsx');

  it('requires the untimed list to be empty too, not just the grid', () => {
    // `gridItems` is TIMED tasks only. Without the `visibleAnytime` term this line renders
    // under a list of untimed tasks that are, in plain English, left today.
    const line = src.match(/dayLogActive && gridItems\.length === 0[^?]*\?/);
    expect(line).not.toBeNull();
    expect(line![0]).toMatch(/visibleAnytime\.length === 0/);
  });
});
