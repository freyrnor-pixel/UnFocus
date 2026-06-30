/**
 * ParticleBackground.tsx — theme-adaptive background image with animated particle overlay.
 *
 * Renders assets/bg-light.png (light mode) or assets/bg-dark.png (dark mode) as a
 * full-screen ImageBackground, then layers animated particles on top:
 *   - Rising dots that float upward and fade out
 *   - Pulsing ring halos centered at screen mid-height (dark mode only)
 *   - Soft radial orb glow at the upper-center focal point
 * All animations loop indefinitely. Particles skip entirely when
 * `settings.particlesEnabled` is false or `reducedMotion` is true.
 *
 * Connections:
 *   Imports → assets/bg-dark.png, assets/bg-light.png, lib/useAppTheme (useIsDark, useAccessibility), store/useSettingsStore
 *   Used by → app/index.tsx (first child inside SafeAreaView, absolutely positioned)
 *
 * Edit notes:
 *   - Same render contract as ScreenBackground: absolutely positioned, pointerEvents="none".
 *     Add as the very first child inside the SafeAreaView, before TreeWatermark.
 *   - Uses native driver for all transforms/opacity — no layout animation.
 *   - Particle colours match the bg image tones: blue-white for light, blue-violet for dark.
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
import { useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

// ─── Assets ──────────────────────────────────────────────────────────────────

const BG_DARK = require('@/assets/bg-dark.png');
const BG_LIGHT = require('@/assets/bg-light.png');

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

/** Fakes a soft radial glow via concentric same-color circles at decreasing opacity. */
function OrbHalo({ color }: { color: string }) {
  const SIZE = 260;
  const layers = [1, 0.7, 0.45, 0.22];
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
      {layers.map((scale, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: (SIZE * (1 - scale)) / 2,
            left: (SIZE * (1 - scale)) / 2,
            width: SIZE * scale,
            height: SIZE * scale,
            borderRadius: (SIZE * scale) / 2,
            backgroundColor: color,
            opacity: 0.12,
          }}
        />
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ParticleBackground() {
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const particlesEnabled = useSettingsStore((s) => s.particlesEnabled);

  const showParticles = particlesEnabled && !reducedMotion;

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
        source={isDark ? BG_DARK : BG_LIGHT}
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
