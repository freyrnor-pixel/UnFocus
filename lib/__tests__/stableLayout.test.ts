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
 *      **The fix was ONE mount, and that half is untouched. The position flipped on
 *      2026-08-13**: the 2026-08-03 pass parked the single mount at the top (the notepad's
 *      first rule), which left this card putting its composer above its own example while the
 *      Habits tab, the Health tab and the Goals drawer put theirs below — a different
 *      inconsistency, invisible until the empty states were compared side by side. It is at
 *      the card's bottom edge now, above the done zone, and components/PadSheet.tsx moved its
 *      own `typeRow` the same way in the same pass, so there is one answer app-wide. Read the
 *      assertions below as "exactly one position", never as "this particular position".
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

  it('that mount is outside the body branch, not inside one of its arms', () => {
    const mount = src.indexOf('typeRow={typeRow}');
    const bodyBranch = src.indexOf('{showEmpty ? (');
    expect(mount).toBeGreaterThan(-1);
    expect(bodyBranch).toBeGreaterThan(-1);
    // Outside the branch => the same position in all four states (empty / all-done / ruled
    // list / timeline) rather than one position per arm. **BELOW it since 2026-08-13** — this
    // asserted `mount < bodyBranch` until then. The invariant that fixed the original bug is
    // "exactly one mount", asserted above and unchanged; which end of the branch it sits at
    // is a separate, later question, and the empty-state audit answered it the other way (see
    // the mount's own comment in PlanTaskCard). Still one position, still no per-arm mount.
    expect(mount).toBeGreaterThan(bodyBranch);
  });

  it('sits above the done zone, not below it', () => {
    // The composer appends to the ACTIVE day; a completed task is not what it adds to. This is
    // also the order components/PadSheet.tsx itself now draws (rows → typeRow → footer), so
    // the standalone mount here and the pad's built-in one agree.
    const mount = src.indexOf('typeRow={typeRow}');
    const doneZone = src.indexOf('!dayLogActive && doneTasks.length > 0');
    expect(doneZone).toBeGreaterThan(-1);
    expect(mount).toBeLessThan(doneZone);
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

  /**
   * ⚠️ Two of these asserted a shape that DESIGN_COMPARISON/09 deliberately deleted on
   * 2026-08-04, and that PR didn't update them — so `main` shipped red and #491/#492 both
   * merged through the failure. Repaired 2026-08-04 (workstream C) rather than left to make
   * a later session "fix" CI by reverting 09.
   *
   * The rule these exist for is **rule 9: writing the day's first task must not change the
   * header's HEIGHT.** That is still enforced below — it is only the two proxies for it that
   * went stale. Neither was weakened into nothing: the progress bar's always-mounted
   * assertion is unchanged, the anti-gate assertion is now aimed at the bar specifically, and
   * the deleted summary-sentence check is replaced by the `minHeight` that is the actual
   * reason the pill is allowed to gate at all.
   */
  it('does not gate the progress bar on there being tasks', () => {
    // The exact shape of the old bug, narrowed to the element it was about. It used to forbid
    // the gate ANYWHERE in the file, which was fine while the bar and the summary sentence
    // were the only two things that could carry it — task 09's count pill now carries it too,
    // legitimately (see the next test), so a file-wide ban would forbid the fix as well as
    // the bug.
    expect(src).not.toMatch(/\{countableTasks\.length > 0 && \(\s*<ProgressBar/);
  });

  it('keeps the progress bar mounted and feeds it 0 on an empty day', () => {
    expect(src).toMatch(/value=\{countableTasks\.length > 0 \? doneTasks\.length \/ countableTasks\.length : 0\}/);
  });

  it('lets the count pill gate itself, because its row cannot change height', () => {
    // Replaces "keeps the summary line mounted, blank rather than absent". That grey
    // `{left}/{total} left` sentence had its OWN line, so an absent node collapsed it and the
    // card jumped — hence the blank-string trick. Task 09 replaced it with a Badge that shares
    // the TITLE's line, where appearing changes the row's width and not its height, so the
    // blank-string trick has nothing left to protect and `t.pad.summary(...)` survives only as
    // the pill's accessibilityLabel.
    //
    // What has to stay true is the reason that is safe: the row reserves its height whether
    // the pill is there or not. If this minHeight ever goes, the gate below becomes the 2026-08-03
    // pop-in bug again and the pill has to go back to being always-mounted.
    expect(src).toMatch(/headerTopRow: \{[^}]*minHeight: 32/);
    expect(src).toMatch(/\{countableTasks\.length > 0 && \(\s*<Badge/);
  });

  it('keeps the summary wording as the pill\'s accessible name', () => {
    // The sentence was deleted from the SCREEN, not from the app. Sighted users read the
    // fraction off a two-number pill in context; a screen reader announcing a bare "3/7" has
    // lost the noun. `t.pad.summary` is the whole of what survived task 09's deletion, so it
    // is worth pinning — a visual review cannot see this one go missing, which is exactly the
    // class of regression the rest of this file exists to catch.
    expect(src).toMatch(/accessibilityLabel=\{t\.pad\.summary\(pendingCount, countableTasks\.length\)\}/);
  });
});

/**
 * The Energy strip (2026-08-03). Same review, adjacent rule: ten saturated pips and "10 / 10"
 * at the top of Home, with no label, read as a score or a level — which is the one thing this
 * system is documented as needing NOT to read as.
 *
 * The first fix for that also moved the two capacity steppers onto the strip's own top line,
 * always visible. **The maintainer's review reversed that within the day**, verbatim: "the plus
 * and minus is too flexible, and it is not obvious to a user what is what. Energy per day
 * should be configured in a pop-up, not just whenever, and if they have extra Energy that is
 * supposed to be shown as temporary. So it's better to just have a 'tutorial' there instead
 * before anything is added."
 *
 * These guard the four structural claims that came out of it — one layout, always labelled; no
 * stepper on the strip at all; extra energy marked temporary where the number is; a tutorial in
 * place of the meter until something has been added. Rewards mode hiding the whole system is
 * already covered, thoroughly, by energyModes.test.ts.
 */
describe('EnergyMeter — the strip names itself, and is set from a pop-up', () => {
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

  it('has no stepper of its own — every number is set in the pop-up', () => {
    // The reversal, pinned at the strongest available level: the component cannot render a
    // Stepper because it does not import one. A ± on this line has no way to say whether it
    // moves the capacity or the spend, and being always-there invites nudging it on every
    // glance. This is the SECOND reversal on the question (an inline Collapsible editor held
    // the same steppers before that) — read EnergyConfigSheet's header before a third.
    expect(src).not.toMatch(/from '@\/components\/Stepper'/);
    expect(src).not.toMatch(/<Stepper/);
    // The inline editor it replaced is gone with it, Collapsible and all.
    expect(src).not.toMatch(/<Collapsible/);
  });

  it('hands all three setters to the config sheet, which owns all three steppers', () => {
    const sheetAt = src.indexOf('<EnergyConfigSheet');
    expect(sheetAt).toBeGreaterThan(-1);
    for (const setter of ['setDayCapacity(today', 'setWeekCapacity(today', 'setDayBoost(today']) {
      const at = src.indexOf(setter);
      expect({ setter, found: at > -1 }).toEqual({ setter, found: true });
      // Passed as a prop on the sheet element, i.e. after its opening tag — not called from a
      // control drawn on the strip above it.
      expect({ setter, onSheet: at > sheetAt }).toEqual({ setter, onSheet: true });
    }
    // And the sheet is where the three steppers actually live.
    const sheet = code('components/EnergyConfigSheet.tsx');
    expect([...sheet.matchAll(/<Stepper/g)]).toHaveLength(1); // one shared `field()` renderer
    for (const prop of ['onDayCapacity', 'onWeekCapacity', 'onDayBoost']) {
      expect({ prop, wired: sheet.includes(prop) }).toEqual({ prop, wired: true });
    }
    // Every field carries a line saying what its stepper CHANGES — the copy half of "it is not
    // obvious what is what". A stepper with a bare label is the state this replaced.
    for (const hint of ['todayCapacityHint', 'weekCapacityHint', 'boostHint']) {
      expect({ hint, used: sheet.includes(hint) }).toEqual({ hint, used: true });
    }
  });

  it('marks extra energy as temporary on the row that has it', () => {
    // A boost used to vanish into the total: `+3` on a 10-energy day printed `13 / 13`,
    // indistinguishable from somebody whose usual day is 13.
    expect(src).toMatch(/dayBoost > 0 \? <Badge label=\{t\.energyMeter\.boostChip\(dayBoost\)\} \/> : null/);
    const i18n = read('lib/i18n.ts');
    // "today only" is the payload, in both languages — not the number, which the meter already
    // has, but that the number is borrowed against one day.
    expect(i18n).toMatch(/boostChip: \(n: number\) => `\+\$\{n\} today only`/);
    expect(i18n).toMatch(/boostChip: \(n: number\) => `\+\$\{n\} bare i dag`/);
  });

  it('teaches instead of measuring until something has been added', () => {
    // A full ten-pip bar with nothing able to spend it is the score-reading problem at its
    // worst. The tutorial stands where the meter will stand, with the same pop-up behind its
    // button.
    // `[^>]*` so a presentational prop can be added without failing this: what matters is that
    // the tutorial card is mounted at all, not the exact attribute list. It grew
    // `stage="sapling"` on 2026-08-04 (design comparison task 03) — a call-site choice about
    // how large a watermark this card has room for, deliberately NOT `current / capacity`,
    // which is one of the tree bindings both the design project and lib/growth.ts decline.
    //
    // ⚠️ It LOST its `text` on 2026-08-17 (*"Remove the 'Energy is how much a day holds…'
    // block"*), and that half is asserted as an absence below. The card itself is what this test
    // is really about — the point was never the paragraph, it was that this spot must not draw a
    // full ten-pip bar before anything can spend it.
    expect(src).toMatch(/<StarterCard[^>]*stage="sapling"[^>]*>/);
    expect(src).not.toMatch(/<StarterCard[^>]*\btext=/);
    expect(src).toMatch(/label=\{t\.starters\.energy\.action\}/);
    expect(src).toMatch(/const showTutorial = ready && !hasEnergyItems && !hasSetCapacity/);
    // Either kind of "something added" sends the meter back: an energy value on a task/habit,
    // or a capacity the user set themselves (any energy_budgets override row).
    expect(src).toMatch(/const hasEnergyItems =/);
    expect(src).toMatch(/const hasSetCapacity = Object\.keys\(overrides\)\.length > 0/);
    // The load-order guard, which is the one way this could misfire: an unloaded store looks
    // exactly like an empty one, and getting it wrong flashes teaching copy at a long-time
    // user. All three stores have to answer first.
    expect(src).toMatch(/const ready = tasksLoaded && habitsLoaded && energyLoaded/);
    for (const store of ['store/useTaskStore.ts', 'store/useHabitStore.ts', 'store/useEnergyStore.ts']) {
      expect({ store, hasFlag: read(store).includes('loaded: true') }).toEqual({ store, hasFlag: true });
    }
    // The meter and the tutorial are mutually exclusive — a strip drawing both would be the
    // "explainer taller than the thing it explains" complaint all over again. (The permanent
    // hint that used to be the third member of this set was deleted with the bulb tier on
    // 2026-08-17; see lib/__tests__/exampleRows.test.ts section 4.)
    expect(src).toMatch(/\{!pause\.paused && showTutorial && \(/);
    expect(src).toMatch(/\{!pause\.paused && !showTutorial && \(/);
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

describe('Onboarding backdrop — texture, not lines over the controls', () => {
  const src = code('app/onboarding/_layout.tsx');

  // **This replaces "dials the triptych back with a whole-motif multiplier" (2026-08-14.)**
  // That test pinned `BACKDROP_OPACITY`, a constant that existed to stop the `onboarding-triptych`
  // motif's trunk strokes (baked at up to 0.6/0.78) reading as lines drawn ON the controls —
  // onboarding being the one place full-bleed art sat directly under them rather than around a
  // protected centre box. The motif is gone from this flow: every step draws the app's ordinary
  // `ScreenBackground`, which keeps a clear centre box by construction, so there is no bespoke
  // opacity left to dial and nothing for a multiplier to apply to.
  //
  // The underlying concern is still real, so it is restated as the thing that guarantees it:
  // this layout draws no art of its own at all.
  it('draws no bespoke art under the onboarding controls', () => {
    expect(src).not.toMatch(/<Motif/);
    expect(src).not.toMatch(/BACKDROP_OPACITY/);
    expect(src).toMatch(/<ScreenBackground\s*\/>/);
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
