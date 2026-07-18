/**
 * HintCard.tsx — collapsible instructions button shown on most screens.
 *
 * Renders as a small pill button (info icon + chevron) that expands, on tap,
 * into the flat bordered hint body with a left accent bar. Collapsed by
 * default — instructions are opt-in, not always-on chrome. Always renders
 * (showHints setting removed — the pill is always available, just collapsed).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme,
 *             lib/i18n (useT), components/PressableScale
 *   Used by → app/(tabs)/index.tsx, app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx (this-week summary + embedded Habits section),
 *             app/(tabs)/scan.tsx, app/task-form.tsx, app/meals.tsx, app/habit-form.tsx,
 *             app/notes.tsx, app/health-form.tsx, app/health-log.tsx
 *   Data    → reads colours from
 *             useAppTheme(); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Optional `children` render below text/example — used to embed a first-run setting
 *     control (shopping reset day, work mode, notifications) so a screen teaches it in
 *     context on first visit. See app/(tabs)/shopping.tsx / plans.tsx / index.tsx.
 *   - Always renders the how-to button (collapsed by default) — callers should still pass text/example.
 *   - text/example are passed in already-localized; this component does not call useT() itself
 *     except for the toggle button's own label (t.showHint/t.hideHint).
 *   - Uses theme.hintBg/hintBorder/hintAccent (Decision 006 token layer) —
 *     theme-tuned per palette, not a fixed hue.
 *   - Pill path expand/collapse uses LayoutAnimation here (same pattern as ExpandableCard),
 *     gated on reducedMotion per ANIMATION_GUIDELINES §7; toggle button is PressableScale so
 *     it gets the standard tap haptic + press-scale for free.
 *   - noPill (header-driven) mode does NOT animate from this file — the body is mounted/
 *     unmounted by the parent's `open` prop. The animation for that path lives in
 *     lib/useFirstVisitHint.ts, whose wrapped setter runs LayoutAnimation.configureNext
 *     before every open/close (auto-open, blur, and the header ⓘ toggle).
 */
import React, { useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import PressableScale from '@/components/PressableScale';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type Props = {
  text: string;
  example?: string;
  /** Controlled open state — when provided, the internal state is bypassed. */
  open?: boolean;
  /** Controlled toggle — called instead of internal setState when provided. */
  onToggle?: () => void;
  /**
   * Header-driven mode: suppress the in-content pill entirely and only
   * render the card body (controlled by `open`). Use when the screen
   * wires the ScreenScaffold infoActive/onInfoToggle props to drive the
   * hint — the header ⓘ button IS the toggle, so the pill is redundant.
   */
  noPill?: boolean;
  /**
   * Optional interactive content rendered inside the hint body, below the
   * text/example. Used to embed a first-run setting control (e.g. shopping
   * reset day, work mode) that the old onboarding wizard used to collect —
   * the hint teaches it in context on first visit. See app/(tabs)/*.
   */
  children?: React.ReactNode;
};

export default function HintCard({ text, example, open: openProp, onToggle: onToggleProp, noPill, children }: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const [openInternal, setOpenInternal] = useState(false);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;

  function toggle() {
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (isControlled) onToggleProp?.();
    else setOpenInternal((v) => !v);
  }

  // Header-driven mode: no pill, just the card body when open.
  if (noPill) {
    if (!openProp) return null;
    return (
      <View style={[styles.wrap, styles.card, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}>
        <View style={[styles.accentBar, { backgroundColor: theme.hintAccent }]} />
        <View style={styles.body}>
          <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
          {example ? <Text style={[styles.example, { color: theme.textMuted }]}>{example}</Text> : null}
          {children ? <View style={styles.childrenSlot}>{children}</View> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <PressableScale
        onPress={toggle}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityLabel={open ? t.hideHint : t.showHint}
        accessibilityState={{ expanded: open }}
        style={[styles.toggle, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}
      >
        <Ionicons name="information-circle-outline" size={18} color={theme.hintAccent} />
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={theme.hintAccent} />
      </PressableScale>
      {open && (
        <View style={[styles.card, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}>
          <View style={[styles.accentBar, { backgroundColor: theme.hintAccent }]} />
          <View style={styles.body}>
            <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
            {example ? <Text style={[styles.example, { color: theme.textMuted }]}>{example}</Text> : null}
            {children ? <View style={styles.childrenSlot}>{children}</View> : null}
          </View>
        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.md,
    marginTop: Spacing.xs,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: Spacing.sm,
  },
  body: {
    flex: 1,
    gap: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  text: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: Fonts.medium,
  },
  example: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  childrenSlot: {
    marginTop: Spacing.sm,
  },
});
