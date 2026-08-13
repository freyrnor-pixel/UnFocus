/**
 * exampleRows.test.ts — one shape for every empty-state example (2026-08-12).
 *
 * The maintainer's report was "examples per card don't look the same, and are not placed the
 * same. I prefer the one in 'to-do' but I don't like that it is wider than the empty row above."
 * Both halves resolved into invariants that nothing else in the suite watches, and that no
 * screenshot can catch:
 *
 *   1. **The composer is the full content width, in every state.** `PadTypeRow`'s ghost check
 *      ring used to be laid out BESIDE the field, costing it 26px (the ring plus the row's
 *      gap) — so the composer was narrower than the example row and the real rows under it,
 *      and it jumped wider the moment it was focused (the ring unmounts on `showControls`).
 *      The ring is inside the field's box now, which is also where a real `PadRow` draws its
 *      check.
 *   2. **An example is a row in the list it is an example of.** Same rung, same width: the
 *      FIELD border weight, and the same box as the ghost add-row beside it.
 *   3. **No empty-state explainer is a card inside a card.** A caller mounting `StarterCard`
 *      inside another card's Surface passes `embedded`. `EnergyMeter` is the one documented
 *      exception — its card REPLACES the meter rather than annotating a list.
 *
 * A fourth was added on 2026-08-12, from the maintainer's follow-up ruling ("explanation always
 * sits underneath sub-header", scoped to "only when the card is empty"):
 *
 *   4. **An explainer sits under its card's header.** Every `CardHintNote` in the app is
 *      `placement="head"` except `EnergyMeter`'s, which annotates a meter with a NUMBER IN IT
 *      — content the user already has — and stays at the default foot. That counter-case is
 *      the most valuable assertion in this file: without it the suite would read "head
 *      everywhere" and the next session would flatten the rule into a constant.
 *      *(Restated 2026-08-13. This read "an EMPTY card's explainer sits under its header" and
 *      gave every head caller being empty-gated as the reason. That was a fact about who the
 *      callers happened to be, not the rule: when app/(tabs)/{habits,health}.tsx's PERMANENT
 *      tips lines moved onto the shared component they went to the head too. Position and
 *      lifespan are separate decisions — "explanation always sits underneath sub-header" is
 *      the first, "only when the card is empty" was each caller's answer to the second.)*
 *
 * A fifth was added on 2026-08-13, from *"cards still differ when it comes to where new and
 * empty row sits, and how examples look (box vs no box, and above or below)"*:
 *
 *   5. **The composer comes after the examples, and every example is in the foldable box.**
 *      Both had split three ways across the surfaces — see the `collapsible` assertions below
 *      and the last describe in this file. Neither is visible to a screenshot: an order is two
 *      elements inside one card, and a fold is invisible in the open state every screenshot is
 *      taken in.
 *
 * Source-scanning rather than rendering, for the reason lib/__tests__/chromeRhythm.test.ts
 * gives: a width and a wrapper depth are settled by styles that the node env doesn't lay out,
 * and the web preview cannot see either (react-native-web's box model differs, and these
 * differences are single-digit pixels). Precedent: chromeRhythm, cardLayout, designTokens.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { BORDER_WIDTH } from '@/constants/theme';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Source with every comment removed. Same reasoning as chromeRhythm's: this repo's headers
 * deliberately name what they replaced ("it was a literal 1 until…"), so a "this is gone"
 * assertion has to read code, not prose.
 */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// ── 1. The composer is never narrowed by its own preview ─────────────────────

describe('PadTypeRow — the ghost ring is inside the field, not beside it', () => {
  const source = code('components/PadTypeRow.tsx');

  it('renders the ring within the field wrapper rather than as a sibling of it', () => {
    // The bug was structural, not numeric: as a sibling in a flex row the ring took layout
    // width away from a `flex: 1` field. Assert it is no longer emitted next to the field in
    // either of the two return branches (`panel` and inline).
    expect(source).not.toMatch(/\{fieldAndPrompt\}\s*\{ghostCheck\}/);
    expect(source).not.toMatch(/const ghostCheck = /);
    // ...and that it IS emitted inside the field wrapper, after the TextInput.
    expect(source).toMatch(/styles\.field[\s\S]{0,4000}showGhostCheck \? \([\s\S]{0,400}styles\.ghostCheckSlot/);
  });

  it('positions the ring absolutely, so it takes no layout width at all', () => {
    expect(source).toMatch(/ghostCheckSlot: \{[^}]*position: 'absolute'/);
    expect(source).toMatch(/ghostCheckSlot: \{[^}]*right: Spacing\.sm/);
  });

  it('derives the field\'s reserved right padding from the ring\'s own size', () => {
    // Two hand-written numbers here is how the placeholder ends up running under the ring.
    expect(source).toMatch(/const GHOST_CHECK = 22;/);
    expect(source).toMatch(/inputWithGhost: \{ paddingRight: Spacing\.sm \* 2 \+ GHOST_CHECK \}/);
    expect(source).toMatch(/ghostCheck: \{ width: GHOST_CHECK, height: GHOST_CHECK/);
  });

  it('reserves that padding only while the ring is actually up', () => {
    // A focused field gets the whole line back for typing; a permanent 38px inset would be a
    // different, quieter version of the same width bug.
    expect(source).toMatch(/showGhostCheck && styles\.inputWithGhost/);
    expect(source).toMatch(/const showGhostCheck = !showControls && !noGhostCheck;/);
  });
});

// ── 2. An example is the same box as the row it stands in for ────────────────

describe('StarterExampleRow — the field rung, like every other row-sized box', () => {
  const source = code('components/StarterExampleRow.tsx');

  it('takes its border weight from the token, not a literal', () => {
    expect(source).toMatch(/borderWidth: BORDER_WIDTH\.field/);
    expect(source).not.toMatch(/borderWidth: 1,\n\s*borderStyle: 'dashed'/);
  });

  it('still says "provisional" through its finish, which is the part that must not change', () => {
    // The 2026-08-10 reversal put the whole signal in the finish; matching the weight to the
    // real rows is only safe as long as these four hold.
    expect(source).toMatch(/borderStyle: 'dashed'/);
    expect(source).toMatch(/fontStyle: 'italic'/);
    expect(source).not.toMatch(/row: \{[^}]*backgroundColor/);
    expect(source).toMatch(/borderColor: theme\.border/);
  });
});

describe('StarterSuggestionChip — the same finish as the row, the shape kept different', () => {
  const chip = code('components/StarterSuggestionChip.tsx');
  const row = code('components/StarterExampleRow.tsx');

  // 2026-08-12, from "Examples are placed the same througout app, but does not look the same …
  // the dottet lines instead of full border and the filled buttons. I prefer the visual in the
  // to-do preview card." The 2026-08-10 provisional reversal had been applied to the ROW only,
  // so the chips still wore the styling it removed — solid edge, fill, full-contrast label.
  it('carries all four provisional channels the row does', () => {
    for (const channel of [/borderStyle: 'dashed'/, /fontStyle: 'italic'/, /borderWidth: BORDER_WIDTH\.field/]) {
      expect({ channel: String(channel), chip: channel.test(chip), row: channel.test(row) })
        .toEqual({ channel: String(channel), chip: true, row: true });
    }
    // The fourth channel is an ABSENCE, so it is asserted as one: no fill on either box.
    expect(chip).not.toMatch(/chip: \{[^}]*backgroundColor/);
    expect(row).not.toMatch(/row: \{[^}]*backgroundColor/);
  });

  it('spends the accent on the "+" and nothing else', () => {
    // A.4 rule 1 — the accent marks the ACTION, never the ink. Three of the five call sites
    // this component replaced drew an accent glyph on the LEFT and had no "+" at all.
    expect(chip).toMatch(/name="add" size=\{14\} color=\{theme\.accent\}/);
    expect(chip).toMatch(/color=\{theme\.textMuted\}/);
    expect(chip).not.toMatch(/label: \{[^}]*theme\.accent/);
  });

  it('takes no colour prop, so an edge cannot be hued at one call site and not another', () => {
    // Habits/HomeHabitsCard hued their chip's edge with the screen colour while Goals, the
    // Goals drawer and the health sheet used theme.border — half of why five copies never
    // matched. The edge is neutral everywhere now; the hue reaches it through the card.
    expect(chip).toMatch(/borderColor: theme\.border/);
    expect(chip).not.toMatch(/accent: string/);
  });

  it('keeps the pill radius the row does not — the shape is the deliberate difference', () => {
    expect(chip).toMatch(/borderRadius: Radius\.full/);
    expect(row).toMatch(/borderRadius: Radius\.sm/);
  });

  it('is dropped where the labels are too long to pair up on a line', () => {
    // 2026-08-13. components/GoalsEditor.tsx's four suggestions are sentences, so at
    // Radius.full each took most of a line and the "cloud" wrapped into a ragged four-step
    // staircase — the shape the maintainer's screenshot caught. It renders StarterExampleRows
    // now: same finish (they have shared one since 2026-08-12), even left edge, no ragged tail.
    // Asserted as an ABSENCE plus a presence, because "we moved it" is only true if the old
    // one actually went.
    const source = code('components/GoalsEditor.tsx');
    expect(source).toMatch(/<StarterExampleRow\b/);
    expect(source).not.toMatch(/<StarterSuggestionChip\b/);
    expect(source).not.toMatch(/starterChips: \{/);
  });

  for (const file of [
    'app/(tabs)/habits.tsx',
    'components/HomeHabitsCard.tsx',
    // app/goals.tsx was a caller until it was retired (2026-08-12), and its successor
    // components/GoalsEditor.tsx until 2026-08-13 — see the test directly above. What is left
    // is the two habit surfaces and the health sheet, all of them short-label clouds that
    // genuinely pair up on a line, which is what the chip is for.
    'components/HealthIssuesSheet.tsx',
  ] as const) {
    it(`${file} mounts the shared chip instead of a local copy`, () => {
      const source = code(file);
      expect(source).toMatch(/<StarterSuggestionChip\b/);
      // The five hand-rolled copies are what drifted into three geometries and two colour
      // schemes; a local `starterChip` style block is how that starts again.
      expect(source).not.toMatch(/starterChip: \{/);
      expect(source).not.toMatch(/starterChipText: /);
    });
  }
});

describe('PlanTaskCard — the two dashed rows on an empty day are one box', () => {
  const source = code('components/PlanTaskCard.tsx');
  const exampleRow = code('components/StarterExampleRow.tsx');

  it('gives the ghost add-row the example row\'s radius and weight', () => {
    const emptyAddRow = source.match(/emptyAddRow: \{[^}]*\}/)?.[0] ?? '';
    expect(emptyAddRow).toMatch(/borderRadius: Radius\.sm/);
    expect(emptyAddRow).toMatch(/borderWidth: BORDER_WIDTH\.field/);
    // The same two values the example row itself carries — asserted against its source rather
    // than restated, so the pair cannot drift apart one file at a time.
    const example = exampleRow.match(/row: \{[\s\S]*?\n  \}/)?.[0] ?? '';
    expect(example).toMatch(/borderRadius: Radius\.sm/);
    expect(example).toMatch(/borderWidth: BORDER_WIDTH\.field/);
  });

  it('stacks the empty state at the gap real rows stack at', () => {
    expect(source).toMatch(/emptyWrap: \{ gap: Spacing\.xs \}/);
    expect(code('components/PadSheet.tsx')).toMatch(/marginTop: Spacing\.xs \* shape\.spacingScale/);
  });

  it('keeps the field rung a real token, so this test is measuring something', () => {
    expect(BORDER_WIDTH.field).toBeGreaterThan(0);
    expect(BORDER_WIDTH.field).toBeLessThan(BORDER_WIDTH.card);
  });
});

// ── 3. No explainer is a card inside a card ──────────────────────────────────

describe('StarterCard — `embedded` wherever it is mounted inside another card', () => {
  it('drops the Surface, the padding and the watermark, and nothing else', () => {
    const source = code('components/StarterCard.tsx');
    expect(source).toMatch(/if \(embedded\) return <View style=\{styles\.embedded\}>\{body\}<\/View>;/);
    expect(source).toMatch(/\{compact \|\| embedded \? null : \(/);
    // Presentation only — the same contract FoodTab/CatalogueTab's `embedded` carries. The
    // body is built once and used by both branches, which is what makes that true structurally
    // rather than by review.
    expect(source).toMatch(/const body = \(/);
    expect(source).not.toMatch(/embedded \?[^\n]*collapsible/);
  });

  for (const [file, label] of [
    ['app/(tabs)/health.tsx', 'Health'],
    ['app/(tabs)/habits.tsx', 'Habits'],
    ['components/GoalsEditor.tsx', 'the Goals drawer'],
    // 2026-08-12: the day card joined this list when its bare example gained the shared
    // collapse trigger, and components/MedicineTrayCard left it — that card's explainer is a
    // CardHintNote now, so it mounts no StarterCard at all (asserted separately below).
    ['components/PlanTaskCard.tsx', 'the day card'],
    // 2026-08-13: Home's habits card stopped hand-rolling a label-plus-bare-cloud stand-in
    // for the trigger row and mounts the real thing.
    ['components/HomeHabitsCard.tsx', "Home's habits card"],
  ] as const) {
    it(`${label} mounts it embedded`, () => {
      const source = code(file);
      const mounts = source.match(/<StarterCard[\s\S]*?(?:\/>|>)/g) ?? [];
      expect(mounts.length).toBeGreaterThan(0);
      for (const mount of mounts) expect({ file, mount, embedded: mount.includes('embedded') }).toEqual({ file, mount, embedded: true });
    });

    // 2026-08-13, maintainer: "boxed everywhere so it can always be folded." Every empty-state
    // example lives in the bordered trigger box — the two that didn't were Goals (StarterCard
    // with no `collapsible`, so it fell through to the bare `actions` branch) and Home's habits
    // card (no StarterCard at all). A fold is invisible to a screenshot in its OPEN state,
    // which is the state every screenshot is taken in, so it has to be asserted here.
    it(`${label} makes it collapsible`, () => {
      const source = code(file);
      const mounts = source.match(/<StarterCard[\s\S]*?(?:\/>|>)/g) ?? [];
      for (const mount of mounts) {
        expect({ file, mount, collapsible: mount.includes('collapsible') })
          .toEqual({ file, mount, collapsible: true });
        // `exampleHeaderLabel` is required alongside it — StarterCard has no default copy, so
        // a caller that forgets it renders a trigger row with an empty label.
        expect({ file, mount, label: mount.includes('exampleHeaderLabel') })
          .toEqual({ file, mount, label: true });
      }
    });
  }

  it('gives the day card\'s example the same collapse trigger every other surface has', () => {
    // Ruling 2 (2026-08-12, "add a trigger to the day card"): this was the last surface whose
    // example could not be folded away. No `text` on the mount — the explainer is the
    // head-mounted CardHintNote, and one card saying the same sentence twice with two
    // different lifespans is what StarterCard's optional-`text` note warns against.
    const source = code('components/PlanTaskCard.tsx');
    expect(source.match(/<StarterCard\b/g) ?? []).toHaveLength(1);
    // The wrapper's OWN props — everything between its tag and the example row it wraps.
    const props = source.slice(source.indexOf('<StarterCard'), source.indexOf('<StarterExampleRow'));
    expect(props).toContain('collapsible');
    expect(props).toContain('exampleHeaderLabel={t.starters.plans.tapToAdd}');
    expect(props).not.toMatch(/\btext=/);
    // The ghost add-row stays OUTSIDE it: on the `readOnly && !onAddTask` branch it is the
    // only way in, and a collapse must never take away the last "add something" affordance.
    expect(source).toMatch(/styles\.emptyAddRow/);
    expect(source).not.toMatch(/example=\{[\s\S]{0,600}styles\.emptyAddRow/);
  });

  it('the medicine card carries the shared explainer line, not a StarterCard of its own', () => {
    // Its placement was already right (`statusLine()` returns null with nothing scheduled, so
    // this sits directly under the header row); 2026-08-12 changed only the component, so all
    // five empty-state explainers are one component in one position.
    const source = code('components/MedicineTrayCard.tsx');
    expect(source).not.toMatch(/<StarterCard/);
    expect(source).toMatch(/<CardHintNote text=\{t\.starters\.medicine\.text\} placement="head"/);
  });

  it('leaves the Energy tutorial as a real card — it IS the meter, not a note beside one', () => {
    const source = code('components/EnergyMeter.tsx');
    const mounts = source.match(/<StarterCard[\s\S]*?>/g) ?? [];
    expect(mounts.length).toBe(1);
    expect(mounts[0]).not.toContain('embedded');
  });

  it('is what the Goals drawer uses instead of its old hand-copied explainer', () => {
    const source = code('components/GoalsEditor.tsx');
    // Matched the whole one-line mount until 2026-08-13, when `collapsible` +
    // `exampleHeaderLabel` broke it across lines. What this test is actually for is that the
    // drawer uses the shared card's own explainer rather than a hand-copy of it, so it asserts
    // the `text` prop and its source key — the mount's shape is covered by the `embedded` and
    // `collapsible` loops above.
    expect(source).toMatch(/<StarterCard\b[\s\S]*?text=\{t\.hints\.goals\.text\}/);
    // The local copies of StarterCard's bulb row are gone; a second implementation of one
    // explainer is exactly what drifted last time.
    expect(source).not.toMatch(/bulb-outline/);
    expect(source).not.toMatch(/explainer: \{/);
  });
});

// ── The placement half of the same report ────────────────────────────────────

describe('the example sits in the list it is an example of, not above the list\'s card', () => {
  it('Health puts it last in the section, above the composer', () => {
    const source = code('app/(tabs)/health.tsx');
    const section = source.indexOf('styles.section');
    const starter = source.indexOf('<StarterCard');
    const composer = source.indexOf('<PadTypeRow');
    expect(section).toBeGreaterThan(-1);
    expect(section).toBeLessThan(starter);
    expect(starter).toBeLessThan(composer);
  });

  it('Habits puts its suggestions in the same place', () => {
    const source = code('app/(tabs)/habits.tsx');
    const section = source.indexOf('styles.section');
    const starter = source.indexOf('<StarterCard');
    const composer = source.indexOf('<PadTypeRow');
    expect(section).toBeGreaterThan(-1);
    expect(section).toBeLessThan(starter);
    expect(starter).toBeLessThan(composer);
  });
});

// ── 5. The composer is the LAST thing, on every surface ──────────────────────

/**
 * 2026-08-13, maintainer with two screenshots: *"Cards still differ when it comes to where new
 * and empty row sits."* Health, Habits and Goals put the composer under their examples; the
 * To-do day card put it above (hoisted to a single fixed mount by the 2026-08-03 pass, which
 * chose the top for PadSheet's notepad metaphor), and Home's habits/notes/shopping cards put
 * theirs at the top of the pad for the same reason. So "where does the new row go" had two
 * answers depending on which card you were looking at.
 *
 * Settled toward the app's own existing rule — "an add-new-row trigger lives at the bottom of
 * the list it appends to" (AGENTS.md) — which was already what three of the surfaces did.
 *
 * This is the assertion the whole pass exists for, and nothing else can make it: two elements'
 * ORDER inside one card is exactly what a screenshot cannot be diffed on reliably, and the
 * web preview lays both out fine either way.
 */
describe('the composer comes after the examples, everywhere', () => {
  for (const [file, starterMarker, composerMarker, label] of [
    ['app/(tabs)/health.tsx', '<StarterCard', '<PadTypeRow', 'Health'],
    ['app/(tabs)/habits.tsx', '<StarterCard', '<PadTypeRow', 'Habits'],
    ['components/HomeHabitsCard.tsx', '<StarterCard', '<PadSheet', "Home's habits card"],
    ['components/GoalsEditor.tsx', '<StarterCard', '<AddRow', 'the Goals drawer'],
    ['components/PlanTaskCard.tsx', '<StarterCard', 'typeRow={typeRow}', 'the day card'],
  ] as const) {
    it(`${label} draws its composer below its example`, () => {
      const source = code(file);
      const starter = source.indexOf(starterMarker);
      const composer = source.indexOf(composerMarker);
      expect({ label, starter: starter > -1, composer: composer > -1 })
        .toEqual({ label, starter: true, composer: true });
      expect({ label, composerIsBelow: composer > starter }).toEqual({ label, composerIsBelow: true });
    });
  }

  it('PadSheet draws its type line under the rows and above the done zone', () => {
    // The mechanism behind three of the rows above: Home's habits, notes and shopping cards
    // pass `typeRow` and never position it themselves. Above the `footer` because that slot is
    // the done/checked zone — this field appends to the ACTIVE list, not to that one.
    const source = code('components/PadSheet.tsx');
    const rows = source.indexOf('<Collapsible open={state !== \'closed\'}>');
    const typeLine = source.indexOf('styles.typeLine');
    const footer = source.indexOf("state === 'open' && footer");
    expect(rows).toBeGreaterThan(-1);
    expect(typeLine).toBeGreaterThan(rows);
    expect(footer).toBeGreaterThan(typeLine);
  });
});

// ── 4. An empty card explains itself under its header ────────────────────────

describe('CardHintNote placement is decided by emptiness, not fixed', () => {
  it('defaults to the foot when a caller passes no placement', () => {
    // The default is what makes EnergyMeter's mount below a deliberate choice rather than an
    // omission — assert it, or "no prop" stops meaning anything.
    const source = code('components/CardHintNote.tsx');
    expect(source).toMatch(/placement = 'foot'/);
    expect(source).toMatch(/const head = placement === 'head';/);
    // Head: no hairline to attach it to what it follows, no marginTop (the header owns that
    // gap), a marginBottom instead. Foot keeps the shape it has had since 2026-07-30.
    expect(source).toMatch(/head: \{\s*marginBottom: Spacing\.md,\s*\}/);
    expect(source).toMatch(/foot: \{[\s\S]*?borderTopWidth: StyleSheet\.hairlineWidth[\s\S]*?marginTop: Spacing\.md,/);
  });

  // Every explainer leads its card. The second index is the card's BODY — the thing the note
  // introduces rather than follows.
  //
  // The first five are empty-gated; the two tabs (2026-08-13) are PERMANENT and still at the
  // head, which is what separates the two readings of the original ruling. "Explanation always
  // sits underneath sub-header" is about POSITION; "only when the card is empty" was about
  // whether it stays, and that is each caller's own call. Before the tabs moved onto the shared
  // component every head caller happened to be empty-gated, so the two were indistinguishable
  // and this file used to describe the gate as deciding the placement. It doesn't.
  for (const [file, body, label] of [
    ['components/PlanTaskCard.tsx', 'styles.emptyWrap', 'the day card'],
    ['components/HomeHabitsCard.tsx', '<PadSheet', "Home's habits card"],
    ['components/HomeNotesCard.tsx', '<PadSheet', "Home's notes card"],
    ['components/HomeShoppingCard.tsx', 'styles.weekRow', "Home's shopping card"],
    ['components/MedicineTrayCard.tsx', '<Collapsible', 'the medicine tray card'],
    ['app/(tabs)/habits.tsx', 'styles.habitsCardBody', 'the Habits tab'],
    ['app/(tabs)/health.tsx', 'styles.healthCardBody', 'the Health tab'],
  ] as const) {
    it(`${label} explains itself under its header, not at its foot`, () => {
      const source = code(file);
      const mounts = source.match(/<CardHintNote[\s\S]*?\/>/g) ?? [];
      expect(mounts).toHaveLength(1);
      expect(mounts[0]).toContain('placement="head"');
      // `noBorder` was the foot's "don't double the pad's own rule" escape hatch; at the head
      // there is no hairline to suppress, so a caller passing both is stating something false.
      expect(mounts[0]).not.toContain('noBorder');
      const note = source.indexOf('<CardHintNote');
      const content = source.indexOf(body);
      expect(content).toBeGreaterThan(-1);
      expect(note).toBeLessThan(content);
    });
  }

  it('leaves the Energy hint at the foot — it is permanent, not an empty state', () => {
    // The counter-case, and the reason this describe asserts a RULE rather than five
    // positions. EnergyMeter's hint sits under a meter that has a number in it: teaching
    // between a title and content the user already has is exactly what 2026-07-30 moved out
    // of the way, and that half of the decision still stands.
    const source = code('components/EnergyMeter.tsx');
    const mounts = source.match(/<CardHintNote[\s\S]*?\/>/g) ?? [];
    expect(mounts).toHaveLength(1);
    expect(mounts[0]).not.toContain('placement');
  });
});
