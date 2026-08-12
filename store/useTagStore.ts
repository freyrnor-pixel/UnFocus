/**
 * useTagStore.ts — the shared tag vocabulary (2026-07-28, to-do sharing phase 2).
 *
 * Zustand store over the `tags` SQLite table: one row per tag, with a stable id and a
 * name. Tags answer "what kind of thing is this" the way store/usePeopleStore.ts answers
 * "who is this for" — and for the same reason they are ROWS, not free text on the task:
 * a tag typed on one phone has to mean the same tag on the other, and renaming it has to
 * follow every task that carries it instead of orphaning them.
 *
 * Rows are SYNCED (lib/liveSync.ts's `SyncTable`), so a paired household shares one
 * vocabulary. Membership itself lives on the task (`tasks.tag_ids`) — see lib/db.ts's
 * migration for why that is a column and not a join table.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/tags, lib/liveSync, lib/syncService,
 *             lib/syncRow (syncRow — the shared stamp+broadcast pair),
 *             store/useSettingsStore (deviceId), store/useTaskStore (link cleanup on
 *             remove — call-time only, never at module-eval time)
 *   Used by → app/_layout.tsx (load() in the app-wide bootstrap), app/task-form via
 *             components/TagPickerRow.tsx, app/(tabs)/plans.tsx (tag filter row),
 *             components/TaskCard.tsx, app/settings.tsx (rename/delete)
 *   Data    → owns reads/writes of the `tags` table; clears deleted ids out of
 *             `tasks.tag_ids`
 *
 * Edit notes:
 *   - Every mutation goes through `syncTagRow`/`softDelete`. A raw `updateRow` here
 *     changes local state without the peer ever hearing about it. `syncTagRow` is a
 *     one-line wrapper naming this store's table; the stamp+broadcast body it used to
 *     hold is shared in lib/syncRow.ts — read that file before changing either half.
 *   - **`ensure()` is the only way the UI should create a tag.** It matches on
 *     `tagNameKey` first, so typing "kitchen" when "Kitchen" exists reuses the existing
 *     row rather than creating a near-duplicate the other phone would show twice.
 *   - Removing a tag rewrites `tasks.tag_ids` for every task carrying it, in the same
 *     transaction as the tombstone. Those task rows are then re-broadcast individually —
 *     a peer that only heard the tag's tombstone would keep the id in its own column and
 *     re-introduce it on the next task edit.
 *   - There is no colour field, deliberately — see lib/tags.ts's header for the
 *     four-channels-already rule.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import {
  Row,
  FieldMap,
  loadAll,
  insertRow,
  updateRow,
  rowValues,
  readStr,
  readInt,
  logDbError,
  tx,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { findTagByName, normalizeTagName, parseTagIds, serializeTagIds } from '@/lib/tags';
import { touchRow, softDelete } from '@/lib/liveSync';
import { broadcastRow } from '@/lib/syncService';
import { syncRow } from '@/lib/syncRow';
import { useSettingsStore } from '@/store/useSettingsStore';
// Link cleanup only, used inside remove() at call time — never at module-eval time.
import { useTaskStore } from '@/store/useTaskStore';

export type Tag = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

type TagStore = {
  loaded: boolean;
  tags: Tag[];
  load: () => void;
  /** Find-or-create by name (case/spacing-insensitive). The only creation path the UI uses. */
  ensure: (name: string) => Tag | null;
  /** Rename. Every task keeps its id, so the new name follows them automatically. */
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  byId: (id: string) => Tag | null;
};

function rowToTag(row: Row): Tag {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    sortOrder: readInt(row, 'sort_order'),
    createdAt: readStr(row, 'created_at'),
  };
}

const TAG_COLUMNS: FieldMap<Tag> = {
  id: { col: 'id' },
  name: { col: 'name', to: (v) => v ?? '' },
  sortOrder: { col: 'sort_order', to: (v) => v ?? 0 },
  createdAt: { col: 'created_at' },
};

/** Stamp a local edit and push it to every connected peer. */
function syncTagRow(id: string): void {
  syncRow('tags', id);
}

export const useTagStore = create<TagStore>((set, get) => ({
  loaded: false,
  tags: [],

  load() {
    set({
      tags: loadAll('tags', rowToTag, {
        orderBy: 'sort_order, created_at',
        where: 'deleted_at IS NULL',
      }),
      loaded: true,
    });
  },

  ensure(name) {
    const clean = normalizeTagName(name);
    if (!clean) return null;
    const existing = findTagByName(get().tags, clean);
    if (existing) return existing;
    const tag: Tag = {
      id: generateId(),
      name: clean,
      sortOrder: get().tags.length,
      createdAt: new Date().toISOString(),
    };
    insertRow('tags', rowValues(tag, TAG_COLUMNS));
    set((s) => ({ tags: [...s.tags, tag] }));
    syncTagRow(tag.id);
    return tag;
  },

  rename(id, name) {
    const clean = normalizeTagName(name);
    const tag = get().tags.find((t) => t.id === id);
    if (!tag || !clean || tag.name === clean) return;
    // Renaming onto a name that already exists would give the household two rows that
    // read identically — and no way to tell which one a task carries. Refuse instead;
    // merging two tags is a different, destructive operation and isn't offered.
    if (findTagByName(get().tags.filter((t) => t.id !== id), clean)) return;
    updateRow('tags', rowValues({ name: clean }, TAG_COLUMNS), 'id = ?', [id]);
    set((s) => ({ tags: s.tags.map((t) => (t.id === id ? { ...t, name: clean } : t)) }));
    syncTagRow(id);
  },

  remove(id) {
    const tag = get().tags.find((t) => t.id === id);
    if (!tag) return;
    // Tasks whose tag_ids mention this tag, collected BEFORE the tombstone so they can be
    // re-broadcast afterwards. LIKE with the separators padded avoids matching an id that
    // merely contains this one as a substring.
    let affected: { id: string; tag_ids: string }[] = [];
    try {
      affected = db.getAllSync<{ id: string; tag_ids: string }>(
        "SELECT id, tag_ids FROM tasks WHERE ',' || tag_ids || ',' LIKE ?",
        [`%,${id},%`],
      );
    } catch (e) {
      logDbError('tags remove: collect tasks', e);
    }
    tx(() => {
      softDelete('tags', id, useSettingsStore.getState().deviceId);
      for (const row of affected) {
        const next = serializeTagIds(parseTagIds(row.tag_ids).filter((t) => t !== id));
        db.runSync('UPDATE tasks SET tag_ids = ? WHERE id = ?', [next, row.id]);
      }
    });
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
    broadcastRow('tags', id);
    // Mirror the column change into the task store's in-memory state, and push each
    // rewritten task to peers — see the edit note on why the tombstone alone isn't enough.
    useTaskStore.getState().clearTag(id);
    for (const row of affected) broadcastRow('tasks', row.id);
  },

  byId(id) {
    return get().tags.find((t) => t.id === id) ?? null;
  },
}));
