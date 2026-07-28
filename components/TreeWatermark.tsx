/**
 * TreeWatermark.tsx — decorative, non-interactive render of the app's tree logo.
 *
 * Used as a faint home-screen backdrop and as a tiny centered mark inside
 * section dividers. Always the real android-icon-monochrome.png asset, never
 * an SVG approximation.
 *
 * Connections:
 *   Imports → assets/android-icon-monochrome.png
 *   Used by → app/onboarding/_layout.tsx (faint centered intro backdrop),
 *             components/SectionDivider.tsx (tiny inline divider mark)
 *
 * Edit notes:
 *   - Always pointerEvents="none" — purely decorative, must never block taps.
 *   - **`tintColor` is effectively required on light surfaces (2026-07-28).** The source
 *     is Android's *monochrome themed icon* — a near-white (248,248,248) silhouette on
 *     transparency, only ~3% of the canvas opaque. The OS tints that asset before drawing
 *     it; nothing here did, so an untinted mark was white-on-light = invisible in the light
 *     theme at ANY opacity, while showing up fine in dark. That's what made
 *     components/SectionDivider read as two disconnected hairlines, and why raising its
 *     opacity 0.14 → 0.3 (2026-07-27) didn't fix it — opacity was never the variable.
 *     Measured after that change: peak contrast delta 25 against the surface, vs 360 for
 *     the hairline it sits between. Pass a theme colour and the alpha channel still
 *     supplies the softness.
 */
import React from 'react';
import { Image, View, StyleSheet, ImageStyle, StyleProp } from 'react-native';

type Props = {
  size: number;
  opacity: number;
  /** Absolutely-positioned and centered (home watermark) vs inline (divider). Default true. */
  absolute?: boolean;
  /** Recolour the silhouette. Omit only where the surface is known to be dark. */
  tintColor?: string;
  style?: StyleProp<ImageStyle>;
};

export default function TreeWatermark({ size, opacity, absolute = true, tintColor, style }: Props) {
  return (
    <View pointerEvents="none" style={absolute && styles.absolute}>
      <Image
        source={require('../assets/android-icon-monochrome.png')}
        style={[{ width: size, height: size, opacity }, tintColor ? { tintColor } : null, style]}
        resizeMode="contain"
        // Skip Android's default ~300ms fade-in so this decorative mark is present on
        // the first frame instead of fading up (no-op on iOS). Warmed at boot via
        // app/_layout.tsx's Asset.loadAsync.
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
});
