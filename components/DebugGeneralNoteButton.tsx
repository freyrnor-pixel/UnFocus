/**
 * DebugGeneralNoteButton.tsx — floating "Add general note" button for debug-mode feedback.
 *
 * Renders a small floating pill pinned near the bottom of the screen, visible only while
 * Debug mode is on (settings.debugModeEnabled). Unlike components/DebugNoteAnchor.tsx (one
 * note per card, keyed by a stable anchor id and overwritten on re-save), this is for a note
 * that isn't tied to any specific card — each tap opens a blank composer and saving always
 * INSERTS a new row (a fresh generateId()-based anchor id every time), so a tester can jot
 * down several loose observations on the same screen without overwriting the last one.
 *
 * Connections:
 *   Imports → constants/theme, lib/haptics, lib/i18n, lib/id, lib/useAppTheme,
 *             store/useFeedbackStore, store/useSettingsStore, expo-router (usePathname)
 *   Used by → components/ScreenScaffold.tsx (mounted once per screen, self-gates on
 *             debugModeEnabled so callers don't need their own check)
 *   Data    → writes useFeedbackStore (feedback_notes table)
 *
 * Edit notes:
 *   - `bottomOffset` is supplied by ScreenScaffold, which already computes the bottom-nav /
 *     safe-area clearance for the current screen — this component doesn't re-derive it, so it
 *     never has to know about pager tab bars vs. absolute BottomNav vs. sub-tier screens.
 *   - Save button reads "Save and send" (t.debug.saveAndSend), same label as
 *     DebugNoteAnchor's composer — a reminder notes go out via the header's email export.
 *   - **Keyboard-avoidance (2026-07-31)**: the composer wrap is a `KeyboardAvoidingView` — RN's
 *     `<Modal>` renders outside the screen's own scaffold/KeyboardAvoidingView subtree, so
 *     without this the keyboard covered the (vertically centered) input on short screens. Same
 *     fix as components/UpdateSheet.tsx / components/DebugNoteAnchor.tsx.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { tap } from '@/lib/haptics';
import { generateId } from '@/lib/id';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { useSettingsStore } from '@/store/useSettingsStore';

type Props = {
  /** Distance from the screen's bottom edge — accounts for BottomNav/safe-area clearance. */
  bottomOffset: number;
};

export default function DebugGeneralNoteButton({ bottomOffset }: Props) {
  const debugModeEnabled = useSettingsStore((s) => s.debugModeEnabled);
  if (!debugModeEnabled) return null;
  return <GeneralNoteButton bottomOffset={bottomOffset} />;
}

function GeneralNoteButton({ bottomOffset }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const pathname = usePathname();
  const saveNote = useFeedbackStore((s) => s.saveNote);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  function openComposer() {
    tap();
    setDraft('');
    setOpen(true);
  }

  function handleSave() {
    const text = draft.trim();
    if (text) saveNote(`general:${pathname}:${generateId()}`, t.debug.generalNote, pathname, text);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        style={[styles.fab, { bottom: bottomOffset, backgroundColor: theme.accent, borderColor: theme.surface }]}
        onPress={openComposer}
        accessibilityRole="button"
        accessibilityLabel={t.debug.generalNote}
      >
        <Ionicons name="add" size={14} color={theme.accentInk} />
        <Text style={[styles.fabText, { color: theme.accentInk }]}>{t.debug.generalNote}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.composerWrap}>
          <View style={[styles.composerSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.composerTitle, { color: theme.text }]}>{t.debug.generalNote}</Text>
            <TextInput
              style={[styles.composerInput, { color: theme.text, borderColor: theme.border }]}
              placeholder={t.debug.composerPlaceholder}
              placeholderTextColor={theme.textMuted}
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
            />
            <View style={styles.composerActions}>
              <Pressable style={styles.composerBtn} onPress={() => setOpen(false)}>
                <Text style={[styles.composerBtnText, { color: theme.textMuted }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.composerBtn, { backgroundColor: theme.accent }]} onPress={handleSave}>
                <Text style={[styles.composerBtnText, { color: theme.accentInk }]}>{t.debug.saveAndSend}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const baseStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    zIndex: 101,
    ...Shadow.fab,
  },
  fabText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  composerWrap: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
  composerSheet: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.fab },
  composerTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  composerInput: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  composerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.xs },
  composerBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.sm },
  composerBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
