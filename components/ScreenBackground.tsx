/**
 * ScreenBackground.tsx — the colourful per-screen backdrop behind a screen's content.
 *
 * Colour lives HERE now (2026-07-18 colour-architecture inversion). The backdrop is a rich,
 * smooth full-screen gradient in the active screen's dominant hue (lib/screenColor.ts); the
 * cards on top are neutral near-white frosted panes that let this field show through as a soft
 * tint (see components/Surface + GlassFill). Over a smooth gradient a translucent white pane
 * reads as frosted glass with NO blur — which is why the finish works on Android (no backdrop
 * blur there). The field CROSSFADES when the active tab changes, so each screen reads as its
 * own colour family — a low-mental-load "you're in the green screen" cue.
 *
 * Connections:
 *   Imports → lib/useAppTheme (useAppTheme, useIsDark, useAccessibility),
 *             lib/screenColor (getScreenColor), constants/theme (lighten, mix),
 *             expo-linear-gradient
 *   Used by → app/(tabs)/_layout.tsx (hoisted, one shared instance behind the whole pager,
 *             passed the active route so its field hue tracks the active tab); components/
 *             ScreenScaffold (its own first child, for sub-tier and non-pager site screens —
 *             no activeRoute, so it falls back to the calm accent hue)
 *   Data    → —
 *
 * Edit notes:
 *   - Render this as an absolutely-positioned first child, then let the screen's
 *     SafeAreaView/ScrollView be transparent on top of it — don't also set
 *     backgroundColor: theme.bg on the SafeAreaView or the field gets painted over.
 *   - Light mode keeps the field pale→mid (lighten 0.60 → 0.16) so DARK header text rendered
 *     directly on the backdrop (not inside a card) still clears AA. Dark mode is a low-glare
 *     hue-infused navy wash (mix bg←base) that settles back to theme.bg. Tune these stops if a
 *     hue ever reads too strong behind on-background text — the cards carry their own contrast.
 *   - Per-screen hue crossfade: two stacked gradient layers (A/B) — the outgoing colour fades
 *     out while the incoming fades in via one Animated opacity (useNativeDriver). reducedMotion
 *     snaps instantly. This is the ONLY animation here; it fires only when the active route
 *     changes (not per frame), so it costs nothing at rest.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useIsDark, useAccessibility } from '@/lib/useAppTheme';
import { getScreenColor } from '@/lib/screenColor';
import { lighten, mix } from '@/constants/theme';

type Stops = readonly [string, string, ...string[]];

// Build the full-screen field gradient from the screen's hue. Light = an airy daylight wash
// kept light enough for dark on-background text; dark = a deep, low-glare hue-infused navy
// that settles back to the base bg.
function fieldColors(base: string, isDark: boolean, bg: string): Stops {
  if (isDark) {
    // Deepened (2026-07-18): a touch more hue infused into the navy so empty/exposed field areas
    // (e.g. below a short screen's cards, above the nav) read as an intentional colour field, not
    // a washed near-bg blank. Still settles toward bg at the bottom to stay low-glare.
    return [mix(bg, base, 0.34), mix(bg, base, 0.18), mix(bg, base, 0.06)];
  }
  // Airy daylight field, deepened (2026-07-18 "background has mostly transparent colours"). The
  // old top stop (lighten 0.60) was near-white, so the top third of every screen — and any exposed
  // field between the last card and the nav — read as washed-out blank space. Pulling the stops
  // richer (0.48 → 0.28 → 0.10) gives the field a real, visible hue everywhere while the TOP stop
  // stays light enough that dark on-background text (greeting, dates) still clears AA.
  return [lighten(base, 0.48), lighten(base, 0.28), lighten(base, 0.10)];
}

// Full-screen colour field in one hue. Diagonal (top-left → bottom-right) so the richer end
// sits low, away from the header text up top.
function Field({ colors }: { colors: Stops }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

type Props = {
  /** Active tab route name (from the pager). Omit for sub-tier screens → calm accent hue. */
  activeRoute?: string;
};

export default function ScreenBackground({ activeRoute }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const { reducedMotion } = useAccessibility();
  const color = getScreenColor(theme, activeRoute).base;

  // A/B crossfade: `current` is the shown colour; `fadingFrom` is the colour fading out (or null
  // once settled). `anim` goes 0→1 to fade the incoming layer in over the outgoing one.
  const [current, setCurrent] = useState(color);
  const [fadingFrom, setFadingFrom] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(1)).current; // 1 = current fully shown

  useEffect(() => {
    if (color === current) return;
    setFadingFrom(current); // the previously-shown colour fades out
    setCurrent(color);
    if (reducedMotion) {
      anim.setValue(1);
      setFadingFrom(null);
      return;
    }
    anim.setValue(0);
    const a = Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true });
    // Clear the outgoing layer when the fade finishes so the steady state is ALWAYS the current
    // colour at full opacity — independent of whether `anim` actually ticked. A safety timeout
    // covers platforms where the native-driver callback may not fire (e.g. the static web export,
    // where the animation doesn't run) so the field can never get stuck on the previous hue.
    a.start(({ finished }) => { if (finished) setFadingFrom(null); });
    const safety = setTimeout(() => setFadingFrom(null), 400);
    return () => { a.stop(); clearTimeout(safety); };
  }, [color, current, reducedMotion, anim]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg, overflow: 'hidden' }]} pointerEvents="none">
      {fadingFrom !== null && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
        >
          <Field colors={fieldColors(fadingFrom, isDark, theme.bg)} />
        </Animated.View>
      )}
      {/* Current layer: full opacity once settled (fadingFrom cleared), or fading in during a change. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fadingFrom !== null ? anim : 1 }]}>
        <Field colors={fieldColors(current, isDark, theme.bg)} />
      </Animated.View>
    </View>
  );
}
