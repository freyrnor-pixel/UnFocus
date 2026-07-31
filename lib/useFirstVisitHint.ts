/**
 * useFirstVisitHint.ts — collapsed-by-default open/close state for a screen's ⓘ hint.
 *
 * Drop-in replacement for the `const [hintOpen, setHintOpen] = useState(false)` +
 * blur-reset `useFocusEffect` pattern the tab screens used: the hint starts closed, the
 * screen's header ⓘ toggles it, and focus loss collapses it again.
 *
 * **The hint no longer auto-opens on first visit (2026-07-31).** It used to greet
 * first-time users on Home and Shopping — that greeting, and the per-screen `autoOpen`
 * arg that switched it off elsewhere, are both gone: the ⓘ card is now collapsed until
 * tapped, on every screen, from first launch. What that greeting used to teach in context
 * (Home's plan-notification/weekly-reminder opt-in, Shopping's weekly/monthly reset
 * cadence) is unchanged and unmoved — it still lives in those hint bodies, now reached by
 * a deliberate ⓘ tap.
 *
 * Connections:
 *   Imports → react-native (LayoutAnimation/Platform/UIManager), expo-router (useFocusEffect),
 *             store/useSettingsStore, lib/useAppTheme (useAccessibility)
 *   Used by → app/(tabs)/index.tsx, app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx, app/(tabs)/habits.tsx, app/goals.tsx
 *   Data    → writes useSettingsStore.seenScreenHints (persisted; write-only — nothing
 *             reads it any more, see the edit note below)
 *
 * Edit notes:
 *   - `seenScreenHints` is now WRITE-ONLY BY DESIGN. With the auto-open removed there is
 *     no behavioural read of it left anywhere; the marking write (and its settings field +
 *     DB column) are kept deliberately so a later phase can reintroduce a first-visit
 *     affordance without having lost who has already seen what. Don't "clean it up".
 *   - Reads the store via getState() inside the focus callback so the effect doesn't
 *     re-run when unrelated settings change — it only cares about the value at focus time.
 *   - Returns the same [open, setOpen] tuple shape a screen's header ⓘ toggle expects.
 *   - The returned setter is wrapped so EVERY open/close (blur collapse and the screen's
 *     header ⓘ toggle — all six screens route through this one setter) runs
 *     LayoutAnimation.configureNext first. HintCard's noPill body is
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
        // WRITE-ONLY ON PURPOSE (2026-07-31): nothing reads seenScreenHints any more — the
        // first-visit auto-open it used to gate is gone and the ⓘ now stays collapsed until
        // tapped. The record is still kept so a future first-visit affordance can tell who
        // has already been past a screen; it is not dead code to be tidied away.
        markScreenHintSeen(key);
      }
      return () => setHintOpenAnimated(false);
    }, [key, setHintOpenAnimated])
  );

  return [hintOpen, setHintOpenAnimated];
}
