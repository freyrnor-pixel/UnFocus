/**
 * ScreenBackground.tsx — ambient backdrop behind a screen's scrollable content.
 *
 * Renders the theme's base colour plus one large, soft accent blob (radial SVG
 * gradient for smooth falloff) so ambient glass Surfaces still have a hint of colour
 * underneath to frost (Decision 008 (3)) without the backdrop competing with content.
 *
 * Connections:
 *   Imports → constants/colors (ThemePalette), lib/useAppTheme, react-native-svg
 *   Used by → components/ScreenScaffold (rendered as its own first child, for sub-tier
 *             and non-pager site screens); app/(tabs)/_layout.tsx (hoisted, one shared
 *             instance behind the whole pager, shown when the active tab isn't home —
 *             see that file's header for why it's hoisted instead of per-screen)
 *   Data    → —
 *
 * Edit notes:
 *   - Render this as an absolutely-positioned first child, then let the
 *     screen's SafeAreaView/ScrollView be transparent on top of it — don't
 *     also set backgroundColor: theme.bg on the SafeAreaView or the blobs
 *     get painted over.
 *   - The blob is intentionally very low-opacity (~0.1 at its core) so body text
 *     rendered directly on the background (not inside a Surface) stays legible and the
 *     base reads near-neutral — colour is meant to come from the content, not here.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ThemePalette } from '@/constants/colors';
import { useAppTheme } from '@/lib/useAppTheme';

type BlobSpec = { size: number; color: string; pos: ViewStyle };

// Calm, near-neutral base: a single soft accent blob anchored top-right. The old
// three-blob set mixed accent + green (theme.good), and that second hue is what read
// as a muddy wash — dropped it, and lowered the remaining blob's opacity (see Blob),
// so the backdrop stays quiet and the content's own colour carries the screen.
function blobsFor(theme: ThemePalette): BlobSpec[] {
  return [
    { size: 340, color: theme.accent, pos: { top: -80, right: -80 } },
  ];
}

function Blob({ size, color, pos }: BlobSpec) {
  const gradientId = `blob-${color.replace('#', '')}-${size}`;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, pos]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <Stop offset="35%" stopColor={color} stopOpacity="0.06" />
            <Stop offset="70%" stopColor={color} stopOpacity="0.03" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

export default function ScreenBackground() {
  const theme = useAppTheme();
  const blobs = blobsFor(theme);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, overflow: 'hidden' }]} pointerEvents="none">
      {blobs.map((b, i) => <Blob key={i} {...b} />)}
    </View>
  );
}
