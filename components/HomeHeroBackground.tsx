/**
 * HomeHeroBackground.tsx — ambient hero backdrop for the home screen, behind TreeWatermark.
 *
 * Theme-adaptive: "Serene Mist" (light) is a soft blue-sky gradient with a
 * glowing orb halo centered behind the tree; "Deep Focus" (dark) is the same
 * structure on a navy sky. A ground fade at the bottom keeps list content legible.
 * Sky and ground use true linear gradients (expo-linear-gradient) and the orb halo
 * is a true SVG radial gradient. This backdrop is now fully STATIC — no looping motion.
 *
 * Connections:
 *   Imports → lib/useAppTheme (useIsDark), expo-linear-gradient, react-native-svg
 *   Used by → app/(tabs)/_layout.tsx (hoisted behind the whole tabs pager, cross-faded
 *             in when the home tab is focused — see that file's header), layered over
 *             ScreenBackground. components/ScreenScaffold still mounts it directly
 *             (isHome prop) for any isHome screen with ownBackground=true.
 *
 * Edit notes:
 *   - Render as the first child inside the SafeAreaView, same contract as
 *     ScreenBackground: absolutely positioned, pointerEvents="none".
 *   - **No looping motion here anymore.** The old rising-dots + pulse-rings loops were
 *     removed (2026-07, screen-swipe smoothness): ParticleBackground is always mounted
 *     behind the pager and already supplies the ambient rising-dot field, so on Home the
 *     two stacked ~16 animated dots — pure overdraw the pager fought each swipe frame,
 *     and a violation of ANIMATION_GUIDELINES §6 ("no more than a few simultaneous moving
 *     elements"). The static sky/orb/ground carry the hero's identity on their own; the
 *     ambient motion comes from ParticleBackground. Because it's static, no reducedMotion
 *     gate is needed here.
 *   - Sky and ground are now true LinearGradient components (Decision 007).
 *   - The orb is centered at 50%/50%, same anchor as TreeWatermark's
 *     centered wrap in app/index.tsx, so the halo sits behind the tree
 *     rather than floating independently. It is a true SVG RadialGradient
 *     (smooth falloff) — the older concentric-circle fake was replaced so it
 *     no longer reads as banded color blocks.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useIsDark } from '@/lib/useAppTheme';

/** Soft radial glow behind the tree — a true SVG radial gradient (smooth falloff),
 *  replacing the old stacked concentric-circle fake so it reads as a real glow, not
 *  banded color blocks. */
function OrbHalo({ size, color }: { size: number; color: string }) {
  return (
    <View pointerEvents="none" style={[styles.orbWrap, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="orbHalo" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.42" />
            <Stop offset="45%" stopColor={color} stopOpacity="0.2" />
            <Stop offset="75%" stopColor={color} stopOpacity="0.06" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} fill="url(#orbHalo)" />
      </Svg>
    </View>
  );
}

export default function HomeHeroBackground() {
  const isDark = useIsDark();

  const palette = isDark
    ? {
        sky: ['#0d1f3e', '#112449', '#162e56'] as const,
        orb: '#4682f0',
        ground: ['rgba(11,22,46,0)', 'rgba(11,22,46,0.55)', 'rgba(11,22,46,0.85)'] as const,
      }
    : {
        sky: ['#6fa8e8', '#a8cdf0', '#eaf4fc'] as const,
        orb: '#a9cdf5',
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
  groundFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
});
