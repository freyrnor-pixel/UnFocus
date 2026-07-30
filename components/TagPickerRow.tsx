/**
 * TagPickerRow.tsx — pick a task's tags, and coin new ones (2026-07-28, sharing phase 2).
 *
 * The whole tag affordance in the task editor: every existing tag as a togglable chip,
 * plus a "＋ New" chip that opens a one-line input. Deliberately shaped like the "For"
 * person row right above it in components/TaskCard.tsx, so the two read as a pair —
 * who it's for, and what kind of thing it is.
 *
 * Connections:
 *   Imports → components/TagChip, components/OptionalTag, components/PressableScale,
 *             constants/theme, lib/haptics, lib/i18n, lib/tags, lib/useAppTheme, store/useTagStore
 *   Used by → components/TaskCard.tsx (the task editor's Tags row)
 *   Data    → reads store/useTagStore's roster; creates rows through its `ensure()`
 *
 * Edit notes:
 *   - Creation goes through `useTagStore.ensure()`, never `add` — it name-matches first, so
 *     typing "kitchen" when "Kitchen" exists selects the existing tag instead of coining a
 *     near-duplicate that the paired phone would then show twice.
 *   - `ensure()` can return null (a blank/whitespace-only name); the caller must not assume
 *     a row came back.
 *   - The component owns no tag state of its own — `value`/`onChange` keep it controlled, so
 *     a new card's buffered draft and an existing task's immediate write both work unchanged.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import TagChip from '@/components/TagChip';
import OptionalTag from '@/components/OptionalTag';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { toggleTagId } from '@/lib/tags';
import { useAppTheme } from '@/lib/useAppTheme';
import { useTagStore } from '@/store/useTagStore';

type Props = {
  /** Currently-selected tag ids. */
  value: string[];
  onChange: (next: string[]) => void;
};

export default function TagPickerRow({ value, onChange }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const tags = useTagStore((s) => s.tags);
  const ensure = useTagStore((s) => s.ensure);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');

  function commitNew() {
    const created = ensure(draftName);
    // ensure() returns null for a blank name — just close, nothing to select.
    if (created && !value.includes(created.id)) onChange([...value, created.id]);
    setDraftName('');
    setAdding(false);
  }

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textMuted }]}>{t.tags.label}</Text>
        <OptionalTag />
      </View>
      <View style={styles.chips}>
        {tags.map((tag) => (
          <TagChip
            key={tag.id}
            label={tag.name}
            selected={value.includes(tag.id)}
            onPress={() => {
              tap();
              onChange(toggleTagId(value, tag.id));
            }}
          />
        ))}
        {adding ? (
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            onSubmitEditing={commitNew}
            onBlur={commitNew}
            autoFocus
            returnKeyType="done"
            placeholder={t.tags.newPlaceholder}
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surfaceMuted, borderColor: theme.accent },
            ]}
          />
        ) : (
          <TagChip
            add
            label={t.tags.new}
            onPress={() => {
              tap();
              setAdding(true);
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  input: {
    minWidth: 120,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
  },
});
