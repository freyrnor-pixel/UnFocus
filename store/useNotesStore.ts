/**
 * useNotesStore.ts — free-form notes (Notater), each with a header, a body, and a checkmark.
 *
 * Zustand store for the Notes site: every note has a short header line, a longer
 * free-text body, and a checkmark-circle. Unchecked notes are "active"; checked
 * notes sink to the bottom of the list — app/notes.tsx renders the split using this
 * ordering directly, with no client-side grouping logic.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id
 *   Used by → app/notes.tsx, components/NoteRow.tsx (Note type), components/HomeNotesCard.tsx,
 *             lib/widgets/sync.ts (Notes widget snapshot)
 *   Data    → defines a Zustand store; owns SQLite table notes
 *
 * Edit notes:
 *   - load() orders by `checked, sort_order` — checked=0 (active) sorts before
 *     checked=1, so the active/checked split in app/notes.tsx falls straight out
 *     of array order (`notes.filter(n => !n.checked)` / `.filter(n => n.checked)`).
 *   - add() appends to the end of the active notes (sortOrder = current note count)
 *     so new notes land at the bottom of the active section, not the top.
 *   - toggleChecked() is a thin wrapper over update() — kept distinct because it's
 *     the row's checkmark-circle tap target, mirroring useTaskStore's toggle().
 *   - Note widens the Decision 015 stub (adds sortOrder/createdAt) — additive, so
 *     NoteRow (which only reads id/header/body/checked) still compiles unchanged.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, FieldMap, loadAll, insertRow, updateRow, rowValues, readStr, readInt, readBool } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';

export type Note = {
  id: string;
  header: string;
  body: string;
  checked: boolean;
  sortOrder: number;
  createdAt: string;
};

type NotesStore = {
  notes: Note[];
  load: () => void;
  add: () => Note;
  update: (id: string, patch: Partial<Omit<Note, 'id'>>) => void;
  toggleChecked: (id: string) => void;
  remove: (id: string) => void;
};

function rowToNote(row: Row): Note {
  return {
    id: readStr(row, 'id'),
    header: readStr(row, 'header'),
    body: readStr(row, 'body'),
    checked: readBool(row, 'checked'),
    sortOrder: readInt(row, 'sort_order'),
    createdAt: readStr(row, 'created_at'),
  };
}

const NOTE_COLUMNS: FieldMap<Note> = {
  id: { col: 'id' },
  header: { col: 'header' },
  body: { col: 'body' },
  checked: { col: 'checked', to: (v) => (v ? 1 : 0) },
  sortOrder: { col: 'sort_order' },
  createdAt: { col: 'created_at' },
};

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],

  load() {
    set({ notes: loadAll('notes', rowToNote, { orderBy: 'checked, sort_order' }) });
  },

  add() {
    const note: Note = {
      id: generateId(),
      header: '',
      body: '',
      checked: false,
      sortOrder: get().notes.length,
      createdAt: new Date().toISOString(),
    };
    insertRow('notes', rowValues(note, NOTE_COLUMNS));
    set((s) => ({ notes: [...s.notes, note] }));
    return note;
  },

  update(id, patch) {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    const next = { ...note, ...patch };
    updateRow('notes', rowValues(patch, NOTE_COLUMNS), 'id = ?', [id]);
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? next : n)) }));
  },

  toggleChecked(id) {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    get().update(id, { checked: !note.checked });
  },

  remove(id) {
    db.runSync('DELETE FROM notes WHERE id = ?', [id]);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },
}));
