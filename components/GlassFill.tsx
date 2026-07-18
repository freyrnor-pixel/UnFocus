/**
 * GlassFill.tsx — the shared glass finish: frost + wash (≤2 layers, 2026-07-18 simplification).
 *
 * One place that renders the frosted-glass finish so Surface, Button, and AddFAB don't
 * each re-implement it. Absolutely fills its parent (which must be `overflow:hidden` and
 * carry the border-radius) and is `pointerEvents="none"`. Layers, bottom → top:
 *   1. BlurView frost (expo-blur) — only mounted when `blurIntensity > 0` (overlay/chrome
 *      contexts: sheets, modals, FAB, buttons). Blurs whatever the caller mounted behind.
 *   2. Fill — the material hue at `washAlpha` (a flat wash View), OR the primary/danger
 *      button's top-lit vertical `fillGradient` when the caller passes one. This is the
 *      ENTIRE colour finish for ambient content cards (no BlurView there — a translucent
 *      tint over the calm backdrop reads as frosted without per-frame blur, the power win).
 *   3. Adaptive scrim (fix 2, expo-linear-gradient) — a soft top-down white gradient behind
 *      text, denser at top, fading out by ~58% height. Static.
 *   4. Specular highlight (fix 3, react-native-svg RadialGradient) — a soft top-left blob.
 *      Static.
 * The rim-light gradient border (fix 1) is NOT here — it's the border ring, drawn by the
 * caller's outer/mask views (Surface, Button). The layered *shadow* is applied by the OUTER
 * view via getLayeredShadow(), not here; the *glow* (purposeful active/focus indicator) is
 * applied by the outer view via getGlow(), not here either.
 *
 * Connections:
 *   Imports → constants/theme (MaterialStyle), expo-blur, expo-linear-gradient, react-native-svg
 *   Used by → components/Surface, components/Button, components/AddFAB
 *   Data    → none
 *
 * Edit notes:
 *   - **No animations here.** A continuous ~10s Reanimated "drifting sheen" loop (fix 4 of
 *     the "Glass, take two" spec, deliberately NOT implemented) was the app's main
 *     persistent-sluggishness driver before it was removed; don't reintroduce any
 *     per-frame/looping effect in this file. The take-two layers 3–4 above are all STATIC
 *     (a gradient + a radial blob) and cost nothing per frame.
 *   - The specular `<RadialGradient>` needs a document-unique id (many GlassFills mount at
 *     once); it's derived from React.useId() with the colons stripped so it's a valid SVG ref.
 *   - **The BlurView itself is `pointerEvents="none"`, not only its wrapper.** On Android a
 *     native BlurView can still capture taps even inside a `pointerEvents="none"` parent —
 *     setting it on the BlurView element stops it decisively (this was the fix for
 *     "can't expand Settings cards": the card's own glass BlurView ate the tap).
 *   - **Android has no real backdrop blur** (2026-07-18 simplification removed the Dimezis
 *     blur-target machinery — see components/BlurTarget.tsx, now deleted). `blurMethod` is
 *     left unset on Android, so its BlurView renders as a plain tint; the wash alone carries
 *     the frosted look there, same as it does for ambient cards everywhere. iOS/web's
 *     BlurView blurs the true backdrop as normal.
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { MaterialStyle } from '@/constants/theme';

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
  /** Frost blur intensity. 0 = no BlurView mounted (ambient cards — wash-only). */
  blurIntensity: number;
  /** Alpha the colour wash renders at. Defaults to the material's own `washAlpha`. */
  washAlpha?: number;
  /** BlurView tint — 'light' or 'dark'. */
  tint: 'light' | 'dark';
  /**
   * Primary/danger button top-lit vertical fill (mat.fillGradient) — replaces the flat wash
   * layer with a lighten→base→darken gradient so the pill reads raised. Omit for the flat
   * wash (all cards + secondary buttons). Already pre-alpha'd to the button washAlpha.
   */
  fillGradient?: MaterialStyle['fillGradient'];
};

export default function GlassFill({ mat, radius, blurIntensity, washAlpha, tint, fillGradient }: Props) {
  // Android has no real backdrop blur (the blur-target subsystem was removed), so the wash
  // is floored there to keep text contrast regardless of what the caller requested. Floor eased
  // 0.82 → 0.7 → 0.6 (2026-07-18 "crisper glass" → "thicker/clearer"): the thick hue-tinted keycap
  // edge lets Android cards read as glass at a lower fill, and 0.6 still keeps body text legible
  // over the calm backdrop.
  const rawWash = washAlpha ?? mat.washAlpha;
  const effectiveWash = Platform.OS === 'android' ? Math.max(rawWash, 0.6) : rawWash;
  const wash = withAlpha(mat.backgroundColor, effectiveWash);
  // Document-unique id per mounted GlassFill (colons stripped → valid SVG url(#…) ref).
  const specularId = 'gfSpec' + React.useId().replace(/:/g, '');

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius }]}>
      {blurIntensity > 0 && (
        <BlurView
          pointerEvents="none"
          tint={tint}
          intensity={blurIntensity}
          style={StyleSheet.absoluteFill}
        />
      )}
      {fillGradient ? (
        <LinearGradient
          pointerEvents="none"
          colors={fillGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} />
      )}
      {/* Adaptive scrim (fix 2) — soft top-down white behind text. Static. */}
      <LinearGradient
        pointerEvents="none"
        colors={mat.scrim.colors}
        locations={mat.scrim.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Specular highlight (fix 3) — soft top-left radial blob. Static. */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient
            id={specularId}
            cx={mat.specular.cx}
            cy={mat.specular.cy}
            rx={mat.specular.rx}
            ry={mat.specular.ry}
          >
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={mat.specular.centerOpacity} />
            <Stop offset={mat.specular.edgeOffset} stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${specularId})`} />
      </Svg>
    </View>
  );
}
