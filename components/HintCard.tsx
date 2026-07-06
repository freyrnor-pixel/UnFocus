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
 *   Used by → app/(tabs)/index.tsx, app/(tabs)/plans.tsx, app/(tabs)/health.tsx,
 *             app/(tabs)/scan.tsx, app/habits.tsx, app/task-form.tsx, app/meals.tsx,
 *             app/habit-form.tsx, app/notes.tsx, app/onboarding/step2.tsx, app/onboarding/step3.tsx
 *   Data    → reads colours from
 *             useAppTheme(); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Always renders the how-to button (collapsed by default) — callers should still pass text/example.
 *   - text/example are passed in already-localized; this component does not call useT() itself
 *     except for the toggle button's own label (t.showHint/t.hideHint).
 *   - Uses theme.hintBg/hintBorder/hintAccent (Decision 006 token layer) —
 *     theme-tuned per palette, not a fixed hue.
 *   - Expand/collapse uses LayoutAnimation (same pattern as ExpandableCard), gated on
 *     reducedMotion per ANIMATION_GUIDELINES §7; toggle button is PressableScale so it
 *     gets the standard tap haptic + press-scale for free.
 */
import React, { useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Radius, Spacing } from '@/constants/theme';
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
};

export default function HintCard({ text, example, open: openProp, onToggle: onToggleProp }: Props) {
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
    fontWeight: '500',
  },
  example: {
    fontSize: FontSize.xs,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
