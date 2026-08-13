/**
 * CardHintNote.tsx — the one-line explainer that sits under a card's header while the card is
 * empty, and at its foot once it has content.
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
 *             MedicineTrayCard,EnergyMeter}.tsx and app/(tabs)/{habits,health}.tsx — everything
 *             except EnergyMeter at `placement="head"`, EnergyMeter alone at the default foot
 *             (its hint is permanent AND annotates a meter with a number in it). The two tabs
 *             joined 2026-08-13, replacing two separately hand-rolled copies of this line that
 *             had drifted to different type sizes and weights; **their tips are permanent, not
 *             empty-gated**, which is why "head" means "under the header" rather than "while
 *             empty" — see the placement note below
 *   Data    → none — presentational; `text` arrives already localized (same contract as
 *             HintCard/StarterCard, which never call useT() themselves)
 *
 * Edit notes:
 *   - **Keep it to ONE short line.** The copy under `starters.*` in lib/i18n.ts was trimmed to
 *     fit this at 360px in Norwegian (the widest language here — always re-check with
 *     `npm run wraps -- --lang=no --width=360`). A tip taller than the content it explains is
 *     the complaint this exists to fix; if a sentence won't fit, shorten the sentence rather
 *     than letting this grow to two lines.
 *   - **`head` means "under the header" (2026-08-12, restated 2026-08-13).** The original
 *     ruling was "explanation always sits underneath sub-header", scoped on follow-up to "only
 *     when the card is empty" — and for a while every head caller WAS empty-gated, so the two
 *     readings were indistinguishable and this note said the gate decided the placement. They
 *     came apart on 2026-08-13, when app/(tabs)/{habits,health}.tsx's permanent tips lines
 *     moved onto this component (maintainer: leave their lifespan alone, just share the
 *     component). So: the POSITION is head — under the header, where an explanation the reader
 *     needs first belongs — and whether the caller unmounts it once the card fills up is the
 *     caller's own separate decision.
 *     components/EnergyMeter.tsx is still the one caller at the default foot, and now for one
 *     clear reason rather than two entangled ones: its hint annotates a METER WITH A NUMBER IN
 *     IT, i.e. content the user already has. That is exactly what the 2026-07-30 "move tips out
 *     from between the title and the content" decision was about, and that decision is narrowed
 *     by this rule, not deleted. Pinned by lib/__tests__/exampleRows.test.ts — including the
 *     EnergyMeter counter-case, without which the rule reads as "head everywhere" and the next
 *     session flattens it into a constant.
 *   - At the foot, the hairline is a `borderTopWidth`, so this attaches to whatever it follows
 *     rather than floating as its own paragraph — mount it as the LAST child of the card's
 *     content view, after the pad/list. At the head there is nothing above it but the card's
 *     own header, which already owns the gap, so `'head'` drops the hairline and the
 *     `marginTop` and carries a `marginBottom` instead.
 *   - **`noBorder`** (2026-07-31, user report): at the FOOT, a caller mounting this directly
 *     after a `PadSheet` — which already draws its own trailing rule under the type line — gets
 *     two hairlines back to back, reading as one doubled-up line. Pass `noBorder` in that case
 *     so this note relies on the pad's own rule and only adds the gap (`marginTop`) below it;
 *     leave it unset (the default) when nothing above already drew a rule, as in EnergyMeter.
 *     Under `placement="head"` there is no hairline to suppress, so `noBorder` is a no-op —
 *     don't make head callers pass both.
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
  /**
   * Where in the card this note sits. `'foot'` (the default) keeps the historical shape — a
   * top hairline attaching it to the content above. `'head'` mounts it directly under the
   * card's header while the surface is EMPTY: no hairline (nothing above it to attach to),
   * no `marginTop` (the header already owns that gap), a `marginBottom` instead. See the
   * placement edit note above.
   */
  placement?: 'head' | 'foot';
  /** Skip the top hairline — for when this directly follows a PadSheet, which already drew
   *  its own trailing rule under the type line (see the edit note above). No-op at the head,
   *  which has no hairline to begin with. */
  noBorder?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function CardHintNote({ text, placement = 'foot', noBorder, style }: Props) {
  const theme = useAppTheme();
  const head = placement === 'head';
  return (
    <View
      style={[
        styles.row,
        { borderTopColor: theme.border },
        head ? styles.head : styles.foot,
        // `noBorder` only ever suppresses the foot's hairline; the head never draws one.
        !head && noBorder && styles.noBorder,
        style,
      ]}
    >
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
  },
  foot: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.xs,
    // Spacing.md, up from .sm (2026-07-30, user report: the hairline above this and the
    // pad's own last rule/type-line rule read as two lines stacked right on top of each
    // other on an empty card). This is the gap that separates them.
    marginTop: Spacing.md,
  },
  // The head has no hairline (nothing above it but the card's own header) and no marginTop —
  // every caller's header already carries a `marginBottom: Spacing.lg`. Only the gap DOWN to
  // the content it introduces is this note's to own.
  head: {
    marginBottom: Spacing.md,
  },
  noBorder: { borderTopWidth: 0 },
  icon: { marginTop: 1 },
  text: { flex: 1, fontSize: FontSize.xs, lineHeight: 16, fontStyle: 'italic' },
});
