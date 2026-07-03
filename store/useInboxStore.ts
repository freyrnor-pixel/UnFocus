/**
 * useInboxStore.ts — quick-capture inbox (AP-02)
 *
 * Zustand store for frictionless one-line capture: jot a thought down now,
 * decide what to do with it later. Items sit in `inbox_items` until promoted
 * into a real task (via useTaskStore) or discarded.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, store/useTaskStore (add() only, for promoteToTask)
 *   Used by → app/capture.tsx, components/InboxSection.tsx (via app/index.tsx)
 *   Data    → defines a Zustand store; owns SQLite table inbox_items
 *
 * Edit notes:
 *   - load() fetches everything (capture volume is low; no pagination needed).
 *   - promoteToTask() is additive: it adds the new task first, then removes the
 *     inbox row — never the reverse, so a crash mid-promotion can't lose the capture.
 *   - promoteToTask's taskFields is typed `TaskInput` (useTaskStore's add() param) —
 *     the old app declared `Omit<Task,'id'|'steps'>`, but this repo's add() already
 *     exposes the canonical input shape, so it's reused directly (matches the
 *     Decision 015 stub this replaces, which InboxSection already compiles against).
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, loadAll, loadFirst, insertRow, updateRow, readStr } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { useTaskStore, TaskInput } from '@/store/useTaskStore';

export type InboxItem = {
  id: string;
  text: string;
  createdAt: string;
};

type InboxStore = {
  items: InboxItem[];
  load: () => void;
  add: (text: string) => InboxItem;
  update: (id: string, text: string) => void;
  remove: (id: string) => void;
  promoteToTask: (id: string, taskFields: TaskInput) => void;
};

function rowToItem(row: Row): InboxItem {
  return {
    id: readStr(row, 'id'),
    text: readStr(row, 'text'),
    createdAt: readStr(row, 'created_at'),
  };
}

export const useInboxStore = create<InboxStore>((set, get) => ({
  items: [],

  load() {
    set({ items: loadAll('inbox_items', rowToItem, { orderBy: 'created_at DESC' }) });
  },

  add(text) {
    const id = generateId();
    insertRow('inbox_items', { id, text });
    const created =
      loadFirst('inbox_items', rowToItem, { where: 'id = ?', params: [id] }) ??
      { id, text, createdAt: new Date().toISOString() };
    set((s) => ({ items: [created, ...s.items] }));
    return created;
  },

  update(id, text) {
    updateRow('inbox_items', { text }, 'id = ?', [id]);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, text } : i)) }));
  },

  remove(id) {
    db.runSync('DELETE FROM inbox_items WHERE id = ?', [id]);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  promoteToTask(id, taskFields) {
    useTaskStore.getState().add(taskFields);
    get().remove(id);
  },
}));
