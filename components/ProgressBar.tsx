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
 *   - **The track is a translucent wash, never `surfaceMuted`** — see TRACK_ALPHA's note. Pass
 *     `trackColor="transparent"` for a bar that must reserve its height while having nothing to
 *     say (components/PlanTaskCard.tsx's day bar on a day with no countable tasks).
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useAppTheme, useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { Duration } from '@/constants/motion';
import { rgba } from '@/constants/theme';

/**
 * The default track: a translucent wash of the ink over whatever the bar is sitting on, NOT a
 * darker surface token.
 *
 * ⚠️ **This is the fix for "a hard black rule inside I dag" (2026-08-27, round 20's stray
 * artefacts).** The track was `theme.surfaceMuted`, which is an OPAQUE token meaning "sunken
 * surface" — and in dark that is `#121212` against a `#242424` card, i.e. 18 steps DARKER than
 * the thing it sits on. A bar at value 0 therefore drew as a black slot cut into the card, and
 * on the Today card (whose bar is deliberately always mounted — see PlanTaskCard) an empty day
 * showed nothing BUT that slot.
 *   It was not always wrong: `surfaceMuted` was 12 steps under a `#1E1E1E` surface when this was
 * written, and the 2026-08-26 lift of `surface` to `#242424` widened the gap without anything
 * re-checking a component that names the token rather than a relationship. That is the reusable
 * half — an opaque "one step down" token stops meaning one step down the moment the step above
 * it moves. A wash is defined against its own ground, so it cannot drift that way.
 */
const TRACK_ALPHA = { dark: 0.1, light: 0.12 } as const;

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
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const animatedWidth = useSharedValue(0);
  const pct = Math.max(0, Math.min(1, value));

  useEffect(() => {
    const targetWidth = pct * 100;
    if (reducedMotion) {
      animatedWidth.value = targetWidth;
    } else {
      animatedWidth.value = withTiming(targetWidth, {
        duration: Duration.value,
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
        {
          height,
          borderRadius: height / 2,
          backgroundColor:
            trackColor ?? rgba(theme.text, TRACK_ALPHA[isDark ? 'dark' : 'light']),
        },
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
