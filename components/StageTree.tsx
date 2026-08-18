/**
 * StageTree.tsx — the growth-stage tree as AMBIENT SCENERY, with idle sway.
 *
 * The design system's "Natural tree & focus guidance" card ships four growth stages —
 * seed → sprout → sapling → full — and four candidate ways to use them. Three of those
 * (canopy fullness from Energy, growing a tree over a focus session, stage advancing on a
 * habit streak) are **declined by both sides**: the design project's own readme calls them
 * "the bindings were not [accepted]", and lib/growth.ts says growth in this app is
 * numberless, backdrop-only, and must never read as a reward firing off a tap. The fourth
 * — *"Ambient (decorative) — no data bound. Plain backdrop use, sway only, no fill logic."*
 * — is what this component is, and the only thing it will ever be.
 *
 * So: **`stage` is a design choice made at the call site, never a value derived from user
 * data.** A bigger, emptier surface gets a fuller stage because it has room for one, the
 * same way a bigger surface gets a bigger heading. Nothing the user does moves it, nothing
 * counts, and there is no state in which the tree looks worse than it did yesterday.
 *
 * Connections:
 *   Imports → components/Motif (the renderer), constants/motion (Duration, Ease),
 *             lib/useAppTheme (useAccessibility), react-native-reanimated
 *   Used by → components/StarterCard.tsx (its empty-state watermark — `seed` by default,
 *             `sprout` from app/habits.tsx and `sapling` from components/EnergyMeter.tsx),
 *             app/habits.tsx (the `full` stage as an ambient header watermark)
 *   Data    → none — pure presentation, and deliberately unable to reach a store
 *
 * Edit notes:
 *   - **Do not add a data prop.** Not an Energy ratio, not a streak, not a completion
 *     count. If a future caller wants the tree to *react*, that is the binding all three
 *     of the declined proposals were, and it needs the maintainer, not a prop.
 *   - **Floor at seed, never bare.** `'seed'` is the default and the smallest thing this
 *     draws; there is no leafless, dead or decline stage to fall to. Same shape as
 *     lib/goalStrength.ts flooring at 0 and lib/growth.ts flooring at the neutral backdrop.
 *   - **One tree per screen** (the art's own rule). Before mounting a second one, check
 *     what components/StarterCard.tsx is already drawing on that screen — it carries a
 *     StageTree of its own whenever it is visible. app/habits.tsx is the worked
 *     example: its header tree is suppressed exactly while its StarterCard is up.
 *   - **Recolour, don't redraw.** These are ILLUSTRATIONS (each carries its own baked
 *     light/dark `pal` in constants/motifs.ts), so components/Motif ignores `color` for
 *     them — strength is set with `opacity` alone. Passing a colour would be a prop that
 *     silently does nothing.
 *   - **Sway is the only motion, and it is not a transition.** ±1.1° over ~6s, ease-in-out,
 *     pivoting at the base (`transformOrigin: 'bottom center'` — a tree bends from its
 *     roots, and centre-pivoting slides the trunk sideways instead). The design also allows
 *     600–900ms stage transitions; there are none here because nothing changes `stage` at
 *     runtime, and adding one would need something to change it — see the first note.
 *   - **Reduced motion freezes it flat**, at 0° rather than mid-arc, so a phone asking for
 *     less movement gets the still art rather than a tree stuck leaning. `useAccessibility()`
 *     already ORs in the OS flag, so this covers both the app setting and the system one.
 */
import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Motif from '@/components/Motif';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility } from '@/lib/useAppTheme';
import type { MotifId } from '@/constants/motifs';

/** The four stages, smallest first. `seed` is the floor — there is nothing below it. */
export type TreeStage = 'seed' | 'sprout' | 'sapling' | 'full';

export const TREE_STAGES: readonly TreeStage[] = ['seed', 'sprout', 'sapling', 'full'];

const STAGE_MOTIF: Record<TreeStage, MotifId> = {
  seed: 'tree-natural-seed',
  sprout: 'tree-natural-sprout',
  sapling: 'tree-natural-sapling',
  full: 'tree-natural-full',
};

/** The design card's idle-sway budget: ±1.1°, ~6s round trip. */
const SWAY_DEGREES = 1.1;

type Props = {
  /** Which growth stage to draw. Default `'seed'` — the floor. A CALL-SITE choice; see the header. */
  stage?: TreeStage;
  /** Whole-motif opacity multiplier, clamped to [0,1] by Motif. Watermarks want this low. */
  opacity?: number;
  /** Set false for a still tree where sway would be noise (a tiny mark, a dense list). */
  sway?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function StageTree({ stage = 'seed', opacity = 0.34, sway = true, style }: Props) {
  const { reducedMotion } = useAccessibility();
  // Starts at the far end of the arc rather than 0 so the loop is one continuous
  // there-and-back (`withRepeat(..., reverse)`), not a tick out from centre.
  const lean = useSharedValue(reducedMotion ? 0 : -SWAY_DEGREES);
  const animate = sway && !reducedMotion;

  useEffect(() => {
    if (!animate) {
      lean.value = 0;
      return;
    }
    lean.value = -SWAY_DEGREES;
    lean.value = withRepeat(
      withTiming(SWAY_DEGREES, { duration: Duration.sway, easing: Ease.move }),
      -1,
      true,
    );
  }, [animate, lean]);

  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${lean.value}deg` }] }));

  return (
    // The pivot is the trunk's base, not the art's centre — see the header's sway note.
    <Animated.View pointerEvents="none" style={[{ transformOrigin: 'bottom center' }, style, swayStyle]}>
      {/* No `color`: every stage is an illustration with its own baked palette. `fit="meet"`
          keeps the whole tree in frame — a watermark that slices its own canopy off reads as
          a cropping bug rather than as texture. */}
      <Motif id={STAGE_MOTIF[stage]} opacity={opacity} fit="meet" style={StyleSheetFill} />
    </Animated.View>
  );
}

// The Motif fills whatever box the caller sized via `style`; kept as a module constant so the
// object identity is stable across renders (Motif is React.memo'd).
const StyleSheetFill = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };
