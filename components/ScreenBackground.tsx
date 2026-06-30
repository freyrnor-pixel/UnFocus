/**
 * ScreenBackground.tsx — ambient backdrop behind a screen's scrollable content.
 *
 * Renders the theme's base colour plus a couple of large, soft colour blobs
 * (radial SVG gradients for smooth falloff) whose placement/hue/mood vary with
 * the chosen material — glass is bright and airy, metal is cool with a sheen,
 * rock is a grounded dark vignette, paper is a single warm flat blob, and plain
 * is just the flat theme colour with no blobs at all. This is the "backgrounds...
 * should match the material chosen in settings" half of the material system;
 * Surface.tsx is the other half for cards.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, store/useSettingsStore, react-native-svg
 *   Used by → most app screens, rendered as the first child inside the SafeAreaView
 *             (app/index.tsx uses components/HomeHeroBackground instead)
 *   Data    → reads bubbleMaterial from useSettingsStore
 *
 * Edit notes:
 *   - Render this as an absolutely-positioned first child, then let the
 *     screen's SafeAreaView/ScrollView be transparent on top of it — don't
 *     also set backgroundColor: theme.cream on the SafeAreaView or the blobs
 *     get painted over.
 *   - Blobs are intentionally low-opacity (≤ ~0.2 at their core) so body text
 *     rendered directly on the background (not inside a Surface) stays legible.
 *   - Blob placement via blobsFor() unchanged; radial gradients provide smoother
 *     falloff than concentric rings (Decision 007).
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AppColors, MaterialName } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

type BlobSpec = { size: number; color: string; pos: ViewStyle };

function blobsFor(material: MaterialName, theme: AppColors): BlobSpec[] {
  switch (material) {
    case 'glass':
      return [
        { size: 260, color: theme.orange, pos: { top: -60, right: -60 } },
        { size: 220, color: theme.green, pos: { bottom: -40, left: -60 } },
      ];
    case 'metal':
      return [
        { size: 300, color: theme.gray, pos: { top: -110, left: -70 } },
        { size: 180, color: theme.brown, pos: { bottom: 60, right: -50 } },
      ];
    case 'rock':
      return [
        { size: 260, color: theme.text, pos: { bottom: -90, left: -70 } },
        { size: 220, color: theme.text, pos: { bottom: -70, right: -90 } },
      ];
    case 'paper':
      return [{ size: 220, color: theme.orangeLight, pos: { top: -50, right: -40 } }];
    case 'plain':
    default:
      return [];
  }
}

function Blob({ size, color, pos }: BlobSpec) {
  const gradientId = `blob-${color.replace('#', '')}-${size}`;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, pos]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <Stop offset="50%" stopColor={color} stopOpacity="0.08" />
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
  const material = useSettingsStore((s) => s.bubbleMaterial);
  const blobs = blobsFor(material, theme);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.cream, overflow: 'hidden' }]} pointerEvents="none">
      {blobs.map((b, i) => <Blob key={i} {...b} />)}
    </View>
  );
}
