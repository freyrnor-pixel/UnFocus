/**
 * PadTypeRow.tsx — the pad's first line: an always-open field you can just type on.
 *
 * Replaces the collapsed "+ Add a note" bar (components/AddRow.tsx) at the BOTTOM of Home's
 * four cards with an open line at the TOP (2026-07-30, user report: "'Type note' in first row,
 * grey text that disappears when text box is selected"). The old bar cost two taps — one to
 * expand it, one to focus — and read as chrome appended after the list rather than as the next
 * line of it.
 *
 * **The prompt clears on FOCUS, not on the first keystroke.** React Native's own
 * `placeholder` only disappears once there's text; the ask is that selecting the line empties
 * it, so the prompt is rendered as our own muted Text layer that unmounts on focus. Keep it
 * that way — swapping back to a plain `placeholder` prop silently loses the behaviour.
 *
 * Connections:
 *   Imports → components/PressableScale (not used for the field itself — see edit notes),
 *             components/ScreenScaffold (ScrollIntoViewContext), constants/theme
 *             (PAD_ROW_MIN_HEIGHT, FontSize, Fonts, Radius, Shadow, Spacing, contrastOn),
 *             lib/haptics (confirm), lib/i18n, lib/useAppTheme, @expo/vector-icons
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/(tabs)/{plans,habits,shopping}.tsx
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
 *   - **`onMore` (2026-08-01)**: an optional "…" beside the confirm check, same visibility
 *     gate as extras. The caller's handler both commits the draft AND navigates to that same
 *     row's full editor, pre-filled — so further edits made there save to the row the
 *     quick-add already created, not a second copy. See HomeHabitsCard/PlanTaskCard.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import { ScrollIntoViewContext } from '@/components/ScreenScaffold';
import {
  FontSize,
  Fonts,
  PAD_ROW_MIN_HEIGHT,
  Radius,
  Shadow,
  Spacing,
  contrastOn,
  HitSlop,
} from '@/constants/theme';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

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
  style,
}: Props) {
  const theme = useAppTheme();
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

  const moreButton =
    showControls && onMore ? (
      <PressableScale
        style={styles.more}
        onPress={onMore}
        hitSlop={HitSlop.base}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={moreLabel ?? t.pad.continueEditing}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color={theme.textMuted} />
      </PressableScale>
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

  const fieldAndPrompt = (
    <View style={styles.field}>
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
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
      {/* Our own prompt layer rather than TextInput's `placeholder`, so it clears the
          moment the line is selected instead of on the first keystroke. */}
      {!focused && !hasText ? (
        <View style={styles.prompt} pointerEvents="none">
          <Text style={[styles.promptText, { color: theme.textMuted }]} numberOfLines={1}>
            {prompt}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // Ghost check preview — idle state only (2026-07-31, user report: the blank spare
  // lines below used to each carry their own ghost ring, which read as several
  // identical previews; there is really only one "next thing to check" and it belongs
  // on this row, the one actually empty-but-selected for input). Same 22×22/Radius.full
  // ring as PadRow's real check and the old spare-line ghost, but dimmer — it's a
  // preview of where a check WILL go once this line becomes a real row, not a control.
  const ghostCheck = !showControls ? (
    <View style={[styles.ghostCheck, { borderColor: theme.border }]} pointerEvents="none" />
  ) : null;

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
        <View style={styles.row}>
          {fieldAndPrompt}
          {ghostCheck}
        </View>
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
      {ghostCheck}

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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: PAD_ROW_MIN_HEIGHT,
  },
  // The prompt is absolutely positioned over the field, so showing/hiding it can't reflow
  // the row (which would make selecting the line twitch).
  field: { flex: 1, minWidth: 0, justifyContent: 'center' },
  // A transparent wrapper whose only job is the capture-phase responder check above. It
  // must not change the row's layout — the extras used to be direct children of the row, so
  // this inherits the same flex-row alignment and gap and is otherwise invisible.
  extrasSlot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Panel layout (`panel` prop): a column instead of the single inline row.
  column: { gap: Spacing.xs },
  panelSlot: { width: '100%' },
  panelButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.xs },
  input: {
    // See AddRow's note: react-native-web gives a bare <input> an intrinsic min-width that
    // flex:1 alone doesn't beat, which pushes the trailing controls off the card.
    minWidth: 0,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
  },
  prompt: { position: 'absolute', left: 0, right: 0 },
  promptText: { fontSize: FontSize.md, fontFamily: Fonts.regular },
  more: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
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
  ghostCheck: { width: 22, height: 22, borderRadius: Radius.full, borderWidth: 2, opacity: 0.4 },
  gated: { opacity: 0.45 },
});
