/**
 * health.tsx — the Health tab: symptom log, open episodes, and the medicine trays.
 *
 * ⚠️ **It is a bottom-nav tab AGAIN as of 2026-08-22** (maintainer: *"5 screens might be needed
 * again, so we can split at least into Shopping, To-do, Home, Habits and Health"*). Its history
 * in one line: a tab until the 2026-08-20 "full-screen card expansion" pass took it off the bar,
 * then a card on the Me tab (components/HomeHealthCard.tsx) with this file surviving only as a
 * back-compat route nothing linked to, and now a `<TopTabs.Screen>` again. The Home card is gone
 * with the restoration — a card AND a tab for one surface is the duplication worth avoiding.
 *
 * **Medicine lives here now**, as a peer card beside the symptom content rather than as a card
 * drawn inside Health's own Surface (the card-in-a-card CONSISTENCY_AUDIT.md §11 measured). It
 * had been its own card on the Me tab since 2026-08-21; a tray of pills is health, and the Me
 * tab it sat on no longer exists in that form. ⚠️ It is gated on `settings.featureMedicine`, and
 * the gate is at HealthSurface's render site — a flag that hides a surface must hide it wherever
 * the surface is mounted.
 *
 * ⚠️ **The CONTENT of this screen lives in components/HealthSurface.tsx** (extracted 2026-08-20).
 * This file is the ScreenScaffold shell around it, the same shape app/(tabs)/plans.tsx has around
 * TodoSurface and app/(tabs)/habits.tsx has around HabitsSurface. That surface is mounted a
 * second way — non-embedded here, `embedded` inside components/CardExpandHost.tsx — so it
 * supplies no horizontal inset of its own and this screen's `content` wrapper is what insets its
 * cards from the screen edge.
 *
 * ⚠️ **The 2026-07-23 E1 finding binds here**: Habits used to live INSIDE this tab, and had to be
 * split back out because a tab whose name promises symptom tracking must not hide a whole habit
 * system. Habits is its own tab again; don't fold it back in for tidiness. Medicine is not the
 * same case — it is health, and it is a visible peer card, not a system buried in another one.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HealthSurface, lib/i18n, constants/theme
 *   Used by → Expo Router route "/health" — one of 5 co-mounted pager tabs under
 *             app/(tabs)/_layout.tsx
 *   Data    → none directly — HealthSurface drives store/useHealthStore and useMedicineStore
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ScreenScaffold from '@/components/ScreenScaffold';
import HealthSurface from '@/components/HealthSurface';
import ManageCardsSheet from '@/components/ManageCardsSheet';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';

export default function HealthScreen() {
  const t = useT();
  const [manageCardsOpen, setManageCardsOpen] = useState(false);

  return (
    <ScreenScaffold
      title={t.healthTitle}
      tier="site"
      screenKey="health"
      bottomNav={false}
      pagerFloatingNav
      ownBackground={false}
      onManageCardsPress={() => setManageCardsOpen(true)}
    >
      <View style={styles.content}>
        <HealthSurface />
      </View>
      <ManageCardsSheet visible={manageCardsOpen} screen="health" onClose={() => setManageCardsOpen(false)} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  // Tab-tier content pads horizontally only (2026-08-19 seam pass): the first card meets the
  // header's glass flush, and the bottom edge is the nav bar's, which the scaffold reserves.
  content: { paddingHorizontal: Spacing.md },
});
