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
 *             lib/useAppTheme, lib/screenColor (ScreenColorContext — per-screen frosted tint,
 *             provided to the scroll body only), store/useSettingsStore (debugModeEnabled → debug band outline)
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
 *   - ParticleBackground gating (particlesEnabled + reducedMotion) happens inside the component
 *   - Top and bottom blocks float above content with translucency — content scrolls behind them
 *   - Safe-area handling is SPLIT (Android edge-to-edge is always on in RN 0.85 / Expo 56, so
 *     content draws behind the status + nav bars):
 *       • The outer SafeAreaView pads the in-flow ScrollView into the safe area — this confines
 *         scrolling so content can't slide up behind the status bar.
 *       • The header/bottom blocks are position:absolute and DON'T inherit that padding (absolute
 *         children ignore a parent's padding in current Yoga), so they apply the insets themselves:
 *         header height/paddingTop += topInset, bottom-nav height/paddingBottom += bottomInset.
 *     topInset floors insets.top with StatusBar.currentHeight on Android as a safety net for the
 *     brief window where safe-area-context can report 0 before the first insets dispatch.
 *   - isHome=true mounts HomeHeroBackground; false uses ScreenBackground — only when
 *     ownBackground is true (see below)
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
 *   - **stickyBelowHeader (added 2026-07-02, Session A2·2)**: optional screen-owned chrome
 *     pinned directly under the header block, e.g. app/shopping.tsx's Decision 011 A2-1
 *     per-list summary/progress bar. Additive, backward-compatible — omit both props and a
 *     screen renders exactly as before. Uses the same absolute-positioned float pattern as
 *     the header/bottom-nav blocks (not ScrollView's `stickyHeaderIndices`, which would sit
 *     underneath the already-absolutely-positioned header). `stickyBelowHeaderHeight` must
 *     match the rendered content's actual height — it drives the ScrollView's top content
 *     padding so the first real content item isn't permanently hidden under the two floating
 *     blocks (mirrors the header's own float, which every current screen already accepts).
 *   - **headerBlock backgroundColor (visual-audit fix, 2026-07-11)**: `headerBlock` has an
 *     explicit height (`HEADER_HEIGHT + topInset`), but `ScreenHeader`'s glass `Surface`
 *     shrink-wraps to its own (shorter) content height, leaving a transparent sliver at the
 *     bottom of the block that let scrolled-past L3 content show through unblurred — most
 *     visible on Settings, where `stickyBelowHeader` sits glued right under it. Fixed by
 *     giving `headerBlock` `backgroundColor: theme.bg` so any shortfall is covered by the
 *     page background instead of a hole.
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
 *     can own scrolling with a virtualising FlatList. Used by app/(tabs)/shopping.tsx on the
 *     Catalogue tab, whose ~286-row list can't virtualise inside a same-axis ScrollView (nested
 *     VirtualizedList). ScrollToEndContext is a no-op in this mode — a self-scrolling FlatList
 *     manages keeping its own AddRow above the keyboard.
 *   - **contentPadding's bottom reservation is gated on `bottomNav`, not just `tier`
 *     (bug fix, 2026-07-17)**: previously `paddingBottom: BOTTOM_NAV_HEIGHT` applied whenever
 *     `tier === 'site'`, full stop. But the 5 pager tab screens (app/(tabs)/*) all pass
 *     `bottomNav={false}` — app/(tabs)/_layout.tsx's pager already renders the real BottomNav
 *     as a SIBLING tab-bar container, and react-navigation sizes each page to stop exactly
 *     above it, so those screens' own box never actually overlaps the real nav. Reserving
 *     BOTTOM_NAV_HEIGHT again here double-counted that clearance for every screen that
 *     currently exists (no real screen passes `bottomNav={true}` today). On a ScrollView
 *     screen this only wasted a bit of scroll-past-the-end padding, easy to miss. On the
 *     Catalogue tab's non-scrollable FlatList box (`scrollable={false}`, see above), the same
 *     padding shrinks a real flex-bounded viewport, so the list hard-clipped ~72dp above where
 *     the nav actually sits, leaving a bare gap even on a long, fully-populated list — reported
 *     as a "cut off" bug. Fixed by keying both `contentPadding.paddingBottom` and the
 *     ScrollView's `scrollIndicatorInsets.bottom` on `tier === 'site' && bottomNav` instead.
 */
import React, { useCallback, useRef } from 'react';
import { Keyboard, NativeScrollEvent, NativeSyntheticEvent, PixelRatio, Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getHeaderMetrics } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { ScreenColorContext } from '@/lib/screenColor';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenBackground from '@/components/ScreenBackground';
import HomeHeroBackground from '@/components/HomeHeroBackground';
import ParticleBackground from '@/components/ParticleBackground';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';

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

/** Extra gap left between the lifted row's bottom and the top of the keyboard. */
const KEYBOARD_MARGIN = 16;

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
  /** Focus-mode toggle (Home only, Decisions 009 #4 / 018) — forwarded to the header. */
  focusActive?: boolean;
  onToggleFocus?: () => void;
  /** Info/hint toggle — forwarded to the header ⓘ button. */
  infoActive?: boolean;
  onInfoToggle?: () => void;
  /**
   * Whether this screen renders its own BottomNav block. Only applies to
   * `tier === 'site'`. Default true. The 5 tab sites (app/(tabs)/*) pass false,
   * since app/(tabs)/_layout.tsx's pager already renders BottomNav as its tab bar —
   * without this a tab screen would get two bottom nav bars stacked.
   */
  bottomNav?: boolean;
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
   * Per-screen dominant hue (lib/screenColor.ts) — provided to the scroll body only (NOT the
   * header/chrome, which stay neutral), so every ambient Surface in this screen's content
   * picks it up as its frosted tint. The 5 tab screens pass their screen colour; sub-tier
   * screens omit it (Surfaces fall back to the neutral surface base). See ScreenColorContext.
   */
  screenColor?: string;
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
  focusActive,
  onToggleFocus,
  infoActive,
  onInfoToggle,
  bottomNav = true,
  ownBackground = true,
  plainBackground = false,
  screenColor,
  onScroll,
  scrollable = true,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  // Flat backdrop colour for plainBackground screens (Settings): true white/black, no tint.
  const bgColor = plainBackground ? (isDark ? '#000000' : '#FFFFFF') : theme.bg;
  // Android edge-to-edge (RN 0.85 / Expo 56) draws content behind the status and
  // navigation bars. The header/bottom blocks are position:absolute, and absolute
  // children do NOT inherit the SafeAreaView's padding in current Yoga, so top:0 /
  // bottom:0 land behind the system bars. Apply the insets to the floating chrome
  // explicitly. (The in-flow ScrollView still gets its inset padding from the
  // SafeAreaView, so scroll content keeps clearing the bars as before.)
  const insets = useSafeAreaInsets();
  // Debug-mode band outline (see the headerBlock style below). Field selector, so this
  // only re-renders when the toggle itself flips.
  const debugModeEnabled = useSettingsStore((s) => s.debugModeEnabled);
  // Belt-and-suspenders for Android: if safe-area-context under-reports the top
  // inset (it can read 0 before the first window-insets dispatch), fall back to
  // the reliable native status-bar height so the header never sits behind the
  // notification bar. Math.max avoids double-counting when insets.top is correct.
  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
    : insets.top;
  const bottomInset = insets.bottom;

  // Header band height scales with the OS text-size setting so the title's line box always
  // fits inside Surface's overflow:hidden mask. getHeaderMetrics derives band + title
  // fontSize/lineHeight together from the same capped scale — and the title Text consumes
  // them with allowFontScaling={false}, so RN can't rescale them a second time (Android
  // treats style fontSize/lineHeight as SP and multiplies by the font scale when scaling
  // is on — the double-scaling behind the header-clip bug; see the getHeaderMetrics doc in
  // constants/theme.ts and HEADER_CLIP_DEBUG.md). ~73 at 1.0x, ~89 at the 1.4x cap.
  const { headerHeight: HEADER_HEIGHT } = getHeaderMetrics(PixelRatio.getFontScale());

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

  // The outer SafeAreaView pads the in-flow ScrollView into the safe area — this is
  // what confines scrolling so content can't slide up behind the status bar. So the
  // content padding here only accounts for the floating chrome (header + sticky bar +
  // BottomNav), NOT the insets (adding them here would double-count). The absolute
  // header/bottom blocks apply the insets themselves, since absolute children ignore
  // SafeAreaView's padding.
  //
  // HEADER_HEIGHT is added to the top so the first content item starts *below* the
  // translucent glass header instead of scrolling behind it on mount (the header still
  // floats, so content slides behind it as the user scrolls — it just doesn't overlap
  // at rest). Without this the greeting/first card renders under the glass header and
  // reads as "the header overlaps the text".
  // Same chrome-clearing padding the ScrollView uses, so a non-scrollable child (which
  // owns its own FlatList) starts below the floating header/sticky bar and clears the
  // bottom nav.
  // bottomNav gates the reservation, not just tier: the 5 pager tab screens (Shopping/
  // Plans/Home/Health/Scan) all pass bottomNav={false} because app/(tabs)/_layout.tsx's
  // pager already renders the real BottomNav as a SIBLING tab-bar container — react-
  // navigation sizes each page to stop exactly above it, so this screen's own box never
  // overlaps the real nav. Reserving BOTTOM_NAV_HEIGHT here too (previously keyed on
  // `tier === 'site'` alone, true for every real screen) double-counted that clearance:
  // harmless-looking extra scroll-past-the-end padding on ScrollView screens, but a hard,
  // visible shortfall on Catalogue's non-scrollable FlatList box (bug report 2026-07-17 —
  // the list hard-clipped ~72dp above where the real nav actually sits, leaving a bare gap).
  const reserveBottomNav = tier === 'site' && bottomNav;
  const contentPadding = {
    paddingTop: HEADER_HEIGHT + (stickyBelowHeader ? stickyBelowHeaderHeight : 0),
    ...(reserveBottomNav ? { paddingBottom: BOTTOM_NAV_HEIGHT } : null),
  };

  const scrollContent = scrollable ? (
    <ScrollView
      ref={scrollRef}
      style={styles.scrollView}
      contentContainerStyle={[styles.contentContainer, contentPadding]}
      scrollIndicatorInsets={{
        bottom: reserveBottomNav ? BOTTOM_NAV_HEIGHT : 0,
      }}
      keyboardShouldPersistTaps="handled"
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      <ScrollIntoViewContext.Provider value={scrollIntoView}>{children}</ScrollIntoViewContext.Provider>
    </ScrollView>
  ) : (
    // Non-scrollable: children own scrolling (e.g. a FlatList). ScrollIntoViewContext is a
    // no-op here — a self-scrolling FlatList handles keeping its own AddRow above the keyboard.
    <View style={[styles.scrollView, contentPadding]}>
      <ScrollIntoViewContext.Provider value={null}>{children}</ScrollIntoViewContext.Provider>
    </View>
  );

  const scaffold = (
    <SafeAreaView style={[styles.safeArea, ownBackground && { backgroundColor: bgColor }]}>
      {/* L1: Background — skipped when a parent (the tabs pager) already renders a
          shared instance behind this screen (see ownBackground doc above), or when
          plainBackground asks for a flat white/black fill with no accent blob. */}
      {ownBackground && !plainBackground && (isHome ? <HomeHeroBackground /> : <ScreenBackground />)}

      {/* L2: Particle overlay — same ownBackground gating as L1; also dropped for plainBackground. */}
      {ownBackground && !plainBackground && <ParticleBackground />}

      {/* L3: Content — swipe-between-sites navigation now lives one level up, in
          app/(tabs)/_layout.tsx's pager, so tab screens render their scroll content
          directly with no per-screen swipe wrapper. Wrapped in ScreenColorContext so this
          screen's ambient Surfaces adopt the per-screen frosted tint; the header/chrome
          (L4/L5) sit OUTSIDE this provider and stay neutral. */}
      <ScreenColorContext.Provider value={screenColor ?? null}>
        {scrollContent}
      </ScreenColorContext.Provider>

      {/* L4: Top block (ScreenHeader) — extended up behind the status bar and
          padded down by the top inset so the bar content clears it. */}
      <View style={[
        styles.headerBlock,
        { height: HEADER_HEIGHT + topInset, paddingTop: topInset, backgroundColor: bgColor },
        plainBackground && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        // Debug mode: BLUE outline = the header band's extent. Legend with the RED
        // (Surface) + GREEN (title frame) outlines in ScreenHeader.tsx — one tester
        // screenshot then shows exactly which box any clipping belongs to.
        debugModeEnabled && styles.debugBandOutline,
      ]}>
        <ScreenHeader
          style={styles.headerFill}
          title={title}
          tier={tier}
          isHome={isHome}
          onBack={onBack}
          headerRight={headerRight}
          focusActive={focusActive}
          onToggleFocus={onToggleFocus}
          infoActive={infoActive}
          onInfoToggle={onInfoToggle}
        />
      </View>

      {/* L4.5: optional sticky-below-header block (e.g. a screen-owned summary bar) */}
      {stickyBelowHeader && (
        <View style={[styles.stickyBlock, { top: HEADER_HEIGHT + topInset, height: stickyBelowHeaderHeight }]}>
          {stickyBelowHeader}
        </View>
      )}

      {/* L5: Bottom block (BottomNav, site-tier only) — extended down behind the
          navigation bar and padded up by the bottom inset. Tab screens skip this;
          app/(tabs)/_layout.tsx's pager already renders BottomNav as its tab bar. */}
      {tier === 'site' && bottomNav && (
        <View style={[styles.bottomBlock, { height: BOTTOM_NAV_HEIGHT + bottomInset, paddingBottom: bottomInset }]}>
          <BottomNav />
        </View>
      )}
    </SafeAreaView>
  );

  return scaffold;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
  // Debug-mode-only header-band outline (BLUE) — see the legend note on headerBlock above.
  debugBandOutline: {
    borderWidth: 1,
    borderColor: '#2962FF',
  },
});
