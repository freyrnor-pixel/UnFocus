/**
 * LaunchReveal.tsx — the last ~700ms of a cold start: the native splash, continued in JS.
 *
 * The native splash can only ever be one still image on one flat colour. This picks that exact
 * frame up — same field, same logo, same size, same position — writes the app's name in under
 * the logo, and then dissolves the field into the app's own background so the app is simply
 * there. Nothing about the first frame changes, which is the whole trick: the handoff from
 * native to JS happens while the screen is identical on both sides of it.
 *
 * Connections:
 *   Imports → @/constants/splash (the field, shared with app.json), @/constants/motion,
 *             @/constants/theme, @/lib/useAppTheme (theme.bg is what the field dissolves INTO,
 *             and reducedMotion), assets/icon.png
 *   Used by → app/_layout.tsx (mounted above the Stack, gated on `canReveal && !launchDone`)
 *   Data    → none (settings are already hydrated by the time this can mount)
 *
 * Edit notes:
 *   - ⚠️ **This is NOT the WelcomeReveal that was deleted on 2026-07-28**, and the difference is
 *     the thing to preserve. That one was a SECOND screen: a different composition on a fixed
 *     ~1.5s timeline that the user watched after the splash had already shown them the brand
 *     ("two screens before I land in home"). This one is the SAME screen — it starts on the
 *     frame the splash was already holding and it is only on screen while it is moving. Adding
 *     a tagline, a longer hold, or anything the splash itself cannot show rebuilds the surface
 *     that was removed. Don't.
 *   - **The exit ends ON `theme.bg`, and that is why there is no cross-fade artifact.** The
 *     mark fades out first, then the empty field travels white → the app's background, and only
 *     then does that field — by now the same colour as what is behind it — fade away. A plain
 *     opacity cross-dissolve from white to a true-black app is a visible flash; this is not.
 *     See MARK_OUT_AT below for why the three phases must not overlap.
 *   - **The logo starts at dead centre and lifts as the name arrives.** Centring the pair at
 *     mount instead would put the logo above where the native splash had it, i.e. a jump on the
 *     first frame, which is exactly what this component exists to avoid. The name is absolutely
 *     positioned under the logo box so it costs the layout nothing.
 *   - reducedMotion drops the travel and the scale but keeps the colour dissolve — the setting
 *     is about movement, and a screen appearing with no transition at all is the abrupt cut the
 *     maintainer asked us to remove.
 *   - The overlay is `zIndex: 200` — above CardExpandHost's 100 and PagerFloatingNav's 100 —
 *     and takes touches, so a tap landing during the reveal can't hit a half-revealed app.
 */
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Duration, Ease } from '@/constants/motion';
import {
  LAUNCH_LOGO_LIFT,
  LAUNCH_NAME_RISE,
  SPLASH_BACKGROUND,
  SPLASH_IMAGE_WIDTH,
  SPLASH_INK,
  SPLASH_WORDMARK,
} from '@/constants/splash';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';

/**
 * The exit runs in three strictly SEQUENTIAL phases, as fractions of `exit`. They do not
 * overlap, and that is the whole reason the dissolve is clean: assets/icon.png is an OPAQUE
 * WHITE card, so the instant the field starts darkening under a mark that is still visible,
 * the card's edges appear and the logo reads as a sticker again — the exact thing the white
 * field was chosen to get rid of. Measured in the web preview, not reasoned about.
 *   1. the mark fades out, on a field that is still pure white
 *   2. the empty field travels from white to the app's own background colour
 *   3. that field — now the same colour as what is behind it — fades away
 */
const MARK_OUT_AT = 0.42;
const FIELD_TO_APP_AT = 0.88;
/** How far the whole mark pushes toward the viewer as the field lets go of it. */
const EXIT_SCALE = 0.04;

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function LaunchReveal({ onDone }: { onDone: () => void }) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();

  // 0 → 1: the name arriving under the logo. 0 → 1: the field letting go of it.
  const name = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    const nameMs = reducedMotion ? 0 : Duration.launchName;
    name.value = withTiming(1, { duration: nameMs, easing: Ease.enter });
    exit.value = withDelay(
      nameMs + Duration.launchHold,
      withTiming(
        1,
        { duration: reducedMotion ? Duration.modalOut : Duration.launchOut, easing: Ease.exit },
        (finished) => {
          // Auto-workletized completion callback — the hop is mandatory (see
          // __tests__/workletSafety.test.ts). Nothing else may be called from in here.
          if (finished) runOnJS(onDone)();
        },
      ),
    );
    // Mount-once: this plays exactly one cold start, and re-running it on a theme or
    // accessibility change mid-reveal would restart the animation under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The field. Its COLOUR is the transition; its opacity only tidies up at the very end,
  // once it already matches what is behind it.
  const fieldStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      interpolate(exit.value, [MARK_OUT_AT, FIELD_TO_APP_AT], [0, 1], Extrapolation.CLAMP),
      [0, 1],
      [SPLASH_BACKGROUND, theme.bg],
    ),
    opacity: interpolate(exit.value, [FIELD_TO_APP_AT, 1], [1, 0], Extrapolation.CLAMP),
  }));

  // The mark (logo + name), as one thing: it rises into place, then leaves as one.
  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, MARK_OUT_AT], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: reducedMotion ? 0 : -LAUNCH_LOGO_LIFT * name.value },
      {
        // Driven over the mark's own visible span, not the whole exit — past MARK_OUT_AT
        // there is nothing left to push, so spreading it there would waste most of the travel.
        scale: reducedMotion
          ? 1
          : interpolate(exit.value, [0, MARK_OUT_AT], [1, 1 + EXIT_SCALE], Extrapolation.CLAMP),
      },
    ],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: name.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - name.value) * LAUNCH_NAME_RISE }],
  }));

  return (
    <Animated.View
      style={[styles.field, fieldStyle]}
      // The app underneath is already mounted and reachable — nothing here should be read out
      // or focused on the way past it.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Animated.View style={[styles.mark, markStyle]}>
        <View style={styles.logoBox}>
          <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <AnimatedText style={[styles.name, nameStyle]} allowFontScaling={false} numberOfLines={1}>
          {SPLASH_WORDMARK}
        </AnimatedText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Spelled out rather than `StyleSheet.absoluteFill`, which this RN version types as an
  // opaque style id and so cannot be spread beside the zIndex.
  field: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 200 },
  // Both children are pinned to the field's own centre rather than laid out in a column, so
  // the logo sits exactly where the native splash left it no matter what the name does.
  // `mark` is the thing that moves; its children never shift relative to each other.
  mark: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  // Exactly the box the native splash draws its image into, so the first frame matches.
  logoBox: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: SPLASH_IMAGE_WIDTH,
    height: SPLASH_IMAGE_WIDTH,
    marginTop: -SPLASH_IMAGE_WIDTH / 2,
    marginLeft: -SPLASH_IMAGE_WIDTH / 2,
  },
  logo: { width: '100%', height: '100%' },
  // Hung under the logo box off the same centre line, full-width so it centres on the SCREEN
  // — a name longer than "UnFocus" then still reads centred rather than centred-on-the-logo.
  name: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: SPLASH_IMAGE_WIDTH / 2 + Spacing.sm,
    textAlign: 'center',
    color: SPLASH_INK,
    fontFamily: Fonts.extrabold,
    fontSize: FontSize.xxl,
    letterSpacing: 0.5,
  },
});
