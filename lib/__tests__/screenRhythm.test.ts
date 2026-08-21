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
 * app/health.tsx, app/notes.tsx) AND by components/CardExpandHost.tsx's expanded-card overlay,
 * and the card-stack gap is needed in BOTH contexts — so it lives on the shared component's own
 * `content` style, not the thin wrapper's (which only carries the screen-edge padding; see
 * SCAFFOLD_CONTENT below).
 */
const SCREENS = [
  'app/(tabs)/index.tsx',
  'components/TodoSurface.tsx',
  // components/HabitsSurface.tsx since 2026-08-20 — app/habits.tsx became a thin wrapper when
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
  { file: 'components/SectionCard.tsx', style: 'card' },
  { file: 'components/OpenEpisodeCard.tsx', style: 'card' },
  { file: 'components/MedicineTrayCard.tsx', style: 'card' },
  { file: 'components/EnergyBalanceCard.tsx', style: 'card' },
  // components/HintCard.tsx was here until 2026-08-20, when the ⓘ banner was deleted app-wide.
  // Not backfilled: this list is the set of cards that actually sit in a screen-level stack,
  // not a count to keep.
  { file: 'components/HomeNotesCard.tsx', style: 'card' },
  { file: 'components/HomeHabitsCard.tsx', style: 'card' },
  { file: 'components/HomeSharedCard.tsx', style: 'card' },
  { file: 'components/PlanTaskCard.tsx', style: 'card' },
  { file: 'components/CollapsedSection.tsx', style: 'section' },
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
  ...[
    // app/health.tsx left the bottom nav for a Home card in the "full-screen card expansion"
    // pass and gained the `paddingBottom` a tab screen must not have.
    'app/health.tsx',
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
 * Two of the twelve (app/notes.tsx, app/habits.tsx) have no `content` style left at all: their
 * whole body is one extracted surface that owns its own spacing, so the wrapper View went too.
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
    for (const file of ['app/notes.tsx', 'app/habits.tsx']) {
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
    const body = styleBody(read('components/CatalogueTab.tsx'), 'root');
    expect(body).not.toMatch(/padding(Top|Vertical)?\s*:/);
    expect(body).toMatch(/paddingHorizontal: Spacing\.md/);
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
