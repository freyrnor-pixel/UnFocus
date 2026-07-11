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
 *             components/VoiceNoteFAB, components/ShoppingQuickAddSheet, constants/theme,
 *             lib/i18n, lib/useAppTheme, store/useNotesStore
 *   Used by → Expo Router route "/notes", reached via Home's "More → Notes" link
 *             (no BottomNav tab by design — Decision 036; note editing itself is Decision 012)
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
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome). VoiceNoteFAB + the sheet
 *     render as siblings of ScreenScaffold. Decision 006 tokens only (accent/textMuted).
 *   - No manual "add blank note" affordance — VoiceNoteFAB both creates the note and fills
 *     its body from the transcript; the header is left for the user to type (see NoteRow).
 *   - Deep link `unfocus:///notes?capture=voice` (the Notes home-screen widget's mic button)
 *     lands here with `capture==='voice'` → VoiceNoteFAB `autoStart` begins recording on mount.
 *   - Store hydration happens once at startup in app/_layout.tsx; edits made in /capture
 *     (edit affordance) or /task-form land in the same shared store, so they're reflected
 *     on return without a per-screen focus-load.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNotesStore } from '@/store/useNotesStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import NoteRow from '@/components/NoteRow';
import VoiceNoteFAB from '@/components/VoiceNoteFAB';
import ShoppingQuickAddSheet from '@/components/ShoppingQuickAddSheet';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

export default function NotesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  // Opened from the Notes widget mic button (unfocus:///notes?capture=voice) → auto-record.
  const { capture } = useLocalSearchParams<{ capture?: string }>();

  const notes = useNotesStore((s) => s.notes);
  const addNote = useNotesStore((s) => s.add);
  const updateNote = useNotesStore((s) => s.update);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);
  const removeNote = useNotesStore((s) => s.remove);

  const [shoppingSheetVisible, setShoppingSheetVisible] = useState(false);

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

      <VoiceNoteFAB
        autoStart={capture === 'voice'}
        onTranscript={(text) => {
          const note = addNote();
          updateNote(note.id, { body: text });
        }}
      />
      <ShoppingQuickAddSheet visible={shoppingSheetVisible} onClose={() => setShoppingSheetVisible(false)} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md },
  // Decision 043 rule 2: Spacing.xl above every section; Spacing.sm below the header
  // comes from this same gap (header + note rows are the section's only two "slots").
  section: { gap: Spacing.sm, marginTop: Spacing.xl },
  sectionLabel: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  divider: { height: 2, borderRadius: 999, marginVertical: Spacing.md },
  emptyText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'center', marginTop: Spacing.xl },
});
