/**
 * ProgressBar.tsx — flat themed progress track (e.g. tasks-done-today, habit streak fill).
 *
 * Smooth animation when value changes via shared animated value. Uses 250ms ease-out
 * transition matching the design system.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, react-native-reanimated
 *   Used by → any screen wanting a simple 0..1 progress indicator
 *   Data    → none (controlled by `value` prop)
 *
 * Edit notes:
 *   - `value` is clamped to [0, 1]; callers compute done/total themselves.
 *   - Animation uses 250ms ease-out (standard card transition timing).
 *   - Respects reducedMotion by snapping without animation.
 *   - `state` picks the semantic fill token (good/bad/warn); `color`/`trackColor` still
 *     win if explicitly passed, for one-off overrides.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';

type Props = {
  value: number;
  state?: 'good' | 'bad' | 'warn';
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ProgressBar({ value, state, color, trackColor, height = 8, style }: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const animatedWidth = useSharedValue(0);
  const pct = Math.max(0, Math.min(1, value));

  useEffect(() => {
    const targetWidth = pct * 100;
    if (reducedMotion) {
      animatedWidth.value = targetWidth;
    } else {
      animatedWidth.value = withTiming(targetWidth, {
        duration: 250,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [pct, reducedMotion, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  const stateFill = state === 'good' ? theme.good : state === 'bad' ? theme.bad : state === 'warn' ? theme.warn : theme.accent;

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? theme.surfaceMuted },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          animatedStyle,
          { height, borderRadius: height / 2, backgroundColor: color ?? stateFill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
