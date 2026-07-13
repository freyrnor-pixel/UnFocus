/**
 * useFeedbackStore.ts — per-element debug notes ("hold a card/header to leave a note").
 *
 * Backs components/DebugNoteAnchor.tsx: one optional note per stable `anchorId`
 * (e.g. a header's title text, or a Home card slot id). Saving overwrites the
 * existing note for that anchor; saving empty text deletes it. Real SQLite-backed
 * implementation of the Decision 015 stub — see table `feedback_notes` in lib/db.ts.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id
 *   Used by → components/DebugNoteAnchor.tsx (notes/saveNote), components/ScreenHeader.tsx
 *             (notes — export button), app/settings.tsx (notes.length, clearAll — Reset all notes),
 *             app/_layout.tsx (load() at startup)
 *   Data    → owns SQLite table feedback_notes (id, anchor_id, title [reused as anchor_label],
 *             screen, note, created_at, updated_at; x/y are legacy NOT NULL columns from the
 *             pre-DebugOverlay tap-to-pin design, always written as 0 and otherwise unused)
 *
 * Edit notes:
 *   - One row per anchorId — saveNote() upserts by anchorId, not by note id. Callers look up
 *     an anchor's note with `notes.find(n => n.anchorId === id)`, same as any other store read.
 *   - x/y have no DEFAULT in the CREATE TABLE (NOT NULL), so every insert must supply them
 *     even though nothing reads them any more — omitting them throws a constraint error.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, FieldMap, loadAll, insertRow, updateRow, rowValues, readStr } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';

export type FeedbackNote = {
  id: string;
  anchorId: string;
  anchorLabel: string;
  screen: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type FeedbackStore = {
  notes: FeedbackNote[];
  load: () => void;
  saveNote: (anchorId: string, anchorLabel: string, screen: string, text: string) => void;
  clearAll: () => void;
};

function rowToNote(row: Row): FeedbackNote {
  return {
    id: readStr(row, 'id'),
    anchorId: readStr(row, 'anchor_id'),
    anchorLabel: readStr(row, 'title'),
    screen: readStr(row, 'screen'),
    note: readStr(row, 'note'),
    createdAt: readStr(row, 'created_at'),
    updatedAt: readStr(row, 'updated_at'),
  };
}

const FEEDBACK_COLUMNS: FieldMap<FeedbackNote> = {
  id: { col: 'id' },
  anchorId: { col: 'anchor_id' },
  anchorLabel: { col: 'title' },
  screen: { col: 'screen' },
  note: { col: 'note' },
  createdAt: { col: 'created_at' },
  updatedAt: { col: 'updated_at' },
};

export const useFeedbackStore = create<FeedbackStore>((set, get) => ({
  notes: [],

  load() {
    set({ notes: loadAll('feedback_notes', rowToNote, { orderBy: 'updated_at DESC' }) });
  },

  saveNote(anchorId, anchorLabel, screen, text) {
    const existing = get().notes.find((n) => n.anchorId === anchorId);
    const now = new Date().toISOString();

    if (!text) {
      // Empty save deletes the note (self-service delete via clearing the text).
      if (!existing) return;
      db.runSync('DELETE FROM feedback_notes WHERE id = ?', [existing.id]);
      set((s) => ({ notes: s.notes.filter((n) => n.id !== existing.id) }));
      return;
    }

    if (existing) {
      const next: FeedbackNote = { ...existing, anchorLabel, screen, note: text, updatedAt: now };
      updateRow('feedback_notes', rowValues(next, FEEDBACK_COLUMNS), 'id = ?', [existing.id]);
      set((s) => ({ notes: s.notes.map((n) => (n.id === existing.id ? next : n)) }));
    } else {
      const note: FeedbackNote = {
        id: generateId(),
        anchorId,
        anchorLabel,
        screen,
        note: text,
        createdAt: now,
        updatedAt: now,
      };
      insertRow('feedback_notes', { ...rowValues(note, FEEDBACK_COLUMNS), x: 0, y: 0 });
      set((s) => ({ notes: [note, ...s.notes] }));
    }
  },

  clearAll() {
    db.runSync('DELETE FROM feedback_notes');
    set({ notes: [] });
  },
}));
