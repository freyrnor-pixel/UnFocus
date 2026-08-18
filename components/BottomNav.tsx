/**
 * BottomNav.tsx — bottom navigation bar rendered as the swipeable pager's tab bar.
 *
 * **FLAT EQUALITY (2026-08-18) — read this before restoring anything below it.** Maintainer:
 * *"Do not use massive asymmetrical background circles for the active Bottom Nav icon…
 * Bottom nav icons should have equal visual weight; the active state should just be a filled
 * icon in the active color with no background shape."* So this bar is now three identical
 * slots — icon + label, same size, same box, same weight — and the ONLY thing that marks the
 * current one is the glyph itself: the filled Ionicons variant, drawn in that section's
 * categorical colour, with its label to match. Nothing is drawn behind it.
 *
 * Three whole mechanisms went with that ruling, and none of them comes back piecemeal:
 *   - **The sliding pill/ring** (one shared `Animated.View` translating between the measured
 *     slots, morphing width/height/radius, wearing a hue-derived plate and a rim gradient).
 *     It was the selection cue from 2026-07-24; it is a background shape, which is the thing
 *     that was forbidden. With it went the three measured tracks, the `innerW`/`innerH` probe,
 *     `PILL_INSET`/`PILL_GROW_*`/`HOME_RING`, `clampTop`/`clampLeft`/`homeFit`, and every
 *     shared value and `withTiming` in this file — the bar has no animation left at all,
 *     because there is nothing left to animate.
 *   - **The centre FAB.** Home was a 56px accent-filled circle with a `LinearGradient` rim
 *     (and, at various points, a shadow, a halo and a resting sink). "Equal visual weight"
 *     cannot survive one tab being a filled disc twice the size of its neighbours, so Home is
 *     an ordinary `NavTabItem` now, in its ordinary centre slot. `renderCentre` is gone.
 *   - **`glassSurfaces` branching inside the bar.** It only ever chose between the FAB's
 *     gradient rim and a flat accent fill; with no FAB and no gradient there is nothing for it
 *     to choose. The BAR itself still respects it — that lives in `Surface`.
 *
 * Primary usage is as app/(tabs)/_layout.tsx's `tabBar` render prop — react-navigation hands
 * it the pager's `state`/`navigation`, which this component uses both to know which tab is
 * active and to switch tabs (`navigation.navigate()`, which the pager animates as a native
 * slide). A standalone `<BottomNav />` (no props) mode is kept for any hypothetical site-tier
 * screen mounted outside the tabs group — it falls back to the pre-pager
 * usePathname()/goToSite() routing.
 *
 * Connections:
 *   Imports → @react-navigation/material-top-tabs (MaterialTopTabBarProps type), expo-router,
 *             constants/theme (HitSlop + the spacing/type tokens — no gradient, shadow or glow
 *             helper), constants/colors (ThemePalette, type-only), constants/motion (Travel),
 *             lib/i18n, lib/siteNav, lib/screenColor (getScreenColor — the active tab's
 *             category hue, see `navTabHue`), lib/useAppTheme (useAppTheme, useIsDark,
 *             useScaledStyles), components/PressableScale, components/Surface
 *   Used by → app/(tabs)/_layout.tsx (as the pager's tabBar); components/ScreenScaffold
 *             (standalone fallback via bottomNav=true — currently unused by any real screen)
 *   Data    → none (presentational; navigation only)
 *
 * Edit notes:
 *   - SITE_ITEMS (lib/siteNav.ts) defines the 3 items and their order (left to right):
 *     Handle, I dag, Meg (2026-08-20, the 5→3 merge; it was Shopping/Plans/Home/Habits/Health
 *     under Decision 036). To-do, Habits, Notes, Food/Meals and Automations are NOT tabs —
 *     they are reached from "I dag" and from Settings → Automations. **The bar no longer
 *     slices SITE_ITEMS into left/right groups around a centre button** — it maps the array
 *     once — so adding or reordering an item needs no index arithmetic here at all, which is
 *     why going from five slots to three needed no code change in this file.
 *   - ⚠️ **With three tabs the categorical hue is doing MORE work, not less.** It is still the
 *     only channel marking the active tab (see the flat-equality ruling above), and 'index'
 *     stopped being neutral in lib/screenColor.ts precisely so the middle tab has one — a
 *     neutral key falls back to `theme.accent` in `navTabHue`, which would put the app's one
 *     accent under the tab the user stands in most.
 *   - BOTTOM_NAV_HEIGHT is exported for screens needing to offset overlays. NAV_FLOAT_GAP is
 *     also exported — app/(tabs)/_layout.tsx (bar positioning) and ScreenScaffold
 *     (`pagerFloatingNav` content-clearance reserve) both need the exact same number or the
 *     floating bar and the scroll clearance reserved for it drift apart.
 *   - Active-tab detection: tab-bar mode reads `state.routes[state.index].name` and
 *     matches it against SITE_ITEMS via lib/siteNav.ts's TAB_ROUTE_NAME; standalone mode
 *     falls back to `usePathname() === item.route`.
 *   - `PressableScale`'s own default (`haptic=true`) already fires a light tap haptic on
 *     every press — no separate haptic call is needed here. `travel` keeps the ordinary
 *     momentary press sink; `sunk` is deliberately NOT passed (2026-08-12, maintainer:
 *     "Instead of the pressed down look, just have the blue move between when going between
 *     screens"). That ruling survives the flat-equality pass — what moves between screens is
 *     now the colour rather than a plate.
 *   - **Nothing in this bar carries grey depth or a halo**, and that predates this pass by a
 *     week: `getLayeredShadow` (2026-08-10, "a hue-less blur under a pale plate reads as a
 *     dirty donut"), `getGlow` (2026-08-11, "a 15px blur with 4px of clearance to a mask that
 *     clips can never fade out") and `Shadow.fab` (2026-08-11, "a grey collar, not a float")
 *     were each deleted on their own report. The bar is a Surface that already casts one
 *     shadow for the whole cluster; nothing inside it needs a second light source.
 *   - **The bar is OPAQUE as of 2026-08-20**, and that is what makes the corner rule below work.
 *     `surfaceContext="nav"` mounted a BlurView from 2026-08-15; it now falls under `Surface`'s
 *     `overlapsCards`, alongside `overlay`, because components/ScreenScaffold.tsx's clip window
 *     runs this bar's full height again and the app's own cards genuinely pass behind it. Frost
 *     over a moving card is that card read through the labels — the 2026-08-18 card-menu lesson,
 *     one surface further out. Don't put the frost back without moving the clip window with it.
 *   - **Every corner is `Radius.lg` as of 2026-08-20** (`bar`'s radii), matching the header card
 *     at the other end of the screen. The top pair was square for one day (2026-08-19), while
 *     content was clipped flush against that edge; with content passing behind the bar again, the
 *     top-corner notches are where a scrolled card shows through, which is exactly what the
 *     maintainer asked for. Keep this in step with `ScreenScaffold`'s header radii.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useT } from '@/lib/i18n';
import { Fonts, FontSize, Radius, Spacing, HitSlop } from '@/constants/theme';
import { getScreenColor } from '@/lib/screenColor';
import type { ThemePalette } from '@/constants/colors';
import { Travel } from '@/constants/motion';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { goToSite, SITE_ITEMS, SiteItem, TAB_ROUTE_NAME } from '@/lib/siteNav';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';

export const BOTTOM_NAV_HEIGHT = 72;
// Float gap for the bottom-nav bar: left/right margin AND a matching gap below (on top of the
// safe-area inset) so the bar's rounded corners read as a floating panel — shared between
// app/(tabs)/_layout.tsx (which positions the real bar) and ScreenScaffold (which reserves
// scroll-content clearance for it) so the two can never drift apart.
export const NAV_FLOAT_GAP = Spacing.sm;

type Props = Partial<Pick<MaterialTopTabBarProps, 'state' | 'navigation'>>;

export default function BottomNav({ state, navigation }: Props = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

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

  return (
    <Surface surfaceContext="nav" style={styles.bar}>
      {SITE_ITEMS.map((item) => (
        <NavTabItem
          key={item.key}
          item={item}
          label={t.nav[item.key]}
          active={isActive(item)}
          onPress={() => handlePress(item)}
          styles={styles}
        />
      ))}
    </Surface>
  );
}

/**
 * The colour an active nav tab wears — its own CATEGORY's, in dark mode (2026-08-16, brief §7).
 *
 * *"When rendering an icon, a badge, or the glowing shadow of a button associated with a
 * specific category, you MUST use its mapped categorical color."* A nav tab is the most literal
 * case of that in the app — it IS the category — and it is now the ONLY channel the bar has:
 * with the plate gone (see the file header), a filled glyph in this hue is the whole selection
 * cue. That makes the hue load-bearing rather than decorative; don't collapse it back to a
 * single accent.
 *
 * Resolved through `lib/screenColor.ts` rather than from a table here, so a tab and the screen
 * it opens can never disagree: `SiteItem.route` is already the screen key that module is keyed
 * by.
 *
 * ⚠️ **DARK MODE ONLY, and that is measured rather than squeamish.** The five categoricals are
 * neon values chosen to glow on black; light mode keeps the 2026-08-10 "cinematic" `feat*`
 * octet, which is a set of MID-TONES that read as muddy on the nav's light glass. In light
 * mode this returns the accent and every active tab is accent-blue, as it always was.
 *
 * Home has no identity hue (`getScreenColor` reports `neutral`) and takes the accent in both
 * modes.
 */
function navTabHue(theme: ThemePalette, isDark: boolean, item: SiteItem | undefined): string {
  if (!isDark || !item) return theme.accent;
  const hue = getScreenColor(theme, item.route.replace('/', '') || 'index');
  return hue.neutral ? theme.accent : hue.base;
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
  const isDark = useIsDark();
  // The one difference between an active tab and an inactive one: a FILLED glyph in the
  // section's colour versus an outline glyph in muted ink. No plate, no ring, no fill, no
  // size change — "equal visual weight" is the point of the whole bar.
  const tint = active ? navTabHue(theme, isDark, item) : theme.textMuted;

  return (
    <PressableScale
      scaleTo={0.97}
      travel={Travel.sm}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.item}
      onPress={onPress}
      hitSlop={HitSlop.snug}
    >
      <Ionicons name={active ? item.activeIcon : item.icon} size={22} color={tint} />
      <Text
        style={[styles.label, { color: tint }]}
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
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    // No `gap` and no `justifyContent` (2026-08-18): every slot is `flex: 1`, so the five
    // divide the bar evenly by construction. The old bar needed both because it was three
    // children of unequal width (two flex groups around a fixed 56px FAB) — and the gap was
    // itself a bug source, since the raw `Spacing.sm` token disagreed with the scaled one the
    // group actually rendered (2026-08-13).
    // **All four corners are rounded (2026-08-20), reversing the 2026-08-19 square top pair.**
    // Maintainer: *"both header card and bottom nav should only have rounded corners. And yes,
    // the corners should show content behind it, no gaps like has been before."* The top pair was
    // squared while components/ScreenScaffold.tsx clipped the scroll content flush against this
    // edge — a rounded edge cannot be met flush by a cut. The clip window runs the bar's full
    // height again (the bar is opaque now, so content behind it is hidden rather than showing
    // through), so nothing is cut here: a card slides UNDER the bar and fills the two top-corner
    // notches on the way. Bare backdrop in those notches is the "gap"; a card in them is depth.
    borderRadius: Radius.lg,
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
  label: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
  },
});
