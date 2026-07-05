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
 *   Imports → constants/theme (MaterialName), constants/colors (ThemePalette),
 *             lib/useAppTheme, store/useSettingsStore, react-native-svg
 *   Used by → components/ScreenScaffold (rendered as its own first child, for sub-tier
 *             and non-pager site screens); app/(tabs)/_layout.tsx (hoisted, one shared
 *             instance behind the whole pager, shown when the active tab isn't home —
 *             see that file's header for why it's hoisted instead of per-screen)
 *   Data    → reads bubbleMaterial from useSettingsStore
 *
 * Edit notes:
 *   - Render this as an absolutely-positioned first child, then let the
 *     screen's SafeAreaView/ScrollView be transparent on top of it — don't
 *     also set backgroundColor: theme.bg on the SafeAreaView or the blobs
 *     get painted over.
 *   - Blobs are intentionally low-opacity (≤ ~0.2 at their core) so body text
 *     rendered directly on the background (not inside a Surface) stays legible.
 *     Decision 008 enriched the backdrop (bigger blobs, a slower mid-falloff, and
 *     a third accent blob for glass) so ambient glass Surfaces have real colour to
 *     frost instead of muddy flat bg — but the ≤~0.2 core-opacity cap is kept,
 *     so exposed-backdrop legibility is unchanged. The concentric-ring fake-blur
 *     blobs are deliberately NOT removed: real blur (under a card) and fake blur
 *     (exposed backdrop) coexist (Decision 008 (3)).
 *   - Blob placement via blobsFor() retuned for richness; radial gradients provide
 *     smoother falloff than concentric rings (Decision 007).
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { MaterialName } from '@/constants/theme';
import { ThemePalette } from '@/constants/colors';
import { useAppTheme } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

type BlobSpec = { size: number; color: string; pos: ViewStyle };

function blobsFor(material: MaterialName, theme: ThemePalette): BlobSpec[] {
  switch (material) {
    case 'glass':
      // Three saturated accent blobs spanning the screen so ambient glass always
      // has colour underneath it to frost (Decision 008 (3)), not flat cream.
      return [
        { size: 340, color: theme.accent, pos: { top: -80, right: -80 } },
        { size: 300, color: theme.good, pos: { bottom: -60, left: -80 } },
        { size: 240, color: theme.accent, pos: { top: '38%', left: -90 } },
      ];
    case 'metal':
      return [
        { size: 360, color: theme.textMuted, pos: { top: -120, left: -80 } },
        { size: 220, color: theme.accent, pos: { bottom: 40, right: -60 } },
      ];
    case 'rock':
      return [
        { size: 260, color: theme.text, pos: { bottom: -90, left: -70 } },
        { size: 220, color: theme.text, pos: { bottom: -70, right: -90 } },
      ];
    case 'paper':
      return [{ size: 220, color: theme.accentSoft, pos: { top: -50, right: -40 } }];
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
            {/* Core capped at 0.2 for exposed-backdrop legibility; the mid stops
                are raised vs. the original (0.08 → 0.13/0.06) so colour carries
                further out and ambient glass has something rich to frost. */}
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
  const material = useSettingsStore((s) => s.bubbleMaterial);
  const blobs = blobsFor(material, theme);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, overflow: 'hidden' }]} pointerEvents="none">
      {blobs.map((b, i) => <Blob key={i} {...b} />)}
    </View>
  );
}
