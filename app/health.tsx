/**
 * health.tsx — health/symptom log, back-compat route.
 *
 * **Health left the bottom nav on 2026-08-20** ("full-screen card expansion" pass) and became a
 * Home card instead (components/HomeHealthCard.tsx, which grows to fill the screen in place —
 * see components/CardExpandHost.tsx). This file survives only for deep links and back-compat;
 * nothing in the UI pushes to it any more. It used to be `app/(tabs)/health.tsx`, a co-mounted
 * pager tab (tier='site', BottomNav) — see components/HealthSurface.tsx's own header for the
 * full extraction history and reasoning; that file now holds all of this screen's real content.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HealthSurface, lib/i18n
 *   Used by → Expo Router route "/health" — deep links only
 *   Data    → none directly — HealthSurface drives store/useHealthStore
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import HealthSurface from '@/components/HealthSurface';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';

export default function HealthScreen() {
  const router = useRouter();
  const t = useT();

  return (
    <ScreenScaffold title={t.healthTitle} tier="sub" screenKey="health" onBack={() => router.back()}>
      <View style={styles.content}>
        <HealthSurface />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
});
