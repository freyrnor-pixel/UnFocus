/**
 * pagerOffscreen.test.ts — `offscreenPageLimit` reaches the native pager, or it does nothing.
 *
 * **Why this file exists, and why it reads a DEPENDENCY rather than app code.**
 * `<TopTabs offscreenPageLimit={n}>` typechecks today with no patch applied. The type arrives
 * from `PagerViewProps` → `PagerProps` → `TabViewProps` → `MaterialTopTabNavigationConfig`, none
 * of which omit it — but react-native-tab-view's `TabView` destructures a FIXED list of props and
 * hands that fixed list to its `Pager`, and `offscreenPageLimit` is not on it. So the prop is
 * accepted by the compiler, spread through two navigators, and then silently dropped one hop
 * before the native view.
 *
 * That is precisely this repo's recurring defect — a config that is green everywhere and reaches
 * nothing (`CLAUDE.md` A2's "a predicate that has gone constant": `Surface.tsx`'s `glassOn` went
 * false for every surface in the app while `tsc`, 2490 jest tests, and three source-text
 * assertions all passed). The difference here is WHERE the truth lives: the question is not "does
 * this expression still evaluate true", it is "is `patches/react-native-tab-view+4.3.1.patch`
 * still applied to the file Metro loads". That is a file-state question, and reading the file is
 * the correct instrument for it, not a proxy for one.
 *
 * `patch-package` already fails loudly at `postinstall` when a patch does not apply. What it
 * cannot catch is an upgrade where the patch applies to a `TabView` that has been restructured so
 * the forwarding no longer lands — which is what the first two tests below are for.
 *
 * Both `src/TabView.tsx` and `lib/module/TabView.js` are checked because the package ships an
 * `exports` map with a `source` condition alongside `default`, and which one a given Metro
 * config resolves is not worth betting a silent no-op on. The patch covers both; so does this.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { SITE_ITEMS } from '../siteNav';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const TAB_VIEW_FILES = [
  'node_modules/react-native-tab-view/lib/module/TabView.js',
  'node_modules/react-native-tab-view/src/TabView.tsx',
];

describe('react-native-tab-view forwards offscreenPageLimit (patched)', () => {
  it.each(TAB_VIEW_FILES)('%s destructures it off its own props', (rel) => {
    // Without this line the prop never leaves TabView's argument object.
    expect(read(rel)).toMatch(/^\s*offscreenPageLimit,\s*$/m);
  });

  it.each(TAB_VIEW_FILES)('%s hands it to the Pager', (rel) => {
    // The .tsx source spells it as JSX, the compiled module as an object property.
    expect(read(rel)).toMatch(
      /offscreenPageLimit(=\{offscreenPageLimit\}|: offscreenPageLimit,)/
    );
  });

  it('is the last hop — PagerViewAdapter spreads the rest onto the native pager', () => {
    // TabView is the only place the chain narrows. Once past it, the Android adapter spreads
    // everything it did not name onto AnimatedViewPager, so no further patching is needed —
    // and if that spread ever goes away, this prop (and `overScrollMode`) die with it.
    const src = read('node_modules/react-native-tab-view/lib/module/PagerViewAdapter.js');
    expect(src).toMatch(/\.\.\.rest/);
    expect(src).toMatch(/AnimatedViewPager,\s*\{\s*\.\.\.rest/);
  });
});

describe('the pager keeps every tab resident', () => {
  const layout = read('app/(tabs)/_layout.tsx');
  /** Source with comments stripped — this file explains the prop at length above the prop. */
  const codeOnly = layout.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('passes the limit to the navigator', () => {
    expect(codeOnly).toMatch(/offscreenPageLimit=\{PAGER_OFFSCREEN_LIMIT\}/);
  });

  it('derives the limit from SITE_ITEMS rather than hard-coding a count', () => {
    // A literal `4` would silently leave one page paying the attach cost on the day a sixth tab
    // lands. ViewPager2 counts pages on EACH SIDE, so length - 1 is what keeps all of them
    // resident from either end.
    expect(codeOnly).toMatch(/const PAGER_OFFSCREEN_LIMIT = SITE_ITEMS\.length - 1;/);
  });

  it('covers every registered tab screen from either end', () => {
    // The real relationship, checked rather than assumed: the navigator registers exactly as
    // many screens as SITE_ITEMS has entries (the file header already requires the ORDER to
    // match), so length - 1 reaches the far end from either side.
    const screens = codeOnly.match(/<TopTabs\.Screen\s+name="/g) ?? [];
    expect(screens).toHaveLength(SITE_ITEMS.length);
    expect(SITE_ITEMS.length - 1).toBeGreaterThanOrEqual(screens.length - 1);
  });
});

describe('the off-screen scenes reveal staggered, not all in one commit', () => {
  const SCENE_FILES = [
    'node_modules/react-native-tab-view/lib/module/SceneView.js',
    'node_modules/react-native-tab-view/src/SceneView.tsx',
  ];

  it.each(SCENE_FILES)('%s staggers by distance from the focused page', (rel) => {
    // Upstream is `setTimeout(..., 0)` for EVERY non-focused scene, so with `lazy: false` they
    // all fire in one timer batch and React commits every off-screen screen tree in a single
    // render. Measured in the web preview: one 65ms long task ~150ms after the tabs appear on an
    // EMPTY profile, gone from the long-task list once staggered.
    expect(read(rel)).toMatch(
      /setTimeout\(\(\) => setIsLoading\(false\), Math\.abs\(navigationState\.index - index\) \* \d+\)/
    );
  });

  it.each(SCENE_FILES)('%s no longer schedules every scene at zero', (rel) => {
    // The form that would regress it, asserted absent rather than the fix asserted present —
    // an upgrade that restores upstream's line would otherwise pass the test above by
    // leaving BOTH lines in place.
    expect(read(rel)).not.toMatch(/setTimeout\(\(\) => setIsLoading\(false\), 0\)/);
  });

  it('keeps the delay small enough not to be lazy mounting in disguise', () => {
    // `lazy: true` is separately documented as a regression ("things load after Swiping",
    // 2026-08-28) because a page there does not render until visited. This must stay a
    // launch-time stagger, not that: every page on screen within a splash's worth of time.
    const step = Number(
      read(SCENE_FILES[0]).match(/navigationState\.index - index\) \* (\d+)\)/)?.[1]
    );
    expect(step).toBeGreaterThan(0);
    // Five tabs, so the farthest page is distance 2 → step * 2 must stay well under the splash.
    expect(step * 2).toBeLessThan(200);
  });
});

describe('the rubber band at the ends stays off', () => {
  // Shipped 2026-09-16 (#718) against the Android 12+ stretch EdgeEffect. It rides the same
  // prop chain as offscreenPageLimit but needed no patch, because TabView's fixed list happens
  // to include it — so a tab-view upgrade could take one out without the other.
  it('sets overScrollMode on the navigator', () => {
    expect(read('app/(tabs)/_layout.tsx')).toMatch(/overScrollMode="never"/);
  });

  it.each(TAB_VIEW_FILES)('%s still forwards overScrollMode', (rel) => {
    expect(read(rel)).toMatch(/overScrollMode(=\{overScrollMode\}|: overScrollMode,)/);
  });
});
