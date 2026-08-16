/**
 * ScreenScaffold.tsx — universal screen layout wrapper implementing Decision 001.
 *
 * Composes the complete screen stack: background layers, particle overlay,
 * content, and material-aware chrome (header + optional bottom nav). Tier-aware:
 * 'site' screens render both chrome blocks; 'sub' screens render only the header
 * with a back link (iOS) instead of Settings/Focus buttons.
 *
 * Connections:
 *   Imports → react-native, react-native-safe-area-context, components/ScreenBackground, components/HomeHeroBackground,
 *             components/ParticleBackground, components/ScreenHeader (now also passed `isHome`, so
 *             ScreenHeader can gate its OTA "update available" button to Home only), components/BottomNav,
 *             components/DebugGeneralNoteButton (floating "Add general note" FAB, self-gated on
 *             debugModeEnabled — mounted once here so every screen gets it for free),
 *             lib/useAppTheme
 *             (2026-07-31 A.5: lib/screenColor's ScreenColorContext is NO LONGER imported/provided —
 *             the per-screen hue is retired, so an un-coded Surface draws a neutral edge)
 *   Used by → every app screen (app/(tabs)/index.tsx, app/(tabs)/shopping.tsx, etc.); also
 *             exports ScrollIntoViewContext, consumed by components/AddRow.tsx to scroll
 *             itself above the keyboard on focus (see that Edit note below)
 *   Data    → none (presentational; all logic in child screens)
 *
 * Edit notes:
 *   - Layer order is critical: L1 background → L2 particles → L3 content → L4 top block →
 *     L4.5 optional sticky-below-header block → L5 bottom block
 *   - **ScrollIntoViewContext (2026-07-13 keyboard fix; 2026-07-16 made row-relative)**:
 *     wraps `children` inside the ScrollView, exposing a `scrollIntoView(node)` that measures
 *     the focused AddRow in window coords and scrolls only enough to lift it above the
 *     keyboard. Android's default `windowSoftInputMode=resize` shrinks the visible viewport
 *     when the keyboard opens but never scrolls content to compensate, so an AddRow can end up
 *     hidden behind the keyboard — taps on "+" land on the keyboard and do nothing. The
 *     original fix scrolled to the absolute END, which assumed AddRow was always the LAST row;
 *     #196's per-day InlineTaskAdd rows sit MID-list, so scroll-to-end scrolled *past* them and
 *     re-broke the taps. Measuring the row and lifting just it is correct for last- and
 *     mid-list rows alike. AddRow calls this from its input's onFocus/keyboardDidShow. `null`
 *     outside a scrollable ScreenScaffold — the non-scrollable/FlatList branch self-manages.
 *   - **ScrollToNodeContext (2026-08-14)** is its SIBLING, not a generalisation of it: "bring
 *     this section up under the header", for a screen arriving at a deep link. Kept separate
 *     because `scrollIntoView` scrolls only when the node overlaps the keyboard and only by
 *     that overlap — correct for its job, wrong for every case here. Both are provided by the
 *     scrollable branch and both are `null` on the non-scrollable one.
 *   - ParticleBackground gating (particlesEnabled + reducedMotion) happens inside the component
 *   - **Content lives in a CLIPPED VIEWPORT that fills the gap BETWEEN the two chrome cards
 *     (2026-08-18, amended 2026-08-19).** `styles.viewport` is an `overflow: 'hidden'` box
 *     running from the header card's (or an attached sticky bar's) BOTTOM edge to the nav card's
 *     TOP edge, inset by the 8px side margins both cards use. Nothing renders above the header,
 *     below the bar, in the gutters, or — since the glass became translucent — behind either
 *     card: "things like header and bottom nav should still not show elements behind it when
 *     user is scrolling. Only the backdrop." The header's own 8px resting gap is `contentPad` on
 *     the content, NOT part of this margin. **One clearance each, and they are two different
 *     numbers**: the margin is where content is CUT, the padding is where it RESTS. Both on the
 *     margin and a card is sliced 8px below the glass in open air (the 2026-08-18 regression);
 *     both on the padding and content scrolls behind the chrome again.
 *   - **A clip edge has to LAND ON something opaque — that is the whole lesson of this file**
 *     (see `viewportInset`'s own comment for the attempts and why each failed). An edge in open
 *     air IS a card sliced across a blank strip: `marginTop: contentTopClear` puts the top edge
 *     8px below the header card (that constant folds in `headerFloatBottom` — hence the
 *     subtraction), and `marginBottom: bottomNavClearance` puts the bottom edge on the bar's NEAR
 *     edge (that total is the whole nav overlay block). Don't reintroduce either number here.
 *   - **A CORNER is an edge too, and it is the half that keeps being missed.** The window's
 *     edges lie along the header's BOTTOM corners and the bar's TOP ones, both `Radius.lg`. A
 *     square-cornered window cut against a rounded card leaves the sliced card's own 90° corner
 *     standing in the notch the glass has already curved away from — the one point on that edge
 *     with nothing over the cut, and the thing reported three times as "upper corners… and lower
 *     corners of header box". So the viewport carries `Radius.lg` on both facing pairs (the
 *     bottom pair only when a nav is actually reserved) and the cut follows the chrome's corner
 *     instead of crossing it. This is NOT the 2026-08-11 radii, which were for the opposite
 *     pairs — the header's top and the bar's bottom — back when the window ran the chrome's full
 *     height. The corner peek that geometry allowed is gone and stays gone.
 *   - **`viewportBleed` is the inner scroll box's mirror-image negative margin and is
 *     load-bearing**: it keeps every card at the exact x it had before the inset — the 8px is
 *     clipped off empty backdrop, since every screen's content container already pads by
 *     `Spacing.md`. Change one of the two and you resize every card in the app.
 *   - Safe-area handling is SPLIT (Android edge-to-edge is always on in RN 0.85 / Expo 56, so
 *     content draws behind the status + nav bars):
 *       • The outer SafeAreaView pads the viewport into the safe area — but 'top' is applied by
 *         hand as `paddingTop: topInset` rather than listed in `edges`, because SafeAreaView uses
 *         the RAW `insets.top` and the header block floors the same inset with
 *         StatusBar.currentHeight. Under the clip those two MUST agree, or the viewport's top edge
 *         sits above the header's bottom edge and content shows in the difference.
 *       • The header/bottom blocks are position:absolute and DON'T inherit that padding (absolute
 *         children ignore a parent's padding in current Yoga), so they apply the insets themselves:
 *         header height/paddingTop += topInset, bottom-nav height/paddingBottom += bottomInset.
 *     topInset floors insets.top with StatusBar.currentHeight on Android as a safety net for the
 *     brief window where safe-area-context can report 0 before the first insets dispatch.
 *   - **The absolute blocks are `pointerEvents="box-none"`.** They are full-width zIndex 99/100
 *     views with transparent margins; without it those strips swallow taps meant for the content
 *     under them (a dead gutter down both sides of every screen).
 *   - Background: ScreenBackground (the shared blue field + corner branches) is the base on
 *     every screen when ownBackground is true; isHome=true additionally layers HomeHeroBackground
 *     (an additive focal glow) on top of it (see below)
 *   - **ownBackground (added for the static-swipe-background fix)**: the 5 pager tab
 *     sites (app/(tabs)/*) pass ownBackground={false} because each one used to mount
 *     its own L1/L2 background instance, so swiping the pager visibly slid two
 *     separate backdrops past each other at the seam. app/(tabs)/_layout.tsx now
 *     renders one shared L1/L2 pair behind the whole pager instead — it doesn't
 *     translate with the swipe gesture, only swapping (Home hero vs plain backdrop)
 *     when the focused tab actually changes. ownBackground=false also drops this
 *     component's own SafeAreaView backgroundColor so that shared backdrop shows
 *     through. Sub-tier and non-pager site screens keep ownBackground's default
 *     (true) — their transitions are stack push/pop, not a swipe, so per-screen
 *     backgrounds were never the problem.
 *   - **plainBackground (Settings request)**: opt-in flat backdrop — pure white/black
 *     (via useIsDark) with no ScreenBackground accent blob and no ParticleBackground, and
 *     a hairline bottom edge on the header block so the title bar stays a visible app-bar
 *     against the flat fill. Only app/settings.tsx passes it; every other screen keeps the
 *     tinted theme.bg + glow.
 *   - **bottomNav (successor to Decision 032's swipeNav)**: the 5 nav sites now live in
 *     app/(tabs)/_layout.tsx's material-top-tabs pager, which owns both the bottom tab
 *     bar and the swipe-between-sites gesture itself (react-native-pager-view — one
 *     continuous native slide, no per-screen SiteSwipeView/SiteSwipeDots wrapper needed
 *     any more). Tab screens pass bottomNav={false} so ScreenScaffold doesn't ALSO render
 *     a BottomNav underneath the pager's own tab bar. Default true only for a hypothetical
 *     site-tier screen mounted outside the tabs group (none currently exist). Sub-tier
 *     ignores it (sub screens never render BottomNav regardless).
 *   - **pagerFloatingNav (2026-07-26)**: the 5 tab screens ALSO pass this (alongside
 *     bottomNav={false}) now that app/(tabs)/_layout.tsx renders the real bar as a floating
 *     overlay instead of react-navigation's tab-bar sibling — see that prop's own doc and
 *     app/(tabs)/_layout.tsx's header for the why.
 *   - **stickyBelowHeader (added 2026-07-02, Session A2·2)**: optional screen-owned chrome
 *     pinned directly under the header block, e.g. app/shopping.tsx's Decision 011 A2-1
 *     per-list summary/progress bar. Additive, backward-compatible — omit both props and a
 *     screen renders exactly as before. Uses the same absolute-positioned float pattern as
 *     the header/bottom-nav blocks (not ScrollView's `stickyHeaderIndices`, which would sit
 *     underneath the already-absolutely-positioned header). `stickyBelowHeaderHeight` must
 *     match the rendered content's actual height — it drives the ScrollView's top content
 *     padding so the first real content item isn't permanently hidden under the two floating
 *     blocks (mirrors the header's own float, which every current screen already accepts).
 *   - **headerBlock backgroundColor (visual-audit fix, 2026-07-11; amended 2026-07-23)**:
 *     `headerBlock` has an explicit height, but `ScreenHeader`'s glass `Surface` shrink-wraps
 *     to its own (shorter) content height, leaving a transparent sliver at the bottom of the
 *     block that let scrolled-past L3 content show through unblurred. The `headerFill` flex:1
 *     style stretches the Surface to fill the band, which is what actually closes that sliver;
 *     the block's `backgroundColor` fill is only still needed for the non-floating
 *     (plainBackground) path. As of the floated-header pass the block is `transparent` when
 *     `floatChrome` so the ScreenBackground shows in the side/top gaps around the glass —
 *     the stretched glass still covers content under the header itself.
 *   - **Header + sticky bar are ONE card (2026-08-10)**: when `stickyBelowHeader` is passed,
 *     `headerFloatBottom` goes to 0 and `headerAttachedBelow` squares the header's bottom
 *     corners; the sticky bar (components/TabSlider.tsx's `attachedTop`) squares its top ones.
 *     Maintainer: "Tab slider should be under the header without dividing space." Screens with
 *     no sticky bar keep the 8px gap — there's nothing under them to attach to.
 *   - **`HEADER_SEAM_OVERLAP` (2026-08-14)**: the two cards only ABUT (header's bottom edge ==
 *     sticky block's top edge), and that exact-abutment coordinate can round to two separate
 *     device pixels rather than one, leaving a hairline seam that showed scrolled content
 *     through it while scrolling (user report). `headerBlock` (zIndex 100, above the sticky
 *     block's zIndex 99) paints one `StyleSheet.hairlineWidth` taller than `headerBlockHeight`
 *     when attached, so the opaque header card overlaps the seam instead of relying on the two
 *     edges rounding identically. `contentTopClear` and the sticky block's own `top` are
 *     deliberately NOT bumped by this — only the header's paint extends, nothing else moves.
 *   - **Floated header (2026-07-23, nothing-touches-the-edges; top gap dropped 2026-07-25)**:
 *     `floatChrome` (= !plainBackground) insets the header with `headerFloatBottom` (gap before
 *     content) and `headerFloatH` (side margins), rounds the glass (Radius.lg, via the style
 *     prop), and makes the block transparent. `headerFloatTop` is 0 — the header's top now sits
 *     flush against `topInset` (the status/notification bar) instead of floating a further
 *     `Spacing.sm` below it (user report: the card should visually touch the notification line,
 *     not hover under it). `headerBlockHeight` folds the (now asymmetric) gaps into the block
 *     height so the glass Surface still fills exactly HEADER_HEIGHT; `contentTopClear` and the
 *     sticky block/filler tops all derive from it so content and any stickyBelowHeader bar still
 *     clear the floated header. Pairs with the floated bottom nav in app/(tabs)/_layout.tsx.
 *   - **keyboardShouldPersistTaps (visual-audit, 2026-07-11)**: the in-flow ScrollView now
 *     sets `keyboardShouldPersistTaps="handled"` so a first tap on an on-screen control (e.g.
 *     an autocomplete suggestion row while an inline add-item input is focused) is delivered
 *     to that control instead of only dismissing the keyboard — applies app-wide since every
 *     screen shares this one ScrollView.
 *   - **onScroll (Phase 1 flight animation, 2026-07-11)**: optional, forwarded to the internal
 *     ScrollView. Purely additive — omit for identical behavior to before. Added so a screen
 *     can cancel an in-flight `FlightOverlay` animation on scroll (window-space coordinates
 *     go stale once the user scrolls); `scrollEventThrottle` only activates when a listener
 *     is passed, so screens that don't use it pay no extra event-bridge cost.
 *   - **scrollable (perf, 2026-07-15)**: default true. When false, children render in a plain
 *     flex View (chrome padding still applied) instead of the internal ScrollView, so a child
 *     can own scrolling with a virtualising FlatList. Used by app/catalogue.tsx (was
 *     app/(tabs)/shopping.tsx's in-place Catalogue tab before UX audit F1, 2026-07-23),
 *     whose ~286-row list can't virtualise inside a same-axis ScrollView (nested
 *     VirtualizedList). ScrollToEndContext is a no-op in this mode — a self-scrolling FlatList
 *     manages keeping its own AddRow above the keyboard.
 *   - **The bottom reservation is gated on `bottomNav`, not just `tier`
 *     (bug fix, 2026-07-17; the reserve is `viewportInset.marginBottom` since 2026-08-10, but
 *     the gating rule is unchanged and the failure below is still what it protects against)**:
 *     previously `paddingBottom: BOTTOM_NAV_HEIGHT` applied whenever
 *     `tier === 'site'`, full stop. But the 5 pager tab screens (app/(tabs)/*) all pass
 *     `bottomNav={false}` — app/(tabs)/_layout.tsx's pager already renders the real BottomNav
 *     as a SIBLING tab-bar container, and react-navigation sizes each page to stop exactly
 *     above it, so those screens' own box never actually overlaps the real nav. Reserving
 *     BOTTOM_NAV_HEIGHT again here double-counted that clearance for every screen that
 *     currently exists (no real screen passes `bottomNav={true}` today). On a ScrollView
 *     screen this only wasted a bit of scroll-past-the-end padding, easy to miss. On the
 *     Catalogue screen's non-scrollable FlatList box (`scrollable={false}`, see above), the same
 *     padding shrinks a real flex-bounded viewport, so the list hard-clipped ~72dp above where
 *     the nav actually sits, leaving a bare gap even on a long, fully-populated list — reported
 *     as a "cut off" bug. Fixed by keying the reserve on `tier === 'site' && bottomNav` instead.
 *     (Both branches share one clipping wrapper now, so the Catalogue screen and a ScrollView
 *     screen can no longer end up with different bottom edges in the first place.)
 *   - **stickyGap (2026-07-20)**: `stickyBelowHeader` (Plans/Shopping/Settings' in-screen tab
 *     bars) used to sit flush against the header's bottom edge with zero gap, reading as
 *     cramped. A `Spacing.sm` filler strip (painted `bgColor`, same treatment as headerBlock's
 *     own backgroundColor) now sits between them, and the sticky block + content's top padding
 *     shift down by the same amount. Zero-cost for screens that don't pass `stickyBelowHeader`.
 */
import React, { useCallback, useRef } from 'react';
import { Keyboard, NativeScrollEvent, NativeSyntheticEvent, PixelRatio, Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { getHeaderMetrics, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import ScreenBackground from '@/components/ScreenBackground';
import HomeHeroBackground from '@/components/HomeHeroBackground';
import ParticleBackground from '@/components/ParticleBackground';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNav, { BOTTOM_NAV_HEIGHT, NAV_FLOAT_GAP } from '@/components/BottomNav';
import DebugGeneralNoteButton from '@/components/DebugGeneralNoteButton';
import { getScreenColor, ScreenColorContext, type ScreenKey } from '@/lib/screenColor';

/** A host component (View) ref that can be measured in window coordinates. */
type Measurable = {
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

/**
 * Scrolls a given row just above the keyboard — consumed by components/AddRow.tsx so its
 * input+confirm button stays tappable when the keyboard opens. Android's default
 * `windowSoftInputMode=resize` shrinks the visible viewport when the keyboard opens but
 * never auto-scrolls content to compensate, so an AddRow can end up hidden behind the
 * keyboard — taps land on the keyboard, not the "+" button.
 *
 * Pass the AddRow's own View node: we measure it in window coords and scroll only enough to
 * lift its bottom above the keyboard. This is correct whether the row is the LAST item of its
 * list OR sits mid-list (the per-day InlineTaskAdd rows on Today/This week) — unlike the old
 * "scroll to absolute end", which scrolled *past* a mid-list row and left it (and its button)
 * behind the keyboard (the #196 regression). `null` outside a scrollable ScreenScaffold
 * (the non-scrollable/FlatList branch handles its own keyboard avoidance).
 */
export const ScrollIntoViewContext = React.createContext<((node: Measurable | null) => void) | null>(null);

/**
 * Scrolls a given node up to just below the floating header — the "take me to that section"
 * move, as opposed to `ScrollIntoViewContext`'s "lift this row off the keyboard".
 *
 * They are deliberately two contexts rather than one function with a mode. `scrollIntoView`
 * only ever scrolls when the node OVERLAPS the keyboard and only by the overlap, which is
 * exactly right for its job and useless for this one: a section already fully on screen but
 * halfway down needs moving, and a section far below needs moving by more than an overlap.
 *
 * Added 2026-08-14 for Shopping's "Nullstillingsdager" link, which pushes into Settings at a
 * particular card. Pass the target's own View node. `null` outside a scrollable
 * ScreenScaffold, same as its sibling.
 */
export const ScrollToNodeContext = React.createContext<((node: Measurable | null) => void) | null>(null);

/** Extra gap left between the lifted row's bottom and the top of the keyboard. */
const KEYBOARD_MARGIN = 16;

/** Breathing room between the header's bottom edge and a node scrolled to by `scrollToNode`. */
const SCROLL_TO_MARGIN = 12;

/**
 * The status-bar clearance the floating chrome is positioned against.
 *
 * Belt-and-suspenders for Android: safe-area-context can read 0 for the top inset before the
 * first window-insets dispatch, so fall back to the native status-bar height. `Math.max` avoids
 * double-counting once `insets.top` is correct.
 *
 * Exported because anything drawing OVER a screen has to agree with the chrome about where the
 * chrome is, and there is exactly one right answer — the 2026-08-10 clip pass is a long note
 * about what happens when two places compute this and disagree by a few px.
 */
export function resolveTopInset(insetTop: number): number {
  return Platform.OS === 'android' ? Math.max(insetTop, StatusBar.currentHeight ?? 0) : insetTop;
}

/**
 * The band the pager's floating chrome covers, measured from the top and bottom of the ROOT
 * view — i.e. `[top, screenHeight - bottom]` is the strip where a tab screen's own content is
 * the thing on screen.
 *
 * Both edges are the chrome cards' OUTER footprint, the same edges `viewportInset` clips to
 * below. Content genuinely scrolls underneath both cards and is hidden BY them (they are
 * opaque), which is exactly why a caller drawing its own overlay cannot just use the target's
 * measured rect: the part of a card that runs past this band is not visible, it is behind the
 * header or the nav bar. components/TourSpotlight.tsx clamps its hole to this, after a real
 * -device report where the guided tour's ring cut straight across a fully-lit bottom nav
 * (2026-08-14) — Home's to-do card is taller than the band, so its rect ran 28px into the bar.
 */
export function tabChromeBand(insets: { top: number; bottom: number }, fontScale: number) {
  return {
    top: resolveTopInset(insets.top) + getHeaderMetrics(fontScale).headerHeight,
    bottom: BOTTOM_NAV_HEIGHT + insets.bottom + NAV_FLOAT_GAP,
  };
}

type Tier = 'site' | 'sub';

type Props = {
  title: string;
  tier: Tier;
  children: React.ReactNode;
  isHome?: boolean;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  /** Optional chrome pinned directly under the header block (e.g. a sticky summary bar). */
  stickyBelowHeader?: React.ReactNode;
  /** Rendered height of `stickyBelowHeader` — required whenever that prop is passed. */
  stickyBelowHeaderHeight?: number;
  /** Info/hint toggle — forwarded to the header ⓘ button. */
  /** Site-tier only — forwarded to the header's optional share icon. */
  onSharePress?: () => void;
  /** Site-tier only — forwarded to the header's optional scan icon. */
  onScanPress?: () => void;
  /** Site-tier only — forwarded to the header's optional card-layout icon. */
  onLayoutPress?: () => void;
  /**
   * Whether this screen renders its own BottomNav block. Only applies to
   * `tier === 'site'`. Default true. The 5 tab sites (app/(tabs)/*) pass false,
   * since app/(tabs)/_layout.tsx's pager already renders BottomNav as its tab bar —
   * without this a tab screen would get two bottom nav bars stacked.
   */
  bottomNav?: boolean;
  /**
   * The 5 pager tab sites (bottomNav=false) render their real BottomNav as a floating
   * overlay ABOVE the pager instead of as react-navigation's tab-bar sibling (2026-07-26 —
   * see app/(tabs)/_layout.tsx's header for why: it's what lets the bar's rounded top
   * corners show a scrolled card peeking through their notch instead of always showing the
   * plain field). That overlay isn't part of this scaffold's own layout, so this screen's
   * scroll content needs its OWN clearance reserved for it — and, since 2026-08-11, that
   * clearance is SPLIT (see `viewportInset`): the band below the nav card
   * (`bottomInset + NAV_FLOAT_GAP`) is the viewport's bottom margin, and the card's own
   * `BOTTOM_NAV_HEIGHT` is the content's bottom padding, so content scrolls behind the bar
   * instead of stopping at it. Independent of `bottomNav` (which controls whether THIS
   * scaffold renders its own bar) — a pager tab screen wants the clearance but NOT a second bar.
   */
  pagerFloatingNav?: boolean;
  /**
   * Whether this screen renders its own L1 background + L2 particle overlay.
   * Default true. The 5 pager tab sites (app/(tabs)/*) pass false, since
   * app/(tabs)/_layout.tsx already renders one shared instance behind the whole
   * pager — without this, each swiped tab would carry its own backdrop and the
   * background would visibly slide with the gesture.
   */
  ownBackground?: boolean;
  /**
   * Plain flat backdrop: pure white (light) / black (dark), no accent blob and no
   * particle overlay, plus a hairline bottom edge on the header block so the title bar
   * reads as a distinct app-bar against the flat fill. Default false. Used by the
   * Settings screen (app/settings.tsx). Only affects screens that opt in.
   */
  plainBackground?: boolean;
  /**
   * Optional override colour for the small filler strip between the header and the
   * sticky-below-header block (default: the page background `theme.bg`). Plans, Shopping,
   * and Settings all pass `theme.surface` so that seam reads white/clean instead of the
   * grey-blue backdrop (Plans: debug-note 2026-07-21; Shopping/Settings caught the same gap
   * on the same reported bug, 2026-07-21 follow-up). Only affects the gap filler, not the
   * header or scroll body — any future screen adding `stickyBelowHeader` should pass this too.
   */
  stickyGapColor?: string;
  /** Forwarded to the internal ScrollView — e.g. to cancel an in-flight FlightOverlay
   *  animation on scroll (components/FlightOverlay.tsx). Omit for identical behavior. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * When false, children render in a plain flex View instead of the internal ScrollView,
   * so a child can own scrolling with its own FlatList (virtualization). Default true.
   * The chrome padding (header + sticky bar + bottom nav) is applied to that View so the
   * child's list still clears the floating chrome. Used by the Shopping screen's Catalogue
   * tab (a ~286-row list that must virtualise). See Edit notes.
   */
  scrollable?: boolean;
  /**
   * This screen's key in lib/screenColor.ts — the hue every card inside it wears on its
   * border (card design reset, 2026-08-05). Tab screens pass their react-navigation route
   * name ('plans', 'habits', 'health', 'shopping'); sub-tier screens pass their own key
   * ('notes', 'food', 'scan'). Omit it — as Home and Settings deliberately do — and
   * the body provides no hue, so its cards fall through to the neutral `theme.border`.
   *
   * This only sets a DEFAULT for the body. A card that belongs to a different screen than the
   * one it is drawn on (Home's preview cards) still passes its own `borderColor` to Surface,
   * which wins over this.
   */
  screenKey?: ScreenKey;
};

export default function ScreenScaffold({
  title,
  tier,
  children,
  isHome = false,
  onBack,
  headerRight,
  stickyBelowHeader,
  stickyBelowHeaderHeight = 0,
  onSharePress,
  onScanPress,
  onLayoutPress,
  bottomNav = true,
  pagerFloatingNav = false,
  ownBackground = true,
  plainBackground = false,
  stickyGapColor,
  onScroll,
  scrollable = true,
  screenKey,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  // The screen's own hue, handed to every Surface in the body via context (card design reset,
  // 2026-08-05). `null` when the screen names no key — Home and Settings, which are neutral on
  // purpose — so an un-coded card lands on the neutral `theme.border` rather than on a colour.
  const screenHue = React.useMemo(
    () => (screenKey ? getScreenColor(theme, screenKey).base : null),
    [theme, screenKey],
  );
  // Flat backdrop colour for plainBackground screens (Settings): true white/black, no tint.
  // Dark reads `theme.bg`, which IS #000000 since the 2026-08-10 true-black palette — the
  // hardcoded literal here predates it and would now just restate the token. Light keeps its
  // literal: `theme.bg` is #E2EAF5 there, and the point of this branch is a flat white page
  // with no tint at all, which no surface token spells.
  const bgColor = plainBackground ? (isDark ? theme.bg : '#FFFFFF') : theme.bg;
  // Android edge-to-edge (RN 0.85 / Expo 56) draws content behind the status and
  // navigation bars. The header/bottom blocks are position:absolute, and absolute
  // children do NOT inherit the SafeAreaView's padding in current Yoga, so top:0 /
  // bottom:0 land behind the system bars. Apply the insets to the floating chrome
  // explicitly. (The in-flow ScrollView still gets its inset padding from the
  // SafeAreaView, so scroll content keeps clearing the bars as before.)
  const insets = useSafeAreaInsets();
  // See resolveTopInset above — shared with anything that draws over a screen and therefore has
  // to land on the same status-bar clearance the header is positioned against.
  const topInset = resolveTopInset(insets.top);
  const bottomInset = insets.bottom;

  // Header band height scales with the OS text-size setting so the title's line box always
  // fits inside Surface's overflow:hidden mask. getHeaderMetrics derives band + title
  // fontSize/lineHeight together from the same capped scale — and the title Text consumes
  // them with allowFontScaling={false}, so RN can't rescale them a second time (Android
  // treats style fontSize/lineHeight as SP and multiplies by the font scale when scaling
  // is on — the double-scaling behind the header-clip bug; see the getHeaderMetrics doc in
  // constants/theme.ts and HEADER_CLIP_DEBUG.md). ~79 at 1.0x, ~98 at the 1.4x cap (bumped
  // from ~73/~89 alongside the 2026-07-20 header-prominence title-size increase).
  const { headerHeight: HEADER_HEIGHT } = getHeaderMetrics(PixelRatio.getFontScale());

  // Float the header off the screen edges (nothing-touches-the-edges pass, 2026-07-23; top
  // gap dropped 2026-07-25): a small gap below (before content), side margins, and rounded
  // glass corners, so the header reads as a floating panel with the ScreenBackground showing
  // around its sides/bottom — pairs with the floated bottom nav in app/(tabs)/_layout.tsx. No
  // gap above — the header's top sits flush against the status bar so the card visually
  // touches the notification line. Skipped for plainBackground (Settings), which keeps the
  // conventional edge-to-edge app-bar look against its flat white/black fill (a floating pill
  // on a flat field would read as an invisible-margin box). `headerFloatTop`/`headerFloatBottom`
  // fold into the block height so the glass Surface (headerFill flex:1) still fills exactly
  // HEADER_HEIGHT.
  const floatChrome = !plainBackground;
  // Top gap is 0 (2026-07-25, user report): the header used to float `Spacing.sm` below the
  // status bar on both edges — flush would read as "the header card's top touches the
  // notification line" instead of hovering with a visible strip of backdrop above it. The
  // bottom gap (between the header and content) is unchanged.
  const headerFloatTop = 0;
  // ...and the bottom gap is 0 too whenever the screen owns a sticky bar (2026-08-10, user
  // report: "Tab slider should be under the header without dividing space"). That 8px band was
  // transparent — `stickyGap` has been 0 since 2026-07-24, so the only thing between the header
  // card and the TabSlider was this padding, and scrolled content showed through the seam.
  // Header and slider are drawn as ONE floating card instead: `attachedBelow` squares the
  // header's bottom corners and the slider squares its top ones. Screens with no sticky bar
  // keep the gap — there is nothing under them for the header to attach to.
  const headerAttachedBelow = floatChrome && !!stickyBelowHeader;
  // A device-pixel seam between the header card and an attached sticky bar (2026-08-14): the
  // two are independently-positioned absolute views that only ABUT (header's bottom edge ==
  // sticky block's top edge), and on some pixel densities that shared coordinate rounds to two
  // adjacent device pixels rather than one, leaving a hairline where the clipped scroll content
  // underneath shows through while scrolling. `headerBlock` is zIndex 100 (above the zIndex-99
  // sticky block), so painting it a hairline TALLER — without moving `contentTopClear` or the
  // sticky block's own `top`, both still keyed to the un-overlapped `headerBlockHeight` — lets
  // the header's opaque card cover that seam from above instead of relying on exact abutment.
  const HEADER_SEAM_OVERLAP = headerAttachedBelow ? StyleSheet.hairlineWidth : 0;
  const headerFloatBottom = floatChrome && !headerAttachedBelow ? Spacing.sm : 0;
  // Spacing.sm (was .md) to match BottomNav's NAV_FLOAT_GAP (app/(tabs)/_layout.tsx) — the
  // header and bottom-nav floating cards should read as the same width (2026-07-24).
  const headerFloatH = floatChrome ? Spacing.sm : 0;
  const headerBlockHeight = HEADER_HEIGHT + topInset + headerFloatTop + headerFloatBottom;
  // How far below the safe-area top the header footprint ends — what content must clear.
  const contentTopClear = headerBlockHeight - topInset;

  const scrollRef = useRef<ScrollView>(null);
  // Live scroll offset, so scrollIntoView can convert a window-space overlap into an
  // absolute scrollTo target. Tracked on every scroll frame (cheap — a single ref write).
  const scrollY = useRef(0);
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll],
  );
  // Lift the given row just above the keyboard (see ScrollIntoViewContext doc). Measures the
  // row in window coords; if its bottom is under the keyboard, scrolls up by exactly the
  // overlap. Falls back to scrollToEnd when the node can't be measured.
  const scrollIntoView = useCallback((node: Measurable | null) => {
    const sv = scrollRef.current;
    if (!sv) return;
    if (!node?.measureInWindow) {
      sv.scrollToEnd({ animated: true });
      return;
    }
    node.measureInWindow((_x, y, _w, h) => {
      // Keyboard.metrics() returns the keyboard rect while it's shown; screenY is its top edge
      // in window coords. Unknown (keyboard not yet up) → no scroll now; the keyboardDidShow
      // call from AddRow retries once metrics exist.
      const kbTop = Keyboard.metrics?.()?.screenY ?? Number.POSITIVE_INFINITY;
      const overlap = y + h + KEYBOARD_MARGIN - kbTop;
      if (overlap > 0) {
        scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
      }
    });
  }, []);

  // Bring the given node up to just under the header (see ScrollToNodeContext doc). Measured in
  // window coords like its sibling, and converted to an absolute offset through the live
  // `scrollY` — a measured rect is where the node is NOW, and `scrollTo` wants where the content
  // should be.
  //
  // The target edge is `headerBlockHeight`, not `contentTopClear`: the measurement is in WINDOW
  // space, so it includes the safe-area inset that `contentTopClear` deliberately subtracts out.
  // Using the wrong one of that pair puts the node a status bar's height under the header on
  // Android and flush against it on iOS, which is the same class of mistake the 2026-08-10 clip
  // pass spent a long note on.
  const scrollToNode = useCallback((node: Measurable | null) => {
    if (!scrollRef.current || !node?.measureInWindow) return;
    node.measureInWindow((_x, y) => {
      const delta = y - (headerBlockHeight + SCROLL_TO_MARGIN);
      // Clamped at 0 — a node already near the top would otherwise ask for a negative offset,
      // which on iOS bounces the content down past the header and settles back.
      scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + delta), animated: true });
    });
  }, [headerBlockHeight]);

  // The outer SafeAreaView pads the in-flow ScrollView into the safe area — this is
  // what confines scrolling so content can't slide up behind the status bar. So the
  // content padding here only accounts for the floating chrome (header + sticky bar +
  // BottomNav), NOT the insets (adding them here would double-count). The absolute
  // header/bottom blocks apply the insets themselves, since absolute children ignore
  // SafeAreaView's padding. NOTE: on the pager tab scenes the SafeAreaView omits its
  // bottom edge (see `safeAreaEdges` below) — the tab-bar wrapper already owns the
  // bottom inset there, so this ScrollView pads only top/left/right.
  //
  // HEADER_HEIGHT is added to the top so the first content item starts *below* the
  // translucent glass header instead of scrolling behind it on mount (the header still
  // floats, so content slides behind it as the user scrolls — it just doesn't overlap
  // at rest). Without this the greeting/first card renders under the glass header and
  // reads as "the header overlaps the text".
  // Same chrome-clearing padding the ScrollView uses, so a non-scrollable child (which
  // owns its own FlatList) starts below the floating header/sticky bar and clears the
  // bottom nav.
  // Bottom-nav clearance for the 5 pager tab screens (2026-07-19 root-cause fix; superseded
  // 2026-07-26 — see below): originally reserve 0, because the tab bar was react-native-tab-view's
  // plain flex sibling BELOW the scene (tabBarPosition="bottom" → flex column [pager(flex:1),
  // tabBar(fixed)]), so the pager — and this ScrollView — was structurally bounded above the bar
  // and could never render behind it. Any paddingBottom reserve was pure dead space (the ~72px
  // blank band that was reported and fixed by zeroing it).
  //   **2026-07-26**: that flex-sibling layout is also what made the bar's floating rounded
  //   corners always show plain background, never a scrolled card, in their corner notches (user
  //   report: "make the blank area transparent... so a scrolled card shows through") — there was
  //   structurally nothing behind the bar TO show. app/(tabs)/_layout.tsx now renders the real
  //   bar as an absolute overlay instead (hides react-navigation's own tab-bar slot via
  //   `tabBar={() => null}`, which gives the pager the full remaining height), so the scene CAN
  //   render behind it again — this scaffold's own `pagerFloatingNav` prop is what reserves that
  //   screen's clearance now (see its doc).
  //   **2026-08-10**: that reserve used to be shaved by `NAV_PEEK` so the last card's edge could
  //   reach into the bar's corner notch. `NAV_PEEK` is deleted and the reserve is the bar's full
  //   painted footprint again — see the `viewportInset` block below for the reversal.
  //   **2026-08-11**: `bottomNavClearance` is no longer that reserve — it survives only as the
  //   `DebugGeneralNoteButton`'s bottom offset (a float measured from the screen edge, which is
  //   genuinely the bar's whole footprint). The scroll clearance is now split in two — the band
  //   below the card is the viewport's margin, the card's own height is the content's padding —
  //   so content passes behind the bar and the peek comes back as a consequence of the geometry
  //   rather than as a shaved constant. See `viewportInset`.
  //   `pagerTabScene` = these tab scenes, still true whenever `bottomNav` is false (independent of
  //   `pagerFloatingNav`). The outer SafeAreaView still omits its bottom edge for them (see
  //   `safeAreaEdges` below) because `bottomNavClearance` above already folds in `bottomInset`
  //   itself — double-padding it here would re-add a second bottomInset gap.
  //   The non-pager standalone ABSOLUTE nav path (`bottomNav === true`, styles.bottomBlock —
  //   position:absolute, bottom:0, genuinely overlapping) reserves its full painted height
  //   (BOTTOM_NAV_HEIGHT + bottomInset, no peek shave — that bar was never floating/inset the same
  //   way). The Catalogue screen (`scrollable={false}`) is untouched — it self-scrolls and manages
  //   its own notepad bottom gap (protecting the 2026-07-17 fix).
  const pagerTabScene = tier === 'site' && !bottomNav && scrollable;
  // pagerFloatingNav reserves clearance for the pager's overlay bar (see that prop's doc)
  // without this scaffold rendering a second bar of its own — independent of `bottomNav`.
  const reserveBottomNav = tier === 'site' && scrollable && (bottomNav || pagerFloatingNav);
  // The floating-bar branch goes through tabChromeBand so this number and the one an overlay
  // clamps itself to are the same number, not two copies of the same sum.
  const bottomNavClearance = pagerFloatingNav
    ? tabChromeBand(insets, PixelRatio.getFontScale()).bottom
    : BOTTOM_NAV_HEIGHT + bottomInset;
  // 'top' is applied by hand below rather than listed here (2026-08-10). SafeAreaView pads a
  // listed edge with the RAW `insets.top`, while the header block floors the same inset with
  // StatusBar.currentHeight — and the two disagree on Android until the first insets dispatch.
  // The clipped viewport measures down from this box's top, so a smaller value here put the
  // viewport's top edge ABOVE the header's bottom edge and let content render in the
  // difference. Both now use `topInset`, so the clip lines up with the chrome by construction.
  const safeAreaEdges: Edge[] = pagerTabScene ? ['left', 'right'] : ['right', 'bottom', 'left'];
  // Gap between the header band and a screen-owned stickyBelowHeader strip (Plans/
  // Shopping/Settings' tab bars). A 2026-07-20 pass added Spacing.sm here for breathing
  // room, but that extra strip painted `stickyGapColor="transparent"` — a window onto
  // scrolled-past content directly under the header, reading as flickering text sitting
  // "between" the header and tab-bar cards (2026-07-24 fix). Zeroed: the header's own
  // `headerFloatBottom` gap already gives the tab bar breathing room, so this doesn't
  // read as flush/cramped, and there's no separate transparent strip left to leak through.
  const stickyGap = 0;
  // **⚠️ THE CLIP IS THE CHROME'S INNER EDGE (2026-08-18) — this reverses the block below it.**
  // Maintainer: *"even though things are translucent, things like header and bottom nav should
  // still not show elements behind it when user is scrolling, or have scrolled. Only the
  // backdrop."*
  //   The 2026-08-11 design under it is sound arithmetic resting on a premise that expired: it
  // put the clip on the chrome's OUTER footprint and let content scroll the full height of the
  // header and the nav card, "hidden BY them" — true while every Surface was flat and opaque
  // (the 2026-08-05 card reset), and false from 2026-08-15, when the header and the bar became
  // frosted glass with a real BlurView. From that day a scrolled card was legible through both,
  // and the bar's rounded corners had cards moving inside them. Nothing announced the change,
  // because the arithmetic here never mentioned opacity — it only ever assumed it.
  //   So the window is now the gap BETWEEN the two cards: from the header's (or an attached
  // sticky bar's) BOTTOM edge to the nav card's TOP edge, still inset by the same `Spacing.sm`
  // the two cards are. Behind the glass there is only `components/ScreenBackground.tsx`, which
  // is what the maintainer asked for and, incidentally, what the blur was always tuned against.
  //   **What this knowingly gives up** is the 2026-08-10 corner peek — "when cards slide behind
  // the bottom nav, they should be visible in the bottom nav's cut corners at the top". That
  // request and this one are the same question asked twice with opposite answers; this is the
  // later ruling, and it is the more general one (it is about every pixel of the chrome, not
  // about four corners). The two clip edges no longer coincide with an opaque OUTER edge, which
  // the block below correctly says is what makes a cut invisible — that is fine here for the
  // same reason in reverse: the cut happens exactly where a card is covered by the chrome that
  // is about to be drawn over it, so there is no open air on either side of it.
  //   The one rule that survives intact: **one clearance each, never both.** The clip is margin
  // on the wrapper and there is no content padding at all now; put the number back on the
  // content as well and every screen grows a blank band the height of its own header.
  //
  // ── (Historical, 2026-08-11) The clip is the chrome's OUTER edge; the resting gap is padding ──
  // Two rules that have to hold at once, and every earlier cut of this satisfied one by breaking
  // the other:
  //   1. "Nothing should be visible (cards, text, buttons and so on) above the header, or under
  //      the bottom nav" — and nothing in the 8px gutters beside either.
  //   2. "When cards slide behind the bottom nav, they should be visible in the bottom nav's cut
  //      corners at the top, not the two bottom ones — same for the header but the opposite."
  //   The governing fact is simple and was the thing being missed: **a clip edge is invisible
  // only where it coincides with the outer edge of something opaque.** Put it anywhere else and
  // the cut happens in open air, which is what a card sliced across the middle of a blank strip
  // actually is.
  //   So the window is the chrome's OUTER footprint — from the header card's TOP edge to the nav
  // card's BOTTOM edge, inset by the same `Spacing.sm` the two cards are, with `Radius.lg`
  // corners that sit exactly on the header's top corners and the bar's bottom corners. Content
  // scrolls all the way under the (opaque) header and nav cards and is hidden BY them, and the
  // only places it stays visible near the chrome are the two notches rule 2 asks for: beside the
  // header's BOTTOM corners and the bar's TOP corners, both of which are mid-viewport, nowhere
  // near a clip edge. The header's top corners and the bar's bottom corners are covered by the
  // viewport's own matching radius, so nothing peeks there.
  //   What this replaced, and why each attempt couldn't work:
  //   • Padding on a full-bleed ScrollView (until 2026-08-10) — content started below the header
  //     but then scrolled into the status-bar strip, the side gutters and the band under the bar,
  //     none of which any number in here covered. Rule 1 broken.
  //   • `marginTop: contentTopClear` (2026-08-10) — `contentTopClear` includes `headerFloatBottom`,
  //     so the top clip edge sat 8px BELOW the header card, in transparent backdrop. Text was
  //     guillotined mid-glyph with nothing over the cut. Rule 1 kept, at the cost of the bug this
  //     replaced.
  //   • `marginBottom: bottomNavClearance` (2026-08-10) — that total equals the whole nav overlay
  //     block (`app/(tabs)/_layout.tsx`), so the bottom clip edge landed on the bar's NEAR edge.
  //     The notch rule 2 wants a card in is *inside* the bar's rectangle, beside its top-corner
  //     arc — i.e. below that edge. Content could never reach it, whatever the viewport's own
  //     corner radius did, which is why un-rounding those corners (the pass right before this
  //     one) changed nothing on screen.
  //   Keep the two halves consistent: the CLIP is margin on the wrapper, the RESTING gap is
  // padding on the content (`contentPad`). One each. Both on the same side double-counts and
  // every screen grows a blank band; neither, and content starts underneath the header.
  //   **The inset must not move content.** The ScrollView inside takes the mirror-image negative
  // margin (`viewportBleed`), so every card keeps the exact x it had when the window was
  // full-bleed; the 8px this clips off each side is empty backdrop, since every screen's content
  // container already pads by `Spacing.md`. Widen the inset without that and every card on every
  // screen gets narrower.
  const viewportInset = {
    marginHorizontal: headerFloatH,
    // The header card's own height (plus a sticky bar's, when one is attached under it) —
    // the clip edge sits on the chrome's INNER edge, so content stops where the glass starts.
    //
    // ⚠️ **`headerFloatBottom` is subtracted, and that subtraction is the whole point (2026-08-19).**
    // `contentTopClear` folds in the 8px gap between the header card and content, so including it
    // here put the top clip edge 8px BELOW the card — in open air. A card scrolling up was cut by
    // a straight line with nothing over the cut and a strip of backdrop between it and the glass:
    // the "guillotined mid-glyph" failure this file's 2026-08-10 note already recorded once, back
    // for the same reason in a new place. The clip is the chrome's edge; the 8px is the RESTING
    // gap and belongs on the content (`contentPad` below). One clearance each, still — but one
    // each, not both on the margin. (A screen with an attached sticky bar has no gap to subtract:
    // `headerFloatBottom` is already 0 there, and the bar's own bottom edge is the clip.)
    marginTop:
      contentTopClear - headerFloatBottom + (stickyBelowHeader ? stickyBelowHeaderHeight + stickyGap : 0),
    // The nav bar's whole footprint: its card, its float gap and the safe-area band below it.
    // Was split — the band as margin here, the card's height as content padding — which is
    // exactly what let content travel behind the glass. Summed, the clearance is unchanged;
    // what changed is that all of it now CLIPS rather than half of it merely padding.
    marginBottom:
      (pagerFloatingNav ? bottomInset + NAV_FLOAT_GAP : 0) + (reserveBottomNav ? BOTTOM_NAV_HEIGHT : 0),
    // **The corners are back, and they are the OTHER pair (2026-08-19).** The 2026-08-11 radii
    // covered the header's TOP corners and the bar's BOTTOM ones, and this comment said the
    // window no longer reaches either — true, and it missed what the window reaches INSTEAD.
    // Its top edge now lies along the header's BOTTOM corners and its bottom edge along the
    // bar's TOP corners, i.e. exactly the two pairs the maintainer keeps reporting ("upper
    // corners… and lower corners of header box"). A square-cornered window cut against a
    // `Radius.lg` card leaves the sliced card's own 90° corner sitting in the notch where the
    // glass has already curved away — the one place on that edge with nothing over the cut.
    // Rounding the window to the SAME radius lets the cut follow the chrome's corner instead
    // of crossing it, so a card tucks under the glass rather than being guillotined beside it.
    //
    // Both pairs are conditional, on the two separate things that can stop an edge from facing
    // a rounded chrome card. `floatChrome` is the header: `plainBackground` (Settings) draws a
    // flat edge-to-edge app-bar with square corners and no side margins, so a curve there would
    // round content away from a straight edge — the mirror image of this bug. And with no nav
    // reserved, the window's bottom edge is the safe area, i.e. nothing at all.
    borderTopLeftRadius: floatChrome ? Radius.lg : 0,
    borderTopRightRadius: floatChrome ? Radius.lg : 0,
    borderBottomLeftRadius: floatChrome && reserveBottomNav ? Radius.lg : 0,
    borderBottomRightRadius: floatChrome && reserveBottomNav ? Radius.lg : 0,
  };
  const viewportBleed = { marginHorizontal: -headerFloatH };
  // The one thing that is NOT clearance: the 8px resting gap between the header card and the
  // first card, which `viewportInset.marginTop` no longer carries (see the subtraction there).
  // The margin is where the content is CUT, this is where it RESTS, and the two are different
  // numbers for the first time — which is what "one clearance each, never both" always meant.
  // Both halves of the pair must move together: put this number back on the margin as well and
  // every screen grows a blank band the height of its own header, drop it from here and every
  // screen's first card starts flush against the glass.
  const contentPad = { paddingTop: headerFloatBottom, paddingBottom: 0 };

  // The clipping wrapper. Both branches share it so a FlatList screen (scrollable={false})
  // gets exactly the same edges as a ScrollView one — the Catalogue screen used to be the one
  // place with its own bottom-gap arithmetic, and this is what stops that from drifting again.
  const scrollContent = (
    <View style={[styles.viewport, viewportInset]}>
      {scrollable ? (
        <ScrollView
          ref={scrollRef}
          style={[styles.scrollView, viewportBleed]}
          contentContainerStyle={[styles.contentContainer, contentPad]}
          // iOS only, and purely cosmetic: the scroll box now runs the chrome's full height, so
          // without this the indicator would draw behind the header and the bar.
          scrollIndicatorInsets={{ top: contentPad.paddingTop, bottom: contentPad.paddingBottom }}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <ScrollIntoViewContext.Provider value={scrollIntoView}>
            <ScrollToNodeContext.Provider value={scrollToNode}>{children}</ScrollToNodeContext.Provider>
          </ScrollIntoViewContext.Provider>
        </ScrollView>
      ) : (
        // Non-scrollable: children own scrolling (e.g. a FlatList). ScrollIntoViewContext is a
        // no-op here — a self-scrolling FlatList handles keeping its own AddRow above the keyboard.
        // The clearance is padding on this box rather than contentContainer padding, so the
        // child's list is BOUNDED by the chrome instead of scrolling under it — a FlatList owns
        // its own content insets and this scaffold can't reach them. Same resting layout as a
        // ScrollView screen; it just doesn't get the peek.
        <View style={[styles.scrollView, viewportBleed, contentPad]}>
          <ScrollIntoViewContext.Provider value={null}>
            <ScrollToNodeContext.Provider value={null}>{children}</ScrollToNodeContext.Provider>
          </ScrollIntoViewContext.Provider>
        </View>
      )}
    </View>
  );

  const scaffold = (
    // The screen hue wraps the WHOLE scaffold, not just the scroll body, so the floating
    // header card wears the same border colour as the cards under it — one colour per screen,
    // chrome included. BottomNav is outside this tree (app/(tabs)/_layout.tsx renders it once
    // for the whole pager), so it stays neutral by construction, which is correct: it belongs
    // to no single screen.
    <ScreenColorContext.Provider value={screenHue}>
    <SafeAreaView edges={safeAreaEdges} style={[styles.safeArea, { paddingTop: topInset }, ownBackground && { backgroundColor: bgColor }]}>
      {/* L1: Background — skipped when a parent (the tabs pager) already renders a
          shared instance behind this screen (see ownBackground doc above), or when
          plainBackground asks for a flat white/black fill with no accent blob.
          ScreenBackground is the shared blue field + branches (base); HomeHeroBackground
          is now an ADDITIVE focal glow layered ON TOP of it for isHome screens, not a
          standalone backdrop — so render the base always and add the glow on Home. */}
      {ownBackground && !plainBackground && (
        <>
          <ScreenBackground />
          {isHome && <HomeHeroBackground />}
        </>
      )}

      {/* L2: Particle overlay — same ownBackground gating as L1; also dropped for plainBackground. */}
      {ownBackground && !plainBackground && <ParticleBackground />}

      {/* L3: Content — swipe-between-sites navigation now lives one level up, in
          app/(tabs)/_layout.tsx's pager, so tab screens render their scroll content
          directly with no per-screen swipe wrapper. Until 2026-07-31 (A.5) this was wrapped in a
          ScreenColorContext.Provider so every ambient Surface in the body adopted the tab's own
          feat* hue on its edge; that per-screen hue layer is retired, so the body renders bare and
          an un-coded Surface falls through to the neutral theme.border. */}
      {scrollContent}

      {/* L4: Top block (ScreenHeader) — extended up behind the status bar and
          padded down by the top inset so the bar content clears it. */}
      <View
        // box-none (2026-08-10): this block is a full-width zIndex:100 view whose side margins
        // and (on non-sticky screens) bottom gap are transparent. Without this it swallowed
        // every touch aimed at whatever sits under those strips — a ~8px dead gutter down each
        // side of the screen. PagerFloatingNav has always done this; these two never did.
        pointerEvents="box-none"
        style={[
        styles.headerBlock,
        {
          height: headerBlockHeight + HEADER_SEAM_OVERLAP,
          paddingTop: topInset + headerFloatTop,
          paddingBottom: headerFloatBottom,
          paddingHorizontal: headerFloatH,
          // Floating: transparent so the ScreenBackground shows in the side/top gaps around
          // the glass. Non-floating (Settings): keep the flat fill so nothing shows through.
          backgroundColor: floatChrome ? 'transparent' : bgColor,
        },
        plainBackground && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}>
        <ScreenHeader
          // Round the glass only when floating. When a sticky bar is attached directly below
          // (Plans/Shopping/Settings' tab rows) the bottom corners go square so the two read as
          // one card rather than two stacked ones — the slider squares its top corners to match.
          style={[
            styles.headerFill,
            floatChrome && { borderRadius: Radius.lg },
            headerAttachedBelow && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
          ]}
          title={title}
          tier={tier}
          isHome={isHome}
          onBack={onBack}
          headerRight={headerRight}
          onSharePress={onSharePress}
          onScanPress={onScanPress}
          onLayoutPress={onLayoutPress}
        />
      </View>

      {/* L4.5: optional sticky-below-header block (e.g. a screen-owned summary bar).
          The filler strip (stickyGap, currently always 0 — see that const above) is kept as
          a mechanism rather than deleted outright, in case a future caller needs breathing
          room here again; today the block sits directly below the header. */}
      {stickyBelowHeader && (
        <>
          <View pointerEvents="none" style={[styles.stickyGapFiller, { top: headerBlockHeight, height: stickyGap, backgroundColor: stickyGapColor ?? bgColor }]} />
          {/* box-none for the same reason as the header block above — its own side margins are
              transparent and were eating taps. */}
          <View pointerEvents="box-none" style={[styles.stickyBlock, { top: headerBlockHeight + stickyGap, height: stickyBelowHeaderHeight }]}>
            {stickyBelowHeader}
          </View>
        </>
      )}

      {/* L5: Bottom block (BottomNav, site-tier only) — extended down behind the
          navigation bar and padded up by the bottom inset. Tab screens skip this;
          app/(tabs)/_layout.tsx's pager already renders BottomNav as its tab bar. */}
      {tier === 'site' && bottomNav && (
        <View style={[styles.bottomBlock, { height: BOTTOM_NAV_HEIGHT + bottomInset, paddingBottom: bottomInset }]}>
          <BottomNav />
        </View>
      )}

      {/* Floats above whatever bottom chrome this screen has (pager tab bar, standalone
          BottomNav, or just the safe area on a sub-tier screen) — self-gates on
          debugModeEnabled, so every screen gets it for free via this one mount point. */}
      <DebugGeneralNoteButton bottomOffset={(reserveBottomNav ? bottomNavClearance : bottomInset) + Spacing.md} />
    </SafeAreaView>
    </ScreenColorContext.Provider>
  );

  return scaffold;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // The clipped band between the header's bottom edge and the bottom nav's top edge — the one
  // place content is allowed to exist. `overflow: 'hidden'` is the whole mechanism (2026-08-10);
  // without it this is just a differently-spelled padding and every strip leaks again.
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 0,
  },
  headerBlock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  // Stretch the glass header Surface to fill the whole HEADER_HEIGHT band (not just its
  // shrink-wrapped ~40px content height). Without this the strip below the glass was flat
  // theme.bg — dead space at rest and, since headerBlock has zIndex:100, a blank rectangle
  // that covered cards scrolling behind it. Filling it means cards blur under frosted glass
  // (reads intentional) instead of vanishing under an opaque band. `flex` is a non-owned key,
  // so Surface routes it to its outer shadow view and its mask (flexGrow:1) frosts the height.
  headerFill: {
    flex: 1,
  },
  stickyGapFiller: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 99,
  },
  stickyBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 99,
  },
  bottomBlock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
});
