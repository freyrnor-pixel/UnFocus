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
 *   Imports → react-native (Animated, AppState), lib/useAppTheme (useIsDark, useAccessibility),
 *             store/useSettingsStore
 *   Used by → app/(tabs)/_layout.tsx — the app's ONE mount, hoisted behind the whole pager.
 *             ⚠️ `components/ScreenScaffold` mounted a SECOND instance on every sub-tier push
 *             until 2026-09-20; see the block where it was for why that came out.
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
  AppState,
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
// ⚠️ **Re-spread 2026-09-15, and it is the SAME FIVE dots — no sixth.** §6 above bounds the
// number of simultaneous moving elements, and it counts elements, not positions, so where they
// sit is free and how many there are is not.
//
// What was wrong: every `bottom` sat between 18% and 58% and every dot only ever drifts UP, so
// the field occupied the middle and upper-middle band and **nothing ever entered the lower ~18%**
// — the same dead zone the maintainer reported as black. The washes light it now (see
// `ORBS` wash 3); this is what puts movement there.
//
// Sizes and the peak opacity go up a rung with it. Both were set while cards were 86%
// transparent and every moving dot behind one dirtied it — the repaint problem #703 fixed by
// making panes opaque. A dot can be seen properly now without costing a card anything, which is
// what the maintainer asked for: *"blue and 'angelic'… they can just move around like a normal
// vivid wallpaper would."* The colour was already that blue.
const DOTS: DotSpec[] = [
  { size: 6,  left: '12%', bottom: '4%',  duration: 7000,  delay: 0,    rise: 240 },
  { size: 4,  left: '38%', bottom: '22%', duration: 9500,  delay: 1800, rise: 200 },
  { size: 5,  left: '62%', bottom: '2%',  duration: 8000,  delay: 3400, rise: 260 },
  { size: 4,  left: '80%', bottom: '30%', duration: 10500, delay: 900,  rise: 180 },
  { size: 5,  left: '50%', bottom: '14%', duration: 8800,  delay: 2600, rise: 220 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RisingDot({ spec, color }: { spec: DotSpec; color: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  // ⚠️ **The loop is STOPPED while the app is backgrounded (2026-09-20).** `Animated.loop` has no
  // end condition, so without this the five dots go on scheduling work for a window nobody is
  // looking at — and this field is the app's only always-running animation now that the crown's
  // sway and breath are gone (see `components/CrownArt.tsx`). Android stops delivering frames to
  // a hidden window, but the loop's own JS bookkeeping does not know that and keeps turning over
  // at each leg boundary.
  //   `AppState` is the same lever `lib/useNowMinutes.ts` already uses for the same reason. The
  // dots resume from wherever they were rather than resetting, because `progress` is kept across
  // the pause — a user coming back to the app should not see the whole field snap to the floor.
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
    if (AppState.currentState === 'active') loop.start();
    // Optional chaining on purpose: react-native-web's AppState returns nothing at all from
    // `addEventListener` on some versions, which is the same shim `lib/useNowMinutes.ts` guards
    // against — and the web preview is where this file is hardest to see failing.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loop.start();
      else loop.stop();
    });
    return () => {
      loop.stop();
      sub?.remove?.();
    };
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
  // Alpha lifted 2026-09-15 (0.7/0.6 -> 0.85/0.7) — see DOTS for why this was safe to spend
  // only after #703 made every pane opaque.
  const dotColor = isDark ? 'rgba(110,175,255,0.85)' : 'rgba(100,155,255,0.7)';

  return (
    // ⚠️ **`renderToHardwareTextureAndroid` IS REMOVED (2026-09-20), and the comment that used
    // to be here argued for it on a premise that is backwards.** It said: *"Without a texture,
    // each frame re-rasterises this layer. With one, Android keeps it as a GPU texture and the
    // per-frame work is an alpha/transform composite of something already drawn."*
    //
    // That is true only when the view's CONTENTS are static and the view ITSELF is what animates
    // — RN's own doc scopes the prop to exactly that: *"useful for animations and interactions
    // that only modify opacity, rotation, translation, and/or scale: in those cases, the view
    // doesn't have to be redrawn... The texture can be re-used and re-composited with different
    // parameters."* Here the opposite holds. This container never moves; its five CHILDREN move,
    // every frame, forever. So the cached texture is invalid on every frame and can never be
    // re-used — it is re-rendered and re-uploaded instead, which is a full-screen texture upload
    // per frame in place of compositing five 4–6px quads.
    //
    // ⚠️ **That is the same failure #735 named when it reverted the canopy backdrop**
    // (*"renderToHardwareTextureAndroid makes that worse on a view whose transform changes per
    // frame, since the texture is re-uploaded rather than reused"*) — this file had the identical
    // mistake, one layer down, and its own comment asserted the opposite as fact. A claim about
    // a safety or performance property is a thing to verify, not to trust.
    //
    // ⚠️ **UNMEASURED, like everything about frame cost from this end**, and flagged as the
    // first thing to put back if the dots get slower rather than faster. The prop is one word.
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
