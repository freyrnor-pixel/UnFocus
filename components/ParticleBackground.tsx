/**
 * ParticleBackground.tsx — the app's ONE ambient particle layer: a sparse field of soft blue
 * dots drifting upward over the ScreenBackground orb field.
 *
 * ⚠️ **DELETED 2026-08-27 and RESTORED 2026-09-01. Read this before deleting it again.** Round
 * 20's "stray artefacts" box called these *"loose 2px dots"* and they went with two genuine
 * artefacts (a hard black rule that turned out to be `ProgressBar`, and a hairline divider under
 * every card header). The maintainer's follow-up was *"backdrop is too empty, don't know why we
 * removed particles and movement"* — so the dots were not the artefact; they were the movement.
 *   What the deletion also cost, and what comes back with it: `lib/firstRunOptions.ts`'s motion
 * ladder had three rungs and `'reduced'` was defined as EXACTLY `particlesEnabled: false`, so
 * with this gone the middle rung wrote nothing and its shipped copy described a no-op. The rung
 * is real again because the field is.
 *
 * The dots are a soft blue keyed to the field rather than a separate sparkle. Skipped entirely
 * when `settings.particlesEnabled` is false, when `reducedMotion` is on, or when `reduceEffects`
 * is on — see the gate for why the third one is not optional.
 *
 * ⚠️ **`npm run visual` CANNOT SEE THIS FILE, by construction.** The walk runs
 * `--deterministic`, which freezes `Date.now()`, and RN's JS-driven `Animated.timing` clocks off
 * exactly that — so every dot sits at progress 0, where the opacity interpolation is 0, and the
 * field contributes no pixels to any baseline. Verified the other way round on a page WITHOUT
 * the deterministic override: five dots present, opacities 0.28–0.74, translating and scaling.
 *   Two things follow. The good one: this field can never make a baseline flaky, which is why it
 * needs no exclusion in `scripts/visual-diff.mjs`. The one to remember: **a pixel-gate run that
 * comes back clean says nothing about whether these are drawing.** If they ever need checking
 * again, probe the DOM on a non-deterministic page, the way this was.
 *
 * Connections:
 *   Imports → lib/useAppTheme (useIsDark, useAccessibility), store/useSettingsStore
 *   Used by → components/ScreenScaffold (L2, for sub-tier and non-pager site screens);
 *             app/(tabs)/_layout.tsx (hoisted, one shared instance behind the whole pager)
 *
 * Edit notes:
 *   - Same render contract as ScreenBackground: absolutely positioned, pointerEvents="none",
 *     transparent so the gradient/branches show through.
 *   - Uses native driver for all transforms/opacity — no layout animation.
 *   - **Kept intentionally sparse (5 dots, no pulse rings).** This is always mounted behind the
 *     tabs pager, so each dot is a full-screen-overlay view the pager composites on every swipe
 *     frame. The old 10-dot + 3-ring field was overdraw that made swiping hitch and broke
 *     ANIMATION_GUIDELINES §6 ("no more than a few simultaneous moving elements"). Don't grow this
 *     back.
 *   - Dot colour is the fixed soft-blue pair (light/dark) — a light sparkle keyed to the blue
 *     field, not a per-screen palette token.
 *   - `particlesEnabled` defaults to true in the settings store — users see particles from first
 *     launch and can opt out in Settings → Accessibility.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

// ─── Particle specs ───────────────────────────────────────────────────────────

type DotSpec = {
  size: number;
  left: `${number}%`;
  bottom: `${number}%`;
  duration: number;
  delay: number;
  rise: number; // how far upward (px) the dot travels before resetting
};

// Kept deliberately small (5): this field is the app's ONE ambient particle layer,
// always mounted behind the whole tabs pager, so every one of these is a full-screen-
// overlay view the pager composites on each swipe frame. ANIMATION_GUIDELINES §6 wants
// "no more than a few simultaneous moving elements". Spread across the width so the thinner
// set still reads as an even, gentle drift.
const DOTS: DotSpec[] = [
  { size: 5,  left: '12%', bottom: '20%', duration: 7000,  delay: 0,    rise: 200 },
  { size: 3,  left: '38%', bottom: '35%', duration: 9500,  delay: 1800, rise: 180 },
  { size: 4,  left: '62%', bottom: '18%', duration: 8000,  delay: 3400, rise: 220 },
  { size: 3,  left: '80%', bottom: '46%', duration: 10500, delay: 900,  rise: 160 },
  { size: 4,  left: '50%', bottom: '58%', duration: 8800,  delay: 2600, rise: 170 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RisingDot({ spec, color }: { spec: DotSpec; color: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, spec.delay, spec.duration]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -spec.rise],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.8, 1],
    outputRange: [0, 0.9, 0.3, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.4],
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: spec.size,
          height: spec.size,
          left: spec.left,
          bottom: spec.bottom,
          backgroundColor: color,
          borderRadius: spec.size / 2,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ParticleBackground() {
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const particlesEnabled = useSettingsStore((s) => s.particlesEnabled);
  // ⚠️ **`reduceEffects` is the third term and it is new (2026-09-01).** This field is five
  // always-mounted full-screen overlay views the pager composites on every swipe frame — exactly
  // the class of per-frame cost that switch exists to remove, and it did not exist when this
  // component was first written. A user who asked for fewer effects must not get this back.
  const reduceEffects = useSettingsStore((s) => s.reduceEffects);

  const showParticles = particlesEnabled && !reducedMotion && !reduceEffects;
  if (!showParticles) return null;

  // Soft-blue drifting dots keyed to the blue field — the dark pair is a touch brighter so it
  // reads against the deeper dark ground.
  const dotColor = isDark ? 'rgba(110,175,255,0.7)' : 'rgba(100,155,255,0.6)';

  return (
    <View style={styles.backdrop} pointerEvents="none">
      {DOTS.map((spec, i) => (
        <RisingDot key={i} spec={spec} color={dotColor} />
      ))}
    </View>
  );
}

// Memoised: always mounted behind the tabs pager and takes NO props, but its parent
// (app/(tabs)/_layout.tsx) re-renders on every tab change (it tracks the active route in
// state to cross-fade the hero layer). Without memo, that re-render reconciles the animated
// dot views on each swipe boundary. React.memo skips the parent-driven re-render; its own
// hooks (isDark/particlesEnabled/reducedMotion) still re-render it when those actually change.
export default React.memo(ParticleBackground);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Same absolute-bottom-layer contract as ScreenBackground — see the `zIndex` note in that
  // file's `styles.backdrop`. This is the third member of the same backdrop group and mounts
  // beside the same zIndex 99/100 chrome blocks, so it takes the same explicit -1: a drifting
  // dot must never be able to draw over a nav icon or a line of text.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  dot: {
    position: 'absolute',
  },
});
