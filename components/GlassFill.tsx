/**
 * GlassFill.tsx — the shared "Glass, take two" layer stack (2026-07-17).
 *
 * One place that renders the frosted-glass finish so Surface, Button, and AddFAB don't
 * each re-implement it. Absolutely fills its parent (which must be `overflow:hidden` and
 * carry the border-radius) and is `pointerEvents="none"`. Layers, bottom → top:
 *   1. BlurView frost (expo-blur) — blurs whatever the caller mounted behind.
 *   2. Colour wash — the material hue at `washAlpha`, keeps text contrast (fix 2).
 *   3. Specular blob (svg RadialGradient, top-left) — curvature cue (fix 3). Light mode only.
 *   4. Adaptive scrim (top-down white gradient) — lifts the text zone (fix 2). Light mode only.
 *   5. Drifting sheen — a slow (~10s) diagonal light band (fix 4). Off under reduced-motion.
 *   6. Rim light (svg gradient stroke) — bright top-left edge catching light (fix 1).
 * The layered *shadow* (fix 3) is applied by the OUTER view via getLayeredShadow(), not here.
 *
 * Connections:
 *   Imports → constants/theme (MaterialStyle), lib/useAppTheme (useAccessibility),
 *             expo-blur, expo-linear-gradient, react-native-svg, react-native-reanimated
 *   Used by → components/Surface, components/Button, components/AddFAB
 *   Data    → reads reducedMotion via useAccessibility()
 *
 * Edit notes:
 *   - Needs a measured size for the SVG rim/specular + the sheen travel, so the SVG and
 *     drifting-sheen layers only mount once onLayout reports w/h > 0 (one frame later).
 *   - react-native-svg `<Stop>` honours the alpha inside an rgba() `stopColor`, so the
 *     rim/specular gradient stops are passed the material's rgba tokens directly — no alpha
 *     parsing needed.
 *   - Android BlurView keeps `experimentalBlurMethod="none"` (per Surface's long-standing
 *     note): the native blur was misconfigured/broken and intercepted touches; the wash is
 *     near-opaque so disabling it is visually near-invisible. iOS uses its native blur.
 *   - The drifting sheen is the only continuous animation here; it is gated on
 *     useAccessibility().reducedMotion AND cancelled on unmount. The Surface/Button glass-off
 *     path simply doesn't render GlassFill at all (see those files).
 */
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { MaterialStyle } from '@/constants/theme';
import { useAccessibility } from '@/lib/useAppTheme';

const TRANSPARENT_WHITE = 'rgba(255, 255, 255, 0)';

// Rewrites the alpha channel of an `rgba(r, g, b, a)` string, keeping its hue.
function withAlpha(color: string, alpha: number): string {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return color;
  const [r, g, b] = match[1].split(',').map((p) => p.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Props = {
  mat: MaterialStyle;
  radius: number;
  /** Frost blur intensity (Surface picks this per surfaceContext; buttons pass a small value). */
  blurIntensity: number;
  /** Alpha the colour wash renders at. Defaults to the material's own `washAlpha`. */
  washAlpha?: number;
  /** BlurView tint — 'light' or 'dark'. */
  tint: 'light' | 'dark';
  /**
   * Show the light-mode-only lift layers (specular + scrim + rim highlight). Pass `false`
   * in dark mode, mirroring Surface's sheen suppression — over near-black surfaces a white
   * specular/scrim reads as bright streaks. The frost + wash still render.
   */
  showSheen: boolean;
  /** Draw the drifting sheen (fix 4). Default true; still forced off under reduced-motion. */
  drift?: boolean;
  /** Rim stroke width; defaults to the material border width. */
  borderWidth?: number;
};

export default function GlassFill({
  mat,
  radius,
  blurIntensity,
  washAlpha,
  tint,
  showSheen,
  drift = true,
  borderWidth,
}: Props) {
  const { reducedMotion } = useAccessibility();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sw = borderWidth ?? mat.borderWidth;
  const wash = withAlpha(mat.backgroundColor, washAlpha ?? mat.washAlpha);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // Drifting sheen: a diagonal band sweeping across on a slow loop. Runs on the UI thread
  // (Reanimated); paused/cleared under reduced-motion.
  const progress = useSharedValue(0);
  const runSheen = drift && !reducedMotion && showSheen && size.w > 0;
  useEffect(() => {
    if (!runSheen) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(progress);
  }, [runSheen, progress]);

  const bandW = Math.max(48, size.w * 0.55);
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (size.w + bandW) * progress.value - bandW },
      { rotate: '20deg' },
    ],
  }));

  const measured = size.w > 0 && size.h > 0;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {/* 1. Frost */}
      <BlurView
        tint={tint}
        intensity={blurIntensity}
        experimentalBlurMethod={Platform.OS === 'android' ? 'none' : undefined}
        style={StyleSheet.absoluteFill}
      />
      {/* 2. Colour wash */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} />

      {measured && showSheen && (
        <>
          {/* 3. Specular blob, top-left */}
          <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
            <Defs>
              <RadialGradient id="glassSpec" cx="24%" cy="16%" rx="62%" ry="54%">
                <Stop offset="0" stopColor={mat.specularColor} />
                <Stop offset="1" stopColor={TRANSPARENT_WHITE} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={size.w} height={size.h} rx={radius} ry={radius} fill="url(#glassSpec)" />
          </Svg>
          {/* 4. Adaptive scrim behind the text zone */}
          <LinearGradient
            colors={[mat.scrimColor, 'transparent']}
            locations={[0, 0.82]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      {/* 5. Drifting sheen */}
      {measured && runSheen && (
        <Animated.View
          style={[
            { position: 'absolute', top: -size.h * 0.3, bottom: -size.h * 0.3, left: 0, width: bandW },
            sheenStyle,
          ]}
        >
          <LinearGradient
            colors={['transparent', mat.driftSheenColor, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      {/* 6. Rim light — gradient stroke, brightest top-left */}
      {measured && showSheen && (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
          <Defs>
            <SvgLinearGradient id="glassRim" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={mat.rimColors[0]} />
              <Stop offset="0.5" stopColor={mat.rimColors[1]} />
              <Stop offset="1" stopColor={mat.rimColors[2]} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={sw / 2}
            y={sw / 2}
            width={Math.max(0, size.w - sw)}
            height={Math.max(0, size.h - sw)}
            rx={Math.max(0, radius - sw / 2)}
            ry={Math.max(0, radius - sw / 2)}
            fill="none"
            stroke="url(#glassRim)"
            strokeWidth={sw}
          />
        </Svg>
      )}
    </View>
  );
}
