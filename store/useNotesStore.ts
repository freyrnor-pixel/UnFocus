/**
 * useNotesStore.ts — free-form notes (Notater), each with a header, a body, and a checkmark.
 *
 * Zustand store for the Notes site: every note has a short header line, a longer
 * free-text body, and a checkmark-circle. Unchecked notes are "active"; checked
 * notes sink to the bottom of the list — app/notes.tsx renders the split using this
 * ordering directly, with no client-side grouping logic.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/date (todayStr — stamps checkedAt),
 *             lib/widgets/sync (scheduleWidgetSync — debounced
 *             widget/notification refresh on add/update (covers toggleChecked)/remove, so live
 *             widgets don't wait for foreground/background)
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
 *   - reorder(orderedIds) is the drag-reorder commit (2026-08-01) — one section's ids in
 *     their new order, written once on drop, never per drag frame. See its own doc comment
 *     for why the two sections' sort_order ranges are allowed to overlap.
 *   - toggleChecked() is a thin wrapper over update() — kept distinct because it's
 *     the row's checkmark-circle tap target, mirroring useTaskStore's toggle(). It also
 *     stamps `checkedAt` (2026-07-30), which is what lets the pad keep a just-ticked note
 *     in place for the rest of the day instead of whisking it into the checked zone the
 *     instant you tap it. Anything that sets `checked` WITHOUT going through here will
 *     leave `checkedAt` stale — route ticks through toggleChecked, not update().
 *   - Note widens the Decision 015 stub (adds sortOrder/createdAt) — additive, so
 *     NoteRow (which only reads id/header/body/checked) still compiles unchanged.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, FieldMap, loadAll, insertRow, updateRow, rowValues, readStr, readInt, readBool } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { todayStr } from '@/lib/date';
import { scheduleWidgetSync } from '@/lib/widgets/sync';

export type Note = {
  id: string;
  header: string;
  body: string;
  checked: boolean;
  /**
   * The day this note was ticked ('YYYY-MM-DD'), or '' when it isn't ticked.
   *
   * Exists so a tick doesn't make a note vanish from under your finger: a note checked
   * TODAY stays struck-through in place on the pad, and only sinks into the "Checked off"
   * zone from tomorrow (2026-07-30). System-managed — set by toggleChecked, never edited by
   * the user, and deliberately not importable via lib/aiSetupGuide.ts.
   */
  checkedAt: string;
  sortOrder: number;
  createdAt: string;
};

type NotesStore = {
  notes: Note[];
  load: () => void;
  add: () => Note;
  update: (id: string, patch: Partial<Omit<Note, 'id'>>) => void;
  toggleChecked: (id: string) => void;
  /** Write a new sort_order (by array position) for every id — the drag-reorder commit. */
  reorder: (orderedIds: string[]) => void;
  remove: (id: string) => void;
};

function rowToNote(row: Row): Note {
  return {
    id: readStr(row, 'id'),
    header: readStr(row, 'header'),
    body: readStr(row, 'body'),
    checked: readBool(row, 'checked'),
    checkedAt: readStr(row, 'checked_at'),
    sortOrder: readInt(row, 'sort_order'),
    createdAt: readStr(row, 'created_at'),
  };
}

const NOTE_COLUMNS: FieldMap<Note> = {
  id: { col: 'id' },
  header: { col: 'header' },
  body: { col: 'body' },
  checked: { col: 'checked', to: (v) => (v ? 1 : 0) },
  checkedAt: { col: 'checked_at' },
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
      checkedAt: '',
      sortOrder: get().notes.length,
      createdAt: new Date().toISOString(),
    };
    insertRow('notes', rowValues(note, NOTE_COLUMNS));
    set((s) => ({ notes: [...s.notes, note] }));
    scheduleWidgetSync();
    return note;
  },

  update(id, patch) {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    const next = { ...note, ...patch };
    updateRow('notes', rowValues(patch, NOTE_COLUMNS), 'id = ?', [id]);
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? next : n)) }));
    scheduleWidgetSync();
  },

  toggleChecked(id) {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    const checked = !note.checked;
    // Stamp the day, so the card can keep a just-ticked note in place and only sink it into
    // the "Checked off" zone tomorrow. Un-ticking clears the stamp, so a note that comes back
    // is fully active again rather than reading as "checked a while ago".
    get().update(id, { checked, checkedAt: checked ? todayStr() : '' });
  },

  /**
   * Commit a drag-reorder (app/notes.tsx, via lib/useDragReorder). `orderedIds` is ONE
   * section's rows — active or checked — and gets 0…n-1; the other section keeps its own
   * numbers. Two sections can therefore hold the same sort_order values, which is harmless
   * because load() orders by `checked` FIRST: every active note sorts above every checked one
   * regardless. Rows not named here are untouched.
   */
  reorder(orderedIds) {
    const position = new Map(orderedIds.map((id, i) => [id, i]));
    orderedIds.forEach((id, i) => updateRow('notes', { sort_order: i }, 'id = ?', [id]));
    set((s) => ({
      notes: [...s.notes]
        .map((n) => (position.has(n.id) ? { ...n, sortOrder: position.get(n.id)! } : n))
        // Keep the array in the same order load() would produce, so the screen's
        // `filter(checked)` split still comes straight out of it.
        .sort((a, b) => Number(a.checked) - Number(b.checked) || a.sortOrder - b.sortOrder),
    }));
    scheduleWidgetSync();
  },

  remove(id) {
    db.runSync('DELETE FROM notes WHERE id = ?', [id]);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    scheduleWidgetSync();
  },
}));
