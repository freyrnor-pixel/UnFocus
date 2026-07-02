/**
 * DebugOverlay.tsx — floating bug-icon button + notes panel
 *
 * Mounted once in app/_layout.tsx, gated on settings.loaded && settings.debugModeEnabled
 * (not wired up yet — settings.debugModeEnabled doesn't exist in this repo's
 * useSettingsStore, same as the rest of settings.tsx's unbuilt toggles; this is a
 * leaf ahead of its screen/gate). Renders a single small floating "bug" button
 * (top-right, offset down past the home screen's header row so it doesn't sit on
 * top of the settings gear, and clear of the FAB's bottom corner). Tapping it opens
 * a bottom-sheet panel showing every saved note as its own bordered card (header
 * above freetext, kept visually separate), plus:
 *   - "Add note" — opens a foreground composer (header + freetext) to create a new note.
 *   - "Export" — hands all notes to React Native's Share.share() as plain text — no new
 *     native dependency, stays OTA-safe; the OS share sheet's own "Copy" covers the
 *     clipboard use case.
 *   - "Reset" — clears all notes, behind a confirm dialog — irreversible.
 *
 * Connections:
 *   Imports → components/AppModal, components/ConfirmationBanner, constants/theme, lib/haptics,
 *             lib/i18n, lib/useAppTheme, store/useFeedbackStore
 *   Used by → app/_layout.tsx (mount not added yet — the file exists ahead of its mount
 *             point, same "ports ahead of screens/gates" pattern as the rest of Phase 3e)
 *   Data    → reads/writes feedback_notes via useFeedbackStore (Phase 5 stub)
 *
 * Edit notes:
 *   - Notes have no screen/position association (replaced the old tap-to-pin
 *     annotation feature, and the later Bubble Wheel tuning tab) — they're a flat
 *     list, always all shown in the panel.
 *   - Token remap (Decision 006): border→border (unchanged name), white→surface,
 *     orange→accent, grayLight→surfaceMuted (note box fill, handle), text→text,
 *     textLight→textMuted, gray→textMuted (placeholder colour), danger→bad,
 *     hardcoded '#fff' save-button text→textInverse.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { tap, warning, heavy } from '@/lib/haptics';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import { showAppModal } from '@/components/AppModal';

type Composer = { title: string; note: string };

export default function DebugOverlay() {
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const insets = useSafeAreaInsets();

  const notes = useFeedbackStore((s) => s.notes);
  const addNote = useFeedbackStore((s) => s.add);
  const clearNotes = useFeedbackStore((s) => s.clearAll);

  const [panelOpen, setPanelOpen] = useState(false);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  function openComposer() {
    tap();
    setComposer({ title: '', note: '' });
  }

  function saveComposer() {
    if (!composer) return;
    const title = composer.title.trim();
    const note = composer.note.trim();
    if (!title || !note) return;
    addNote(title, note);
    setComposer(null);
    setConfirm(t.taskSavedSimple);
  }

  function resetNotes() {
    warning();
    showAppModal(t.resetConfirmTitle(t.debug.resetNotes), t.resetConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.resetConfirmBtn, style: 'destructive', onPress: () => { heavy(); clearNotes(); } },
    ]);
  }

  async function exportNotes() {
    if (notes.length === 0) {
      setConfirm(t.debug.exportEmpty);
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const lines = [t.debug.exportHeading(date), ''];
    for (const n of notes) {
      lines.push(n.title, n.note, '');
    }
    try {
      await Share.share({ message: lines.join('\n').trim() });
    } catch {
      // user cancelled or the share sheet failed — nothing to recover, no-op
    }
  }

  const canSaveComposer = !!composer?.title.trim() && !!composer?.note.trim();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={[styles.fab, { top: insets.top + 60, borderColor: theme.border, backgroundColor: theme.surface }]}
        onPress={() => { tap(); setPanelOpen(true); }}
      >
        <Ionicons name="bug-outline" size={20} color={theme.accent} />
      </Pressable>

      <Modal visible={panelOpen} transparent animationType="slide" onRequestClose={() => setPanelOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPanelOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={[styles.handle, { backgroundColor: theme.surfaceMuted }]} />
          <Text style={[styles.panelTitle, { color: theme.text }]}>{t.debug.panelTitle}</Text>

          <ScrollView style={styles.panelContent}>
            {notes.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.debug.noNotesYet}</Text>
            ) : (
              notes.map((note) => (
                <View key={note.id} style={[styles.noteBox, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
                  <Text style={[styles.noteBoxTitle, { color: theme.text }]}>{note.title}</Text>
                  <Text style={[styles.noteBoxBody, { color: theme.textMuted }]}>{note.note}</Text>
                </View>
              ))
            )}

            <Pressable
              style={[styles.addNoteBtn, { borderColor: theme.accent }]}
              onPress={openComposer}
            >
              <Text style={[styles.addNoteBtnText, { color: theme.accent }]}>{t.debug.addNote}</Text>
            </Pressable>

            <Pressable
              style={[styles.exportBtn, { backgroundColor: theme.accent }, notes.length === 0 && { opacity: 0.4 }]}
              onPress={exportNotes}
              disabled={notes.length === 0}
            >
              <Text style={[styles.exportBtnText, { color: theme.accentInk }]}>{t.debug.exportNotes}</Text>
            </Pressable>

            <Pressable
              style={[styles.resetBtn, { borderColor: theme.bad }, notes.length === 0 && { opacity: 0.4 }]}
              onPress={resetNotes}
              disabled={notes.length === 0}
            >
              <Text style={[styles.resetBtnText, { color: theme.bad }]}>{t.debug.resetNotes}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!composer} transparent animationType="fade" onRequestClose={() => setComposer(null)}>
        <Pressable style={styles.backdrop} onPress={() => setComposer(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.composerWrap}>
          <View style={[styles.composerSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.composerTitle, { color: theme.text }]}>{t.debug.composerTitle}</Text>
            <TextInput
              style={[styles.composerHeaderInput, { color: theme.text, borderColor: theme.border }]}
              placeholder={t.debug.composerHeaderPlaceholder}
              placeholderTextColor={theme.textMuted}
              value={composer?.title ?? ''}
              onChangeText={(txt) => setComposer((c) => (c ? { ...c, title: txt } : c))}
              autoFocus
            />
            <TextInput
              style={[styles.composerInput, { color: theme.text, borderColor: theme.border }]}
              placeholder={t.debug.composerPlaceholder}
              placeholderTextColor={theme.textMuted}
              value={composer?.note ?? ''}
              onChangeText={(txt) => setComposer((c) => (c ? { ...c, note: txt } : c))}
              multiline
            />
            <View style={styles.composerActions}>
              <Pressable style={styles.composerBtn} onPress={() => setComposer(null)}>
                <Text style={[styles.composerBtnText, { color: theme.textMuted }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.composerBtn, { backgroundColor: theme.accent }, !canSaveComposer && { opacity: 0.4 }]}
                onPress={saveComposer}
                disabled={!canSaveComposer}
              >
                <Text style={[styles.composerBtnText, { color: theme.accentInk }]}>{t.save}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.sm,
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.button,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    maxHeight: '75%',
    ...Shadow.fab,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
  },
  panelTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, marginBottom: Spacing.sm, textAlign: 'center' },
  panelContent: { maxHeight: 420 },
  emptyText: { fontSize: FontSize.sm, paddingVertical: Spacing.md, textAlign: 'center' },
  noteBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  noteBoxTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, marginBottom: 2 },
  noteBoxBody: { fontSize: FontSize.sm },
  addNoteBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  addNoteBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  exportBtn: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  exportBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  resetBtn: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  resetBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  composerWrap: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
  composerSheet: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.fab },
  composerTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  composerHeaderInput: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    fontFamily: Fonts.semibold,
  },
  composerInput: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.xs },
  composerBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.sm },
  composerBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
