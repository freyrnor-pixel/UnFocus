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
 *             lib/useAppTheme
 *   Used by → every app screen (app/(tabs)/index.tsx, app/(tabs)/shopping.tsx, etc.)
 *   Data    → none (presentational; all logic in child screens)
 *
 * Edit notes:
 *   - Layer order is critical: L1 background → L2 particles → L3 content → L4 top block →
 *     L4.5 optional sticky-below-header block → L5 bottom block
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
 */
import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/useAppTheme';
import ScreenBackground from '@/components/ScreenBackground';
import HomeHeroBackground from '@/components/HomeHeroBackground';
import ParticleBackground from '@/components/ParticleBackground';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';

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
  /** Forwarded to the internal ScrollView — e.g. to cancel an in-flight FlightOverlay
   *  animation on scroll (components/FlightOverlay.tsx). Omit for identical behavior. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
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
  onScroll,
}: Props) {
  const theme = useAppTheme();
  // Android edge-to-edge (RN 0.85 / Expo 56) draws content behind the status and
  // navigation bars. The header/bottom blocks are position:absolute, and absolute
  // children do NOT inherit the SafeAreaView's padding in current Yoga, so top:0 /
  // bottom:0 land behind the system bars. Apply the insets to the floating chrome
  // explicitly. (The in-flow ScrollView still gets its inset padding from the
  // SafeAreaView, so scroll content keeps clearing the bars as before.)
  const insets = useSafeAreaInsets();
  // Belt-and-suspenders for Android: if safe-area-context under-reports the top
  // inset (it can read 0 before the first window-insets dispatch), fall back to
  // the reliable native status-bar height so the header never sits behind the
  // notification bar. Math.max avoids double-counting when insets.top is correct.
  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
    : insets.top;
  const bottomInset = insets.bottom;

  const HEADER_HEIGHT = 56;

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
  const scrollContent = (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: HEADER_HEIGHT + (stickyBelowHeader ? stickyBelowHeaderHeight : 0) },
        tier === 'site' && { paddingBottom: BOTTOM_NAV_HEIGHT },
      ]}
      scrollIndicatorInsets={{
        bottom: tier === 'site' ? BOTTOM_NAV_HEIGHT : 0,
      }}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 16 : undefined}
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safeArea, ownBackground && { backgroundColor: theme.bg }]}>
      {/* L1: Background — skipped when a parent (the tabs pager) already renders a
          shared instance behind this screen (see ownBackground doc above). */}
      {ownBackground && (isHome ? <HomeHeroBackground /> : <ScreenBackground />)}

      {/* L2: Particle overlay — same ownBackground gating as L1. */}
      {ownBackground && <ParticleBackground />}

      {/* L3: Content — swipe-between-sites navigation now lives one level up, in
          app/(tabs)/_layout.tsx's pager, so tab screens render their scroll content
          directly with no per-screen swipe wrapper. */}
      {scrollContent}

      {/* L4: Top block (ScreenHeader) — extended up behind the status bar and
          padded down by the top inset so the bar content clears it. */}
      <View style={[styles.headerBlock, { height: HEADER_HEIGHT + topInset, paddingTop: topInset, backgroundColor: theme.bg }]}>
        <ScreenHeader
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
