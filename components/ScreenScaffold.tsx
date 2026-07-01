/**
 * ScreenScaffold.tsx — universal screen layout wrapper implementing Decision 001.
 *
 * Composes the complete screen stack: background layers, particle overlay,
 * content, and material-aware chrome (header + optional bottom nav). Tier-aware:
 * 'site' screens render both chrome blocks; 'sub' screens render only the header
 * with a back link (iOS) instead of Settings/Focus buttons.
 *
 * Connections:
 *   Imports → react-native, components/ScreenBackground, components/HomeHeroBackground,
 *             components/ParticleBackground, components/ScreenHeader, components/BottomNav,
 *             lib/useAppTheme
 *   Used by → every app screen (app/index.tsx, app/shopping.tsx, etc.)
 *   Data    → none (presentational; all logic in child screens)
 *
 * Edit notes:
 *   - Layer order is critical: L1 background → L2 particles → L3 content → L4 top block → L5 bottom block
 *   - ParticleBackground gating (particlesEnabled + reducedMotion) happens inside the component
 *   - Top and bottom blocks float above content with translucency — content scrolls behind them
 *   - SafeAreaView handles insets; blocks are positioned absolutely
 *   - isHome=true mounts HomeHeroBackground; false uses ScreenBackground
 */
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
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
};

export default function ScreenScaffold({
  title,
  tier,
  children,
  isHome = false,
  onBack,
  headerRight,
}: Props) {
  const theme = useAppTheme();

  const HEADER_HEIGHT = 56;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.cream }]}>
      {/* L1: Background */}
      {isHome ? (
        <HomeHeroBackground />
      ) : (
        <ScreenBackground />
      )}

      {/* L2: Particle overlay */}
      <ParticleBackground />

      {/* L3: Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          tier === 'site' && { paddingBottom: BOTTOM_NAV_HEIGHT },
        ]}
        scrollIndicatorInsets={{
          bottom: tier === 'site' ? BOTTOM_NAV_HEIGHT : 0,
        }}
      >
        {children}
      </ScrollView>

      {/* L4: Top block (ScreenHeader) */}
      <View style={[styles.headerBlock, { height: HEADER_HEIGHT }]}>
        <ScreenHeader
          title={title}
          tier={tier}
          onBack={onBack}
          headerRight={headerRight}
        />
      </View>

      {/* L5: Bottom block (BottomNav, site-tier only) */}
      {tier === 'site' && (
        <View style={[styles.bottomBlock, { height: BOTTOM_NAV_HEIGHT }]}>
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
  bottomBlock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
});
