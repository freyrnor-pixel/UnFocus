/**
 * (tabs)/_layout.tsx — swipeable pager for the 3 main sites (Decision 032 successor).
 *
 * **5 tabs became 3 on 2026-08-20.** To-do and Habits stopped being tabs — their daily rows
 * merged onto Home, which is the "I dag" tab now, and both screens live on as pushed
 * sub-screens (app/plans.tsx, app/habits.tsx) holding the deep surfaces a daily list has no
 * room for. Nothing about the pager mechanics below changed; there are simply three pages.
 *
 * Co-mounts Handle/Gjøremål/Meg in one react-native-pager-view-backed
 * material-top-tabs navigator (tabBarPosition="bottom") so swiping between sites is
 * one continuous native slide with no route remount — replacing the old separate-routes
 * + SiteSwipeView double-motion (native push/back + a second hand-rolled flick), which
 * read as a "click" instead of a phone-page swipe. BottomNav renders as PagerFloatingNav's
 * absolute overlay (2026-07-26 — see the "Floated bottom-nav" edit note below for why it's no
 * longer react-navigation's own tab-bar slot), applying the bottom safe-area inset itself the
 * way ScreenScaffold's old bottomBlock did.
 *
 * Also renders ONE shared L1/L2 background (ScreenBackground + a cross-faded
 * HomeHeroBackground + ParticleBackground) behind the whole pager, instead of each of the
 * 3 screens mounting its own via ScreenScaffold. react-native-pager-view slides each
 * screen's whole subtree horizontally, so a per-screen background used to slide right
 * along with the content — reading as "each screen has its own picture" instead of a fixed
 * backdrop. Hoisting it here decouples it from the swipe: it sits behind TopTabs. Both L1
 * layers stay mounted; the Home hero is overlaid in an Animated.View whose opacity
 * cross-fades in on Home / out elsewhere (Home is an END tab since 2026-08-19, so this fires
 * on the last swipe of a run rather than on most of them). This replaced an earlier `isHomeActive ? <HomeHeroBackground/> : <ScreenBackground/>`
 * MOUNT SWAP, which created/destroyed react-native-svg + gradient views (and restarted the
 * hero's Animated loops) on the exact frame a swipe settled — a per-swipe hitch that read
 * as laggy swiping. The 3 tab screens pass ownBackground={false} to ScreenScaffold so they
 * don't ALSO paint their own copy.
 *
 * Connections:
 *   Imports → expo-router/js-top-tabs (TopTabs — Expo Router's own SDK-56 top-tabs
 *             wrapper, not @react-navigation/material-top-tabs directly; see Edit notes),
 *             react-native-safe-area-context, components/BottomNav, components/ScreenBackground,
 *             components/HomeHeroBackground, components/ParticleBackground, lib/siteNav
 *   Note    → the navigator's `initialRouteName` is the user's chosen starting tab
 *             (settings.startScreen → lib/firstRunOptions.ts's START_SCREEN_ROUTES),
 *             frozen at mount. That is NOT the same thing as `unstable_settings.
 *             initialRouteName` below it, which is the static deep-link back target.
 *   Used by → Expo Router route group "(tabs)" — app/_layout.tsx's single
 *             <Stack.Screen name="(tabs)" /> entry
 *   Data    → none (pure navigation composition)
 *
 * Edit notes:
 *   - Screen order MUST match lib/siteNav.ts's SITE_ITEMS (shopping, plans, index) — BottomNav maps each pager route's name to a SITE_ITEMS entry via
 *     lib/siteNav.ts's TAB_ROUTE_NAME, so a mismatch here shows the wrong icon/label active.
 *     (2026-08-20: health swapped out for plans — see the file header's "full-screen card
 *     expansion" note. Before that, 2026-07-23 UX audit E1/E2 swapped Scan out for habits.)
 *   - `(tabs)` is a route group: URLs stay "/", "/shopping", "/plans" ("/health" and "/habits"
 *     are still valid routes — they are pushed screens outside this group now)
 *     (was "/scan" before the 2026-07-23 E1/E2 swap — see the Screen-order note above).
 *   - As of SDK 56, expo-router's Metro resolver throws a build error if app code imports
 *     `@react-navigation/*` directly (https://docs.expo.dev/router/migrate/sdk-55-to-56/).
 *     This file must import `TopTabs` from `expo-router/js-top-tabs`, not
 *     `createMaterialTopTabNavigator` from `@react-navigation/material-top-tabs` — the
 *     latter breaks both `eas update` and `eas build` at the bundling step. `TopTabs`
 *     wraps the identical react-native-tab-view/-pager-view stack internally.
 *   - **`lazy: false` (2026-07-16, cold-start perf)**: all three sites mount up front when
 *     the pager mounts, so navigating Home → any tab reveals an ALREADY-RENDERED tree
 *     instead of mounting it fresh on first visit — that first-visit mount was the visible
 *     "things load in" hitch users reported. Pairs with app/_layout.tsx's cold-start
 *     hydration (Tier A stores + the settings render gate), so the pre-mounted screens mount
 *     with their data already in memory. Watch memory on low-end Android (3 screens mounted
 *     from launch) — the former Scan tab's camera-power-on caveat here no longer applies
 *     since Scan moved out to a pushed sub-screen (app/scan.tsx, 2026-07-23).
 *   - **`lazy: false` vs the REVERTED `lazyPreloadDistance` (2026-07-13)**: the earlier
 *     revert was `lazyPreloadDistance: 1` — a HALF-lazy state (lazy:true + preload) that hit
 *     react-native-pager-view's documented touch-delivery bug for preloaded-but-inactive
 *     screens ("+"/add controls going dead, e.g. Habits' inline AddRow). `lazy: false` is a
 *     different mode: the classic fully-eager tab-view render where every screen is a
 *     first-class mounted page from frame 0, not a preloaded-inactive one — the likely-safer
 *     configuration. Still: pager-view touch delivery can only be verified on-device (the
 *     headless web preview doesn't exercise native touch), so BEFORE this merges, verify
 *     inline add/tap controls (Habits AddRow, Shopping/Plans "+") work on a real build. If
 *     they regress, this single line goes back to `lazy: true`.
 *   - **Native swipe-feel patch (2026-07-19, needs a build — NOT OTA)**: the finger-swipe
 *     between tabs is native react-native-pager-view (ViewPager2 on Android). Its physics
 *     (fling/settle) are AOSP defaults and expose NO JS prop — the only reachable lever is
 *     the gesture-capture threshold, which upstream sets to 2x touch-slop (~16dp), giving a
 *     "sticky, slow to start" feel vs a native Samsung/OneUI pager (~1x slop). `patches/
 *     react-native-pager-view+8.0.1.patch` (applied via patch-package postinstall) drops that
 *     to 1x slop in NestedScrollableHost.kt. It's native, so it only takes effect in a fresh
 *     build (maintainer-cut), not via OTA. If tab swipes ever start stealing vertical-scroll
 *     drags on a list, that patch's factor is the knob to dial back.
 *   - `swipeEnabled: true` is the whole point of this migration. (Scan used to flip it off
 *     mid-OCR via `navigation.setOptions` while it was one of these 5 co-mounted tabs;
 *     now that it's a pushed sub-screen at app/scan.tsx, 2026-07-23, that guard doesn't
 *     apply here anymore — a pushed screen already blocks the pager underneath it.)
 *   - **`animationEnabled: false` (all platforms; 2026-07-24, was `Platform.OS !== 'web'`)**:
 *     this flag governs ONLY programmatic tab navigation (a BottomNav tap →
 *     `navigation.navigate` → `PagerViewAdapter.jumpTo`), never finger-swipe — swipe is
 *     `swipeEnabled`/`scrollEnabled` and stays fully animated, so the tactile slide (the
 *     point of this migration) is untouched. Set false to kill TWO issues: (1) native
 *     far-jump frame-skip — `animationEnabled:true` makes `jumpTo` call
 *     `ViewPager2.setCurrentItem(i, true)`, a smooth-scroll that sweeps through every
 *     intermediate page; in the old centre-Home 5-tab bar most taps were far jumps (Shopping↔Health
 *     is 4 pages), so the sweep skipped frames. `false` routes through
 *     `setPageWithoutAnimation(i)` = instant snap, no sweep. ViewPager2 has no JS-reachable
 *     "snap-adjacent-then-animate-last-step" mode, so this is a mitigation of a native
 *     limitation, not a smooth far-jump. Tap still gives feedback: BottomNav's Reanimated
 *     pill slides to the tapped tab and the shared background updates — only page content
 *     snaps. (2) the earlier web-only stuck-scroll (interrupted JS `scrollTo` leaving two
 *     screens side by side) that first drove this to false on web. See the inline comment on
 *     the `animationEnabled` line for the full write-up.
 *   - **Active-tab tracking for the shared background**: the pager's own navigator state
 *     (`state.routes[state.index].name`) is read inside the `tabBar` render prop, same
 *     place BottomNav reads it to highlight the active icon — there's no other hook that
 *     exposes the focused route at this layout level. TabBarWithBackgroundSync forwards
 *     it up via onActiveRouteChange so this component can cross-fade the HomeHeroBackground
 *     overlay's opacity (both L1 layers stay mounted — no remount). This only fires when the
 *     focused route actually changes (not continuously while dragging), so the fade starts at
 *     the swipe boundary rather than sliding with the drag. reducedMotion snaps instead.
 *   - **Background parallax (2026-07-23, mechanism reworked 2026-07-24 — see the next bullet)**:
 *     the shared L1/L2 background group is wrapped in an Animated.View that drifts horizontally
 *     with `bgIndexAnim` (0..n-1, our own node — see below) — a small ±MAX_PARALLAX px translate,
 *     same direction as the content but far less, reading as depth rather than "each screen has
 *     its own picture" (the layer is oversized by MAX_PARALLAX per side so the drift never bares
 *     an edge). Null under reducedMotion, so the backdrop stays fixed exactly as before. It's a
 *     subtle counter to the fixed backdrop, not a re-coupling — the drift is a fraction of the
 *     content's full-width slide.
 *   - **Parallax still snapped on a BottomNav tap after the first fix attempt (2026-07-24)**:
 *     the first attempt patched react-native-tab-view's `PagerViewAdapter` (patches/
 *     react-native-tab-view+4.3.1.patch, now removed) to ease its `position` Animated.Value
 *     with `Animated.timing` instead of an instant `.setValue(index)` on every tap. That patch
 *     alone didn't fix it on device: `animationEnabled: false` (below) makes a tap call
 *     `setPageWithoutAnimation` on the native ViewPager2, and ViewPager2 still fires a
 *     same-frame `onPageScrolled(target, 0, 0)` for that instant jump even with no visible
 *     scroll — react-native-tab-view wires that straight into `position` via `Animated.event`,
 *     which snaps the node to the target value regardless of whatever JS-side tween is also
 *     running on it. Patching the library's `.setValue()` call didn't stop that native
 *     side-effect from racing (and winning) via the same node.
 *   - **Actual fix: a separate, app-owned Animated.Value (`bgIndexAnim`) instead of reading
 *     the pager's `position` node directly.** A listener mirrors `position` into `bgIndexAnim`
 *     1:1 while a real swipe is moving it (many small per-frame deltas — direct passthrough
 *     already reads as smooth, since native scroll drives `position` frame by frame and was
 *     never the problem). A settle — `activeRouteName` changing, which fires for both a tap
 *     and a swipe landing — is caught separately: if `bgIndexAnim` is already within ~0.05 of
 *     the settled index (the swipe-landing case; the listener already tracked it there live),
 *     nothing more happens. If it's still at the old index (the tap case — the pager jumped
 *     with no intervening frames), an explicit `Animated.timing` eases it to the new index
 *     over `Duration.tabSwitch` (200ms, matching BottomNav's own pill-slide timing) while the
 *     listener is told to stop mirroring for that window — otherwise the next native
 *     `onPageScrolled` echo would immediately overwrite the tween with the same snap this was
 *     meant to fix. Pure JS/app-code change — ships via normal OTA, no native build needed, no
 *     patch-package patch to maintain.
 *   - **Floated bottom-nav — sides + bottom, flush top (2026-07-23, amended; top-gap attempt
 *     reverted 2026-07-25)**: the bar is inset with NAV_FLOAT_GAP on the LEFT/RIGHT and a
 *     matching small gap BELOW (on top of the safe-area inset), but flush at the TOP (no gap
 *     above, no added height). An earlier same-day detour added a real gap + extra height above
 *     the bar so its (separately) rounded top corners would have room to read as floating, same
 *     pattern as the header. On a real device this grew the wrapper's rendered height without
 *     the pager scene shrinking to match (unlike the web preview, which DID lay it out
 *     correctly — a real react-native-web vs. native fidelity gap, see AGENTS.md's web-preview
 *     caveat), so the taller bar visibly ate into the last card's content instead of floating
 *     cleanly (user report + screenshot: "HANDLELISTE" clipped under the bar). Reverted to the
 *     known-safe flush-top sizing; BottomNav's top corners stay rounded (`styles.bar`,
 *     Radius.lg) — rounding alone, with no added footprint, is the safe half of that change.
 *     The floated header in ScreenScaffold is unchanged (its own gap/inset math is unrelated to
 *     the pager's scene-sizing behavior that caused this).
 *   - **Overlay bar, not a tab-bar sibling (2026-07-26)**: the bar used to render INSIDE
 *     react-navigation's own tab-bar slot (via the `tabBar` render prop), which
 *     react-native-tab-view lays out as a plain flex sibling BELOW the pager scene
 *     (tabBarPosition="bottom" → flex column [pager(flex:1), tabBar(fixed height)] — verified
 *     in node_modules/react-native-tab-view/lib/module/TabView.js). That made the bar's floating
 *     rounded top corners always show the plain shared backdrop in their corner notches, NEVER a
 *     scrolled card — there was structurally nothing else behind the bar to show (user report:
 *     "make the blank area transparent... so if I scroll a card behind it I can see the card").
 *     Fixed by decoupling rendering from that slot: `TabBarWithBackgroundSync` (the `tabBar`
 *     render prop) now only reads `state`/`navigation`/`position` out of react-navigation and
 *     returns `null` — an empty flex sibling collapses to zero height, so the pager (the only
 *     remaining flex child) grows to fill the WHOLE container, edge to edge. `PagerFloatingNav`
 *     renders the real, same-sized-and-positioned bar as an absolutely-positioned overlay
 *     ON TOP of that pager instead, using `state`/`navigation` SHIMS (`{state.routes[state.
 *     index].name}` / `navigate()`) fed by `activeRouteName` (already tracked for the background
 *     cross-fade) and `navigationRef` (the real navigation object, lifted from
 *     TabBarWithBackgroundSync via a latest-ref effect) — so tapping the overlay bar still calls
 *     the SAME real `navigate()`, hitting the exact native jumpTo/instant-snap path documented
 *     below, not expo-router's URL routing (which would remount instead of sliding). Each of the
 *     3 tab screens now ALSO passes `pagerFloatingNav` to ScreenScaffold, reserving scroll-content
 *     clearance for the overlay bar (previously zero — the old flex-sibling layout provided the
 *     clearance structurally; see ScreenScaffold's own edit note) shaved by `NAV_PEEK` so the
 *     last scrolled card's edge can reach into the corner notch instead of stopping dead at the
 *     bar's edge — see NAV_PEEK's doc in components/BottomNav.tsx for why that shave is small and
 *     deliberate, not a repeat of the clipped-content regression two bullets above.
 *   - **Scene background must stay transparent**: @react-navigation/material-top-tabs's
 *     MaterialTopTabView wraps every route in `sceneStyle: { backgroundColor: colors.background }`
 *     by default (react-navigation theme background, opaque) — that painted over this
 *     shared L1/L2 backdrop, which is why the 3 tab screens showed a flat colour instead
 *     of the blobs/hero. `screenOptions.sceneStyle` below forces it back to `'transparent'`
 *     so the shared background shows through; each tab screen's own SafeAreaView stays
 *     transparent too (see ScreenScaffold's ownBackground=false path). If the backdrop
 *     ever goes flat again after a react-navigation/expo-router upgrade, check this
 *     sceneStyle override first.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { TopTabs, MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { BOTTOM_NAV_HEIGHT, NAV_FLOAT_GAP } from '@/components/BottomNav';
import ScreenBackground from '@/components/ScreenBackground';
import TourSpotlight from '@/components/TourSpotlight';
import HomeHeroBackground from '@/components/HomeHeroBackground';
import ParticleBackground from '@/components/ParticleBackground';
import { useAccessibility } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { START_SCREEN_ROUTES } from '@/lib/firstRunOptions';
import { SITE_ITEMS, TAB_ROUTE_NAME } from '@/lib/siteNav';
import { Duration } from '@/constants/motion';

// Max horizontal drift (px) of the shared background as you swipe across the tabs — a
// subtle parallax that adds depth without re-coupling the backdrop to the swipe the way a
// per-screen background did (see file header). The layer is oversized by this much on each
// side so the drift never reveals a bare edge.
const MAX_PARALLAX = 14;
// Route-name order matching the pager's registered screens (also SITE_ITEMS' visual left-to-
// right order, lib/siteNav.ts) — used to turn the settled tab name into a 0..n-1 index for the
// background-parallax animation below. Derived from SITE_ITEMS/TAB_ROUTE_NAME instead of a
// second hardcoded array so the two orderings can't drift apart.
const TAB_ROUTE_ORDER = SITE_ITEMS.map((item) => TAB_ROUTE_NAME[item.route]!);
// One parallax stop per tab, spread evenly from +MAX_PARALLAX (leftmost) to -MAX_PARALLAX
// (rightmost), so the backdrop drifts the same total distance however many tabs there are.
// Both derived from TAB_ROUTE_ORDER — the count lives in exactly one place (SITE_ITEMS).
const PARALLAX_INPUT = TAB_ROUTE_ORDER.map((_, i) => i);
const PARALLAX_OUTPUT = TAB_ROUTE_ORDER.map((_, i) =>
  TAB_ROUTE_ORDER.length === 1
    ? 0
    : MAX_PARALLAX - (2 * MAX_PARALLAX * i) / (TAB_ROUTE_ORDER.length - 1)
);

type TabBarSyncProps = MaterialTopTabBarProps & {
  onActiveRouteChange: (routeName: string) => void;
  onPosition: (position: Animated.AnimatedInterpolation<number>) => void;
  // Lifts the real react-navigation `navigation` object out to TabsLayout, which hands it to
  // PagerFloatingNav (below) — see this component's own return-null note for why the bar no
  // longer renders here.
  navigationRef: React.MutableRefObject<MaterialTopTabBarProps['navigation'] | null>;
};

// Invisible now (2026-07-26) — used only to read react-navigation's tab-bar props out of the
// TopTabs tree, not to render the bar itself. Returning null collapses this flex-sibling slot
// to zero height (react-native-tab-view's TabView renders [pager(flex:1), tabBar] in a column;
// see node_modules/react-native-tab-view/lib/module/TabView.js), so the pager becomes the ONLY
// flex child and grows to fill the whole container instead of stopping above a fixed-height
// sibling. That's what lets PagerFloatingNav's overlay bar have real scrollable content behind
// it — the previous flex-sibling layout made that structurally impossible (content could never
// render into the tab bar's own reserved rectangle, so the bar's rounded corners could only ever
// show the plain field, never a scrolled card — the bug this whole change fixes; see file header).
function TabBarWithBackgroundSync({ onActiveRouteChange, onPosition, navigationRef, ...tabBarProps }: TabBarSyncProps) {
  const activeRouteName = tabBarProps.state.routes[tabBarProps.state.index]?.name;
  React.useEffect(() => {
    if (activeRouteName) onActiveRouteChange(activeRouteName);
  }, [activeRouteName, onActiveRouteChange]);
  // Lift the pager's live scroll `position` (a react-navigation Animated node, 0..n across
  // tabs, updated continuously during a swipe) up to TabsLayout so it can drive the shared
  // background's parallax drift. It's a stable node — this fires once on mount.
  const position = tabBarProps.position;
  React.useEffect(() => {
    if (position) onPosition(position);
  }, [position, onPosition]);

  // Latest-ref pattern (no dependency array — always the newest `navigation`, same object
  // identity react-navigation gives the real tab bar, so PagerFloatingNav's tap-to-navigate
  // hits the exact same `navigate()` call, native jumpTo/instant-snap included, as before).
  React.useEffect(() => {
    navigationRef.current = tabBarProps.navigation;
  });

  return null;
}

// Renders the REAL bottom nav as an absolute overlay above the pager instead of inside
// react-navigation's own tab-bar slot (TabBarWithBackgroundSync above returns null there) — see
// the file header's "Floated bottom-nav" note for the corner-notch peekthrough this enables.
// BottomNav's controlled mode only reads `state.routes[state.index]?.name` and calls
// `navigation.navigate(routeName)` (see components/BottomNav.tsx), so a minimal shim of both is
// enough; `navigationRef` carries the real navigation object so the shim's `navigate` still hits
// the actual tab navigator (not expo-router's URL-based routing, which would remount instead of
// sliding — the whole point of this pager). Cast through `any` at the call site since the shim
// intentionally doesn't implement react-navigation's full state/navigation surface.
type PagerFloatingNavProps = {
  activeRouteName: string;
  insetsBottom: number;
  navigationRef: React.MutableRefObject<MaterialTopTabBarProps['navigation'] | null>;
};

function PagerFloatingNav({ activeRouteName, insetsBottom, navigationRef }: PagerFloatingNavProps) {
  const state = useMemo(
    () => ({ index: 0, routes: [{ key: activeRouteName, name: activeRouteName }] }),
    [activeRouteName]
  );
  const navigation = useRef({
    navigate: (routeName: string) => navigationRef.current?.navigate(routeName as never),
  }).current;

  // Same footprint as the old flex-sibling wrapper (BOTTOM_NAV_HEIGHT + insetsBottom +
  // NAV_FLOAT_GAP, flush top, side/bottom float gap) — this change moves WHERE the bar renders
  // (overlay vs. layout sibling), not its size or position, so the resting look is unchanged.
  // `pointerEvents="box-none"` so the transparent margin/notch area around the bar doesn't
  // swallow touches meant for content now scrolling underneath it.
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        height: BOTTOM_NAV_HEIGHT + insetsBottom + NAV_FLOAT_GAP,
        paddingBottom: insetsBottom + NAV_FLOAT_GAP,
        paddingHorizontal: NAV_FLOAT_GAP,
      }}
    >
      <BottomNav state={state as any} navigation={navigation as any} />
    </View>
  );
}

// Cold launch presents Home, not the first-declared tab (Shopping). It stopped being the
// CENTRE tab on 2026-08-19 (To-do took that slot) — this export is unchanged anyway, because
// what it is for is the static deep-link back target, not "the middle one".
// expo-router reads `initialRouteName` off this export for the (tabs) layout and hands it
// to the navigator, which passes it to react-native-tab-view as the initial index — the
// pager's `initialPage` mounts directly on Home with no settle/animation in from Shopping
// (PagerViewAdapter uses `initialPage={navigationState.index}`). Must be a registered
// TopTabs.Screen name — 'index' is app/(tabs)/index.tsx (Home); TAB_ROUTE_NAME['/'] === 'index'.
// Static back-behaviour target for deep links. NOT the same thing as the navigator's
// `initialRouteName` prop below, which is the user's chosen starting tab and is dynamic —
// this one has to be a constant, and Home is the right place for a back press to land.
export const unstable_settings = { initialRouteName: 'index' };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useAccessibility();
  // Which tab the app opens on (first-run step 4 / Settings → Personal → Layout). Read
  // once, at mount: app/_layout.tsx gates rendering on settings being loaded, so this is
  // the real value by the time we get here, and a later change should NOT yank the user to
  // another tab mid-session — it applies from the next launch. Falls back to Home for any
  // value the enum doesn't cover. Every tab stays reachable regardless; this only picks
  // which one is focused first.
  const [activeRouteName, setActiveRouteName] = useState<string>(
    () => START_SCREEN_ROUTES[useSettingsStore.getState().startScreen] ?? TAB_ROUTE_NAME['/']!,
  );
  // Frozen at mount so a settings change mid-session can't re-key the navigator.
  const startRouteName = useRef(activeRouteName).current;
  const isHomeActive = activeRouteName === TAB_ROUTE_NAME['/'];

  // The pager's live scroll position (0..n-1 across the tabs), lifted up from the tab bar
  // (see TabBarWithBackgroundSync). Null until the first tab-bar render sets it. We only ever
  // READ this to mirror live swipe motion (see bgIndexAnim below) — the background transform
  // itself is driven by our own node, not this one directly (see the file header's "Actual
  // fix" note for why).
  const [pagerPosition, setPagerPosition] = useState<Animated.AnimatedInterpolation<number> | null>(null);
  const onPosition = useCallback((p: Animated.AnimatedInterpolation<number>) => {
    setPagerPosition((prev) => prev ?? p);
  }, []);

  // The real react-navigation `navigation` object, lifted from TabBarWithBackgroundSync so
  // PagerFloatingNav's overlay bar (rendered outside react-navigation's own tab-bar slot) can
  // still call the actual `navigate()` — see both components' doc comments above.
  const navigationRef = useRef<MaterialTopTabBarProps['navigation'] | null>(null);

  // Our own background-parallax value (see file header's "Actual fix" note for the full
  // reasoning) — decoupled from react-native-tab-view's `position` node so a BottomNav tap's
  // native onPageScrolled echo can't race/overwrite an in-flight tween on it.
  const initialTabIndex = Math.max(0, TAB_ROUTE_ORDER.indexOf(activeRouteName));
  const bgIndexAnim = useRef(new Animated.Value(initialTabIndex)).current;
  const bgIndexRef = useRef(initialTabIndex);
  const suppressLiveMirrorRef = useRef(false);

  // Mirror the pager's live position into bgIndexAnim frame by frame — this is what makes a
  // real finger-swipe's parallax feel live; it's a direct passthrough, never eased, since a
  // swipe already arrives smoothly one small delta at a time.
  useEffect(() => {
    if (!pagerPosition) return;
    const id = pagerPosition.addListener(({ value }) => {
      bgIndexRef.current = value;
      if (!suppressLiveMirrorRef.current) {
        bgIndexAnim.setValue(value);
      }
    });
    return () => pagerPosition.removeListener(id);
  }, [pagerPosition, bgIndexAnim]);

  // On every settle (activeRouteName changing — fires for both a BottomNav tap and a swipe
  // landing), give a still-distant bgIndexAnim an explicit eased tween to the new index. A
  // swipe landing already left it within a hair of the target (tracked live above) — nothing
  // to do there. A tap jumped the pager with no intervening frames, so this is what actually
  // produces the smooth motion for a tap.
  useEffect(() => {
    const targetIndex = TAB_ROUTE_ORDER.indexOf(activeRouteName);
    if (targetIndex < 0) return;
    if (reducedMotion) {
      bgIndexAnim.setValue(targetIndex);
      bgIndexRef.current = targetIndex;
      return;
    }
    if (Math.abs(bgIndexRef.current - targetIndex) < 0.05) return;
    suppressLiveMirrorRef.current = true;
    Animated.timing(bgIndexAnim, {
      toValue: targetIndex,
      duration: Duration.tabSwitch,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) bgIndexRef.current = targetIndex;
      suppressLiveMirrorRef.current = false;
    });
  }, [activeRouteName, reducedMotion, bgIndexAnim]);

  const bgParallax = reducedMotion
    ? null
    : {
        transform: [
          {
            translateX: bgIndexAnim.interpolate({
              // Derived from the tab count, never a hardcoded list of stops — it was
              // `[0,1,2,3,4]`/`[+14,+7,0,-7,-14]` until the 2026-08-20 5→3 merge, and a
              // stale stop list silently clamps the drift to the wrong end of the backdrop.
              inputRange: PARALLAX_INPUT,
              outputRange: PARALLAX_OUTPUT,
              extrapolate: 'clamp',
            }),
          },
        ],
      };

  // Both backgrounds stay mounted; we cross-fade the hero layer's opacity instead of
  // swapping which one is mounted (see file header). ScreenBackground sits underneath at
  // full opacity; HomeHeroBackground overlays it and fades in on Home, out elsewhere — so
  // no SVG/gradient view is created or destroyed at the frame a swipe settles (the old
  // remount was a per-swipe hitch). reducedMotion snaps instead of animating (§7).
  const heroOpacity = useRef(new Animated.Value(isHomeActive ? 1 : 0)).current;
  useEffect(() => {
    const to = isHomeActive ? 1 : 0;
    if (reducedMotion) {
      heroOpacity.setValue(to);
      return;
    }
    const anim = Animated.timing(heroOpacity, {
      toValue: to,
      duration: Duration.card,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [isHomeActive, reducedMotion, heroOpacity]);

  return (
      <View style={{ flex: 1 }}>
        {/* Shared L1/L2 background, rendered once behind the whole pager (see file header).
            ScreenBackground is the shared blue field + corner branch accents (same on every
            tab); HomeHeroBackground is an extra focal glow that cross-fades in over it on Home.
            The whole group lives in a parallax layer that drifts ±MAX_PARALLAX horizontally
            with the pager scroll — oversized by MAX_PARALLAX on each side (styles.bgLayer) so
            the drift never exposes a bare edge. bgParallax is null under reducedMotion (or
            before the position node arrives), leaving the backdrop fixed as before. */}
        <Animated.View style={[styles.bgLayer, bgParallax]} pointerEvents="none">
          <ScreenBackground activeRoute={activeRouteName} />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: heroOpacity }]} pointerEvents="none">
            <HomeHeroBackground />
          </Animated.View>
          <ParticleBackground />
        </Animated.View>

        <TopTabs
        initialRouteName={startRouteName}
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          lazy: false,
          // `false` on ALL platforms — this flag only governs PROGRAMMATIC tab navigation
          // (a BottomNav tap → navigation.navigate → PagerViewAdapter.jumpTo). It does NOT
          // touch finger-swipe: swipeEnabled/scrollEnabled drives the native follow-finger
          // slide independently, so the tactile swipe (the whole point of this migration) is
          // untouched here. Two problems it fixes, one native, one web:
          //   • Native far-jump frame-skip (2026-07-24): with animationEnabled:true, jumpTo
          //     calls ViewPager2.setCurrentItem(index, true), a smooth-scroll that SWEEPS
          //     through every intermediate page. In the old centre-Home 5-tab layout most taps
          //     ARE far jumps (Shopping↔Health is 4 pages; Home↔Shopping/Health is 2), so the
          //     sweep visibly skipped frames. animationEnabled:false routes jumpTo through
          //     setPageWithoutAnimation(index) — an instant snap, no intermediate render, no
          //     skip. ViewPager2 exposes no "snap-adjacent-then-animate-last-step" mode from
          //     JS, so a partial-animation fix would need a native/library patch; instant snap
          //     is the cleanest reachable mitigation and it's honest to call it that, not a
          //     "full" smooth far-jump. Tap feedback is preserved elsewhere: BottomNav's own
          //     Reanimated sliding pill still animates to the tapped tab, and the shared
          //     background still updates — only the page content snaps instead of sweeping.
          //   • Web stuck-scroll (2026-07-18): web has no native pager; taps drove an animated
          //     JS scrollTo that could be interrupted mid-flight, leaving scrollLeft at a
          //     non-page boundary (two screens side by side). Instant snap closes that window.
          animationEnabled: false,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
        tabBar={(props: MaterialTopTabBarProps) => (
          <TabBarWithBackgroundSync {...props} onActiveRouteChange={setActiveRouteName} onPosition={onPosition} navigationRef={navigationRef} />
        )}
      >
        {/* Order MUST match SITE_ITEMS (lib/siteNav.ts) AND constants/motifs.ts's
            STRIP_PANEL_ORDER: shopping, plans ("Gjøremål"), index ("Meg").
            **`plans` and `index` swapped on 2026-08-19** — To-do is the centre tab now and
            `/` is the personal tab (habits/notes/health); see lib/siteNav.ts's nav-bar note.
            Health left the bottom nav on 2026-08-20 (the "full-screen card expansion" pass)
            and is a card on that personal tab (components/HomeHealthCard.tsx) —
            app/health.tsx stays for deep links/back-compat. habits is still a pushed
            sub-screen (app/habits.tsx), reached from its own card there. */}
        <TopTabs.Screen name="shopping" />
        <TopTabs.Screen name="plans" />
        <TopTabs.Screen name="index" />
        </TopTabs>

        <PagerFloatingNav activeRouteName={activeRouteName} insetsBottom={insets.bottom} navigationRef={navigationRef} />

        {/* The guided tour's overlay, mounted LAST so its scrim covers the pager AND the
            floating bottom nav. It renders null unless a tour is actually running, which on a
            fresh install is the window between finishing onboarding and dismissing the tour. */}
        <TourSpotlight />
      </View>
  );
}

const styles = StyleSheet.create({
  // Oversized by MAX_PARALLAX on the left/right so the background can drift horizontally
  // (parallax) without ever revealing a bare strip at the screen edge.
  bgLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -MAX_PARALLAX,
    right: -MAX_PARALLAX,
    // **The absolute bottom layer (2026-08-17).** This group's two siblings here are the pager
    // and `PagerFloatingNav` (zIndex 100), and once ANY sibling declares a z, Android sorts the
    // whole container instead of drawing it in document order — so "it is declared first" was
    // never the guarantee it looked like. Each of the three layers inside carries its own -1 as
    // well; this one is what keeps the GROUP under the nav overlay and the pager, and it has to
    // be here because a child's z only orders it among its own siblings.
    zIndex: -1,
  },
});
