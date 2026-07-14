/**
 * ExpandableCard.tsx — collapsible card with animated header chevron.
 *
 * Generic accordion container: shows a title/subtitle/badge row that toggles a
 * body section with a smooth measured-height reveal (Reanimated) and a rotating
 * arrow. Content, labels, and optional right action are all passed in as
 * children/props.
 *
 * Connections:
 *   Imports → react-native-reanimated, constants/theme, lib/useAppTheme, components/PressableScale
 *   Used by → components/WeekListCard.tsx (dish groups + collapsed "bought this week"
 *             history, uncontrolled), app/shopping.tsx (Monthly catalog dish groups);
 *             later Phase 3/6 sessions may also wire this into InboxSection/meals/health
 *             per Decision 009. NOTE: PlanTaskCard does NOT wrap ExpandableCard — Decision
 *             009a redesigned the Plans preview into a bespoke proportional-rail day-view
 *             (its collapsed state still shows content, which ExpandableCard's hide-all-body
 *             accordion shape can't express), superseding Decision 009 #2's original
 *             "PlanTaskCard wraps ExpandableCard" reference.
 *   Data    → driven by props; reads reducedMotion + scaled fontSize via useAccessibility()/useScaledStyles()
 *
 * Edit notes:
 *   - Animation is react-native-reanimated (imperative shared values), matching the
 *     codebase default (ANIMATION_GUIDELINES.md §2). The body reveal animates a measured
 *     content height (the RN-correct equivalent of a web `layout` animation): an always-
 *     laid-out inner view reports its natural height via onLayout into `contentH`, and the
 *     outer clip view interpolates 0→contentH as `progress` runs. Content also fades and
 *     slides up ~8px on reveal. Timing follows §1: ~220ms ease-out open, ~200ms ease-in close.
 *   - The body stays mounted through the close animation, then unmounts (`rendered` flips
 *     false in the withTiming completion callback) — so a collapsed card renders no body,
 *     preserving the old lazy-mount behaviour for long lists (e.g. WeekListCard history).
 *   - First-open deferral: because the body only mounts when `rendered` flips true, on the
 *     very first open `contentH` is still 0 and a withTiming started immediately would
 *     interpolate height 0→0 and snap. The open is therefore deferred (`pendingOpenRef`)
 *     until onBodyLayout reports the natural height, which then kicks off the reveal — so the
 *     first tap glides like every later one. Later opens reuse the retained `contentH`.
 *   - reducedMotion is honoured by running the same timings with duration 0 (instant snap);
 *     the code path stays single so there's no divergent static branch to keep in sync.
 *   - `leadingAction` renders before the title/subtitle stack inside headerLeft (same
 *     stopPropagation-wrapped Pressable pattern as `rightAction`) — e.g. a severity badge
 *     needs to sit leading rather than trailing, where a checkbox lives on the right.
 *   - Decision 043 rule 1: every caller mounts this inside its own Surface-backed card
 *     region (WeekListCard, HomeShoppingCard, shopping.tsx's Monthly catalog card), so this
 *     component does NOT render its own Surface — that would be Surface-inside-Surface.
 *     The row is a plain View with a hairline top divider (`theme.border`) for grouping;
 *     `accentColor` still tints the left accent bar only.
 *   - Optional controlled mode: pass both `open` and `onToggle` to let the parent own the
 *     open/closed state (needed when a screen must aggregate state across many instances,
 *     e.g. per-task dirty tracking). Omit both and it behaves exactly as before (internal
 *     useState).
 *   - `rightAction` is wrapped in its own Pressable that calls `e.stopPropagation()` so taps on
 *     a checkbox/save-pill passed as rightAction don't also toggle the header.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';

// §1 card expand/collapse timings — exit is faster than enter (ANIMATION_GUIDELINES.md §1).
const OPEN_MS = 220;
const CLOSE_MS = 200;

type Props = {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  leadingAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  accentColor?: string;
};

export default function ExpandableCard({
  title,
  subtitle,
  badge,
  children,
  leadingAction,
  rightAction,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  accentColor,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const [openState, setOpenState] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : openState;

  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);

  // 0 = collapsed, 1 = expanded. Drives chevron rotation, body height, opacity, slide.
  const progress = useSharedValue(open ? 1 : 0);
  // Natural height of the body content, reported by the inner view's onLayout.
  const contentH = useSharedValue(0);
  // Keep the body mounted while collapsing so the height can animate back to 0,
  // then unmount it (a collapsed card renders no body — preserves lazy mount).
  const [rendered, setRendered] = useState(open);
  const mountedRef = useRef(false);
  // True while an open is waiting for the body's first layout. On the very first
  // open, `contentH` is still 0 (the body only mounts now), so starting withTiming
  // here would interpolate height 0→0 and snap. We defer the reveal to onBodyLayout.
  const pendingOpenRef = useRef(false);

  function animateOpen() {
    progress.value = withTiming(1, {
      duration: reducedMotion ? 0 : OPEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }

  useEffect(() => {
    // Skip the first run: `progress`/`rendered` already reflect the initial `open`,
    // so mounting (incl. controlled mode) should not animate.
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (open) {
      setRendered(true);
      if (contentH.value > 0) {
        // Body was measured on a prior open — reveal straight away.
        animateOpen();
      } else {
        // First open: wait for onBodyLayout to report the natural height, then reveal.
        pendingOpenRef.current = true;
      }
    } else {
      pendingOpenRef.current = false;
      progress.value = withTiming(
        0,
        { duration: reducedMotion ? 0 : CLOSE_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setRendered)(false);
        },
      );
    }
  }, [open, reducedMotion]);

  function toggle() {
    if (isControlled) {
      onToggle?.();
      return;
    }
    setOpenState((v) => !v);
  }

  function onBodyLayout(e: LayoutChangeEvent) {
    contentH.value = e.nativeEvent.layout.height;
    // First open deferred until the height was known — start the reveal now.
    if (pendingOpenRef.current) {
      pendingOpenRef.current = false;
      animateOpen();
    }
  }

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, contentH.value]),
    opacity: progress.value,
  }));

  const bodyInnerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0]) }],
  }));

  return (
    <View style={[styles.card, styles.cardRow, { borderTopColor: theme.border }]}>
      {accentColor ? <View style={[styles.accent, { backgroundColor: accentColor }]} /> : null}
      <View style={styles.cardContent}>
        <PressableScale style={styles.header} onPress={toggle} scaleTo={0.97}>
          <View style={styles.headerLeft}>
            {leadingAction ? (
              <PressableScale onPress={(e) => e.stopPropagation()} scaleTo={0.97}>{leadingAction}</PressableScale>
            ) : null}
            <View style={styles.headerLeftText}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>{badge}</Text>
              </View>
            ) : null}
            {rightAction ? <PressableScale onPress={(e) => e.stopPropagation()} scaleTo={0.97}>{rightAction}</PressableScale> : null}
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
            </Animated.View>
          </View>
        </PressableScale>
        {rendered ? (
          <Animated.View style={[styles.bodyClip, bodyStyle]}>
            <Animated.View style={bodyInnerStyle} onLayout={onBodyLayout}>
              <View style={[styles.body, { borderTopColor: theme.border }]}>{children}</View>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerLeftText: { flex: 1 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  // Outer clip: its animated `height` reveals/hides the body; overflow hidden so the
  // always-laid-out inner content is masked while collapsed/animating.
  bodyClip: {
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
  },
});
