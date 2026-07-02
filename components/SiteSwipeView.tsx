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
 *   Used by → app/index, app/shopping, and (not yet ported) app/plans, app/meals, app/health,
 *             app/scan, app/budget, app/shared, app/automations, app/habits, app/settings
 *             (wraps each screen's body) — this is a leaf ahead of most of its screens
 *   Data    → none (pure gesture/navigation wiring)
 *
 * Edit notes:
 *   - activeOffsetX/failOffsetY disambiguate this from vertical ScrollView scrolling — don't
 *     loosen these without testing scroll-heavy screens (settings, habits).
 *   - Navigates once per swipe past SWIPE_COMMIT_RATIO of screen width, or on a fast flick
 *     (velocityX past SWIPE_VELOCITY_THRESHOLD); fires tug() instead of navigating past the
 *     first/last site.
 *   - The small drag-follow nudge is gated behind useAccessibility().reducedMotion (visual
 *     only); the swipe still navigates either way — it's a gesture, not decorative motion.
 *   - Only wrap a screen's normal scrollable content, not full-screen modal/camera overlays
 *     (e.g. app/scan.tsx's QR overlay) — those should sit outside this wrapper.
 *   - The same activeOffsetX/failOffsetY thresholds (and SWIPE_VELOCITY_THRESHOLD = 800) were
 *     already reused for ShoppingRow.tsx's swipe-to-remove gesture — keep both in sync if
 *     either changes (see ShoppingRow.tsx's R2 header note).
 */
import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { goToSite, SITE_ITEMS } from '@/lib/siteNav';
import { selection, tug } from '@/lib/haptics';
import { useAccessibility } from '@/lib/useAppTheme';

const SWIPE_COMMIT_RATIO = 0.22;
const SWIPE_VELOCITY_THRESHOLD = 800;
const SWIPE_NUDGE_MAX = 24;

type Props = { children: React.ReactNode };

export default function SiteSwipeView({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { reducedMotion } = useAccessibility();
  const translateX = useSharedValue(0);

  function navigate(direction: 1 | -1) {
    const index = SITE_ITEMS.findIndex((item) => item.route === pathname);
    if (index === -1) return;
    const targetIndex = index + direction;
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
      translateX.value = Math.max(-SWIPE_NUDGE_MAX, Math.min(SWIPE_NUDGE_MAX, e.translationX * 0.25));
    })
    .onEnd((e) => {
      if (!reducedMotion) translateX.value = withTiming(0, { duration: 150 });
      const commit = width * SWIPE_COMMIT_RATIO;
      if (e.translationX > commit || e.velocityX > SWIPE_VELOCITY_THRESHOLD) {
        runOnJS(navigate)(-1);
      } else if (e.translationX < -commit || e.velocityX < -SWIPE_VELOCITY_THRESHOLD) {
        runOnJS(navigate)(1);
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
