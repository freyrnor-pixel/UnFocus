/**
 * ParticleBackground.tsx — theme-adaptive background image with animated particle overlay.
 *
 * Renders the watercolor-tree background (assets/bg-light.png / assets/bg-dark.png)
 * as a full-screen ImageBackground, switched by dark/light mode, then
 * layers a thin animated particle field on top:
 *   - A few (5) rising dots that float upward and fade out
 *   - Soft radial orb glow at the upper-center focal point (static)
 * The dot animations loop indefinitely. Particles skip entirely when
 * `settings.particlesEnabled` is false or `reducedMotion` is true.
 *
 * Connections:
 *   Imports → assets/bg-dark.png, assets/bg-light.png, expo-image (ImageBackground — cached,
 *             replaces RN's so the backdrop decodes once and is instant across screens),
 *             lib/useAppTheme (useIsDark, useAccessibility), store/useSettingsStore
 *   Used by → components/ScreenScaffold (L2, first child inside SafeAreaView, for
 *             sub-tier and non-pager site screens); app/(tabs)/_layout.tsx (hoisted,
 *             one shared instance behind the whole pager — see that file's header)
 *
 * Edit notes:
 *   - Same render contract as ScreenBackground: absolutely positioned, pointerEvents="none".
 *     Add as the very first child inside the SafeAreaView, before TreeWatermark.
 *   - Uses native driver for all transforms/opacity — no layout animation.
 *   - require() paths must stay static string literals —
 *     the RN bundler can't resolve a dynamically built path.
 *   - Particle dot/orb colours stay the fixed blue-white/blue-violet pair
 *     regardless of theme — they're a light sparkle effect, not a palette token,
 *     and read fine layered over every recoloured background.
 *   - **Kept intentionally sparse (5 dots, no pulse rings).** This is the app's ONE
 *     ambient particle layer, always mounted behind the tabs pager, so each dot is a
 *     full-screen-overlay view the pager composites on every swipe frame. The old
 *     10-dot + 3-ring field (plus HomeHeroBackground's own now-removed dots) was overdraw
 *     that made swiping between the 5 tabs hitch, and it broke ANIMATION_GUIDELINES §6
 *     ("no more than a few simultaneous moving elements"). Don't grow this back.
 *   - `particlesEnabled` defaults to true in the settings store — users see particles from
 *     first launch and can opt out in Settings → Accessibility.
 *   - **Calm backdrop (imageStyle opacity):** the tree renders as a faint watermark
 *     (~0.3 light / ~0.4 dark), not full-bleed at full saturation — a full-opacity blue
 *     tree behind every screen read as a heavy, muddy "general tint" that fought the
 *     content's own colour. The near-neutral theme.bg base shows through from
 *     ScreenBackground underneath, so domain-coloured cards/section pills/accents pop.
 *     Tune the two opacity values here to dial the backdrop's presence up/down.
 *   - **Cached backdrop (expo-image):** this uses `ImageBackground` from expo-image, not
 *     react-native, for its memory+disk decoded-bitmap cache — so the backdrop decodes
 *     once (warmed at boot in app/_layout.tsx's Asset.loadAsync) and paints instantly on
 *     every screen that mounts an instance, instead of each pushed sub-screen re-decoding
 *     + fading its own copy. `transition={0}` disables the cross-fade; `contentFit="cover"`
 *     replaces RN's `resizeMode`. The explicit `width/height: '100%'` on `style` is kept as
 *     a harmless belt-and-braces for the web preview harness's layout.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { ImageBackground } from 'expo-image';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

// ─── Assets ──────────────────────────────────────────────────────────────────

const BG_DEFAULT = { light: require('../assets/bg-light.png'), dark: require('../assets/bg-dark.png') };

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
// "no more than a few simultaneous moving elements" — the old 10-dot + 3-ring field was
// overdraw that made swiping between screens hitch. Spread across the width so the thinner
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

/** Soft radial glow at the upper-center focal point — a true SVG radial gradient
 *  (smooth falloff), not stacked same-color circles that read as banded rings. */
function OrbHalo({ color }: { color: string }) {
  const SIZE = 260;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        width: SIZE,
        height: SIZE,
        marginLeft: -SIZE / 2,
        marginTop: -SIZE / 2,
      }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <RadialGradient id="particleOrb" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <Stop offset="45%" stopColor={color} stopOpacity="0.16" />
            <Stop offset="75%" stopColor={color} stopOpacity="0.05" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#particleOrb)" />
      </Svg>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ParticleBackground() {
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const particlesEnabled = useSettingsStore((s) => s.particlesEnabled);

  const showParticles = particlesEnabled && !reducedMotion;
  const bgPair = BG_DEFAULT;

  const palette = isDark
    ? {
        dot: '#8ab4ff',
        orb: '#5580d8',
      }
    : {
        dot: '#2a5fc4',
        orb: '#90bef5',
      };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ImageBackground
        source={isDark ? bgPair.dark : bgPair.light}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        imageStyle={{ opacity: isDark ? 0.4 : 0.3 }}
        contentFit="cover"
        // expo-image (not RN's ImageBackground): keeps a memory+disk decoded-bitmap
        // cache, so the same backdrop is instant on every screen that mounts one instead
        // of each pushed sub-screen re-decoding + fading its own copy (the "each screen
        // loads in" symptom). transition={0} disables the cross-fade so a cached bitmap
        // paints on the first frame; recyclingKey swaps the light/dark asset cleanly.
        cachePolicy="memory-disk"
        transition={0}
        recyclingKey={isDark ? 'bg-dark' : 'bg-light'}
      >
        {showParticles && (
          <>
            <OrbHalo color={palette.orb} />

            {DOTS.map((spec, i) => (
              <RisingDot key={i} spec={spec} color={palette.dot} />
            ))}
          </>
        )}
      </ImageBackground>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
});
