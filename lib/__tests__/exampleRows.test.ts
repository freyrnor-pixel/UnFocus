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
    ['components/MedicineTrayCard.tsx', 'the medicine tray card'],
  ] as const) {
    it(`${label} mounts it embedded`, () => {
      const source = code(file);
      const mounts = source.match(/<StarterCard[\s\S]*?(?:\/>|>)/g) ?? [];
      expect(mounts.length).toBeGreaterThan(0);
      for (const mount of mounts) expect({ file, mount, embedded: mount.includes('embedded') }).toEqual({ file, mount, embedded: true });
    });
  }

  it('leaves the Energy tutorial as a real card — it IS the meter, not a note beside one', () => {
    const source = code('components/EnergyMeter.tsx');
    const mounts = source.match(/<StarterCard[\s\S]*?>/g) ?? [];
    expect(mounts.length).toBe(1);
    expect(mounts[0]).not.toContain('embedded');
  });

  it('is what the Goals drawer uses instead of its old hand-copied explainer', () => {
    const source = code('components/GoalsEditor.tsx');
    expect(source).toMatch(/<StarterCard embedded text=\{t\.hints\.goals\.text\}>/);
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
