/**
 * cardAnatomy.test.ts — a card header is one shape, and its recurring controls sit in one order.
 *
 * Maintainer, 2026-08-21:
 *   · *"Collapsed card also look the same, only differ in color. (Now some of them have different
 *     text size, some have icon while others not, some have a line and some don't)"*
 *   · *"Recurring/common buttons or elements like expand button or full screen button must be
 *     placed in the same place per card."*
 *   · *"Similar icons and/or buttons that look alike but are not the same should be placed the
 *     same place to keep visual flow."*
 *
 * All three are the same defect seen from three angles, and the measurements are in
 * CONSISTENCY_AUDIT.md §2/§8/§12: **fourteen distinct collapsed-header variants** shipped at
 * once. Title sizes ran 17 / 20 (spelled three different ways) / 24. Chevrons ran 13, 14, 16, 18
 * and a plated `IconButton size={30}`. The hue hairline under the header existed on exactly one
 * of the fourteen. `CardCollapseToggle` — the shared control for the job — was bypassed by nine
 * call sites.
 *
 * **Why it kept coming back.** `SectionCard`/`SectionRail` IS the canonical header, and it is
 * good. But it is only reachable by a card that happens to be a `SectionCard`; every other
 * collapsible built its own, and nothing said it may not. `DESIGN_RULES.md` had 25 rules about
 * spacing, colour, motion and targets, and **no rule at all about which component draws a card
 * header** — so each new surface re-derived one, correctly by its own lights. A single screen's
 * screenshot looks fine; the divergence only shows beside the card one screen away, which
 * nothing in the review loop ever compares.
 *
 * ⚠️ **These are source scans because there is no renderer.** `@react-native-testing-library` is
 * not a dependency and `components/`/`app/` are excluded from coverage entirely, so a guard here
 * can prove a file USES the right component and can never prove the result LOOKS right. That
 * ceiling is real; see the audit's closing section.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** Comments stripped — a scan must never fire on prose ABOUT the thing it bans. */
const code = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function sourceFiles(): string[] {
  const walk = (abs: string): string[] =>
    fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
      const next = path.join(abs, entry.name);
      if (entry.isDirectory()) return walk(next);
      return /\.tsx$/.test(entry.name) ? [next] : [];
    });
  return [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
    .map((f) => f.slice(ROOT.length + 1))
    .sort();
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 1. The fold control is one component
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Files allowed to draw a FOLD chevron without going through `components/CardCollapseToggle.tsx`.
 *
 * ⚠️ **The scan is scoped to `<AnimatedChevron>` and to a raw `chevron-up`/`chevron-down`, and
 * that scoping is load-bearing.** The first draft also matched `chevron-forward`/`chevron-back`
 * and immediately flagged twelve files — `app/day-log.tsx`, `components/SendToSheet.tsx`,
 * `components/CardMenuSheet.tsx` and the rest — none of which draws a card fold at all. Those
 * are NAVIGATION affordances (go there, close this), a different control with a different glyph
 * axis. Widening the net would have meant either twelve fake allowlist entries or a rule nobody
 * could satisfy, and both roads end with the guard being switched off. Up/down is the fold axis;
 * forward/back is the going-somewhere axis, and this file has no opinion on the second.
 *
 * Same contract as `fieldAnatomy.test.ts`'s allowlist: KEEP is a real exception, BACKLOG is the
 * audit's deferred work and is expected to leave. The point is not that the list is short today
 * — it is that a FIFTEENTH header variant cannot arrive without someone writing a line here.
 */
const CHEVRON_ALLOWED: Record<string, string> = {
  // ── KEEP: the shared implementations, and controls on a different axis ──────────────────
  'components/CardCollapseToggle.tsx': 'KEEP — the shared fold control itself.',
  'components/AnimatedChevron.tsx': 'KEEP — the glyph primitive CardCollapseToggle is built from.',
  'components/CollapsedSection.tsx':
    'KEEP — the sub-screen drawer, and the control CardCollapseToggle was generalised FROM. Its '
    + 'header carries two tap targets by instruction (2026-08-10), so it owns its own chevron box.',
  'components/PadFooterToggle.tsx':
    'KEEP — the pad-state control (closed/preview/open), which is a DIFFERENT axis from '
    + 'collapsedCards. It sits at the card foot with a count label — a documented divergence.',
  'components/TaskCard.tsx':
    'KEEP — a ROW expanding in place, not a card folding. The row rule owns this one.',
  'components/StarterCard.tsx':
    'KEEP — the empty-state suggestions drop-down, which starts shut and is not a card fold.',
  'components/FormControls.tsx':
    'KEEP — the inline picker/segment disclosure, a form control rather than a card header.',
  'components/GoalPicker.tsx': 'KEEP — a picker disclosure inside an editor, not a card fold.',
  'components/ShoppingFilterBar.tsx':
    'KEEP — the category chooser\'s `showsMore` affordance on a composer cell.',

  // ── BACKLOG: the header variants CONSISTENCY_AUDIT.md §2 measured ──────────────────────
  'components/WeekListCard.tsx':
    'BACKLOG — a plated IconButton chevron sitting in the ⤢ slot; the only card whose fold '
    + 'control is a key cap, and the only one whose fold is outermost.',
  'components/FoodTab.tsx':
    'BACKLOG — two: a bare AnimatedChevron in the meal-section header, and a LEADING raw chevron '
    + 'on dish rows (the only leading chevron in the app).',
  'components/ExpandableCard.tsx':
    'BACKLOG — a bare AnimatedChevron with no tap box, in a header that also draws a top hairline.',
  'components/TodoSurface.tsx':
    'BACKLOG — two bare AnimatedChevrons, one of them the app\'s only hue-coloured header chevron.',
  'components/HomeNotesCard.tsx': 'BACKLOG — a bare AnimatedChevron beside the pad footer toggle.',
  'components/PlanTaskCard.tsx': 'BACKLOG — two bare AnimatedChevrons in the day-view card.',
  'app/(tabs)/shopping.tsx': 'BACKLOG — a bare AnimatedChevron on the monthly-list card headers.',
};

/** `<AnimatedChevron>` or a raw up/down Ionicons name — see CHEVRON_ALLOWED on the scoping. */
const drawsFoldChevron = (rel: string) =>
  /<AnimatedChevron\b/.test(code(rel)) || /chevron-(up|down)\b/.test(code(rel));

describe('the fold control is one component', () => {
  const files = sourceFiles();

  it('the walk reaches the app (guards against an empty pass)', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('components/SectionCard.tsx');
  });

  it('no NEW file hand-rolls a fold chevron', () => {
    const offenders = files.filter(drawsFoldChevron).filter((f) => !(f in CHEVRON_ALLOWED));
    expect(offenders).toEqual([]);
  });

  it('the allowlist has no stale entries', () => {
    // An entry for a file that no longer draws one is a licence nobody is using — and the next
    // hand-rolled chevron in that file would inherit it silently. Deleting the entry is how a
    // conversion actually finishes.
    const stale = Object.keys(CHEVRON_ALLOWED)
      .filter((f) => !fs.existsSync(path.join(ROOT, f)) || !drawsFoldChevron(f));
    expect(stale).toEqual([]);
  });

  it('every allowlist entry states a reason', () => {
    for (const [file, reason] of Object.entries(CHEVRON_ALLOWED)) {
      expect({ file, ok: /^(KEEP|BACKLOG) — .{20,}/.test(reason) }).toEqual({ file, ok: true });
    }
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. ⤢ is the RIGHT-MOST control in a card header
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * Extract every `right={ ... }` prop expression, brace-matched.
 *
 * A regex cannot do this: the slot's value is JSX containing its own braces, and the naive
 * `right=\{([^}]*)\}` stops at the first `}` — which in practice is inside the first child's
 * props. The first draft of this file used index arithmetic over `indexOf` instead and reported
 * a slot starting at the prop DECLARATION rather than at the JSX, which is the kind of quietly
 * wrong scan that reports green on real violations.
 */
function rightSlots(src: string): string[] {
  const out: string[] = [];
  for (const match of src.matchAll(/right=\{/g)) {
    let depth = 1;
    let i = match.index! + match[0].length;
    for (; i < src.length && depth > 0; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
    }
    out.push(src.slice(match.index! + match[0].length, i - 1));
  }
  return out;
}

describe('the full-screen button is last in the header', () => {
  /**
   * The rule (2026-08-20): a caller's own controls → the fold chevron → ⤢, with ⤢ outermost on
   * every surface. It is stated in five files. `SectionCard` is where it has to be TRUE, because
   * that is the component every conforming card inherits it from.
   */
  it('SectionCard puts the caller\'s slot after the fold chevron', () => {
    // ⚠️ **This pins what SectionCard does, which is not yet what the rule says**, and the gap is
    // deliberate — see CONSISTENCY_AUDIT.md §8. SectionCard renders
    // `<><CardCollapseToggle/>{right}</>`, i.e. the chevron FIRST, so a caller passing two
    // controls (the Katalog card's camera + lock) gets `chevron → camera → lock → ⤢` where the
    // rule asks for `camera → lock → chevron → ⤢`. Correcting it moves the chevron on every
    // SectionCard at once, so it belongs with the header-convergence pass, not in passing.
    //
    // What IS true and must not regress: `{right}` comes last within the slot, which is what
    // keeps a caller-supplied CardExpandButton right-most. That is the half the maintainer's
    // report is actually about.
    const slots = rightSlots(code('components/SectionCard.tsx'))
      .filter((slot) => slot.includes('CardCollapseToggle'));
    expect(slots).toHaveLength(1);
    expect(slots[0].indexOf('{right}')).toBeGreaterThan(slots[0].indexOf('CardCollapseToggle'));
  });

  it('SectionRail lays its right slot out as a ROW, not a column', () => {
    // A bare View is a COLUMN in RN, so a slot given two controls stacked them silently — the
    // Katalog card came out as a three-storey column with the title beside the top one. Fixed
    // 2026-08-20; pinned here because the failure is invisible to tsc and looks deliberate in a
    // screenshot of any card that happens to pass only one control.
    const src = code('components/SectionRail.tsx');
    expect(src.slice(src.indexOf('right: {'), src.indexOf('right: {') + 200))
      .toContain("flexDirection: 'row'");
  });

  it('nothing follows a CardExpandButton inside a header slot', () => {
    // Scoped to `right={...}` expressions — the header cluster — rather than to the whole file.
    // Outside a slot, "what follows the ⤢" is just the card's body, and an earlier draft that
    // scanned freely flagged exactly that: `<FoodTab>` (the card's CONTENT) and CardExpandHost's
    // own pane chrome. A scan that has to be taught which siblings are innocent is a scan that
    // will be widened until it means nothing.
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const src = code(file);
      if (!src.includes('CardExpandButton')) continue;
      for (const slot of rightSlots(src)) {
        const at = slot.indexOf('<CardExpandButton');
        if (at === -1) continue;
        const after = slot.slice(at + 1);
        const next = after.match(/<([A-Z][A-Za-z]*)\b/);
        if (next) offenders.push(`${file}: <${next[1]}> follows <CardExpandButton> in a header slot`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the slot extractor brace-matches (guards the scan above)', () => {
    // A `right={<><A/><B/></>}` slot contains braces of its own once any child takes a prop.
    expect(rightSlots('right={<><A x={1} /><B /></>}')).toEqual(['<><A x={1} /><B /></>']);
    expect(rightSlots('right={right}')).toEqual(['right']);
    expect(rightSlots('nothing here')).toEqual([]);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 3. A card title comes from a token
 * ────────────────────────────────────────────────────────────────────────────── */

describe('a card title is a token, never a literal', () => {
  it('no file hardcodes the 20/25 card-title pair', () => {
    // Five card files carried `fontSize: 20, lineHeight: 25` verbatim — the exact values
    // `Type.heading` already holds. A literal here is invisible to the type scale AND to the
    // design lab's font pass, and it is how the app ended up spelling "20" three different ways.
    const offenders = sourceFiles().filter((f) => /fontSize:\s*20\s*,\s*lineHeight:\s*25/.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('Type.heading still holds the values those literals had', () => {
    // If this ever drifts, the substitution above silently became a visual change. The pair is
    // 20 × 1.25 = 25.
    const theme = read('constants/theme.ts');
    const heading = theme.slice(theme.indexOf('heading:'), theme.indexOf('subheading:'));
    expect(heading).toMatch(/size:\s*20/);
    expect(heading).toMatch(/line:\s*1\.25/);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * 4. A look-alike icon means the same thing everywhere
 * ────────────────────────────────────────────────────────────────────────────── */

describe('the lock means the same thing on every card', () => {
  /**
   * Three locks ship on the Shopping tab. Until 2026-08-21 one lit when the list was UNlocked
   * and two lit when it was locked — the same glyph, lit, meaning opposite things on one screen.
   * That is `active` as a STATE highlight disagreeing with itself, and no test could see it
   * because each site was internally consistent.
   */
  const LOCK_SITES = [
    'components/CatalogueTab.tsx',
    'components/WeekListCard.tsx',
    'app/(tabs)/shopping.tsx',
  ];

  it('every lock highlights the LOCKED state', () => {
    const offenders: string[] = [];
    for (const file of LOCK_SITES) {
      const src = code(file);
      const at = src.indexOf("lock-closed");
      expect({ file, hasLock: at !== -1 }).toEqual({ file, hasLock: true });
      // The `active` prop within the same IconButton element.
      const element = src.slice(at, at + 500);
      const active = element.match(/active=\{([^}]*)\}/);
      if (!active) { offenders.push(`${file}: lock has no active prop`); continue; }
      if (/^\s*!/.test(active[1])) offenders.push(`${file}: active={${active[1]}} — negated`);
    }
    expect(offenders).toEqual([]);
  });

  it('no lock is drawn at a shrunken size', () => {
    // `size={22}` on the lock and camera is what the maintainer reported as "some buttons are
    // too small": the TOUCH target is floored at MIN_TAP_TARGET by IconButton regardless, so no
    // existing test could see it — what the eye sees is a 22px disc 8px from a 36px one in the
    // same header. Leaving `size` off is what keeps the pair tracking the default.
    const offenders: string[] = [];
    for (const file of LOCK_SITES) {
      const src = code(file);
      const at = src.indexOf('lock-closed');
      const element = src.slice(at, at + 500);
      const size = element.match(/size=\{(\d+)\}/);
      if (size) offenders.push(`${file}: lock draws at size={${size[1]}}`);
    }
    expect(offenders).toEqual([]);
  });
});
