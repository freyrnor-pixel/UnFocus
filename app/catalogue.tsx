/**
 * catalogue.tsx — master item catalogue ("Catalogue" sub-screen).
 *
 * Sub-screen (Decision 001 tier='sub') hosting components/CatalogueTab unchanged — only
 * where it mounts moved here (UX audit F1, 2026-07-23): Catalogue used to be one of
 * Shopping's four sticky in-place tabs; it's visited far less often than Weekly/Monthly,
 * so it's now a button-launched screen instead of a permanent tab-bar peer. Reached via a
 * "Catalogue" button on app/(tabs)/shopping.tsx (`foodCatalogueLinks`).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/ConfirmationBanner, components/CatalogueTab,
 *             lib/i18n
 *   Used by → Expo Router route "/catalogue"; pushed from app/(tabs)/shopping.tsx's
 *             "Catalogue" button
 *   Data    → none directly — CatalogueTab itself drives store/useCatalogStore
 *
 * Edit notes:
 *   - `scrollable={false}` (same as Shopping's old Catalogue tab) — CatalogueTab renders
 *     its own virtualising FlatList, so ScreenScaffold must not ALSO wrap it in a
 *     ScrollView (nested same-axis VirtualizedList).
 *   - No `header` prop passed to CatalogueTab — the old shared `shoppingIntro` (weekly/
 *     monthly reset-day hint + incoming shared requests) was specific to those two tabs
 *     and doesn't belong on this now-standalone screen.
 *   - `onNotify` wired to a local ConfirmationBanner, same controlled-toast pattern every
 *     other screen uses.
 */
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import CatalogueTab from '@/components/CatalogueTab';
import { useT } from '@/lib/i18n';

export default function CatalogueScreen() {
  const router = useRouter();
  const t = useT();
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  return (
    <>
      <ScreenScaffold title={t.catalogueTabLabel} tier="sub" onBack={() => router.back()} scrollable={false}>
        <CatalogueTab onNotify={setConfirmMessage} />
      </ScreenScaffold>
      <ConfirmationBanner message={confirmMessage} onDismiss={() => setConfirmMessage(null)} />
    </>
  );
}
