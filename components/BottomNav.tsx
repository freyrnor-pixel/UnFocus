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
 *   - BOTTOM_NAV_HEIGHT is exported for screens needing to offset overlays. NAV_FLOAT_GAP is
 *     also exported — app/(tabs)/_layout.tsx (bar positioning) and ScreenScaffold
 *     (`pagerFloatingNav` content-clearance reserve) both need the exact same number or the
 *     floating bar and the scroll clearance reserved for it drift apart. (`NAV_PEEK` was a third
 *     export here 2026-07-26 through 2026-08-10 — deleted, then reasoned about again without
 *     being restored; see this file's own `NAV_PEEK` history note below for why.)
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
 *     left track, 3/4 → right track) to that x. Side ↔ side moves — same
 *     group OR across groups — are a single translateX between two real slot x values, so they
 *     read as one continuous slide no matter how far apart the two tabs are. `Duration.tabSwitch`
 *     (200ms, ANIMATION_GUIDELINES §1 "Tab switch") replaces the old `Duration.control` (150ms,
 *     meant for toggles/segmented controls, not full nav-tab travel) now that a single pill may
 *     need to cover up to the whole bar's width instead of just one group's. `firstRunRef` is
 *     the same cold-launch guard the old per-group code used, centralized to one pill.
 *   - **Home is a real pill slot now (2026-08-10) — supersedes the entry/exit fade.** Home used
 *     to be index 2 with no pill of its own: selecting it slid the pill to the centre button's
 *     x, faded `pillOpacity` to 0 and then UNMOUNTED it, which the maintainer reported as
 *     "weird look when the blue square goes to home as it just disappears". The pill now has a
 *     fifth target — a circle grown `PILL_GROW_X` beyond the 56px FAB on every side, so an
 *     `accentSoft` ring frames the Home button the way the rounded rect frames a side tab's
 *     icon+label. `width`/`height`/`borderRadius` animate alongside `translateX`/`translateY`
 *     over the same `Duration.tabSwitch`, so the move is one continuous shape change. There is
 *     no opacity, no mount/unmount and no `settledRef` any more — the pill exists from first
 *     layout onward and always sits on the selected tab. Adding a sixth slot means adding a
 *     branch to the one `target` object in that effect, not a second animation path.
 *   - **Both axes are translate.** `pill`'s `top`/`left` stay 0 and the measured y goes through
 *     `translateY`, because Home and a side tab sit at different heights — animating `top`
 *     would be a layout write per frame, and mixing a static `top` with an animated one was
 *     what made the two slots impossible to tween in the first place.
 *   - **The pill has to FIT IN THE BAR, and is clamped to it (2026-08-10 follow-up).** The bar
 *     is a `Surface`, which clips its children to its own rounded mask, so a pill bigger than
 *     the bar renders SLICED rather than overflowing. Both slots were: Home's ring was
 *     `56 + PILL_GROW_X * 2` = 72 in a 72px-tall bar (a flattened squircle, reported as the
 *     "visual bug where bottom nav blue is"), and a side pill's bottom corner ran into the
 *     bar's own `Radius.lg` corner arc on the outermost tab and came out cut diagonally.
 *     `PILL_INSET` + `clampTop()` keep both inside; `homeSize`/`pillHeight` shrink to fit
 *     rather than the grow constants being fixed. **Clamp against the MEASURED `barH`
 *     (`Surface`'s new `onLayout`), never `BOTTOM_NAV_HEIGHT`** — this bar runs through
 *     `useScaledStyles`, so the constant is only true at font scale 1.0.
 *   - **The pill carries the accent glow and NO layered shadow (2026-08-10 follow-up).** It
 *     used to concatenate `getLayeredShadow(theme.shadow, 'raised')` under the glow (see the
 *     2026-07-18 "Purposeful glow" note below, which this supersedes). A card drop-shadow is a
 *     grey hue-less blur; under a pale `accentSoft` plate it read as a dirty grey donut, and on
 *     Home it stacked with the FAB's own `Shadow.fab` so the blue button wore two smudges. An
 *     indicator drawn BEHIND a tab, inside a bar that already casts a shadow for both, has
 *     nothing to be raised off — don't re-add depth here.
 *   - **The pill sits under a SUNK item, so it is offset by `Travel.*`.** An active tab rests
 *     at the bottom of its key travel (`sunk={active}`), but the tracks are measured unsunk —
 *     without `+ Travel.sm` (side) / `+ Travel.md` (Home) the pill frames the icon with ~6px
 *     above and ~0 below. Same class of bug as the 2026-07-24 one below, on the content side.
 *   - **(Historical) Pill vertically misaligned (fixed, 2026-07-24 follow-up)**: `pill`'s `top` was
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
 *   - **Keycap bevel ring (2026-07-21)**: a flat single-tone BORDER (`borderWidth`/`borderColor`,
 *     a plain outline) was tried on the tab boxes and reverted the same day ("Border dropped..."
 *     note above) for reading too punchy. This is a different technique — the same rim bevel
 *     (`computeRimGradient` — also flat/single-tone as of 2026-08-05, but as a filled edge
 *     ring, not an outline; was light-top/dark-bottom before that) Button.tsx/Surface.tsx
 *     already use — gated behind
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
 *   - **Pill grown beyond the item's own box, radius matched to the bar (2026-07-25)**: the pill's
 *     width/height used to equal the active item's measured box exactly (`segW` / track height),
 *     so the icon+label sat flush against the pill's edges with no breathing room — user report,
 *     screenshot ("selected" box read as shrink-wrapped). `PILL_GROW_X`/`PILL_GROW_Y` now pad the
 *     rendered pill outward on all sides, with `slotX()`/`pillTop` shifted by half the growth so
 *     it stays centred on the same spot rather than only growing rightward/downward — the item's
 *     own hit box and the other (inactive) tabs are untouched. Corner radius bumped `Radius.md` →
 *     `Radius.lg` to match the outer floating bar's own corner radius (see `baseStyles.bar`) so
 *     the selected box's shape echoes its container instead of a smaller, tighter curve.
 *   - **Bar uses `surfaceContext="nav"`, not `"overlay"` (2026-07-27) — but the distinction is
 *     now historical (corrected 2026-08-08).** The original reason was real: `overlay` blurred
 *     live content with true translucency, which was fine for something on screen briefly but
 *     meant cards and text visibly bled through this bar as the user scrolled (user report,
 *     screenshot), so `"nav"` pushed the wash near-opaque and skipped the BlurView. **None of
 *     that machinery exists after the 2026-08-05 card reset** — every Surface is flat and opaque
 *     in every context, so all three values render identically and nothing can bleed through.
 *     The value is kept because it still records what this surface IS; it is not doing work.
 *   - **Centre FAB has no keyBase, unlike Button.tsx/IconButton.tsx (tried 2026-08-05, reverted
 *     same day)**: a `keyBase` slab was added behind it briefly, but a permanently-visible
 *     darker ring under a circle reads as "already sitting in a socket," not "raised" — the
 *     opposite of the intended cue. The FAB keeps its plain `Shadow.fab` drop-shadow only, which
 *     is what reads as popped-out/floating here. `NavTabItem` below never had a keyBase either
 *     (no fill to build one from — see its own note).
 *   - **...and that drop shadow is dropped while Home is ACTIVE (2026-08-10 follow-up).**
 *     `Shadow.fab` is a 16px black blur; the pill's ring around this button is a few px wide,
 *     so the blur smeared across it and turned the `accentSoft` ring into a grey donut. An
 *     active tab also rests sunk, and a key at the bottom of its travel shouldn't float. See
 *     the call site's own note before restoring it unconditionally.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useT } from '@/lib/i18n';
import { Fonts, FontSize, Radius, Spacing, Shadow, getGlow, computeRimGradient, HitSlop } from '@/constants/theme';
import { Duration, Ease, Travel } from '@/constants/motion';
import { useAccessibility, useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { goToSite, SITE_ITEMS, SiteItem, TAB_ROUTE_NAME } from '@/lib/siteNav';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';

export const BOTTOM_NAV_HEIGHT = 72;
// Float gap for the bottom-nav bar: left/right margin AND a matching gap below (on top of the
// safe-area inset) so the bar's rounded corners read as a floating panel — shared between
// app/(tabs)/_layout.tsx (which positions the real bar) and ScreenScaffold (which reserves
// scroll-content clearance for it) so the two can never drift apart.
export const NAV_FLOAT_GAP = Spacing.sm;
// `NAV_PEEK` lived here until 2026-08-10. It shaved Radius.lg (24px) off the scroll-content
// clearance so the last card's edge rose into the transparent notch inside the bar's rounded
// top corners — added 2026-07-26 on the request "make the blank area around the bar
// transparent, and let a scrolled card show through the corners".
//   **That was reversed the same day** by the opposite request: "Nothing should be visible
// (cards, text, buttons and so on) above the header, or under the bottom nav." — and then
// reversed BACK, partially, the same day again: "when cards slide behind the bottom nav, they
// should be visible in the bottom nav's cut corners at the top, not the two bottom ones — same
// for the header but the opposite." The peek is real and wanted; `NAV_PEEK` the CONSTANT isn't
// coming back, because a fixed px shave was never the right mechanism — it only ever worked at
// one font scale and one specific bar height. components/ScreenScaffold.tsx's clip viewport now
// gets it for free: its own corners are square (never rounded to match this bar's or the
// header's), so a scrolled card is clipped by a plain rectangle and is free to fill the wedge
// beside THIS bar's rounded top-left/top-right corners — and, by the same mechanism, the
// header's rounded bottom-left/bottom-right corners. The side margins and top/bottom bands are
// still fully closed (that was never what the radius was doing — see that file's own note).
const EDGE_WIDTH = 1.5;
const ITEMS_PER_SIDE = 2;
// The smallest gap the pill keeps from the bar's own painted edge (2026-08-10 follow-up, user
// report + screenshots: "visual bug where bottom nav blue is").
//
// The bar is `Surface`, and a Surface CLIPS its children to its rounded mask — so a pill that
// doesn't fit inside it isn't drawn overflowing, it is drawn SLICED. Both slots were doing
// exactly that: Home's ring was `56 + PILL_GROW_X * 2` = 72 tall inside a bar whose painted
// height is also 72, so the circle came out flattened top and bottom into a squircle with a
// grey rim; and a side pill (56 + PILL_GROW_Y = 62, pushed down again by `Travel.sm`) landed
// 2px off the bottom, which put the OUTERMOST tab's pill corner inside the bar's own
// `Radius.lg` corner arc and cut it off diagonally.
//
// Clamping is done against the bar's MEASURED height rather than `BOTTOM_NAV_HEIGHT`, because
// `useScaledStyles` scales this bar's padding with the OS text-size setting — the constant is
// only true at 1.0x, and at 1.4x the arithmetic that "just fits" here would be wrong again.
//
// **That first pass only clamped the vertical axis (2026-08-10, same-day follow-up, user
// report: "should always be a rounded box, not the clipped thing you see — it only happens
// sometimes").** The diagnosis above already named the real shape of the bug — an outermost
// tab's pill corner sitting inside the bar's own Radius.lg corner ARC, a two-axis problem — but
// the fix only added `clampTop`/`maxPillH`. Shop and Health's pills sit close enough
// horizontally to the bar's rounded left/right edges that a font-scale- or measurement-
// dependent few px could still push a corner into that arc; the more central tabs never come
// close, which is why it read as intermittent rather than every time. `clampLeft` (mirrors
// `clampTop`, uses the bar's MEASURED width — `barW`, same reasoning as `barH`) closes the
// other axis the same way.
const PILL_INSET = 4;
// The pill is drawn slightly larger than the tab item's own measured box (grown outward,
// centred on the same spot) so the active tab reads as a roomier card instead of shrink-wrapping
// the icon+label — the icon/label stay put (centred in their own tight flex box), so this extra
// margin shows up as breathing room between them and the pill's edge, not a layout shift.
const PILL_GROW_X = 8;
const PILL_GROW_Y = 6;

// The pill's corner radius animates (rounded rect on a side tab, full circle on Home), and the
// rim gradient has to take the same corner — so the gradient itself needs an animated style.
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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
  // The bar's own painted box — what the pill has to stay inside of. See PILL_INSET. Both
  // dimensions are measured (not read off BOTTOM_NAV_HEIGHT/a fixed width) because this bar
  // runs through useScaledStyles, so its painted size shifts with the OS text-size setting.
  const [barH, setBarH] = useState(0);
  const [barW, setBarW] = useState(0);

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
  const ready = leftTrack.w > 0 && rightTrack.w > 0 && centreTrack.w > 0 && segW > 0 && barH > 0 && barW > 0;

  // The tallest/widest a pill may be, and where it may sit, so it never reaches the bar's
  // mask. Both slots go through these — see PILL_INSET for what was being sliced before.
  const maxPillH = Math.max(0, barH - PILL_INSET * 2);
  const clampTop = (top: number, h: number) =>
    Math.min(Math.max(top, PILL_INSET), Math.max(PILL_INSET, barH - PILL_INSET - h));
  // Horizontal counterpart of clampTop (2026-08-10 follow-up, user report: "should always be
  // a rounded box, not the clipped thing you see — it only happens sometimes"). Only the
  // OUTERMOST side tabs (Shop, Health) sit close enough to the bar's own rounded corners for
  // this to matter — a pill that grows PILL_GROW_X past its item's own box can push its
  // rounded-rect corner into the diagonal cut the bar's Surface mask carves out of ITS corner,
  // same failure mode PILL_INSET already fixed on the vertical axis. Margin-dependent, so it
  // doesn't reproduce reliably at every font scale/measurement — "sometimes" — which is why it
  // survived the vertical-only fix.
  const clampLeft = (left: number, w: number) =>
    Math.min(Math.max(left, PILL_INSET), Math.max(PILL_INSET, barW - PILL_INSET - w));

  // Maps a SITE_ITEMS index to the pill's target x (relative to the bar's content box).
  // Offset left by half of PILL_GROW_X so the (wider) pill stays centred on the item's own box
  // instead of the extra width only ever growing rightward, then clamped into the bar exactly
  // like the vertical position/height are (see clampLeft above).
  function slotX(index: number): number {
    const w = segW + PILL_GROW_X;
    if (index === 0 || index === 1) return clampLeft(leftTrack.x + index * (segW + gap) - PILL_GROW_X / 2, w);
    if (index === 3 || index === 4) return clampLeft(rightTrack.x + (index - 3) * (segW + gap) - PILL_GROW_X / 2, w);
    // index === 2 (Home) — no pill ever sits here; this is only the entry/exit anchor.
    return centreTrack.x + (centreTrack.w - segW) / 2 - PILL_GROW_X / 2;
  }

  // The pill is `position:absolute` against the bar's own content box, which ignores that
  // box's `paddingVertical` (2026-07-24 bug: "blue [pill] around the buttons is not
  // centered") — the tab items themselves are flow children, so THEY sit shifted down by
  // that padding, but the pill's old hardcoded `top:0` never accounted for it, leaving the
  // pill's top edge floating above the icon and its bottom edge cutting into the label
  // instead of framing the button. Use the real measured y (same fix pattern as the x-based
  // translateX) instead of assuming the pill's container has no padding. Shifted up by half
  // of PILL_GROW_Y to keep the (taller) pill centred on the item's own box, then back DOWN by
  // the item's own `travel` — the pill only ever sits under the ACTIVE tab, and an active tab
  // rests sunk (`sunk={active}`, see NavTabItem), so a pill positioned from the unsunk
  // measured track framed the icon with ~6px above and ~0 below. Same class of bug as the
  // 2026-07-24 one, on the content side instead of the pill side.
  //   Both dimensions are then clamped into the bar (2026-08-10 follow-up) — the grown pill
  // was taller than the space between the bar's padding edges, so the mask cut its bottom off
  // and, on the outermost tab, its bottom corner as well.
  const pillHeight = Math.min((leftTrack.h || rightTrack.h) + PILL_GROW_Y, maxPillH);
  const sideTop = clampTop((leftTrack.y || rightTrack.y) - PILL_GROW_Y / 2 + Travel.sm, pillHeight);
  // Home's slot (2026-08-10). Home used to have NO pill: the pill slid to the centre button's
  // x, faded to 0 and unmounted, so selecting Home read as the indicator "just disappearing"
  // (maintainer report). It is a real slot now — a circle grown PILL_GROW_X beyond the 56px
  // FAB on every side, so an accentSoft ring shows around the Home button exactly the way the
  // pill shows around a side tab's icon+label. The indicator therefore always exists and
  // always travels to the selected tab; there is no enter/exit, no opacity and no unmount.
  // The ring is centred on the FAB and clamped to the bar, so it is a whole circle rather than
  // the flattened squircle a 72px ring became inside a 72px bar (see PILL_INSET). The grow is
  // therefore what FITS, not a fixed 8 on every side.
  const homeSize = Math.min(centreTrack.w + PILL_GROW_X * 2, maxPillH);
  const homeTop = clampTop(centreTrack.y - (homeSize - centreTrack.h) / 2 + Travel.md, homeSize);
  const homeX = centreTrack.x - (homeSize - centreTrack.w) / 2;

  // Every dimension the pill morphs between. Width/height/radius animate alongside x/y, so a
  // side tab -> Home move is one continuous shape change rather than a fade-out.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const pw = useSharedValue(0);
  const ph = useSharedValue(0);
  const pr = useSharedValue(Radius.lg);
  // True until the first layout-ready effect run — a cold launch/deep-link lands on its slot
  // with no travel; every later change animates.
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (!ready) return;
    const snap = firstRunRef.current || reducedMotion;
    firstRunRef.current = false;

    const target = isHomeActive
      ? { x: homeX, y: homeTop, w: homeSize, h: homeSize, r: homeSize / 2 }
      : { x: slotX(activeIndex), y: sideTop, w: segW + PILL_GROW_X, h: pillHeight, r: Radius.lg };

    const to = (value: number) =>
      snap ? value : withTiming(value, { duration: Duration.tabSwitch, easing: Ease.move });
    tx.value = to(target.x);
    ty.value = to(target.y);
    pw.value = to(target.w);
    ph.value = to(target.h);
    pr.value = to(target.r);
  }, [
    ready, activeIndex, isHomeActive, segW, pillHeight, sideTop,
    homeX, homeTop, homeSize, leftTrack.x, rightTrack.x, centreTrack.x, barW,
    reducedMotion, tx, ty, pw, ph, pr,
  ]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    width: pw.value,
    height: ph.value,
  }));
  // The rim gradient and the fill each need the same corner, and both morph — hence two more
  // animated styles rather than a static Radius.lg.
  const pillRadiusStyle = useAnimatedStyle(() => ({ borderRadius: pr.value }));
  const pillInnerRadiusStyle = useAnimatedStyle(() => ({ borderRadius: Math.max(0, pr.value - EDGE_WIDTH) }));

  // The pill marks whichever tab is active, all five of them, so its rim is always accent-hued.
  const rim = computeRimGradient(theme.accent, isDark);
  // Accent glow only — **no `getLayeredShadow`** (2026-08-10 follow-up, same user report as
  // PILL_INSET). A card's drop shadow is a grey, hue-less blur, and stacking one under a pale
  // `accentSoft` plate rendered it as a dirty grey donut around the fill rather than as depth
  // — worst on Home, where it also sat on top of the FAB's own `Shadow.fab`, so the blue
  // button ended up ringed by two overlapping smudges. The pill is an INDICATOR drawn behind a
  // tab, inside a bar that already casts the shadow for both of them; it has nothing to be
  // raised off. The soft accent glow is hue-tinted, so it reads as light rather than as grime.
  const pillShadow = getGlow(theme.accent, 'soft').boxShadow;

  const renderCentre = (item: SiteItem) => {
    const active = isActive(item);
    const icon = <Ionicons name={active ? item.activeIcon : item.icon} size={24} color={theme.accentInk} />;
    const centreRim = computeRimGradient(theme.accent, isDark);
    return (
      <PressableScale
        key={item.key}
        scaleTo={0.90}
        travel={Travel.md}
        // "Pressed = on", same as every side tab (2026-08-10). Home took `travel` but never
        // `sunk`, so it was the one tab with no resting depth cue — it sank on the tap and
        // came straight back up, which alongside the vanishing pill left Home looking like
        // the tab that never registers as selected.
        sunk={active}
        accessibilityRole="button"
        accessibilityLabel={t.nav[item.key]}
        accessibilityState={{ selected: active }}
        // No drop shadow while Home is ACTIVE (2026-08-10 follow-up). `Shadow.fab` is a 16px
        // black blur at 22%, and the pill's ring around this button is only a few px wide —
        // the blur smeared straight across it, so the pale `accentSoft` ring came out as a
        // grey donut and the blue button looked smudged rather than selected. It is also the
        // right call semantically: an active tab rests SUNK (`sunk={active}` below), and a key
        // sitting at the bottom of its travel has no business casting a floating shadow. The
        // ring is the depth cue in that state; the shadow comes back the moment Home is not
        // the selected tab.
        style={[styles.centreButton, active ? null : Shadow.fab, glass ? null : { backgroundColor: theme.accent }]}
        onPress={() => handlePress(item)}
        onLayout={(e: LayoutChangeEvent) => {
          const { x, y, width, height } = e.nativeEvent.layout;
          setCentreTrack((prev) =>
            prev.x === x && prev.y === y && prev.w === width && prev.h === height ? prev : { x, y, w: width, h: height }
          );
        }}
        hitSlop={HitSlop.base}
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
    <Surface
      surfaceContext="nav"
      style={styles.bar}
      // The pill is clamped inside this box, so the box has to be measured — `useScaledStyles`
      // scales the bar's padding with the OS text size, which makes BOTTOM_NAV_HEIGHT true only
      // at 1.0x. See PILL_INSET.
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setBarH((prev) => (prev === height ? prev : height));
        setBarW((prev) => (prev === width ? prev : width));
      }}
    >
      {ready && (
        <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]}>
          {glass ? (
            <AnimatedLinearGradient
              colors={rim.colors}
              locations={rim.locations}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[{ flex: 1, padding: EDGE_WIDTH }, pillRadiusStyle]}
            >
              <Animated.View style={[{ flex: 1, backgroundColor: theme.accentSoft, boxShadow: pillShadow }, pillInnerRadiusStyle]} />
            </AnimatedLinearGradient>
          ) : (
            <Animated.View style={[{ flex: 1, backgroundColor: theme.accentSoft, boxShadow: pillShadow }, pillRadiusStyle]} />
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
      // "Pressed = on" (design-system v6, 2026-07-28): the ACTIVE tab rests sunk into the
      // bar. The sliding pill already marks the current tab by colour and position; the
      // travel adds the one channel neither of those covers — depth — so the current tab is
      // still obvious in greyscale and under glare.
      travel={Travel.sm}
      sunk={active}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.item}
      onPress={onPress}
      hitSlop={HitSlop.snug}
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
    // Floating pill: app/(tabs)/_layout.tsx insets this bar off the screen edges (NAV_FLOAT_GAP
    // on left/right/bottom — flush top, see that file's edit notes) so an explicit rounded
    // corner makes it read as a floating panel rather than an edge-to-edge bar. Radius.lg
    // matches the header's floated corner. All four corners rounded (2026-07-25, user report,
    // supersedes the 2026-07-24 "flush top / square top corners" pass below) — a rounded top
    // edge, even flush against the top of its slot with zero gap, keeps the fill from painting
    // into the corner notch, instead of the old square top making content look like it
    // "disappeared into thin air" as it scrolled under the bar's hard rectangular silhouette.
    // A same-day follow-up ALSO tried adding a real gap above the bar (matching the header's
    // treatment) so the notch would reveal more than a sliver — that grew the wrapper's real
    // footprint and covered MORE of the last scrolled card on a real device (the web preview
    // didn't reproduce it — a native-only fidelity gap, see app/(tabs)/_layout.tsx's revert
    // note) and was reverted the same day. Corners stay rounded; the footprint did not grow.
    // Requires Surface.tsx's per-corner radius support (see its "Per-corner radius" edit note).
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
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
    // Both axes are driven by translate (see the pillTop/homeTop derivation), so the static
    // origin is the bar's own content box corner and never a measured value.
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
