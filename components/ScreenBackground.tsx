/**
 * ScreenBackground.tsx — ambient backdrop behind a screen's scrollable content.
 *
 * Renders the theme's base colour plus one large, soft blob (radial SVG gradient for smooth
 * falloff) so ambient glass Surfaces still have a hint of colour underneath to frost
 * (Decision 008 (3)) without the backdrop competing with content. The blob's HUE is the
 * active screen's dominant colour (lib/screenColor.ts) and CROSSFADES when the active tab
 * changes, so each screen reads as its own colour family — a low-mental-load "you're in the
 * green screen" cue (2026-07-18 per-screen colour).
 *
 * Connections:
 *   Imports → lib/useAppTheme (useAppTheme, useAccessibility), lib/screenColor (getScreenColor),
 *             react-native-svg
 *   Used by → app/(tabs)/_layout.tsx (hoisted, one shared instance behind the whole pager,
 *             passed the active route so its blob hue tracks the active tab); components/
 *             ScreenScaffold (its own first child, for sub-tier and non-pager site screens —
 *             no activeRoute, so it falls back to the calm accent hue)
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
 *   - Per-screen hue crossfade: two stacked blob layers (A/B) — the outgoing colour fades out
 *     while the incoming fades in via one Animated opacity (useNativeDriver). reducedMotion
 *     snaps instantly. This is the ONLY animation here; it fires only when the active route
 *     changes (not per frame), so it costs nothing at rest.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { getScreenColor } from '@/lib/screenColor';

const BLOB_SIZE = 340;
const BLOB_POS = { top: -80, right: -80 };

// Soft top-right blob in the screen's hue. `role` keeps the SVG gradient id unique across
// the two crossfade layers even when both momentarily hold the same colour.
function Blob({ color, role }: { color: string; role: 'a' | 'b' }) {
  const gradientId = `blob-${role}-${color.replace('#', '')}`;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: BLOB_SIZE, height: BLOB_SIZE }, BLOB_POS]}>
      <Svg width={BLOB_SIZE} height={BLOB_SIZE} viewBox={`0 0 ${BLOB_SIZE} ${BLOB_SIZE}`}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <Stop offset="35%" stopColor={color} stopOpacity="0.06" />
            <Stop offset="70%" stopColor={color} stopOpacity="0.03" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={BLOB_SIZE / 2} cy={BLOB_SIZE / 2} r={BLOB_SIZE / 2} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

type Props = {
  /** Active tab route name (from the pager). Omit for sub-tier screens → calm accent hue. */
  activeRoute?: string;
};

export default function ScreenBackground({ activeRoute }: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const color = getScreenColor(theme, activeRoute).base;

  // A/B crossfade: `current` is the shown colour; `from` is the colour we're fading out of.
  const [current, setCurrent] = useState(color);
  const fromColor = useRef(color);
  const anim = useRef(new Animated.Value(1)).current; // 1 = current fully shown

  useEffect(() => {
    if (color === current) return;
    fromColor.current = current; // the previously-shown colour fades out
    setCurrent(color);
    if (reducedMotion) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    const a = Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [color, current, reducedMotion, anim]);

  const showChanging = current !== fromColor.current;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, overflow: 'hidden' }]} pointerEvents="none">
      {showChanging && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
        >
          <Blob color={fromColor.current} role="b" />
        </Animated.View>
      )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: showChanging ? anim : 1 }]}>
        <Blob color={current} role="a" />
      </Animated.View>
    </View>
  );
}
