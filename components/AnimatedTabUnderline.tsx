/**
 * AnimatedTabUnderline.tsx — the active-tab underline for the hand-rolled top tab bars
 * (Tasks, Shopping, Settings, Shared), fading in/out as the active tab changes instead of
 * hard-swapping a `borderBottom` on/off.
 *
 * Drop inside a tab's Pressable (which must be the default position: relative). Renders an
 * absolutely-positioned 2px bar pinned to the tab's bottom edge — so, unlike a toggled
 * `borderBottomWidth`, it never shifts the tab's text by the border width when (de)activating.
 *
 * Connections:
 *   Imports → react-native-reanimated (FadeIn/FadeOut), constants/motion, constants/theme,
 *             lib/useAppTheme (useAccessibility)
 *   Used by → app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx, app/settings.tsx, app/shared.tsx
 *   Data    → none (driven by `active`)
 *
 * Edit notes:
 *   - Returns null when inactive; the fade-out plays as React unmounts it (exiting), the
 *     fade-in when it mounts. reducedMotion skips both.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Duration } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useAccessibility } from '@/lib/useAppTheme';

type Props = { active: boolean; color: string };

export default function AnimatedTabUnderline({ active, color }: Props) {
  const { reducedMotion } = useAccessibility();
  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      entering={reducedMotion ? undefined : FadeIn.duration(Duration.control)}
      exiting={reducedMotion ? undefined : FadeOut.duration(Duration.control)}
      style={[styles.underline, { backgroundColor: color }]}
    />
  );
}

const styles = StyleSheet.create({
  underline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    borderRadius: Radius.full,
  },
});
