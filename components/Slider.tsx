/**
 * Slider.tsx — a dragged numeric control: a track, a fill, and a thumb you move with a finger.
 *
 * The app had no slider until 2026-08-07, which is why every number in it is a −/+
 * `components/Stepper.tsx`. A stepper is right for a small count (energy −3…+3, a daily goal)
 * and wrong for a range you are *searching* rather than counting: the design lab's
 * `radiusScale` is 0–3 in steps of 0.05, i.e. sixty taps end to end, and you cannot feel your
 * way to an answer one tap at a time. This is the control for that shape of question — and it
 * is also what the lab's own `number → slider` variant has been promising and silently
 * falling back to a stepper for.
 *
 * Connections:
 *   Imports → lib/slider (the pure mapping), constants/theme, constants/motion,
 *             lib/useAppTheme (useAppTheme, useAccessibility, useScaledStyles), lib/haptics,
 *             react-native-gesture-handler, react-native-reanimated
 *   Used by → components/Stepper.tsx (the design lab's `number → slider` variant),
 *             app/design-lab.tsx (every shape knob),
 *             components/ColorPickerSheet.tsx (hue / saturation / lightness)
 *   Data    → none (controlled — the parent owns the value)
 *
 * Edit notes:
 *   - **The thumb is driven by a shared value, the parent by `onChange`, and the two are
 *     deliberately not the same clock.** The thumb follows the finger on the UI thread at
 *     screen rate; `onChange` fires only when the SNAPPED value actually changes. Binding the
 *     thumb to the prop instead would re-render the whole owning screen once per pixel, which
 *     on the design lab means re-theming the app under your own finger.
 *   - **The pan needs `activeOffsetX` and must not claim the vertical axis.** Every real call
 *     site sits inside a ScrollView; a pan that activates at zero distance eats the scroll.
 *     Tap-to-jump is therefore a SEPARATE `Gesture.Tap` raced against the pan, not
 *     `minDistance(0)`.
 *   - One `selection()` per step CROSSED — the helper ANIMATION_GUIDELINES §4 names for
 *     sliders. Never per update: at 0.02 steps a drag would fire a continuous buzz.
 *   - The touch area is `MIN_TAP_TARGET` tall while the visible track is a few px. That gap is
 *     the point — don't "tidy" it by shrinking the container to the track.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MIN_TAP_TARGET, Radius } from '@/constants/theme';
import { Duration, Ease } from '@/constants/motion';
import { ratioFromValue, stepIndex, valueFromRatio } from '@/lib/slider';
import { selection } from '@/lib/haptics';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

/** The visible bar. Thin on purpose — the target is the container, not the bar. */
const TRACK_HEIGHT = 6;
/** The grab handle. 22 matches the row check (constants/theme.ts RowTrailing.checkSize). */
const THUMB_SIZE = 22;
/** How far the thumb swells while held, so the finger covering it still shows movement. */
const THUMB_HELD_SCALE = 1.25;
/** Horizontal slack before the pan claims the gesture — below this, the ScrollView keeps it. */
const PAN_ACTIVATE_X = 4;

type Props = {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  /** 0 means "no snapping" — a continuous slider, which also fires no per-step haptic. */
  step?: number;
  disabled?: boolean;
  /** Paints the fill and the thumb edge. Defaults to the theme accent. */
  color?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  color,
  accessibilityLabel,
  style,
}: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);
  const fill = color ?? theme.accent;

  // UI-thread state: where the thumb is (0-1) and how big it is right now.
  const progress = useSharedValue(ratioFromValue(value, min, max));
  const thumbScale = useSharedValue(1);
  const trackWidth = useSharedValue(0);

  // JS-thread mirrors. The gesture callbacks hop to JS via runOnJS and would otherwise close
  // over a stale render's props — the same refs-not-closures rule lib/useDragReorder.ts follows.
  const held = useRef(false);
  const lastStep = useRef(stepIndex(value, min, max, step));
  const bounds = useRef({ min, max, step });
  bounds.current = { min, max, step };

  // Follow the prop whenever the finger is NOT down. While it is, the thumb is the finger's
  // and a prop echo would fight it (a parent that clamps or rounds differently would stutter).
  useEffect(() => {
    if (held.current) return;
    progress.value = ratioFromValue(value, min, max);
    lastStep.current = stepIndex(value, min, max, step);
  }, [value, min, max, step, progress]);

  const commit = useCallback(
    (ratio: number) => {
      const b = bounds.current;
      const next = valueFromRatio(ratio, b.min, b.max, b.step);
      const index = stepIndex(next, b.min, b.max, b.step);
      if (index === lastStep.current) return;
      lastStep.current = index;
      selection();
      onChange(next);
    },
    [onChange],
  );

  const setHeld = useCallback((down: boolean) => {
    held.current = down;
  }, []);

  const grow = (up: boolean) => {
    'worklet';
    const to = up ? THUMB_HELD_SCALE : 1;
    thumbScale.value = reducedMotion ? to : withTiming(to, { duration: Duration.control, easing: Ease.enter });
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    // Horizontal only: the vertical axis belongs to whatever is scrolling behind this.
    .activeOffsetX([-PAN_ACTIVATE_X, PAN_ACTIVATE_X])
    .failOffsetY([-PAN_ACTIVATE_X * 3, PAN_ACTIVATE_X * 3])
    .onStart(() => {
      runOnJS(setHeld)(true);
      grow(true);
    })
    .onUpdate((e) => {
      const width = trackWidth.value;
      if (width <= 0) return;
      const ratio = Math.min(1, Math.max(0, e.x / width));
      progress.value = ratio;
      runOnJS(commit)(ratio);
    })
    .onFinalize(() => {
      runOnJS(setHeld)(false);
      grow(false);
    });

  const jump = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((e) => {
      const width = trackWidth.value;
      if (width <= 0) return;
      const ratio = Math.min(1, Math.max(0, e.x / width));
      progress.value = ratio;
      runOnJS(commit)(ratio);
    });

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
    transform: [{ translateX: -THUMB_SIZE / 2 }, { scale: thumbScale.value }],
  }));

  /** Keyboard / screen-reader nudges — one step, the same as the stepper this replaces. */
  const nudge = (direction: 1 | -1) => {
    const b = bounds.current;
    const width = b.max - b.min;
    if (width <= 0) return;
    const current = ratioFromValue(value, b.min, b.max);
    const delta = (b.step > 0 ? b.step : width / 20) / width;
    const next = valueFromRatio(current + delta * direction, b.min, b.max, b.step);
    if (next !== value) onChange(next);
  };

  return (
    <GestureDetector gesture={Gesture.Race(pan, jump)}>
      <View
        style={[styles.container, disabled && styles.disabled, style]}
        onLayout={(e) => {
          trackWidth.value = e.nativeEvent.layout.width;
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={ACCESSIBILITY_ACTIONS}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') nudge(1);
          else if (e.nativeEvent.actionName === 'decrement') nudge(-1);
        }}
      >
        <View style={[styles.track, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <Animated.View style={[styles.fill, { backgroundColor: fill }, fillStyle]} />
        </View>
        <Animated.View
          style={[styles.thumb, { backgroundColor: theme.surface, borderColor: fill }, thumbStyle]}
        />
      </View>
    </GestureDetector>
  );
}

const ACCESSIBILITY_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

const baseStyles = StyleSheet.create({
  // Tall enough to hit, however thin the bar inside it is drawn.
  container: { minHeight: MIN_TAP_TARGET, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: Radius.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: Radius.full },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  disabled: { opacity: 0.4 },
});
