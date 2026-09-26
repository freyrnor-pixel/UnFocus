/**
 * TreeBackdrop.tsx — the painted tree-in-a-bubble backdrop (2026-09-26, the shopping-flow brief).
 *
 * The maintainer supplied two watercolour paintings (light + dark) and asked for them to replace
 * the SVG crown (`components/CrownArt.tsx`), with one condition taken from a Shop screenshot where
 * the trunk sat straight behind "Katalog 286 · 66 retter" and made it unreadable: **the tree is the
 * hero on Home, and only a hint on the working tabs.** So this layer takes a `strength`:
 *
 *   - Home (`index`)                 → `TREE_STRENGTH.hero`  (the painting as painted)
 *   - every other tab and sub-screen → `TREE_STRENGTH.work`  (a quiet wash the cards sit over)
 *
 * The step between them animates on the VIEW's opacity (a layer alpha on an already-decoded
 * bitmap, never a re-decode), and snaps when `still` is set — same contract as the orb layers in
 * `ScreenBackground.tsx`.
 *
 * ⚠️ The shipped PNGs are 390×844 (1x). They are soft on a 3x phone; a 1170×2532 export can be
 * dropped over the same two filenames with no code change.
 *
 * Connections:
 *   Imports → expo-image (Image), react-native-reanimated, lib/useAppTheme (useIsDark),
 *             constants/motion (Duration, Ease), assets/backdrop/tree-{light,dark}.png
 *   Used by → components/ScreenBackground.tsx (drawn over the neutral orb field, under the hue
 *             buffers, whenever the decorative field is on)
 *   Data    → none
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useIsDark } from '@/lib/useAppTheme';
import { Duration, Ease } from '@/constants/motion';

const TREE_LIGHT = require('@/assets/backdrop/tree-light.png');
const TREE_DARK = require('@/assets/backdrop/tree-dark.png');

/** Layer opacity per role. `work` is low enough that no card label can land on the trunk. */
export const TREE_STRENGTH = { hero: 1, work: 0.22 } as const;

type Props = {
  /** Target opacity, 0–1 — pass one of `TREE_STRENGTH`. */
  strength: number;
  /** Snap instead of animating (reduced motion / reduce effects). */
  still?: boolean;
};

function TreeBackdrop({ strength, still = false }: Props) {
  const isDark = useIsDark();
  const opacity = useSharedValue(strength);

  useEffect(() => {
    opacity.value = still ? strength : withTiming(strength, { duration: Duration.card, easing: Ease.move });
  }, [strength, still, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="none" renderToHardwareTextureAndroid style={[styles.layer, style]}>
      <Image
        source={isDark ? TREE_DARK : TREE_LIGHT}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="bottom"
        transition={0}
        accessible={false}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Same absolute bottom layer as ScreenBackground's `backdrop` — see the z note there.
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});

export default React.memo(TreeBackdrop);
