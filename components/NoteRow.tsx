/**
 * NoteRow.tsx — one note Card on the Notes screen: an editable title line, then the body.
 *
 * Dumb presentational row (same divide as TaskItem/ShoppingRow/WeekListCard): app/notes.tsx
 * owns the Note data and every callback; this component only renders it and reports edits.
 * Header/body TextInputs are locally buffered and committed to the store onBlur (mirrors
 * WeekListCard's commitRename) instead of writing to SQLite on every keystroke.
 *
 * **Drawn through components/PadRow.tsx since 2026-08-01** — the shared row anatomy the four
 * Home cards and the Habits tab already use (B2-3's remaining conversion; see PadRow's header
 * for how that task's premise came out inverted). What changed with it:
 *   - the header line is now a PadRow: title → ⋯ → check, with the header TextInput passed as
 *     PadRow's `titleInput` so the field stays editable in place — that is the whole reason
 *     this screen exists, and read-only rows are what the Home pad is for;
 *   - the two hand-rolled "Add to shopping" / "Add to plans" chips became that ONE ⋯, opening
 *     components/SendToSheet.tsx — the same sheet Home's note rows open. Four destinations
 *     instead of two, and the note's text now travels with it (lib/prefill), where the old
 *     shopping chip opened an empty quick-add sheet you had to retype into;
 *   - the trash button went into that sheet too (its optional delete row), because the row
 *     rule allows one row-level action button and the ⋯ is it;
 *   - a checked note now strikes AND fades the whole card, not just the header text.
 *
 * Connections:
 *   Imports → components/Surface, components/PadRow, constants/theme (DONE_ROW_OPACITY),
 *             lib/i18n, lib/useAppTheme, lib/useKeyboardLift, store/useNotesStore (Note type)
 *   Used by → app/notes.tsx
 *   Data    → none directly — header/body commits and the check/⋯ actions are all owned by
 *             the parent via props
 *
 * Edit notes:
 *   - headerInput/bodyInput seed from `note` once on mount; safe because the parent always
 *     keys this component by note.id, so a given instance only ever represents one note and
 *     never gets fed a different note's text through the same state.
 *   - **Keyboard-avoidance (2026-07-31)**: header/body each get their own `useKeyboardLift` —
 *     a note far down the list (especially the body field, which sits at the card's bottom)
 *     can end up hidden behind the keyboard on Android's `windowSoftInputMode=resize`. See
 *     that hook's doc / components/AddRow.tsx for the underlying fix.
 *   - The header input must keep matching PadRow's own `title` style (FontSize.md /
 *     Fonts.semibold) — it stands in for that Text, so a mismatch shows up as notes rows that
 *     are a different size from every other row in the app.
 *   - `done` fades PadRow's own line; the body below it is outside that row, so it takes the
 *     same DONE_ROW_OPACITY here. Without it a ticked note reads as half-faded.
 *   - The whole card renders via <Surface surfaceContext="ambient"> (default) per Decision
 *     008 — this row IS the card unit (one Surface per note), unlike MonthlyTableRow which
 *     is a sub-row inside a parent-owned Surface.
 *   - Theming reads useAppTheme() internally; the accent is passed in by the parent (the note
 *     DOMAIN hue, matching components/HomeNotesCard.tsx — it used to be the generic
 *     theme.accent here, which was the same row in two colours across two screens).
 */
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { DONE_ROW_OPACITY, FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useKeyboardLift } from '@/lib/useKeyboardLift';
import Surface from '@/components/Surface';
import PadRow from '@/components/PadRow';
import { Note } from '@/store/useNotesStore';

type Props = {
  note: Note;
  /** The note domain hue — passed in so the parent owns the one getDomainColor() call. */
  accent: string;
  onToggleChecked: () => void;
  onHeaderCommit: (text: string) => void;
  onBodyCommit: (text: string) => void;
  /** Opens the ⋯ sheet (send it somewhere, or delete it) — the row's one action. */
  onAction: () => void;
};

function NoteRow({ note, accent, onToggleChecked, onHeaderCommit, onBodyCommit, onAction }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const [headerInput, setHeaderInput] = useState(note.header);
  const [bodyInput, setBodyInput] = useState(note.body);
  const headerLift = useKeyboardLift<TextInput>();
  const bodyLift = useKeyboardLift<TextInput>();

  function commitHeader() {
    const trimmed = headerInput.trim();
    if (trimmed !== note.header) onHeaderCommit(trimmed);
  }

  function commitBody() {
    if (bodyInput !== note.body) onBodyCommit(bodyInput);
  }

  return (
    <Surface style={styles.card}>
      <PadRow
        // The accessible name for the check and the ⋯ — the input carries the visible text.
        title={note.header || t.notes.headerPlaceholder}
        accent={accent}
        done={note.checked}
        titleInput={
          <TextInput
            ref={headerLift.ref}
            style={[
              styles.headerInput,
              { color: note.checked ? theme.textMuted : theme.text },
              note.checked && styles.headerInputDone,
            ]}
            value={headerInput}
            onChangeText={setHeaderInput}
            onFocus={headerLift.onFocus}
            onBlur={() => { headerLift.onBlur(); commitHeader(); }}
            placeholder={t.notes.headerPlaceholder}
            placeholderTextColor={theme.textMuted}
            returnKeyType="done"
          />
        }
        onAction={onAction}
        actionLabel={t.sendTo.title}
        onToggle={onToggleChecked}
        toggleLabel={note.header || t.notes.checkedLabel}
      />

      <View style={note.checked && styles.bodyDone}>
        <TextInput
          ref={bodyLift.ref}
          style={[styles.bodyInput, { color: theme.text, borderTopColor: theme.rule }]}
          value={bodyInput}
          onChangeText={setBodyInput}
          onFocus={bodyLift.onFocus}
          onBlur={() => { bodyLift.onBlur(); commitBody(); }}
          placeholder={t.notes.bodyPlaceholder}
          placeholderTextColor={theme.textMuted}
          multiline
          textAlignVertical="top"
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  // Mirrors PadRow's `title` (see the header note) — this input stands in for that Text.
  headerInput: { fontSize: FontSize.md, fontFamily: Fonts.semibold, paddingVertical: 2 },
  headerInputDone: { textDecorationLine: 'line-through' },
  bodyDone: { opacity: DONE_ROW_OPACITY },
  /**
   * ⚠️ **Neither of this card's two inputs is a boxed field, and that is deliberate**
   * (2026-08-21). `CONSISTENCY_AUDIT.md` §1 counted this file as drawing *"three distinct field
   * shapes in one card"* — a bare line, a `borderTopWidth: 1` rule and the row's title input.
   * Two of those three are the inputs and the third is a DIVIDER, which is why its colour moved
   * from `theme.border` (a control edge) to `theme.rule` (a hairline between parts of a card) in
   * the same pass: at `border` weight it read as the top edge of a box that had no other sides.
   *
   * The inputs stay unboxed because this card IS a piece of paper. Its header input stands in
   * for `components/PadRow.tsx`'s title `Text` — a row, and rows have been flush and unboxed
   * since the 2026-08-15 PadSheet pass — and its body is the note. Boxing either would be the
   * boxed-ROWS design `DESIGN_COMPARISON/10` rejected, applied to the one surface in the app
   * whose whole point is that you write on it.
   */
  bodyInput: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    minHeight: 60,
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
});

// React.memo with a custom comparator (perf sweep 2026-07-15): app/notes.tsx passes per-note
// inline closures, so a default shallow compare would never bail. The only data props are
// `note` (kept by reference across store updates that don't touch it) and `accent` (a theme
// token); the closures only ever act on this row's note, so keeping the previous render's
// closures is safe. Editing one note then re-renders only that row, not the whole list.
function noteRowPropsEqual(prev: Props, next: Props): boolean {
  return prev.note === next.note && prev.accent === next.accent;
}
export default React.memo(NoteRow, noteRowPropsEqual);
