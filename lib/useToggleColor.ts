/**
 * useToggleColor.ts — animate a control's background/border between an inactive→active
 * colour pair as a boolean `active` flips, so "selected/active" state crossfades instead
 * of hard-swapping.
 *
 * Returns a Reanimated animated style you spread onto an Animated.View. Only colours that
 * don't affect layout are animated (backgroundColor / borderColor); the icon or text colour
 * is left to swap instantly on top of the fading fill — the same convention SlideSelector
 * uses (the eye tracks the moving/fading surface, not the label). No animated icon needed.
 *
 * Connections:
 *   Imports → react-native-reanimated, constants/motion (Duration, Ease), lib/useAppTheme (useAccessibility)
 *   Used by → components/IconButton, components/Badge (Chip), components/FormControls (Checkbox)
 *   Data    → none (driven by the `active` arg)
 *
 * Edit notes:
 *   - reducedMotion snaps (sets the shared value directly, no timing).
 *   - Pass a same-hue 0-alpha colour (e.g. rgba(accent, 0)) as the inactive endpoint rather
 *     than 'transparent' when the active colour is opaque, so the fade doesn't dip through a
 *     muddy mid-tone.
 */
import { useEffect } from 'react';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility } from '@/lib/useAppTheme';

type ColorPair = readonly [inactive: string, active: string];

export function useToggleColor(
  active: boolean,
  colors: { backgroundColor?: ColorPair; borderColor?: ColorPair },
) {
  const { reducedMotion } = useAccessibility();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? active
        ? 1
        : 0
      : withTiming(active ? 1 : 0, { duration: Duration.control, easing: Ease.enter });
  }, [active, reducedMotion, progress]);

  return useAnimatedStyle(() => {
    const style: { backgroundColor?: string; borderColor?: string } = {};
    if (colors.backgroundColor) {
      style.backgroundColor = interpolateColor(progress.value, [0, 1], colors.backgroundColor);
    }
    if (colors.borderColor) {
      style.borderColor = interpolateColor(progress.value, [0, 1], colors.borderColor);
    }
    return style;
  });
}
