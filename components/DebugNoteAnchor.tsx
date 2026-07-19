/**
 * DebugNoteAnchor.tsx — tap-to-annotate wrapper for debug-mode feedback notes.
 *
 * Wraps a card/header's content so that, when Debug mode is on (settings.debugModeEnabled),
 * a transparent overlay captures a tap (or long-press) and opens a small text composer tied
 * to a stable `id`. A saved note shows as a small bubble badge in the corner; tapping the
 * badge reopens the composer pre-filled for editing. Clearing the text and saving deletes
 * the note. When Debug mode is off, this renders `children` directly with zero wrapping
 * overhead — the overlay only exists while Debug mode is on.
 *
 * Connections:
 *   Imports → constants/theme, lib/haptics, lib/i18n, lib/useAppTheme, store/useFeedbackStore,
 *             store/useSettingsStore, expo-router (usePathname — recorded as export context)
 *   Used by → components/ScreenHeader.tsx (every screen's title = the per-screen note),
 *             app/(tabs)/index.tsx (Home sections), plus the main cards/sections on the
 *             other four tab screens (shopping/plans/health/scan)
 *   Data    → reads/writes useFeedbackStore (feedback_notes table)
 *
 * Edit notes:
 *   - `id` must be a STABLE, language-neutral key. ScreenHeader keys its title wrap off
 *     `screen:${pathname}` (the route) so the whole-screen note survives a language switch;
 *     card/section anchors use hard-coded ids (e.g. `home.notesPreview`, `plans.dayView`).
 *     NEVER key an anchor off translated title text — that orphans the note on language change.
 *   - One anchor per visual region: never wrap a section AND a child button inside it (they'd
 *     stack overlapping tap targets/badges). Pick the outermost meaningful card, or a single
 *     primary button — not both.
 *   - One note per `id` — saving overwrites; saving empty text deletes it.
 *   - **`style` is preserved even when Debug mode is off** (plain `<View style={style}>`,
 *     no overlay/bubble machinery mounted) — callers lean on this prop for real layout
 *     (e.g. Home's section `marginTop`), not just annotation chrome, so it can't silently
 *     disappear for the vast majority of users who never turn Debug mode on.
 *   - **Tap-to-annotate via a capturing overlay, NOT onLongPress.** An earlier version wrapped
 *     children in a `Pressable onLongPress` and relied on RN responder negotiation to let taps
 *     fall through to interactive children — but the opposite happened: buttons/cards won the
 *     touch and long-press never fired, so "pressing only opened the item, never a note." The
 *     overlay (`StyleSheet.absoluteFill`, rendered on top of children) reliably captures the
 *     tap regardless of what's underneath. Trade-off: a wrapped button does NOT perform its
 *     normal action while Debug mode is on — that's intended (Debug mode = annotate mode).
 *     BottomNav is never wrapped, so tabs stay navigable; turn Debug off to use content again.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { tap } from '@/lib/haptics';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { useSettingsStore } from '@/store/useSettingsStore';

type Props = {
  /** Stable key this note is attached to — see edit notes above. */
  id: string;
  /** Human-readable label shown in the composer heading and Export output. */
  label: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function DebugNoteAnchor({ id, label, children, style }: Props) {
  const debugModeEnabled = useSettingsStore((s) => s.debugModeEnabled);
  if (!debugModeEnabled) {
    // `style` still applies (layout, not just annotation chrome) — see edit notes.
    return style ? <View style={style}>{children}</View> : <>{children}</>;
  }
  return (
    <AnnotatedAnchor id={id} label={label} style={style}>
      {children}
    </AnnotatedAnchor>
  );
}

function AnnotatedAnchor({ id, label, children, style }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const pathname = usePathname();
  const existing = useFeedbackStore((s) => s.notes.find((n) => n.anchorId === id));
  const saveNote = useFeedbackStore((s) => s.saveNote);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  function openComposer() {
    tap();
    setDraft(existing?.note ?? '');
    setOpen(true);
  }

  function handleSave() {
    saveNote(id, label, pathname, draft.trim());
    setOpen(false);
  }

  return (
    <View style={[styles.wrap, style]}>
      {children}

      {/* Debug mode is a dedicated "leave feedback" mode: while it's on, a transparent
          overlay sits ON TOP of the wrapped card/button and captures a tap to open the
          note composer. This is why a wrapped button no longer navigates while debug is
          on — the whole point is to annotate it, not use it. A long-press works too. The
          overlay is the reliable path: a plain onLongPress wrapper loses to interactive
          children (buttons/cards win the touch), which is the "pressing only opens them"
          bug. Turn debug off (header bug icon) to use the app normally again. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={openComposer}
        onLongPress={openComposer}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={existing ? t.debug.editNote : t.debug.noteForLabel(label)}
      />

      {existing && (
        <Pressable
          style={[styles.bubble, { backgroundColor: theme.accent, borderColor: theme.surface }]}
          onPress={openComposer}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.debug.editNote}
        >
          <Ionicons name="chatbubble-ellipses" size={12} color={theme.accentInk} />
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.composerWrap}>
          <View style={[styles.composerSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.composerTitle, { color: theme.text }]}>{t.debug.noteForLabel(label)}</Text>
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
                <Text style={[styles.composerBtnText, { color: theme.accentInk }]}>{t.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: { position: 'relative' },
  bubble: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Shadow.button,
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
