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

/** Screens whose scroll content is a plain stack of cards. */
const SCREENS = [
  'app/(tabs)/index.tsx',
  'app/plans.tsx',
  'app/habits.tsx',
  'app/(tabs)/health.tsx',
  'app/(tabs)/shopping.tsx',
  'app/notes.tsx',
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
  { file: 'components/HintCard.tsx', style: 'wrap' },
  { file: 'components/HomeNotesCard.tsx', style: 'card' },
  { file: 'components/HomeHabitsCard.tsx', style: 'card' },
  { file: 'components/HomeShoppingCard.tsx', style: 'card' },
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
  { file: 'app/(tabs)/health.tsx', bottomIsChrome: true },
  { file: 'app/(tabs)/shopping.tsx', bottomIsChrome: true },
  ...[
    // app/plans.tsx and app/habits.tsx moved OUT of the pager on 2026-08-20 (5 tabs → 3), so
    // they crossed this list rather than left it: they reserve no nav now, and their bottom
    // edge lands on the safe area. Both gained the `paddingBottom` a tab screen must not have.
    'app/plans.tsx', 'app/habits.tsx',
    'app/notes.tsx', 'app/scan.tsx', 'app/food.tsx', 'app/shared.tsx', 'app/medicine-form.tsx',
    'app/health-form.tsx', 'app/inventory-edit.tsx', 'app/settings.tsx', 'app/day-log.tsx',
    'app/health-log.tsx', 'app/health-detail.tsx', 'app/habit-form.tsx', 'app/pair-device.tsx',
    'app/budget.tsx', 'app/share-modal.tsx', 'app/automations.tsx',
  ].map((file) => ({ file, bottomIsChrome: false })),
];

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
