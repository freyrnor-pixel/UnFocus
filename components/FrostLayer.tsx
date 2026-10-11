/**
 * FrostLayer.tsx — the blurred slice of the backdrop that sits behind one pane.
 *
 * Mounted by components/Surface.tsx as the first child of a pane's clipped mask, under its tint
 * and its content. It draws `assets/backdrop/tree-*-frost.jpg` — the backdrop painting, blurred
 * once offline — at the WINDOW's size and position, then shifts it by the pane's own window
 * offset so the pane shows exactly the part of the blurred painting that is behind it. Read
 * lib/frost.ts first for why this replaces a live blur.
 *
 * Geometry, and why it holds:
 *   - The image box is the window (useWindowDimensions) with the same `contentFit="cover"` +
 *     `contentPosition="bottom"` as components/TreeBackdrop.tsx, so both map the painting onto
 *     the screen identically.
 *   - Vertical: the pane's window y is measured at a known scroll offset and stored as
 *     `restY = y + scrollY`. While scrolling, `translateY = -(restY - scrollY)` on the UI
 *     thread — the pane moves up, its slice moves down by the same amount. Re-measured on
 *     layout and on every `frostEpoch` bump (scroll end, content size change).
 *   - Horizontal: `x mod window width`. Pager pages sit whole widths apart, so this is the
 *     pane's on-screen x once its page is the one showing. Mid-swipe the slice travels with the
 *     pane — invisible at this blur radius.
 *   - A stale measurement costs a misplaced blur, never a crash or a layout change: the layer
 *     is absolutely positioned, `pointerEvents="none"`, and clipped by the pane.
 *
 * Connections:
 *   Imports → expo-image, react-native-reanimated, lib/frost, lib/useAppTheme (useIsDark),
 *             assets/backdrop/tree-{dark,light}-frost.jpg
 *   Used by → components/Surface.tsx
 *   Data    → none
 */
import React, { useCallback, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { frostEpoch, type FrostState } from '@/lib/frost';
import { useIsDark } from '@/lib/useAppTheme';

const FROST_DARK = require('@/assets/backdrop/tree-dark-frost.jpg');
const FROST_LIGHT = require('@/assets/backdrop/tree-light-frost.jpg');

type Props = {
  scrollY: FrostState['scrollY'];
  /**
   * The pane's own tint (and lit ramp), drawn OVER the blurred slice. It has to be here rather
   * than on the pane: a pane's background paints under its children, and this layer is a child,
   * so a tint left on the pane would sit underneath the image and tint nothing.
   */
  overlay?: StyleProp<ViewStyle>;
};

function FrostLayer({ scrollY, overlay }: Props) {
  const isDark = useIsDark();
  const { width, height } = useWindowDimensions();
  const anchor = useRef<View>(null);
  const restX = useSharedValue(0);
  const restY = useSharedValue(0);

  const measure = useCallback(() => {
    anchor.current?.measureInWindow((x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      restX.value = ((x % width) + width) % width;
      restY.value = y + (scrollY ? scrollY.value : 0);
    });
  }, [restX, restY, scrollY, width]);

  // Re-measure whenever something may have moved this pane without laying it out again.
  useAnimatedReaction(
    () => frostEpoch.value,
    (now, prev) => {
      if (prev !== null && now !== prev) runOnJS(measure)();
    },
    [measure],
  );

  const slice = useAnimatedStyle(() => ({
    transform: [
      { translateX: -restX.value },
      { translateY: -(restY.value - (scrollY ? scrollY.value : 0)) },
    ],
  }));

  return (
    <View ref={anchor} onLayout={measure} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.window, { width, height }, slice]}>
        <Image
          source={isDark ? FROST_DARK : FROST_LIGHT}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="bottom"
          transition={0}
          accessible={false}
        />
      </Animated.View>
      {overlay ? <View style={[StyleSheet.absoluteFill, overlay]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  window: { position: 'absolute', left: 0, top: 0 },
});

export default React.memo(FrostLayer);
