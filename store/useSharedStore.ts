/**
 * useSharedStore.ts — tasks / shopping items shared between users (in & out)
 *
 * Zustand store for items exchanged via the share/scan QR flow: both inbound
 * (received) and outbound (sent) shared tasks and shopping items, tracked with a
 * `direction` and the sender's name. Backs the shared screen and share modal.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id
 *   Used by → app/share-modal.tsx, app/shared.tsx, app/(tabs)/index.tsx (Home preview via
 *             components/HomeSharedCard.tsx), components/SharedRequestsSection.tsx,
 *             components/SharedTasksSection.tsx (Tasks screen merged Shared section),
 *             app/(tabs)/scan.tsx (QR import writes addShared*)
 *   Data    → defines a Zustand store; owns SQLite tables shared_tasks and shared_shopping_items
 *
 * Edit notes:
 *   - `direction` ('in'|'out') is the key distinction — the same table holds both sent and received rows; source_task_id/source_item_id link back to the local origin (may be null).
 *   - addShared* INSERTs are wrapped in try/catch: a constraint violation (PK clash
 *     on `id`) is skipped silently as an expected duplicate, but any other error is
 *     surfaced via logDbError instead of being swallowed — see isConstraintError in
 *     lib/dataAccess.ts. These rows are append-only and pruned past RETENTION_DAYS
 *     in lib/db.ts.
 *   - rowToTask/rowToShopping read `direction` via readEnum (falls back to 'in' on an
 *     unexpected value) instead of an unchecked `as SharedDirection` cast.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - Widens the Decision 015 stub (adds sourceTaskId/sourceItemId/date/createdAt +
 *     load/addSharedTasks/addSharedShopping actions) — additive, so SharedRequestsSection
 *     (which only reads shoppingItems/tasks + the toggle/remove actions) keeps compiling.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, loadAll, insertRow, updateRow, readStr, readBool, readEnum, logDbError, isConstraintError } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';

export type SharedDirection = 'in' | 'out';

export type SharedTask = {
  id: string;
  sourceTaskId: string | null;
  title: string;
  date: string;
  done: boolean;
  direction: SharedDirection;
  sharedBy: string;
  createdAt: string;
};

export type SharedShoppingItem = {
  id: string;
  sourceItemId: string | null;
  name: string;
  amount: string;
  unit: string;
  done: boolean;
  direction: SharedDirection;
  sharedBy: string;
  createdAt: string;
};

type SharedStore = {
  tasks: SharedTask[];
  shoppingItems: SharedShoppingItem[];
  load: () => void;
  addSharedTasks: (items: Omit<SharedTask, 'id' | 'createdAt' | 'done'>[]) => void;
  addSharedShopping: (items: Omit<SharedShoppingItem, 'id' | 'createdAt' | 'done'>[]) => void;
  toggleTask: (id: string) => void;
  toggleShopping: (id: string) => void;
  removeTask: (id: string) => void;
  removeShopping: (id: string) => void;
};

function rowToTask(row: Row): SharedTask {
  return {
    id: readStr(row, 'id'),
    sourceTaskId: readStr(row, 'source_task_id') || null,
    title: readStr(row, 'title'),
    date: readStr(row, 'date'),
    done: readBool(row, 'done'),
    direction: readEnum<SharedDirection>(row, 'direction', ['in', 'out'], 'in'),
    sharedBy: readStr(row, 'shared_by'),
    createdAt: readStr(row, 'created_at'),
  };
}

function rowToShopping(row: Row): SharedShoppingItem {
  return {
    id: readStr(row, 'id'),
    sourceItemId: readStr(row, 'source_item_id') || null,
    name: readStr(row, 'name'),
    amount: readStr(row, 'amount') || '1',
    unit: readStr(row, 'unit'),
    done: readBool(row, 'done'),
    direction: readEnum<SharedDirection>(row, 'direction', ['in', 'out'], 'in'),
    sharedBy: readStr(row, 'shared_by'),
    createdAt: readStr(row, 'created_at'),
  };
}

export const useSharedStore = create<SharedStore>((set, get) => ({
  tasks: [],
  shoppingItems: [],

  load() {
    set({
      tasks: loadAll('shared_tasks', rowToTask, { orderBy: 'created_at DESC' }),
      shoppingItems: loadAll('shared_shopping_items', rowToShopping, { orderBy: 'created_at DESC' }),
    });
  },

  addSharedTasks(items) {
    const now = new Date().toISOString();
    const newItems: SharedTask[] = [];
    for (const item of items) {
      const id = generateId();
      try {
        insertRow('shared_tasks', {
          id,
          source_task_id: item.sourceTaskId ?? null,
          title: item.title,
          date: item.date,
          done: 0,
          direction: item.direction,
          shared_by: item.sharedBy,
          created_at: now,
        });
        newItems.push({ ...item, id, done: false, createdAt: now });
      } catch (e) {
        if (!isConstraintError(e)) logDbError(`addSharedTasks insert(${id})`, e);
      }
    }
    set((s) => ({ tasks: [...newItems, ...s.tasks] }));
  },

  addSharedShopping(items) {
    const now = new Date().toISOString();
    const newItems: SharedShoppingItem[] = [];
    for (const item of items) {
      const id = generateId();
      try {
        insertRow('shared_shopping_items', {
          id,
          source_item_id: item.sourceItemId ?? null,
          name: item.name,
          amount: item.amount,
          unit: item.unit,
          done: 0,
          direction: item.direction,
          shared_by: item.sharedBy,
          created_at: now,
        });
        newItems.push({ ...item, id, done: false, createdAt: now });
      } catch (e) {
        if (!isConstraintError(e)) logDbError(`addSharedShopping insert(${id})`, e);
      }
    }
    set((s) => ({ shoppingItems: [...newItems, ...s.shoppingItems] }));
  },

  toggleTask(id) {
    const item = get().tasks.find((t) => t.id === id);
    if (!item) return;
    const done = !item.done;
    updateRow('shared_tasks', { done: done ? 1 : 0 }, 'id = ?', [id]);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done } : t)) }));
  },

  toggleShopping(id) {
    const item = get().shoppingItems.find((i) => i.id === id);
    if (!item) return;
    const done = !item.done;
    updateRow('shared_shopping_items', { done: done ? 1 : 0 }, 'id = ?', [id]);
    set((s) => ({ shoppingItems: s.shoppingItems.map((i) => (i.id === id ? { ...i, done } : i)) }));
  },

  removeTask(id) {
    db.runSync('DELETE FROM shared_tasks WHERE id = ?', [id]);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  removeShopping(id) {
    db.runSync('DELETE FROM shared_shopping_items WHERE id = ?', [id]);
    set((s) => ({ shoppingItems: s.shoppingItems.filter((i) => i.id !== id) }));
  },
}));
