/**
 * StarterCard.tsx — the "here's the idea, here's an example" card shown while a surface is empty.
 *
 * A new user landing on Habits/Plans/Shopping/Health (or looking at the Energy meter before
 * anything has an energy value) gets a blank screen and no sense of what the feature is FOR.
 * This renders a short explanation plus one or more concrete example rows, inline where the
 * content would be — visible without hunting for the ⓘ pill, and gone the moment the user has
 * content of their own (every caller gates it on a plain `length === 0`, so it also comes back
 * if they later delete everything). **Exception (2026-07-31)**: a caller whose example carries
 * a real `onAdd` (plans.tsx, health.tsx) keeps this card mounted for the rest of that visit
 * after the button is pressed — see components/StarterExampleRow's `added` Edit note — instead
 * of unmounting in the same tick the write flips `length` off zero, which read as the example
 * just disappearing.
 *
 * Deliberately NOT styled like components/HintCard: on a screen's first visit the ⓘ hint
 * auto-opens (lib/useFirstVisitHint.ts), and two identical accent-barred cards stacked would
 * read as a duplicate. This uses the neutral `theme.border` Surface of an empty placeholder —
 * "nothing here yet, here's what goes here" — while HintCard keeps the accent bar for
 * "instructions for this screen".
 *
 * Connections:
 *   Imports → components/Surface, components/Badge (via StarterExampleRow), constants/theme,
 *             lib/useAppTheme, @expo/vector-icons
 *   Used by → app/(tabs)/habits.tsx (with one-tap starter chips in `children`),
 *             app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx, app/(tabs)/health.tsx,
 *             components/EnergyMeter.tsx — each also uses components/StarterExampleRow.tsx
 *             to build the `example` node
 *   Data    → none — pure presentation; callers pass already-localized strings
 *
 * Edit notes:
 *   - `text` arrives already-localized (same contract as HintCard); this file never calls
 *     useT(). The copy lives under `starters.*` in lib/i18n.ts.
 *   - `text` gets a small leading bulb glyph + italic styling so it visually reads as "here's
 *     the idea" rather than generic body copy (2026-07-27 — was indistinguishable from a
 *     regular paragraph).
 *   - `example` is now a ReactNode, not a sentence: callers render one or more
 *     `components/StarterExampleRow` inside it so the "example" actually looks like a row
 *     from that list (icon + title + meta pill) instead of a description of one
 *     (2026-07-27 — the old italic sentence read as more prose, not a concrete example).
 *   - **The `exampleLabel` caption is gone (2026-07-30)**: the uppercase "EXAMPLE TASKS" line
 *     above the rows became a small `tag` chip on the row itself (see StarterExampleRow's own
 *     Edit notes) — same disambiguation, one fewer full-width line of teaching.
 *   - `children` is the optional action slot (Habits puts its starter chips there). Keep it
 *     to lightweight chips — this is an explainer, not a form.
 *   - `compact` (2026-07-27) is the note-sized variant: smaller padding + type and no
 *     "EXAMPLE" caption. Its only caller (components/MedicineTrayCard) passes `text` alone,
 *     which is the intended use — a compact card annotating one small surface shouldn't be
 *     carrying example rows in the first place. Energy's compact card, the other original
 *     caller, became a permanent inline hint in its own card instead (see EnergyMeter's
 *     header). List surfaces (Habits/Plans/Shopping/Health) keep the default size.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  /** The short explanation — one sentence, already localized. */
  text: string;
  /** Optional concrete example — one or more StarterExampleRow nodes, not plain text. */
  example?: React.ReactNode;
  /** Optional action slot — e.g. the Habits one-tap starter chips. */
  children?: React.ReactNode;
  /**
   * Note-sized variant (2026-07-27): tighter padding/type, no "EXAMPLE" caption, and the
   * examples flow as wrapped chips on one line instead of stacked full-width rows. For a
   * card that annotates a single small surface rather than heading an empty list — see the
   * Edit notes.
   */
  compact?: boolean;
};

export default function StarterCard({ text, example, children, compact }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  return (
    <Surface borderColor={theme.border} style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.textRow}>
        <Ionicons name="bulb-outline" size={compact ? 12 : 14} color={theme.textMuted} style={styles.bulbIcon} />
        <Text style={[styles.text, compact && styles.textCompact, { color: theme.text }]}>{text}</Text>
      </View>
      {example ? (
        <View style={[styles.exampleBlock, compact && styles.exampleBlockCompact]}>
          <View style={[styles.exampleRows, compact && styles.exampleRowsCompact]}>{example}</View>
        </View>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardCompact: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  textRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  bulbIcon: {
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  textCompact: {
    fontSize: FontSize.xs,
    lineHeight: 17,
  },
  exampleBlock: {
    marginTop: Spacing.xs,
    gap: 4,
  },
  exampleBlockCompact: {
    marginTop: 0,
  },
  exampleRows: {
    gap: Spacing.xs,
  },
  // Compact: chips flow left-to-right and wrap, so two short examples share one line.
  exampleRowsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  actions: {
    marginTop: Spacing.sm,
  },
});
