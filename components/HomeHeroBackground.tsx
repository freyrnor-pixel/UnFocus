/**
 * HomeHeroBackground.tsx — ambient hero backdrop for the home screen, behind TreeWatermark.
 *
 * Theme-adaptive: "Serene Mist" (light) is a soft blue-sky gradient with a
 * glowing orb halo centered behind the tree; "Deep Focus" (dark) is the same
 * structure on a navy sky with pulsing rings added around the orb. Both have
 * a sparse field of ink dots that rise and fade, and a ground fade at the
 * bottom so list content stays legible. Sky and ground use true linear gradients
 * (expo-linear-gradient); orb halo and animations stay as concentric circles.
 *
 * Connections:
 *   Imports → lib/useAppTheme (useIsDark, useAccessibility), expo-linear-gradient
 *   Used by → app/index.tsx, replacing ScreenBackground on the home screen
 *
 * Edit notes:
 *   - Render as the first child inside the SafeAreaView, same contract as
 *     ScreenBackground: absolutely positioned, pointerEvents="none".
 *   - Looping motion (rising dots + pulse rings) is gated on !reducedMotion per
 *     ANIMATION_GUIDELINES §6; the static sky/orb/ground always render.
 *   - Sky and ground are now true LinearGradient components (Decision 007).
 *   - The orb is centered at 50%/50%, same anchor as TreeWatermark's
 *     centered wrap in app/index.tsx, so the halo sits behind the tree
 *     rather than floating independently. Faked blur via concentric
 *     same-opacity circles (see ScreenBackground.tsx's Blob for the same
 *     trick), not a single hard-edged circle.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsDark, useAccessibility } from '@/lib/useAppTheme';

type Percent = `${number}%`;

type DotSpec = { size: number; left: Percent; bottom: Percent; duration: number; delay: number };

const DOTS: DotSpec[] = [
  { size: 4, left: '26%', bottom: '42%', duration: 7000, delay: 0 },
  { size: 3, left: '65%', bottom: '46%', duration: 9000, delay: 1500 },
  { size: 3, left: '18%', bottom: '52%', duration: 8000, delay: 3000 },
  { size: 4, left: '76%', bottom: '38%', duration: 7500, delay: 800 },
  { size: 2, left: '42%', bottom: '58%', duration: 10000, delay: 2200 },
  { size: 3, left: '80%', bottom: '55%', duration: 8500, delay: 4000 },
];

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

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -160] });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.88, 1],
    outputRange: [0, 1, 0.4, 0],
  });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });

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
        Animated.timing(progress, { toValue: 1, duration: 5000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.15] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return <Animated.View style={[styles.ring, { borderColor: color, transform: [{ scale }], opacity }]} />;
}

/** Concentric same-color circles at decreasing opacity, fading out toward the edge — fakes a soft radial glow without a blur filter. */
function OrbHalo({ size, color }: { size: number; color: string }) {
  const layers = [1, 0.72, 0.46, 0.24];
  return (
    <View pointerEvents="none" style={[styles.orbWrap, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}>
      {layers.map((scale, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: (size * (1 - scale)) / 2,
            left: (size * (1 - scale)) / 2,
            width: size * scale,
            height: size * scale,
            borderRadius: (size * scale) / 2,
            backgroundColor: color,
            opacity: 0.14,
          }}
        />
      ))}
    </View>
  );
}

export default function HomeHeroBackground() {
  const isDark = useIsDark();
  // ANIMATION_GUIDELINES §6 (ADHD): no always-on looping background motion when the
  // user has asked for reduced motion. The static sky/orb/ground stay; the rising dots
  // and pulse rings — the only looping pieces — are dropped.
  const { reducedMotion } = useAccessibility();

  const palette = isDark
    ? {
        sky: ['#0d1f3e', '#112449', '#162e56'] as const,
        orb: '#4682f0',
        ring: 'rgba(110,165,255,0.14)',
        dot: '#7ab0ff',
        ground: ['rgba(11,22,46,0)', 'rgba(11,22,46,0.55)', 'rgba(11,22,46,0.85)'] as const,
      }
    : {
        sky: ['#6fa8e8', '#a8cdf0', '#eaf4fc'] as const,
        orb: '#a9cdf5',
        ring: 'rgba(160,210,255,0.16)',
        dot: '#3B72D6',
        ground: ['rgba(246,250,255,0)', 'rgba(246,250,255,0.55)', 'rgba(246,250,255,0.85)'] as const,
      };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Sky gradient */}
      <LinearGradient
        colors={palette.sky}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={styles.sky}
      />

      <OrbHalo size={280} color={palette.orb} />
      {isDark && !reducedMotion && (
        <>
          <PulseRing delay={0} color={palette.ring} />
          <PulseRing delay={1660} color={palette.ring} />
          <PulseRing delay={3330} color={palette.ring} />
        </>
      )}

      {!reducedMotion && DOTS.map((spec, i) => (
        <RisingDot key={i} spec={spec} color={palette.dot} />
      ))}

      {/* Ground fade gradient */}
      <LinearGradient
        colors={palette.ground}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.groundFade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  orbWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 220,
    height: 220,
    marginLeft: -110,
    marginTop: -110,
    borderRadius: 110,
    borderWidth: 1,
  },
  dot: {
    position: 'absolute',
    borderRadius: 50,
  },
  groundFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
});
