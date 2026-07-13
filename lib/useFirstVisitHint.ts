/**
 * useFirstVisitHint.ts — auto-open a screen's ⓘ hint on the user's first visit.
 *
 * Drop-in replacement for the `const [hintOpen, setHintOpen] = useState(false)` +
 * blur-reset `useFocusEffect` pattern the tab screens used. On the first focus where
 * `key` isn't yet in settings.seenScreenHints, it opens the hint and records the key so
 * it won't auto-open again; on blur it collapses the hint (same as before). This is how
 * the settings the old onboarding wizard collected are now taught in context — the
 * relevant screen's hint (with the setting embedded) greets first-time users.
 *
 * Connections:
 *   Imports → expo-router (useFocusEffect), store/useSettingsStore
 *   Used by → app/(tabs)/index.tsx, app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx
 *   Data    → reads/writes useSettingsStore.seenScreenHints (persisted)
 *
 * Edit notes:
 *   - Reads the store via getState() inside the focus callback so the effect doesn't
 *     re-run when unrelated settings change — it only cares about the value at focus time.
 *   - Returns the same [open, setOpen] tuple shape a screen's header ⓘ toggle expects.
 */
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSettingsStore } from '@/store/useSettingsStore';

export function useFirstVisitHint(
  key: string
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [hintOpen, setHintOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const { seenScreenHints, markScreenHintSeen } = useSettingsStore.getState();
      if (!seenScreenHints.includes(key)) {
        setHintOpen(true);
        markScreenHintSeen(key);
      }
      return () => setHintOpen(false);
    }, [key])
  );

  return [hintOpen, setHintOpen];
}
