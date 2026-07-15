/**
 * ExpandableCard.tsx — collapsible card with animated header chevron.
 *
 * Generic accordion container: shows a title/subtitle/badge row that toggles a
 * body section with a smooth reveal and a rotating arrow. Content, labels, and
 * optional right/leading actions are all passed in as children/props.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/PressableScale,
 *             components/Collapsible (body reveal), components/AnimatedChevron (arrow)
 *   Used by → components/WeekListCard.tsx (dish groups + collapsed "bought this week"
 *             history, uncontrolled), app/shopping.tsx (Monthly catalog dish groups);
 *             later Phase 3/6 sessions may also wire this into InboxSection/meals/health
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
 *     `accentColor` still tints the left accent bar only.
 *   - Optional controlled mode: pass both `open` and `onToggle` to let the parent own the
 *     open/closed state (needed when a screen must aggregate state across many instances,
 *     e.g. per-task dirty tracking). Omit both and it behaves exactly as before (internal
 *     useState).
 *   - `rightAction` is wrapped in its own Pressable that calls `e.stopPropagation()` so taps on
 *     a checkbox/save-pill passed as rightAction don't also toggle the header.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';

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
  const styles = useScaledStyles(baseStyles);

  function toggle() {
    if (isControlled) {
      onToggle?.();
      return;
    }
    setOpenState((v) => !v);
  }

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
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
  },
});
