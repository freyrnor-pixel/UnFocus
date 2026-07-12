/**
 * BottomNav.tsx — bottom navigation bar rendered as the swipeable pager's tab bar.
 *
 * Implements the design system's BottomNav pattern: left items (Shopping, Plans),
 * centre home/menu button, right items (Health, Scan). The centre button is
 * stylized as a gradient FAB. Active tab is highlighted with primary colour.
 * Primary usage is as app/(tabs)/_layout.tsx's `tabBar` render prop — react-navigation
 * hands it the pager's `state`/`navigation`, which this component uses both to know
 * which tab is active and to switch tabs (`navigation.navigate()`, which the pager
 * animates as a native slide). A standalone `<BottomNav />` (no props) mode is kept
 * for any hypothetical site-tier screen mounted outside the tabs group — it falls
 * back to the pre-pager usePathname()/goToSite() routing.
 *
 * Connections:
 *   Imports → @react-navigation/material-top-tabs (MaterialTopTabBarProps type),
 *             expo-router, constants/theme, lib/i18n, lib/siteNav, lib/useAppTheme,
 *             components/PressableScale, components/Surface
 *   Used by → app/(tabs)/_layout.tsx (as the pager's tabBar); components/ScreenScaffold
 *             (standalone fallback via bottomNav=true — currently unused by any real screen)
 *   Data    → none (presentational; navigation only)
 *
 * Edit notes:
 *   - SITE_ITEMS (lib/siteNav.ts) defines the 5 items and their order (left to right):
 *     Shopping, Plans, Home, Health, Scan (Decision 036). Notes, Food/Meals, and
 *     Automations are NOT tabs — they are reached via Home's "More" links (Notes, Food)
 *     and Settings → Automations. If SITE_ITEMS' length or item order changes again,
 *     update the slice indices below to match.
 *   - Centre item (index 2, home) is rendered with gradient + shadow (design system style).
 *   - Left items (indices 0–1) and right items (indices 3–4) are simple icon buttons.
 *   - BOTTOM_NAV_HEIGHT is exported for screens needing to offset overlays.
 *   - Active-tab detection: tab-bar mode reads `state.routes[state.index].name` and
 *     matches it against SITE_ITEMS via lib/siteNav.ts's TAB_ROUTE_NAME; standalone mode
 *     falls back to `usePathname() === item.route`.
 *   - `PressableScale`'s own default (`haptic=true`) already fires a light tap haptic on
 *     every press — no separate haptic call is needed here.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useT } from '@/lib/i18n';
import { FontSize, Radius, Spacing, Shadow } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { goToSite, SITE_ITEMS, SiteItem, TAB_ROUTE_NAME } from '@/lib/siteNav';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';

export const BOTTOM_NAV_HEIGHT = 72;

type Props = Partial<Pick<MaterialTopTabBarProps, 'state' | 'navigation'>>;

export default function BottomNav({ state, navigation }: Props = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const leftItems = SITE_ITEMS.slice(0, 2);
  const centreItem = SITE_ITEMS[2];
  const rightItems = SITE_ITEMS.slice(3, 5);

  // Tab-bar mode (rendered by app/(tabs)/_layout.tsx): the pager's own navigator state
  // says which site is active. Standalone mode (no state prop) falls back to matching
  // the current URL, same as before this file became a tab bar.
  const activeRouteName = state ? state.routes[state.index]?.name : undefined;

  function isActive(item: SiteItem) {
    return state ? activeRouteName === TAB_ROUTE_NAME[item.route] : pathname === item.route;
  }

  function handlePress(item: SiteItem) {
    if (navigation) {
      const routeName = TAB_ROUTE_NAME[item.route];
      if (routeName) navigation.navigate(routeName);
      return;
    }
    goToSite(router, pathname, item.route);
  }

  const renderItem = (item: SiteItem, isCentre = false) => {
    const active = isActive(item);
    const iconColor = active ? theme.accent : theme.textMuted;

    if (isCentre) {
      return (
        <PressableScale
          key={item.key}
          scaleTo={0.90}
          accessibilityRole="button"
          accessibilityLabel={t.nav[item.key]}
          accessibilityState={{ selected: active }}
          style={[styles.centreButton, { backgroundColor: theme.accent, ...Shadow.fab }]}
          onPress={() => handlePress(item)}
          hitSlop={8}
        >
          <Ionicons name={active ? item.activeIcon : item.icon} size={24} color={theme.accentInk} />
        </PressableScale>
      );
    }

    return (
      <PressableScale
        key={item.key}
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={t.nav[item.key]}
        accessibilityState={{ selected: active }}
        style={[styles.item, active && { backgroundColor: theme.surfaceMuted, borderRadius: Radius.sm }]}
        onPress={() => handlePress(item)}
        hitSlop={6}
      >
        <Ionicons name={active ? item.activeIcon : item.icon} size={20} color={iconColor} />
        <Text
          style={[styles.label, { color: iconColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {t.nav[item.key]}
        </Text>
      </PressableScale>
    );
  };

  return (
    <Surface surfaceContext="overlay" style={styles.bar}>
      <View style={styles.leftGroup}>
        {leftItems.map((item) => renderItem(item, false))}
      </View>

      {renderItem(centreItem, true)}

      <View style={styles.rightGroup}>
        {rightItems.map((item) => renderItem(item, false))}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  leftGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flex: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flex: 1,
    justifyContent: 'flex-end',
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    // Tight horizontal padding + adjustsFontSizeToFit on the label keeps long labels
    // ("Handleliste", "Oppgaver") on one line without ellipsis truncation.
    paddingHorizontal: 2,
  },
  centreButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
