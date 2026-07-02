/**
 * SaveButton.tsx — Inline save button that appears when an input becomes dirty.
 *
 * A small button that fades in (opacity 0→1, scale 0.92→1) over 150ms when the input
 * value changes. Positioned to the right of the input field. Used for text/number/time
 * inputs in settings.
 *
 * Connections:
 *   Imports → react-native-reanimated, constants/theme, lib/useAppTheme
 *   Used by → app/settings.tsx (name input, monthly date, monthly budget, reminder time)
 *             — not ported yet; this is a leaf ahead of its screen
 *   Data    → controlled via `visible`; fires `onPress` callback
 *
 * Edit notes:
 *   - Uses react-native-reanimated v4 (withTiming for opacity + scale)
 *   - Button is disabled when not visible (opacity < 1)
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
  useSharedValue,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { FontSize, Fonts } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

export interface SaveButtonProps {
  visible: boolean;
  onPress: () => void;
  label: string;
}

const ANIMATION_DURATION = 150; // 150ms per spec

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SaveButton({ visible, onPress, label }: SaveButtonProps) {
  const theme = useAppTheme();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.ease,
      });
      scale.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.ease,
      });
    } else {
      opacity.value = withTiming(0, {
        duration: ANIMATION_DURATION,
        easing: Easing.ease,
      });
      scale.value = withTiming(0.92, {
        duration: ANIMATION_DURATION,
        easing: Easing.ease,
      });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.button, animatedStyle, { backgroundColor: theme.accent }]}
      onPress={onPress}
      disabled={!visible}
      hitSlop={6}
    >
      <Text style={[styles.text, { color: theme.accentInk }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
  },
});
