/**
 * PhotoFrame.tsx — themed image container with a chosen aspect-ratio format.
 *
 * Wraps expo-image's `Image` (the app's first real usage of that dependency —
 * it was installed but unused everywhere else). `format="fit"` shows the photo
 * at its natural proportions (contain, no forced container ratio); any other
 * format (square/classic/widescreen/golden, see constants/theme's AspectRatio)
 * center-crops to that fixed ratio (cover) — the "professional" tile look.
 * Rounded corners + a themed border so a photo reads as part of the app's
 * existing card language rather than a bare image dropped on top.
 *
 * Connections:
 *   Imports → expo-image, constants/theme (AspectRatio, Radius), lib/useAppTheme,
 *             store/useSettingsStore (default format when `format` prop is omitted)
 *   Used by → app/budget.tsx (receipt thumbnail)
 *   Data    → none (presentational; caller supplies the photo uri)
 *
 * Edit notes:
 *   - Only use a fixed-ratio `format` on genuinely visual/media tiles — never force
 *     one onto variable-length text/content cards, it reads as visually broken.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { AspectRatio, AspectRatioKey, Radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

type PhotoFrameProps = {
  uri: string;
  /** Defaults to the user's global settings.photoAspectRatio when omitted. */
  format?: AspectRatioKey;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function PhotoFrame({ uri, format, radius = Radius.sm, style }: PhotoFrameProps) {
  const theme = useAppTheme();
  const defaultFormat = useSettingsStore((s) => s.photoAspectRatio);
  const ratio = AspectRatio[format ?? defaultFormat];

  return (
    <View
      style={[
        styles.frame,
        { borderRadius: radius, borderColor: theme.border, aspectRatio: ratio },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={ratio ? 'cover' : 'contain'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
