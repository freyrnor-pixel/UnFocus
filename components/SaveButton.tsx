/**
 * SaveButton.tsx — Inline save button that appears when an input becomes dirty.
 *
 * A small button that fades in (opacity 0→1, scale 0.92→1) over 150ms when the input
 * value changes. Positioned to the right of the input field. Used for text/number/time
 * inputs in settings.
 *
 * Connections:
 *   Imports → react-native-reanimated, constants/theme, lib/useAppTheme, lib/haptics
 *   Used by → app/settings.tsx (name input, monthly date, monthly budget, reminder time)
 *             — not ported yet; this is a leaf ahead of its screen
 *   Data    → controlled via `visible`; fires `onPress` callback
 *
 * Edit notes:
 *   - Uses react-native-reanimated v4 (withTiming for opacity + scale)
 *   - Button is disabled when not visible (opacity < 1)
 *   - Press feedback is a second `pressScale` shared value multiplied into the same
 *     transform as the entrance/exit `scale` (PressableScale's timing: 80ms down,
 *     spring back) — kept separate so press-in/out never fights the visibility tween.
 *   - `theme` prop dropped in favor of internal useAppTheme() — established Phase 3
 *     convention (see NoteRow.tsx/MonthlyTableRow.tsx headers). Fill is `accent`,
 *     text is `accentInk` (Decision 006 fill/text-on-fill pairing).
 *   - `label` is required, no hardcoded Norwegian default (old source defaulted to
 *     'Lagre') — same no-hardcoded-fallback rule StickySaveBar.tsx already states in
 *     its own header; the caller passes `t.save`.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  withTiming,
  withSpring,
  useSharedValue,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { FontSize, Fonts, Radius } from '@/constants/theme';
import { Spring } from '@/constants/motion';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { tap as hapticTap } from '@/lib/haptics';

export interface SaveButtonProps {
  visible: boolean;
  onPress: () => void;
  label: string;
}

const ANIMATION_DURATION = 150; // 150ms per spec

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SaveButton({ visible, onPress, label }: SaveButtonProps) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      // Entrance: ease-out so it settles in quickly (ANIMATION_GUIDELINES §2).
      opacity.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      scale.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      // Exit: ease-in.
      opacity.value = withTiming(0, {
        duration: ANIMATION_DURATION,
        easing: Easing.in(Easing.cubic),
      });
      scale.value = withTiming(0.92, {
        duration: ANIMATION_DURATION,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [visible, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value * pressScale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.button, animatedStyle, { backgroundColor: theme.accent }]}
      onPress={() => {
        if (!visible) return;
        hapticTap();
        onPress();
      }}
      onPressIn={() => {
        if (!visible) return;
        if (!reducedMotion) pressScale.value = withTiming(0.95, { duration: 80 });
      }}
      onPressOut={() => {
        if (!reducedMotion) pressScale.value = withSpring(1, Spring.snappy);
      }}
      disabled={!visible}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !visible }}
      // Button is 34px tall — pad the tap area to clear the 44px minimum target.
      hitSlop={8}
    >
      <Text style={[styles.text, { color: theme.accentInk }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
  },
});
