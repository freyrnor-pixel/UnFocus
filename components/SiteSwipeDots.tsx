/**
 * SiteSwipeDots.tsx — page-dots indicator for swipe-between-sites navigation.
 *
 * SiteSwipeView (Decision 032) makes every bottom-menu site swipeable left/right,
 * but the gesture had zero visual affordance — nothing told the user the sites
 * form a swipeable strip. This renders the familiar carousel page-dots (one per
 * SITE_ITEM, the current site's dot elongated + accented), which both signals
 * "these pages swipe" and shows the current position. Purely decorative: it sits
 * above BottomNav with pointerEvents disabled, so it never intercepts touches.
 *
 * Connections:
 *   Imports → react-native, expo-router, lib/siteNav, lib/useAppTheme
 *   Used by → components/ScreenScaffold (site-tier screens with swipeNav on)
 *   Data    → none (reads current route via usePathname)
 *
 * Edit notes:
 *   - Renders nothing when the current route isn't one of the swipeable sites
 *     (e.g. a sub screen momentarily sharing the scaffold), so it stays inert
 *     off the carousel.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { SITE_ITEMS } from '@/lib/siteNav';
import { useAppTheme } from '@/lib/useAppTheme';

export default function SiteSwipeDots() {
  const pathname = usePathname();
  const theme = useAppTheme();
  const activeIndex = SITE_ITEMS.findIndex((item) => item.route === pathname);

  if (activeIndex === -1) return null;

  return (
    <View style={styles.row} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {SITE_ITEMS.map((item, i) => {
        const active = i === activeIndex;
        return (
          <View
            key={item.key}
            style={[
              styles.dot,
              { backgroundColor: active ? theme.accent : theme.border },
              active && styles.dotActive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.9,
  },
  dotActive: {
    width: 14,
  },
});
