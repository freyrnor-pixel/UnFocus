/**
 * notes.tsx — Notes site ("Notater"): free-form notes with shopping/plans quick-actions.
 *
 * Two stacked sections split by a theme-coloured divider: active (unchecked) notes above,
 * checked-off notes below — the split is just `notes.filter(checked)` since useNotesStore's
 * load() already orders by `checked, sort_order`. Each note renders as a NoteRow: an editable
 * title line drawn through components/PadRow.tsx (title → ⋯ → check) over a body textarea.
 *
 * Rows are **drag-reorderable** (2026-08-01, "drag to reorder should be universal") — hold a
 * note for ~400ms and drag it, the same gesture Home's preview cards and the shopping list
 * have always had, now shared through lib/useDragReorder.ts.
 *
 * The ⋯ opens components/SendToSheet.tsx — the same sheet Home's note rows open (to-do /
 * shopping / habits / goals, plus this screen's own delete row), replacing the two hand-rolled
 * "Add to shopping" / "Add to plans" chips each row used to carry. The note's text travels
 * with it via lib/prefill, which the old shopping chip did not do: it opened an empty
 * ShoppingQuickAddSheet you retyped into. That component had no other caller and was deleted.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/NoteRow,
 *             components/AnimatedListItem (note add/remove fade), components/DraggableTaskRow
 *             (the long-press-drag gesture), components/VoiceNoteFAB, components/SendToSheet,
 *             constants/theme, lib/i18n, lib/prefill (prefillRoute), lib/domainColor,
 *             lib/useDragReorder, lib/useAppTheme, store/useNotesStore
 *   Used by → Expo Router route "/notes", reached via Home's "More → Notes" link
 *             (no BottomNav tab by design — Decision 036; note editing itself is Decision 012)
 *   Data    → reads/writes useNotesStore (notes table) directly — no draft buffer, since a
 *             note has no "locked, read-only" resting state to fall back to (unlike plans.tsx)
 *
 * Edit notes:
 *   - `sendToId` is the note whose ⋯ sheet is open, not a bare boolean: the sheet acts ON that
 *     note (sends its text, or deletes it), so it has to know which one.
 *   - **Two drag domains, one per section.** A drag reorders within active or within checked
 *     and never across the divider — ticking is what moves a note between them, and a drag
 *     that crossed would have to silently tick or untick it. Render from `drag.order`
 *     (`renderSection`), never from the store array, or the preview can't move under the finger.
 *   - The divider line uses theme.accent (the theme's primary accent across every palette)
 *     so it reads as "the active colour theme", not a fixed hue.
 *   - Only rendered when both sections are non-empty — an all-active or all-checked list has
 *     nothing to visually separate.
 *   - **tier='sub' (2026-08-01, addendum B.4)** — it was tier='site' from Decision 001, back
 *     when Notes was one of the BottomNav tabs. It stopped being a tab (Decision 036) but the
 *     tier never followed, so this screen kept a site header (a Settings gear) and its own
 *     BottomNav even though it is reached by a `router.push` from Home's "More" links, exactly
 *     like Food/Catalogue/Budget — all of which are tier='sub'. It is now title-only with an
 *     iOS back link, matching them; Android uses the system back gesture as it does there.
 *     `__tests__/screenHeaderContract.test.ts` pins this. VoiceNoteFAB + the sheet render as
 *     siblings of ScreenScaffold. Decision 006 tokens only (accent/textMuted).
 *   - No manual "add blank note" affordance — VoiceNoteFAB both creates the note and fills
 *     its body from the transcript; the header is left for the user to type (see NoteRow).
 *   - Deep link `unfocus:///notes?capture=voice` (the Notes home-screen widget's mic button)
 *     lands here with `capture==='voice'` → VoiceNoteFAB `autoStart` begins recording on mount.
 *   - Store hydration happens once at startup in app/_layout.tsx; edits made in /capture
 *     (edit affordance) land in the same shared store, so they're reflected on return
 *     without a per-screen focus-load.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNotesStore } from '@/store/useNotesStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import NoteRow from '@/components/NoteRow';
import AnimatedListItem from '@/components/AnimatedListItem';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import VoiceNoteFAB from '@/components/VoiceNoteFAB';
import SendToSheet, { SendToTarget } from '@/components/SendToSheet';
import { useT } from '@/lib/i18n';
import { prefillRoute } from '@/lib/prefill';
import { getDomainColor } from '@/lib/domainColor';
import { useDragReorder } from '@/lib/useDragReorder';
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
  const reorderNotes = useNotesStore((s) => s.reorder);
  const removeNote = useNotesStore((s) => s.remove);

  // Which note's ⋯ sheet is open (null = closed). One sheet at a time, like the Home pad's.
  const [sendToId, setSendToId] = useState<string | null>(null);
  // Gate row entrance so only notes added after mount fade in (not the whole list on load).
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  const accent = getDomainColor(theme, 'note').accent;
  const activeNotes = notes.filter((n) => !n.checked);
  const checkedNotes = notes.filter((n) => n.checked);

  // Each section is its own drag domain: a row can be reordered among its neighbours, but a
  // drag never carries it across the divider (checking a note is what moves it there, and
  // dragging one over would silently tick or untick it).
  const activeDrag = useDragReorder(activeNotes.map((n) => n.id), reorderNotes);
  const checkedDrag = useDragReorder(checkedNotes.map((n) => n.id), reorderNotes);

  // Send it elsewhere: navigate with the note's text prefilled AND tick the note off — it has
  // been dealt with. Same contract as components/HomeNotesCard.tsx's ⋯, deliberately: this
  // screen used to have two chips instead, one of which ("add to shopping") opened an EMPTY
  // quick-add sheet you had to retype the note into (components/ShoppingQuickAddSheet.tsx,
  // deleted with this change — it had no other caller).
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

  /** Render a section in the drag's live order, not the store's. */
  function renderSection(section: (typeof notes), drag: ReturnType<typeof useDragReorder>) {
    return drag.order
      .map((id) => section.find((n) => n.id === id))
      .filter((n): n is (typeof notes)[number] => !!n)
      .map((note) => renderRow(note, drag));
  }

  return (
    <>
      <ScreenScaffold title={t.notes.title} tier="sub" onBack={() => router.back()}>
        <View style={styles.content}>
          <HintCard text={t.hints.notes.text} example={t.hints.notes.example} />

          {notes.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.notes.emptyState}</Text>
          ) : (
            <>
              {activeNotes.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.notes.activeLabel}</Text>
                  {renderSection(activeNotes, activeDrag)}
                </View>
              )}

              {activeNotes.length > 0 && checkedNotes.length > 0 && (
                <View style={[styles.divider, { backgroundColor: theme.accent }]} />
              )}

              {checkedNotes.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.notes.checkedLabel}</Text>
                  {renderSection(checkedNotes, checkedDrag)}
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
      <SendToSheet
        visible={sendToId !== null}
        onClose={() => setSendToId(null)}
        onPick={handleSendTo}
        onDelete={() => sendToId && removeNote(sendToId)}
        deleteLabel={t.notes.deleteNote}
      />
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
