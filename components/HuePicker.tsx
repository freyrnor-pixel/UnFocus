/**
 * HuePicker.tsx — single-row hue strip for a future "custom" theme.
 *
 * The user picks ONE hue (0-360); saturation/lightness are meant to be fixed by
 * a hueToCustomColors()-style helper so every derived token stays contrast-safe.
 * The strip itself is built from plain colored View segments (no native gradient
 * dependency) with a draggable thumb on top.
 *
 * Connections:
 *   Imports → constants/theme, react-native-gesture-handler, react-native-reanimated
 *   Used by → app/settings.tsx (custom theme section) — not ported yet; this is a
 *             leaf ahead of its screen, not wired into anything live
 *   Data    → none (controlled: value/onChange only)
 *
 * Edit notes:
 *   - Decision 006/007 defer the runtime "custom" 7th theme (no hueToCustomColors(),
 *     no custom entry in ThemeName/colors.ts) — this component is ported as an inert
 *     leaf only, same "ahead of its screen" pattern as every other Phase 3 composite.
 *     Do not wire it into settings.tsx or build the custom-theme runtime from this
 *     port; that remains its own decision when the settings screen phase runs.
 *   - The strip's segment colours come from hslToHex() directly (a fixed rainbow
 *     sweep, not app chrome) — no Decision 006 token applies here, same precedent
 *     as QRCodeDisplay's black/white modules.
 *   - The thumb's position is driven by a Reanimated shared value updated
 *     synchronously on the UI thread via Gesture.Pan(), not by the `value`
 *     prop re-rendering — that's deliberate. A settings screen subscribing to
 *     the whole settings store would trigger a heavy re-render on every
 *     onChange() during a drag; if the thumb's position depended on that
 *     round trip it would visibly lag/snap back toward its start. `dragging`
 *     guards the external→internal sync effect so a mid-drag prop update
 *     can't fight the live gesture.
 *   - minDistance(0) so the gesture activates on first touch — this is a
 *     tap-to-jump-or-drag strip, not a swipe that needs a travel threshold.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { hslToHex } from '@/constants/theme';

type Props = {
  value: number;
  onChange: (hue: number) => void;
  height?: number;
};

const SEGMENTS = 36;

export default function HuePicker({ value, onChange, height = 36 }: Props) {
  const width = useSharedValue(0);
  const ratio = useSharedValue(value / 360);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) ratio.value = value / 360;
  }, [value, ratio]);

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  const setDragging = (v: boolean) => {
    dragging.current = v;
  };

  const moveTo = (x: number) => {
    'worklet';
    if (width.value <= 0) return;
    const r = Math.min(1, Math.max(0, x / width.value));
    ratio.value = r;
    runOnJS(onChange)(Math.round(r * 360));
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onStart((e) => {
      runOnJS(setDragging)(true);
      moveTo(e.x);
    })
    .onUpdate((e) => {
      moveTo(e.x);
    })
    .onEnd(() => {
      runOnJS(setDragging)(false);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${ratio.value * 100}%`,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.wrap, { height }]} onLayout={onLayout}>
        <View style={[styles.strip, { borderRadius: height / 2 }]}>
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <View
              key={i}
              style={[styles.segment, { backgroundColor: hslToHex(i / SEGMENTS, 0.65, 0.55) }]}
            />
          ))}
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            thumbStyle,
            {
              height: height + 8,
              width: height + 8,
              borderRadius: (height + 8) / 2,
              marginLeft: -(height + 8) / 2,
              marginTop: -(height + 8) / 2,
              backgroundColor: hslToHex(value / 360, 0.62, 0.5),
            },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
  },
  strip: {
    flexDirection: 'row',
    overflow: 'hidden',
    height: '60%',
  },
  segment: {
    flex: 1,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
