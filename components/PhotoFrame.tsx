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
 *   Imports → expo-image, constants/theme (AspectRatio, Radius), lib/useAppTheme
 *   Used by → app/budget.tsx (receipt thumbnail)
 *   Data    → none (presentational; caller supplies the photo uri)
 *
 * Edit notes:
 *   - Only use a fixed-ratio `format` on genuinely visual/media tiles — never force
 *     one onto variable-length text/content cards, it reads as visually broken.
 *   - ⚠️ **`format` is REQUIRED, and the `settings.photoAspectRatio` fallback is gone
 *     (2026-09-15).** This component used to subscribe to that setting and use it when `format`
 *     was omitted. The app contains exactly one <PhotoFrame> — app/budget.tsx's receipt
 *     thumbnail — and it has always passed `format="square"` explicitly, so the fallback was
 *     never once reached. app/settings.tsx already records that the setting's row was removed
 *     because "nothing on screen has ever read" it; this was the other half.
 *       What the subscription actually cost: a live store read re-renders this component on a
 *     value it cannot use. components/Surface.tsx names the wider hazard — "a dead read is the
 *     thing that makes the next reader believe the switch still works". Making `format`
 *     required means a second call site has to CHOOSE a ratio rather than inherit one that
 *     never worked. The setting keeps its DB column (lib/db.ts never-drop) and is reported as
 *     `unavailable` to AI setup imports (lib/aiSetupApply.ts's INERT_SETTINGS, schema v10).
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { AspectRatio, AspectRatioKey, Radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type PhotoFrameProps = {
  uri: string;
  /** Required — there is no global default any more; see the header's 2026-09-15 note. */
  format: AspectRatioKey;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function PhotoFrame({ uri, format, radius = Radius.sm, style }: PhotoFrameProps) {
  const theme = useAppTheme();
  const ratio = AspectRatio[format];

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
