/**
 * NoteRow.tsx — one note Card on the Notes screen: header, shopping/plans quick-actions, body.
 *
 * Dumb presentational row (same divide as TaskItem/ShoppingRow/WeekListCard): app/notes.tsx
 * owns the Note data and every callback; this component only renders it and reports edits.
 * Header/body TextInputs are locally buffered and committed to the store onBlur (mirrors
 * WeekListCard's commitRename) instead of writing to SQLite on every keystroke.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, constants/theme, lib/i18n,
 *             lib/useAppTheme, lib/useKeyboardLift, store/useNotesStore (Note type)
 *   Used by → app/notes.tsx
 *   Data    → none directly — header/body commits and the checkmark/shopping/plans/delete
 *             actions are all owned by the parent via props
 *
 * Edit notes:
 *   - headerInput/bodyInput seed from `note` once on mount; safe because the parent always
 *     keys this component by note.id, so a given instance only ever represents one note and
 *     never gets fed a different note's text through the same state.
 *   - **Keyboard-avoidance (2026-07-31)**: header/body each get their own `useKeyboardLift` —
 *     a note far down the list (especially the body field, which sits at the card's bottom)
 *     can end up hidden behind the keyboard on Android's `windowSoftInputMode=resize`. See
 *     that hook's doc / components/AddRow.tsx for the underlying fix.
 *   - Checkmark circle styling mirrors components/TaskItem.tsx's check (24px, theme.accent
 *     border, fills accent + accentInk check when checked) for a consistent "done" affordance
 *     — kept as a hand-rolled circular Pressable rather than FormControls' Checkbox, which is
 *     square-cornered and would break that shared visual language with TaskItem.
 *   - Header/body inputs are hand-rolled TextInput (restyled to Decision 006 tokens only),
 *     not FormControls' Input — Input's label+error chrome doesn't fit these borderless,
 *     unlabelled, card-integrated fields (same reasoning Phase 3b applied to QuickAddSheet's
 *     title/time inputs).
 *   - The whole card renders via <Surface surfaceContext="ambient"> (default) per Decision
 *     008 — this row IS the card unit (one Surface per note), unlike MonthlyTableRow which
 *     is a sub-row inside a parent-owned Surface.
 *   - Theming reads useAppTheme() internally.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing, HitSlop } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useKeyboardLift } from '@/lib/useKeyboardLift';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { Note } from '@/store/useNotesStore';

type Props = {
  note: Note;
  onToggleChecked: () => void;
  onHeaderCommit: (text: string) => void;
  onBodyCommit: (text: string) => void;
  onShoppingPress: () => void;
  onPlansPress: () => void;
  onDelete: () => void;
};

function NoteRow({
  note,
  onToggleChecked,
  onHeaderCommit,
  onBodyCommit,
  onShoppingPress,
  onPlansPress,
  onDelete,
}: Props) {
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
      {/* Title first, then delete, then the CHECK in the right margin (2026-07-30 row rule —
          see AGENTS.md and components/PadRow.tsx). The check used to lead this row. */}
      <View style={styles.topRow}>
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
        <PressableScale onPress={onDelete} hitSlop={HitSlop.base} accessibilityLabel={t.notes.deleteNote} scaleTo={0.93}>
          <Ionicons name="trash-outline" size={16} color={theme.bad} />
        </PressableScale>
        <PressableScale
          style={[
            styles.check,
            { borderColor: theme.accent },
            note.checked && { backgroundColor: theme.accent },
          ]}
          onPress={onToggleChecked}
          hitSlop={HitSlop.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: note.checked }}
          accessibilityLabel={t.notes.checkedLabel}
          scaleTo={0.97}
        >
          {note.checked && <Ionicons name="checkmark" size={14} color={theme.accentInk} />}
        </PressableScale>
      </View>

      <View style={styles.actionsRow}>
        <PressableScale
          style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
          onPress={onShoppingPress}
          scaleTo={0.97}
        >
          {/* 2026-07-31 (A.5): was theme.featShop — the Shopping screen hue. Screen hues are
              retired; the destination still reads from the cart glyph + the label beside it, so
              the icon goes neutral with the muted chip it sits on. */}
          <Ionicons name="cart-outline" size={15} color={theme.textMuted} />
          <Text style={[styles.actionText, { color: theme.text }]}>{t.notes.addToShoppingLabel}</Text>
        </PressableScale>
        <PressableScale
          style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
          onPress={onPlansPress}
          scaleTo={0.97}
        >
          {/* 2026-07-31 (A.5): was theme.featTask — the Home/Plans screen hue. Same reasoning as
              the cart icon above. */}
          <Ionicons name="checkbox-outline" size={15} color={theme.textMuted} />
          <Text style={[styles.actionText, { color: theme.text }]}>{t.notes.addToPlansLabel}</Text>
        </PressableScale>
      </View>

      <TextInput
        ref={bodyLift.ref}
        style={[styles.bodyInput, { color: theme.text, borderTopColor: theme.border }]}
        value={bodyInput}
        onChangeText={setBodyInput}
        onFocus={bodyLift.onFocus}
        onBlur={() => { bodyLift.onBlur(); commitBody(); }}
        placeholder={t.notes.bodyPlaceholder}
        placeholderTextColor={theme.textMuted}
        multiline
        textAlignVertical="top"
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  // Struck through when checked, matching the shared finished-row treatment (constants/theme's
  // DONE_ROW_OPACITY handles the fade wherever the whole row is dimmed).
  headerInputDone: { textDecorationLine: 'line-through' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  check: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInput: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold, paddingVertical: 2 },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
  },
  actionText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  bodyInput: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    minHeight: 60,
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
});

// React.memo with a custom comparator (perf sweep 2026-07-15): app/notes.tsx passes per-note
// inline closures, so a default shallow compare would never bail. The only data prop is `note`
// (kept by reference across store updates that don't touch it); the closures only ever act on
// this row's note, so keeping the previous render's closures is safe. Editing one note then
// re-renders only that row, not the whole list.
function noteRowPropsEqual(prev: Props, next: Props): boolean {
  return prev.note === next.note;
}
export default React.memo(NoteRow, noteRowPropsEqual);
