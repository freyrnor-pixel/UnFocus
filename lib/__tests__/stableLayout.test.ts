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

/**
 * The Energy strip (2026-08-03). Same review, adjacent rule: ten saturated pips and "10 / 10"
 * at the top of Home, with no label, read as a score or a level — which is the one thing this
 * system is documented as needing NOT to read as. And setting your own daily number, the
 * primary thing you do to the strip, was behind a pencil.
 *
 * The maintainer's call was "on and shown by default, in a state the user can use to set
 * energy per day/week — easy, and not forceful". These guard the three structural halves of
 * that: one layout, always labelled, stepper on the strip rather than in the editor. Rewards
 * mode hiding the whole thing is already covered, thoroughly, by energyModes.test.ts.
 */
describe('EnergyMeter — the strip names itself and can be set from where it is', () => {
  const src = code('components/EnergyMeter.tsx');

  it('has one layout, not a single-meter special case', () => {
    // `singleMeter` picked a one-line, label-less shape for 'daily'/'weekly' and the stacked
    // one for 'custom'. Two layouts is how the common case ended up being the unlabelled one.
    // Matched as a DECLARATION and a USE rather than as the bare word: both files carry
    // tombstone comments naming the thing they removed, and a session shouldn't have to
    // delete the explanation to get this green (same reasoning as onboardingFlow.test.ts's
    // header-stripping).
    expect(src).not.toMatch(/const singleMeter/);
    expect(src).not.toMatch(/singleMeter &&/);
    expect(src).not.toMatch(/styles\.stripLine/);
  });

  it('always passes a label — the row signature no longer admits null', () => {
    expect(src).toMatch(/label: string,/);
    expect(src).not.toMatch(/label: string \| null/);
    // Both call sites hand over a real string rather than a showX-conditional.
    expect(src).toMatch(/row\('day', t\.energyMeter\.today,/);
    expect(src).toMatch(/row\('week', t\.energyMeter\.thisWeek,/);
  });

  it('draws the capacity stepper on the strip, not inside the ✏️ editor', () => {
    const editorAt = src.indexOf('<Collapsible open={editing}>');
    expect(editorAt).toBeGreaterThan(-1);
    for (const setter of ['setDayCapacity', 'setWeekCapacity']) {
      const at = src.indexOf(setter + '(today');
      expect({ setter, found: at > -1 }).toEqual({ setter, found: true });
      // Before the editor in source order == on the row's own top line.
      expect({ setter, onStrip: at < editorAt }).toEqual({ setter, onStrip: true });
    }
  });

  it('keeps the today-only boost behind the ✏️', () => {
    // The one thing that should NOT be one tap away: an always-visible "more for today"
    // stepper is an invitation, and this system describes a day rather than rewarding one.
    const editorAt = src.indexOf('<Collapsible open={editing}>');
    expect(src.indexOf('setDayBoost(today')).toBeGreaterThan(editorAt);
  });

  it('names the meter in both languages', () => {
    const i18n = read('lib/i18n.ts');
    for (const s of ['Energy today', 'Energy this week', 'Energi i dag', 'Energi denne uken']) {
      expect({ s, present: i18n.includes(s) }).toEqual({ s, present: true });
    }
  });
});

describe('TourSpotlight — one primary, one escape, and it puts you back where you chose', () => {
  const src = code('components/TourSpotlight.tsx');

  it('offers two buttons per step, not three', () => {
    // "Skip this" and "Got it" both called record(step.id) — one button, two labels.
    expect(src).not.toMatch(/t\.tour\.skipStep/);
    expect(read('lib/i18n.ts')).not.toMatch(/^\s*skipStep:/m);
  });

  it('still lets you leave from any step', () => {
    // Deleting the per-step skip must not cost escapability — that promise now rests
    // entirely on this one.
    expect(src).toMatch(/t\.tour\.skipAll/);
  });

  it('navigates to the chosen start screen when the tour ends', () => {
    // Without this the tour stops on whichever tab it walked to last (Health), which is
    // where a brand-new user landed after finishing it.
    expect(src).toMatch(/START_SCREEN_PATHS\[startScreen\]/);
    const body = src.slice(src.indexOf('const dismissAll'), src.indexOf('const handleAiGuide'));
    expect(body).toMatch(/router\.navigate/);
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
