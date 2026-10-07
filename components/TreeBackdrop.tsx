/**
 * TreeBackdrop.tsx — the painted tree-in-a-bubble backdrop (2026-09-26, the shopping-flow brief).
 *
 * The maintainer supplied two watercolour paintings (light + dark) and asked for them to replace
 * the SVG crown (`components/CrownArt.tsx`), with one condition taken from a Shop screenshot where
 * the trunk sat straight behind "Katalog 286 · 66 retter" and made it unreadable. That condition
 * was first met by drawing the tree full on Home and at 0.22 everywhere else.
 *
 * ⚠️ **One strength on every screen since 2026-10-07** (maintainer: *"Bakgrunnen skal ikke variere
 * mellom sidene."*). At 0.22 the blue tree faded out and the violet orb wash took over, so To-do
 * read purple and Home read blue — a per-tab background by another route, the exact thing the
 * 2026-09-27 ruling in `ScreenBackground.tsx` deleted. Every screen now draws `TREE_STRENGTH`
 * (the painting as painted). Legibility over the trunk is the CARD's job now, not the
 * backdrop's: `components/Surface.tsx`'s card fill was made denser in the same change. Don't
 * reintroduce a per-route strength to fix a label — thicken the card under it instead.
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

/** Layer opacity — the same on every screen (2026-10-07, see the header). */
export const TREE_STRENGTH = 1;

type Props = {
  /** Target opacity, 0–1 — pass `TREE_STRENGTH`. */
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
