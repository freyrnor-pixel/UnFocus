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
 *             components/ParticleBackground, components/ScreenHeader, components/BottomNav,
 *             components/SiteSwipeView, components/SiteSwipeDots, lib/useAppTheme
 *   Used by → every app screen (app/index.tsx, app/shopping.tsx, etc.)
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
 *   - isHome=true mounts HomeHeroBackground; false uses ScreenBackground
 *   - **swipeNav (Decision 032)**: site-tier screens wrap L3 content in SiteSwipeView
 *     for horizontal swipe-between-sites navigation. Default on. Pass swipeNav={false}
 *     only for a site screen that renders a full-screen camera/QR/media overlay
 *     *inside* the scaffold body, per SiteSwipeView's "don't wrap camera overlays"
 *     contract. No current screen needs it — scan keeps its camera mode outside the
 *     scaffold (a bare SafeAreaView), so all 5 nav sites swipe. Sub-tier ignores it.
 *   - **stickyBelowHeader (added 2026-07-02, Session A2·2)**: optional screen-owned chrome
 *     pinned directly under the header block, e.g. app/shopping.tsx's Decision 011 A2-1
 *     per-list summary/progress bar. Additive, backward-compatible — omit both props and a
 *     screen renders exactly as before. Uses the same absolute-positioned float pattern as
 *     the header/bottom-nav blocks (not ScrollView's `stickyHeaderIndices`, which would sit
 *     underneath the already-absolutely-positioned header). `stickyBelowHeaderHeight` must
 *     match the rendered content's actual height — it drives the ScrollView's top content
 *     padding so the first real content item isn't permanently hidden under the two floating
 *     blocks (mirrors the header's own float, which every current screen already accepts).
 */
import React from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/useAppTheme';
import ScreenBackground from '@/components/ScreenBackground';
import HomeHeroBackground from '@/components/HomeHeroBackground';
import ParticleBackground from '@/components/ParticleBackground';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNav, { BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import SiteSwipeView from '@/components/SiteSwipeView';
import SiteSwipeDots from '@/components/SiteSwipeDots';

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
  /** Focus-mode toggle (Home only, Decisions 009 #4 / 018) — forwarded to the header eye. */
  focusActive?: boolean;
  onToggleFocus?: () => void;
  /**
   * Enable horizontal swipe-to-neighbouring-site navigation (Decision 032). Only
   * applies to `tier === 'site'`. Default true. Pass false only for a site screen
   * that renders a full-screen camera/QR/media overlay *inside* the scaffold body,
   * per SiteSwipeView's "don't wrap camera overlays" contract. (app/scan.tsx does
   * NOT need this — its camera 'scanning' mode is a bare SafeAreaView outside the
   * scaffold, so its scrollable idle/result/manual modes swipe safely.)
   */
  swipeNav?: boolean;
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
  swipeNav = true,
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
  // content padding here only accounts for the floating chrome (sticky bar + BottomNav),
  // NOT the insets (adding them here would double-count). The absolute header/bottom
  // blocks apply the insets themselves, since absolute children ignore SafeAreaView's padding.
  const scrollContent = (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.contentContainer,
        !!stickyBelowHeader && { paddingTop: stickyBelowHeaderHeight },
        tier === 'site' && { paddingBottom: BOTTOM_NAV_HEIGHT },
      ]}
      scrollIndicatorInsets={{
        bottom: tier === 'site' ? BOTTOM_NAV_HEIGHT : 0,
      }}
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      {/* L1: Background */}
      {isHome ? (
        <HomeHeroBackground />
      ) : (
        <ScreenBackground />
      )}

      {/* L2: Particle overlay */}
      <ParticleBackground />

      {/* L3: Content — site-tier screens wrap in SiteSwipeView for swipe-between-sites
          navigation (Decision 032); the pan gesture yields to vertical ScrollView
          scrolling via SiteSwipeView's activeOffsetX/failOffsetY thresholds. */}
      {tier === 'site' && swipeNav ? (
        <SiteSwipeView>{scrollContent}</SiteSwipeView>
      ) : (
        scrollContent
      )}

      {/* L4: Top block (ScreenHeader) — extended up behind the status bar and
          padded down by the top inset so the bar content clears it. */}
      <View style={[styles.headerBlock, { height: HEADER_HEIGHT + topInset, paddingTop: topInset }]}>
        <ScreenHeader
          title={title}
          tier={tier}
          onBack={onBack}
          headerRight={headerRight}
          focusActive={focusActive}
          onToggleFocus={onToggleFocus}
        />
      </View>

      {/* L4.5: optional sticky-below-header block (e.g. a screen-owned summary bar) */}
      {stickyBelowHeader && (
        <View style={[styles.stickyBlock, { top: HEADER_HEIGHT + topInset, height: stickyBelowHeaderHeight }]}>
          {stickyBelowHeader}
        </View>
      )}

      {/* L4.8: swipe-between-sites page dots — sits just above BottomNav, signalling
          the sites form a swipeable strip (Decision 032 had no visual affordance).
          Only on swipeable site screens; pointer-events off so it never blocks touches. */}
      {tier === 'site' && swipeNav && (
        <View style={[styles.swipeDotsBlock, { bottom: BOTTOM_NAV_HEIGHT + bottomInset + 6 }]} pointerEvents="none">
          <SiteSwipeDots />
        </View>
      )}

      {/* L5: Bottom block (BottomNav, site-tier only) — extended down behind the
          navigation bar and padded up by the bottom inset. */}
      {tier === 'site' && (
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
  swipeDotsBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
});
