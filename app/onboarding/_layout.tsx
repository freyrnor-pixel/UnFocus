/**
 * _layout.tsx — Stack navigator for the onboarding flow, and its backdrop
 *
 * Defines the Expo Router Stack that wraps every onboarding screen, hides the native header,
 * and applies a slide-from-right transition between steps.
 *
 * **ONE backdrop for the whole flow (2026-08-14).** Every onboarding screen renders the app's
 * ordinary `components/ScreenBackground`, the same field every tab and pushed screen uses.
 *
 * This retires the `onboarding-triptych` motif from onboarding — a 1170×844 run whose three
 * 390-wide panels are a seed, a sprout, and the full tree with its halo ring. It was first
 * slid across the whole flow as a growing-tree progress indicator (seed → sprout → full tree),
 * then cut back to basics-only on 2026-08-09 because the full-tree panel read as a rendering
 * fault behind privacy's and restore's real controls (a trunk stroke through the Start button).
 * What that half-measure left behind was a backdrop that CHANGED between screens: `useSegments()`
 * flips at the START of the `slide_from_right` push, so the motif unmounted and ScreenBackground
 * mounted in a single frame while the outgoing screen was still visibly sliding — and the two
 * are not the same kind of image (a flat `theme.bg` field with faint line art, versus a
 * full-bleed gradient with radial glows and corner branches), so the swap changed the screen's
 * brightness as well as its art. Maintainer, on device: *"Introduction still shifts from one
 * backdrop to another, in no way smoothly."* There is nothing to transition between now.
 *
 * The motif itself stays in `constants/motifs.ts` — that file is GENERATED from
 * `assets/decorative/*.svg` and is never hand-edited. It simply has no consumer here any more.
 *
 * STEPS is still declared for every onboarding screen: `__tests__/onboardingFlow.test.ts` pins
 * it to the actual screen files as a guard against an orphaned onboarding route. Its companion
 * STEP_POSITION (where along the triptych each step sat) went with the triptych.
 *
 * Connections:
 *   Imports → expo-router (Stack, ThemeProvider, DefaultTheme), react-native,
 *             @/components/ScreenBackground, @/lib/useAppTheme
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
 *   - **Adding a screen means updating STEPS**, keyed by route segment —
 *     `__tests__/onboardingFlow.test.ts` pins it to the screens that actually exist. Nothing
 *     here branches on which step is current any more, so a screen missing from STEPS costs a
 *     failing guard, never a wrong-looking screen.
 *   - **Don't give one screen its own backdrop again.** Whatever it is, it will differ from its
 *     neighbours' and the difference lands in one frame mid-push. If onboarding is to carry
 *     bespoke art, it has to be art that is the same on every screen, or something that
 *     genuinely animates ACROSS the navigation (which the triptych, living outside the Stack,
 *     never did).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import ScreenBackground from '@/components/ScreenBackground';
import { useAppTheme } from '@/lib/useAppTheme';

/**
 * The onboarding steps in order, by route segment. Kept in sync with the screens that exist
 * under app/onboarding/ by `__tests__/onboardingFlow.test.ts` — see the header above.
 */
const STEPS = ['basics', 'privacy', 'restore'] as const;

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

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* The app's ordinary backdrop, on every step. Rendered outside the Stack, so it is one
          continuous field the screens slide over rather than something that changes with them
          — see the header for the swap this replaced. */}
      <ScreenBackground />
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
});
