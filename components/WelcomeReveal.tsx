/**
 * WelcomeReveal.tsx — animated brand-reveal shown once per cold launch
 *
 * A full-screen overlay that bridges the native launch splash and the app: it paints
 * the same themed background as the native splash, blooms the watercolor-tree logo with
 * a soft accent glow, fades the app name + a short tagline up beneath it, then dissolves
 * to reveal whatever mounted underneath (onboarding or the tabs). Makes the cold launch
 * feel like one continuous, living moment instead of a hard cut on a bare splash.
 *
 * Connections:
 *   Imports → react-native, react-native-reanimated, assets/icon.png, @/lib/i18n,
 *             @/lib/useAppTheme (useAppTheme + useAccessibility + useScaledStyles),
 *             @/constants/theme (Fonts/FontSize/Spacing), @/constants/motion (Ease)
 *   Used by → app/_layout.tsx (rendered once per cold launch above the Stack; unmounts
 *             itself via onDone)
 *   Data    → none (presentational). Reads userName? No — brand-only, name lives in onboarding.
 *
 * Edit notes:
 *   - Background is theme.bg so the handoff from the native splash (also themed) is
 *     seamless — no flash. The tree starts at full opacity (matching the native splash's
 *     last frame) and only *grows*; it never fades in from nothing, which would read as a
 *     flicker after the native splash already showed it.
 *   - reducedMotion (useAccessibility): skip the bloom/stagger — compose the final frame
 *     statically, hold briefly, then fade out. No auto-playing motion (ANIMATION_GUIDELINES §7).
 *   - Tap anywhere to skip → fast fade-out. onDone is fired exactly once (finishedRef guard).
 *   - Timing tokens: uses constants/motion Ease; durations are local to this one-shot
 *     hero moment (longer than the §1 interaction bands, which is fine for a launch reveal).
 */
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useT } from '@/lib/i18n';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { Ease } from '@/constants/motion';

type Props = { onDone: () => void };

// One-shot launch reveal timeline (ms). Longer than the §1 interaction bands on purpose —
// this is a hero launch moment, not a tap response, but still kept close to ~1.4s total.
const TREE_GROW = 620;
const TEXT_IN = 360;
const NAME_DELAY = 320;
const TAGLINE_DELAY = 520;
const HOLD = 1150; // time before the whole overlay starts dissolving
const HOLD_REDUCED = 600; // reduced-motion: static frame, shorter hold
const FADE_OUT = 360;
const SKIP_FADE = 200;

export default function WelcomeReveal({ onDone }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);

  // Fire onDone exactly once (auto-finish OR tap-to-skip could both resolve).
  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDone();
  };

  const overlay = useSharedValue(1); // whole-overlay opacity (fades out at the end)
  const treeScale = useSharedValue(reducedMotion ? 1.04 : 1.0);
  const glowScale = useSharedValue(reducedMotion ? 1.12 : 0.7);
  const glowOpacity = useSharedValue(reducedMotion ? 0.9 : 0);
  const nameOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const nameShift = useSharedValue(reducedMotion ? 0 : 14);
  const taglineOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const taglineShift = useSharedValue(reducedMotion ? 0 : 12);

  useEffect(() => {
    if (!reducedMotion) {
      // Tree gently grows (never fades — it's already on screen from the native splash).
      treeScale.value = withTiming(1.05, { duration: TREE_GROW, easing: Ease.enter });
      // Soft accent glow blooms behind the tree.
      glowScale.value = withTiming(1.15, { duration: TREE_GROW + 60, easing: Ease.enter });
      glowOpacity.value = withTiming(0.9, { duration: 420, easing: Ease.enter });
      // App name, then tagline, fade + rise, staggered so ≤3 elements move at once.
      nameOpacity.value = withDelay(NAME_DELAY, withTiming(1, { duration: TEXT_IN, easing: Ease.enter }));
      nameShift.value = withDelay(NAME_DELAY, withTiming(0, { duration: TEXT_IN, easing: Ease.enter }));
      taglineOpacity.value = withDelay(TAGLINE_DELAY, withTiming(1, { duration: TEXT_IN, easing: Ease.enter }));
      taglineShift.value = withDelay(TAGLINE_DELAY, withTiming(0, { duration: TEXT_IN, easing: Ease.enter }));
    }
    // Dissolve the whole overlay after the hold, then unmount.
    const hold = reducedMotion ? HOLD_REDUCED : HOLD;
    overlay.value = withDelay(
      hold,
      withTiming(0, { duration: FADE_OUT, easing: Ease.exit }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tap anywhere to skip → cancel the timeline and fade out fast.
  const skip = () => {
    if (finishedRef.current) return;
    cancelAnimation(overlay);
    overlay.value = withTiming(0, { duration: SKIP_FADE, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(finish)();
    });
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const treeStyle = useAnimatedStyle(() => ({ transform: [{ scale: treeScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameShift.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineShift.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.bg }, overlayStyle]}>
      <Pressable style={styles.press} onPress={skip} accessibilityRole="button" accessibilityLabel={t.welcomeHeading}>
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Animated.View
              pointerEvents="none"
              style={[styles.glow, { backgroundColor: theme.accentSoft }, glowStyle]}
            />
            <Animated.Image
              source={require('../assets/icon.png')}
              style={[styles.logo, treeStyle]}
              resizeMode="contain"
              fadeDuration={0}
            />
          </View>
          <Animated.Text style={[styles.name, { color: theme.text }, nameStyle]}>
            {t.welcomeHeading}
          </Animated.Text>
          <Animated.Text style={[styles.tagline, { color: theme.textMuted }, taglineStyle]}>
            {t.welcomeTagline}
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const LOGO = 160;
const GLOW = 250;

const baseStyles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  press: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: Spacing.lg },
  logoWrap: { width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: GLOW,
    height: GLOW,
    borderRadius: GLOW / 2,
  },
  logo: { width: LOGO, height: LOGO, borderRadius: Radius.lg },
  name: {
    fontSize: FontSize.hero,
    fontFamily: Fonts.extrabold,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    paddingHorizontal: Spacing.xl,
  },
});
