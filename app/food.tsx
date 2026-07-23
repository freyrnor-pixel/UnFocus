/**
 * food.tsx — dish library + push-to-list ("Food" sub-screen).
 *
 * Sub-screen (Decision 001 tier='sub') hosting components/FoodTab unchanged — only where
 * it mounts moved here (UX audit F1, 2026-07-23): Food used to be one of Shopping's four
 * sticky in-place tabs; it's visited far less often than Weekly/Monthly, so it's now a
 * button-launched screen instead of a permanent tab-bar peer. Reached via a "Food" button
 * on app/(tabs)/shopping.tsx (`foodCatalogueLinks`).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/ConfirmationBanner, components/FoodTab,
 *             constants/theme, lib/i18n
 *   Used by → Expo Router route "/food"; pushed from app/(tabs)/shopping.tsx's "Food" button
 *   Data    → none directly — FoodTab itself drives store/useMealStore + store/useShoppingStore
 *             (push-to-list) + store/useCatalogStore (ingredient autocomplete)
 *
 * Edit notes:
 *   - `onNotify` (FoodTab's confirmation-toast callback) is wired to a local
 *     ConfirmationBanner here — the same controlled-toast pattern every other screen uses,
 *     just no longer shared with Weekly/Monthly's own toast state now that Food isn't
 *     mounted alongside them.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import FoodTab from '@/components/FoodTab';
import { useT } from '@/lib/i18n';
import { Spacing } from '@/constants/theme';

export default function FoodScreen() {
  const router = useRouter();
  const t = useT();
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  return (
    <>
      <ScreenScaffold title={t.foodTabLabel} tier="sub" onBack={() => router.back()}>
        <View style={styles.content}>
          <FoodTab onNotify={setConfirmMessage} />
        </View>
      </ScreenScaffold>
      <ConfirmationBanner message={confirmMessage} onDismiss={() => setConfirmMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
});
