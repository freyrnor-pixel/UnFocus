/**
 * GlassFill.tsx — the shared glass finish: frost + wash (≤2 layers, 2026-07-18 simplification).
 *
 * One place that renders the frosted-glass finish so Surface, Button, and AddFAB don't
 * each re-implement it. Absolutely fills its parent (which must be `overflow:hidden` and
 * carry the border-radius) and is `pointerEvents="none"`. Layers, bottom → top:
 *   1. BlurView frost (expo-blur) — only mounted when `blurIntensity > 0` (overlay/chrome
 *      contexts: sheets, modals, FAB, buttons). Blurs whatever the caller mounted behind.
 *   2. Colour wash — the material hue at `washAlpha`. This is the ENTIRE finish for ambient
 *      content cards (no BlurView there — a translucent tint over the calm backdrop reads
 *      as frosted without per-frame blur, the power win).
 * The layered *shadow* is applied by the OUTER view via getLayeredShadow(), not here. The
 * *glow* (purposeful active/focus indicator) is applied by the outer view via getGlow(), not
 * here either — GlassFill only ever renders the neutral frost/wash finish.
 *
 * Connections:
 *   Imports → constants/theme (MaterialStyle), expo-blur
 *   Used by → components/Surface, components/Button, components/AddFAB
 *   Data    → none
 *
 * Edit notes:
 *   - **No animations here.** A continuous ~10s Reanimated "drifting sheen" loop was the
 *     app's main persistent-sluggishness driver before it was removed; don't reintroduce
 *     any per-frame/looping effect in this file.
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
};

export default function GlassFill({ mat, radius, blurIntensity, washAlpha, tint }: Props) {
  // Android has no real backdrop blur (the blur-target subsystem was removed), so the wash
  // is floored there to keep text contrast regardless of what the caller requested.
  const rawWash = washAlpha ?? mat.washAlpha;
  const effectiveWash = Platform.OS === 'android' ? Math.max(rawWash, 0.82) : rawWash;
  const wash = withAlpha(mat.backgroundColor, effectiveWash);

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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} />
    </View>
  );
}
