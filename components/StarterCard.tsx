/**
 * StarterCard.tsx — the "here's the idea, here's an example" card shown while a surface is empty.
 *
 * A new user landing on Habits/Plans/Shopping/Health (or looking at the Energy meter before
 * anything has an energy value) gets a blank screen and no sense of what the feature is FOR.
 * This renders a short explanation plus one concrete example, inline where the content would
 * be — visible without hunting for the ⓘ pill, and gone the moment the user has content of
 * their own (every caller gates it on a plain `length === 0`, so it also comes back if they
 * later delete everything).
 *
 * Deliberately NOT styled like components/HintCard: on a screen's first visit the ⓘ hint
 * auto-opens (lib/useFirstVisitHint.ts), and two identical accent-barred cards stacked would
 * read as a duplicate. This uses the neutral `theme.border` Surface of an empty placeholder —
 * "nothing here yet, here's what goes here" — while HintCard keeps the accent bar for
 * "instructions for this screen".
 *
 * Connections:
 *   Imports → components/Surface, constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/habits.tsx (with one-tap starter chips in `children`),
 *             app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx, app/(tabs)/health.tsx,
 *             components/EnergyMeter.tsx
 *   Data    → none — pure presentation; callers pass already-localized strings
 *
 * Edit notes:
 *   - `text`/`example` arrive already-localized (same contract as HintCard); this file never
 *     calls useT(). The copy lives under `starters.*` in lib/i18n.ts.
 *   - `example` is the italic muted line, matching HintCard's example styling so the two
 *     surfaces read as the same voice even though the containers differ.
 *   - `children` is the optional action slot (Habits puts its starter chips there). Keep it
 *     to lightweight chips — this is an explainer, not a form.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Surface from '@/components/Surface';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  /** The short explanation — 1–3 sentences, already localized. */
  text: string;
  /** Optional concrete example, rendered italic + muted below the text. */
  example?: string;
  /** Optional action slot — e.g. the Habits one-tap starter chips. */
  children?: React.ReactNode;
};

export default function StarterCard({ text, example, children }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  return (
    <Surface borderColor={theme.border} style={styles.card}>
      <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
      {example ? <Text style={[styles.example, { color: theme.textMuted }]}>{example}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    gap: Spacing.xs,
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
  actions: {
    marginTop: Spacing.sm,
  },
});
