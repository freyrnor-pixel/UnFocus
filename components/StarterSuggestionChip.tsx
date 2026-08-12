/**
 * StarterSuggestionChip.tsx — one tappable suggestion in an empty surface's "pick one to start"
 * cloud, drawn as a **provisional sketch** in the same finish as components/StarterExampleRow.
 *
 * The chip and the example row are the app's two empty-state example shapes, and the split is
 * deliberate: a ROW is one illustration of a row in the list below it, a CHIP is one of N
 * pick-one suggestions that has to WRAP (four goal starters drawn as four full-width dashed
 * rows would be a wall of dashes exactly where an empty state should read light). What is NOT
 * deliberate — and what this component exists to end — is the two shapes having different
 * FINISHES. See the Edit notes.
 *
 * Connections:
 *   Imports → components/PressableScale, constants/theme, lib/useAppTheme
 *   Used by → app/(tabs)/habits.tsx, components/HomeHabitsCard.tsx (both pass `leading`, a
 *             components/HabitIcon — a habit's glyph may be a legacy emoji, which Ionicons
 *             cannot draw), components/GoalsEditor.tsx,
 *             components/HealthIssuesSheet.tsx (all three pass `icon`, an Ionicons name).
 *             Every caller renders these inside components/StarterCard's `children` slot.
 *   Data    → none — pure presentation; callers pass already-localized strings and own the
 *             store write (and its own haptic) behind `onAdd`, matching
 *             components/StarterExampleRow's contract
 *
 * Edit notes:
 *   - **The finish is StarterExampleRow's, and that is the whole point of this file
 *     (2026-08-12).** Maintainer: *"Examples are placed the same throughout app, but does not
 *     look the same … the dotted lines instead of full border and the filled buttons. I prefer
 *     the visual in the to-do preview card."* The 2026-08-10 reversal that made an example read
 *     as provisional — dashed, unfilled, muted italic, neutral, accent reserved for the "+" —
 *     was applied to the example ROW only. The chips were never revisited, so they still wore
 *     precisely the styling that reversal removed (solid border, fill, full-contrast label),
 *     which meant Habits' suggestions read as MORE finished than Health's example did: the
 *     exact inversion the 2026-08-10 report was about. Every channel here now says provisional:
 *       • **dashed** border at the FIELD rung in neutral `theme.border`
 *       • **no fill** — transparent, so it never reads as a filled button
 *       • label in `theme.textMuted`, **italic** — StarterCard's own explainer voice
 *       • leading glyph neutral; `theme.accent` survives on the trailing "+" alone
 *     Read StarterExampleRow's own reversal note before making any of this look finished again.
 *   - **`Radius.full` is kept, and is the one thing deliberately NOT converged.** The row is
 *     `Radius.sm` because it is the shape of a row; a pill is the shape of a wrapping cloud.
 *     The finish converged, the shape did not — that is the ruling, not an oversight.
 *   - **Every chip has the trailing "+", including the three that used to have none.** Goals,
 *     the Goals drawer and the health-issues sheet drew an accent glyph on the LEFT and no "+",
 *     while Habits drew a neutral glyph and a "+" — one gesture with two anatomies. The row's
 *     rule settles it: the accent marks the ACTION, never the ink (A.4 rule 1).
 *   - **No colour prop, deliberately.** Habits and HomeHabitsCard hued the chip's edge with the
 *     screen colour while the other three used `theme.border`, which is half of why the five
 *     hand-rolled copies never matched. The edge is neutral everywhere now, exactly as the
 *     example row's is; the screen hue reaches these chips through the card that holds them.
 *   - **No `scaleTo`, no `travel`.** PressableScale's default sink (`press="key"`, `Travel.sm`)
 *     is right for a fill-less chip — it sinks against the surface behind it. The old
 *     `scaleTo={0.96}` two of the call sites passed had been inert since the 2026-08-10 press
 *     pass anyway (`scaleTo` applies only under an explicit `press="scale"`).
 *   - **No `minWidth`, and don't add one.** These wrap; AGENTS.md's wrap-audit lesson is that a
 *     `minWidth` + `flexWrap` row has a hard floor that breaks silently on a 360px phone. The
 *     cloud is allowed to wrap — it is the documented benign finding in `npm run wraps`.
 *   - There is no `added` state here, unlike StarterExampleRow's. A chip's caller removes it
 *     from the cloud (or unmounts the whole card once every starter exists), so there is never
 *     a chip left on screen with nothing to add.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { BORDER_WIDTH, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** The suggestion itself, already localized (e.g. "Drink water", "Less time on my phone"). */
  label: string;
  /** Leading glyph as an Ionicons name — drawn neutral. Ignored when `leading` is passed. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /**
   * Leading glyph as a node, for a caller whose glyph is not a plain Ionicons name — the two
   * habit surfaces pass a components/HabitIcon, since a habit's stored icon may be a legacy
   * emoji string. Draw it in `theme.textMuted` at size 14 to match `icon`.
   */
  leading?: React.ReactNode;
  /** Writes this suggestion into the real store. The caller owns the write AND its haptic. */
  onAdd: () => void;
  /** Accessibility-label prefix, e.g. "Add" → "Add Drink water". */
  addLabel?: string;
};

export default function StarterSuggestionChip({ label, icon, leading, onAdd, addLabel }: Props) {
  const theme = useAppTheme();
  // Dashed + unfilled + neutral, with the accent on the "+" alone: the same four channels
  // components/StarterExampleRow uses to say "this isn't here yet". See the Edit notes before
  // giving any of it a fill or a solid edge again.
  return (
    <PressableScale
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={addLabel ? `${addLabel} ${label}` : label}
      style={[styles.chip, { borderColor: theme.border }]}
    >
      {leading ?? (icon ? <Ionicons name={icon} size={14} color={theme.textMuted} /> : null)}
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      {/* The one action colour, on the one thing that acts — the same place the example row
          spends its accent. */}
      <View style={styles.add}>
        <Ionicons name="add" size={14} color={theme.accent} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    // The FIELD rung and a dashed edge — the example row's exact border, so the two example
    // shapes are one weight and one finish. Three of the five call sites this replaced used a
    // literal `1`, two of them hued.
    borderWidth: BORDER_WIDTH.field,
    borderStyle: 'dashed',
    // NOT the row's Radius.sm — a pill is the cloud's shape, and the shape is what stayed
    // different on purpose (see the Edit notes).
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    // One height for the cloud. It was 36 in three files and unset in the other two, so a
    // Goals chip and a Habits chip were different sizes for the same job.
    minHeight: 36,
  },
  label: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
    // Italic, in textMuted — StarterCard's explainer voice, which is what ties a suggestion to
    // the teaching card rather than to the list it will land in.
    fontStyle: 'italic',
  },
  // A wrapper rather than a bare glyph so the "+" keeps its own optical column when the label
  // wraps nothing and the chip is at its narrowest.
  add: { alignItems: 'center', justifyContent: 'center' },
});
