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
 *             sliding pill), expo-router, constants/theme (computeRimGradient, HitSlop and the
 *             spacing/type tokens — no shadow or glow helper: see the 2026-08-11 bullet),
 *             constants/motion
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
 *     fifth target — a `HOME_RING`-wide `accentSoft` ring around the 56px FAB, so Home is
 *     framed the way the rounded rect frames a side tab's icon+label.
 *     `width`/`height`/`borderRadius` animate alongside `translateX`/`translateY`
 *     over the same `Duration.tabSwitch`, so the move is one continuous shape change. There is
 *     no opacity, no mount/unmount and no `settledRef` any more — the pill exists from first
 *     layout onward and always sits on the selected tab. Adding a sixth slot means adding a
 *     branch to the one `target` object in that effect, not a second animation path.
 *   - **The Home slot is sized from the ring outward, and the FAB does not rest sunk
 *     (2026-08-11, user report + screenshots: "look at the bottom nav home button").** Three
 *     things were fighting over 8px of slack — a 56px FAB inside a 72px masked box — and the
 *     result was a lopsided pale blob with a sliced halo rather than a ring:
 *     (a) the ring asked for `56 + PILL_GROW_X * 2` = 72, the full height of the bar, so what
 *     drew was a plate, not a frame, and its accent glow was cut flat top and bottom by the
 *     mask; (b) `clampTop` then had a legal range of exactly one value and pinned it 1px off
 *     that mask; (c) `sunk={active}` sat the FAB 4px lower than the ring, leaving 8px of ring
 *     above the button and 3px below. The fix reverses the order — `HOME_RING` decides the
 *     width, the ring is centred on the button, and only then is it capped by `homeFit` — and
 *     drops the resting sink, which is what frees the 4px the bottom half of the ring needs.
 *     See `HOME_RING` and `renderCentre`'s own notes; don't restore either half alone.
 *   - **A sunk side tab now sits in a visible "socket" (2026-08-11, user report + screenshot:
 *     "does not look like a button pressed down, it just looks like the box and icon has been
 *     lowered vertically").** The active tab's icon/label (`sunk={active}` on its own
 *     `PressableScale`) and this pill's fill were both already positioned at the FINAL sunk
 *     offset with nothing left at the unsunk position to contrast against, so the only visible
 *     effect was a uniform downward shift — no depth cue. `pillBaseStyle` adds the same
 *     "cap on a base" idiom `Button.tsx`'s `keyBase` already uses: a static
 *     `darken(accentSoft, 0.22)` plate fixed `Travel.sm` px above the pill's own top, sharing
 *     its bottom edge exactly (both end at `ty.value + ph.value`) — so only a `Travel.sm`
 *     sliver of the darker plate ever shows, above the fill, reading as the wall of a shallow
 *     notch rather than an unexplained shift. Faded to 0 (via the `bo` shared value, driven by
 *     the same effect and duration as `tx`/`ty`/etc.) while Home is active — Home gets its own,
 *     differently-shaped recessed cue instead (a concentric halo ring, not a directional
 *     sliver), since its FAB can't sink without shrinking the selection ring itself. See the
 *     next bullet.
 *   - **Home gets a "recessed" cue too, but a ring, not a sink (2026-08-11, same-day follow-up,
 *     user: "should also look pressed down, which none of them do now").** The "does not rest
 *     sunk" bullet two above isn't wrong — `sunk={active}` genuinely can't come back on the FAB
 *     itself: `HOME_RING` already spends every px of slack the masked bar has around the 56px
 *     button (by construction, see `HOME_RING`'s own note), so any resting downward offset
 *     immediately shrinks the ring that reads as Home's selection cue (a `homeCentreY` shift of
 *     N px costs `homeFit` 2N, since the fit is bounded by whichever side of the bar is
 *     tighter) — confirmed by re-doing the arithmetic before ruling motion out again, not just
 *     re-asserted from memory. Instead, Home borrows the SAME `pillBaseColor` idiom the side
 *     tabs' socket plate uses, but applies it RADIALLY instead of vertically: `HOME_HALO_PAD`
 *     draws a second, concentric ring — the same shape as the real one (its radius tracks `pr`,
 *     not a fixed constant, so it stays matched through the whole tab-switch morph), grown
 *     `HOME_HALO_PAD` px outward on every side with no offset — visible only while Home is
 *     active (`ho`, faded the same way `bo` fades the side tabs' socket). No `homeCentreY`/
 *     `homeFit`/`HOME_RING` arithmetic changes at all; this is a purely additive layer.
 *   - **Nothing in this bar carries grey depth any more (2026-08-11).** The pill lost
 *     `getLayeredShadow` on 2026-08-10, and the centre FAB has now lost `Shadow.fab` in BOTH
 *     states for the same reason: a hue-less 16px black blur around a 56px circle on a white
 *     bar reads as a dirty grey collar, not as a floating button (that is what the report's
 *     inactive-Home screenshot shows). The bar is a Surface and already casts one shadow for
 *     the whole cluster. The accent glow on the pill is hue-tinted and stays.
 *   - **Both axes are translate.** `pill`'s `top`/`left` stay 0 and the measured y goes through
 *     `translateY`, because Home and a side tab sit at different heights — animating `top`
 *     would be a layout write per frame, and mixing a static `top` with an animated one was
 *     what made the two slots impossible to tween in the first place.
 *   - **The pill has to FIT IN THE BAR (2026-08-10 follow-up).** The bar is a `Surface`, which
 *     clips its children to its own rounded mask, so a pill bigger than the bar renders SLICED
 *     rather than overflowing. Both slots were: Home's ring was `56 + PILL_GROW_X * 2` = 72 in
 *     a 72px-tall bar (a flattened squircle, reported as the "visual bug where bottom nav blue
 *     is"), and a side pill's bottom corner ran into the bar's own `Radius.lg` corner arc on
 *     the outermost tab and came out cut diagonally. `PILL_INSET` + `clampTop()`/`clampLeft()`
 *     keep the SIDE pill inside; Home is fitted by construction instead (see the 2026-08-11
 *     bullet above — a clamp can only shove, and shoving is what put the ring off its button).
 *     **Measure the box the pill actually lives in, never `BOTTOM_NAV_HEIGHT` and never the
 *     `Surface`'s own outer box** — this bar runs through `useScaledStyles`, so the constant is
 *     only true at font scale 1.0, and Surface's outer view is `2 × BORDER_WIDTH.card` bigger
 *     than the mask that clips. `innerH`/`innerW` come from an `absoluteFill` probe rendered
 *     as a sibling of the pill, which is the one measurement that cannot disagree with it.
 *   - **(Superseded 2026-08-11 — the glow went too; see the "no grey depth" bullet above) The
 *     pill carries the accent glow and NO layered shadow (2026-08-10 follow-up).** It
 *     used to concatenate `getLayeredShadow(theme.shadow, 'raised')` under the glow (see the
 *     2026-07-18 "Purposeful glow" note below, which this supersedes). A card drop-shadow is a
 *     grey hue-less blur; under a pale `accentSoft` plate it read as a dirty grey donut, and on
 *     Home it stacked with the FAB's own `Shadow.fab` so the blue button wore two smudges. An
 *     indicator drawn BEHIND a tab, inside a bar that already casts a shadow for both, has
 *     nothing to be raised off — don't re-add depth here.
 *   - **A side pill sits under a SUNK item, so it is offset by `Travel.sm`.** An active side tab
 *     rests at the bottom of its key travel (`sunk={active}`), but the tracks are measured
 *     unsunk — without `+ Travel.sm` the pill frames the icon with ~6px above and ~0 below.
 *     Same class of bug as the 2026-07-24 one below, on the content side. **Home carries no
 *     such offset since 2026-08-11**, because its button no longer rests sunk — if you ever
 *     restore `sunk` there, `homeCentreY` has to gain the `+ Travel.md` back and the ring will
 *     no longer fit; read the 2026-08-11 bullet above first.
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
 *   - **(Historical, REMOVED 2026-08-11 — see the "no grey depth" bullet above) Purposeful glow
 *     (2026-07-18, optional per design pass)**: the active tab's pill added
 *     `getGlow(theme.accent, 'soft')` on top of its fill. A glow is a 15px and a 27px blur and
 *     this pill has 4px of clearance to a mask that clips, so it was always drawn cut off flat
 *     rather than fading out — a second, harder edge a few px outside the real one. Nothing in
 *     this bar carries a halo now.
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
 *     opposite of the intended cue. `NavTabItem` below never had a keyBase either (no fill to
 *     build one from — see its own note).
 *   - **...and the FAB's drop shadow went with it (2026-08-10 while active, 2026-08-11
 *     entirely).** `Shadow.fab` is a 16px black blur: over the ring it smeared the pale
 *     `accentSoft` into a grey donut, and with no ring under it (Home not selected) it drew a
 *     grey collar around the blue circle instead — the second half of the same user report.
 *     A FAB shadow is for a button floating over CONTENT; this one sits inside a bar that
 *     casts its own. See the call site's note before restoring it in either state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useT } from '@/lib/i18n';
import { Fonts, FontSize, Radius, Spacing, computeRimGradient, darken, HitSlop } from '@/constants/theme';
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
// The smallest gap the pill keeps from the bar's own clipping mask (2026-08-10 follow-up, user
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
// Clamping is done against the bar's MEASURED box rather than `BOTTOM_NAV_HEIGHT`, because
// `useScaledStyles` scales this bar's padding with the OS text-size setting — the constant is
// only true at 1.0x, and at 1.4x the arithmetic that "just fits" here would be wrong again.
//
// **...and it has to be the box the PILL lives in, not the one `Surface` paints (2026-08-11,
// user report + screenshots of the Home button).** The first two passes measured the Surface's
// OUTER view, which is `2 × BORDER_WIDTH.card` (3px) taller and wider than the masked content
// box the pill is absolutely positioned inside — so every "keep 4px off the edge" sum was
// computed in the wrong coordinate space and let Home's ring land 1px off the mask.
// `innerH`/`innerW` come from an `absoluteFill` probe rendered as a SIBLING of the pill, so
// whatever the abs-positioning origin turns out to be, it measures EXACTLY the rectangle the
// pill's own x/y map into.
//
// **That first pass only clamped the vertical axis (2026-08-10, same-day follow-up, user
// report: "should always be a rounded box, not the clipped thing you see — it only happens
// sometimes").** The diagnosis above already named the real shape of the bug — an outermost
// tab's pill corner sitting inside the bar's own Radius.lg corner ARC, a two-axis problem — but
// the fix only added `clampTop`/`maxPillH`. Shop and Health's pills sit close enough
// horizontally to the bar's rounded left/right edges that a font-scale- or measurement-
// dependent few px could still push a corner into that arc; the more central tabs never come
// close, which is why it read as intermittent rather than every time. `clampLeft` (mirrors
// `clampTop`, uses the bar's MEASURED width — `innerW`, same reasoning as `innerH`) closes the
// other axis the same way.
//
// 4 → 2 on 2026-08-11, and that is not a loosening: 2px is what the side pill has ALWAYS had
// in reality (62px tall, positioned at y 8 in a 72px masked box), because the old clamp was
// measuring a box 3px bigger than the real one and so never bound. Stating the real minimum
// keeps the side pill exactly where it has always sat instead of shoving it 2px off the icon
// it frames; Home's ring is sized by `HOME_RING` below rather than by whatever this leaves.
const PILL_INSET = 2;
// The pill is drawn slightly larger than the tab item's own measured box (grown outward,
// centred on the same spot) so the active tab reads as a roomier card instead of shrink-wrapping
// the icon+label — the icon/label stay put (centred in their own tight flex box), so this extra
// margin shows up as breathing room between them and the pill's edge, not a layout shift.
const PILL_GROW_X = 8;
const PILL_GROW_Y = 6;
// How wide the accentSoft ring around the Home button is (2026-08-11). Home's ring used to be
// `PILL_GROW_X * 2` past the 56px FAB — 72px inside a 72px masked box, i.e. the entire height
// of the bar — capped by whatever the clamp allowed and then pushed off-centre by it. A ring
// as tall as its container isn't a frame, it's a plate; this is the frame's actual width, and
// the arithmetic below sizes the ring from it and centres it on the button rather than fitting
// it to the leftovers. 4 + the FAB's 56 + 4 leaves exactly PILL_INSET × 2 to the mask.
const HOME_RING = 4;
// A thin darker rim shown behind Home's ring while Home is the active tab (2026-08-11, same-day
// follow-up: "should also look pressed down, which none of them do now"). The FAB itself can't
// gain a resting sink the way a side tab does (`sunk={active}`) — `HOME_RING` above already
// spends every px of slack the masked bar has around the 56px button (by construction, see its
// own note), so any resting downward offset would immediately start shrinking the ring that
// marks Home as selected: a `homeCentreY` shift of N px costs `homeFit` 2N, since the fit is
// bounded by whichever side of the bar is tighter. Confirmed by the arithmetic before ruling
// motion out again, not re-asserted from memory. So Home borrows the same `pillBaseColor`
// "cap on a base" idiom the side tabs' socket plate uses, but applies it RADIALLY instead of
// vertically: a second ring, the same shape as the real one, `HOME_HALO_PAD` px larger on every
// side with no offset, visible only while Home is active. See the `ho` shared value below.
const HOME_HALO_PAD = 3;

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
  // The box the pill is positioned inside — what it has to stay within. See PILL_INSET. Both
  // dimensions are measured (not read off BOTTOM_NAV_HEIGHT/a fixed width) because this bar
  // runs through useScaledStyles, so its painted size shifts with the OS text-size setting —
  // and measured from an absoluteFill PROBE rather than from the Surface, because Surface's
  // own box is its outer border view, 2 × BORDER_WIDTH.card bigger than the mask that does
  // the clipping.
  const [innerH, setInnerH] = useState(0);
  const [innerW, setInnerW] = useState(0);

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
  const ready = leftTrack.w > 0 && rightTrack.w > 0 && centreTrack.w > 0 && segW > 0 && innerH > 0 && innerW > 0;

  // The tallest/widest a pill may be, and where it may sit, so it never reaches the bar's
  // mask. Both slots go through these — see PILL_INSET for what was being sliced before.
  const maxPillH = Math.max(0, innerH - PILL_INSET * 2);
  const clampTop = (top: number, h: number) =>
    Math.min(Math.max(top, PILL_INSET), Math.max(PILL_INSET, innerH - PILL_INSET - h));
  // Horizontal counterpart of clampTop (2026-08-10 follow-up, user report: "should always be
  // a rounded box, not the clipped thing you see — it only happens sometimes"). Only the
  // OUTERMOST side tabs (Shop, Health) sit close enough to the bar's own rounded corners for
  // this to matter — a pill that grows PILL_GROW_X past its item's own box can push its
  // rounded-rect corner into the diagonal cut the bar's Surface mask carves out of ITS corner,
  // same failure mode PILL_INSET already fixed on the vertical axis. Margin-dependent, so it
  // doesn't reproduce reliably at every font scale/measurement — "sometimes" — which is why it
  // survived the vertical-only fix.
  const clampLeft = (left: number, w: number) =>
    Math.min(Math.max(left, PILL_INSET), Math.max(PILL_INSET, innerW - PILL_INSET - w));

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
  // (maintainer report). It is a real slot now — an accentSoft ring around the 56px FAB, so
  // Home is marked the way a side tab's icon+label is. The indicator therefore always exists
  // and always travels to the selected tab; there is no enter/exit, no opacity and no unmount.
  //
  // **Sized from HOME_RING and centred on the button, NOT fitted to the leftovers
  // (2026-08-11, user report + screenshots).** It used to be `centreTrack.w + PILL_GROW_X * 2`
  // (72) capped by `maxPillH` and positioned through `clampTop`, and all three parts of that
  // fought each other inside a 72px box: the ring came out 67px — a plate the full height of
  // the bar, not a frame — the clamp then had a range of exactly one value and pinned it 1px
  // off the mask, and because the FAB rests 4px lower than the ring's clamped position, the
  // "ring" was 8px above the button and 3px below it. What the screenshots showed was a
  // lopsided smudge with its halo sliced flat top and bottom, which is what a circle bigger
  // than its container always becomes here (a Surface CLIPS — see PILL_INSET).
  //
  // The order is reversed now: the ring is HOME_RING wide, centred on the FAB's own centre,
  // and only THEN capped by what fits. Nothing needs clamping afterwards — a ring centred on
  // a button that is itself centred in the bar is inside the bar by construction, and
  // `homeFit` is the arithmetic that says so rather than a guard that hopes so.
  const homeCentreY = centreTrack.y + centreTrack.h / 2;
  const homeFit = 2 * Math.max(0, Math.min(homeCentreY - PILL_INSET, innerH - PILL_INSET - homeCentreY));
  const homeSize = Math.min(centreTrack.w + HOME_RING * 2, homeFit);
  const homeTop = homeCentreY - homeSize / 2;
  const homeX = centreTrack.x + centreTrack.w / 2 - homeSize / 2;

  // Every dimension the pill morphs between. Width/height/radius animate alongside x/y, so a
  // side tab -> Home move is one continuous shape change rather than a fade-out.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const pw = useSharedValue(0);
  const ph = useSharedValue(0);
  const pr = useSharedValue(Radius.lg);
  // Visibility of the static "socket" plate behind a sunk side tab — see `pillBaseStyle` below.
  // Starts hidden; the very first effect run (cold launch) snaps it straight to the right value
  // like every other shared value here, so there's no fade-in flash on mount.
  const bo = useSharedValue(0);
  // Visibility of Home's concentric halo ring — see `HOME_HALO_PAD`'s note and `homeHaloStyle`
  // below. Mirrors `bo`'s fade pattern exactly, just for the opposite branch.
  const ho = useSharedValue(0);
  // True until the first layout-ready effect run — a cold launch/deep-link lands on its slot
  // with no travel; every later change animates.
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (!ready) return;
    const snap = firstRunRef.current || reducedMotion;
    firstRunRef.current = false;

    const target = isHomeActive
      ? { x: homeX, y: homeTop, w: homeSize, h: homeSize, r: homeSize / 2, baseOpacity: 0, haloOpacity: 1 }
      : { x: slotX(activeIndex), y: sideTop, w: segW + PILL_GROW_X, h: pillHeight, r: Radius.lg, baseOpacity: 1, haloOpacity: 0 };

    const to = (value: number) =>
      snap ? value : withTiming(value, { duration: Duration.tabSwitch, easing: Ease.move });
    tx.value = to(target.x);
    ty.value = to(target.y);
    pw.value = to(target.w);
    ph.value = to(target.h);
    pr.value = to(target.r);
    bo.value = to(target.baseOpacity);
    ho.value = to(target.haloOpacity);
  }, [
    ready, activeIndex, isHomeActive, segW, pillHeight, sideTop,
    homeX, homeTop, homeSize, leftTrack.x, rightTrack.x, centreTrack.x, innerW,
    reducedMotion, tx, ty, pw, ph, pr, bo, ho,
  ]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    width: pw.value,
    height: ph.value,
  }));
  // **The "socket" plate a sunk side tab sits in (2026-08-11, user report + screenshot:
  // "does not look like a button pressed down, it just looks like the box and icon has been
  // lowered vertically").** A side tab's whole cluster — icon, label (via NavTabItem's own
  // `sunk` translate) AND this pill's fill — was already positioned at its FINAL sunk offset
  // with nothing left at the unsunk position to read as what it sank INTO, so the only visible
  // effect was uniform downward motion, not depth. This is the same "cap on a base" idiom
  // Button.tsx's `keyBase` already uses: a plain `darken(fill, 0.22)` plate, fixed at the
  // UNSUNK top (`ty.value - Travel.sm`) and `Travel.sm` taller than the pill, rendered behind
  // it. Because the pill's own bottom edge already sits at `ty.value + ph.value` either way,
  // the two shapes share that same bottom edge exactly — only a `Travel.sm` sliver of the
  // darker plate peeks out above the accentSoft fill, reading as the wall of a shallow notch
  // the tab has settled into. Faded out (not measured/positioned) while Home is active — Home's
  // FAB deliberately doesn't rest sunk (see `renderCentre`'s 2026-08-11 note), so it has no
  // socket to show one for.
  const pillBaseStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value - Travel.sm }],
    width: pw.value,
    height: ph.value + Travel.sm,
    opacity: bo.value,
  }));
  // Home's concentric halo ring (see `HOME_HALO_PAD`'s note) — same centre as the real ring,
  // grown outward by `HOME_HALO_PAD` on every side rather than offset upward like the side
  // tabs' socket, since Home's FAB never moves. Radius tracks `pr` (not a fixed constant) so it
  // stays a matching ring/rounded-rect through the whole tab-switch morph, not just at rest.
  const homeHaloStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value - HOME_HALO_PAD }, { translateY: ty.value - HOME_HALO_PAD }],
    width: pw.value + HOME_HALO_PAD * 2,
    height: ph.value + HOME_HALO_PAD * 2,
    opacity: ho.value,
  }));
  const homeHaloRadiusStyle = useAnimatedStyle(() => ({ borderRadius: pr.value + HOME_HALO_PAD }));
  // The pill's own corner morphs (rounded rect on a side tab, circle on Home), so it needs an
  // animated style rather than a static Radius.lg — and it has to be applied to the pill's own
  // `Animated.View`, which then MASKS the rim gradient inside it.
  //
  // **Not to the gradient itself (2026-08-11).** It used to be, via an
  // `Animated.createAnimatedComponent(LinearGradient)`, and that silently didn't work: the
  // gradient kept `pr`'s initial `Radius.lg` while the fill one layer inside it became a
  // circle, so Home's ring drew as a 24px-cornered rounded SQUARE of rim colour with a pale
  // disc sitting inside it — the flat-topped "squircle" in the report's screenshots, measured
  // on the real DOM as `radius: 24px` on the gradient against `30.5px` on its own child.
  // Reanimated can't reach a third-party view's style the way it reaches a plain
  // `Animated.View`. Animate a View you own and let it clip; don't wrap a foreign component.
  const pillRadiusStyle = useAnimatedStyle(() => ({ borderRadius: pr.value }));
  const pillInnerRadiusStyle = useAnimatedStyle(() => ({ borderRadius: Math.max(0, pr.value - EDGE_WIDTH) }));

  // The pill marks whichever tab is active, all five of them, so its rim is always accent-hued.
  const rim = computeRimGradient(theme.accent, isDark);
  // The socket plate's fill — same `darken(fill, 0.22)` recipe as Button.tsx's `keyBase`, off
  // the pill's own accentSoft fill so the sliver reads as a shaded recess in the same colour
  // family rather than an unrelated grey.
  const pillBaseColor = darken(theme.accentSoft, 0.22);
  // **No halo of any kind on the pill.** `getLayeredShadow` went on 2026-08-10 (a grey,
  // hue-less blur under a pale `accentSoft` plate read as a dirty donut rather than as depth),
  // and `getGlow(theme.accent, 'soft')` follows it on 2026-08-11 for a reason that is about
  // this bar rather than about the colour: a glow is a 15px and a 27px blur, and the pill has
  // 4px of clearance to a mask that CLIPS. So the halo could never fade out — it was cut off
  // flat, top and bottom, turning the ring around Home into a squircle-shaped haze and giving
  // the shape its own second, harder edge a few px outside the real one. That is most of what
  // "the clipped thing you see" was. An indicator drawn behind a tab, inside a bar that
  // already casts one shadow for the whole cluster, needs no light of its own; the fill and
  // the rim are the whole object now.

  const renderCentre = (item: SiteItem) => {
    const active = isActive(item);
    const icon = <Ionicons name={active ? item.activeIcon : item.icon} size={24} color={theme.accentInk} />;
    const centreRim = computeRimGradient(theme.accent, isDark);
    return (
      <PressableScale
        key={item.key}
        scaleTo={0.90}
        travel={Travel.md}
        // **This button presses, but it does not REST sunk (2026-08-11)** — the one deliberate
        // exception to "Pressed = on", and it buys the ring above. The FAB is 56px in a 72px
        // masked box: 8px of slack, 4 above and 4 below. `sunk={active}` spent 4 of those 8 on
        // a downward offset, which left the ring nothing to be concentric with — the ring
        // ended up 8px above the button and 3px below it, which is what the report's
        // screenshots show. It also never read as depth in the first place: a sunk cap needs a
        // base to meet, and this FAB deliberately has none (see the 2026-08-05 keyBase note
        // above), so all the offset did was sit the blue circle low in the bar.
        //   `sunk` was added on 2026-08-10 because Home was then "the tab that never registers
        // as selected" — with no pill of its own, nothing marked it. That is no longer true:
        // the ring is Home's selection cue, and it is a stronger one than 4px of travel with
        // nothing behind it. Keep `travel` — the press itself still sinks, like every key.
        //   Still true after the 2026-08-11 follow-up asking for a "pressed down" Home too —
        // see the file header's "Home gets a recessed cue too" bullet: that's a second ring
        // (`homeHaloStyle`), not motion, precisely so this constraint doesn't get violated.
        accessibilityRole="button"
        accessibilityLabel={t.nav[item.key]}
        accessibilityState={{ selected: active }}
        // **No `Shadow.fab`, in EITHER state (2026-08-11).** The 2026-08-10 pass dropped it
        // only while Home was active, because the 16px black blur smeared across the ring and
        // turned it into a grey donut. The user's screenshot of the INACTIVE state shows the
        // other half of the same problem: a 16px 22%-black blur around a 56px circle, on a
        // white bar, doesn't read as a floating FAB — it reads as a dirty grey collar drawn
        // around the button, the same "hue-less grey blur" objection the pill's own shadow was
        // deleted for. Nothing in this bar should carry grey depth: the bar is a Surface that
        // already casts one shadow for the whole cluster, and an accent-filled circle on white
        // needs no help being the most salient thing in it.
        style={[styles.centreButton, glass ? null : { backgroundColor: theme.accent }]}
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
    <Surface surfaceContext="nav" style={styles.bar}>
      {/*
        The pill is sized and placed inside this box, so the box has to be measured —
        `useScaledStyles` scales the bar's padding with the OS text size, which makes
        BOTTOM_NAV_HEIGHT true only at 1.0x. It is measured HERE, from an absoluteFill sibling
        of the pill, rather than from the Surface's own onLayout: Surface's box is its outer
        border view, which is 2 × BORDER_WIDTH.card taller and wider than the mask that
        actually clips, and every gap sum computed against it was therefore 3px optimistic.
        An absoluteFill shares the pill's containing block by definition, so this measures the
        exact rectangle `translateX`/`translateY` address — no constant to keep in step.
      */}
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          setInnerH((prev) => (prev === height ? prev : height));
          setInnerW((prev) => (prev === width ? prev : width));
        }}
      />
      {ready && (
        // Home's recessed halo (see `HOME_HALO_PAD`'s note) — rendered behind everything else,
        // visible only while Home is active.
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, homeHaloStyle, homeHaloRadiusStyle, { backgroundColor: pillBaseColor }]}
        />
      )}
      {ready && (
        // The socket plate (see `pillBaseStyle`'s note) — rendered BEHIND the pill so only its
        // Travel.sm sliver above the fill is ever visible.
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, pillBaseStyle, { backgroundColor: pillBaseColor, borderRadius: Radius.lg }]}
        />
      )}
      {ready && (
        // The pill owns the morphing corner and masks whatever is inside it — see
        // `pillRadiusStyle` for why the rim gradient must NOT carry that radius itself.
        <Animated.View pointerEvents="none" style={[styles.pill, pillStyle, pillRadiusStyle]}>
          {glass ? (
            <LinearGradient
              colors={rim.colors}
              locations={rim.locations}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1, padding: EDGE_WIDTH }}
            >
              <Animated.View style={[{ flex: 1, backgroundColor: theme.accentSoft }, pillInnerRadiusStyle]} />
            </LinearGradient>
          ) : (
            <Animated.View style={[{ flex: 1, backgroundColor: theme.accentSoft }, pillInnerRadiusStyle]} />
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
    // This view carries the animated corner, so it is also the mask for the rim gradient
    // inside it — the gradient can't be given the radius directly (see `pillRadiusStyle`).
    overflow: 'hidden',
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
