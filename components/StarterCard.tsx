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
 *             components/PressableScale (the dismiss "X" and the `collapsible` trigger row),
 *             components/Badge (via StarterExampleRow), constants/theme, constants/motion is
 *             NOT used here (LayoutAnimation comes straight from react-native), lib/useAppTheme
 *             (useAccessibility for `reducedMotion`), lib/haptics, lib/i18n (only for the
 *             dismiss button's and the collapse trigger's accessibility labels — see below),
 *             store/useSettingsStore (dismissedStarters + dismissStarter, only when a
 *             caller passes `dismissKey`), @expo/vector-icons
 *   Used by → app/(tabs)/habits.tsx (`collapsible`, starter chips in `children`,
 *             `stage="sprout"`), app/(tabs)/plans.tsx (`collapsible`), app/(tabs)/shopping.tsx,
 *             app/(tabs)/health.tsx (`collapsible`),
 *             components/PlanTaskCard.tsx (2026-08-12 — `embedded collapsible` around the empty
 *             day's example row, and deliberately NO `text` — that card had a head-mounted
 *             explainer line of its own, and has none at all since 2026-08-17),
 *             components/GoalsEditor.tsx (`embedded
 *             collapsible` since 2026-08-13 — it is mounted inside a drawer's Surface, and this
 *             component always draws its own; that line used to say GoalsEditor hand-copied the
 *             contents instead, which stopped being true when `embedded` landed),
 *             components/HomeHabitsCard.tsx (2026-08-13, `embedded collapsible` and no `text`
 *             — it hand-rolled a label-plus-bare-cloud stand-in for the trigger row until then,
 *             which made its suggestions the one set in the app that could not be folded away),
 *             components/EnergyMeter.tsx (`stage="sapling"`, NOT
 *             `collapsible` — its `children` is a config Button, not suggestions) — most also
 *             use components/StarterExampleRow.tsx to build the `example` node
 *   Data    → reads/writes settings.dismissedStarters ONLY when a caller passes
 *             `dismissKey`; otherwise unchanged (pure presentation, callers pass
 *             already-localized strings)
 *
 * Edit notes:
 *   - `text` arrives already-localized (same contract as HintCard); this file never calls
 *     useT() for `text`/`example`/`children`/`exampleHeaderLabel` — those stay the caller's
 *     job (it only calls useT() for the `collapsible` trigger's and the dismiss "X"'s own
 *     generic accessibility labels). The copy lives under `starters.*` in lib/i18n.ts.
 *   - **Universal dismiss (2026-08-06)**: pass `dismissKey` (a stable per-surface id, e.g.
 *     `'habits'`) to get a small "X" next to the explanation text. Tapping it writes the key
 *     into `settings.dismissedStarters` (store/useSettingsStore.ts, mirrors
 *     `seenScreenHints`'s shape) and this component renders NOTHING for that key from then
 *     on — checked before any other prop, so it overrides whatever emptiness gate the
 *     caller used to decide it should render (including the sticky `|| xStarterAdded` OR
 *     terms a few callers carry — see the header comment above). This is deliberately a
 *     ONE-WAY, permanent-per-key flag, not something that resets when the surface next goes
 *     empty. **As of 2026-08-06 v3, no caller actually passes `dismissKey` any more** — Goals
 *     (its last user) switched to `collapsible` instead, reversible rather than one-way (see
 *     below). The mechanism is left in place rather than deleted: it's cheap to keep, and a
 *     future surface that genuinely wants a permanent one-way hide (rather than a reversible
 *     collapse) still has it available.
 *   - **`collapsible` (2026-08-06 v3)** — turns `example`/`children` into a drop-down: shown
 *     open by default, with a bordered trigger row (`exampleHeaderLabel` + a chevron) that
 *     toggles them closed to just that one row, animated with `LayoutAnimation` (gated on
 *     `useAccessibility().reducedMotion`, same pattern components/HintCard.tsx's own pill
 *     uses). This is the mechanism app/(tabs)/habits.tsx hand-rolled locally in its
 *     2026-08-06 v2 pass (`examplesCollapsed`/`toggleExamples`, a floating bulb+chevron pill
 *     when closed) — moved here and reshaped (closed state is now a normal-looking row, not a
 *     pill) so every caller with real suggestion content shares one identical implementation
 *     instead of five near-copies. **Explicit opt-in, not inferred from `example`/`children`
 *     being present**: components/EnergyMeter.tsx already passes `children` (a single config
 *     Button) that must NOT become collapsible — it isn't a suggestions list, and wrapping a
 *     lone action button in a "tap to reveal" trigger would just add a step to reach it.
 *     `exampleHeaderLabel` is required whenever `collapsible` is true (no default copy — every
 *     caller's suggestions read differently, e.g. Habits/Goals' "Tap one to start:" vs.
 *     Plans/Health's "See an example:"). The collapse/expand accessibility labels
 *     (`t.starters.expandExamples`/`collapseExamples`) are generic and shared by every caller
 *     — unlike Habits' first pass, there is no per-screen label pair to keep in sync.
 *     The **"disappears once everything's added" gating stays the caller's job**, exactly as
 *     it always has (Habits: `!allStartersAdded`; Plans/Health: `length === 0 || …Added`) —
 *     `collapsible` only changes the SHAPE of the card while it's mounted, never whether it's
 *     mounted at all.
 *   - **⚠️ SUPERSEDED 2026-08-18 — there is NO box.** The drop-down draws no border, no radius
 *     and no divider now; the trigger row and everything it reveals sit directly on the card,
 *     separated by padding alone (maintainer: *"The 'Examples' accordion and its nested chips
 *     must lose their borders"*). The note below is kept because the thing it was protecting
 *     still holds — the trigger and its content must read as ONE element, not two stacked
 *     rectangles — and because it records that "give the accordion its own border" has already
 *     been tried and ruled on.
 *   - **(Historical) The trigger and its revealed content share ONE box (2026-08-12), not two.** Until
 *     this pass the trigger row carried its own full border+radius and the example rows below
 *     it started a fresh `marginTop` gap — so an expanded drop-down was a small bordered row
 *     sitting just above a second, separately bordered box, with visible daylight between them
 *     (user report, with a screenshot of the To-do day card's "Se et eksempel:" row: "the
 *     examples should be inside the same box as the expanded container"). The border moved to
 *     a new outer `collapsibleBox` wrapping both the trigger and the revealed body; the trigger
 *     itself now draws no border, and `overflow: 'hidden'` lets the outer radius clip its top
 *     corners exactly the way components/CollapsedSection.tsx's header+body `Surface` already
 *     does — that component was the precedent this borrows the shape from. The revealed body
 *     is split from the trigger by a hairline (`collapsibleContent`'s `borderTopWidth`), not a
 *     second full border. Individual `StarterExampleRow`s keep their own dashed field-rung
 *     border where revealed — a row nested inside this box is the same weight-graded nesting
 *     every bordered list in the app already uses, not the card-inside-a-card pattern
 *     `embedded` exists to avoid (that one is about nesting whole *Surfaces*, not a row inside
 *     the box that lists it).
 *   - **`embedded` (2026-08-12)** — renders the card's contents as a plain block: no Surface,
 *     no padding of its own, no watermark. For a caller mounting this INSIDE another card,
 *     where this component's own Surface would be a panel nested in a panel. Same contract as
 *     components/FoodTab.tsx's and components/CatalogueTab.tsx's `embedded`: **presentation
 *     only — no behaviour goes behind the flag.** The trigger row, the example rows and the
 *     chips are the same nodes in both modes.
 *     It exists because the empty-state example was three different shapes at three different
 *     depths (maintainer, 2026-08-12: "examples per card don't look the same, and are not
 *     placed the same"): Health and Habits nested this card inside their tab's card, putting
 *     the example 51px in from the screen edge, while the To-do day card renders its example
 *     bare at 33.5px. The To-do shape won. The rule now is that **an empty-state example is a
 *     row in the list it is an example of** — un-wrapped, in that list's own slot, at the same
 *     width as a real row and as the composer that would create one.
 *     Callers: app/(tabs)/health.tsx, app/(tabs)/habits.tsx, components/GoalsEditor.tsx (which
 *     hand-rolled this block before the prop existed), components/PlanTaskCard.tsx (2026-08-12
 *     — the card the shape was taken FROM, which now wraps its own bare example so it gets the
 *     collapse trigger every other surface has). components/EnergyMeter.tsx deliberately
 *     does NOT use it — its card REPLACES the meter rather than annotating a list, so it is
 *     the content of that slot and keeps its own Surface. Pinned by
 *     lib/__tests__/exampleRows.test.ts.
 *   - `text` gets a small leading bulb glyph + italic styling so it visually reads as "here's
 *     the idea" rather than generic body copy (2026-07-27 — was indistinguishable from a
 *     regular paragraph).
 *   - `example` is now a ReactNode, not a sentence: callers render one or more
 *     `components/StarterExampleRow` inside it so the "example" actually looks like a row
 *     from that list (icon + title + meta pill) instead of a description of one
 *     (2026-07-27 — the old italic sentence read as more prose, not a concrete example).
 *   - **The `exampleLabel` caption is gone (2026-07-30)**: the uppercase "EXAMPLE TASKS" line
 *     above the rows became a small `tag` chip on the row itself (see StarterExampleRow's own
 *     Edit notes) — same disambiguation, one fewer full-width line of teaching. Not to be
 *     confused with `exampleHeaderLabel` (2026-08-06 v3) above, which is the `collapsible`
 *     trigger row's own label — a different, newer thing with a similar name.
 *   - `children` is the optional action slot (Habits/Goals put their starter chips there).
 *     Keep it to lightweight chips — this is an explainer, not a form.
 *   - `compact` (2026-07-27) is the note-sized variant: smaller padding + type and no
 *     "EXAMPLE" caption. **As of 2026-08-12 it is CALLER-LESS** — components/MedicineTrayCard,
 *     its last user, moved to the shared explainer line instead, and that line was itself
 *     deleted app-wide on 2026-08-17, so that card now carries no explainer at all.
 *     Energy's compact card, the other original caller, had already become a permanent inline
 *     hint in its own card (see EnergyMeter's header). Left in place rather than deleted, the
 *     same treatment `dismissKey` above gets: it costs nothing, and a future surface wanting a
 *     note-sized card still has it. `compact` and `collapsible` have never been combined by a
 *     caller — untested together. List surfaces (Habits/Plans/Shopping/Health) keep the
 *     default size.
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
import React, { useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import StageTree, { type TreeStage } from '@/components/StageTree';
import { Fonts, FontSize, HitSlop, MIN_TAP_TARGET, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { tap } from '@/lib/haptics';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * How many lines the empty-state explanation may take (2026-08-17, brief section 3: *"Secondary
 * descriptive text must be heavily clamped… to prevent it from pushing functional UI elements off
 * the screen."*).
 *
 * Three, not two — this is a card of its own rather than a banner line, it is what stands where
 * content would be, and Shopping's mount is deliberately a two-bullet block. It is a ceiling, not
 * a target: every string under `starters.*` in lib/i18n.ts is one short sentence, and the clamp
 * exists so that a future edit cannot quietly turn one back into a paragraph.
 */
const STARTER_TEXT_LINES = 3;

type Props = {
  /**
   * The short explanation — one sentence, already localized. Optional as of 2026-08-06 v3:
   * a caller that already renders its own PERMANENT explanation line elsewhere (Habits'
   * `tipsRow`, which sits under its card's sub-header and must outlive this card's own
   * disappear-when-all-added lifecycle) omits this to avoid saying the same sentence twice,
   * with one copy tied to a shorter lifespan than the other. Every other caller keeps
   * passing it as before — the card's own explanation, gone when the card is.
   */
  text?: string;
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
  /**
   * Stable per-surface id (e.g. `'habits'`) that makes this card dismissible. See the
   * "Universal dismiss" edit note above. Omit to keep the card non-dismissible (unchanged
   * behavior for every existing call site until it opts in).
   */
  dismissKey?: string;
  /**
   * Turns `example`/`children` into a drop-down: shown open by default, collapsible to a
   * single normal-looking trigger row. See the "`collapsible` (2026-08-06 v3)" edit note
   * above. Requires `exampleHeaderLabel`. Default `false` — unchanged behavior for every
   * existing call site until it opts in.
   */
  collapsible?: boolean;
  /**
   * The `collapsible` trigger row's always-visible label (already-localized, same contract
   * as `text`). Required when `collapsible` is true — there is no generic default because
   * each caller's suggestions read differently (e.g. "Tap one to start:" vs "See an
   * example:").
   */
  exampleHeaderLabel?: string;
  /**
   * Drop the card's own Surface + padding + watermark and render as a plain block, for a
   * caller mounting this INSIDE another card. Presentation only — see the "`embedded`" edit
   * note above. Default `false`.
   */
  embedded?: boolean;
};

export default function StarterCard({
  text,
  example,
  children,
  compact,
  stage,
  dismissKey,
  collapsible,
  exampleHeaderLabel,
  embedded,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();
  // Hooks run unconditionally regardless of whether `dismissKey` was passed — only the
  // derived boolean is conditional. `false` when no key was given, so a call site that
  // never opts in can never be affected by another surface's dismissal.
  const dismissed = useSettingsStore((s) => (dismissKey ? s.dismissedStarters.includes(dismissKey) : false));
  const dismissStarter = useSettingsStore((s) => s.dismissStarter);
  // Shown open by default ("examples are shown by default in a drop-down"). Local, not
  // persisted — same as habits.tsx's first-pass `examplesCollapsed`, which this replaces.
  const [collapsed, setCollapsed] = useState(false);

  // Checked before anything else below: a dismissed card renders nothing, overriding
  // whatever emptiness gate the caller used to decide it should show one.
  if (dismissed) return null;

  const hasExampleContent = Boolean(example || children);

  function toggleCollapsed() {
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    tap();
    setCollapsed((v) => !v);
  }

  const body = (
    <>
      {/* The growth tree — the empty-state member of the motif family. It says "nothing has
          grown here yet" without saying anything is wrong, and it visually anticipates the
          growth backdrop the app fills in later. Skipped on `compact`, which is too small to
          carry a watermark without crowding its one line of text — and on `embedded`, where
          there is no card of ours for it to be a watermark ON, and the host screen already
          has its own tree ("one tree per screen"). */}
      {compact || embedded ? null : (
        <StageTree stage={stage} opacity={0.34} style={styles.branch} />
      )}
      {/* Corner-anchored, matching components/HintCard.tsx's (2026-08-14). It used to be the
          third child of `textRow`, which put it beside the LAST line of a wrapping sentence
          rather than in the card's corner, and gated it on `text` being present. Both are the
          same defect HintCard's × had, and the maintainer's rule — an X for remove goes where
          every other app puts one — applies to whichever card is on screen. */}
      {dismissKey ? (
        <PressableScale
          onPress={() => { tap(); dismissStarter(dismissKey); }}
          hitSlop={HitSlop.base}
          accessibilityRole="button"
          accessibilityLabel={t.starters.dismiss}
          style={styles.dismiss}
        >
          <Ionicons name="close" size={compact ? 14 : 16} color={theme.textMuted} />
        </PressableScale>
      ) : null}
      {text ? (
        <View style={[styles.textRow, dismissKey && styles.textRowDismissable]}>
          {/* No bulb (2026-08-17, "delete all lightbulb sections entirely"). This is the last
              explainer tier standing — it is what an EMPTY surface says instead of being blank,
              so the sentence stays — but the 💡 that marked it as part of the manual does not,
              and neither does the indent it needed. Clamped so an empty state can never grow
              into a paragraph again (brief section 3). */}
          <Text
            style={[styles.text, compact && styles.textCompact, { color: theme.text }]}
            numberOfLines={STARTER_TEXT_LINES}
          >
            {text}
          </Text>
        </View>
      ) : null}
      {collapsible && hasExampleContent ? (
        // **No box at all (2026-08-18).** Maintainer: *"Do NOT place borders, `<Divider/>`
        // lines, or separate background boxes inside of main cards. The 'Examples' accordion
        // and its nested chips must lose their borders… Separate elements using purely padding
        // and typography."* So the outer `collapsibleBox` border, its radius, its clipping mask
        // and the hairline that split the trigger from the revealed body are all gone; the
        // trigger is a plain row and its content sits directly on the card underneath.
        //   This supersedes the 2026-08-12 "one box, not two" pass, which was the right answer
        // to the question it was asked (an expanded drop-down drawn as a bordered row floating
        // above a separately bordered box) — the box is simply not the unit any more. What that
        // pass was really protecting is preserved: the trigger and what it reveals still read
        // as one thing, now because nothing is drawn between them.
        <View style={styles.collapsibleBox}>
          <PressableScale
            onPress={toggleCollapsed}
            style={styles.triggerRow}
            accessibilityRole="button"
            accessibilityLabel={collapsed ? t.starters.expandExamples : t.starters.collapseExamples}
            accessibilityState={{ expanded: !collapsed }}
          >
            <Text style={[styles.triggerLabel, { color: theme.textMuted }]} numberOfLines={1}>
              {exampleHeaderLabel}
            </Text>
            <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} color={theme.textMuted} />
          </PressableScale>
          {collapsed ? null : (
            <View style={styles.collapsibleContent}>
              {example ? (
                <View style={[styles.exampleRows, compact && styles.exampleRowsCompact]}>{example}</View>
              ) : null}
              {children ? <View style={styles.actions}>{children}</View> : null}
            </View>
          )}
        </View>
      ) : (
        <>
          {example ? (
            <View style={[styles.exampleBlock, compact && styles.exampleBlockCompact]}>
              <View style={[styles.exampleRows, compact && styles.exampleRowsCompact]}>{example}</View>
            </View>
          ) : null}
          {children ? <View style={styles.actions}>{children}</View> : null}
        </>
      )}
    </>
  );

  // `embedded`: a plain block with no Surface and no padding of its own — the host card's own
  // gutter already insets it. Everything above is untouched, which is the contract (see the
  // edit note): the trigger row, the example rows and the chips are the same nodes either way.
  if (embedded) return <View style={styles.embedded}>{body}</View>;

  return (
    <Surface borderColor={theme.border} style={[styles.card, compact && styles.cardCompact]}>
      {body}
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
  // Same internal rhythm as `card`, without the Surface, the padding or the overflow mask —
  // an embedded card is a block in somebody else's list, so its host owns both the inset and
  // the gap to its neighbours.
  embedded: {
    gap: Spacing.xs,
  },
  cardCompact: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  // `collapsible` — a plain group, not a box (2026-08-18; see the call site). No border, no
  // radius, no clipping mask: the trigger and its content sit straight on the card, and the
  // only thing separating them from the copy above is space.
  collapsibleBox: {},
  // The always-visible header of the drop-down. One row's height when collapsed, which is the
  // whole point — "can't be disruptive or take up too much space when closed." No horizontal
  // padding any more: with the box gone there is nothing to inset FROM, and the label has to
  // line up with the card's own copy and with the example rows below it.
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  // The revealed body. Separated from the trigger by padding alone — the hairline that used to
  // split them was a `<Divider/>` line inside a card by another name.
  collapsibleContent: {
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  triggerLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
  },
  textRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  // The dismiss is out of flow, so the copy reserves its own clearance. Only when there IS one.
  textRowDismissable: {
    paddingRight: Spacing.lg,
  },
  // Pinned to the card's top-right corner — see the comment at the call site. The glyph is
  // pushed into the corner by flex-start/flex-end; the 48px target stays inside `card`, which
  // is `overflow: 'hidden'` (Android clips touches to the parent's bounds, so a box that
  // overhangs loses the overhanging part of its hit area). `card` already carries Spacing.md of
  // padding, which is why this needs no inset of its own.
  dismiss: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 1,
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    lineHeight: 20,
    // Medium, upright, full-contrast (2026-08-17). It was `italic` because it was the same
    // teaching tier as the bulb line — italic is what carried "this is an aside". With that tier
    // deleted this is no longer an aside beside content; on an empty surface it IS the content,
    // and a whole card set in italic reads as a caption for something that is not there.
    fontFamily: Fonts.medium,
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
