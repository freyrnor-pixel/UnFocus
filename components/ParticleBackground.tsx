/**
 * ParticleBackground.tsx — theme-adaptive background image with animated particle overlay.
 *
 * Renders one of the per-theme watercolor-tree backgrounds (assets/bg-light-*.png /
 * assets/bg-dark-*.png, one recolored pair per ColorTheme) as a full-screen
 * ImageBackground, picked by the user's active colour theme + dark/light mode, then
 * layers animated particles on top:
 *   - Rising dots that float upward and fade out
 *   - Pulsing ring halos centered at screen mid-height (dark mode only)
 *   - Soft radial orb glow at the upper-center focal point
 * All animations loop indefinitely. Particles skip entirely when
 * `settings.particlesEnabled` is false or `reducedMotion` is true.
 *
 * Connections:
 *   Imports → assets/bg-dark(-*).png, assets/bg-light(-*).png, lib/useAppTheme (useIsDark, useAccessibility), store/useSettingsStore
 *   Used by → components/ScreenScaffold (L2, first child inside SafeAreaView, for
 *             sub-tier and non-pager site screens); app/(tabs)/_layout.tsx (hoisted,
 *             one shared instance behind the whole pager — see that file's header)
 *
 * Edit notes:
 *   - Same render contract as ScreenBackground: absolutely positioned, pointerEvents="none".
 *     Add as the very first child inside the SafeAreaView, before TreeWatermark.
 *   - Uses native driver for all transforms/opacity — no layout animation.
 *   - BG_BY_THEME keys must match ColorTheme (store/useSettingsStore.ts) exactly.
 *     'custom' has no colors.ts palette yet (same deferral as useAppTheme()) so it
 *     reuses the 'default' pair. require() paths must stay static string literals —
 *     the RN bundler can't resolve a dynamically built path.
 *   - Particle dot/ring/orb colours stay the fixed blue-white/blue-violet pair
 *     regardless of theme — they're a light sparkle effect, not a palette token,
 *     and read fine layered over every recoloured background.
 *   - `particlesEnabled` defaults to true in the settings store — users see particles from
 *     first launch and can opt out in Settings → Accessibility.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { useSettingsStore, ColorTheme } from '@/store/useSettingsStore';

// ─── Assets ──────────────────────────────────────────────────────────────────
// One recolored light/dark pair per ColorTheme (constants/colors.ts palette).

const BG_BY_THEME: Record<ColorTheme, { light: number; dark: number }> = {
  default: { light: require('../assets/bg-light.png'), dark: require('../assets/bg-dark.png') },
  summer: { light: require('../assets/bg-light-summer.png'), dark: require('../assets/bg-dark-summer.png') },
  nature: { light: require('../assets/bg-light-nature.png'), dark: require('../assets/bg-dark-nature.png') },
  fluffyPink: { light: require('../assets/bg-light-fluffyPink.png'), dark: require('../assets/bg-dark-fluffyPink.png') },
  gothic: { light: require('../assets/bg-light-gothic.png'), dark: require('../assets/bg-dark-gothic.png') },
  blackWhite: { light: require('../assets/bg-light-blackWhite.png'), dark: require('../assets/bg-dark-blackWhite.png') },
  // No colors.ts palette yet — same deferral as useAppTheme(), reuse Default chrome.
  custom: { light: require('../assets/bg-light.png'), dark: require('../assets/bg-dark.png') },
};

// ─── Particle specs ───────────────────────────────────────────────────────────

type DotSpec = {
  size: number;
  left: `${number}%`;
  bottom: `${number}%`;
  duration: number;
  delay: number;
  rise: number; // how far upward (px) the dot travels before resetting
};

const DOTS: DotSpec[] = [
  { size: 5,  left: '12%', bottom: '20%', duration: 7000,  delay: 0,    rise: 200 },
  { size: 3,  left: '28%', bottom: '35%', duration: 9500,  delay: 1200, rise: 180 },
  { size: 4,  left: '45%', bottom: '18%', duration: 8000,  delay: 2800, rise: 220 },
  { size: 3,  left: '62%', bottom: '42%', duration: 10000, delay: 500,  rise: 160 },
  { size: 5,  left: '74%', bottom: '28%', duration: 7500,  delay: 3500, rise: 200 },
  { size: 2,  left: '85%', bottom: '50%', duration: 11000, delay: 1800, rise: 140 },
  { size: 4,  left: '34%', bottom: '58%', duration: 8800,  delay: 4200, rise: 170 },
  { size: 3,  left: '55%', bottom: '14%', duration: 9200,  delay: 600,  rise: 210 },
  { size: 2,  left: '20%', bottom: '65%', duration: 12000, delay: 3000, rise: 130 },
  { size: 4,  left: '90%', bottom: '32%', duration: 8200,  delay: 2100, rise: 190 },
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

function PulseRing({ delay, color }: { delay: number; color: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 5500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] });
  const opacity = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] });

  return (
    <Animated.View
      style={[styles.ring, { borderColor: color, transform: [{ scale }], opacity }]}
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
  const colorTheme = useSettingsStore((s) => s.colorTheme);

  const showParticles = particlesEnabled && !reducedMotion;
  const bgPair = BG_BY_THEME[colorTheme] ?? BG_BY_THEME.default;

  const palette = isDark
    ? {
        dot: '#8ab4ff',
        ring: 'rgba(130,170,255,0.18)',
        orb: '#5580d8',
      }
    : {
        dot: '#2a5fc4',
        ring: 'rgba(80,140,230,0.16)',
        orb: '#90bef5',
      };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ImageBackground
        source={isDark ? bgPair.dark : bgPair.light}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {showParticles && (
          <>
            <OrbHalo color={palette.orb} />

            {isDark && (
              <>
                <PulseRing delay={0}    color={palette.ring} />
                <PulseRing delay={1833} color={palette.ring} />
                <PulseRing delay={3666} color={palette.ring} />
              </>
            )}

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
  ring: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    width: 240,
    height: 240,
    marginLeft: -120,
    marginTop: -120,
    borderRadius: 120,
    borderWidth: 1.5,
  },
});
