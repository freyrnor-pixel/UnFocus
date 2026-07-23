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
 *             react-native-reanimated (useSharedValue/useAnimatedStyle/withTiming for the
 *             sliding pill), expo-router, constants/theme (incl. getGlow), constants/motion
 *             (Duration/Ease), lib/i18n, lib/siteNav, lib/useAppTheme (incl. useAccessibility),
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
 *   - Left items (indices 0–1) and right items (indices 3–4) are each wrapped in a `NavGroup`
 *     (below), which owns the shared sliding pill for that side and renders its items as
 *     plain `NavTabItem`s (icon + label only, no per-item box).
 *   - BOTTOM_NAV_HEIGHT is exported for screens needing to offset overlays.
 *   - Active-tab detection: tab-bar mode reads `state.routes[state.index].name` and
 *     matches it against SITE_ITEMS via lib/siteNav.ts's TAB_ROUTE_NAME; standalone mode
 *     falls back to `usePathname() === item.route`.
 *   - `PressableScale`'s own default (`haptic=true`) already fires a light tap haptic on
 *     every press — no separate haptic call is needed here.
 *   - **Sliding pill indicator, not per-item boxes (2026-07-22)**: the 2026-07-18 through
 *     2026-07-21 passes below gave every tab — active or not — its own permanent shadow+bevel
 *     box, the same elevation recipe the outer `Surface` bar uses on itself; five independently
 *     "raised" objects nested inside one raised bar read as scattered chips, not one integrated
 *     control. Replaced with `NavGroup`: one shared pill per side that slides (Reanimated
 *     `translateX`) to whichever tab is active, reusing `components/SlideSelector.tsx`'s
 *     track-measure-and-slide math (`onLayout` → equal segment width → `withTiming`, snapping
 *     instantly under `reducedMotion`). Only the active tab is ever "raised" now — inactive tabs
 *     are flush icon+label with no box, so there's no per-item shadow/rim left to compete with
 *     the bar's own. The centre FAB (`renderCentre`) is untouched; it's a single item, not a
 *     group, and already had its own distinct treatment. The bullets below are kept for history
 *     but describe boxes that no longer exist.
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
 *   - **Border dropped, fill + shadow kept (2026-07-20, later same-day follow-up)**: the
 *     `theme.border`/`theme.accent` border stroke from the "Keycap box" pass above read as
 *     "too punchy" (bordered look on every tab, all the time) per direct user feedback — removed
 *     `borderWidth`/`borderColor` entirely. The white `theme.surface` fill and `getLayeredShadow`
 *     depth (both from the two bullets above) are kept, so tabs still read as raised, tappable
 *     cards without the outlined look. Don't re-add a border here without checking this note.
 *   - **Purposeful glow (2026-07-18, optional per design pass)**: the active tab's box adds
 *     `getGlow(theme.accent, 'soft')` on top of the crossfade — only while active, never on
 *     every item. Concatenated onto the resting `boxShadow` array (not assigned over it) since
 *     both the depth and the glow are `boxShadow` — setting the key twice would silently drop
 *     the depth layers when active. The centre FAB-style button already reads as "lit" via its
 *     permanent accent fill + `Shadow.fab`, so it's left alone. (Now lives on the shared pill —
 *     see the 2026-07-22 bullet above.)
 *   - **Active fill uses `theme.accentSoft`** (the app-wide active/selected tint — same token
 *     as IconButton's active state, Button secondary, etc.), NOT `theme.surfaceMuted` —
 *     surfaceMuted is the neutral grey sunken tone; reusing it for active state is what
 *     made an earlier pass read as a plain "grey box" instead of a colored selected state.
 *   - **Keycap bevel ring (2026-07-21)**: a flat single-tone border was tried on the tab boxes
 *     and reverted the same day ("Border dropped..." note above) for reading too punchy. This is
 *     a different technique — the same rim-gradient bevel (`computeRimGradient`, light-top/
 *     dark-bottom, 3 stops) Button.tsx/Surface.tsx already use — gated behind
 *     `settings.glassSurfaces`, off entirely when that setting is off. The fill becomes the inner
 *     "double keycap" line, unchanged otherwise. Now that only the pill (always the active tab)
 *     carries this, the ring hue is always `theme.accent` — the `theme.border` (inactive) branch
 *     the old per-item rim needed no longer applies.
 *   - **Fixed: pill popping in from the wrong slot (2026-07-23)**: `NavGroup`'s driving effect
 *     used to run unconditionally every render, snapping `tx` back to slot 0 whenever the group
 *     had no active tab (Home selected, or the other side active). Tapping straight into a
 *     group's second slot (Home → Plans/"Tasks", or Home → Habits) then mounted the pill at that
 *     stale slot-0 position and animated it over — read as the pill sliding in from the wrong
 *     side.
 *   - **Home-anchored entry/exit (2026-07-23, same-day follow-up)**: the fix above made fresh
 *     appearances snap instantly with no slide at all, which read as an abrupt pop when arriving
 *     from Home, and a group's pill still hard-vanished (no exit animation) when leaving to Home.
 *     Replaced with `homeEdge`-anchored motion: each `NavGroup` knows which of its two slots sits
 *     next to the centre Home button (left group's last slot / right group's first slot, passed
 *     in as the `homeEdge` prop). Arriving in a group fresh now starts the pill at that
 *     Home-adjacent slot and slides (`Ease.enter`) to the real target — reads as coming from
 *     Home. Leaving a group (most commonly to Home) slides the pill back to that same
 *     Home-adjacent slot (`Ease.exit`) before unmounting (via the `withTiming` completion
 *     callback + `runOnJS`), instead of vanishing instantly. `withTiming` is still reserved for
 *     genuine in-group moves (Shopping ↔ Plans, Health ↔ Habits) and Home-anchor moves alike;
 *     only `reducedMotion` skips straight to the final position. See `settledRef`/`homeIndex`
 *     below (supersedes the now-removed `wasVisibleRef`).
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useT } from '@/lib/i18n';
import { Fonts, FontSize, Radius, Spacing, Shadow, getGlow, getLayeredShadow, computeRimGradient } from '@/constants/theme';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility, useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { goToSite, SITE_ITEMS, SiteItem, TAB_ROUTE_NAME } from '@/lib/siteNav';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';

export const BOTTOM_NAV_HEIGHT = 72;
const EDGE_WIDTH = 1.5;

type Props = Partial<Pick<MaterialTopTabBarProps, 'state' | 'navigation'>>;

export default function BottomNav({ state, navigation }: Props = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
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
    const icon = <Ionicons name={active ? item.activeIcon : item.icon} size={24} color={theme.accentInk} />;
    const centreRim = computeRimGradient(theme.accent, isDark);
    return (
      <PressableScale
        key={item.key}
        scaleTo={0.90}
        accessibilityRole="button"
        accessibilityLabel={t.nav[item.key]}
        accessibilityState={{ selected: active }}
        style={[styles.centreButton, Shadow.fab, glass ? null : { backgroundColor: theme.accent }]}
        onPress={() => handlePress(item)}
        hitSlop={8}
      >
        {glass ? (
          <LinearGradient
            colors={centreRim.colors}
            locations={centreRim.locations}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ width: '100%', height: '100%', borderRadius: Radius.full, padding: EDGE_WIDTH, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: '100%', height: '100%', borderRadius: Radius.full - EDGE_WIDTH, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </View>
          </LinearGradient>
        ) : icon}
      </PressableScale>
    );
  };

  return (
    <Surface surfaceContext="overlay" style={styles.bar}>
      <NavGroup
        items={leftItems}
        isActive={isActive}
        onPress={handlePress}
        label={(item) => t.nav[item.key]}
        styles={styles}
        groupStyle={styles.leftGroup}
        homeEdge="end"
      />

      {renderCentre(centreItem)}

      <NavGroup
        items={rightItems}
        isActive={isActive}
        onPress={handlePress}
        label={(item) => t.nav[item.key]}
        styles={styles}
        groupStyle={styles.rightGroup}
        homeEdge="start"
      />
    </Surface>
  );
}

type NavGroupProps = {
  items: SiteItem[];
  isActive: (item: SiteItem) => boolean;
  onPress: (item: SiteItem) => void;
  label: (item: SiteItem) => string;
  styles: typeof baseStyles;
  groupStyle: typeof baseStyles.leftGroup;
  // Which end of this group's track sits next to the centre Home button — 'end' for the
  // left group (Plans is the neighbour), 'start' for the right group (Health is the
  // neighbour). Anchors the pill's entry/exit animation so Home transitions read as a
  // slide to/from Home instead of a hard pop/vanish.
  homeEdge: 'start' | 'end';
};

// Own component (not a plain render function) so each side gets its own measured track +
// shared-value pair — the pill slides independently per side. Reuses the track-measure-and-
// slide math from components/SlideSelector.tsx (segments are flex:1, so segW = (trackW -
// gap*(n-1)) / n, and translateX steps by segW + gap), adapted to this bar's own material
// (shadow + glow + rim bevel on the pill, not SlideSelector's flat accent fill).
function NavGroup({ items, isActive, onPress, label, styles, groupStyle, homeEdge }: NavGroupProps) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const { reducedMotion } = useAccessibility();
  const [track, setTrack] = useState({ w: 0, h: 0 });

  const n = items.length;
  const rawActiveIndex = items.findIndex(isActive);
  // Unlike SlideSelector (always a genuine selection), a side group can have NO active
  // item — the centre Home tab has no group of its own. Math.max(0, -1) would otherwise
  // default to index 0, painting a pill on Shopping/Health whenever Home is selected.
  const hasActive = rawActiveIndex !== -1;
  const activeIndex = Math.max(0, rawActiveIndex);
  const segW = track.w > 0 ? (track.w - Spacing.sm * (n - 1)) / n : 0;
  // The slot nearest Home — the pill's entry/exit anchor (see NavGroupProps.homeEdge).
  const homeIndex = homeEdge === 'end' ? n - 1 : 0;

  const tx = useSharedValue(0);
  const [mounted, setMounted] = useState(false);
  // Whether the pill is currently settled on a real slot in THIS group (as opposed to
  // unmounted, or mid a Home entry/exit anchor move) — only a genuine in-group move
  // (Shopping ↔ Plans, Health ↔ Habits) should slide directly between two real slots;
  // arriving from or leaving to Home instead anchors through homeIndex below.
  const settledRef = useRef(false);

  useEffect(() => {
    if (segW === 0) return;
    const step = segW + Spacing.sm;

    if (hasActive) {
      const to = activeIndex * step;
      if (!settledRef.current) {
        // Fresh appearance in this group (from Home, or from the other side) — start the
        // pill at the Home-adjacent slot and slide to the real target, so it always reads
        // as arriving from Home.
        setMounted(true);
        tx.value = homeIndex * step;
      }
      tx.value = reducedMotion ? to : withTiming(to, { duration: Duration.control, easing: Ease.enter });
      settledRef.current = true;
    } else if (settledRef.current) {
      // Leaving this group (most commonly to Home) — slide back to the Home-adjacent slot,
      // then unmount, so departing reads as heading toward Home instead of vanishing.
      settledRef.current = false;
      const to = homeIndex * step;
      if (reducedMotion) {
        tx.value = to;
        setMounted(false);
      } else {
        tx.value = withTiming(to, { duration: Duration.control, easing: Ease.exit }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        });
      }
    }
  }, [hasActive, activeIndex, segW, homeIndex, reducedMotion, tx]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setTrack((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  // The pill only ever marks the active tab, so its rim is always accent-hued (the old
  // per-item rim's inactive/theme.border branch no longer applies).
  const rim = computeRimGradient(theme.accent, isDark);
  const pillShadow = [...getLayeredShadow(theme.shadow, 'raised'), ...getGlow(theme.accent, 'soft').boxShadow];

  return (
    <View style={groupStyle} onLayout={onLayout}>
      {segW > 0 && mounted && (
        <Animated.View pointerEvents="none" style={[styles.pill, { width: segW, height: track.h }, pillStyle]}>
          {glass ? (
            <LinearGradient
              colors={rim.colors}
              locations={rim.locations}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1, borderRadius: Radius.md, padding: EDGE_WIDTH }}
            >
              <View style={{ flex: 1, borderRadius: Radius.md - EDGE_WIDTH, backgroundColor: theme.accentSoft, boxShadow: pillShadow }} />
            </LinearGradient>
          ) : (
            <View style={{ flex: 1, borderRadius: Radius.md, backgroundColor: theme.accentSoft, boxShadow: pillShadow }} />
          )}
        </Animated.View>
      )}
      {items.map((item) => (
        <NavTabItem
          key={item.key}
          item={item}
          label={label(item)}
          active={isActive(item)}
          onPress={() => onPress(item)}
          styles={styles}
        />
      ))}
    </View>
  );
}

type NavTabItemProps = {
  item: SiteItem;
  label: string;
  active: boolean;
  onPress: () => void;
  styles: typeof baseStyles;
};

function NavTabItem({ item, label, active, onPress, styles }: NavTabItemProps) {
  const theme = useAppTheme();
  const iconColor = active ? theme.accent : theme.textMuted;

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
  // Shared sliding pill (NavGroup) — absolutely positioned, translateX-animated to sit
  // behind whichever tab in the group is active. width/height are set inline per render
  // from the measured track (see NavGroup); only translateX is the animated shared value.
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
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
