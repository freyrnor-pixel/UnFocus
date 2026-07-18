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
 *   5. Rim light (svg gradient stroke) — bright top-left edge catching light (fix 1).
 * The layered *shadow* (fix 3) is applied by the OUTER view via getLayeredShadow(), not here.
 *
 * Connections:
 *   Imports → constants/theme (MaterialStyle), store/useSettingsStore (glassBlur),
 *             expo-blur, expo-linear-gradient, react-native-svg
 *   Used by → components/Surface, components/Button, components/AddFAB
 *   Data    → reads glassBlur from the settings store
 *
 * Edit notes:
 *   - Needs a measured size for the SVG rim/specular, so those layers only mount once
 *     onLayout reports w/h > 0 (one frame later).
 *   - react-native-svg `<Stop>` honours the alpha inside an rgba() `stopColor`, so the
 *     rim/specular gradient stops are passed the material's rgba tokens directly — no alpha
 *     parsing needed.
 *   - **No animations here (2026-07-18).** The earlier "drifting sheen" — a continuous ~10s
 *     Reanimated loop, one per light-mode card — was the app's main persistent-sluggishness
 *     driver (one infinite UI-thread animation × ~87 Surfaces × up to 5 mounted tabs). It was
 *     removed; the static frost + wash + specular + scrim + rim still carry the glass look.
 *   - **The BlurView itself is `pointerEvents="none"` (2026-07-18), not only its wrapper.**
 *     On Android a native BlurView can still capture taps even inside a `pointerEvents="none"`
 *     parent (the earlier misconfigured no-target dimezis path intercepted touches, which is
 *     why targets are required) — setting it on the BlurView element stops it decisively. This
 *     was the fix for "can't expand Settings cards": the card's own glass BlurView ate the tap.
 *   - Android BlurView uses real blur only for the AMBIENT backdrop, via a `blurTarget` ref
 *     (components/BlurTarget.tsx) + `blurMethod="dimezisBlurViewSdk31Plus"`, and only when the
 *     `glassBlur` setting is on (default OFF as of 2026-07-18 — it was the heaviest cost and a
 *     tap-interceptor). Without a target (buttons/FAB/overlay, or the setting off) it stays
 *     `'none'` and the floored wash carries contrast. iOS/web ignore blurMethod/blurTarget and
 *     use their own native/backdrop-filter blur.
 */
import React, { useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { MaterialStyle } from '@/constants/theme';
import { useSettingsStore } from '@/store/useSettingsStore';

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
  /** Rim stroke width; defaults to the material border width. */
  borderWidth?: number;
  /**
   * Ambient backdrop blur target (Android only) — the BlurTargetView ref from
   * components/BlurTarget.tsx. Passed by Surface for the `ambient` context so the card frosts
   * the real backdrop on Android SDK 31+. Omitted for overlay/button/FAB glass (they keep the
   * wash) and ignored on iOS/web (their BlurView already blurs the true backdrop).
   */
  blurTargetRef?: React.RefObject<View | null>;
};

export default function GlassFill({
  mat,
  radius,
  blurIntensity,
  washAlpha,
  tint,
  showSheen,
  borderWidth,
  blurTargetRef,
}: Props) {
  const glassBlur = useSettingsStore((s) => s.glassBlur);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sw = borderWidth ?? mat.borderWidth;
  // Android real backdrop blur is available only when a blur target was provided AND the
  // setting is on (SDK < 31 falls back to 'none' inside expo-blur regardless). When it's active
  // the frost carries legibility like iOS/web, so the wash can stay translucent; otherwise
  // Android has no backdrop blur, so floor the wash to keep text contrast.
  const androidNativeBlur = Platform.OS === 'android' && glassBlur && !!blurTargetRef;
  const rawWash = washAlpha ?? mat.washAlpha;
  const needsWashFloor = Platform.OS === 'android' && !androidNativeBlur;
  const effectiveWash = needsWashFloor ? Math.max(rawWash, 0.82) : rawWash;
  const wash = withAlpha(mat.backgroundColor, effectiveWash);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const measured = size.w > 0 && size.h > 0;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {/* 1. Frost. Android: real blur of the ambient backdrop target when available
          (dimezisBlurViewSdk31Plus → hardware RenderEffect, auto-fallback to 'none' < SDK 31),
          otherwise 'none' (the wash carries it). iOS/web ignore blurMethod/blurTarget.
          `pointerEvents="none"` on the BlurView itself (not just the wrapper) so a native
          Android BlurView can never intercept card taps. */}
      <BlurView
        pointerEvents="none"
        tint={tint}
        intensity={blurIntensity}
        blurMethod={Platform.OS === 'android' ? (androidNativeBlur ? 'dimezisBlurViewSdk31Plus' : 'none') : undefined}
        blurTarget={androidNativeBlur ? blurTargetRef : undefined}
        style={StyleSheet.absoluteFill}
      />
      {/* 1b. Saturation/brightness lift (reference backdrop = saturate(1.6) brightness(1.04)).
          Web-only: stacks a second backdrop-filter over the BlurView's blur so the frost picks
          up the vivid pop the reference has. iOS/Android don't honour this style, so it no-ops. */}
      {Platform.OS === 'web' && (
        <View
          pointerEvents="none"
          // @ts-expect-error backdropFilter is a web-only CSS passthrough (react-native-web)
          style={[StyleSheet.absoluteFill, { backdropFilter: 'saturate(1.6) brightness(1.04)' }]}
        />
      )}
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
          {/* 4. Adaptive scrim behind the text zone (reference: #fff .4 → transparent @45%) */}
          <LinearGradient
            colors={[mat.scrimColor, 'transparent']}
            locations={[0, 0.45]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      {/* 5. Rim light — gradient stroke, brightest top-left */}
      {measured && showSheen && (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h}>
          <Defs>
            {/* ~160deg: brightest along the top, dips mid, lifts again at the bottom edge. */}
            <SvgLinearGradient id="glassRim" x1="0.15" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={mat.rimColors[0]} />
              <Stop offset="0.45" stopColor={mat.rimColors[1]} />
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
