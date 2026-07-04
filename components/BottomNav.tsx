/**
 * BottomNav.tsx — horizontal bottom navigation bar with 5 buttons.
 *
 * Implements the design system's BottomNav pattern: left items (Shopping, Plans),
 * centre home/menu button, right items (Health, Scan). The centre button is
 * stylized as a gradient FAB. Active tab is highlighted with primary colour.
 * Taps navigate via goToSite() to keep the stack shallow. Wrapped in a
 * translucent Surface that picks up the user's bubbleMaterial setting.
 *
 * Connections:
 *   Imports → constants/theme, lib/i18n, lib/siteNav, lib/useAppTheme, components/PressableScale, components/Surface
 *   Used by → ScreenScaffold (composition layer for site-tier screens)
 *   Data    → none (presentational; navigation only)
 *
 * Edit notes:
 *   - SITE_ITEMS (lib/siteNav.ts) defines the 5 items and their order (left to right):
 *     Shopping, Plans, Home, Notes, Scan. Health was removed from this list (reachable
 *     via a Home header icon instead) — if SITE_ITEMS' length or item order changes
 *     again, update the slice indices below to match.
 *   - Centre item (index 2, home) is rendered with gradient + shadow (design system style).
 *   - Left items (indices 0–1) and right items (indices 3–4) are simple icon buttons.
 *   - BOTTOM_NAV_HEIGHT is exported for screens needing to offset overlays.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { FontSize, Radius, Spacing, Shadow } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { goToSite, SITE_ITEMS } from '@/lib/siteNav';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';

export const BOTTOM_NAV_HEIGHT = 72;

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const leftItems = SITE_ITEMS.slice(0, 2);
  const centreItem = SITE_ITEMS[2];
  const rightItems = SITE_ITEMS.slice(3, 5);

  const renderItem = (item: typeof SITE_ITEMS[0], isCentre = false) => {
    const active = pathname === item.route;
    const iconColor = active ? theme.accent : theme.textMuted;

    if (isCentre) {
      return (
        <PressableScale
          key={item.key}
          scaleTo={0.90}
          style={[styles.centreButton, { backgroundColor: theme.accent, ...Shadow.fab }]}
          onPress={() => goToSite(router, pathname, item.route)}
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
        style={[styles.item, active && { backgroundColor: theme.surfaceMuted, borderRadius: Radius.sm }]}
        onPress={() => goToSite(router, pathname, item.route)}
        hitSlop={6}
      >
        <Ionicons name={active ? item.activeIcon : item.icon} size={20} color={iconColor} />
        <Text style={[styles.label, { color: iconColor }]} numberOfLines={1}>
          {t.nav[item.key]}
        </Text>
      </PressableScale>
    );
  };

  return (
    <Surface style={styles.bar}>
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
    paddingHorizontal: Spacing.sm,
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
