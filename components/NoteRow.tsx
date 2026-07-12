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
 *             lib/useAppTheme, store/useNotesStore (Note type)
 *   Used by → (not yet mounted — Phase 5: app/notes.tsx)
 *   Data    → none directly — header/body commits and the checkmark/shopping/plans/delete
 *             actions are all owned by the parent via props
 *
 * Edit notes:
 *   - headerInput/bodyInput seed from `note` once on mount; safe because the parent always
 *     keys this component by note.id, so a given instance only ever represents one note and
 *     never gets fed a different note's text through the same state.
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
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
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

export default function NoteRow({
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

  function commitHeader() {
    const trimmed = headerInput.trim();
    if (trimmed !== note.header) onHeaderCommit(trimmed);
  }

  function commitBody() {
    if (bodyInput !== note.body) onBodyCommit(bodyInput);
  }

  return (
    <Surface style={styles.card}>
      <View style={styles.topRow}>
        <PressableScale
          style={[
            styles.check,
            { borderColor: theme.accent },
            note.checked && { backgroundColor: theme.accent },
          ]}
          onPress={onToggleChecked}
          hitSlop={8}
          accessibilityLabel={t.notes.checkedLabel}
          scaleTo={0.97}
        >
          {note.checked && <Ionicons name="checkmark" size={14} color={theme.accentInk} />}
        </PressableScale>
        <TextInput
          style={[styles.headerInput, { color: theme.text }]}
          value={headerInput}
          onChangeText={setHeaderInput}
          onBlur={commitHeader}
          placeholder={t.notes.headerPlaceholder}
          placeholderTextColor={theme.textMuted}
          returnKeyType="done"
        />
        <PressableScale onPress={onDelete} hitSlop={8} accessibilityLabel={t.notes.deleteNote} scaleTo={0.93}>
          <Ionicons name="trash-outline" size={16} color={theme.bad} />
        </PressableScale>
      </View>

      <View style={styles.actionsRow}>
        <PressableScale
          style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
          onPress={onShoppingPress}
          scaleTo={0.97}
        >
          <Ionicons name="cart-outline" size={15} color={theme.featShop} />
          <Text style={[styles.actionText, { color: theme.text }]}>{t.notes.addToShoppingLabel}</Text>
        </PressableScale>
        <PressableScale
          style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
          onPress={onPlansPress}
          scaleTo={0.97}
        >
          <Ionicons name="checkbox-outline" size={15} color={theme.featTask} />
          <Text style={[styles.actionText, { color: theme.text }]}>{t.notes.addToPlansLabel}</Text>
        </PressableScale>
      </View>

      <TextInput
        style={[styles.bodyInput, { color: theme.text, borderTopColor: theme.border }]}
        value={bodyInput}
        onChangeText={setBodyInput}
        onBlur={commitBody}
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
