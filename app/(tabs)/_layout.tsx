/**
 * (tabs)/_layout.tsx — swipeable pager for the 5 main sites (Decision 032 successor).
 *
 * Co-mounts Shopping/Plans/Home/Health/Habits in one react-native-pager-view-backed
 * material-top-tabs navigator (tabBarPosition="bottom") so swiping between sites is
 * one continuous native slide with no route remount — replacing the old separate-routes
 * + SiteSwipeView double-motion (native push/back + a second hand-rolled flick), which
 * read as a "click" instead of a phone-page swipe. BottomNav renders the tab bar itself
 * (component swap, not a route), wrapped here so it still applies the bottom safe-area
 * inset the way ScreenScaffold's old bottomBlock did.
 *
 * Also renders ONE shared L1/L2 background (ScreenBackground + a cross-faded
 * HomeHeroBackground + ParticleBackground) behind the whole pager, instead of each of the
 * 5 screens mounting its own via ScreenScaffold. react-native-pager-view slides each
 * screen's whole subtree horizontally, so a per-screen background used to slide right
 * along with the content — reading as "each screen has its own picture" instead of a fixed
 * backdrop. Hoisting it here decouples it from the swipe: it sits behind TopTabs. Both L1
 * layers stay mounted; the Home hero is overlaid in an Animated.View whose opacity
 * cross-fades in on Home / out elsewhere (Home is the centre tab, so this fires on most
 * swipes). This replaced an earlier `isHomeActive ? <HomeHeroBackground/> : <ScreenBackground/>`
 * MOUNT SWAP, which created/destroyed react-native-svg + gradient views (and restarted the
 * hero's Animated loops) on the exact frame a swipe settled — a per-swipe hitch that read
 * as laggy swiping. The 5 tab screens pass ownBackground={false} to ScreenScaffold so they
 * don't ALSO paint their own copy.
 *
 * Connections:
 *   Imports → expo-router/js-top-tabs (TopTabs — Expo Router's own SDK-56 top-tabs
 *             wrapper, not @react-navigation/material-top-tabs directly; see Edit notes),
 *             react-native-safe-area-context, components/BottomNav, components/ScreenBackground,
 *             components/HomeHeroBackground, components/ParticleBackground, lib/siteNav
 *   Used by → Expo Router route group "(tabs)" — app/_layout.tsx's single
 *             <Stack.Screen name="(tabs)" /> entry
 *   Data    → none (pure navigation composition)
 *
 * Edit notes:
 *   - Screen order MUST match lib/siteNav.ts's SITE_ITEMS (shopping, plans, index, habits,
 *     health) — BottomNav maps each pager route's name to a SITE_ITEMS entry via
 *     lib/siteNav.ts's TAB_ROUTE_NAME, so a mismatch here shows the wrong icon/label active.
 *     (2026-07-23, UX audit E1/E2: Scan swapped out for the new app/(tabs)/habits.tsx —
 *     Scan is now a pushed sub-screen at app/scan.tsx, reached from Shopping's header.)
 *   - `(tabs)` is a route group: URLs stay "/", "/shopping", "/plans", "/habits", "/health"
 *     (was "/scan" before the 2026-07-23 E1/E2 swap — see the Screen-order note above).
 *   - As of SDK 56, expo-router's Metro resolver throws a build error if app code imports
 *     `@react-navigation/*` directly (https://docs.expo.dev/router/migrate/sdk-55-to-56/).
 *     This file must import `TopTabs` from `expo-router/js-top-tabs`, not
 *     `createMaterialTopTabNavigator` from `@react-navigation/material-top-tabs` — the
 *     latter breaks both `eas update` and `eas build` at the bundling step. `TopTabs`
 *     wraps the identical react-native-tab-view/-pager-view stack internally.
 *   - **`lazy: false` (2026-07-16, cold-start perf)**: all five sites mount up front when
 *     the pager mounts, so navigating Home → any tab reveals an ALREADY-RENDERED tree
 *     instead of mounting it fresh on first visit — that first-visit mount was the visible
 *     "things load in" hitch users reported. Pairs with app/_layout.tsx's cold-start
 *     hydration (Tier A stores + the settings render gate), so the pre-mounted screens mount
 *     with their data already in memory. Watch memory on low-end Android (5 screens mounted
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
 *     intermediate page; in this centre-Home 5-tab bar most taps are far jumps (Shopping↔Health
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
 *   - **Background parallax (2026-07-23)**: the shared L1/L2 background group is wrapped in
 *     an Animated.View that drifts horizontally with the pager's live scroll `position` (a
 *     react-navigation Animated node, 0..4, lifted up from the tab bar via onPosition) — a
 *     small ±MAX_PARALLAX px translate, same direction as the content but far less, reading
 *     as depth rather than "each screen has its own picture" (the layer is oversized by
 *     MAX_PARALLAX per side so the drift never bares an edge). Null under reducedMotion, so
 *     the backdrop stays fixed exactly as before. It's a subtle counter to the fixed backdrop,
 *     not a re-coupling — the drift is a fraction of the content's full-width slide.
 *   - **Floated bottom-nav — sides + bottom, flush top (2026-07-23, amended)**:
 *     TabBarWithBackgroundSync's wrapper insets the bar with NAV_FLOAT_GAP on the LEFT/RIGHT and
 *     a matching small gap BELOW (on top of the safe-area inset), but flush at the TOP (no gap
 *     above). The small margin (smaller than the per-screen cards' Spacing.md) plus the bottom
 *     gap give BottomNav's rounded corners (Radius.lg, all four) room to read as a floating
 *     panel. Wrapper height is BOTTOM_NAV_HEIGHT + insetsBottom + NAV_FLOAT_GAP. The original
 *     pass floated it on ALL sides with Spacing.md side margins AND a top gap, which left an
 *     empty "blank border" frame of background around the bar — the top gap and the oversized
 *     side margins were removed. The floated header in ScreenScaffold is unchanged.
 *   - **Scene background must stay transparent**: @react-navigation/material-top-tabs's
 *     MaterialTopTabView wraps every route in `sceneStyle: { backgroundColor: colors.background }`
 *     by default (react-navigation theme background, opaque) — that painted over this
 *     shared L1/L2 backdrop, which is why the 5 tab screens showed a flat colour instead
 *     of the blobs/hero. `screenOptions.sceneStyle` below forces it back to `'transparent'`
 *     so the shared background shows through; each tab screen's own SafeAreaView stays
 *     transparent too (see ScreenScaffold's ownBackground=false path). If the backdrop
 *     ever goes flat again after a react-navigation/expo-router upgrade, check this
 *     sceneStyle override first.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { TopTabs, MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import ScreenBackground from '@/components/ScreenBackground';
import HomeHeroBackground from '@/components/HomeHeroBackground';
import ParticleBackground from '@/components/ParticleBackground';
import { useAccessibility } from '@/lib/useAppTheme';
import { TAB_ROUTE_NAME } from '@/lib/siteNav';
import { Spacing } from '@/constants/theme';

// Max horizontal drift (px) of the shared background as you swipe across the 5 tabs — a
// subtle parallax that adds depth without re-coupling the backdrop to the swipe the way a
// per-screen background did (see file header). The layer is oversized by this much on each
// side so the drift never reveals a bare edge.
const MAX_PARALLAX = 14;
// Float gap for the bottom-nav bar: a small left/right margin AND a matching small gap below
// (on top of the safe-area inset) so the bar's rounded corners read as a floating panel —
// deliberately SMALLER than the per-screen content cards' Spacing.md (16) side margin. The top
// stays flush (no gap above), per the "no blank border" pass.
const NAV_FLOAT_GAP = Spacing.sm;

type TabBarSyncProps = MaterialTopTabBarProps & {
  insetsBottom: number;
  onActiveRouteChange: (routeName: string) => void;
  onPosition: (position: Animated.AnimatedInterpolation<number>) => void;
};

function TabBarWithBackgroundSync({ insetsBottom, onActiveRouteChange, onPosition, ...tabBarProps }: TabBarSyncProps) {
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

  // Float the bar with a small left/right margin (NAV_FLOAT_GAP) and a matching small gap
  // BELOW (on top of the safe-area inset) so the bar's rounded bottom corners have room to
  // read as a floating panel — but flush at the TOP (no gap above). The wrapper height is
  // BOTTOM_NAV_HEIGHT + insetsBottom + NAV_FLOAT_GAP. This is the "round all corners + small
  // gap" treatment: it keeps BottomNav's full Radius.lg rounding on every corner while still
  // avoiding the empty "blank border" frame the earlier all-sides float (top + bottom +
  // Spacing.md sides) left around the bar.
  return (
    <View
      style={{
        height: BOTTOM_NAV_HEIGHT + insetsBottom + NAV_FLOAT_GAP,
        paddingTop: 0,
        paddingBottom: insetsBottom + NAV_FLOAT_GAP,
        paddingHorizontal: NAV_FLOAT_GAP,
      }}
    >
      <BottomNav {...tabBarProps} />
    </View>
  );
}

// Cold launch presents Home (the centre tab), not the first-declared tab (Shopping).
// expo-router reads `initialRouteName` off this export for the (tabs) layout and hands it
// to the navigator, which passes it to react-native-tab-view as the initial index — the
// pager's `initialPage` mounts directly on Home with no settle/animation in from Shopping
// (PagerViewAdapter uses `initialPage={navigationState.index}`). Must be a registered
// TopTabs.Screen name — 'index' is app/(tabs)/index.tsx (Home); TAB_ROUTE_NAME['/'] === 'index'.
export const unstable_settings = { initialRouteName: 'index' };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useAccessibility();
  const [activeRouteName, setActiveRouteName] = useState<string>(TAB_ROUTE_NAME['/']!);
  const isHomeActive = activeRouteName === TAB_ROUTE_NAME['/'];

  // The pager's live scroll position (0..4 across the 5 tabs), lifted up from the tab bar
  // (see TabBarWithBackgroundSync). Drives a subtle horizontal parallax on the shared
  // background so the backdrop drifts a little as you swipe — same direction as the content
  // but far less, reading as depth. Null until the first tab-bar render sets it; disabled
  // entirely under reducedMotion (the backdrop just stays fixed, as before).
  const [pagerPosition, setPagerPosition] = useState<Animated.AnimatedInterpolation<number> | null>(null);
  const onPosition = useCallback((p: Animated.AnimatedInterpolation<number>) => {
    setPagerPosition((prev) => prev ?? p);
  }, []);
  const bgParallax =
    reducedMotion || !pagerPosition
      ? null
      : {
          transform: [
            {
              translateX: pagerPosition.interpolate({
                inputRange: [0, 1, 2, 3, 4],
                outputRange: [MAX_PARALLAX, MAX_PARALLAX / 2, 0, -MAX_PARALLAX / 2, -MAX_PARALLAX],
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
      duration: 220,
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
          //     through every intermediate page. In this centre-Home 5-tab layout most taps
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
          <TabBarWithBackgroundSync {...props} insetsBottom={insets.bottom} onActiveRouteChange={setActiveRouteName} onPosition={onPosition} />
        )}
      >
        {/* Order MUST match SITE_ITEMS (lib/siteNav.ts): shopping, plans, home, habits, health */}
        <TopTabs.Screen name="shopping" />
        <TopTabs.Screen name="plans" />
        <TopTabs.Screen name="index" />
        <TopTabs.Screen name="habits" />
        <TopTabs.Screen name="health" />
        </TopTabs>
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
  },
});
