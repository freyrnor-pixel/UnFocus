/**
 * FlightOverlay.tsx — reusable "cross-section travel" animation primitive.
 *
 * Renders a set of floating clones that fly from a measured source rect to a measured
 * destination rect (FLIP-style), then fade out and remove themselves. Screen-owned: one
 * instance per screen, mounted as a sibling of `<ScreenScaffold>` — NOT inside a card
 * component, since ScreenScaffold's children render inside its internal ScrollView and
 * an absolutely-positioned clone there would scroll with the content instead of floating
 * over it (same reasoning as `ConfirmationBanner`'s sibling placement in shopping.tsx).
 *
 * See ANIMATION_GUIDELINES.md's "Flight / Cross-Section Travel Animations" section for
 * the full pattern (measure source in window space at the trigger → measure/skip a
 * destination anchor → animate a floating clone between them).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, react-native-reanimated, @expo/vector-icons
 *   Used by → app/(tabs)/shopping.tsx, app/(tabs)/index.tsx (Phase 1: Shopping list→cart only)
 *   Data    → none — pure presentational, driven entirely by the `flights` prop
 *
 * Edit notes:
 *   - `content` is a generic ReactNode (not hardcoded to Shopping) so this stays reusable
 *     for a future Tasks/habit-completion phase — see FLIGHT_ANIMATION_HANDOFF.md.
 *   - Each flight is keyed independently (not a single shared animated value), so
 *     concurrent/rapid toggles animate without interfering with each other. The owner
 *     (screen) is responsible for replacing a stale flight for the same item on
 *     re-toggle, and for clearing the whole array on scroll (see ScreenScaffold's
 *     `onScroll` prop) — this component just animates whatever `flights` it's given.
 *   - `exiting={FadeOut}` on each clone is what makes both "finished normally" and
 *     "cancelled by the owner" look the same — removal from `flights` always fades,
 *     no separate cancel-animation path needed.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

export type FlightRect = { x: number; y: number; width: number; height: number };

export type Flight = {
  /** Unique per flight instance (e.g. `${item.id}-${counter}`) — a fresh key per
   *  re-toggle mounts a new clone instead of reusing/glitching a stale one. */
  key: string;
  /** The item this flight represents — lets the owner find/replace an in-flight
   *  flight for the same item on rapid re-toggle. Not read by this component. */
  itemId: string;
  from: FlightRect;
  to: FlightRect;
  content: React.ReactNode;
};

type Props = {
  flights: Flight[];
  /** Fires once a flight's timing animation completes naturally — the owner should
   *  remove it from `flights` (by `key`). Not called when the owner cancels a flight
   *  by removing it early (e.g. scroll-cancel); `exiting` handles that fade itself. */
  onFlightEnd: (key: string) => void;
  /** ms, default 220 — within ANIMATION_GUIDELINES.md's 200-250ms "card/panel transition" band. */
  duration?: number;
};

export default function FlightOverlay({ flights, onFlightEnd, duration = 220 }: Props) {
  if (flights.length === 0) return null;
  return (
    <View style={styles.root} pointerEvents="none">
      {flights.map((flight) => (
        <FlightClone key={flight.key} flight={flight} duration={duration} onFlightEnd={onFlightEnd} />
      ))}
    </View>
  );
}

function FlightClone({ flight, duration, onFlightEnd }: { flight: Flight; duration: number; onFlightEnd: (key: string) => void }) {
  const progress = useSharedValue(0);
  const { from, to, key, content } = flight;

  React.useEffect(() => {
    progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onFlightEnd)(key);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p < 0.15 ? p / 0.15 : p > 0.75 ? Math.max(0, (1 - p) / 0.25) : 1;
    return {
      opacity,
      transform: [
        { translateX: (to.x - from.x) * p },
        { translateY: (to.y - from.y) * p },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.clone, { left: from.x, top: from.y }, style]}
      exiting={FadeOut.duration(120)}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {content}
    </Animated.View>
  );
}

/** Small rounded pill (checkmark + item name) — the default flight content for Shopping's
 *  list→cart flights. Self-contained (reads useAppTheme() internally) so callers only
 *  pass a label. */
export function FlightPill({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <View style={[pillStyles.pill, { backgroundColor: theme.surface, shadowColor: '#000' }]}>
      <Ionicons name="checkmark" size={14} color={theme.good} />
      <Text style={[pillStyles.label, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
  },
  clone: {
    position: 'absolute',
  },
});

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    maxWidth: 220,
    ...Shadow.card,
  },
  label: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
    flexShrink: 1,
  },
});
