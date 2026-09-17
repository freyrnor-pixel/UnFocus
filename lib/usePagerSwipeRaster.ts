import { useEffect, useState } from 'react';
import { useNavigation } from 'expo-router';

/**
 * True only while a finger is actually dragging the tab pager, and only on a pager page.
 *
 * **What this is for, and the device evidence under it.** The maintainer reported swiping between
 * tabs as laggy for six rounds. Five mechanisms were tried and none moved it; two were then
 * excluded by measurement rather than argument — the page attach at drag start (#719, verified
 * present in the shipped Android bundle and still no change) and mount/render cost (#721: the
 * five screens are built ONCE for ~151ms behind the splash, the JS thread is completely idle at
 * rest, and a BottomNav tab tap costs no measurable JS on any tab). What finally identified it was
 * a switch the app already had: with **Accessibility → Reduce visual effects ON, swiping is
 * smooth.** That flag gates three things, and the two that are PER CARD — `Surface.tsx`'s
 * two-pass `boxShadow` (which that file calls "this component's one remaining per-frame GPU cost")
 * and its lit pane — are the two that scale with the page, which is what the reported ranking did:
 * Shop and Home slow (10 and 9 shadow-casting elements), Habits and Health fine (3 and 5).
 *
 * So the cost is per-frame GPU paint of card surfaces while two pages are on screen at once.
 * `renderToHardwareTextureAndroid` is the standard answer to exactly that: Android rasterises the
 * subtree into a texture once and the slide becomes a blit, with the blurs and gradients baked in.
 * It is already how this repo keeps `ScreenBackground`, `HomeHeroBackground` and
 * `ParticleBackground` cheap.
 *
 * **Why it is scoped to the drag rather than left on.** A hardware layer re-rasterises whenever
 * its content changes, so a permanent one would turn every tick of a checkbox on Home into a
 * full-page re-raster — trading a cost that only occurs while swiping for one that occurs on every
 * interaction. Between `swipeStart` and `swipeEnd` nothing in the page changes, which is precisely
 * when a texture is free.
 *
 * ⚠️ **The listener must be a SCREEN's navigation object, not the navigator's.** The tab bar's
 * `navigation` (the one `app/(tabs)/_layout.tsx` lifts for `PagerFloatingNav`) spreads its
 * `addListener` from the PARENT navigator — see `useNavigationHelpers`, which takes `emit` from
 * this emitter but `addListener` from `parentNavigationHelpers`. Subscribing there registers on the
 * Stack and never hears the tab pager's untargeted `emit`. A screen's `navigation` is created with
 * `emitter.create(route.key)` (`useNavigationCache`), and an untargeted emit concatenates every
 * target's callbacks (`useEventEmitter`), so it arrives. That is why this hook lives in the
 * scaffold each tab screen renders, rather than once in the layout.
 *
 * `enabled` is `pagerFloatingNav`, which exactly the five tab screens pass and nothing else does —
 * so a pushed screen never subscribes to an event its navigator does not emit.
 *
 * ⚠️ **No `Platform.OS === 'android'` guard, deliberately, and it is load-bearing for the test.**
 * `renderToHardwareTextureAndroid` is already a no-op off Android — the same reason
 * `HomeHeroBackground` carries it unguarded. Adding a platform check here would buy nothing and
 * would make the flag dead on the ONE harness that can see it move, which is how this repo has
 * shipped silently-constant booleans before (`CLAUDE.md` A2). The flag computes everywhere; only
 * Android acts on it.
 *
 * Verified end to end rather than by reading the source. `lib/__tests__/pagerSwipeRaster.test.ts`
 * evaluates this hook's TRUTH TABLE over both `enabled` values and both events, and the web
 * preview drove a real drag against a temporary marker attribute: 0 pages rastering at rest, 5
 * while the finger was down, 0 again after release (`PanResponderAdapter` fires the same
 * `onSwipeStart`/`onSwipeEnd` on web). The PERFORMANCE claim is native-only and stays
 * `unverified` until the device says otherwise.
 *
 * Connections:
 *   Imports → expo-router (useNavigation)
 *   Used by → components/ScreenScaffold.tsx (the 5 pager tab screens, via `pagerFloatingNav`)
 *   Data    → none
 */
export default function usePagerSwipeRaster(enabled: boolean): boolean {
  const navigation = useNavigation();
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // `swipeStart`/`swipeEnd` belong to MaterialTopTabNavigationEventMap; the navigation object
    // expo-router hands back here is typed generically, so the event names need a cast. The
    // `enabled` guard above is what keeps this honest — only a real pager page subscribes.
    const nav = navigation as unknown as {
      addListener: (type: string, cb: () => void) => () => void;
    };
    const stop = nav.addListener('swipeEnd', () => setSwiping(false));
    const start = nav.addListener('swipeStart', () => setSwiping(true));
    return () => {
      start();
      stop();
    };
  }, [enabled, navigation]);

  return swiping;
}
