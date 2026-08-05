/**
 * _layout.tsx — Stack navigator for the onboarding flow, and its growing-tree backdrop
 *
 * Defines the Expo Router Stack that wraps every onboarding screen, hides the native header,
 * and applies a slide-from-right transition between steps.
 *
 * **The backdrop is one continuous image, not one per screen (2026-07-31).** It is the
 * `onboarding-triptych` motif — a 1170×844 run whose three 390-wide panels are a seed, a
 * sprout, and the full tree with its halo ring — rendered three screens wide behind the whole
 * stack and translated as you advance. So the tree visibly grows across onboarding instead of
 * restarting on every step. This replaced a faint centred TreeWatermark at 0.06 opacity,
 * which was the app's entire visual identity at the one moment a new user is forming an
 * impression of it.
 *
 * The travel is INTERPOLATED rather than snapping one panel per screen, so a step can sit
 * anywhere along the strip, including between two panels. Each step's position is stated
 * outright in STEP_POSITION below, which is what makes "where does the FIRST screen start"
 * a decision rather than a by-product of how many screens there happen to be.
 *
 * It was derived instead — `index / (STEPS.length - 1)` — until 2026-08-05. That was
 * self-maintaining, which is why it survived the six-screens-to-two cut with no code change
 * here, but it also silently moved screen one onto the emptiest panel of the strip the moment
 * onboarding got short. See STEP_POSITION for what that looked like on a device.
 *
 * This doubles as the progress indicator. That is deliberate — a filling progress bar is
 * exactly the "how much more of this is there" pressure app/onboarding/basics.tsx's copy
 * rules are written to avoid, whereas a tree that is visibly further along says the same
 * thing without a number or a percentage.
 *
 * Connections:
 *   Imports → expo-router (Stack, useSegments, ThemeProvider, DefaultTheme), react-native,
 *             @/components/Motif, @/constants/motifs, @/lib/useAppTheme, @/constants/motion
 *   Used by → onboarding stack layout (router layout for /onboarding/*)
 *   Data    → none (presentational)
 *
 * Edit notes:
 *   - headerShown:false here means each screen renders its own SafeAreaView header/footer.
 *   - **Two things have to be transparent, not one.** The Stack's `contentStyle` is the
 *     obvious one, but the navigator ALSO paints its screen container from the navigation
 *     theme's `colors.background` (default: an opaque #F2F2F2). With only contentStyle set,
 *     the backdrop rendered perfectly and was then covered by a flat grey rectangle — nothing
 *     in the DOM, the logs or a typecheck says so, and the art simply looks absent. Hence the
 *     ThemeProvider. The opaque base colour lives on this layout's own wrapper View.
 *   - **Adding/reordering a step means updating STEPS *and* STEP_POSITION**, both keyed by
 *     route segment. `__tests__/onboardingFlow.test.ts` pins them to each other and to the
 *     screens that actually exist, because nothing else does. An unknown segment falls back
 *     rather than throwing — a wrong-looking backdrop is a far better failure than a crash in
 *     the middle of onboarding.
 *   - The strip needs `overflow: 'hidden'` on its container: it is three screens wide and
 *     React Native does not clip overflow by default (on web it widens the whole document).
 *   - Honour reducedMotion — it snaps between positions instead of animating (ANIMATION_GUIDELINES §7).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider, useSegments } from 'expo-router';
import Motif from '@/components/Motif';
import { MOTIFS } from '@/constants/motifs';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { Duration, Ease } from '@/constants/motion';

/**
 * The onboarding steps in order, by route segment. The tree's position is this index over
 * `STEPS.length - 1`, so the last step lands exactly on the full-tree panel.
 *
 * Two real steps since 2026-08-03 (was six). `restore` is listed third because it still
 * EXISTS as a screen and the backdrop has to know a position for it — but it is a detour off
 * privacy's "Restoring from a backup?" link, not a step anyone walks through, so it sits at
 * the end where the tree is already full. Nobody sees the tree grow into it and then back.
 */
const STEPS = ['basics', 'privacy', 'restore'] as const;

/**
 * Where along the triptych each step sits, 0 = seed panel, 1 = full-tree panel.
 *
 * This was `stepIndex / (STEPS.length - 1)`, i.e. the first step always sat at 0. That was
 * right when onboarding had six screens and the seed was one beat of a long growth; with two
 * screens it pinned the FIRST thing a new user ever sees to the emptiest panel there is —
 * `onboarding-triptych`'s panel 1 is a ground arc, a short trunk stub and a dot, all below
 * y≈680, so screen one was a headline, one row of pills, and a blank field (2026-08-05 device
 * walkthrough: "lacks the tree, and a welcoming feeling").
 *
 * 0.5 lands Basics on panel 2 — the rising branch and its small canopy cluster — so there are
 * branches behind the screen rather than a bare field. Deliberately the BACKDROP and not an
 * illustration on the screen itself: the maintainer's call was "background can be branches,
 * not the tree hero". Privacy keeps the full tree at 1, so the tree still visibly grows across
 * the flow and still doubles as the progress indicator.
 *
 * `restore` sits at 1 for the same reason it sits last in STEPS — it is a detour off privacy,
 * not a step anyone walks through, so the tree is already full when it appears.
 */
const STEP_POSITION: Record<(typeof STEPS)[number], number> = {
  basics: 0.5,
  privacy: 1,
  restore: 1,
};

/** An unknown segment gets branches, not the blank seed panel — see the fallback note below. */
const FALLBACK_POSITION = 0.5;

/** Three panels wide means two screen widths of travel. */
const TRIPTYCH_PANELS = MOTIFS['onboarding-triptych'].w / MOTIFS['screen-bg-calm'].w;
const TRAVEL_PANELS = TRIPTYCH_PANELS - 1;

/**
 * Whole-motif multiplier, so the tree stays texture and never reads as a line drawn ON the
 * controls (2026-08-03).
 *
 * This was 1 — the triptych rendered at its full baked opacity, whose trunk strokes go up to
 * 0.6 light / 0.78 dark. The tab screens' backdrop has always dialled its own branch cluster
 * back to 0.5/0.7 for exactly this reason (components/ScreenBackground.tsx's `branchOpacity`);
 * onboarding never did, and it is the one place in the app where full-bleed art sits directly
 * under interactive controls rather than around a protected centre box. The 2026-08-03
 * walkthrough reported a branch running through the Basics screen's pills and another passing
 * under the privacy screen's button and links as looking like scratches or a rendering fault
 * rather than like a tree.
 *
 * A multiplier and not an SVG change, deliberately — see components/Motif.tsx's note on the
 * prop. The art is NOT too strong at source (its strokes sit inside the design system's
 * documented 0.4–0.85 budget); it is being used somewhere that needs it further back, which
 * is precisely what the prop is for. One value rather than a light/dark pair, because the
 * generated data already encodes that relationship in its `o`/`od` pairs.
 *
 * The tree still reads, and still doubles as the progress indicator. Don't raise this back
 * without checking a screen whose controls sit low, which since the two-screen cut is privacy.
 */
const BACKDROP_OPACITY = 0.45;

/**
 * The navigation theme with a see-through page. The opaque base colour lives on this layout's
 * own root View, underneath the backdrop, so the navigator must not paint one of its own.
 *
 * Imported from `expo-router`, NOT from `@react-navigation/native`: as of SDK 56 expo-router
 * bundles its own vendored copy and hard-fails the web build if you reach for react-navigation
 * directly ("no longer compatible with react-navigation").
 */
const transparentNav = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent' },
};

export default function OnboardingLayout() {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const { width } = useWindowDimensions();
  const segments = useSegments();

  // Last segment under /onboarding; the name step is the group's index route.
  const leaf = segments[segments.length - 1];
  const step = (leaf === 'onboarding' ? 'index' : leaf) as (typeof STEPS)[number];
  // An unknown segment falls back rather than throwing — a wrong-looking backdrop is a far
  // better failure than a crash in the middle of onboarding. It falls back to BRANCHES, not to
  // position 0: the blank seed panel is the one position that reads as "the art failed to load".
  const progress = STEP_POSITION[step] ?? FALLBACK_POSITION;

  const anim = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    if (reducedMotion) {
      anim.setValue(progress);
      return;
    }
    const a = Animated.timing(anim, {
      toValue: progress,
      duration: Duration.card,
      easing: Ease.move,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [progress, reducedMotion, anim]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={styles.clip} pointerEvents="none">
        <Animated.View
          style={[
            styles.strip,
            {
              width: width * TRIPTYCH_PANELS,
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -width * TRAVEL_PANELS],
                  }),
                },
              ],
            },
          ]}
        >
          <Motif
            id="onboarding-triptych"
            color={theme.accent}
            style={StyleSheet.absoluteFill}
            fit="slice"
            opacity={BACKDROP_OPACITY}
          />
        </Animated.View>
      </View>
      {/* `contentStyle` alone is NOT enough to see the backdrop. The navigator also paints its
          screen container from the navigation theme's `colors.background`, which defaults to
          an opaque #F2F2F2 — so the backdrop rendered perfectly and was covered by a flat grey
          rectangle, with nothing in the DOM or the logs to say so. Both have to be transparent. */}
      <ThemeProvider value={transparentNav}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Written out rather than spread from StyleSheet.absoluteFill: that is a REGISTERED style
  // (an opaque id), not a plain object, so `{ ...StyleSheet.absoluteFill }` silently produces
  // `{}` — the clip loses its positioning, collapses to zero height, and the backdrop
  // disappears with no error anywhere. Use absoluteFill in a style ARRAY, or spell it out.
  clip: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  strip: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
