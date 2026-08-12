/**
 * PadTypeRow.tsx — the pad's first line: an always-open field you can just type on.
 *
 * Replaces the collapsed "+ Add a note" bar (components/AddRow.tsx) at the BOTTOM of Home's
 * four cards with an open line at the TOP (2026-07-30, user report: "'Type note' in first row,
 * grey text that disappears when text box is selected"). The old bar cost two taps — one to
 * expand it, one to focus — and read as chrome appended after the list rather than as the next
 * line of it.
 *
 * **The line is a real, bordered FIELD (2026-08-05), and the prompt is a plain `placeholder`
 * again.** This reverses two things at once, so read why before undoing either:
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
 *             (MIN_TAP_TARGET, PAD_ROW_MIN_HEIGHT, FontSize, Fonts, Radius, Shadow, Spacing,
 *             contrastOn), lib/haptics (confirm), lib/i18n, lib/useAppTheme,
 *             @expo/vector-icons
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/(tabs)/habits.tsx
 *             (re-measured 2026-08-08 — this line also named plans.tsx and shopping.tsx,
 *             neither of which imports this file: plans reaches it indirectly through
 *             PlanTaskCard's timeline, and shopping composes with InlineAddItem instead)
 *   Data    → none — presentational; fires onSubmit
 *
 * Edit notes:
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
 *   - **`noGhostCheck` (2026-08-06)**: app/(tabs)/habits.tsx passes this — its rows never end
 *     in a check any more (always a −/+ pair, see HabitCard), so the idle-state ghost ring
 *     used to preview a control the row could never actually show. Every other caller keeps
 *     the ring; only opt out where it would be misleading.
 *   - **The ghost ring is INSIDE the field's box (2026-08-12), not beside it.** It used to be a
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
  computeBorderTone,
  FontSize,
  Fonts,
  MIN_TAP_TARGET,
  PAD_ROW_MIN_HEIGHT,
  Radius,
  Shadow,
  Spacing,
  contrastOn,
  HitSlop,
} from '@/constants/theme';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useScreenColor } from '@/lib/screenColor';

type Props = {
  /** The grey prompt, worded for this card: "Type note" / "Type task" / … */
  prompt: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  /** Domain accent (lib/domainColor) — tints the commit button once there's text. */
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
  // The screen's own hue for the resting field border; neutral grey outside a screen that
  // provides one (Home, Settings), which is the same fallback every other bordered thing uses.
  const fieldHue = useScreenColor() ?? theme.border;
  const t = useT();
  const [focused, setFocused] = useState(false);

  const hasText = value.trim().length > 0;
  const active = hasText && !disabled;
  // An idle line is just a prompt; controls appear once you're actually writing on it.
  const showControls = focused || hasText;

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
    onSubmit();
    hapticConfirm();
  }

  // Capture-phase only: flag the press, then return false so the child control still
  // receives the touch exactly as before. See internalPressRef.
  const controlsResponderProps = {
    onStartShouldSetResponderCapture: () => {
      internalPressRef.current = true;
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
        onPress={onMore}
        variant="secondary"
        size="sm"
        icon="options-outline"
      />
    ) : null;

  const confirmButton = showControls ? (
    <PressableScale
      style={[
        styles.confirm,
        active && Shadow.button,
        {
          backgroundColor: active ? accent : theme.surfaceMuted,
          borderColor: active ? 'rgba(255,255,255,0.5)' : theme.border,
        },
      ]}
      onPress={commit}
      disabled={!active}
      hitSlop={HitSlop.base}
      scaleTo={0.9}
      haptic={false}
      accessibilityRole="button"
      accessibilityLabel={t.a11yAdd}
    >
      <Ionicons name="checkmark" size={18} color={active ? contrastOn(accent) : theme.textMuted} />
    </PressableScale>
  ) : null;

  // Ghost check preview — idle state only (2026-07-31, user report: the blank spare
  // lines below used to each carry their own ghost ring, which read as several
  // identical previews; there is really only one "next thing to check" and it belongs
  // on this row, the one actually empty-but-selected for input). Same 22×22/Radius.full
  // ring as PadRow's real check and the old spare-line ghost, but dimmer — it's a
  // preview of where a check WILL go once this line becomes a real row, not a control.
  // It lives INSIDE the field's box since 2026-08-12 — see the styles below for why.
  const showGhostCheck = !showControls && !noGhostCheck;

  const fieldAndPrompt = (
    <View style={styles.field}>
      <TextInput
        style={[
          styles.input,
          // Room for the ring, only while the ring is there. An edge-specific padding wins
          // over `paddingHorizontal` in Yoga regardless of key order, so this is safe to
          // append rather than having to restate the whole padding.
          showGhostCheck && styles.inputWithGhost,
          {
            color: theme.text,
            // White/plain surface fill (2026-08-06, user report: "text-boxes are too grey" —
            // matches components/FormControls.tsx's Input and what a text field looks like in
            // most web/native apps), not the sunken `surfaceMuted` well a disabled control uses.
            backgroundColor: theme.surface,
            // At rest the field wears the screen's own hue at the FIELD rung — the same border
            // components/PadSheet.tsx gives a row and QuickAddOptionRow gives a cell, so the
            // composer belongs to the screen it sits on rather than being a fixed grey
            // (card design reset, 2026-08-05, brief point 9). Focus still overrides it with the
            // surface's accent, because a focus state has to WIN over the resting border to be
            // a focus state at all — DESIGN_RULES.md rule 18.
            borderColor: focused ? accent : computeBorderTone(fieldHue, isDark, 'field'),
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
          // Don't lose a typed line to a stray tap elsewhere.
          if (hasText) commit();
        }}
      />
      {showGhostCheck ? (
        <View style={styles.ghostCheckSlot} pointerEvents="none">
          <View style={[styles.ghostCheck, { borderColor: theme.border }]} />
        </View>
      ) : null}
    </View>
  );

  // Panel design (2026-08-04): input line alone, the labeled options panel on its own line
  // below, then the "…"/confirm buttons right-aligned below that — see the header note on
  // `panel` for why this is a separate layout from the inline `extras` row below.
  if (panel !== undefined) {
    return (
      <View
        ref={rowRef}
        style={[styles.column, disabled && styles.gated, style]}
        pointerEvents={disabled ? 'none' : 'auto'}
      >
        <View style={styles.row}>{fieldAndPrompt}</View>
        {showControls ? (
          <View style={styles.panelSlot} {...controlsResponderProps}>
            {panel}
          </View>
        ) : null}
        {showControls && (moreButton || confirmButton) ? (
          <View style={styles.panelButtonRow} {...controlsResponderProps}>
            {moreButton}
            {confirmButton}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View
      ref={rowRef}
      style={[styles.row, disabled && styles.gated, style]}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {fieldAndPrompt}

      {showControls ? (
        <View style={styles.extrasSlot} {...controlsResponderProps}>
          {extras}
        </View>
      ) : null}

      {moreButton}
      {confirmButton}
    </View>
  );
}

/**
 * The ghost ring's diameter — PadRow's real check size, which is also the size every small mark
 * on components/StarterExampleRow.tsx shares. It is named because the field's own right-hand
 * padding is derived from it; the two must not drift apart or the placeholder runs under the ring.
 */
const GHOST_CHECK = 22;

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
  // A transparent wrapper whose only job is the capture-phase responder check above. It
  // must not change the row's layout — the extras used to be direct children of the row, so
  // this inherits the same flex-row alignment and gap and is otherwise invisible.
  extrasSlot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Panel layout (`panel` prop): a column instead of the single inline row. Its own `row`
  // child already carries the padding above, so only the bottom edge needs adding here.
  column: { gap: Spacing.xs, paddingBottom: Spacing.xs },
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
    // Same weight as every other field-rung border in the app (rows, option cells), so the
    // composer, the rows under it and the option grid beside it read as one system.
    borderWidth: BORDER_WIDTH.field,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
  },
  // Room for the ghost ring inside the box: the ring's own inset from the border, the ring,
  // and the field's normal text inset. Applied only while the ring is mounted, so a focused
  // field gets the whole line back for typing.
  inputWithGhost: { paddingRight: Spacing.sm * 2 + GHOST_CHECK },
  // The ring is positioned over the field's trailing edge rather than laid out beside it
  // (2026-08-12). As a sibling it cost the field 26px (the ring plus the row's gap), so the
  // composer was 26px narrower than the example row and the real rows below it — which is
  // what read as "the example is wider than the empty row above" — and it also made the
  // field JUMP wider on focus, since the ring unmounts as soon as controls show. Inside the
  // box it is also the truer preview: a real PadRow draws its check inside the row's own
  // box, in the right-hand cluster, which is exactly where this now sits.
  ghostCheckSlot: {
    position: 'absolute',
    right: Spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  confirm: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  // Same ring geometry as PadRow's real check (22×22, Radius.full, 2px), but faint — a
  // preview of where a check will land, not a control (see the mount note above).
  ghostCheck: { width: GHOST_CHECK, height: GHOST_CHECK, borderRadius: Radius.full, borderWidth: 2, opacity: 0.4 },
  gated: { opacity: 0.45 },
});
