/**
 * (tabs)/_layout.tsx — swipeable pager for the 5 main sites (Decision 032 successor).
 *
 * Co-mounts Shopping/Plans/Home/Health/Scan in one react-native-pager-view-backed
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
 *   - Screen order MUST match lib/siteNav.ts's SITE_ITEMS (shopping, plans, index, health,
 *     scan) — BottomNav maps each pager route's name to a SITE_ITEMS entry via
 *     lib/siteNav.ts's TAB_ROUTE_NAME, so a mismatch here shows the wrong icon/label active.
 *   - `(tabs)` is a route group: URLs stay "/", "/shopping", "/plans", "/health", "/scan" —
 *     unchanged from before this migration.
 *   - As of SDK 56, expo-router's Metro resolver throws a build error if app code imports
 *     `@react-navigation/*` directly (https://docs.expo.dev/router/migrate/sdk-55-to-56/).
 *     This file must import `TopTabs` from `expo-router/js-top-tabs`, not
 *     `createMaterialTopTabNavigator` from `@react-navigation/material-top-tabs` — the
 *     latter breaks both `eas update` and `eas build` at the bundling step. `TopTabs`
 *     wraps the identical react-native-tab-view/-pager-view stack internally.
 *   - **`lazy: false` (2026-07-16, cold-start perf)**: all five sites mount up front when
 *     the pager mounts, so navigating Home → any tab reveals an ALREADY-RENDERED tree
 *     instead of mounting it fresh on first visit — that first-visit mount was the visible
 *     "things load in" hitch users reported. Paired with app/_layout.tsx now loading every
 *     store eagerly before the render gate, so the pre-mounted screens mount with their data
 *     already in memory. Watch memory on low-end Android (5 screens mounted from launch);
 *     the Scan tab's CameraView is gated behind its `qrScanVisible` modal, so eager mount
 *     does NOT power on the camera. Mounting all five costs more launch-time JS than lazy
 *     mounting, but it runs behind _layout's render gate (themed backdrop until fonts +
 *     settings are ready), so it's paid during the launch window, not on navigation.
 *   - **`lazy: false` vs the REVERTED `lazyPreloadDistance` (2026-07-13)**: the earlier
 *     revert was `lazyPreloadDistance: 1` — a HALF-lazy state (lazy:true + preload) that hit
 *     react-native-pager-view's documented touch-delivery bug for preloaded-but-inactive
 *     screens ("+"/add controls going dead, e.g. Habits' inline AddRow). `lazy: false` is a
 *     different mode: the classic fully-eager tab-view render where every screen is a
 *     first-class mounted page from frame 0, not a preloaded-inactive one — the likely-safer
 *     configuration. Still: pager-view touch delivery can only be verified on-device (the
 *     headless web preview doesn't exercise native touch), so BEFORE this ships to users,
 *     verify inline add/tap controls (Habits AddRow, Shopping/Plans "+") work on a real
 *     build. If they regress, revert this single line to `lazy: true`.
 *   - `swipeEnabled: true` is the whole point of this migration. app/(tabs)/scan.tsx
 *     temporarily flips it off via `navigation.setOptions` while an OCR scan is
 *     processing or one of its modals is open, so a stray swipe can't abandon that flow.
 *   - **Active-tab tracking for the shared background**: the pager's own navigator state
 *     (`state.routes[state.index].name`) is read inside the `tabBar` render prop, same
 *     place BottomNav reads it to highlight the active icon — there's no other hook that
 *     exposes the focused route at this layout level. TabBarWithBackgroundSync forwards
 *     it up via onActiveRouteChange so this component can cross-fade the HomeHeroBackground
 *     overlay's opacity (both L1 layers stay mounted — no remount). This only fires when the
 *     focused route actually changes (not continuously while dragging), so the fade starts at
 *     the swipe boundary rather than sliding with the drag. reducedMotion snaps instead.
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
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { TopTabs, MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import ScreenBackground from '@/components/ScreenBackground';
import HomeHeroBackground from '@/components/HomeHeroBackground';
import ParticleBackground from '@/components/ParticleBackground';
import { useAccessibility } from '@/lib/useAppTheme';
import { TAB_ROUTE_NAME } from '@/lib/siteNav';

type TabBarSyncProps = MaterialTopTabBarProps & {
  insetsBottom: number;
  onActiveRouteChange: (routeName: string) => void;
};

function TabBarWithBackgroundSync({ insetsBottom, onActiveRouteChange, ...tabBarProps }: TabBarSyncProps) {
  const activeRouteName = tabBarProps.state.routes[tabBarProps.state.index]?.name;
  React.useEffect(() => {
    if (activeRouteName) onActiveRouteChange(activeRouteName);
  }, [activeRouteName, onActiveRouteChange]);

  return (
    <View style={{ height: BOTTOM_NAV_HEIGHT + insetsBottom, paddingBottom: insetsBottom }}>
      <BottomNav {...tabBarProps} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useAccessibility();
  const [activeRouteName, setActiveRouteName] = useState<string>(TAB_ROUTE_NAME['/']!);
  const isHomeActive = activeRouteName === TAB_ROUTE_NAME['/'];

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
          Both L1 layers stay mounted; the hero cross-fades over the plain backdrop. */}
      <ScreenBackground />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: heroOpacity }]} pointerEvents="none">
        <HomeHeroBackground />
      </Animated.View>
      <ParticleBackground />

      <TopTabs
        tabBarPosition="bottom"
        screenOptions={{ swipeEnabled: true, lazy: false, sceneStyle: { backgroundColor: 'transparent' } }}
        tabBar={(props: MaterialTopTabBarProps) => (
          <TabBarWithBackgroundSync {...props} insetsBottom={insets.bottom} onActiveRouteChange={setActiveRouteName} />
        )}
      >
        {/* Order MUST match SITE_ITEMS (lib/siteNav.ts): shopping, plans, home, health, scan */}
        <TopTabs.Screen name="shopping" />
        <TopTabs.Screen name="plans" />
        <TopTabs.Screen name="index" />
        <TopTabs.Screen name="health" />
        <TopTabs.Screen name="scan" />
      </TopTabs>
    </View>
  );
}
