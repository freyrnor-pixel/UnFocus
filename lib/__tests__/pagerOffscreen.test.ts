/**
 * pagerOffscreen.test.ts — the two pager knobs that are one silent no-op away from doing nothing.
 *
 * **Why these are guarded and not just written.** Both live on the far side of a dependency:
 * `overScrollMode` is forwarded by `react-native-tab-view`'s `TabView` only because it happens to
 * be on that component's fixed pass-through list, and the `SceneView` reveal stagger exists only
 * as a `patch-package` patch. Either can stop reaching the native view after an upgrade **while
 * every line of app code still reads correctly** — this repo's documented dead-config class
 * (`CLAUDE.md` A2: `Surface.tsx`'s `glassOn` went false for every surface in the app while three
 * source-text assertions passed).
 *
 * `patch-package` fails loudly when a patch cannot apply. What it cannot catch is an upgrade that
 * applies the patch to a restructured file, or one that drops `overScrollMode` from TabView's
 * list. That is what the assertions below are for, and why they read the dependency rather than
 * the app: the question is genuinely "is the patched code still in the file Metro loads", which is
 * a file-state question, not a proxy for one.
 *
 * Both `src/` and `lib/module/` are checked because the package ships an `exports` map with a
 * `source` condition alongside `default`, and which one a given Metro config resolves is not worth
 * betting a silent no-op on.
 *
 * ⚠️ **`offscreenPageLimit` was here until 2026-09-17 and is deliberately gone.** It was shipped
 * in #719, measured as no-change on the device (the prop was confirmed present in the shipped
 * Android bundle's Hermes string table, so it arrived and did nothing), and reverted along with
 * the rest of this session's unconfirmed work. Do not re-add it without a measurement: it cost a
 * dependency patch and five permanently attached page trees for no observed benefit.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const TAB_VIEW_FILES = [
  'node_modules/react-native-tab-view/lib/module/TabView.js',
  'node_modules/react-native-tab-view/src/TabView.tsx',
];

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
