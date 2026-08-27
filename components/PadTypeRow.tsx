/**
 * PadTypeRow.tsx — the pad's first line: an always-open field you can just type on.
 *
 * Replaces the collapsed "+ Add a note" bar (components/AddRow.tsx) at the BOTTOM of Home's
 * four cards with an open line at the TOP (2026-07-30, user report: "'Type note' in first row,
 * grey text that disappears when text box is selected"). The old bar cost two taps — one to
 * expand it, one to focus — and read as chrome appended after the list rather than as the next
 * line of it.
 *
 * **The line is a RECESSED WELL (2026-08-16), and the prompt is a plain `placeholder`.**
 *
 * Brief §8: *"These inputs must NOT look like traditional flat web forms. They must look like
 * recessed, indented fields within the glass surface... darker than the glass card it sits on to
 * simulate depth... Remove all solid borders."* Plus a focus state that *"immediately adopts a
 * subtle border or outer glow using the Categorical Color of its parent card"* — amber inside
 * the To-do card, cyan inside Habits — and one trailing submit that *"lights up in the
 * Categorical Color"* once there is text.
 *
 * This is a FINISH change on top of the 2026-08-05 pass described below, not a reversal of it.
 * That pass's point was that the composer is a real, visible, focus-showing CONTROL rather than
 * a bare caret on a blank card; all three of those properties are stronger here, not weaker —
 * the well is visible at rest, the focus ring is coloured instead of grey, and once FOCUSED it
 * is joined by a halo (2026-08-26, DESIGN_COMPARISON/19 phase 2 — the halo briefly lit the well
 * at rest too, from 2026-08-16 to 2026-08-26; see the `fieldAndPrompt` note below for why that
 * reversed). What changed is the direction of the depth (sunk instead of raised) and where the
 * boundary comes from (the fill step instead of a stroke).
 *
 * ⚠️ The recess only reads because this component is contractually mounted INSIDE a card. See
 * `getRecessedField`'s note and `FormControls`' `recessed` prop for what happens to a field
 * that isn't — it was measured, in the preview, on `app/medicine-form.tsx`.
 *
 * **The 2026-08-05 pass, kept because its reasoning still binds:** this reversed two things at
 * once, so read why before undoing either:
 *   - Until now the input carried NO border, background, radius or focus state — the whole
 *     style was a font and a vertical padding. Its only affordance was the prompt layer below,
 *     which was gated on `!focused`, and the ghost check beside it, gated on `!showControls`.
 *     So the two cues BOTH unmounted the instant you tapped, and focused-and-empty rendered as
 *     a bare blinking caret on blank card (user report: "Not visible where user is typing,
 *     looks unnatural"). That was also a live `DESIGN_RULES.md` rule 18 violation — "focus is
 *     never invisible" — which `DESIGN_RULES_AUDIT.md` had open as UNVERIFIED.
 *   - The clear-on-focus prompt was a deliberate 2026-07-30 ask ("grey text that disappears
 *     when text box is selected") and this header used to say "keep it that way". It is gone
 *     because the maintainer reversed it once the field itself was visible: with a box around
 *     it there is no longer anything to be gained by also emptying the line, and a prompt that
 *     survives until the first keystroke is what every other app does. `placeholder` is RN's
 *     own now — no hand-rolled Text layer to keep in sync.
 * The field shape is deliberately the SAME one `components/FormControls.tsx`'s `Input` uses
 * (border + radius + plain white/`theme.surface` fill + `MIN_TAP_TARGET`, 2026-08-06 — was a
 * sunken `surfaceMuted` fill, "text-boxes are too grey" — see the inline note by the style),
 * so the app has one field, not two. **All three composers now draw it** — this one,
 * `components/AddRow.tsx` and `components/InlineAddItem.tsx` (the last by using `Input`
 * outright) — so "converge the composers' fields" is finished; what still differs between them
 * is the TIERING of their settings. See AGENTS.md "The hierarchy of settings when making a
 * row" for the three-tier contract and the table of who implements which tier.
 * **This is not the boxed-ROWS design that `DESIGN_COMPARISON/10-boxed-vs-ruled-rows.md`
 * rejected.** That decision was about giving every LIST row its own border and gap — cards
 * inside a card. List rows are still flush and ruled on one `PadSheet`. Only the composer —
 * the one control you type into — is boxed, and a composer that looks like a field is what
 * made the ruled rows below it legible as content rather than as more chrome.
 *
 * Connections:
 *   Imports → components/PressableScale (not used for the field itself — see edit notes),
 *             components/Button (the worded "More options" button — see the `onMore` note),
 *             components/ScreenScaffold (ScrollIntoViewContext), constants/theme
 *             (MIN_TAP_TARGET, PAD_ROW_MIN_HEIGHT, FontSize, Fonts, Radius, FIELD_RADIUS,
 *             FIELD_GLOW_CLEARANCE, getFieldGlow, getRecessedField, Shadow, Spacing,
 *             contrastOn), lib/haptics (confirm), lib/i18n, lib/useAppTheme,
 *             @expo/vector-icons
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,PlanTaskCard}.tsx,
 *             app/habits.tsx
 *             (re-measured 2026-08-08 — this line also named plans.tsx and shopping.tsx,
 *             neither of which imports this file: plans reaches it indirectly through
 *             PlanTaskCard's timeline, and shopping composes with InlineAddItem instead)
 *   Data    → none — presentational; fires onSubmit
 *
 * Edit notes:
 *   - ⚠️ **This row reserves `FIELD_GLOW_CLEARANCE` on all four sides, and it is load-bearing
 *     (2026-08-24, user report: *"Neon in/around text boxes are visually bugged, again."*).**
 *     The field's halo is a `boxShadow`, so it is cut to the nearest `overflow: hidden`
 *     ancestor — and this composer is mounted as a FULL-WIDTH child of a card body, which
 *     components/Card.tsx folds through a `Collapsible`. So the light had zero room on the
 *     left and right and was sliced off flat at the field's own edges, on every surface except
 *     the Today card (whose host pads it 16px). The clearance lives here, not at the mount
 *     sites, so a new caller cannot forget it; it doubles as the alignment, being the same
 *     gutter components/PadSheet.tsx insets its rows by. Measure with `npm run halos`, which
 *     is the only check in this repo that can see a clipped halo — tsc sees valid styles and a
 *     screenshot shows a lit box either way.
 *   - **Keyboard-avoidance is inherited from AddRow's hard-won fix (2026-07-13/16)**: on focus
 *     and on `keyboardDidShow` this hands the enclosing ScreenScaffold its OWN View node via
 *     ScrollIntoViewContext, which measures and lifts just this row. Without it Android's
 *     `windowSoftInputMode=resize` can leave the line behind the keyboard and its taps go dead.
 *     Don't drop this when editing.
 *   - `extras` is the same slot AddRow had, for the per-surface quick-add controls that already
 *     exist (Notes' details field + "also a task" chip + time box, Shopping's qty stepper and
 *     list-target chip). They render only while the line is focused or has text — an idle pad
 *     line is just a prompt, not a control panel.
 *   - `panel` (2026-08-04, user report: "I cannot understand small, barely visible icons") is a
 *     SEPARATE slot from `extras`, for callers that want the full-width, labeled dropdown-panel
 *     design (components/QuickAddOptionsPanel + QuickAddOptionRow) instead of inline chips —
 *     see PlanTaskCard/HomeHabitsCard. Renders on its own line below the input, above the
 *     confirm/"…" row, on the same focused-or-has-text gate as `extras`. A caller passes one or
 *     the other, not both — `extras` stays for the surfaces that haven't moved to the panel
 *     design (Notes, Shopping).
 *   - **⚠️ "Focused or has text" is NOT the whole gate — see `engaged` (2026-08-18).** Three of
 *     the option cells open a picker through `showAppModal`, i.e. a React Native `<Modal>`,
 *     and a Modal takes window focus: the field blurs the instant the dialog appears. On an
 *     untitled line that made `focused || hasText` false, so the entire panel unmounted BEHIND
 *     the dialog — the user picked "Weekly", the dialog closed, and the cells it had just
 *     configured (including the interval stepper the pick brings into existence) were gone.
 *     Nothing looked broken; taps in that area simply landed on nothing, which is reported as
 *     the screen having frozen. The pick itself was never lost — that state lives in the
 *     caller's hook, not in the panel — only its UI was. The fix is `engaged`, set by the same
 *     capture-phase responder that already answers "did this touch belong to my own controls".
 *     **Any new control in `extras`/`panel` that opens a Modal, a bottom sheet or a route
 *     depends on this**; don't reduce the gate back to two terms.
 *   - The commit button appears on the same terms. It's inert-looking (recessed
 *     `surfaceMuted`) until there's text, then fills with the domain accent — the same
 *     affordance grammar AddRow established, kept so the two don't read as different controls
 *     on the surfaces that still use AddRow (/plans' Whenever, health-log, automations).
 *   - Commits on submit and on blur-with-text, so a typed line is never silently lost by
 *     tapping elsewhere. Blur with an empty line just restores the prompt.
 *   - **`onMore` (2026-08-01, reworked 2026-08-05)**: an optional second button beside the
 *     confirm check, opening the fuller editor for whatever is being added, carrying the
 *     typed draft. Two things changed on 2026-08-05, both from a user report ("The three dots
 *     don't do anything"):
 *       1. **It is worded, not a glyph** — a `components/Button` labelled `t.pad.moreOptions`,
 *          not a bare `ellipsis-horizontal`. Same complaint that drove the labelled `panel`
 *          design a day earlier ("I cannot understand small, barely visible icons"), and the
 *          bare "…" sat next to a bordered, filled ✓ so it did not even read as a button.
 *       2. **The caller's handler must work on an EMPTY line.** The button shows as soon as
 *          the line is focused, but every handler used to open with `if (!draft) return;` —
 *          so on an empty line it animated the press and did nothing at all, while the ✓
 *          beside it correctly went `disabled` + recessed. A handler wired here MUST always
 *          produce something visible; if there is genuinely nothing to open for a surface,
 *          pass no `onMore` at all rather than a handler that can no-op (that is why
 *          HomeNotesCard has none — a note is a title and a details line, both already on
 *          this row, so there is no fuller editor to reach).
 *     Whether it commits first is the CALLER's call and differs by surface, because the
 *     surfaces differ: a habit has a real create-mode editor screen (`/habit-form`), so
 *     nothing is saved until Save there; a task's editor is an expanded `TaskCard` on a
 *     SAVED row (app/task-form.tsx was retired 2026-07-23), so that one still commits first.
 *   - **`noGhostCheck` (2026-08-06)**: app/habits.tsx passes this. Its original meaning
 *     was "this pad's rows never end in a check (always a −/+ pair, see HabitCard), so don't
 *     preview one". The thing it suppresses is now the SUBMIT ARROW rather than a preview ring
 *     (2026-08-16), so the prop's name is legacy — it is kept rather than renamed because it is
 *     a published prop with live callers and the SLOT is the same one. Read it as "this line
 *     has no trailing control": a caller that opts out commits by keyboard return or by its own
 *     buttons instead.
 *   - **The trailing control is INSIDE the field's box (2026-08-12), not beside it.** It used to be a
 *     sibling of the field in the row, so it cost the field its own width plus the row's
 *     `gap`: 26px. Two visible consequences, both reported as one complaint ("the example is
 *     wider than the empty row above"): the composer was 26px narrower than
 *     components/StarterExampleRow.tsx and than a real components/PadSheet.tsx row — every
 *     other box on an empty card is the full content width — and the field JUMPED wider the
 *     moment it was focused, since the ring unmounts as soon as `showControls` is true.
 *     Inside the box it is also the more faithful preview, which is the point of drawing it at
 *     all: a real `PadRow` puts its check inside the row's own box in the right-hand cluster.
 *     The field reserves `Spacing.sm * 2 + GHOST_CHECK` on the right while the ring is up;
 *     keep those two derived from the one constant or the placeholder runs under the ring.
 *     Pinned by lib/__tests__/exampleRows.test.ts.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleProp, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import { ScrollIntoViewContext } from '@/components/ScreenScaffold';
import {
  BORDER_WIDTH,
  FontSize,
  Fonts,
  MIN_TAP_TARGET,
  PAD_ROW_MIN_HEIGHT,
  Radius,
  Spacing,
  contrastOn,
  FIELD_GLOW_CLEARANCE,
  FIELD_RADIUS,
  getFieldGlow,
  getRecessedField,
  HitSlop,
} from '@/constants/theme';
import { Travel } from '@/constants/motion';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { badgeGlyphFor } from '@/lib/domainColor';

type Props = {
  /** The grey prompt, worded for this card: "Type note" / "Type task" / … */
  prompt: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  /**
   * This CARD's categorical colour (lib/domainColor / lib/screenColor). It fills the submit
   * arrow once there is text and colours the focus ring + halo — brief §8's "the Task input
   * field glows Neon Amber when tapped; the Habit input glows Electric Cyan".
   *
   * Deliberately a per-card PROP rather than the ambient `useScreenColor()`: on Home the
   * preview cards sit on ONE screen and still have to light up as the tabs they preview, so the
   * caller is the only thing that knows the answer. (Home names a hue of its own since round 20
   * — see app/(tabs)/index.tsx — which makes the ambient read wrong here rather than absent:
   * every card on that screen would light up gold.)
   */
  accent: string;
  /** Per-surface quick-add controls, shown only while the line is active. */
  extras?: React.ReactNode;
  /** The full-width labeled options panel (components/QuickAddOptionsPanel), shown on its own
   *  line below the input on the same terms as `extras`. See the edit note above for when to
   *  use this instead of `extras`. */
  panel?: React.ReactNode;
  /** Optional "…" — commits the draft (same as onSubmit) and opens its full editor,
   *  pre-filled, instead of just collapsing back to the prompt. Shown on the same terms as
   *  extras/the confirm button (focused or has text). The caller owns what "commit and open
   *  the full editor" means (it's the one holding the draft's other field values); this
   *  component only renders the button and fires the callback. */
  onMore?: () => void;
  moreLabel?: string;
  disabled?: boolean;
  /**
   * Suppress the idle-state ghost check ring (2026-08-06) — pass on a pad whose rows never
   * end in a check at all, so the ring doesn't preview a control that can't appear (Habits,
   * whose rows always end in a −/+ pair since the same date). The field is already `flex: 1`
   * in the row, so omitting the ring's fixed width + gap widens it automatically — no extra
   * layout work needed here.
   */
  noGhostCheck?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function PadTypeRow({
  prompt,
  value,
  onChangeText,
  onSubmit,
  accent,
  extras,
  panel,
  onMore,
  moreLabel,
  disabled,
  noGhostCheck,
  style,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  // ── The recessed well, and the colour its focus ring lights up in (2026-08-16, brief §8) ──
  // `accent` is the CARD's categorical colour (the caller passes `getDomainColor(...).accent`),
  // which is what the brief asks the focus state to adopt — "the Task input field glows Neon
  // Amber when tapped; the Habit input glows Electric Cyan". Note this is deliberately NOT the
  // ambient SCREEN hue: on Home the To-do and Habits cards sit on one hue-less screen and must
  // still light up differently, so the per-card prop is the only thing that can answer this.
  //
  // `useScreenColor()` was read here for the resting border and is no longer needed — a
  // recessed field has no resting stroke at all.
  const recess = getRecessedField(theme.surface, isDark);
  const focusHue = badgeGlyphFor(accent, recess.composite, isDark);
  const t = useT();
  const [focused, setFocused] = useState(false);
  /**
   * "This composer is in use", kept separately from `focused` because a control BELONGING to
   * this row can take the focus away from the field (2026-08-18).
   *
   * The bug this exists for: three of the option cells open a picker through `showAppModal`,
   * which mounts a React Native `<Modal>` — and a Modal takes window focus, so the field
   * blurs the instant the dialog appears. On an untitled line `focused || hasText` was then
   * false, so the WHOLE panel unmounted behind the dialog: the user picked "Weekly", the
   * dialog closed, and the cells it had just configured were gone — including the interval
   * stepper the pick had brought into existence. Every tap in that area landed on nothing,
   * which reads as a frozen screen rather than as a disappearance.
   *
   * `internalPressRef` below already answers "did this touch belong to my own controls"; this
   * is the same answer kept in state so it can hold the panel open. Cleared on a commit (the
   * line is finished), on the tier-3 hand-off, and on a genuine blur from somewhere else —
   * never by the picker's own blur, which is the whole point.
   */
  const [engaged, setEngaged] = useState(false);

  const hasText = value.trim().length > 0;
  const active = hasText && !disabled;
  // An idle line is just a prompt; controls appear once you're actually writing on it — and
  // stay while one of them is being used, even if the control took the field's focus.
  const showControls = focused || hasText || engaged;

  const scrollIntoView = useContext(ScrollIntoViewContext);
  const rowRef = useRef<View>(null);
  const isFocusedRef = useRef(false);
  /**
   * Set when a touch starts on one of this row's OWN controls, so the blur that touch
   * causes doesn't commit the draft (2026-08-02).
   *
   * `onBlur` commits when there's text — deliberately, so a stray tap elsewhere never
   * loses a typed line. But pressing a control that belongs to this row is not a tap
   * elsewhere: it is part of writing the line. Without this guard, tapping the quantity
   * stepper, the time field, the recurrence chip or the capture-target chip would commit
   * the half-finished draft first and then apply the control to nothing — so the control
   * that changes WHAT a submit does could never be used at all, because the submit had
   * already happened. Found via the web preview; a capture-target chip was unusable.
   *
   * A capture-phase responder check gets the flag set before the blur fires on both
   * platforms, and returning false leaves the child free to handle the touch as usual.
   */
  const internalPressRef = useRef(false);
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (isFocusedRef.current) scrollIntoView?.(rowRef.current);
    });
    return () => sub.remove();
  }, [scrollIntoView]);

  function commit() {
    if (!active) return;
    // The line is finished — the caller resets its draft, so the panel has nothing left to
    // hold open. Without this a committed line would leave its cells on screen under a fresh
    // empty prompt.
    setEngaged(false);
    onSubmit();
    hapticConfirm();
  }

  // Capture-phase only: flag the press, then return false so the child control still
  // receives the touch exactly as before. See internalPressRef.
  const controlsResponderProps = {
    onStartShouldSetResponderCapture: () => {
      internalPressRef.current = true;
      // …and hold the panel open through whatever this control does, including opening a
      // <Modal> that steals the field's focus. See `engaged`.
      setEngaged(true);
      return false;
    },
  };

  // Worded, and live in every state — see the `onMore` edit note. It is deliberately NOT
  // gated on `active`/`hasText` the way the confirm check is: the caller's handler opens an
  // editor rather than saving, so an empty line is a valid press, not a disabled one.
  const moreButton =
    showControls && onMore ? (
      <Button
        label={moreLabel ?? t.pad.moreOptions}
        // The tier-3 hand-off leaves this surface for a full editor, so the line is done here
        // — same reasoning as `commit`'s reset. See `engaged`.
        onPress={() => {
          setEngaged(false);
          onMore();
        }}
        variant="secondary"
        size="sm"
        icon="options-outline"
      />
    ) : null;

  // ── ONE trailing control, inside the field (2026-08-16, brief §8) ────────────────────────
  // *"Instead of an empty circle, place a highly tactile submit button (like an arrow or plus
  // icon) inside the right side of the text input. When the user types, this button should
  // light up in the Categorical Color."*
  //
  // This REPLACES two things that used to alternate in this slot, and collapsing them is most
  // of the point: a dim `ghostCheck` ring while idle (a preview of where a tick would land) and
  // a separate `confirm` button laid out BESIDE the field once controls showed. So the trailing
  // affordance changed shape, position and meaning depending on state, and the empty circle in
  // particular read as a checkbox you could tick rather than as "type here, then send".
  //
  // Now: one arrow, always in the same place, inside the field's right edge. Muted while the
  // line is empty, filled with the card's categorical colour the moment there is text — which
  // is exactly the "lights up" the brief asks for, and it doubles as the affordance telling you
  // the line is committable. `noGhostCheck` keeps its meaning (a caller whose line commits some
  // other way suppresses the trailing control entirely) and keeps its name, since it is a
  // published prop and the slot is the same one.
  const showSubmit = !noGhostCheck;
  const submitButton = showSubmit ? (
    <View style={styles.submitSlot}>
      <PressableScale
        style={[
          styles.submit,
          {
            // The lit state is a real accent FILL, not a tinted glyph: at 26px an outline-only
            // icon in a neon hue reads as decoration, and this is the primary action of the row.
            backgroundColor: active ? accent : theme.surfaceMuted,
            opacity: active ? 1 : 0.7,
          },
        ]}
        onPress={commit}
        disabled={!active}
        hitSlop={HitSlop.base}
        travel={Travel.sm}
        haptic={false}
        accessibilityRole="button"
        accessibilityLabel={t.a11yAdd}
      >
        <Ionicons
          name="arrow-up"
          size={16}
          color={active ? contrastOn(accent) : theme.textMuted}
        />
      </PressableScale>
    </View>
  ) : null;

  const fieldAndPrompt = (
    // The halo lives on this WRAPPER rather than on the TextInput. A `boxShadow` on a TextInput
    // renders unreliably on Android, and a halo that silently doesn't paint would take half the
    // focus cue with it; on a plain View it is the same shadow every Surface draws. The border
    // below still carries the FOCUS state on its own, so if the glow ever fails to render the
    // field still passes DESIGN_RULES.md rule 18 — the glow is reinforcement, not the cue.
    //
    // **Focus-only again (reversed 2026-08-26, DESIGN_COMPARISON/19 phase 2).** The
    // 2026-08-16 "tactile glow" polish pass made this always lit — `soft` at rest, `strong` on
    // focus — on the reasoning that a recessed well read as flat/grey against the dark glass
    // card even at rest. That reasoning is exactly what phase 2 names as the bug: "text,
    // borders and backgrounds never glow… a field only while FOCUSED." A resting halo on every
    // composer field was the single loudest thing in the app (up to nine lit wells on a
    // five-card screen while the rows themselves carried none) — back to
    // `focused ? getFieldGlow(accent, 'strong') : null`, matching `components/AddRow.tsx`'s
    // identical field, which reverses the same way in the same change.
    //
    // ⚠️ **In `npm run preview` the focus ring looks WHITE, and it is not** (measured 2026-08-16,
    // don't re-investigate). Chromium paints its own `:focus-visible` outline on the underlying
    // `<input>`, ~3px of white immediately outside the border box, which swamps a 1.25px neon
    // ring in a screenshot. react-native-web does not suppress it and native RN has no such
    // concept, so it is a harness artifact with no device equivalent. Confirmed by temporarily
    // widening this border to 5px magenta and re-shooting: the magenta rendered exactly where
    // it should, INSIDE the white. If a screenshot ever makes you doubt this border again, run
    // that probe rather than changing the colour.
    // `getFieldGlow` rather than `getGlow` (2026-08-19): the halo is cut to the border-box of
    // whatever view carries it, and this one is a WRAPPER, not the input — so it used to be a
    // square glow around a rounded well ("the glow is squared, but the text-boxes inside are
    // rounded"). The helper hands out the radius with the light so the two cannot disagree here
    // or at any other field; `styles.input` takes its radius from the same `FIELD_RADIUS`.
    // Unfocused, there is no light to be square in the first place — the bare radius object
    // below keeps the wrapper's shape consistent whether or not the halo is present.
    <View
      style={[
        styles.field,
        focused ? getFieldGlow(accent, 'strong') : { borderRadius: FIELD_RADIUS },
      ]}
    >
      <TextInput
        style={[
          styles.input,
          // Room for the trailing arrow, only while it is mounted. An edge-specific padding
          // wins over `paddingHorizontal` in Yoga regardless of key order, so this is safe to
          // append rather than having to restate the whole padding.
          showSubmit && styles.inputWithSubmit,
          {
            color: theme.text,
            // ── Recessed, not raised (2026-08-16, brief §8) ────────────────────────────────
            // *"They must look like recessed, indented fields within the glass surface...
            // darker than the glass card it sits on to simulate depth."* This reverses the
            // 2026-08-06 "text-boxes are too grey" fix, which had moved the fill from the
            // sunken `surfaceMuted` up to plain `theme.surface`. That complaint was about a
            // field being greyer than the WHITE card around it, which read as disabled; sunk
            // into a dark glass pane the same relationship reads as depth. The value is a
            // translucent black wash rather than a token, so the glass still shows through —
            // the well is in the pane, not a tile on it. See getRecessedField.
            backgroundColor: recess.paint,
            // ── No stroke at rest; the category's colour on focus ──────────────────────────
            // *"Remove all solid borders"* at rest, and *"when the TextInput is focused, it
            // must immediately adopt a subtle border or outer glow using the Categorical Color
            // of its parent card."* Transparent rather than zero-width, so tapping the field
            // cannot reflow it — see getRecessedField's note.
            //
            // The focus colour goes through `badgeGlyphFor`, which is the app's existing
            // "walk a hue toward the ground until it clears 3.3:1 on what it is drawn on"
            // helper. In DARK that is a no-op (the five categoricals measure 5.19–13.13:1 on
            // the recessed well). In LIGHT it is load-bearing: the identity hues are
            // mode-invariant neons, and a raw `#FFD700` focus ring on a `#EDEEF1` field is
            // 1.21:1, i.e. no visible focus state at all — rule 18 with the cue missing.
            borderColor: focused ? focusHue : 'transparent',
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={prompt}
        placeholderTextColor={theme.textMuted}
        returnKeyType="done"
        onSubmitEditing={commit}
        editable={!disabled}
        accessibilityLabel={prompt}
        onFocus={() => {
          setFocused(true);
          isFocusedRef.current = true;
          // A fresh focus starts the "will the next blur be internal?" question over. Without
          // this the flag leaks: a control pressed while the field was ALREADY blurred (which
          // is the normal state once a picker has been through here) sets it and nothing ever
          // consumes it, so the next genuine tap-away is swallowed and a typed line silently
          // fails to commit.
          internalPressRef.current = false;
          // Covers the keyboard-already-open case; the listener above covers it opening
          // fresh. Both are idempotent.
          scrollIntoView?.(rowRef.current);
        }}
        onBlur={() => {
          setFocused(false);
          isFocusedRef.current = false;
          // A press on this row's own controls is part of writing the line, not a tap
          // elsewhere — see internalPressRef. Consume the flag either way, so the next
          // genuine blur still commits.
          if (internalPressRef.current) {
            internalPressRef.current = false;
            return;
          }
          // A genuine tap-away: the composer is no longer in use, so the panel may fold back
          // to the bare prompt. Only reached when the blur was NOT caused by one of this
          // row's own controls — see `engaged`.
          setEngaged(false);
          // Don't lose a typed line to a stray tap elsewhere.
          if (hasText) commit();
        }}
      />
      {submitButton}
    </View>
  );

  // Panel design (2026-08-04): input line alone, the labeled options panel on its own line
  // below, then the "…"/confirm buttons right-aligned below that — see the header note on
  // `panel` for why this is a separate layout from the inline `extras` row below.
  if (panel !== undefined) {
    return (
      <View
        ref={rowRef}
        style={[styles.column, styles.glowClearance, disabled && styles.gated, style]}
        pointerEvents={disabled ? 'none' : 'auto'}
      >
        <View style={[styles.row, styles.panelLine]}>{fieldAndPrompt}</View>
        {showControls ? (
          <View style={styles.panelSlot} {...controlsResponderProps}>
            {panel}
          </View>
        ) : null}
        {showControls && moreButton ? (
          <View style={styles.panelButtonRow} {...controlsResponderProps}>
            {moreButton}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View
      ref={rowRef}
      style={[styles.row, styles.glowClearance, disabled && styles.gated, style]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {fieldAndPrompt}

      {showControls ? (
        <View style={styles.extrasSlot} {...controlsResponderProps}>
          {extras}
        </View>
      ) : null}

      {moreButton}
    </View>
  );
}

/**
 * The trailing submit button's diameter. Named because the field's own right-hand padding is
 * derived from it; the two must not drift apart or the placeholder runs under the arrow.
 *
 * 26, up from the ghost ring's 22 it replaced (2026-08-16): that ring was a preview, this is a
 * real control. Its TAP target is `HitSlop.base` beyond this, which is what keeps it clear of
 * `MIN_TAP_TARGET` — a 26px visible circle inside a 48px-tall field cannot itself be 48.
 */
const SUBMIT_SIZE = 26;

const styles = StyleSheet.create({
  // `paddingVertical` (2026-08-05) keeps the field's own border off PadSheet's hairline rule
  // above and below it. It belongs here rather than in PadSheet, which draws those rules for
  // every line on the sheet and must not learn that one of them hosts a bordered control.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: PAD_ROW_MIN_HEIGHT,
    paddingVertical: Spacing.xs,
  },
  field: { flex: 1, minWidth: 0, justifyContent: 'center' },
  // The room this composer's halo needs, reserved by the composer itself (2026-08-24).
  // A card clips its own body, and this control is mounted as a full-width child of it on
  // every surface but one — so the light was sliced off flat at the field's own left and
  // right edges everywhere except the Today card, which has a padded wrapper of its own.
  // Reserving it HERE rather than at each mount site is what makes that unrepeatable: a
  // caller cannot mount the field without the room its light fades into. It doubles as the
  // alignment — the same gutter components/PadSheet.tsx insets its rows by, so the composer
  // now sits in the list's own column instead of 8px wider than it. Applied to the OUTERMOST
  // view of each layout only; `styles.row` is also the panel layout's inner line, and putting
  // it there would spend the clearance twice.
  // All four sides, not just the horizontal pair: the top edge is the one that ran out of
  // room on an EMPTY card (the pad is then the composer alone, so the fold clips 4px above the
  // field — measured at 4 against a 5px bloom).
  glowClearance: { padding: FIELD_GLOW_CLEARANCE },
  // The panel layout draws `styles.row` INSIDE the cleared box, so its own vertical padding
  // would sit on top of the clearance and push the field down. The clearance is the spacing
  // there; this drops the duplicate.
  panelLine: { paddingVertical: 0 },

  // A transparent wrapper whose only job is the capture-phase responder check above. It
  // must not change the row's layout — the extras used to be direct children of the row, so
  // this inherits the same flex-row alignment and gap and is otherwise invisible.
  extrasSlot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Panel layout (`panel` prop): a column instead of the single inline row. It carries NO
  // padding of its own (2026-08-24): `glowClearance` pads all four sides of this same view,
  // and an edge-specific `paddingBottom` beside it would win over the shorthand regardless of
  // key order in Yoga — which is exactly how this layout kept 4px under the field where the
  // clearance had put 8, leaving the bottom of the halo cut off after the sides were fixed.
  column: { gap: Spacing.xs },
  panelSlot: { width: '100%' },
  panelButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.xs },
  // A real field, the same shape as components/FormControls.tsx's `Input` — see the header
  // for why this stopped being a bare line, and why boxing the COMPOSER is not the boxed-rows
  // design that DESIGN_COMPARISON/10 rejected. Colours (fill + focus-driven border) are
  // applied inline, since they need the theme and the caller's accent.
  input: {
    // See AddRow's note: react-native-web gives a bare <input> an intrinsic min-width that
    // flex:1 alone doesn't beat, which pushes the trailing controls off the card.
    minWidth: 0,
    minHeight: MIN_TAP_TARGET,
    // Kept at the field rung's weight even though the resting colour is transparent — the
    // focused state paints this same stroke, and a width that changes on focus reflows the
    // text under the user's caret. See getRecessedField's note.
    borderWidth: BORDER_WIDTH.field,
    // The same constant the wrapper's halo is cut to — see getFieldGlow.
    borderRadius: FIELD_RADIUS,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
  },
  // Room for the arrow inside the box: its own inset from the edge, the button, and the
  // field's normal text inset. Unlike the ghost ring this replaced, it is NOT dropped once
  // the line has text — the button is a live control at that point, so the text must keep
  // clearing it rather than running underneath.
  inputWithSubmit: { paddingRight: Spacing.sm * 2 + SUBMIT_SIZE },
  // Positioned over the field's trailing edge rather than laid out beside it (2026-08-12,
  // kept). As a sibling it cost the field ~26px (the control plus the row's gap), so the
  // composer was that much narrower than the example row and the real rows below it — which
  // is what read as "the example is wider than the empty row above" — and it made the field
  // JUMP wider whenever the trailing control unmounted. Inside the box it also matches a real
  // PadRow, which draws its own check inside the row's box in the right-hand cluster.
  submitSlot: {
    position: 'absolute',
    right: Spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  // No border. The lit state is carried by the fill and the icon's ink; an outline on a 26px
  // circle that already changes colour is a third cue for one piece of state.
  submit: {
    width: SUBMIT_SIZE,
    height: SUBMIT_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gated: { opacity: 0.45 },
});
