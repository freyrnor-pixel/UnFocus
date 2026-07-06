/**
 * ScreenBackground.tsx — ambient backdrop behind a screen's scrollable content.
 *
 * Renders the theme's base colour plus a couple of large, soft colour blobs
 * (radial SVG gradients for smooth falloff) sized and positioned for the glass
 * surface finish — three saturated accent blobs spanning the screen so ambient
 * glass Surfaces always have colour underneath to frost (Decision 008 (3)).
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
 *   - Blobs are intentionally low-opacity (≤ ~0.2 at their core) so body text
 *     rendered directly on the background (not inside a Surface) stays legible.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ThemePalette } from '@/constants/colors';
import { useAppTheme } from '@/lib/useAppTheme';

type BlobSpec = { size: number; color: string; pos: ViewStyle };

function blobsFor(theme: ThemePalette): BlobSpec[] {
  return [
    { size: 340, color: theme.accent, pos: { top: -80, right: -80 } },
    { size: 300, color: theme.good, pos: { bottom: -60, left: -80 } },
    { size: 240, color: theme.accent, pos: { top: '38%', left: -90 } },
  ];
}

function Blob({ size, color, pos }: BlobSpec) {
  const gradientId = `blob-${color.replace('#', '')}-${size}`;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, pos]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <Stop offset="35%" stopColor={color} stopOpacity="0.13" />
            <Stop offset="70%" stopColor={color} stopOpacity="0.06" />
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
