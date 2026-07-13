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
 *   Imports → react-native (LayoutAnimation/Platform/UIManager), expo-router (useFocusEffect),
 *             store/useSettingsStore, lib/useAppTheme (useAccessibility)
 *   Used by → app/(tabs)/index.tsx, app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx
 *   Data    → reads/writes useSettingsStore.seenScreenHints (persisted)
 *
 * Edit notes:
 *   - Reads the store via getState() inside the focus callback so the effect doesn't
 *     re-run when unrelated settings change — it only cares about the value at focus time.
 *   - Returns the same [open, setOpen] tuple shape a screen's header ⓘ toggle expects.
 *   - The returned setter is wrapped so EVERY open/close (first-visit auto-open, blur
 *     collapse, and the screen's header ⓘ toggle — all four tab screens route through this
 *     one setter) runs LayoutAnimation.configureNext first. HintCard's noPill body is
 *     conditionally rendered by the parent's `open` prop, so configuring the animation right
 *     before the state flip is what makes that mount/unmount slide instead of pop. Gated on
 *     reducedMotion per ANIMATION_GUIDELINES §7; matches the pill path's own toggle and lands
 *     in the 200–300 ms card band (§1). The self-managed pill path in HintCard keeps its own
 *     LayoutAnimation call — this only covers the header-driven noPill path.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAccessibility } from '@/lib/useAppTheme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export function useFirstVisitHint(
  key: string
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [hintOpen, setHintOpen] = useState(false);
  const { reducedMotion } = useAccessibility();

  // Wrap the raw setter so the hint body's mount/unmount animates. Stable identity via
  // useMemo so screens can pass it straight into onInfoToggle without re-subscribing.
  const setHintOpenAnimated = useMemo<React.Dispatch<React.SetStateAction<boolean>>>(
    () => (value) => {
      if (!reducedMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setHintOpen(value);
    },
    [reducedMotion]
  );

  useFocusEffect(
    useCallback(() => {
      const { seenScreenHints, markScreenHintSeen } = useSettingsStore.getState();
      if (!seenScreenHints.includes(key)) {
        setHintOpenAnimated(true);
        markScreenHintSeen(key);
      }
      return () => setHintOpenAnimated(false);
    }, [key, setHintOpenAnimated])
  );

  return [hintOpen, setHintOpenAnimated];
}
