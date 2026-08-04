/**
 * StarterCard.tsx — the "here's the idea, here's an example" card shown while a surface is empty.
 *
 * A new user landing on Habits/Plans/Shopping/Health (or looking at the Energy meter before
 * anything has an energy value) gets a blank screen and no sense of what the feature is FOR.
 * This renders a short explanation plus one or more concrete example rows, inline where the
 * content would be — visible without hunting for the ⓘ pill, and gone the moment the user has
 * content of their own (most callers gate it on a plain `length === 0`, so it also comes back
 * if they later delete everything — but 3 of 7 now add extra terms: a sticky `|| …StarterAdded`,
 * a layout-suppression term, and shopping's two-collection AND. Check the caller, don't assume).
 * **Exception (2026-07-31)**: a caller whose example carries
 * a real `onAdd` (plans.tsx, health.tsx) keeps this card mounted for the rest of that visit
 * after the button is pressed — see components/StarterExampleRow's `added` Edit note — instead
 * of unmounting in the same tick the write flips `length` off zero, which read as the example
 * just disappearing.
 *
 * Deliberately NOT styled like components/HintCard: the two can be on screen together (tapping
 * ⓘ on an empty surface opens the hint above this card), and two identical accent-barred cards
 * stacked would read as a duplicate. NOTE (2026-07-31, B1-3): the ⓘ no longer auto-opens on
 * first visit — it is collapsed until tapped, everywhere — so this is no longer guaranteed to
 * happen unprompted. The reasoning still holds for the tapped case; don't "simplify" the
 * styling on the assumption the two can never co-occur.
 * This uses the neutral `theme.border` Surface of an empty placeholder —
 * "nothing here yet, here's what goes here" — while HintCard keeps the accent bar for
 * "instructions for this screen".
 *
 * Connections:
 *   Imports → components/Surface, components/StageTree (the growth-stage watermark),
 *             components/Badge (via StarterExampleRow), constants/theme,
 *             lib/useAppTheme, @expo/vector-icons
 *   Used by → app/(tabs)/habits.tsx (with one-tap starter chips in `children`, and
 *             `stage="sprout"`), app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx, app/goals.tsx, components/GoalsSheet.tsx,
 *             components/MedicineTrayCard.tsx (compact — no watermark),
 *             components/EnergyMeter.tsx (`stage="sapling"`) — most also use
 *             components/StarterExampleRow.tsx to build the `example` node
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
 *   - **The watermark is a growth-stage tree as of 2026-08-04** (design comparison task 01).
 *     It was `empty-branch` tinted in `theme.border` — a bare, leafless line, which was the
 *     one place the app's art read as absence rather than potential. The design system's rule
 *     is "floor at seed, never bare": the tree has no dead or leafless-in-decline state, the
 *     same shame-free framing the rest of the app already applies to streaks and goals.
 *   - **`stage` (2026-08-04, design comparison task 03) is a CALL-SITE choice, never data.**
 *     It defaults to `'seed'` — the floor — and a caller only raises it because its card is
 *     large enough to carry a fuller drawing (Habits' full-screen empty state takes `sprout`;
 *     the Energy tutorial, which replaces the whole meter, takes `sapling`). Nothing the user
 *     does moves it. See components/StageTree.tsx's header for why binding it to Energy, a
 *     streak or a focus session is declined by the design project *and* by lib/growth.ts.
 *   - **One tree per screen.** This card draws one whenever it is visible, so a screen that
 *     also wants an ambient tree of its own has to suppress one of them —
 *     app/(tabs)/habits.tsx is the worked example.
 *   - **It takes no `color` prop, and that is not an omission.** Every stage is an
 *     ILLUSTRATION (each carries its own baked light/dark `pal`), and components/Motif ignores
 *     `color` for those — passing one would be a prop that silently does nothing. Its
 *     strength is set with StageTree's `opacity` multiplier instead. Keep it well under the
 *     copy: a full-colour illustration is a bigger visual event than the line art it replaced,
 *     and if it starts competing with the HintCard that can sit above it, the answer is lower
 *     opacity, not a redesign of the card.
 *   - The watermark sways (±1.1°, ~6s, frozen under reduced motion). That lives in StageTree,
 *     not here — don't add a second transform on `styles.branch`.
 *   - The watermark is also the reason `card` sets `overflow: 'hidden'`.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import StageTree, { type TreeStage } from '@/components/StageTree';
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
  /**
   * Which growth stage the watermark draws. Default `'seed'` — the floor, and right for
   * almost every caller. Raise it only because the card is physically large enough to carry
   * a fuller drawing; it is a layout decision, never a reading of the user's data. See the
   * Edit notes and components/StageTree.tsx.
   */
  stage?: TreeStage;
};

export default function StarterCard({ text, example, children, compact, stage }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  return (
    <Surface borderColor={theme.border} style={[styles.card, compact && styles.cardCompact]}>
      {/* The growth tree — the empty-state member of the motif family. It says "nothing has
          grown here yet" without saying anything is wrong, and it visually anticipates the
          growth backdrop the app fills in later. Skipped on `compact`, which is too small to
          carry a watermark without crowding its one line of text. */}
      {compact ? null : (
        <StageTree stage={stage} opacity={0.34} style={styles.branch} />
      )}
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
    // The branch watermark is absolutely positioned inside; without this it would paint
    // outside the card's rounded corners.
    overflow: 'hidden',
  },
  // Tucked into the trailing edge, vertically centred, sized so it reads as texture behind
  // the copy rather than an illustration competing with it. pointerEvents is already 'none'
  // inside Motif, so it can never intercept a tap on the example row.
  branch: {
    position: 'absolute',
    // `right: 0`, not the -Spacing.sm this carried while the watermark was a bare <Svg>
    // (2026-08-04). StageTree wraps the Motif in a View to carry the sway transform, and
    // `npm run wraps`' clipped-controls detector deliberately skips <svg> elements but not a
    // plain wrapper — so the 8px overhang went from invisible to 8 reported "sliced control"
    // findings across every screen with a StarterCard. The overhang bought nothing: `fit="meet"`
    // letterboxes the 300×340 art inside this box, so the tree sat inside the card's edge
    // either way. Don't reintroduce a negative offset here to "tuck" it.
    //
    // A small POSITIVE inset, not 0: on the three surfaces where a StarterCard is nested inside
    // another card (Home's and the config sheet's Energy tutorial, the Habits list), the nearest
    // overflow-clipping ancestor is that outer card, not this one, so `right: 0` still left the
    // wrapper 2–3px past the real mask. Spacing.xs clears every nesting depth in the app.
    right: Spacing.xs,
    top: 0,
    bottom: 0,
    width: 96,
    // No `opacity` here: every stage is an ILLUSTRATION with its own baked palette, so its
    // strength is set once via StageTree's `opacity` prop at the call site. Two opacity
    // controls on one watermark is how it ends up invisible in one theme and loud in the other.
    // No `transform` here either — the idle sway is StageTree's, and a second transform on the
    // same view would replace it outright rather than compose with it.
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
