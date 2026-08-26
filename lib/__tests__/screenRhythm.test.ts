/**
 * screenRhythm.test.ts — the screen owns the vertical gap between cards; cards don't.
 *
 * Guards the 2026-08-08 spacing pass (see `SCREEN_GAP` in constants/theme.ts). The bug this
 * exists to stop coming back is not a wrong number — it is spacing being a property of the
 * CHILD, so that adding a card to a screen silently gives it whichever gap that card's author
 * happened to declare, or none. Measured before the pass, one column on the To-do tab ran
 * 8 → 40 → 0 → 0 px, and Home ran at 8 while the list screens ran at 32.
 *
 * A source scan rather than a render test on purpose: the thing being asserted is a
 * convention about where a number is allowed to live, which is a property of the source.
 */
import fs from 'fs';
import path from 'path';
import { SCREEN_GAP, Spacing } from '@/constants/theme';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * Screens whose scroll content is a plain stack of cards.
 *
 * **Three of these are extracted-component files, not the route file, since the 2026-08-20
 * "full-screen card expansion" pass** (components/TodoSurface.tsx, components/HealthSurface.tsx,
 * components/NotesSurface.tsx): each is mounted by a thin route wrapper (app/(tabs)/plans.tsx,
 * app/(tabs)/health.tsx, app/notes.tsx) AND by components/CardExpandHost.tsx's expanded-card overlay,
 * and the card-stack gap is needed in BOTH contexts — so it lives on the shared component's own
 * `content` style, not the thin wrapper's (which only carries the screen-edge padding; see
 * SCAFFOLD_CONTENT below).
 */
const SCREENS = [
  'app/(tabs)/index.tsx',
  'components/TodoSurface.tsx',
  // components/HabitsSurface.tsx since 2026-08-20 — app/(tabs)/habits.tsx became a thin wrapper when
  // the Habits card on the Me tab needed a real full-screen body, exactly as To-do/Health/Notes
  // did before it. The card-stack gap is needed in the card too, so it lives on the surface.
  'components/HabitsSurface.tsx',
  'components/HealthSurface.tsx',
  'app/(tabs)/shopping.tsx',
  'components/NotesSurface.tsx',
  // app/goals.tsx was here until 2026-08-12, when the Goals screen was retired — its list,
  // add row and delete confirm were a second copy of components/GoalsEditor.tsx, which is
  // mounted in the Goals drawer on Habits and To-do. Both of those screens are already above.
];

/**
 * Cards that stack inside one of those screens (or, for the Home four, inside
 * HomeCardManager's list). Each of these carried its own vertical margin before the pass —
 * which is exactly why they are the list worth watching.
 */
const STACKED_CARDS: { file: string; style: string }[] = [
  // components/SectionCard.tsx drew this style until 2026-08-21; it is a shim over
  // components/Card.tsx's `CardShell` now and has no stylesheet of its own. The card geometry
  // moved with it, so the assertion follows the pixels rather than the filename.
  { file: 'components/Card.tsx', style: 'card' },
  { file: 'components/OpenEpisodeCard.tsx', style: 'card' },
  // components/MedicineTrayCard.tsx became the shell-less components/MedicineSurface.tsx on
  // 2026-08-21 and no longer draws a card at all; the card is HomeMedicineCard, below.
  // components/Home{Medicine,Notes,Habits,Health}Card.tsx drew their own `card` style until
  // 2026-08-21; all four go through components/Card.tsx now, whose `card` style is asserted at
  // the top of this list. A file with no card of its own has no margin to get wrong.
  { file: 'components/EnergyBalanceCard.tsx', style: 'card' },
  // components/HintCard.tsx was here until 2026-08-20, when the ⓘ banner was deleted app-wide.
  // Not backfilled: this list is the set of cards that actually sit in a screen-level stack,
  // not a count to keep.
  { file: 'components/HomeSharedCard.tsx', style: 'card' },
  { file: 'components/PlanTaskCard.tsx', style: 'card' },
];

/**
 * Returns the body of a named `StyleSheet.create` entry — everything between `<name>: {` and
 * its matching close brace. Brace-counted rather than regexed to the first `}`, so a nested
 * object inside the entry can't truncate it.
 */
function styleBody(source: string, name: string): string {
  const start = source.indexOf(`\n  ${name}: {`);
  if (start === -1) return '';
  let depth = 0;
  const from = source.indexOf('{', start);
  for (let i = from; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(from, i + 1);
    }
  }
  return '';
}

describe('SCREEN_GAP', () => {
  it('is a value from the Spacing scale, not a loose number', () => {
    expect(Object.values(Spacing)).toContain(SCREEN_GAP);
  });

  it('is the ONE gap — every card-stacking screen declares it on its content container', () => {
    for (const rel of SCREENS) {
      const source = read(rel);
      const content = styleBody(source, 'content');
      expect(content).not.toBe('');
      // `gap: SCREEN_GAP`, never a re-derived `Spacing.md` — the token is what makes the
      // rhythm changeable in one place instead of seven.
      expect(`${rel}: ${content.includes('gap: SCREEN_GAP')}`).toBe(`${rel}: true`);
    }
  });
});

/**
 * Every screen whose scroll content is a `content` style — the wrapper that sits directly
 * inside ScreenScaffold. The three tab screens are first; the rest are pushed sub-screens.
 *
 * `app/catalogue.tsx` is deliberately absent: it passes `scrollable={false}` and its content is
 * `components/CatalogueTab.tsx`'s own `root`, which is asserted separately below.
 */
const SCAFFOLD_CONTENT: { file: string; bottomIsChrome: boolean }[] = [
  { file: 'app/(tabs)/index.tsx', bottomIsChrome: true },
  { file: 'app/(tabs)/shopping.tsx', bottomIsChrome: true },
  // app/(tabs)/plans.tsx crossed INTO the tab set on 2026-08-20 (the same-day "full-screen card
  // expansion" pass, health → plans) — it reserves the bottom nav now, same as its two
  // neighbours above.
  { file: 'app/(tabs)/plans.tsx', bottomIsChrome: true },
  // ⚠️ Habits and Health crossed BACK into the tab set on 2026-08-22, when the bottom nav went
  // to five again. Both reserve the nav bar now, so neither may carry the `paddingBottom` it had
  // as a pushed screen (Health) or as a pane (Habits) — which is the whole thing this list
  // checks, and the exact assertion that would have gone silently missing had they simply been
  // dropped from it when their paths changed.
  { file: 'app/(tabs)/habits.tsx', bottomIsChrome: true },
  { file: 'app/(tabs)/health.tsx', bottomIsChrome: true },
  ...[
    'app/scan.tsx', 'app/shared.tsx', 'app/settings.tsx', 'app/pair-device.tsx',
    'app/share-modal.tsx', 'app/automations.tsx',
  ].map((file) => ({ file, bottomIsChrome: false })),
];

/**
 * The centre pop-ups (2026-08-20) — twelve routes that stopped being pushed pages and became
 * components/CenterModalScreen.tsx panes, on the maintainer's *"Never go to another page,
 * pop-up from the middle of the screen instead."*
 *
 * **The rule inverts for them, which is why they are a separate list rather than deletions.**
 * A scaffolded screen MUST pad horizontally (its content sits against the screen edge) and must
 * pad the bottom only when its lower edge lands on the safe area rather than on chrome. A pane's
 * body is already padded by CenterModalScreen itself, so any padding here is a SECOND inset
 * stacked inside the first — the "three stacked horizontal paddings" shape the wrap audit keeps
 * finding. What a converted screen may still own is the gap between its own blocks.
 *
 * One of them (app/notes.tsx) has no `content` style left at all: its whole body is one
 * extracted surface that owns its own spacing, so the wrapper View went too. app/habits.tsx was
 * the other until 2026-08-22, when it became a tab again and moved into SCAFFOLD_CONTENT above.
 */
const CENTRE_MODAL_SCREENS = [
  'app/habit-form.tsx', 'app/medicine-form.tsx', 'app/health-form.tsx', 'app/health-detail.tsx',
  'app/health-log.tsx', 'app/day-log.tsx', 'app/food.tsx', 'app/budget.tsx',
  'app/inventory-edit.tsx',
] as const;

describe('content meets the chrome flush — no screen re-adds the blank strip', () => {
  // 2026-08-19, the other half of the seam pass. `ScreenScaffold` stopped contributing any gap
  // (see chromeRhythm's `contentPad` assertions), and every screen was still padding its own
  // content by `Spacing.md` on all four sides — so the strip the clip exists to delete was
  // simply being drawn one level down, by 21 files instead of one. Maintainer, on being told
  // the scaffold's half was done and this half wasn't: *"Fix"*.
  //   **The rule is about what the edge MEETS, not about which tier the screen is.** A vertical
  // edge that lands on the header's or the nav bar's glass is flush; an edge that lands on the
  // safe area is not chrome at all and keeps its margin, which is why a pushed screen still pads
  // its bottom and a tab screen does not. Horizontal padding is untouched on both: the side
  // gutters are backdrop by design, and it is what insets every card from the screen edge.
  it.each(SCAFFOLD_CONTENT)('$file', ({ file, bottomIsChrome }) => {
    const body = styleBody(read(file), 'content');
    expect(body).not.toBe('');
    // A `padding:` shorthand is the shape this replaced, and the easy one to reintroduce by
    // copying an older screen — it sets the top gap without ever naming it.
    expect(body).not.toMatch(/padding\s*:/);
    expect(body).not.toMatch(/padding(Top|Vertical)\s*:/);
    expect(body).toMatch(/paddingHorizontal:\s*Spacing\.md/);
    expect(`${file}: ${/paddingBottom\s*:/.test(body)}`).toBe(`${file}: ${!bottomIsChrome}`);
  });

describe('a centre pop-up adds no padding of its own — the pane already padded it', () => {
  it.each(CENTRE_MODAL_SCREENS)('%s', (file) => {
    const src = read(file);
    // It really is a pane, not a scaffold. Without this the padding assertions below would pass
    // vacuously on a screen that had quietly gone back to being pushed.
    expect(src).toMatch(/<CenterModalScreen/);
    expect(src).not.toMatch(/<ScreenScaffold/);
    const body = styleBody(src, 'content');
    if (body === '') return; // no content wrapper at all — see the list's doc
    expect(body).not.toMatch(/padding\s*:/);
    expect(body).not.toMatch(/paddingHorizontal\s*:/);
    expect(body).not.toMatch(/paddingBottom\s*:/);
  });

  it('the two that kept no content style at all still mount the pane', () => {
    for (const file of ['app/notes.tsx']) {
      const src = read(file);
      expect({ file, pane: /<CenterModalScreen/.test(src) }).toEqual({ file, pane: true });
      expect({ file, content: styleBody(src, 'content') }).toEqual({ file, content: '' });
    }
  });
});

  it('components/CatalogueTab.tsx — the one screen whose content is a component', () => {
    // Its `root` carried a paddingTop whose stated purpose was to match the `content` wrapper
    // above, so it has to follow that wrapper rather than be forgotten beside it. Non-embedded
    // branch only (the Shopping drawer returns before this style), and that screen reserves no
    // nav, so the bottom margin stays.
    //
    // ⚠️ **`paddingHorizontal` is now BANNED here, where this test used to REQUIRE it**
    // (consistency audit, 2026-08-21). The requirement was written on 2026-08-19, when
    // /catalogue was a pushed `ScreenScaffold` screen that padded nothing for itself. It became
    // a `CenterModalScreen` pane the next day, and a pane pads its own body — so from that
    // moment this assertion was actively holding a 32px side inset in place, i.e. the test and
    // the centre-modal rule 20 lines below contradicted each other and the test won. The other
    // non-embedded host (`CardExpandHost`'s `bodyFlex`) insets by the same amount, so there is
    // no caller left that wants this padding. Keep the two directions spelled out separately:
    // if a future host stops padding, this is the line that has to move with it.
    const body = styleBody(read('components/CatalogueTab.tsx'), 'root');
    expect(body).not.toMatch(/padding(Top|Vertical)?\s*:/);
    expect(body).not.toMatch(/paddingHorizontal\s*:/);
    expect(body).toMatch(/paddingBottom: Spacing\.md/);
  });
});

describe('a card in a screen-level stack carries no vertical margin', () => {
  it.each(STACKED_CARDS)('$file — $style', ({ file, style }) => {
    const body = styleBody(read(file), style);
    expect(body).not.toBe('');
    // marginTop / marginBottom / marginVertical / a `margin:` shorthand all set the gap this
    // card has to its neighbour, which is the screen's job now.
    expect(body).not.toMatch(/margin(Top|Bottom|Vertical)?\s*:/);
  });
});

// ── The decorative divider is gone ────────────────────────────────────────────

describe('nothing draws a branch between two sections', () => {
  // 2026-08-19, maintainer: *"remove … the wavy lines that have been used as dividers."*
  // `components/SectionDivider.tsx` — a full-width `trunk-divider` motif, i.e. a forking branch
  // drawn across the screen between major sections — is DELETED, along with both of its call
  // sites on the Shopping tab (above the Weekly rail, and between each UKE section). It is not
  // replaced by a hairline: the gap between two cards is `SCREEN_GAP`, owned by the screen's own
  // scroll container, which is the whole point of the 2026-08-08 spacing pass above. A rule
  // drawn on top of that gap is a second answer to a question already settled.
  //
  // Deleted rather than unmounted, so nothing can be quietly rewired back — the same discipline
  // the branch-and-leaf backdrop art and `components/CardHintNote.tsx` were removed under.
  it('has no SectionDivider component', () => {
    expect(fs.existsSync(path.join(ROOT, 'components', 'SectionDivider.tsx'))).toBe(false);
  });

  it('has no SectionDivider call sites, and nothing hand-rolls a replacement', () => {
    const offenders: string[] = [];
    for (const dir of ['app', 'components']) {
      const walk = (abs: string): string[] =>
        fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
          const next = path.join(abs, entry.name);
          if (entry.isDirectory()) return walk(next);
          return /\.tsx?$/.test(entry.name) ? [next] : [];
        });
      for (const file of walk(path.join(ROOT, dir))) {
        const src = fs.readFileSync(file, 'utf8');
        const rel = file.slice(ROOT.length + 1);
        if (/<SectionDivider\b/.test(src)) offenders.push(`${rel}: <SectionDivider>`);
        // The motif itself still exists in constants/motifs.ts (it is generated art), so the
        // way this comes back is a caller drawing it directly rather than the component.
        if (/id="trunk-divider"|'trunk-divider'/.test(src)) offenders.push(`${rel}: trunk-divider`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ──────────────────────────────────────────────────────────────────────────────
 * Coverage completeness — added 2026-08-21 by the consistency audit.
 * ────────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ **The single highest-value assertion in this file, and it is about the file itself.**
 *
 * Every check above runs over a HAND-MAINTAINED list: six screens for the gap, ten for the
 * padding, nine panes, nine cards. So a screen that is in none of them is not "passing" — it is
 * unmeasured, and it passes by not being looked at. At the time this block was written, FOUR
 * screens were in no list at all: `app/catalogue.tsx` (which was doubly padded at 32px — exactly
 * the defect this file exists to prevent, while this file was green), `app/scan.web.tsx`, and
 * both design-lab screens, which are additionally invisible to `styleBody` because they name
 * their wrapper `page` rather than `content`.
 *
 * That is the general shape of why the maintainer's 2026-08-21 report could list sixteen defects
 * against an app with 115 test files and ~40 source scans: **the guards pin what was fixed last
 * time, not the rule.** A new file arrives outside every list and is compliant by default.
 *
 * This closes it the only way that scales — walk the tree, and fail on a screen nobody has
 * classified. An entry in `UNMEASURED` is a deliberate exemption with a written reason, so the
 * cost of not covering a screen is a sentence someone has to be willing to write.
 */
const UNMEASURED: Record<string, string> = {
  'app/catalogue.tsx':
    'Its body is components/CatalogueTab.tsx, whose `root` is asserted separately above — this '
    + 'screen has no content wrapper of its own to measure.',
  'app/notes.tsx':
    'A pane whose whole body is components/NotesSurface.tsx (which IS in SCREENS). That it really '
    + 'mounts the pane, and keeps no content style, is asserted in the centre-modal block above.',
  'app/scan.web.tsx':
    'The web sibling of a native-only OCR screen: it renders an "OCR not available" placeholder '
    + 'and no card stack at all, so there is no rhythm here to measure. app/scan.tsx is covered.',
  'app/design-lab/index.tsx':
    'The design lab is a workbench, not a product surface — it deliberately does not follow the '
    + 'card rhythm, which is why its wrapper is named `page`. Behind featureDesignLab, off by default.',
  'app/design-lab/tokens.tsx':
    'The token knobs screen, pushed from the lab. Not a product surface — see index.tsx above.',
};

describe('every screen is measured by one of the lists above', () => {
  /** Walk `app/` for real route files — the same crawler the SectionDivider block uses. */
  function routeFiles(): string[] {
    const walk = (abs: string): string[] =>
      fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
        const next = path.join(abs, entry.name);
        if (entry.isDirectory()) return walk(next);
        return /\.tsx$/.test(entry.name) ? [next] : [];
      });
    return walk(path.join(ROOT, 'app'))
      .map((f) => f.slice(ROOT.length + 1))
      .filter((f) => !f.endsWith('_layout.tsx'))
      .sort();
  }

  it('the walk reaches app/ (guards against an empty pass)', () => {
    // A scan that silently matches nothing reports green forever. This file had no such check,
    // which is part of why four uncovered screens went unnoticed for a day short of a week.
    const files = routeFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain('app/(tabs)/shopping.tsx');
  });

  it('no screen mounts a scaffold or a pane without being classified', () => {
    const classified = new Set<string>([
      ...SCREENS,
      ...SCAFFOLD_CONTENT.map((s) => s.file),
      ...CENTRE_MODAL_SCREENS,
      ...Object.keys(UNMEASURED),
    ]);
    const offenders = routeFiles()
      .filter((f) => /<ScreenScaffold|<CenterModalScreen/.test(read(f)))
      .filter((f) => !classified.has(f));
    expect(offenders).toEqual([]);
  });

  it('every exemption states a reason, and none is stale', () => {
    for (const [file, reason] of Object.entries(UNMEASURED)) {
      expect({ file, exists: fs.existsSync(path.join(ROOT, file)) }).toEqual({ file, exists: true });
      expect({ file, ok: reason.length > 40 }).toEqual({ file, ok: true });
    }
  });
});

/**
 * The FIRST CHILD of a screen's content stack carries no top margin.
 *
 * The `content` assertions above look only INSIDE the `content` style body, so a margin declared
 * three lines lower in the same StyleSheet is invisible to them. `app/(tabs)/index.tsx`'s
 * `energyStrip: { marginTop: Spacing.xs }` lived in exactly that blind spot and made Home the one
 * scaffold screen whose first card did not meet the header's glass flush — and, because the strip
 * is gated on `energySystemEnabled`, the same screen measured 4px or 0px depending on a setting.
 *
 * ⚠️ **Scoped to the first child, not to the stylesheet.** A first draft banned `marginTop`
 * anywhere in a screen's StyleSheet and immediately flagged seven of the ten screens — every one
 * of them a margin between two blocks *inside* a card, which is nobody's business but that card's
 * and has nothing to do with the header seam. A rule that broad gets exemptions written for it
 * until it means nothing; this one asks the single question the defect was.
 */
function firstChildStyle(src: string): string | null {
  // The JSX right after the content wrapper opens, then the first `styles.X` it references.
  const at = src.indexOf('style={styles.content}');
  if (at === -1) return null;
  const after = src.slice(at + 'style={styles.content}'.length);
  return after.match(/styles\.(\w+)/)?.[1] ?? null;
}

describe('no screen re-adds a top gap below the header', () => {
  it.each(SCAFFOLD_CONTENT)("$file — its first child declares no marginTop", ({ file }) => {
    const src = read(file);
    const first = firstChildStyle(src);
    if (first === null) return; // screens whose content wrapper takes an inline style
    expect({ file, style: first, body: styleBody(src, first) })
      .toEqual({ file, style: first, body: expect.not.stringMatching(/marginTop/) });
  });

  it('the first-child extractor finds the style it is meant to', () => {
    // Pinned because a null return makes the assertion above pass vacuously — the exact way a
    // scan stops guarding without going red.
    expect(firstChildStyle('<View style={styles.content}>\n<View style={styles.energyStrip}>'))
      .toBe('energyStrip');
    expect(firstChildStyle('<View style={styles.page}>')).toBeNull();
  });
});

/**
 * Boxed rows are back (2026-08-26, reversing 2026-08-15's flush-rows pass — see
 * `components/PadSheet.tsx`'s header for the full lineage). This describe block is the guard
 * AGENTS.md's "Folding a card away" / row-rule history calls for explicitly: `app/(tabs)/
 * habits.tsx` (now `components/HabitsSurface.tsx`) hand-rolls its OWN row box because it never
 * adopted PadSheet, and it has drifted from PadSheet's row shape in BOTH directions before —
 * shipped boxed while PadSheet was flush, and (the risk this guards) could just as easily ship
 * flush again while PadSheet goes back to boxed. A source scan, not a render test, because the
 * property is "these two files still agree", not any one rendered pixel.
 */
describe('boxed rows — PadSheet and the Habits surface agree on the same recipe', () => {
  const PAD_SHEET = 'components/PadSheet.tsx';
  const HABITS_SURFACE = 'components/HabitsSurface.tsx';

  // The four literals `components/PadSheet.tsx` ships as its `ROW_BOX_*` constants. Read
  // straight from that file rather than hand-copied here, so a future recalibration of the
  // recipe can't silently desync this test from the value it's meant to pin.
  function padSheetRowBoxLiterals(): string[] {
    const src = read(PAD_SHEET);
    const literals: string[] = [];
    for (const name of ['ROW_BOX_FILL_DARK', 'ROW_BOX_EDGE_DARK', 'ROW_BOX_FILL_LIGHT', 'ROW_BOX_EDGE_LIGHT']) {
      const m = src.match(new RegExp(`${name}\\s*=\\s*'([^']+)'`));
      expect({ name, found: !!m }).toEqual({ name, found: true });
      if (m) literals.push(m[1]);
    }
    return literals;
  }

  it('PadSheet ships all four ROW_BOX_* literals', () => {
    expect(padSheetRowBoxLiterals().length).toBe(4);
  });

  it("HabitsSurface's hand-rolled rowBox carries the SAME four literals as PadSheet", () => {
    const habitsSrc = read(HABITS_SURFACE);
    for (const literal of padSheetRowBoxLiterals()) {
      expect({ literal, presentInHabitsSurface: habitsSrc.includes(literal) })
        .toEqual({ literal, presentInHabitsSurface: true });
    }
  });

  it("the design lab's rowShape knob fallback is 'boxed', not 'flush'", () => {
    const src = read('lib/designLab.ts');
    const m = src.match(/id: 'rowShape'[\s\S]*?fallback: '(\w+)'/);
    expect(m?.[1]).toBe('boxed');
  });
});
