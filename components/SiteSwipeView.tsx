/**
 * SiteSwipeView.tsx — horizontal swipe-to-navigate wrapper for bottom-menu sites.
 *
 * Wraps a site screen's content so a horizontal swipe moves to the
 * neighbouring site in the bottom menu order. Gesture matches carousel pattern:
 * swipe left (drag finger left) → go to next site (higher index),
 * swipe right (drag finger right) → go to previous site (lower index).
 * Vertical swipes are left alone — native ScrollView up/down scrolling (N/S) already works without any extra code.
 *
 * Connections:
 *   Imports → react-native-gesture-handler, react-native-reanimated, lib/siteNav, lib/haptics, lib/useAppTheme
 *   Used by → components/ScreenScaffold (Decision 032) — the scaffold wraps every
 *             tier='site' screen's L3 scroll content in this, so all 5 nav sites
 *             (home/shopping/plans/health/scan) get swipe from one wire point. Screens
 *             opt out via ScreenScaffold's swipeNav={false} (none currently do).
 *   Data    → none (pure gesture/navigation wiring)
 *
 * Edit notes:
 *   - activeOffsetX/failOffsetY disambiguate this from vertical ScrollView scrolling — don't
 *     loosen these without testing scroll-heavy screens (settings, habits).
 *   - Navigates once per swipe past SWIPE_COMMIT_RATIO of screen width, or on a fast flick
 *     (velocityX past SWIPE_VELOCITY_THRESHOLD); fires tug() instead of navigating past the
 *     first/last site.
 *   - The page follows the finger near 1:1 (FOLLOW_RATIO) with rubber-band resistance past
 *     RESIST_START. On commit: Home↔site navigations go through router.push (leaving Home) or
 *     router.back() (returning to Home), both of which the native stack already animates
 *     (Decision 033) — so we snap our own transform back to 0 and navigate immediately, letting
 *     that native transition be the only motion (nativeAnimatedPrev/nativeAnimatedNext each
 *     check *either* end of that direction's hop against Home, not just the current pathname —
 *     checking only the current pathname previously missed the "returning to Home" direction
 *     and caused a real double-animation: our own flick playing, then the native back() pop
 *     playing again on top of it).
 *     Site↔site navigations (neither end is Home) go through router.replace, which the native
 *     stack does NOT animate on its own — so for that case we still flick the page fully
 *     off-screen ourselves (timed to match ANIMATION_GUIDELINES.md's "Screen navigation push"
 *     300ms ease-out) before navigating, since it's the only visible transition the user gets.
 *     All of this is gated behind useAccessibility().reducedMotion (visual only); the swipe
 *     still navigates either way — it's a gesture, not decorative motion.
 *   - translateX is reset to 0 via useFocusEffect whenever a wrapped screen regains focus —
 *     required because Home is the permanent stack root (goToSite keeps it mounted, never
 *     remounted), so without this reset its content stayed stranded off-screen after a
 *     committed swipe away and back (visible as "Home is blank except the header").
 *   - Only wrap a screen's normal scrollable content, not full-screen modal/camera overlays
 *     (e.g. app/scan.tsx's QR overlay) — those should sit outside this wrapper.
 *   - The same activeOffsetX/failOffsetY thresholds (and SWIPE_VELOCITY_THRESHOLD = 800) were
 *     already reused for ShoppingRow.tsx's swipe-to-remove gesture — keep both in sync if
 *     either changes (see ShoppingRow.tsx's R2 header note).
 */
import React, { useCallback } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { goToSite, SITE_ITEMS } from '@/lib/siteNav';
import { selection, tug } from '@/lib/haptics';
import { useAccessibility } from '@/lib/useAppTheme';

const SWIPE_COMMIT_RATIO = 0.22;
const SWIPE_VELOCITY_THRESHOLD = 800;
// How closely the page tracks the finger while dragging. Near-1:1 so it reads as
// pushing the page itself, with resistance kicking in past RESIST_START.
const FOLLOW_RATIO = 0.85;
const RESIST_START = 0.16; // fraction of screen width where drag starts to rubber-band
// Matches ANIMATION_GUIDELINES.md's "Screen navigation push" (300ms, ease-out) — used only
// for the site↔site (replace) commit flick, since that's the only case with no native
// transition of its own to hand off to.
const REPLACE_FLICK_DURATION = 300;

type Props = { children: React.ReactNode };

export default function SiteSwipeView({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { reducedMotion } = useAccessibility();
  const translateX = useSharedValue(0);

  // Whether a neighbouring site exists in each direction, computed on the JS side so
  // the gesture worklet can decide flick-off (real move) vs. rubber-band-back (edge).
  const siteIndex = SITE_ITEMS.findIndex((item) => item.route === pathname);
  const canPrev = siteIndex > 0;
  const canNext = siteIndex >= 0 && siteIndex < SITE_ITEMS.length - 1;
  // goToSite native-animates (push) when leaving Home, and native-animates (pop via
  // back()) when *returning* to Home too — router.canGoBack() is true whenever a site
  // is on screen, since Home is the permanent stack root. Only a site↔site hop (neither
  // end is Home) goes through router.replace, which has no native transition of its own.
  // Computed per-direction as plain booleans (not a function) — like canPrev/canNext,
  // these must be primitives captured by the onEnd worklet's closure below, since a
  // worklet can't call back into a plain (non-worklet) JS-thread function.
  const nativeAnimatedPrev = pathname === '/' || (siteIndex - 1 >= 0 && SITE_ITEMS[siteIndex - 1].route === '/');
  const nativeAnimatedNext = pathname === '/' || (siteIndex + 1 < SITE_ITEMS.length && SITE_ITEMS[siteIndex + 1].route === '/');

  // Home is the stack's permanent root (never remounted, only revisited via back()), so
  // its translateX must be snapped back to 0 on every refocus or a committed swipe away
  // leaves it stranded off-screen the next time this screen is shown.
  useFocusEffect(
    useCallback(() => {
      translateX.value = 0;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function navigate(direction: 1 | -1) {
    if (siteIndex === -1) return;
    const targetIndex = siteIndex + direction;
    if (targetIndex < 0 || targetIndex >= SITE_ITEMS.length) {
      tug();
      return;
    }
    selection();
    goToSite(router, pathname, SITE_ITEMS[targetIndex].route);
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      if (reducedMotion) return;
      // Follow the finger nearly 1:1, then rubber-band so long drags don't run
      // the page clean off — this is what makes it feel like a real page you're
      // pushing rather than a tiny nudge.
      const raw = e.translationX * FOLLOW_RATIO;
      const soft = RESIST_START * width;
      if (Math.abs(raw) <= soft) {
        translateX.value = raw;
      } else {
        const over = Math.abs(raw) - soft;
        const damped = soft + over * 0.35;
        translateX.value = Math.sign(raw) * damped;
      }
    })
    .onEnd((e) => {
      const commit = width * SWIPE_COMMIT_RATIO;
      const wantPrev = e.translationX > commit || e.velocityX > SWIPE_VELOCITY_THRESHOLD;
      const wantNext = e.translationX < -commit || e.velocityX < -SWIPE_VELOCITY_THRESHOLD;
      const goPrev = wantPrev && canPrev;
      const goNext = wantNext && canNext;
      if (reducedMotion) {
        if (goPrev) runOnJS(navigate)(-1);
        else if (goNext) runOnJS(navigate)(1);
        else if (wantPrev || wantNext) runOnJS(tug)(); // hit the edge
        return;
      }
      if (goPrev || goNext) {
        const direction = goPrev ? -1 : 1;
        const isNativeAnimated = goPrev ? nativeAnimatedPrev : nativeAnimatedNext;
        if (isNativeAnimated) {
          // Home↔site (either direction): router.push/back already gets its own native
          // transition (Decision 033). Snap back to rest (no animation — a bottom-nav tap
          // never applies this transform either) and navigate immediately, so
          // the native transition is the only motion the user sees instead of
          // stacking our flick in front of it.
          translateX.value = 0;
          runOnJS(navigate)(direction);
        } else {
          // Site↔site: router.replace has no native transition of its own, so
          // flick the page fully off-screen ourselves before navigating — this
          // IS the transition for this case.
          translateX.value = withTiming(
            goPrev ? width : -width,
            { duration: REPLACE_FLICK_DURATION },
            (done) => {
              if (done) runOnJS(navigate)(direction);
            }
          );
        }
      } else {
        // Not far enough, or at the first/last site — spring the page back home.
        if (wantPrev || wantNext) runOnJS(tug)();
        translateX.value = withSpring(0, { damping: 20, stiffness: 260 });
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.flex, animStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
