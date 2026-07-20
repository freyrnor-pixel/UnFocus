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
 *             react-native-reanimated (Animated.View for the per-item keycap crossfade),
 *             expo-router, constants/theme (incl. getGlow), lib/i18n, lib/siteNav,
 *             lib/useAppTheme, lib/useToggleColor, components/PressableScale, components/Surface
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
 *   - Left items (indices 0–1) and right items (indices 3–4) are rendered by `NavTabItem`,
 *     a small subcomponent (below) so each gets its own `useToggleColor` hook instance.
 *   - BOTTOM_NAV_HEIGHT is exported for screens needing to offset overlays.
 *   - Active-tab detection: tab-bar mode reads `state.routes[state.index].name` and
 *     matches it against SITE_ITEMS via lib/siteNav.ts's TAB_ROUTE_NAME; standalone mode
 *     falls back to `usePathname() === item.route`.
 *   - `PressableScale`'s own default (`haptic=true`) already fires a light tap haptic on
 *     every press — no separate haptic call is needed here.
 *   - **Keycap box, every item, always (2026-07-20)**: each non-centre item now carries a
 *     permanent bordered box — `theme.surface` (white/near-white card fill, NOT the grey
 *     `surfaceMuted` sunken tone) + `theme.border` edge at rest, crossfading (via
 *     `useToggleColor`, same hook `IconButton` uses) to `theme.accentSoft` fill + `theme.accent`
 *     edge when active — instead of the old "nothing until selected" look, which read as
 *     visually empty/unstyled, and a since-reverted grey-`surfaceMuted` pass that read as
 *     flat/lifeless against the also-grey-ish frosted bar behind it. `theme.surface` reads as
 *     a distinct raised white card against the bar's frosted `overlay`-context wash, so every
 *     tab has a visible bordered chip at rest, not just the active one.
 *   - **Real depth, not just an outline (2026-07-20, same-day follow-up)**: a flat single-tone
 *     border alone read as "plain borders" rather than an actual button — every item's box now
 *     also carries `getLayeredShadow(theme.shadow, 'raised')` (the same three-pass depth token
 *     Surface/Button use elsewhere), always on, so the keycap visibly lifts off the bar at rest
 *     instead of relying on the border alone to sell "tappable." Radius bumped `Radius.sm` →
 *     `Radius.md` to match Surface/Button's card/pill radius instead of a smaller, flatter-looking
 *     chip corner.
 *   - **Purposeful glow (2026-07-18, optional per design pass)**: the active tab's box adds
 *     `getGlow(theme.accent, 'soft')` on top of the crossfade — only while active, never on
 *     every item (it's a static conditional, not animated, matching "icon/label colour swaps
 *     instantly on top" from useToggleColor's own doc comment). Concatenated onto the resting
 *     `boxShadow` array (not assigned over it) since both the depth and the glow are `boxShadow`
 *     — setting the key twice would silently drop the depth layers when active. The centre
 *     FAB-style button already reads as "lit" via its permanent accent fill + `Shadow.fab`, so
 *     it's left alone.
 *   - **Active fill uses `theme.accentSoft`** (the app-wide active/selected tint — same token
 *     as IconButton's active state, Button secondary, etc.), NOT `theme.surfaceMuted` —
 *     surfaceMuted is the neutral grey sunken tone; reusing it for active state is what
 *     made an earlier pass read as a plain "grey box" instead of a colored selected state.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useT } from '@/lib/i18n';
import { Fonts, FontSize, Radius, Spacing, Shadow, getGlow, getLayeredShadow } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';
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

  const renderCentre = (item: SiteItem) => {
    const active = isActive(item);
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
  };

  return (
    <Surface surfaceContext="overlay" style={styles.bar}>
      <View style={styles.leftGroup}>
        {leftItems.map((item) => (
          <NavTabItem key={item.key} item={item} label={t.nav[item.key]} active={isActive(item)} onPress={() => handlePress(item)} styles={styles} />
        ))}
      </View>

      {renderCentre(centreItem)}

      <View style={styles.rightGroup}>
        {rightItems.map((item) => (
          <NavTabItem key={item.key} item={item} label={t.nav[item.key]} active={isActive(item)} onPress={() => handlePress(item)} styles={styles} />
        ))}
      </View>
    </Surface>
  );
}

type NavTabItemProps = {
  item: SiteItem;
  label: string;
  active: boolean;
  onPress: () => void;
  styles: typeof baseStyles;
};

// Own component (not a plain render function) so each item gets its own useToggleColor
// hook instance — the keycap box crossfades independently per tab.
function NavTabItem({ item, label, active, onPress, styles }: NavTabItemProps) {
  const theme = useAppTheme();
  const iconColor = active ? theme.accent : theme.textMuted;
  const boxStyle = useToggleColor(active, {
    backgroundColor: [theme.surface, theme.accentSoft],
    borderColor: [theme.border, theme.accent],
  });
  // Real depth (not just an outline) so the keycap reads as a raised, physical button —
  // same `getLayeredShadow` three-pass depth Surface/Button use, not a bespoke shadow recipe.
  // Active tabs layer the existing purposeful glow on top of (not instead of) that depth —
  // both are `boxShadow` arrays, so they must be concatenated, not spread onto the same key.
  const restShadow = getLayeredShadow(theme.shadow, 'raised');
  const boxShadow = active ? [...restShadow, ...getGlow(theme.accent, 'soft').boxShadow] : restShadow;

  return (
    <PressableScale
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.item}
      onPress={onPress}
      hitSlop={6}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.itemBox, boxStyle, { boxShadow }]}
      />
      <Ionicons name={active ? item.activeIcon : item.icon} size={20} color={iconColor} />
      <Text
        style={[styles.label, { color: iconColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </PressableScale>
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
  // Keycap box behind the icon/label — always rendered (fill + border crossfade between
  // inactive/active via useToggleColor in NavTabItem, same pattern as IconButton).
  itemBox: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
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
    fontFamily: Fonts.semibold,
  },
});
