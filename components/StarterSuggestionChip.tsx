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
 *   Used by → app/habits.tsx, components/HomeHabitsCard.tsx (both pass `leading`, a
 *             components/HabitIcon — a habit's glyph may be a legacy emoji, which Ionicons
 *             cannot draw) and components/HealthIssuesEditor.tsx (passes `icon`, an Ionicons
 *             name). Every caller renders these inside components/StarterCard's `children`
 *             slot. components/GoalsEditor.tsx was the fourth until 2026-08-13 and now uses
 *             components/StarterExampleRow — see the "which shape" note below.
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
 *     exact inversion the 2026-08-10 report was about. Two of the four channels that pass set —
 *     the dashed edge and the italic label — were themselves ruled out on 2026-08-18 (see the
 *     next note); what survives is the part that still matters, muted ink and the accent on the
 *     "+" alone. Read StarterExampleRow's own reversal note before making any of this look
 *     finished again.
 *   - **⚠️ Borderless and upright since 2026-08-18.** Maintainer: *"Suggestion chips should be
 *     simple, borderless, matte shapes… Remove all italicized text."* So the dashed FIELD-rung
 *     edge is gone and so is the slant; the chip is a flat `getMatte()` plate with muted upright
 *     ink. The two shapes are STILL one finish — StarterExampleRow lost its edge and its italic
 *     in the same pass — so the rule that opens this note is unchanged: change a channel here
 *     and change it there in the same edit.
 *   - **`Radius.full` is kept, and is the one thing deliberately NOT converged.** The row is
 *     `Radius.sm` because it is the shape of a row; a pill is the shape of a wrapping cloud.
 *     The finish converged, the shape did not — that is the ruling, not an oversight.
 *   - **Which shape a surface should pick (2026-08-13).** Chip or row is decided by the LABELS,
 *     not by the surface: a chip is for suggestions short enough that two or more share a line
 *     (Habits' "Drikk 4 glass vann" + "Morgenstrekk"), because that is what makes a cloud read
 *     as a cloud. Once each label needs most of a line the cloud stops wrapping and starts
 *     STAIRCASING — four dashed pills each on its own line, left edges stepping in and out —
 *     and at that point components/StarterExampleRow is strictly better: same finish, even left
 *     edge, no ragged tail. That is why components/GoalsEditor.tsx moved off this component;
 *     its four goals were sentences ("Mer tid med dem jeg er glad i" — since shortened, once
 *     the row shape made a sentence ellipsize at 327px). AGENTS.md's line about
 *     "four full-width dashed rows would be a wall of dashes" is the counter-argument, and it
 *     is real — but a staircase of four dashed pills is that wall plus a ragged edge, so it
 *     only argues against rows where the chips were actually pairing up.
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
import { Fonts, FontSize, getMatte, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';

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
  const isDark = useIsDark();
  // **A simple, borderless, matte shape (2026-08-18)** — maintainer's words. A flat translucent
  // plate, no stroke of any kind, muted upright ink, and the accent spent on the "+" alone.
  // See the Edit notes before drawing an edge on this again.
  return (
    <PressableScale
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={addLabel ? `${addLabel} ${label}` : label}
      style={[styles.chip, { backgroundColor: getMatte(isDark) }]}
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
    // No border at all (2026-08-18). The matte plate set at the call site is the whole shape.
    // NOT the row's radius — a pill is the cloud's shape, and the shape is what stayed
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
    // Upright (2026-08-18, *"Remove all italicized text"*) — muted ink alone carries the
    // "not yours yet" voice, exactly as it now does on components/StarterExampleRow.
  },
  // A wrapper rather than a bare glyph so the "+" keeps its own optical column when the label
  // wraps nothing and the chip is at its narrowest.
  add: { alignItems: 'center', justifyContent: 'center' },
});
