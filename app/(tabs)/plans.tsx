/**
 * plans.tsx — the To-do tab ("Gjøremål"), one of the app's 3 sites.
 *
 * A thin wrapper (2026-08-20, "full-screen card expansion" pass): the tab took over Health's
 * bottom-nav slot and dropped its Today/This week/All tasks `TabSlider` in favour of four
 * always-stacked cards, each independently expandable to fill the screen. All of that content —
 * state, hooks, the four cards — lives in components/TodoSurface.tsx now; this file is the
 * ScreenScaffold shell around it, the same shape app/(tabs)/index.tsx and app/(tabs)/shopping.tsx
 * already are. `app/plans.tsx` (a pushed sub-screen, tier='sub', onBack) is what this file used
 * to be — see TodoSurface's own header for the full history and reasoning.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/TodoSurface, components/ConfirmationBanner,
 *             components/LayoutPickerSheet, lib/i18n, lib/useAppTheme, store/useSettingsStore
 *   Used by → Expo Router route "/plans" — one of 3 co-mounted pager tabs under
 *             app/(tabs)/_layout.tsx; reached from "I dag" via components/PlanTaskCard.tsx's
 *             header link (which now switches the pager tab rather than pushing)
 *   Data    → none directly — all of it lives in TodoSurface
 *
 * Edit notes:
 *   - **The day-reset ConfirmationBanner lives HERE, not in TodoSurface.** A banner must be a
 *     SIBLING of ScreenScaffold, never a child (lib/__tests__/toastPlacement.test.ts asserts
 *     this for every caller) — nested inside TodoSurface it would land inside ScreenScaffold's
 *     clipped scroll viewport. TodoSurface's "Put the day away" button calls `onDayReset(ids,
 *     message)`; this screen holds the ids/message and does the actual undo
 *     (`setTasksDated(ids, true)`), the same controlled-toast split app/food.tsx and
 *     app/catalogue.tsx already use for FoodTab/CatalogueTab's `onNotify`.
 *   - **The layout picker is opened from ScreenScaffold's header** (`onLayoutPress`), which is
 *     why its state lives here too, not in TodoSurface — TodoSurface calls `useSurfaceLayout
 *     ('plans')` independently and needs nothing passed down for it to work.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ScreenScaffold from '@/components/ScreenScaffold';
import TodoSurface from '@/components/TodoSurface';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import LayoutPickerSheet from '@/components/LayoutPickerSheet';
import ManageCardsSheet from '@/components/ManageCardsSheet';
import TourTarget from '@/components/TourTarget';
import { useT } from '@/lib/i18n';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { useTaskStore } from '@/store/useTaskStore';
import { Spacing } from '@/constants/theme';

export default function TasksScreen() {
  const router = useRouter();
  const t = useT();
  const featureSharing = useSettingsStore((s) => s.featureSharing) && SHARING_VISIBLE;
  const setTasksDated = useTaskStore((s) => s.setTasksDated);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [manageCardsOpen, setManageCardsOpen] = useState(false);

  const [dayResetUndoIds, setDayResetUndoIds] = useState<string[] | null>(null);
  const [dayResetMessage, setDayResetMessage] = useState<string | null>(null);

  function handleDayReset(ids: string[], message: string) {
    setDayResetUndoIds(ids);
    setDayResetMessage(message);
  }
  function handleDayResetUndo() {
    if (!dayResetUndoIds) return;
    setTasksDated(dayResetUndoIds, true);
    setDayResetUndoIds(null);
    setDayResetMessage(null);
  }

  return (
    <>
      <ScreenScaffold
        title={t.tasksTitle}
        tier="site"
        screenKey="plans"
        bottomNav={false}
        pagerFloatingNav
        ownBackground={false}
        onSharePress={featureSharing ? () => router.push('/share-modal?kind=t') : undefined}
        onLayoutPress={() => setLayoutPickerOpen(true)}
        onManageCardsPress={() => setManageCardsOpen(true)}
      >
        <View style={styles.content}>
          <TourTarget id="tour.plans.today">
            <TodoSurface onDayReset={handleDayReset} />
          </TourTarget>
        </View>
        <LayoutPickerSheet visible={layoutPickerOpen} surface="plans" onClose={() => setLayoutPickerOpen(false)} />
        <ManageCardsSheet visible={manageCardsOpen} screen="todo" onClose={() => setManageCardsOpen(false)} />
      </ScreenScaffold>
      <ConfirmationBanner
        message={dayResetMessage}
        onDismiss={() => setDayResetMessage(null)}
        duration={5000}
        actionLabel={t.dayResetUndo}
        onAction={handleDayResetUndo}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Tab-tier content pads horizontally only (2026-08-19 seam pass) — the first card meets the
  // header's glass flush; TodoSurface itself adds no horizontal padding of its own (see its
  // header note) because it's mounted a second way, inside CardExpandHost, which supplies its
  // own inset.
  content: { paddingHorizontal: Spacing.md },
});
