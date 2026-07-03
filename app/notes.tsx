/**
 * notes.tsx — Notes site ("Notater"): free-form notes with shopping/plans quick-actions.
 *
 * Two stacked sections split by a theme-coloured divider: active (unchecked) notes above,
 * checked-off notes below — the split is just `notes.filter(checked)` since useNotesStore's
 * load() already orders by `checked, sort_order`. Each note renders as a NoteRow (header +
 * checkmark + delete, shopping/plans quick-action buttons, body textarea). The shopping
 * button opens ShoppingQuickAddSheet in place (no navigation away from this screen); the
 * plans button pushes /task-form with the note's header prefilled as the new task's title.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/NoteRow,
 *             components/AddFAB, components/ShoppingQuickAddSheet, constants/theme,
 *             lib/db, lib/i18n, lib/useAppTheme, store/useNotesStore, store/useSettingsStore
 *   Used by → Expo Router route "/notes", reached via a preview card on app/index.tsx
 *             (no BottomNav tab by design — Decision 012 / C1 context)
 *   Data    → reads/writes useNotesStore (notes table) directly — no draft buffer, since a
 *             note has no "locked, read-only" resting state to fall back to (unlike plans.tsx)
 *
 * Edit notes:
 *   - shoppingSheetVisible is a screen-level bool, not per-row — only one sheet can be open
 *     at a time, and it doesn't need to know which note opened it (it just adds a plain
 *     shopping-list item, same as app/shopping.tsx's own "+").
 *   - The divider line uses theme.accent (the theme's primary accent across every palette)
 *     so it reads as "the active colour theme", not a fixed hue.
 *   - Only rendered when both sections are non-empty — an all-active or all-checked list has
 *     nothing to visually separate.
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome). AddFAB + the sheet
 *     render as siblings of ScreenScaffold. Decision 006 tokens only (accent/textMuted).
 *   - Loads the store on focus so edits made in /capture (edit affordance) or /task-form
 *     are reflected on return; initDb() is idempotent but guarded by a module flag.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useNotesStore } from '@/store/useNotesStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import NoteRow from '@/components/NoteRow';
import AddFAB from '@/components/AddFAB';
import ShoppingQuickAddSheet from '@/components/ShoppingQuickAddSheet';
import { useT } from '@/lib/i18n';
import { initDb } from '@/lib/db';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

let dbBootstrapped = false;

export default function NotesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const notes = useNotesStore((s) => s.notes);
  const addNote = useNotesStore((s) => s.add);
  const updateNote = useNotesStore((s) => s.update);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);
  const removeNote = useNotesStore((s) => s.remove);
  const loadNotes = useNotesStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);

  const [shoppingSheetVisible, setShoppingSheetVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadNotes();
    }, [loadSettings, loadNotes])
  );

  const activeNotes = notes.filter((n) => !n.checked);
  const checkedNotes = notes.filter((n) => n.checked);

  function openTaskForm(title: string) {
    router.push({ pathname: '/task-form', params: { title } });
  }

  function renderRow(note: (typeof notes)[number]) {
    return (
      <NoteRow
        key={note.id}
        note={note}
        onToggleChecked={() => toggleChecked(note.id)}
        onHeaderCommit={(text) => updateNote(note.id, { header: text })}
        onBodyCommit={(text) => updateNote(note.id, { body: text })}
        onShoppingPress={() => setShoppingSheetVisible(true)}
        onPlansPress={() => openTaskForm(note.header)}
        onDelete={() => removeNote(note.id)}
      />
    );
  }

  return (
    <>
      <ScreenScaffold title={t.notes.title} tier="site">
        <View style={styles.content}>
          <HintCard text={t.hints.notes.text} example={t.hints.notes.example} />

          {notes.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.notes.emptyState}</Text>
          ) : (
            <>
              {activeNotes.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.notes.activeLabel}</Text>
                  {activeNotes.map(renderRow)}
                </View>
              )}

              {activeNotes.length > 0 && checkedNotes.length > 0 && (
                <View style={[styles.divider, { backgroundColor: theme.accent }]} />
              )}

              {checkedNotes.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.notes.checkedLabel}</Text>
                  {checkedNotes.map(renderRow)}
                </View>
              )}
            </>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScreenScaffold>

      <AddFAB onPress={() => addNote()} />
      <ShoppingQuickAddSheet visible={shoppingSheetVisible} onClose={() => setShoppingSheetVisible(false)} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.sm },
  section: { gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 2, borderRadius: 999, marginVertical: Spacing.md },
  emptyText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'center', marginTop: Spacing.xl },
});
