/**
 * useFirstVisitHint.ts — open/dismiss state for a screen's inline intro card.
 *
 * The card is OPEN by default and stays open until the user closes it, at which point it is
 * gone for that screen until Settings → General → "Show tips again" brings every one back.
 *
 * **This was a header-ⓘ toggle until 2026-08-13.** Maintainer: *"Having the info button in the
 * header section with settings showing when you press it makes No sense. Instead the
 * instructions should be in the screen with examples like a introduction part (users can of
 * course close the card)."* So the ⓘ button is deleted from `components/ScreenHeader.tsx` and
 * this hook stopped being a toggle: an explanation you have to know to ask for is an
 * explanation nobody reads, and a button that opens a panel containing SETTINGS is not an
 * info button at all (Shopping's carried the weekly/monthly reset controls — they moved to
 * Settings → Personal in the same pass).
 *
 * The history is worth keeping because this is the third position on the same question: the
 * hint auto-opened on first visit until 2026-07-31, was collapsed-until-tapped from then until
 * now, and is now open-until-closed. What changed between the first and third is that closing
 * it now PERSISTS — the 2026-07-31 removal was of a greeting that reappeared, which is a
 * different thing from a card you can put away for good.
 *
 * Connections:
 *   Imports → react-native (LayoutAnimation/Platform/UIManager), expo-router (useFocusEffect),
 *             store/useSettingsStore, lib/useAppTheme (useAccessibility)
 *   Used by → app/(tabs)/index.tsx, app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx, app/(tabs)/habits.tsx
 *   Data    → reads/writes useSettingsStore.dismissedHints; still writes seenScreenHints
 *
 * Edit notes:
 *   - **`dismissedHints` and `seenScreenHints` are different facts and must stay separate.**
 *     "Seen" is written on every focus and records that you have been past a screen;
 *     "dismissed" records that you asked for the explanation to go away. Reusing the older
 *     column would have started every existing install with all five cards already closed —
 *     i.e. nobody who has used the app would ever meet the surface that replaced the ⓘ.
 *     `seenScreenHints` stays write-only; see its own note in store/useSettingsStore.ts.
 *   - **No collapse-on-blur any more.** The old hook returned
 *     `() => setHintOpenAnimated(false)` from its focus effect so a toggled-open hint tidied
 *     itself away when you left. An intro card that closed itself on every tab switch would
 *     read as broken — the card's own "X" is the only thing that closes it now.
 *   - Subscribes to `dismissedHints` (not `getState()`) so pressing "Show tips again" in
 *     Settings brings the cards back without a remount.
 *   - LayoutAnimation on the dismiss so the card slides out rather than popping. Gated on
 *     reducedMotion per ANIMATION_GUIDELINES §7.
 */
import { useCallback, useMemo } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAccessibility } from '@/lib/useAppTheme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

/**
 * @param key screen id — 'home' | 'plans' | 'shopping' | 'habits' | 'health'
 * @returns `[open, dismiss]` — whether to render the intro card, and the card's "X" handler.
 */
export function useFirstVisitHint(key: string): [boolean, () => void] {
  const { reducedMotion } = useAccessibility();
  const dismissedHints = useSettingsStore((s) => s.dismissedHints);
  const open = !dismissedHints.includes(key);

  const dismiss = useMemo(
    () => () => {
      if (!reducedMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      useSettingsStore.getState().dismissHint(key);
    },
    [key, reducedMotion]
  );

  useFocusEffect(
    useCallback(() => {
      const { seenScreenHints, markScreenHintSeen } = useSettingsStore.getState();
      if (!seenScreenHints.includes(key)) {
        // Still WRITE-ONLY (2026-07-31), and still deliberately kept: it records who has been
        // past a screen, which `dismissedHints` does not and must not. See this file's header.
        markScreenHintSeen(key);
      }
    }, [key])
  );

  return [open, dismiss];
}
