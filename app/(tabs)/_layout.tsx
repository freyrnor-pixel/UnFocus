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
 * Connections:
 *   Imports → expo-router/js-top-tabs (TopTabs — Expo Router's own SDK-56 top-tabs
 *             wrapper, not @react-navigation/material-top-tabs directly; see Edit notes),
 *             react-native-safe-area-context, components/BottomNav
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
 *   - `lazy: true` mounts each site on first visit only (not all 5 at launch), but
 *     material-top-tabs keeps a visited site mounted (translated off-screen) afterwards —
 *     that persistence is what makes the swipe instant on repeat visits; watch memory on
 *     low-end Android if this becomes an issue later.
 *   - `swipeEnabled: true` is the whole point of this migration. app/(tabs)/scan.tsx
 *     temporarily flips it off via `navigation.setOptions` while an OCR scan is
 *     processing or one of its modals is open, so a stray swipe can't abandon that flow.
 */
import React from 'react';
import { View } from 'react-native';
import { TopTabs, MaterialTopTabBarProps } from 'expo-router/js-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <TopTabs
      tabBarPosition="bottom"
      screenOptions={{ swipeEnabled: true, lazy: true }}
      tabBar={(props: MaterialTopTabBarProps) => (
        <View style={{ height: BOTTOM_NAV_HEIGHT + insets.bottom, paddingBottom: insets.bottom }}>
          <BottomNav {...props} />
        </View>
      )}
    >
      {/* Order MUST match SITE_ITEMS (lib/siteNav.ts): shopping, plans, home, health, scan */}
      <TopTabs.Screen name="shopping" />
      <TopTabs.Screen name="plans" />
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="health" />
      <TopTabs.Screen name="scan" />
    </TopTabs>
  );
}
