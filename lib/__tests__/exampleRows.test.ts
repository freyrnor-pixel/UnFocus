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
 *   4. **No card carries a lightbulb explainer line at all** (2026-08-17, replacing the
 *      placement rule this slot used to hold). The maintainer's ruling: *"A native app should
 *      not read like a manual… Delete all lightbulb (💡) sections entirely."* So
 *      `components/CardHintNote.tsx` is deleted and section 4 below asserts its ABSENCE across
 *      all eight former callers, plus that nothing hand-rolls a bulb-and-italic replacement.
 *      *(What it used to say, kept because the position rule is still the right one if a
 *      shorter explainer is ever wanted again: every `CardHintNote` was `placement="head"` —
 *      under the card's header — except `EnergyMeter`'s, which annotated a meter with a NUMBER
 *      IN IT and stayed at the foot. Position and lifespan were separate decisions:
 *      "explanation always sits underneath sub-header" answered the first, "only when the card
 *      is empty" was each caller's own answer to the second.)*
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
import { existsSync, readdirSync, readFileSync } from 'fs';
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

/** Every `.tsx`/`.ts` under app/, components/ and lib/, repo-relative. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(rel);
      } else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
  };
  for (const root of ['app', 'components', 'lib']) walk(root);
  return out;
}

/**
 * Every `<Card …>` opening tag in a file, ended at the `>` that is at brace depth 0.
 *
 * ⚠️ Depth-aware on purpose: a non-greedy `.*?>` ends inside the first prop containing a
 * comparison — `count={notes.length > 0 ? … }` — and then reports cards that are fine.
 */
function cardTags(src: string): string[] {
  const out: string[] = [];
  const re = /<Card\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    for (let i = m.index; i < src.length; i += 1) {
      const c = src[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) { out.push(src.slice(m.index, i + 1)); break; }
    }
  }
  return out;
}

// ── 1. The composer is never narrowed by its own preview ─────────────────────

// ⚠️ **The CONTROL in this slot changed on 2026-08-16 (brief §8); the INVARIANT did not.**
// This block used to be titled "the ghost ring is inside the field" and asserted over a dim
// preview ring that only appeared while the line was idle. That ring is gone: the slot now
// holds a real submit arrow, present in every state, muted when the line is empty and filled
// with the card's categorical colour once there is text ("instead of an empty circle, place a
// highly tactile submit button... inside the right side of the text input").
//
// What is being protected is unchanged and is the reason this file exists: **the composer is
// never narrowed by whatever sits at its trailing edge.** As a flex sibling that control cost
// the field ~26px, so the composer was narrower than the example row and the real rows below
// it, and it jumped width whenever the control mounted or unmounted. Anything that lands in
// this slot has to be absolutely positioned inside the field's own box.
describe('PadTypeRow — the trailing control is inside the field, not beside it', () => {
  const source = code('components/PadTypeRow.tsx');

  it('renders the control within the field wrapper rather than as a sibling of it', () => {
    // The bug was structural, not numeric: as a sibling in a flex row it took layout width
    // away from a `flex: 1` field. Assert it is no longer emitted next to the field in either
    // of the two return branches (`panel` and inline).
    expect(source).not.toMatch(/\{fieldAndPrompt\}\s*\{submitButton\}/);
    expect(source).not.toMatch(/\{moreButton\}\s*\{confirmButton\}/);
    // ...and that it IS emitted inside the field wrapper, after the TextInput.
    expect(source).toMatch(/styles\.field[\s\S]{0,4000}\{submitButton\}\s*<\/View>/);
  });

  it('positions the control absolutely, so it takes no layout width at all', () => {
    expect(source).toMatch(/submitSlot: \{[^}]*position: 'absolute'/);
    expect(source).toMatch(/submitSlot: \{[^}]*right: Spacing\.sm/);
  });

  it("derives the field's reserved right padding from the control's own size", () => {
    // Two hand-written numbers here is how the placeholder ends up running under the button.
    expect(source).toMatch(/const SUBMIT_SIZE = 26;/);
    expect(source).toMatch(/inputWithSubmit: \{ paddingRight: Spacing\.sm \* 2 \+ SUBMIT_SIZE \}/);
    expect(source).toMatch(/submit: \{\s*width: SUBMIT_SIZE,\s*height: SUBMIT_SIZE/);
  });

  it('reserves that padding exactly when the control is mounted', () => {
    // Now that the control is live in every state, the padding is too — the old ring released
    // the line back on focus, which is precisely the width jump this file was written about.
    // The pairing is what matters: the same flag gates the mount and the inset.
    expect(source).toMatch(/showSubmit && styles\.inputWithSubmit/);
    expect(source).toMatch(/const showSubmit = !noGhostCheck;/);
  });

  it('lights the control in the card\'s categorical colour once there is text', () => {
    // Brief §8's "when the user types, this button should light up in the Categorical Color".
    // `accent` is the per-CARD hue the caller passes, not the ambient screen hue — on Home the
    // To-do and Habits cards share one hue-less screen and must still light differently.
    expect(source).toMatch(/backgroundColor: active \? accent : theme\.surfaceMuted/);
    expect(source).toMatch(/color=\{active \? contrastOn\(accent\) : theme\.textMuted\}/);
  });
});

// ── 2. An example is the same box as the row it stands in for ────────────────

describe('StarterExampleRow — borderless, sitting on the card it is an example inside', () => {
  const source = code('components/StarterExampleRow.tsx');

  // 2026-08-18: *"Do NOT place borders, `<Divider/>` lines, or separate background boxes inside
  // of main cards… List items, text inputs, and suggestion chips must sit seamlessly on the
  // main card's background."* The dashed field-rung edge this used to be pinned TO is the
  // thing that went; these assertions are its mirror image, so a future session restoring the
  // old finish from the (deliberately preserved) history notes fails here.
  it('draws no edge of any kind — not on the row, not on its two marks', () => {
    expect(source).not.toMatch(/borderStyle: 'dashed'/);
    expect(source).not.toMatch(/borderWidth/);
    expect(source).not.toMatch(/borderColor/);
  });

  it('has no fill either, so it never reads as a filled row on the card', () => {
    expect(source).not.toMatch(/row: \{[^}]*backgroundColor/);
  });

  it('says "provisional" through ink alone, and upright', () => {
    // Muted on every part of the row, and no italic anywhere (*"Remove all italicized text"*).
    expect(source).not.toMatch(/fontStyle: 'italic'/);
    expect(source).toMatch(/color: theme\.textMuted/);
  });

  it('keeps the row geometry, which is the one thing that makes it an EXAMPLE', () => {
    // An example has to be the same shape as the thing it is an example of. The finish may
    // change (it has, twice); the height must not.
    expect(source).toMatch(/paddingVertical: Spacing\.sm/);
    expect(source).toMatch(/const MARK = 22/);
  });
});

describe('StarterSuggestionChip — the same finish as the row, the shape kept different', () => {
  const chip = code('components/StarterSuggestionChip.tsx');
  const row = code('components/StarterExampleRow.tsx');

  // 2026-08-12, from "Examples are placed the same througout app, but does not look the same …
  // the dottet lines instead of full border and the filled buttons. I prefer the visual in the
  // to-do preview card." The 2026-08-10 provisional reversal had been applied to the ROW only,
  // so the chips still wore the styling it removed. The CHANNELS have since changed twice —
  // they are ink-only as of 2026-08-18 — but the rule that the two shapes share ONE finish is
  // what this has always been guarding, so it is asserted over both files, as before.
  it('carries the same provisional channels the row does, and no others', () => {
    for (const absent of [/borderStyle: 'dashed'/, /fontStyle: 'italic'/, /borderWidth/]) {
      expect({ channel: String(absent), chip: absent.test(chip), row: absent.test(row) })
        .toEqual({ channel: String(absent), chip: false, row: false });
    }
    // A matte plate is the chip's whole shape, and the row's two marks use the same helper —
    // one borderless finish, from one place.
    expect(chip).toMatch(/getMatte\(isDark\)/);
    expect(row).toMatch(/getMatte\(isDark\)/);
  });

  it('spends the accent on the "+" and nothing else', () => {
    // A.4 rule 1 — the accent marks the ACTION, never the ink. Three of the five call sites
    // this component replaced drew an accent glyph on the LEFT and had no "+" at all.
    expect(chip).toMatch(/name="add" size=\{14\} color=\{theme\.accent\}/);
    expect(chip).toMatch(/color=\{theme\.textMuted\}/);
    expect(chip).not.toMatch(/label: \{[^}]*theme\.accent/);
  });

  it('takes no colour prop, so an edge cannot be hued at one call site and not another', () => {
    // Habits hued its chip's edge with the screen colour while Goals, the
    // Goals drawer and the health sheet used theme.border — half of why five copies never
    // matched. The edge is neutral everywhere now; the hue reaches it through the card.
    // Since 2026-08-18 the chip has no edge at all, so the stronger form of the same claim is
    // that neither file takes a colour prop — the hue reaches both through the card that holds
    // them, and can therefore never be applied at one call site and not another.
    expect(chip).not.toMatch(/accent: string/);
    expect(row).not.toMatch(/accent: string/);
  });

  it('keeps the pill radius the row does not — the shape is the deliberate difference', () => {
    // The chip is still a pill; the row no longer draws a box at all, which is a stronger
    // version of "these two are different shapes" than the old radius pair was.
    expect(chip).toMatch(/borderRadius: Radius\.full/);
    expect(row).not.toMatch(/row: \{[^}]*borderRadius/);
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
    'components/HabitsSurface.tsx',
    // app/goals.tsx was a caller until it was retired (2026-08-12), and its successor
    // components/GoalsEditor.tsx until 2026-08-13 — see the test directly above. What is left
    // is the two habit surfaces and the health sheet, all of them short-label clouds that
    // genuinely pair up on a line, which is what the chip is for.
    'components/HealthIssuesEditor.tsx',
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

describe('PlanTaskCard — the two empty-day rows are one shape', () => {
  const source = code('components/PlanTaskCard.tsx');
  const exampleRow = code('components/StarterExampleRow.tsx');

  it('gives the ghost add-row exactly the example row\'s finish — which is now no edge at all', () => {
    const emptyAddRow = source.match(/emptyAddRow: \{[^}]*\}/)?.[0] ?? '';
    const example = exampleRow.match(/row: \{[\s\S]*?\n  \}/)?.[0] ?? '';
    // Asserted against the example row's own source rather than restated, so the pair cannot
    // drift apart one file at a time — the point of this test since 2026-08-12, when the two
    // had different corners and different weights. They match by absence now (2026-08-18).
    for (const box of [emptyAddRow, example]) {
      expect(box).not.toMatch(/border/);
      expect(box).not.toMatch(/backgroundColor/);
      expect(box).toMatch(/paddingVertical: Spacing\.sm/);
    }
  });

  it('stacks the empty state at the gap real rows stack at', () => {
    // Both moved xs → sm on 2026-08-15 when rows lost their borders (Tactile Glass): with no
    // border to keep two rows apart, the gap became the ONLY separation and 4px stopped being
    // one. The pairing is the point of this test and is unchanged — an empty card must be at
    // the same rhythm as the rows it stands in for, or it re-spaces itself when the first row
    // lands. This caught them drifting during that very pass, which is exactly its job.
    expect(source).toMatch(/emptyWrap: \{ gap: Spacing\.sm \}/);
    expect(code('components/PadSheet.tsx')).toMatch(/Spacing\.xs : Spacing\.sm\) \* shape\.spacingScale/);
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
    // `noTree` joined the gate on 2026-08-19 (Energy's card draws no watermark) — the
    // assertion still pins that `embedded` is one of the terms that suppresses it.
    expect(source).toMatch(/\{compact \|\| embedded \|\| noTree \? null : \(/);
    // Presentation only — the same contract FoodTab/CatalogueTab's `embedded` carries. The
    // body is built once and used by both branches, which is what makes that true structurally
    // rather than by review.
    expect(source).toMatch(/const body = \(/);
    expect(source).not.toMatch(/embedded \?[^\n]*collapsible/);
  });

  for (const [file, label] of [
    ['components/HealthSurface.tsx', 'Health'],
    ['components/HabitsSurface.tsx', 'Habits'],
    ['components/GoalsEditor.tsx', 'the Goals drawer'],
    // 2026-08-12: the day card joined this list when its bare example gained the shared
    // collapse trigger, and components/MedicineSurface left it — that card's explainer is a
    // CardHintNote now, so it mounts no StarterCard at all (asserted separately below).
    ['components/PlanTaskCard.tsx', 'the day card'],
    // 2026-08-13: Home's habits card stopped hand-rolling a label-plus-bare-cloud stand-in
    // for the trigger row and mounts the real thing.
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
        // ⚠️ **Inverted 2026-08-19 (Clean Reveal).** This asserted the OPPOSITE until then —
        // that every mount passes an `exampleHeaderLabel`, because StarterCard had no default
        // copy. The prop is gone and the trigger is one shared word, so what has to stay true
        // now is that no caller reintroduces a label of its own: four per-surface sentences for
        // one control is exactly the drift that produced "Tap one to start:" and "Examples:"
        // labelling the same row on two screens.
        expect({ file, mount, ownLabel: /exampleHeaderLabel|tapToAdd/.test(mount) })
          .toEqual({ file, mount, ownLabel: false });
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
    expect(props).not.toMatch(/\btext=/);
    // The ghost add-row stays OUTSIDE it: on the `readOnly && !onAddTask` branch it is the
    // only way in, and a collapse must never take away the last "add something" affordance.
    //
    // Checked by POSITION against the StarterCard block's own end, not by a character distance
    // from `example={`. It was `not.toMatch(/example=\{[\s\S]{0,600}styles\.emptyAddRow/)`
    // until 2026-08-13, when deleting one prop line from the example row shortened the gap
    // under 600 and failed the test while the ghost row was still exactly where it belonged.
    // A window that a formatting change can walk across is measuring the wrong thing.
    expect(source).toMatch(/styles\.emptyAddRow/);
    const starterCardEnd = source.indexOf(') : null}', source.indexOf('<StarterCard'));
    expect(starterCardEnd).toBeGreaterThan(-1);
    expect(source.indexOf('styles.emptyAddRow')).toBeGreaterThan(starterCardEnd);
  });

  it('the medicine card carries no empty-state explainer at all', () => {
    // It had a StarterCard, then the shared CardHintNote line (2026-08-12), and now neither
    // (2026-08-17). Nothing was lost that the card does not already say: its own add field sits
    // directly under the header, and a tray's "window, not a deadline" framing is carried by the
    // copy on the tray rows themselves.
    const source = code('components/MedicineSurface.tsx');
    expect(source).not.toMatch(/<StarterCard/);
    expect(source).not.toMatch(/<CardHintNote/);
  });

  it('leaves the Energy tutorial as a real card — it IS the meter, not a note beside one', () => {
    const source = code('components/EnergyMeter.tsx');
    const mounts = source.match(/<StarterCard[\s\S]*?>/g) ?? [];
    expect(mounts.length).toBe(1);
    expect(mounts[0]).not.toContain('embedded');
    // …and it carries NO explanatory text since 2026-08-17 ("Remove the 'Energy is how much a
    // day holds…' block"). What is left is the card and the one button into the config sheet,
    // which is the only thing this state exists to offer.
    expect(mounts[0]).not.toMatch(/\btext=/);
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
    const source = code('components/HealthSurface.tsx');
    const section = source.indexOf('styles.section');
    const starter = source.indexOf('<StarterCard');
    // The MOUNT, not what is inside it — see the identical note on the Habits case below.
    const composer = source.indexOf('<DraftComposer');
    expect(section).toBeGreaterThan(-1);
    expect(section).toBeLessThan(starter);
    expect(starter).toBeLessThan(composer);
  });

  it('Habits puts its suggestions in the same place', () => {
    const source = code('components/HabitsSurface.tsx');
    const section = source.indexOf('styles.section');
    const starter = source.indexOf('<StarterCard');
    // ⚠️ **The marker is the composer's MOUNT, not the component inside it** (2026-08-28).
    // This read `<PadTypeRow` until the quick-add's draft state was lifted into a component
    // that owns it (`components/DraftComposer.tsx`, for performance) — which moved the
    // `<PadTypeRow` *definition* out of this file entirely, so the index found nothing like
    // the mount and a layout test failed over a change that moved no layout. The rule here is
    // about where the composer is MOUNTED in the card; a marker naming an implementation
    // detail of the composer answers a different question.
    const composer = source.indexOf('<DraftComposer');
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
// ── 6. The suggestions drop-down is a clean reveal ───────────────────────────

describe('StarterCard — the suggestions drop-down starts shut and says one word', () => {
  // 2026-08-19. The report was a specific broken state, not a preference: *"when collapsed, it
  // displays instructional text ('Trykk på én for å komme i gang:') with nothing underneath
  // it."* An instruction is only true while what it points at is visible, and the 2026-08-06
  // pass had introduced a state where it was not. Every assertion here is invisible to a
  // screenshot for the same reason section 5's fold is: the shut state is not the state a
  // screenshot is taken in, and a label is a string in a prop.
  const SRC = () => code('components/StarterCard.tsx');

  it('opens shut, not shown', () => {
    // The whole point of the pass. `useState(false)` on a variable named for EXPANSION —
    // asserted on the name too, because the previous variable was named for COLLAPSE and the
    // identical literal meant the opposite thing.
    expect(SRC()).toMatch(/const \[isExpanded, setIsExpanded\] = useState\(false\);/);
    expect(SRC()).not.toMatch(/const \[collapsed, setCollapsed\]/);
  });

  it('labels the trigger with the one shared word, and takes no label prop', () => {
    const source = SRC();
    expect(source).toContain('{t.starters.suggestionsLabel}');
    // The prop is deleted, not defaulted — a caller cannot pass a sentence back in.
    expect(source).not.toMatch(/exampleHeaderLabel\??:/);
  });

  it('points the chevron the way the row actually goes', () => {
    // Down = there is more below; up = fold it away. It reads backwards if this is inverted
    // together with the state rename, which is precisely the mistake the rename invites.
    expect(SRC()).toMatch(/name=\{isExpanded \? 'chevron-up' : 'chevron-down'\}/);
  });

  it('reveals the suggestions and nothing else', () => {
    // Zero-text affordance: *"Do NOT add any explanatory sentences inside the expanded view.
    // Rely entirely on the `+` icon inside the matte chips."* The revealed body may hold the
    // caller's `example` rows and its `children` chips — no third slot, and no <Text> of this
    // component's own between the trigger and them.
    const source = SRC();
    // Bounded by the OUTER ternary's else-branch (`) : (`, the non-collapsible rendering),
    // not by the first `) : null}` — the revealed body contains two of those itself, and
    // stopping at the nearer one cut `{children}` out of the region being checked.
    const open = source.indexOf('{isExpanded ? (');
    expect(open).toBeGreaterThan(-1);
    const body = source.slice(open, source.indexOf(') : (', open));
    expect(body).toContain('{example}');
    expect(body).toContain('{children}');
    expect(body).not.toMatch(/<Text/);
  });

  it('keeps a full-size target under the small muted mark', () => {
    // Rule 17. The row is one word and a 16px glyph, so without this it is ~31px tall — and a
    // reveal nobody can hit is worse than one that was already open.
    expect(SRC()).toMatch(/minHeight: MIN_TAP_TARGET/);
  });

  it('leaves no per-surface trigger copy in the dictionaries', () => {
    // All four `starters.*.tapToAdd` strings are deleted in EN, NO and IS alike. Kept as a
    // ratchet: the failure mode here is a new surface quietly authoring a fifth one.
    expect(read('lib/i18n.ts').replace(/^\s*(\*|\/\/|\/\*).*$/gm, '')).not.toMatch(/tapToAdd:/);
  });
});

describe('the composer comes after the examples, everywhere', () => {
  // ⚠️ **A composerMarker must name the composer's MOUNT SITE.** Naming what is *inside* the
  // composer (`<PadTypeRow`) breaks the moment the draft state is lifted into a component that
  // owns it — which is what `components/DraftComposer.tsx` now is for five surfaces. This
  // table was written against `<PadTypeRow` and broke twice in one day for that reason, both
  // times over a change that moved no layout at all. Three of the four rows are `<DraftComposer`
  // now; the Goals drawer still mounts `AddRow` inline, so there the mount IS the tag.
  for (const [file, starterMarker, composerMarker, label] of [
    ['components/HealthSurface.tsx', '<StarterCard', '<DraftComposer', 'Health'],
    ['components/HabitsSurface.tsx', '<StarterCard', '<DraftComposer', 'Habits'],
    ['components/GoalsEditor.tsx', '<StarterCard', '<AddRow', 'the Goals drawer'],
    // The day card builds its type line into a `typeRow` const and mounts that const in two
    // places (ruled list and timeline), so the const's USE is its mount.
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
    // The rows were wrapped in a `<Collapsible>` until 2026-08-21, when 'closed' left the pad
    // axis and folding became components/Card.tsx's job; since 2026-08-28 they are built as
    // `lines` above the JSX and PLACED inside the connected list (lib/rowList.ts). So the anchor
    // has to be where they are placed, not where they are built — measuring from the `.map()`
    // would put the rows at the top of the file and pass no matter what the JSX did.
    const jsx = source.indexOf('<View style={[styles.sheet, style]}>');
    const rows = source.indexOf('{lines}', jsx);
    const typeLine = source.indexOf('styles.typeLine', jsx);
    const footer = source.indexOf("state === 'open' && footer", jsx);
    expect({ jsx: jsx > -1, rows: rows > -1 }).toEqual({ jsx: true, rows: true });
    expect(typeLine).toBeGreaterThan(rows);
    expect(footer).toBeGreaterThan(typeLine);
  });
});

// ── 4. No card explains itself in a lightbulb line ───────────────────────────

describe('the bulb explainer line is back, and only in one place', () => {
  // ⚠️ **REVERSES the 2026-08-17 deletion, on the maintainer's ruling against round 20's drawn
  // screens** (2026-08-27). That pass deleted `components/CardHintNote.tsx`, the 💡 glyph and
  // `fontStyle: 'italic'` app-wide — *"A native app should not read like a manual… Delete all
  // lightbulb (💡) sections entirely."* The mockups put an italic, bulb-prefixed line back under
  // every content card's header, and the maintainer chose the mockup.
  //
  // What has to stay true is narrower than "no bulbs", and these assertions encode it:
  //   1. There is exactly ONE component that draws it, and one mount site (components/Card.tsx's
  //      `hint` prop). The 2026-08-17 complaint was about a TIER of explanatory text appearing
  //      card by card, so a single generator is what stops that recurring.
  //   2. Nothing hand-rolls a second one out of the same two ingredients.
  //   3. It uses `Fonts.italic`, never `fontStyle: 'italic'` — see below.
  //   4. It is drawn only while a card has content, gated at each call site.
  // The rest of the tier stays deleted: `HintCard` is still gone (asserted just below), and
  // `StarterCard` is still what an EMPTY surface says.

  it('has exactly one component drawing it, and Card is its only mount', () => {
    expect(existsSync(join(ROOT, 'components/CardHintLine.tsx'))).toBe(true);
    // The old component stays deleted — this is a new, narrower one, not a restoration.
    expect(existsSync(join(ROOT, 'components/CardHintNote.tsx'))).toBe(false);
    const offenders = sourceFiles().filter(
      (rel) => rel !== 'components/Card.tsx' && /<CardHintLine\b/.test(code(rel)),
    );
    expect(offenders).toEqual([]);
    expect(code('components/Card.tsx')).toMatch(/<CardHintLine\b/);
  });

  it('is the only bulb in the app', () => {
    // A second `bulb-outline` anywhere is the tier coming back one card at a time, which is
    // exactly what the 2026-08-17 ruling was about and what a single generator prevents.
    const offenders = sourceFiles().filter(
      (rel) => rel !== 'components/CardHintLine.tsx' && /name="bulb-outline"/.test(code(rel)),
    );
    expect(offenders).toEqual([]);
  });

  it('every hint fits its two-line clamp, in all three languages', () => {
    // ⚠️ **This is the guard that actually RUNS, and `npm run wraps` is not.** That audit has a
    // `CARD HINT` pass measuring the real clamp in the real app — but a hint only draws on a card
    // that HAS content, and the wrap walk runs on a fresh install where every card is empty, so
    // it reports "0 drawn". A gate that can never fire is not a gate; it stays there for a walk
    // that seeds data, and this stands in for it meanwhile.
    //
    // The budget: `FontSize.xs` (13) in a card ~296px wide at 360px, less the bulb glyph and its
    // gap (22), is ~274px per line. Nunito at 13px averages ~6.4px a character, so ~42 per line
    // and ~85 across the two. 90 is that with a little slack, which is honest for an average-
    // width estimate — a string near the cap should be checked in the app rather than trusted.
    //
    // A SOURCE scan, like `copyTone.test.ts` next door and for its reason: the dictionaries are
    // not exported (only `getTranslations`), and reading the file catches all three at once
    // including any that a future edit adds to one language and forgets in another.
    const CAP = 90;
    const src = readFileSync(join(ROOT, 'lib/i18n.ts'), 'utf8');
    const blocks = [...src.matchAll(/\n  cardHint: \{([\s\S]*?)\n  \},/g)];
    // Three dictionaries, three blocks. If this ever reads 0 or 1 the scan has silently stopped
    // finding them, which would pass vacuously — the failure mode this whole file is about.
    expect(blocks).toHaveLength(3);
    const offenders: string[] = [];
    for (const [i, block] of blocks.entries()) {
      for (const line of block[1].matchAll(/^\s*(\w+): '(.*)',$/gm)) {
        if (line[2].length > CAP) {
          offenders.push(`${['en', 'no', 'is'][i]}.cardHint.${line[1]}: ${line[2].length} chars`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every card that passes a hint gates it on having content', () => {
    // Both drawn at once stacks two muted italic lines with nothing between them — the hint and
    // either NarratorQuote or StarterCard's line. The gate has to be at the call site because
    // only the card knows what empty means for it; what is checked here is that there IS one.
    const offenders: string[] = [];
    for (const rel of sourceFiles()) {
      for (const tag of cardTags(code(rel))) {
        const hint = tag.match(/hint=\{([^}]*)\}/);
        if (!hint) continue;
        // A conditional — `x > 0 ? … : undefined`, `x.length ? … : undefined`. A bare
        // `hint={t.cardHint.foo}` draws on the empty state too.
        if (!/\?/.test(hint[1])) offenders.push(`${rel}: hint is not gated on content`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * ⚠️ **The HintCard tier stays deleted at the SITE too, not only as a component** (2026-08-21,
   * CONSISTENCY_AUDIT.md §5). The 2026-08-20 pass deleted `components/HintCard.tsx`, and
   * `app/scan.tsx` then re-implemented it locally — a `Surface` with a 4px accent bar and an
   * information glyph around a permanent sentence — with a comment saying out loud that it was
   * *"an info banner in the same family as components/HintCard.tsx"*. Deleting a component does
   * not delete an idea; this is what stops the idea being rebuilt one screen at a time.
   *
   * The two ingredients ARE the tier: `components/StarterCard.tsx`, which is where an
   * explanation lives now, is deliberately a neutral card with no bar and no glyph, precisely
   * so the two never read as twins on a first visit.
   */
  it('no screen rebuilds the accent-barred info banner around a tip', () => {
    const source = code('app/scan.tsx');
    expect(source).not.toMatch(/tipAccent/);
    expect(source).not.toMatch(/name="information-circle-outline"[^>]*color=\{theme\.good\}/);
  });

  /**
   * A tip that appears only when the surface is NOT empty is the rule stood on its head, and it
   * is the shape that survives review longest — every screenshot of a working screen shows it
   * doing something reasonable. `components/SavedListsSection.tsx` returned `null` when empty,
   * so its `subtitle` was visible exactly when the card had content.
   */
  it('SavedListsSection carries no subtitle, and the key is gone from every dictionary', () => {
    expect(code('components/SavedListsSection.tsx')).not.toMatch(/subtitle=/);
    expect(read('lib/i18n.ts')).not.toMatch(/savedListsSectionHint/);
  });

  it('leaves the empty-state card as the one place a screen explains itself', () => {
    // ⚠️ **Rewritten 2026-08-20.** This asserted the ⓘ banner's own clamp
    // (components/HintCard.tsx's `HINT_LINES`) as "the tier that survives". That banner is
    // deleted app-wide — the maintainer's rule is now that a tip belongs to a card's EMPTY
    // STATE — so the surviving tier is components/StarterCard.tsx's one short line, and its
    // clamp is what has to hold instead. Same property, one rung down: teaching copy is opt-in
    // by being tied to emptiness, and cannot grow back into a paragraph.
    const source = code('components/StarterCard.tsx');
    expect(source).toMatch(/const STARTER_TEXT_LINES = \d;/);
    expect(Number(source.match(/const STARTER_TEXT_LINES = (\d);/)![1])).toBeLessThanOrEqual(3);
    expect(source).toMatch(/numberOfLines=\{STARTER_TEXT_LINES\}/);
    // The italic went with the bulb in the 2026-08-18 blueprint pass — same ruling.
    expect(source).not.toMatch(/fontStyle: 'italic'/);
  });
});
