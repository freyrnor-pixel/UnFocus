/**
 * ExpandableCard.tsx — collapsible card with animated header chevron.
 *
 * Generic accordion container: shows a title/subtitle/badge row that toggles a
 * body section with a smooth reveal and a rotating arrow. Content, labels, and
 * optional right/leading actions are all passed in as children/props.
 *
 * Connections:
 *   Imports → constants/theme, constants/motion (Spring.calm — calmer header-press release),
 *             lib/useAppTheme, components/PressableScale,
 *             components/Collapsible (body reveal), components/AnimatedChevron (arrow)
 *   Used by → components/WeekListCard.tsx (dish groups + collapsed "bought this week"
 *             history, uncontrolled), app/shopping.tsx (Monthly catalog dish groups),
 *             app/settings.tsx (merged setting-group panels — passes `rounded`, see that
 *             prop's doc below); later Phase 3/6 sessions may also wire this into InboxSection/meals/health
 *             per Decision 009. NOTE: PlanTaskCard does NOT wrap ExpandableCard — Decision
 *             009a redesigned the Plans preview into a bespoke proportional-rail day-view
 *             (its collapsed state still shows content, which ExpandableCard's hide-all-body
 *             accordion shape can't express), superseding Decision 009 #2's original
 *             "PlanTaskCard wraps ExpandableCard" reference.
 *   Data    → driven by props; reads scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - **Reveal is delegated to Collapsible (2026-07-15).** This card used to animate a
 *     measured body height via `useAnimatedStyle` (`height: interpolate(...)`). Under
 *     Reanimated 4 + the New Architecture that does NOT drive a visible reveal — the arrow
 *     rotated but the body stayed clipped at height 0 (same class of bug as PR #183's
 *     Collapsible). It now reuses `Collapsible`, which reveals via the reliable
 *     entering/exiting/`layout` layout-animation primitives, and `AnimatedChevron` for the
 *     arrow (a `transform` rotation, always reliable). No `height` math or onLayout here.
 *   - Collapsible renders null while closed, preserving the old lazy-mount of the body (a
 *     collapsed card renders no children — matters for long lists like WeekListCard history).
 *   - `leadingAction` renders before the title/subtitle stack inside headerLeft (same
 *     stopPropagation-wrapped Pressable pattern as `rightAction`) — e.g. a severity badge
 *     needs to sit leading rather than trailing, where a checkbox lives on the right.
 *   - Decision 043 rule 1: every caller mounts this inside its own Surface-backed card
 *     region (WeekListCard, HomeShoppingCard, shopping.tsx's Monthly catalog card), so this
 *     component does NOT render its own Surface — that would be Surface-inside-Surface.
 *     The row is a plain View with a hairline top divider (`theme.border`) for grouping;
 *     `accentColor` still tints the left accent bar only. Pass `first` on the first (or only)
 *     card in a Surface to suppress that divider — see the `first` prop doc above.
 *   - Optional controlled mode: pass both `open` and `onToggle` to let the parent own the
 *     open/closed state (needed when a screen must aggregate state across many instances,
 *     e.g. per-task dirty tracking). Omit both and it behaves exactly as before (internal
 *     useState).
 *   - `rightAction` is wrapped in its own Pressable that calls `e.stopPropagation()` so taps on
 *     a checkbox/save-pill passed as rightAction don't also toggle the header.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts, Radius, Spacing, FontSize } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import { Spring } from '@/constants/motion';

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
  /**
   * Pass true on the first (or only) ExpandableCard inside a Surface. The hairline top
   * divider exists to separate stacked cards from each other, but on the first one it has
   * nothing above it to separate from — flush against the Surface's rounded top edge it reads
   * as a flat, square-cornered line cutting across an otherwise rounded card (2026-07-21 fix).
   */
  first?: boolean;
  /**
   * Settings-only variant (app/settings.tsx, 2026-07-23): each row gets its own rounded,
   * sunken (theme.surfaceMuted) background and a small gap instead of a flush hairline
   * divider — reads as a stack of individually rounded rows rather than one flat merged
   * block. Default false preserves the original flush-divider look for every other caller
   * (WeekListCard, shopping.tsx) — this does NOT nest another Surface (still respects
   * Decision 043 rule 1's no-Surface-in-Surface rule above), it's a plain tinted background.
   */
  rounded?: boolean;
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
  first = false,
  rounded = false,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const [openState, setOpenState] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : openState;

  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  function toggle() {
    if (isControlled) {
      onToggle?.();
      return;
    }
    setOpenState((v) => !v);
  }

  return (
    <View
      style={[
        styles.card,
        styles.cardRow,
        rounded
          ? [styles.cardRounded, { backgroundColor: theme.surfaceMuted }, !first && styles.cardRoundedGap]
          : !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}
    >
      {accentColor ? <View style={[styles.accent, { backgroundColor: accentColor }]} /> : null}
      <View style={styles.cardContent}>
        <PressableScale style={styles.header} onPress={toggle} scaleTo={0.97} releaseSpring={Spring.calm}>
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
            <AnimatedChevron open={open} size={16} color={theme.textMuted} />
          </View>
        </PressableScale>
        <Collapsible open={open}>
          <View style={[styles.body, { borderTopColor: theme.border }]}>{children}</View>
        </Collapsible>
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
  },
  // `rounded` variant (Settings only, see the prop doc above): each row is its own rounded,
  // sunken tile instead of a flush divider-separated slice of one flat block.
  cardRounded: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  cardRoundedGap: {
    marginTop: Spacing.xs,
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
    fontFamily: Fonts.semibold,
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
    fontFamily: Fonts.semibold,
  },
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
  },
});
