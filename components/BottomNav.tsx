/**
 * BottomNav.tsx — bottom navigation bar rendered as the swipeable pager's tab bar.
 *
 * Implements the design system's BottomNav pattern: left items (Shopping, Plans),
 * centre home/menu button, right items (Habits, Health). The centre button is
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
 *     Shopping, Plans, Home, Habits, Health (Decision 036; Habits/Health order swapped
 *     2026-07-24). Notes, Food/Meals, and
 *     Automations are NOT tabs — they are reached via Home's "More" links (Notes, Food)
 *     and Settings → Automations. If SITE_ITEMS' length or item order changes again,
 *     update the slice indices below to match.
 *   - Centre item (index 2, home) is rendered with gradient + shadow (design system style).
 *   - Left items (indices 0–1) and right items (indices 3–4) are each wrapped in a `NavGroup`
 *     (below), purely for layout (flex:1 track + equal segment division) — it reports its
 *     measured track (x/width/height) upward via `onTrack` and renders plain `NavTabItem`s
 *     (icon + label only, no per-item box, no pill of its own — see the single-pill bullet below).
 *   - BOTTOM_NAV_HEIGHT is exported for screens needing to offset overlays.
 *   - Active-tab detection: tab-bar mode reads `state.routes[state.index].name` and
 *     matches it against SITE_ITEMS via lib/siteNav.ts's TAB_ROUTE_NAME; standalone mode
 *     falls back to `usePathname() === item.route`.
 *   - `PressableScale`'s own default (`haptic=true`) already fires a light tap haptic on
 *     every press — no separate haptic call is needed here.
 *   - **One continuous full-bar pill (2026-07-24) — supersedes every per-`NavGroup` pill
 *     bullet below.** The bullets from "Sliding pill indicator" through "No entry animation
 *     on first mount" describe an earlier design where EACH side group owned its own
 *     independent sliding pill, confined to that group's own flex container. That made a tap
 *     between two tabs in DIFFERENT groups (e.g. Shopping → Health, "far apart" across the
 *     centre Home button) animate as TWO separate, disjoint motions — one pill sliding out on
 *     the left, an unrelated pill sliding in on the right — never a single element traveling
 *     the whole bar, because no single element could. Replaced with ONE pill, owned by
 *     `BottomNav` itself and rendered as a plain absolutely-positioned sibling of both
 *     `NavGroup`s and the centre button (not nested inside either), so it can translateX to
 *     ANY of the 4 side slots — including a slide that passes behind/through the Home button —
 *     in a single `withTiming` call. Its x targets come from three measured tracks
 *     (`leftTrack`/`rightTrack`/`centreTrack`, each `{x, y, w, h}` from that child's own
 *     `onLayout`, relative to the bar's content box — the same coordinate space a normal flex
 *     child's `onLayout.x`/`.y` already report in). `slotX(index)` maps a SITE_ITEMS index (0/1 →
 *     left track, 3/4 → right track, 2/home → centred under the centre button, used only as
 *     the entry/exit anchor since Home itself never gets a pill) to that x. Home ↔ side moves
 *     still anchor through the centre button's real x (replacing the old "whichever slot sits
 *     nearest Home" approximation) with an opacity fade in/out; genuine side ↔ side moves — same
 *     group OR across groups — are a single translateX between two real slot x values, so they
 *     read as one continuous slide no matter how far apart the two tabs are. `Duration.tabSwitch`
 *     (200ms, ANIMATION_GUIDELINES §1 "Tab switch") replaces the old `Duration.control` (150ms,
 *     meant for toggles/segmented controls, not full nav-tab travel) now that a single pill may
 *     need to cover up to the whole bar's width instead of just one group's. `settledRef`/
 *     `firstRunRef` are the same fresh-appearance/cold-launch guards the old per-group code used,
 *     just centralized to one pill instead of duplicated per group.
 *   - **Pill vertically misaligned (fixed, 2026-07-24 follow-up)**: `pill`'s `top` was
 *     hardcoded to 0, ignoring that the pill is `position:absolute` against the bar's own
 *     content box — which has `paddingVertical: Spacing.sm` that the tab items (flow
 *     children) sit shifted down by, but an absolute child does not. Net effect (user
 *     report, screenshot): the pill's top edge floated above the tab's icon and its bottom
 *     edge cut into the label instead of framing the button, on every active tab. Fixed the
 *     same way the x-axis already was: `Track` now also carries the real measured `y`, and
 *     `pillTop` (leftTrack.y || rightTrack.y) is applied as the pill's actual `top` inline,
 *     alongside the existing `width`/`height`.
 *   - **(Historical, superseded above) Sliding pill indicator, not per-item boxes (2026-07-22)**:
 *     the 2026-07-18 through 2026-07-21 passes below gave every tab — active or not — its own
 *     permanent shadow+bevel box, the same elevation recipe the outer `Surface` bar uses on
 *     itself; five independently "raised" objects nested inside one raised bar read as scattered
 *     chips, not one integrated control. Only the active tab is ever "raised" — inactive tabs are
 *     flush icon+label with no box, so there's no per-item shadow/rim left to compete with the
 *     bar's own. The centre FAB (`renderCentre`) is untouched; it's a single item, not a group,
 *     and already had its own distinct treatment. The bullets below are kept for history but
 *     describe boxes that no longer exist.
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
 *   - **Purposeful glow (2026-07-18, optional per design pass)**: the active tab's pill adds
 *     `getGlow(theme.accent, 'soft')` on top of its fill — only while a side tab is active, never
 *     on Home or on every item. Concatenated onto the resting `boxShadow` array (not assigned
 *     over it) since both the depth and the glow are `boxShadow` — setting the key twice would
 *     silently drop the depth layers when active. The centre FAB-style button already reads as
 *     "lit" via its permanent accent fill + `Shadow.fab`, so it's left alone.
 *   - **Active fill uses `theme.accentSoft`** (the app-wide active/selected tint — same token
 *     as IconButton's active state, Button secondary, etc.), NOT `theme.surfaceMuted` —
 *     surfaceMuted is the neutral grey sunken tone; reusing it for active state is what
 *     made an earlier pass read as a plain "grey box" instead of a colored selected state.
 *   - **Keycap bevel ring (2026-07-21)**: a flat single-tone border was tried on the tab boxes
 *     and reverted the same day ("Border dropped..." note above) for reading too punchy. This is
 *     a different technique — the same rim-gradient bevel (`computeRimGradient`, light-top/
 *     dark-bottom, 3 stops) Button.tsx/Surface.tsx already use — gated behind
 *     `settings.glassSurfaces`, off entirely when that setting is off. The fill becomes the inner
 *     "double keycap" line, unchanged otherwise. The pill always carries this now (there's only
 *     ever one), so the ring hue is always `theme.accent` — the `theme.border` (inactive) branch
 *     the old per-item rim needed no longer applies.
 *   - **(Historical, superseded above) Fixed: pill popping in from the wrong slot (2026-07-23)**:
 *     the old per-group driving effect used to run unconditionally every render, snapping `tx`
 *     back to slot 0 whenever that group had no active tab (Home selected, or the other side
 *     active). Tapping straight into a group's second slot then mounted the pill at that stale
 *     slot-0 position and animated it over — read as the pill sliding in from the wrong side.
 *   - **(Historical, superseded above) Home-anchored entry/exit (2026-07-23, same-day
 *     follow-up)**: replaced hard pop/vanish with motion anchored to whichever slot sat next to
 *     Home. The single full-bar pill above generalizes this to the centre button's REAL x
 *     instead of a "nearest slot" stand-in, and — because it's one element, not two — a side ↔
 *     side move across groups no longer needs a Home anchor at all; it's a direct slide.
 *   - **(Historical, superseded above) No entry animation on first mount (2026-07-24)**: a cold
 *     launch/deep-link straight onto a side tab should initialize there with no slide. Preserved
 *     verbatim as `firstRunRef` in the new single-pill effect.
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
const ITEMS_PER_SIDE = 2;

type Props = Partial<Pick<MaterialTopTabBarProps, 'state' | 'navigation'>>;

// A group's (or the centre button's) measured layout, relative to the bar's own content box —
// the same coordinate space `onLayout`'s `x`/`y` already report a flex child in.
type Track = { x: number; y: number; w: number; h: number };
const EMPTY_TRACK: Track = { x: 0, y: 0, w: 0, h: 0 };

export default function BottomNav({ state, navigation }: Props = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const { reducedMotion } = useAccessibility();
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

  // ─── Single full-bar pill — see the 2026-07-24 edit note above for the why ───────────────
  const [leftTrack, setLeftTrack] = useState<Track>(EMPTY_TRACK);
  const [rightTrack, setRightTrack] = useState<Track>(EMPTY_TRACK);
  const [centreTrack, setCentreTrack] = useState<Track>(EMPTY_TRACK);

  const setTrack = (setter: React.Dispatch<React.SetStateAction<Track>>) => (next: Track) => {
    setter((prev) => (prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next));
  };
  const onLeftTrack = setTrack(setLeftTrack);
  const onRightTrack = setTrack(setRightTrack);

  const activeIndex = SITE_ITEMS.findIndex(isActive);
  const isHomeActive = activeIndex === 2;
  const gap = Spacing.sm;
  const leftSegW = leftTrack.w > 0 ? (leftTrack.w - gap * (ITEMS_PER_SIDE - 1)) / ITEMS_PER_SIDE : 0;
  const rightSegW = rightTrack.w > 0 ? (rightTrack.w - gap * (ITEMS_PER_SIDE - 1)) / ITEMS_PER_SIDE : 0;
  // Both sides measure equal (the bar is `justify-content: space-between` with flex:1 on both
  // groups around a fixed-width centre button) — fall back to whichever side is ready first.
  const segW = leftSegW || rightSegW;
  const ready = leftTrack.w > 0 && rightTrack.w > 0 && centreTrack.w > 0 && segW > 0;

  // Maps a SITE_ITEMS index to the pill's target x (relative to the bar's content box).
  function slotX(index: number): number {
    if (index === 0 || index === 1) return leftTrack.x + index * (segW + gap);
    if (index === 3 || index === 4) return rightTrack.x + (index - 3) * (segW + gap);
    // index === 2 (Home) — no pill ever sits here; this is only the entry/exit anchor.
    return centreTrack.x + (centreTrack.w - segW) / 2;
  }

  const tx = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const [pillMounted, setPillMounted] = useState(false);
  // Whether the pill is currently settled on a real (non-Home) slot.
  const settledRef = useRef(false);
  // True until the first layout-ready effect run — a cold launch/deep-link straight onto a
  // side tab initializes there with no entry slide; every later fresh appearance keeps the
  // Home-anchored slide+fade.
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (!ready) return;
    const firstRun = firstRunRef.current;
    firstRunRef.current = false;

    if (!isHomeActive) {
      const to = slotX(activeIndex);
      const fresh = !settledRef.current;
      settledRef.current = true;
      if (fresh && firstRun) {
        setPillMounted(true);
        tx.value = to;
        pillOpacity.value = 1;
        return;
      }
      if (fresh) {
        // Arriving from Home — start at the centre anchor, then slide+fade to the real target.
        setPillMounted(true);
        tx.value = slotX(2);
        pillOpacity.value = 0;
      }
      // Otherwise this is a genuine slot -> slot move (same group OR across groups) — `tx`
      // animates directly from wherever it currently sits, so a cross-group tap is one
      // continuous slide instead of an exit + a separate entry.
      if (reducedMotion) {
        tx.value = to;
        pillOpacity.value = 1;
      } else {
        tx.value = withTiming(to, { duration: Duration.tabSwitch, easing: Ease.move });
        pillOpacity.value = withTiming(1, { duration: Duration.tabSwitch, easing: Ease.enter });
      }
    } else if (settledRef.current) {
      // Leaving to Home — slide+fade back to the centre anchor, then unmount.
      settledRef.current = false;
      const homeX = slotX(2);
      if (reducedMotion) {
        tx.value = homeX;
        pillOpacity.value = 0;
        setPillMounted(false);
      } else {
        tx.value = withTiming(homeX, { duration: Duration.tabSwitch, easing: Ease.move });
        pillOpacity.value = withTiming(0, { duration: Duration.tabSwitch, easing: Ease.exit }, (finished) => {
          if (finished) runOnJS(setPillMounted)(false);
        });
      }
    }
  }, [ready, activeIndex, isHomeActive, segW, leftTrack.x, rightTrack.x, centreTrack.x, centreTrack.w, reducedMotion, tx, pillOpacity]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: pillOpacity.value,
  }));

  // The pill only ever marks an active SIDE tab, so its rim is always accent-hued.
  const rim = computeRimGradient(theme.accent, isDark);
  const pillShadow = [...getLayeredShadow(theme.shadow, 'raised'), ...getGlow(theme.accent, 'soft').boxShadow];
  const pillHeight = leftTrack.h || rightTrack.h;
  // The pill is `position:absolute` against the bar's own content box, which ignores that
  // box's `paddingVertical` (2026-07-24 bug: "blue [pill] around the buttons is not
  // centered") — the tab items themselves are flow children, so THEY sit shifted down by
  // that padding, but the pill's old hardcoded `top:0` never accounted for it, leaving the
  // pill's top edge floating above the icon and its bottom edge cutting into the label
  // instead of framing the button. Use the real measured y (same fix pattern as the x-based
  // translateX above) instead of assuming the pill's container has no padding.
  const pillTop = leftTrack.y || rightTrack.y;

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
        onLayout={(e: LayoutChangeEvent) => {
          const { x, y, width, height } = e.nativeEvent.layout;
          setCentreTrack((prev) =>
            prev.x === x && prev.y === y && prev.w === width && prev.h === height ? prev : { x, y, w: width, h: height }
          );
        }}
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
      {segW > 0 && pillMounted && (
        <Animated.View pointerEvents="none" style={[styles.pill, { width: segW, height: pillHeight, top: pillTop }, pillStyle]}>
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

      <NavGroup
        items={leftItems}
        isActive={isActive}
        onPress={handlePress}
        label={(item) => t.nav[item.key]}
        styles={styles}
        groupStyle={styles.leftGroup}
        onTrack={onLeftTrack}
      />

      {renderCentre(centreItem)}

      <NavGroup
        items={rightItems}
        isActive={isActive}
        onPress={handlePress}
        label={(item) => t.nav[item.key]}
        styles={styles}
        groupStyle={styles.rightGroup}
        onTrack={onRightTrack}
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
  // Reports this group's measured track (x/width/height, relative to the bar) up to
  // BottomNav, which owns the one shared pill and computes its slot x's from it.
  onTrack: (track: Track) => void;
};

// Pure layout container now — the pill used to live here (one per side, see the file header's
// 2026-07-24 note) but BottomNav now owns a single shared pill spanning the whole bar, so this
// only measures its own track and renders plain NavTabItems.
function NavGroup({ items, isActive, onPress, label, styles, groupStyle, onTrack }: NavGroupProps) {
  const onLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    onTrack({ x, y, w: width, h: height });
  };

  return (
    <View style={groupStyle} onLayout={onLayout}>
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
    // Floating pill: app/(tabs)/_layout.tsx now insets this bar off the screen edges
    // (NAV_FLOAT_GAP), so an explicit rounded corner makes it read as a floating panel
    // rather than an edge-to-edge bar. Radius.lg matches the header's floated corner.
    // Top-left/top-right squared off (2026-07-24): the bar sits flush against the top of
    // its own floating slot (no gap above, per the "flush top" note above), so a rounded
    // top corner there just exposed a notch of the ambient backdrop between this bar and
    // whatever's above it — reading as a transparent gap rather than a seamless edge. Only
    // the bottom corners stay rounded for the floating-pill look. Requires Surface.tsx's
    // per-corner radius support (see its "Per-corner radius" edit note).
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
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
  // Shared full-bar pill (BottomNav) — absolutely positioned, translateX-animated to sit
  // behind whichever tab is active, wherever it is on the bar. width/height/top are set
  // inline per render from the measured tracks (see BottomNav's `pillTop`/`pillHeight`) —
  // `top: 0` here is only a pre-measurement fallback; only translateX/opacity are animated.
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
