/**
 * TreeWatermark.tsx — decorative, non-interactive render of the app's tree logo.
 *
 * Used as a faint home-screen backdrop and as a tiny centered mark inside
 * section dividers. Always the real android-icon-monochrome.png asset, never
 * an SVG approximation.
 *
 * Connections:
 *   Imports → assets/android-icon-monochrome.png
 *   Used by → app/index.tsx (home watermark), components/SectionDivider.tsx
 *
 * Edit notes:
 *   - Always pointerEvents="none" — purely decorative, must never block taps.
 */
import React from 'react';
import { Image, View, StyleSheet, ImageStyle, StyleProp } from 'react-native';

type Props = {
  size: number;
  opacity: number;
  /** Absolutely-positioned and centered (home watermark) vs inline (divider). Default true. */
  absolute?: boolean;
  style?: StyleProp<ImageStyle>;
};

export default function TreeWatermark({ size, opacity, absolute = true, style }: Props) {
  return (
    <View pointerEvents="none" style={absolute && styles.absolute}>
      <Image
        source={require('@/assets/android-icon-monochrome.png')}
        style={[{ width: size, height: size, opacity }, style]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
});
