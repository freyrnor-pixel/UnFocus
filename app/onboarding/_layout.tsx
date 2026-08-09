/**
 * _layout.tsx — Stack navigator for the onboarding flow, and its backdrop
 *
 * Defines the Expo Router Stack that wraps every onboarding screen, hides the native header,
 * and applies a slide-from-right transition between steps.
 *
 * **The tree backdrop is BASICS-ONLY now (2026-08-09).** It used to be one continuous
 * `onboarding-triptych` motif — a 1170×844 run whose three 390-wide panels are a seed, a
 * sprout, and the full tree with its halo ring — slid across the whole flow as a growing-tree
 * progress indicator (seed → sprout → full tree, basics → privacy/restore). That full-tree
 * panel read badly behind privacy's and restore's actual controls (maintainer review,
 * 2026-08-09): a halo ring and trunk line sitting mid-screen, with a trunk stroke running
 * straight through the Start button, looked like a rendering fault rather than art. Those two
 * screens now render the app's ordinary `components/ScreenBackground` — the same field every
 * other screen in the app uses — instead. `basics.tsx` keeps the triptych's branch panel
 * (unchanged, still faded well back) because it reads fine there and now sits BEHIND that
 * screen's own real app-icon hero (see basics.tsx's header) rather than standing in for one.
 *
 * The triptych no longer animates between screens — nothing shares it across a navigation any
 * more, so there is nothing to slide. It mounts (or doesn't) with whichever screen is current.
 *
 * STEPS / STEP_POSITION are still declared for every onboarding screen, not just basics:
 * `__tests__/onboardingFlow.test.ts` pins STEPS to the actual screen files as a guard against
 * an orphaned onboarding route, and pins STEP_POSITION's keys to STEPS for the same reason.
 * Only `STEP_POSITION.basics` is read at render time now — privacy/restore's entries are kept
 * to satisfy that structural guard, not because anything still animates through them.
 *
 * Connections:
 *   Imports → expo-router (Stack, useSegments, ThemeProvider, DefaultTheme), react-native,
 *             @/components/Motif, @/components/ScreenBackground, @/constants/motifs,
 *             @/lib/useAppTheme
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
 *   - **Adding a screen means updating STEPS *and* STEP_POSITION**, both keyed by route
 *     segment — `__tests__/onboardingFlow.test.ts` pins them to each other and to the screens
 *     that actually exist. An unknown segment falls back to `ScreenBackground` (the `!==
 *     'basics'` branch), never to a crash.
 *   - The triptych strip needs `overflow: 'hidden'` on its container: it is three screens wide
 *     and React Native does not clip overflow by default (on web it widens the whole document).
 */
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider, useSegments } from 'expo-router';
import Motif from '@/components/Motif';
import ScreenBackground from '@/components/ScreenBackground';
import { MOTIFS } from '@/constants/motifs';
import { useAppTheme } from '@/lib/useAppTheme';

/**
 * The onboarding steps in order, by route segment. Kept in sync with the screens that exist
 * under app/onboarding/ by `__tests__/onboardingFlow.test.ts` — see the header above.
 */
const STEPS = ['basics', 'privacy', 'restore'] as const;

/**
 * Where along the triptych each step sits, 0 = seed panel, 1 = full-tree panel. **Only
 * `basics` is actually rendered from this any more** — privacy and restore get
 * `ScreenBackground` instead (see the header). The other two entries stay so
 * `__tests__/onboardingFlow.test.ts`'s "every step has an explicit position" guard keeps
 * meaning what it says: a screen can't silently fall out of this map.
 *
 * 0.5 lands `basics` on panel 2 — the rising branch and its small canopy cluster — not panel 1
 * (the seed: a ground arc, a short trunk stub and a dot, all below y≈680), which read as a
 * blank field with no art at all as the first thing a new install shows (2026-08-05 device
 * walkthrough: "lacks the tree, and a welcoming feeling").
 */
const STEP_POSITION: Record<(typeof STEPS)[number], number> = {
  basics: 0.5,
  privacy: 1,
  restore: 1,
};

/** Three panels wide means two screen widths of travel. */
const TRIPTYCH_PANELS = MOTIFS['onboarding-triptych'].w / MOTIFS['screen-bg-calm'].w;
const TRAVEL_PANELS = TRIPTYCH_PANELS - 1;

/**
 * Whole-motif multiplier, so the tree stays texture and never reads as a line drawn ON the
 * controls (2026-08-03). See constants/motifs.ts's generated `o`/`od` opacity pairs for how
 * this compares to the art's own baked-in strength.
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
  const { width } = useWindowDimensions();
  const segments = useSegments();

  // Last segment under /onboarding; the name step is the group's index route.
  const leaf = segments[segments.length - 1];
  const step = (leaf === 'onboarding' ? 'index' : leaf) as (typeof STEPS)[number];
  const showTriptych = step === 'basics';

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {showTriptych ? (
        <View style={styles.clip} pointerEvents="none">
          <View
            style={[
              styles.strip,
              {
                width: width * TRIPTYCH_PANELS,
                transform: [{ translateX: -width * TRAVEL_PANELS * STEP_POSITION.basics }],
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
          </View>
        </View>
      ) : (
        // The app's ordinary backdrop (same as every tab/pushed screen) — see the header for
        // why the full-tree triptych panel doesn't run behind these screens any more.
        <ScreenBackground />
      )}
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
