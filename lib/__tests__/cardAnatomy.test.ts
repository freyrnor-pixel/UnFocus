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

  // ── KEEP: idiom 2 — the header IS the button, so the chevron inside it is passive ──────
  //
  // These were BACKLOG until 2026-08-21, i.e. listed as conversions still owed. They are not.
  // Each is a `PressableScale` around the whole naming row with an `AnimatedChevron` in it,
  // which is the right shape for a header carrying nothing else to tap: it gives a target the
  // width of the card instead of a 48px box. Converting them would have made every one of them
  // WORSE, and would have nested a pressable inside a pressable.
  //
  // What actually diverged was the GLYPH — 13/14/16/18px in three colours — and that is fixed
  // at the source: `AnimatedChevron`'s `size` and `color` default to CardCollapseToggle's own
  // values, and the block below fails on an override. See CardCollapseToggle's header for the
  // two idioms and when each applies.
  'components/FoodTab.tsx':
    'KEEP — idiom 2 on the meal-section headers. (Its LEADING raw chevron on dish rows is a '
    + 'navigation affordance on a row, not a card fold.)',
  'components/ExpandableCard.tsx':
    'KEEP — idiom 2; the whole header row is the button, badge and rightAction included.',
  'components/TodoSurface.tsx':
    'KEEP — idiom 2 on "The rest" and the done zone. Its hue-coloured chevron is gone; both '
    + 'take the default muted glyph now.',
  'components/HomeNotesCard.tsx': 'KEEP — idiom 2 on the checked-off zone header.',
  'components/PlanTaskCard.tsx': 'KEEP — idiom 2 on the done and deleted zone headers.',
  'app/(tabs)/shopping.tsx':
    'KEEP — idiom 2 on the purchased-this-month trip headers inside a monthly card.',
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
 * 1b. …and it is drawn at one size, in one colour
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * The two `AnimatedChevron` call sites allowed to override `size` or `color`.
 *
 * Both are a different CONTROL rather than a differently-sized fold, which is the only reason
 * an exception can be justified here at all — the moment one is granted for "this one looks
 * better a bit smaller", the guard is back to counting four sizes.
 */
const CHEVRON_STYLE_ALLOWED: Record<string, string> = {
  'components/PadFooterToggle.tsx':
    'KEEP — the pad cards` three-state SIZE cycle (closed/preview/open), not a fold. It is '
    + 'accent-coloured because it is a live action with a count beside it ("3 more"), and it '
    + 'sits at the card`s bottom-right rather than in the header.',
  'components/TaskCard.tsx':
    'KEEP — the "Advanced" disclosure inside the task editor, accent-coloured like the other '
    + 'live controls in that form. Its own card-fold chevron above takes the default.',
};

describe('the fold chevron is one size, in one colour', () => {
  // The defect CONSISTENCY_AUDIT.md §2 measured was not which component drew the chevron — two
  // idioms are legitimate — it was that `size` and `color` were REQUIRED props, so thirteen
  // call sites each answered the question alone and the app shipped 13/14/16/18px in three
  // colours. Defaulting them is the fix; this is what stops the overrides coming back.
  // ⚠️ A source scan, not an import of the constant: `components/AnimatedChevron.tsx` pulls in
  // Reanimated, which cannot be evaluated in this environment — the same reason every check in
  // this file reads source rather than rendering. Tried importing it; it throws in the worklets
  // initializer before a single assertion runs.
  it('the default is one exported constant, not a copy', () => {
    const src = code('components/AnimatedChevron.tsx');
    expect(src).toMatch(/export const CHEVRON_SIZE = 18;/);
    expect(src).toMatch(/size = CHEVRON_SIZE/);
    expect(src).toMatch(/color \?\? theme\.textMuted/);
  });

  it('no call site overrides size or color', () => {
    const offenders = sourceFiles()
      .filter((f) => !(f in CHEVRON_STYLE_ALLOWED))
      .filter((f) => {
        const calls = code(f).match(/<AnimatedChevron\b[^>]*>/g) ?? [];
        return calls.some((c) => /\bsize=/.test(c) || /\bcolor=/.test(c));
      });
    expect(offenders).toEqual([]);
  });

  it('the style allowlist has no stale entries', () => {
    const stale = Object.keys(CHEVRON_STYLE_ALLOWED).filter((f) => {
      const calls = code(f).match(/<AnimatedChevron\b[^>]*>/g) ?? [];
      return !calls.some((c) => /\bsize=/.test(c) || /\bcolor=/.test(c));
    });
    expect(stale).toEqual([]);
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

  /**
   * The three heading tiers, and the files that draw each.
   *
   * ⚠️ **This is the half of §2 that a token substitution alone did not fix.** The previous
   * pass moved five hardcoded `20/25` pairs onto `Type.heading` — right, and not enough,
   * because the sizes that remained were spelled with tokens and still disagreed: an in-card
   * section heading shipped at `FontSize.md` (17) in two files, `FontSize.lg` (20) in two more
   * and `FontSize.sm` uppercase (13) on Shop's week sections, while To-do's Week and Today
   * cards drew their titles at 20 next to three sibling cards drawing 24.
   *
   * So the guard is about the LADDER, not about literals:
   *
   *   group heading  (over a stack of CARDS) → SectionRail's `label`, FontSize.xl 24 extrabold
   *   card title     (a card's own name)     → Type.heading, 20
   *   section heading(over ROWS in a card)   → Type.subheading, 17
   *
   * A fourth size for one of these jobs is the defect, whether or not it is written as a
   * literal — so this asserts the files that draw a section heading are ON the token, by name.
   */
  const SECTION_HEADING_FILES = [
    'components/SectionRail.tsx',   // the `sub` tier — Shop's week sections
    'components/FoodTab.tsx',       // the meal sections
    'components/HabitsSurface.tsx',
    'components/HealthSurface.tsx', // "This week"
    'components/ExpandableCard.tsx',
  ];

  it.each(SECTION_HEADING_FILES)('%s draws its section heading from Type.subheading', (file) => {
    expect(code(file)).toMatch(/fontSize:\s*Type\.subheading\.size/);
  });

  it('Type.subheading is 17 — the rung below a card title, above a caption', () => {
    const theme = read('constants/theme.ts');
    const sub = theme.slice(theme.indexOf('subheading:'), theme.indexOf('body:'));
    expect(sub).toMatch(/size:\s*17/);
  });

  it('no card header draws its title at a bare FontSize', () => {
    // The specific regression this closes: To-do's Week and Today headers were bare
    // `<Text style={{ fontFamily: Type.title.fontFamily, fontSize: FontSize.lg }}>` rows beside
    // three SectionCards. Both are SectionRails now, so nothing in that file spells a title.
    expect(code('components/TodoSurface.tsx')).not.toMatch(/cardHeaderTitle/);
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

/* ──────────────────────────────────────────────────────────────────────────────
 * 5. A folded card is its header and nothing else
 *
 * Maintainer, 2026-08-21: *"some have a line and some don't"* — and after the pass that
 * claimed to close §2, the To-do tab still shipped it: `components/CollapsedSection.tsx` had
 * settled the question on 2026-08-12 (`divider={open}`, plus a closed bottom inset matching its
 * top one), and `SectionCard` — the component §2 names as canonical — never followed. A folded
 * card drew a hue hairline over nothing plus 25px of dead space (the rail's own `marginBottom`
 * and the card's open-state `paddingBottom`), directly above a closed drawer that had neither.
 *
 * ⚠️ **This is the class of defect §1–§4 cannot see, and that is the point of adding it.** Those
 * scans ask which COMPONENT draws a header; every offender here passed them, because the
 * component was right and the argument handed to it was missing. A scan over call-site PROPS is
 * the narrow part of "does it look right" that a source scan can actually hold.
 * ────────────────────────────────────────────────────────────────────────────── */
describe('a collapsed card draws no rule and reserves no room', () => {
  it('SectionCard ties its rail hairline and its bottom inset to the fold', () => {
    const src = code('components/SectionCard.tsx');
    expect(src).toMatch(/divider=\{!collapsed\}/);
    // The closed card's bottom inset matches its top one, so it is the header and nothing else.
    expect(src).toMatch(/cardCollapsed:\s*\{\s*paddingBottom:\s*Spacing\.sm\s*\}/);
    expect(src).toMatch(/collapsed\s*&&\s*styles\.cardCollapsed/);
  });

  /**
   * Every `<SectionRail>` whose own `right` slot holds a fold control is a foldable header, so
   * its rule has to follow that fold. Scoped to the rail ELEMENT (up to its `/>`), so a fold
   * control elsewhere in the file cannot make an unrelated rail look guilty.
   */
  it('every foldable rail passes an explicit `divider`', () => {
    const offenders: string[] = [];
    for (const abs of sourceFiles()) {
      for (const element of code(abs).match(/<SectionRail\b[\s\S]*?\/>/g) ?? []) {
        const foldable = /<CardCollapseToggle\b|<AnimatedChevron\b/.test(element);
        if (foldable && !/\bdivider=/.test(element)) {
          offenders.push(`${abs}: foldable rail with no divider prop`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * §2's *"some have icon while others not"*. A group-tier rail heads a stack of cards and
   * carries a badge; the `sub` tier deliberately draws a 6px dot instead (a badge there would be
   * a second badge inside a card that already has one). So a rail is one or the other — what it
   * may not be is a group heading with a bare dot standing beside one with a badge, which is
   * what To-do's Week card and both Shop groups shipped.
   */
  it('every group-tier rail carries a badge', () => {
    const offenders: string[] = [];
    for (const abs of sourceFiles()) {
      for (const element of code(abs).match(/<SectionRail\b[\s\S]*?\/>/g) ?? []) {
        if (/tier="sub"/.test(element)) continue;
        if (!/\bdomain=/.test(element)) offenders.push(`${abs}: group rail with no domain badge`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
