/**
 * NotesSurface.tsx — the Notes list: active notes above, checked notes below a divider.
 *
 * Extracted from app/notes.tsx (2026-08-20, "full-screen card expansion") for
 * components/CardExpandHost.tsx's `homeNotes` body — Home's Notes card title press now expands
 * in place instead of pushing to /notes. app/notes.tsx keeps VoiceNoteFAB as its own
 * ScreenScaffold sibling (a floating FAB can be clipped by a scroll viewport the same way a
 * toast can — see components/TodoSurface.tsx's day-reset-banner note for the general shape of
 * that rule) and mounts this component for the row list itself.
 *
 * Connections:
 *   Imports → components/NoteRow, components/AnimatedListItem, components/DraggableTaskRow,
 *             components/SendToSheet, components/GhostRow, components/HintCard, lib/i18n,
 *             lib/prefill, lib/screenColor, lib/useDragReorder, lib/useGhostTimeout,
 *             lib/useAppTheme, store/useNotesStore
 *   Used by → app/notes.tsx (`embedded` omitted) and components/CardExpandHost.tsx's
 *             `homeNotes` registry entry (`embedded` — its pane already supplies the title bar
 *             and there is no room for a floating FAB inside it)
 *   Data    → reads/writes useNotesStore directly
 *
 * Edit notes:
 *   - **`embedded` drops the ⓘ hint only** — everything else (both sections, the divider, the
 *     ghost-undo row, the send-to sheet) is identical in both modes. There is no Surface to
 *     unwrap here (unlike components/FoodTab.tsx/HealthSurface.tsx): this was never a boxed
 *     card of its own, just a flat list on the screen backdrop, so nothing reads as a nested
 *     panel either way.
 *   - VoiceNoteFAB is deliberately NOT mounted here in either mode — it stays a ScreenScaffold
 *     sibling on app/notes.tsx, and the expanded card simply has no floating capture button;
 *     HomeNotesCard's own header mic button is a separate, pre-existing capture path.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNotesStore } from '@/store/useNotesStore';
import HintCard from '@/components/HintCard';
import NoteRow from '@/components/NoteRow';
import AnimatedListItem from '@/components/AnimatedListItem';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import SendToSheet, { SendToTarget } from '@/components/SendToSheet';
import GhostRow from '@/components/GhostRow';
import { useT } from '@/lib/i18n';
import { prefillRoute } from '@/lib/prefill';
import { getScreenColor } from '@/lib/screenColor';
import { useDragReorder } from '@/lib/useDragReorder';
import { useGhostTimeout } from '@/lib/useGhostTimeout';
import { FontSize, Fonts, SCREEN_GAP, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Mounted inside CardExpandHost's own pane — drops the ⓘ hint. See the header note. */
  embedded?: boolean;
};

export default function NotesSurface({ embedded = false }: Props) {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();

  const notes = useNotesStore((s) => s.notes);
  const updateNote = useNotesStore((s) => s.update);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);
  const reorderNotes = useNotesStore((s) => s.reorder);
  const removeNote = useNotesStore((s) => s.remove);
  const lastDeletedNote = useNotesStore((s) => s.lastDeleted);
  const restoreLastDeletedNote = useNotesStore((s) => s.restoreLastDeleted);
  const dismissLastDeletedNote = useNotesStore((s) => s.dismissLastDeleted);
  useGhostTimeout(!!lastDeletedNote, dismissLastDeletedNote);

  const [sendToId, setSendToId] = useState<string | null>(null);
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  const accent = getScreenColor(theme, 'notes').base;
  const activeNotes = notes.filter((n) => !n.checked);
  const checkedNotes = notes.filter((n) => n.checked);

  const activeDrag = useDragReorder(activeNotes.map((n) => n.id), reorderNotes);
  const checkedDrag = useDragReorder(checkedNotes.map((n) => n.id), reorderNotes);

  function handleSendTo(target: SendToTarget) {
    const note = notes.find((n) => n.id === sendToId);
    setSendToId(null);
    if (!note) return;
    const text = note.header.trim() || note.body.trim();
    if (!note.checked) toggleChecked(note.id);
    router.push(prefillRoute(target, text));
  }

  function renderRow(note: (typeof notes)[number], drag: ReturnType<typeof useDragReorder>) {
    return (
      <AnimatedListItem key={note.id} enabled={hasMounted.current}>
        <DraggableTaskRow isOpen={false} {...drag.rowProps(note.id)}>
          <NoteRow
            note={note}
            accent={accent}
            onToggleChecked={() => toggleChecked(note.id)}
            onHeaderCommit={(text) => updateNote(note.id, { header: text })}
            onBodyCommit={(text) => updateNote(note.id, { body: text })}
            onAction={() => setSendToId(note.id)}
          />
        </DraggableTaskRow>
      </AnimatedListItem>
    );
  }

  function renderSection(section: (typeof notes), drag: ReturnType<typeof useDragReorder>) {
    return drag.order
      .map((id) => section.find((n) => n.id === id))
      .filter((n): n is (typeof notes)[number] => !!n)
      .map((note) => renderRow(note, drag));
  }

  return (
    <View style={styles.content}>
      {!embedded && <HintCard text={t.hints.notes.text} />}

      {notes.length === 0 && !lastDeletedNote ? (
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.notes.emptyState}</Text>
      ) : (
        <>
          {(activeNotes.length > 0 || (lastDeletedNote && !lastDeletedNote.checked)) && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.notes.activeLabel}</Text>
              {renderSection(activeNotes, activeDrag)}
              {lastDeletedNote && !lastDeletedNote.checked ? (
                <GhostRow title={lastDeletedNote.header || t.notes.headerPlaceholder} onRestore={restoreLastDeletedNote} />
              ) : null}
            </View>
          )}

          {(activeNotes.length > 0 || (lastDeletedNote && !lastDeletedNote.checked)) &&
            (checkedNotes.length > 0 || (lastDeletedNote && lastDeletedNote.checked)) && (
              <View style={[styles.divider, { backgroundColor: theme.accent }]} />
            )}

          {(checkedNotes.length > 0 || (lastDeletedNote && lastDeletedNote.checked)) && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.notes.checkedLabel}</Text>
              {renderSection(checkedNotes, checkedDrag)}
              {lastDeletedNote && lastDeletedNote.checked ? (
                <GhostRow title={lastDeletedNote.header || t.notes.headerPlaceholder} onRestore={restoreLastDeletedNote} />
              ) : null}
            </View>
          )}
        </>
      )}

      <SendToSheet
        visible={sendToId !== null}
        onClose={() => setSendToId(null)}
        onPick={handleSendTo}
        onDelete={() => sendToId && removeNote(sendToId)}
        deleteLabel={t.notes.deleteNote}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // No horizontal padding, and no paddingBottom either — both are the caller's job
  // (app/notes.tsx's own `content` wrapper for the pushed route; CardExpandHost's
  // `scrollContent` for the expanded body), same convention components/FoodTab.tsx's `root`
  // follows. `gap` stays here: it is needed for this component's own internal card stack
  // regardless of which caller mounts it.
  content: { gap: SCREEN_GAP },
  section: { gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  divider: { height: 2, borderRadius: 999 },
  emptyText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, textAlign: 'center', marginTop: Spacing.xl },
});
