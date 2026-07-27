/**
 * viewSnapshot.ts — what a surface was actually SHOWING the last time its view was saved.
 *
 * This is the memory behind the "what was this view hiding from me" glow. When the user
 * saves a view (picks a layout), we record two things about that moment: which rows were on
 * screen, and which fields those rows were drawing. Switching to another layout then diffs
 * against that record — anything visible now that the saved view was hiding is glowed.
 *
 * **The glow is about VISIBILITY, not novelty.** A row that says "19" and glows is not new
 * data; the user has used it before and knows that. It glows because the view they just came
 * from wasn't showing it. That is why this stores a set of ids rather than a timestamp: a
 * timestamp can only ever answer "what was created recently", which is a different question
 * and the wrong one here — it is blind to a row that has existed for months and was simply
 * collapsed behind "Now and next".
 *
 * Connections:
 *   Imports → lib/db (the shared handle), lib/dataAccess (logDbError)
 *   Used by → lib/useNewSinceSeen.ts, lib/__tests__/viewSnapshot.test.ts
 *   Data    → SQLite `app_meta` rows keyed `view:<surface>` (the same key-value table
 *             store/useCatalogStore.ts uses for its seed version). No new table.
 *
 * Edit notes:
 *   - **Device-local by design.** lib/syncService.ts only broadcasts tables in its
 *     `SyncTable` union and `app_meta` is not one, so "what my screen was showing" never
 *     travels between paired devices. That matters in People/family mode: two people on two
 *     phones must not clear each other's glows. Do not add `app_meta` to `SyncTable`.
 *   - A missing snapshot ('' / null) means "this surface has never had a view saved". The
 *     hook treats that as glow-nothing-and-record — a first visit must not light up every
 *     row on screen, which would be noise rather than information.
 *   - Field visibility is stored as the resolved LayoutSpec's booleans rather than the
 *     layout id, so renaming or retuning a layout can't silently invert an old snapshot's
 *     meaning. The id is kept alongside for debugging only — never compared.
 *   - Every function swallows DB errors into a safe default. A glow is a display nicety; it
 *     must never throw inside a render pass or block a screen.
 */
import db from '@/lib/db';
import { logDbError } from '@/lib/dataAccess';

const KEY_PREFIX = 'view:';

/** Which fields a layout was drawing. Mirrors the subset of LayoutSpec the rows react to. */
export type FieldVisibility = {
  meta: boolean;
  price: boolean;
  extras: boolean;
};

export type ViewSnapshot = {
  /** Layout id at save time. Debugging aid only — never used in a comparison. */
  layout: string;
  /** Ids of the rows that were on screen. */
  ids: string[];
  fields: FieldVisibility;
};

/** Which fields are visible NOW that the saved view was not drawing. */
export type NewlyVisibleFields = FieldVisibility;

export const NO_NEW_FIELDS: NewlyVisibleFields = { meta: false, price: false, extras: false };

/** Read a surface's saved view, or null if it has never had one. */
export function getSnapshot(surface: string): ViewSnapshot | null {
  try {
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [
      `${KEY_PREFIX}${surface}`,
    ]);
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as unknown;
    return normalizeSnapshot(parsed);
  } catch (e) {
    // A corrupt/partial JSON blob must degrade to "no saved view", not crash the screen.
    logDbError(`viewSnapshot.getSnapshot(${surface})`, e);
    return null;
  }
}

/** Overwrite a surface's saved view with what is on screen right now. */
export function setSnapshot(surface: string, snapshot: ViewSnapshot): void {
  try {
    db.runSync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [
      `${KEY_PREFIX}${surface}`,
      JSON.stringify(snapshot),
    ]);
  } catch (e) {
    logDbError(`viewSnapshot.setSnapshot(${surface})`, e);
  }
}

/** Test/reset seam — drops a surface's saved view so the next visit re-records it. */
export function clearSnapshot(surface: string): void {
  try {
    db.runSync('DELETE FROM app_meta WHERE key = ?', [`${KEY_PREFIX}${surface}`]);
  } catch (e) {
    logDbError(`viewSnapshot.clearSnapshot(${surface})`, e);
  }
}

/** Coerce an untrusted parsed blob into a usable snapshot, or null if it isn't one. */
export function normalizeSnapshot(raw: unknown): ViewSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.ids)) return null;
  const ids = obj.ids.filter((id): id is string => typeof id === 'string');
  const f = (obj.fields ?? {}) as Record<string, unknown>;
  return {
    layout: typeof obj.layout === 'string' ? obj.layout : '',
    ids,
    fields: {
      meta: f.meta === true,
      price: f.price === true,
      extras: f.extras === true,
    },
  };
}

/**
 * Rows on screen now that the saved view was not showing.
 *
 * Pure — the caller supplies the snapshot, so this is trivially testable and safe to call
 * from a render pass without touching the database.
 */
export function newlyVisibleIds(visibleIds: readonly string[], snapshot: ViewSnapshot | null): string[] {
  // No saved view yet: nothing is "newly" visible, because there is no earlier view to
  // have hidden it. Glowing everything on a first visit would be noise.
  if (!snapshot) return [];
  const before = new Set(snapshot.ids);
  return visibleIds.filter((id) => !before.has(id));
}

/**
 * Fields drawn now that the saved view was not drawing.
 *
 * Only ever reports a false→true transition. Going from "Show everything" to "Just the
 * basics" hides fields, and a hidden field has nothing to glow — the glow marks what
 * appeared, never what left.
 */
export function newlyVisibleFields(
  current: FieldVisibility,
  snapshot: ViewSnapshot | null
): NewlyVisibleFields {
  if (!snapshot) return NO_NEW_FIELDS;
  return {
    meta: current.meta && !snapshot.fields.meta,
    price: current.price && !snapshot.fields.price,
    extras: current.extras && !snapshot.fields.extras,
  };
}

/** True when nothing at all became newly visible — lets callers skip the glow entirely. */
export function hasNoNewFields(fields: NewlyVisibleFields): boolean {
  return !fields.meta && !fields.price && !fields.extras;
}
