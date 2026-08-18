/**
 * usePeopleStore.ts — the People registry (2026-07-28, to-do sharing phase 1).
 *
 * Zustand store over the `people` SQLite table: one row per person in the household,
 * each with a STABLE ID, an identity colour (lib/personColor.ts) and their own Energy
 * capacity. Replaces `settings.childProfiles` — a plain `string[]` of names that could
 * neither survive a rename (every `tasks.assignee` pointing at the old string was
 * silently orphaned) nor mean the same person on two paired phones.
 *
 * Rows are SYNCED (lib/liveSync.ts's `SyncTable`), so pairing two devices gives both
 * the same household roster. A person whose `deviceId` is '' is tracked only on THIS
 * phone — a child, or a partner whose phone can't run the app — which is what lets a
 * balance view mark their figures as hand-kept rather than live.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/storeCrud (the guarded by-id update),
 *             lib/id, lib/personColor, lib/liveSync,
 *             lib/syncService, lib/syncRow (syncRow — the shared stamp+broadcast pair),
 *             store/useSettingsStore (back-fill source + deviceId),
 *             store/useTaskStore (link cleanup on remove — call-time only)
 *   Used by → app/_layout.tsx (load() in the app-wide bootstrap), app/settings.tsx
 *             (the People card), app/plans.tsx + app/habits.tsx (person
 *             filters), components/TaskCard.tsx, components/MedicineTrayCard.tsx,
 *             app/habit-form.tsx, app/medicine-form.tsx (person pickers)
 *   Data    → owns reads/writes of the `people` table; back-fills `tasks.assignee_id`
 *             once, and nulls it on remove
 *
 * Edit notes:
 *   - **`load()` must run AFTER `useSettingsStore.load()`** — the one-shot back-fill
 *     reads `userName`/`childProfiles`/`energy*Capacity` off the settings store, and a
 *     back-fill against an unhydrated store would create a nameless self row and then
 *     mark itself done. app/_layout.tsx's bootstrap already orders it that way.
 *   - The back-fill is gated on an `app_meta` row (same one-shot pattern as
 *     store/useCatalogStore.ts's seed-version gate) and is written DEFENSIVELY: a
 *     profile name that no longer matches any task is skipped, not thrown on, because
 *     it can never be re-run once the gate is set.
 *   - `settings.childProfiles` is deliberately left in place and untouched. This repo
 *     never drops columns, and keeping it readable means a bad back-fill stays
 *     diagnosable from a backup. Nothing should READ it for person UI any more.
 *   - Every mutation goes through `syncPersonRow`/`softDelete` — a raw `updateRow` here
 *     would change local state without the peer ever hearing about it. `syncPersonRow` is
 *     a one-line wrapper naming this store's table; the stamp+broadcast body it used to
 *     hold is shared in lib/syncRow.ts — read that file before changing either half.
 *   - **Only edit your OWN capacity.** LWW can't tell "I corrected my number" from "I
 *     overwrote yours", so the guard is at the affordance (the UI only offers the
 *     control on the self row), the same reasoning as lib/liveSync.ts's `directed` note.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import {
  Row,
  FieldMap,
  loadAll,
  insertRow,
  rowValues,
  readStr,
  readInt,
  readBool,
  logDbError,
  tx,
} from '@/lib/dataAccess';
import { replaceById, updateById } from '@/lib/storeCrud';
import { generateId } from '@/lib/id';
import { paletteColorAt } from '@/lib/personColor';
import { softDelete } from '@/lib/liveSync';
import { broadcastRow } from '@/lib/syncService';
import { syncRow } from '@/lib/syncRow';
import { useSettingsStore } from '@/store/useSettingsStore';
// Link cleanup only, used inside remove() at call time — never at module-eval time.
import { useTaskStore } from '@/store/useTaskStore';

/** One-shot gate for the childProfiles → people migration (see migrateFromChildProfiles). */
const BACKFILL_META_KEY = 'people_backfill_version';
const BACKFILL_VERSION = '1';

export type Person = {
  id: string;
  name: string;
  /** Identity hue (hex), auto-assigned from PERSON_PALETTE. See lib/personColor.ts. */
  color: string;
  /**
   * The paired `peers.device_id` this person uses, or '' when they're tracked only on
   * this phone. Drives the "live vs hand-kept" distinction in the balance view.
   */
  deviceId: string;
  /** True for the row representing this device's owner. Exactly one row should have it. */
  isSelf: boolean;
  /** This person's OWN daily Energy capacity — their answer, not anyone else's. */
  dailyCapacity: number;
  /** This person's OWN weekly Energy capacity. */
  weeklyCapacity: number;
  sortOrder: number;
  createdAt: string;
};

type PeopleStore = {
  loaded: boolean;
  people: Person[];
  load: () => void;
  /** Create a person by name; auto-assigns the next palette colour and returns the row. */
  add: (name: string) => Person;
  /** Patch a person. Capacity fields should only ever be patched on the self row. */
  update: (id: string, patch: Partial<Omit<Person, 'id' | 'createdAt'>>) => void;
  remove: (id: string) => void;
  /** The row for this device's owner, or null before the back-fill has run. */
  self: () => Person | null;
  /** Look up by id; '' (unassigned / me) resolves to the self row. */
  byId: (id: string) => Person | null;
  /** Publish this device's own Energy capacity onto the self row so peers can read it. */
  publishSelfCapacity: (dailyCapacity: number, weeklyCapacity: number) => void;
  /** Keep the self row's name in step with `settings.userName` (see the edit note). */
  publishSelfName: (name: string) => void;
};

function rowToPerson(row: Row): Person {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    color: readStr(row, 'color'),
    deviceId: readStr(row, 'device_id'),
    isSelf: readBool(row, 'is_self'),
    dailyCapacity: readInt(row, 'daily_capacity', 10),
    weeklyCapacity: readInt(row, 'weekly_capacity', 50),
    sortOrder: readInt(row, 'sort_order'),
    createdAt: readStr(row, 'created_at'),
  };
}

const PERSON_COLUMNS: FieldMap<Person> = {
  id: { col: 'id' },
  name: { col: 'name', to: (v) => v ?? '' },
  color: { col: 'color', to: (v) => v ?? '' },
  deviceId: { col: 'device_id', to: (v) => v ?? '' },
  isSelf: { col: 'is_self', to: (v) => (v ? 1 : 0) },
  dailyCapacity: { col: 'daily_capacity', to: (v) => v ?? 10 },
  weeklyCapacity: { col: 'weekly_capacity', to: (v) => v ?? 50 },
  sortOrder: { col: 'sort_order', to: (v) => v ?? 0 },
  createdAt: { col: 'created_at' },
};

/** Stamp a local edit and push it to every connected peer. */
function syncPersonRow(id: string): void {
  syncRow('people', id);
}

function backfillDone(): boolean {
  try {
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [
      BACKFILL_META_KEY,
    ]);
    return row?.value === BACKFILL_VERSION;
  } catch {
    // No app_meta row readable — treat as "not done" so the back-fill can still try. It
    // inserts nothing when there is nothing to migrate, so a retry is harmless.
    return false;
  }
}

/**
 * One-shot migration from `settings.childProfiles` + `settings.userName` into real rows,
 * plus a back-fill of `tasks.assignee_id` from the old free-text `tasks.assignee` names.
 *
 * Done in JS rather than SQL because `child_profiles` is a JSON array in a TEXT column,
 * and because it has to reach the settings store's already-parsed values. Runs inside one
 * transaction so a crash midway leaves the gate unset and the whole thing retryable.
 */
function migrateFromChildProfiles(): void {
  if (backfillDone()) return;
  const settings = useSettingsStore.getState();
  const now = new Date().toISOString();
  const deviceId = settings.deviceId;

  try {
    tx(() => {
      // Someone may already exist if a paired peer synced their roster to us before this
      // device ran its own back-fill — never create a second self row on top of that.
      const existing = db.getAllSync('SELECT id, name, is_self FROM people') as {
        id: string;
        name: string;
        is_self: number;
      }[];
      const hasSelf = existing.some((r) => r.is_self === 1);
      const byName = new Map(existing.map((r) => [r.name, r.id]));
      let slot = existing.length;

      const insert = (name: string, isSelf: boolean): string => {
        const id = generateId();
        insertRow(
          'people',
          rowValues(
            {
              id,
              name,
              color: paletteColorAt(slot),
              // Only the self row is tied to a device; everyone else starts hand-kept
              // until they pair (app/pair-device.tsx links them).
              deviceId: isSelf ? deviceId : '',
              isSelf,
              dailyCapacity: isSelf ? settings.energyDailyCapacity : 10,
              weeklyCapacity: isSelf ? settings.energyWeeklyCapacity : 50,
              sortOrder: slot,
              createdAt: now,
            } as Person,
            PERSON_COLUMNS
          )
        );
        // Stamp it so it syncs like any other local write. Broadcasting is left to load()'s
        // caller — nothing is connected this early in the bootstrap anyway.
        db.runSync('UPDATE people SET updated_at = ?, origin_device_id = ? WHERE id = ?', [
          now,
          deviceId,
          id,
        ]);
        slot += 1;
        byName.set(name, id);
        return id;
      };

      if (!hasSelf) {
        const selfId = insert(settings.userName.trim(), true);
        // Pre-existing rows all meant "me" — `assignee` '' was the self convention.
        db.runSync("UPDATE tasks SET assignee_id = ? WHERE assignee = '' OR assignee IS NULL", [
          selfId,
        ]);
      }

      for (const name of settings.childProfiles) {
        const trimmed = name.trim();
        // Skip blanks and anything a synced peer already gave us a row for. Defensive by
        // design: this can never be re-run, so it must never throw on odd data.
        if (!trimmed || byName.has(trimmed)) continue;
        const id = insert(trimmed, false);
        db.runSync('UPDATE tasks SET assignee_id = ? WHERE assignee = ?', [id, trimmed]);
      }

      db.runSync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [
        BACKFILL_META_KEY,
        BACKFILL_VERSION,
      ]);
    });
  } catch (e) {
    // Leave the gate unset so the next launch retries rather than stranding the roster.
    logDbError('people back-fill', e);
  }
}

export const usePeopleStore = create<PeopleStore>((set, get) => ({
  loaded: false,
  people: [],

  load() {
    migrateFromChildProfiles();
    set({
      people: loadAll('people', rowToPerson, {
        orderBy: 'is_self DESC, sort_order, created_at',
        where: 'deleted_at IS NULL',
      }),
      loaded: true,
    });
    // Self-heal the self row's name. On a FRESH install this store loads during the app
    // bootstrap, which happens before onboarding has asked the user their name — so the
    // self row is necessarily created nameless and `publishSelfName` (called from the
    // onboarding + Settings name fields) is what fills it in. This catches the paths that
    // don't go through either: the Explore onboarding route skips the name step entirely,
    // and a restored backup brings a userName with no matching person row.
    const { userName } = useSettingsStore.getState();
    if (userName.trim() && !get().self()?.name) get().publishSelfName(userName);
  },

  add(name) {
    const people = get().people;
    const person: Person = {
      id: generateId(),
      name: name.trim(),
      color: paletteColorAt(people.length),
      deviceId: '',
      isSelf: false,
      dailyCapacity: 10,
      weeklyCapacity: 50,
      sortOrder: people.length,
      createdAt: new Date().toISOString(),
    };
    insertRow('people', rowValues(person, PERSON_COLUMNS));
    set((s) => ({ people: [...s.people, person] }));
    syncPersonRow(person.id);
    return person;
  },

  update(id, patch) {
    const next = updateById('people', PERSON_COLUMNS, get().people, id, patch as Partial<Person>);
    if (!next) return;
    set((s) => ({ people: replaceById(s.people, next) }));
    syncPersonRow(id);
  },

  remove(id) {
    const person = get().people.find((p) => p.id === id);
    // The self row is this device's own identity — removing it would leave every task
    // assigned to nobody and the back-fill unable to recreate it (its gate is set).
    if (!person || person.isSelf) return;
    tx(() => {
      softDelete('people', id, useSettingsStore.getState().deviceId);
      // App-enforced ON DELETE SET DEFAULT: their tasks come back to the household rather
      // than disappearing, matching the existing "their tasks move back to you" promise.
      db.runSync("UPDATE tasks SET assignee_id = '', assignee = '' WHERE assignee_id = ?", [id]);
    });
    set((s) => ({ people: s.people.filter((p) => p.id !== id) }));
    broadcastRow('people', id);
    // Clear the now-dangling id from the task store's in-memory state (the column was
    // cleared in the tx above). Call-time use — see the import note at the top of the file.
    useTaskStore.getState().clearPerson(id);
  },

  self() {
    return get().people.find((p) => p.isSelf) ?? null;
  },

  byId(id) {
    const { people } = get();
    if (!id) return people.find((p) => p.isSelf) ?? null;
    return people.find((p) => p.id === id) ?? null;
  },

  publishSelfCapacity(dailyCapacity, weeklyCapacity) {
    const person = get().self();
    if (!person) return;
    if (person.dailyCapacity === dailyCapacity && person.weeklyCapacity === weeklyCapacity) return;
    get().update(person.id, { dailyCapacity, weeklyCapacity });
  },

  publishSelfName(name) {
    const person = get().self();
    const trimmed = name.trim();
    if (!person || !trimmed || person.name === trimmed) return;
    get().update(person.id, { name: trimmed });
  },
}));
