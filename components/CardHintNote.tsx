/**
 * CardHintNote.tsx — the one-line explainer that sits at the FOOT of a card, not in its middle.
 *
 * Every list-bearing card used to open with its tip: header, then a bulb + italic sentence,
 * then (sometimes) an uppercase "EXAMPLE TASKS" caption, and only then the actual content
 * (2026-07-30, user report: "move tips to places they're not in the way, interrupting, and
 * takes less space"). Two or three lines of teaching stood between the title and the thing the
 * card is for, on every card, every visit until it had content.
 *
 * This is that tip, moved below the content and shrunk to one small italic line under a
 * hairline — the shape components/EnergyMeter.tsx already used for its permanent hint, now
 * shared so all five cards read as one system instead of five hand-rolled explainer blocks.
 *
 * Connections:
 *   Imports → constants/theme (FontSize, Spacing), lib/useAppTheme, @expo/vector-icons
 *   Used by → components/{PlanTaskCard,HomeHabitsCard,HomeNotesCard,HomeShoppingCard,
 *             EnergyMeter}.tsx
 *   Data    → none — presentational; `text` arrives already localized (same contract as
 *             HintCard/StarterCard, which never call useT() themselves)
 *
 * Edit notes:
 *   - **Keep it to ONE short line.** The copy under `starters.*` in lib/i18n.ts was trimmed to
 *     fit this at 360px in Norwegian (the widest language here — always re-check with
 *     `npm run wraps -- --lang=no --width=360`). A tip taller than the content it explains is
 *     the complaint this exists to fix; if a sentence won't fit, shorten the sentence rather
 *     than letting this grow to two lines.
 *   - The hairline is a `borderTopWidth`, so this attaches to whatever it follows rather than
 *     floating as its own paragraph. Mount it as the LAST child of the card's content view,
 *     after the pad/list — never above it.
 *   - **`noBorder`** (2026-07-31, user report): every current caller except EnergyMeter mounts
 *     this directly after a `PadSheet`, which already draws its own trailing rule under the
 *     type line — two hairlines back to back read as one doubled-up line. Pass `noBorder` in
 *     that case so this note relies on the pad's own rule and only adds the gap (`marginTop`)
 *     below it; leave it unset (the default) when nothing above already drew a rule, as in
 *     EnergyMeter.
 *   - Deliberately not a StarterCard: that is a bordered Surface for an empty SCREEN, and a
 *     Surface inside a card's Surface reads as a nested panel.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** The one-line tip, already localized. */
  text: string;
  /** Skip the top hairline — for when this directly follows a PadSheet, which already drew
   *  its own trailing rule under the type line (see the edit note above). */
  noBorder?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function CardHintNote({ text, noBorder, style }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, { borderTopColor: theme.border }, noBorder && styles.noBorder, style]}>
      <Ionicons name="bulb-outline" size={12} color={theme.textMuted} style={styles.icon} />
      <Text style={[styles.text, { color: theme.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xs,
    // Spacing.md, up from .sm (2026-07-30, user report: the hairline above this and the
    // pad's own last rule/type-line rule read as two lines stacked right on top of each
    // other on an empty card). This is the gap that separates them.
    marginTop: Spacing.md,
  },
  noBorder: { borderTopWidth: 0 },
  icon: { marginTop: 1 },
  text: { flex: 1, fontSize: FontSize.xs, lineHeight: 16, fontStyle: 'italic' },
});
