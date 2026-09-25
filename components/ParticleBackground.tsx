/**
 * ParticleBackground.tsx — the app's ONE ambient particle layer: a sparse field of soft motes
 * falling from the canopy over the ScreenBackground orb field.
 *
 * ⚠️ **THEY FELL SILENT BETWEEN #736 AND THIS FIX, AND THE CAUSE IS THE FIRST THING TO READ.**
 * Maintainer, on the shipped app: *"Only missing the particles."* #736 added an `AppState` pause
 * to this file and gated the START on it:
 *
 *     if (AppState.currentState === 'active') loop.start();
 *
 * **That gate can be `false` at mount.** RN seeds `AppState.currentState` from
 * `NativeAppState.getConstants().initialAppState` (`AppState.js`), and Android's
 * `AppStateModule.kt` returns `"active"` only when `reactContext.lifecycleState === RESUMED` at
 * the moment those constants are read — which, on a cold launch behind `expo-splash-screen`, it
 * need not be. Read `"background"` once and the loop never starts, and the `'change'` listener
 * only fires on a TRANSITION, so the field stays dead until the app is backgrounded and brought
 * back. `react-native-web` has the same hole for its own reason: its `currentState` reads
 * `document.visibilityState`, which is `'hidden'` in a background or headless tab.
 *   The fix is not a better gate, it is no gate: **start unconditionally, and only ever STOP on
 * background.** A predicate that cannot be false at mount cannot be constant-false at mount.
 *   ⚠️ This is CLAUDE.md A2's *"when a change is a boolean, assert its truth table, not its
 * source text"* — and the session that shipped it wrote a guard asserting the `AppState` call
 * EXISTED while never evaluating what it returned. `lib/__tests__/chromeRhythm.test.ts` now
 * asserts the absence of a mount-time condition instead.
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
 * The motes are a soft blue keyed to the field rather than a separate sparkle. Skipped entirely
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

// ─── Mote specs ───────────────────────────────────────────────────────────────

type MoteSpec = {
  /**
   * The GLOW's diameter in px. The bright core is a fraction of it (`CORE`), so most of this
   * number is a ~15%-alpha wash — a 12px mote is far softer than the 6px hard disc it replaces.
   */
  size: number;
  left: `${number}%`;
  /** Where the fall STARTS, as a share of the screen. Negative means it enters from above. */
  top: `${number}%`;
  duration: number;
  delay: number;
  /** How far down it travels before resetting. */
  fall: number;
  /** How far sideways over the same trip — the handoff's `translate3d(26px, …)`. */
  drift: number;
};

/**
 * Five motes falling from the canopy.
 *
 * ⚠️ **They FALL now, and they are motes rather than dots (2026-09-25). Both come from the
 * handoff, and the first one only became right when the crown landed.** The brief's whole premise
 * is *"the halo is the light source, the bough is what breaks it into motes"* — its `@keyframes
 * mote` runs `translate3d(0,-40px,0)` → `translate3d(26px,760px,0)`, i.e. light shaken loose from
 * the canopy and drifting down. This field rose instead, which was the right call while there was
 * nothing above it to fall from; #736 put a canopy up there, so now it reads backwards.
 *
 * **Five, still.** `ANIMATION_GUIDELINES` §6 bounds simultaneous moving elements, and the
 * handoff's hero draws four. These REPLACE the dots — nothing is added to the moving-element
 * budget, which is the budget #734 blew.
 *
 * **They are also CHEAPER than what they replace**, which is worth stating because it is the
 * opposite of what "bigger and more detailed" suggests. The handoff's durations are 28–36s
 * against the old 7–10.5s, so each mote covers roughly a quarter of the pixels per frame. A mote
 * is three nested `View`s instead of one, but they move together as a single transform on the
 * parent — one damage rect, the same as before, about 12px across at the largest.
 *
 * **Staggered by START POSITION, not only by delay, and that is deliberate.** The handoff uses
 * NEGATIVE `animation-delay` (−5s, −11s, −19s) so its motes are already mid-fall at t=0; RN's
 * `Animated` has no such thing, and emulating it needs a partial first leg spliced before the
 * loop. Spreading `top` and letting the five durations differ gets the same result — a field that
 * is populated the instant you open the app, and that never falls into lockstep — with one
 * `Animated.loop` each and nothing to explain.
 */
const MOTES: MoteSpec[] = [
  { size: 10, left: '43%', top: '-4%', duration: 28000, delay: 0,    fall: 720, drift: 26 },
  { size: 7,  left: '60%', top: '18%', duration: 33000, delay: 1200, fall: 560, drift: 20 },
  { size: 12, left: '76%', top: '44%', duration: 36000, delay: 400,  fall: 420, drift: 30 },
  { size: 8,  left: '28%', top: '62%', duration: 30000, delay: 2600, fall: 300, drift: 18 },
  { size: 9,  left: '12%', top: '30%', duration: 31500, delay: 1800, fall: 500, drift: 24 },
];

/**
 * The mote's three rings, as fractions of `size`, read straight off the handoff's `#h-orb`
 * gradient and the bright pip it draws over it.
 *
 * The brief's mote is a radial gradient on an `r 50` circle — stops at 15% (core, .76), 32%
 * (tint, .46), 60% (tint, .15) — with a separate `r 8` white circle at .92 on top. A View cannot
 * hold a gradient, so three concentric discs step that falloff instead: the same trick
 * `components/ScreenBackground.tsx`'s `ORB_STOPS` plays for the washes, at three samples rather
 * than four. An `<Svg>` per mote would be exact and would also be five more canvases for
 * something 12px across.
 */
const GLOW = { r: 1, alpha: 0.15 };
const HALO = { r: 0.32, alpha: 0.46 };
const CORE = { r: 0.18, alpha: 0.92, min: 2 };

// ─── Sub-components ───────────────────────────────────────────────────────────

function FallingMote({ spec, tint, core }: { spec: MoteSpec; tint: string; core: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  // ⚠️ **`loop.start()` carries NO mount-time condition, and that is the 2026-09-25 fix — read
  // this file's header before adding one back.** #736 gated it on `AppState.currentState ===
  // 'active'`, which Android can report as `'background'` at mount on a cold launch behind the
  // splash; the loop then never started and only a background→foreground round trip would ever
  // start it. Starting unconditionally and only ever STOPPING on background makes that
  // unreachable: there is no longer a value the gate can hold that leaves the field dead.
  //   The pause itself is kept — this is the app's only endless animation, so it is the only one
  // that can go on scheduling work for a window nobody is looking at. Same lever
  // `lib/useNowMinutes.ts` uses.
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

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, spec.fall] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, spec.drift] });
  // The handoff's own envelope: up by 12%, held to 88%, out by the end. A mote that is already
  // at full strength when it appears reads as a blink; this is what makes it arrive.
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.88, 1],
    outputRange: [0, 1, 1, 0],
  });

  const ring = (d: number, color: string, alpha: number) => ({
    position: 'absolute' as const,
    width: d,
    height: d,
    borderRadius: d / 2,
    backgroundColor: color,
    opacity: alpha,
  });

  return (
    <Animated.View
      style={[
        styles.mote,
        {
          width: spec.size,
          height: spec.size,
          left: spec.left,
          top: spec.top,
          opacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}
    >
      <View style={ring(spec.size * GLOW.r, tint, GLOW.alpha)} />
      <View style={ring(spec.size * HALO.r, tint, HALO.alpha)} />
      <View style={ring(Math.max(CORE.min, spec.size * CORE.r), core, CORE.alpha)} />
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ParticleBackground() {
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const particlesEnabled = useSettingsStore((s) => s.particlesEnabled);
  // ⚠️ **`reduceEffects` is the third term and it is new (2026-09-01).** This field is five
  // always-mounted moving views the pager composites on every swipe frame — exactly
  // the class of per-frame cost that switch exists to remove, and it did not exist when this
  // component was first written. A user who asked for fewer effects must not get this back.
  const reduceEffects = useSettingsStore((s) => s.reduceEffects);

  const showParticles = particlesEnabled && !reducedMotion && !reduceEffects;
  if (!showParticles) return null;

  // The mote's two colours, matching the handoff's own split: the GLOW takes the field's blue,
  // and the CORE is literally white in dark so a mote reads as light rather than as hue. Light
  // inverts it for the same reason `components/CrownArt.tsx` does — a pale core on a pale ground
  // is nothing, so the core goes DARKER than its own glow and the relationship survives.
  //   The alphas live in `GLOW`/`HALO`/`CORE` now rather than in these strings, because the three
  // rings have to keep the handoff's ratios to each other; a single blended colour was fine for a
  // flat disc and cannot express a falloff.
  const tint = isDark ? 'rgb(110,175,255)' : 'rgb(78,120,196)';
  const core = isDark ? '#FFFFFF' : 'rgb(44,70,124)';

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
    // first thing to put back if the motes get slower rather than faster. The prop is one word.
    <View style={styles.backdrop} pointerEvents="none">
      {MOTES.map((spec, i) => (
        <FallingMote key={i} spec={spec} tint={tint} core={core} />
      ))}
    </View>
  );
}

// Memoised: always mounted behind the tabs pager and takes NO props, but its parent
// (app/(tabs)/_layout.tsx) re-renders on every tab change (it tracks the active route in
// state to cross-fade the hero layer). Without memo, that re-render reconciles the animated
// mote views on each swipe boundary. React.memo skips the parent-driven re-render; its own
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
  // One mote: an absolutely-placed box the three rings centre inside. The rings are absolute too,
  // so the box's own size is the GLOW's size and `justifyContent`/`alignItems` stack all three on
  // one centre without any of them affecting layout.
  mote: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
