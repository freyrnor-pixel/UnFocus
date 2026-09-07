/**
 * tags.ts — pure helpers for the shared tag vocabulary (2026-07-28, sharing phase 2).
 *
 * Phase 1 gave the household a shared answer to "who is this for" (store/usePeopleStore.ts).
 * Tags answer the other half — "what kind of thing is this" — with the same requirement:
 * both phones must resolve a tag to the same word, so tags are rows with stable ids
 * (store/useTagStore.ts) rather than free text repeated on every task.
 *
 * Membership is stored on the task as a comma-separated id list (`tasks.tag_ids`), so
 * everything here is string ↔ id-array plumbing plus the name-matching rules that keep
 * two people from ending up with "Kitchen" and "kitchen" as separate tags.
 *
 * Connections:
 *   Imports → nothing (deliberately dependency-free — see the edit note)
 *   Used by → store/useTagStore.ts, store/useTaskStore.ts (tag_ids read/write),
 *             components/TagChip.tsx, components/TagPickerRow.tsx,
 *             app/(tabs)/plans.tsx (tag filter), lib/__tests__/tags.test.ts
 *   Data    → none (pure functions over values the caller already has)
 *
 * Edit notes:
 *   - **A tag has no colour, on purpose.** A task row can already carry a domain hue on
 *     its border (lib/domainColor.ts), a done/overdue status rail, a person dot
 *     (lib/personColor.ts) and a goal glow dot — four channels. A fifth would stop being
 *     information and start being noise, so a tag is drawn as a neutral outlined pill and
 *     is told apart by its WORD. If you ever add colour here, take one of the other four
 *     away first.
 *   - **Keep this file dependency-free.** Same rule as lib/cardLayout.ts: it's imported by
 *     a store, a component and a screen, and staying pure is what makes it testable
 *     without a DB. Pass state in rather than reaching for a store.
 *   - `parseTagIds` is deliberately total — it never throws and never returns a duplicate.
 *     It parses a column that syncs from another device, so it has to survive whatever an
 *     older or newer build wrote into it.
 *   - Unknown ids are dropped at RESOLVE time, not at parse time. A tag row can legitimately
 *     arrive after the task that references it (deltas are per-row and unordered), so
 *     forgetting the id on parse would silently untag the task; keeping it means the tag
 *     re-appears by itself once its row lands.
 */

/** The one separator `tasks.tag_ids` uses. Ids are generated alphanumerics, so this is safe. */
const SEPARATOR = ',';

/**
 * Read a `tasks.tag_ids` column into ids. Total by design: blank, whitespace-only,
 * duplicated and stray-separator input all collapse to a clean list.
 */
export function parseTagIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of String(raw).split(SEPARATOR)) {
    const id = part.trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Write ids back to the column form, de-duplicated and blank-free. */
export function serializeTagIds(ids: readonly string[]): string {
  const seen: string[] = [];
  for (const raw of ids) {
    const id = (raw ?? '').trim();
    if (id && !seen.includes(id)) seen.push(id);
  }
  return seen.join(SEPARATOR);
}

/** Add the id if absent, remove it if present. Order of the survivors is preserved. */
export function toggleTagId(ids: readonly string[], id: string): string[] {
  const current = parseTagIds(ids.join(SEPARATOR));
  const target = id.trim();
  if (!target) return current;
  return current.includes(target) ? current.filter((x) => x !== target) : [...current, target];
}

/** Display form of a typed tag name: trimmed, with runs of whitespace collapsed to one space. */
export function normalizeTagName(name: string): string {
  return (name ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Matching form of a tag name. Case- and spacing-insensitive so "Kitchen", "kitchen" and
 * " Kitchen " are one tag — two people tagging the same chore shouldn't produce three rows.
 */
export function tagNameKey(name: string): string {
  return normalizeTagName(name).toLocaleLowerCase();
}

/** The existing tag whose name matches `name`, ignoring case/spacing, or null. */
export function findTagByName<T extends { name: string }>(
  tags: readonly T[],
  name: string,
): T | null {
  const key = tagNameKey(name);
  if (!key) return null;
  return tags.find((t) => tagNameKey(t.name) === key) ?? null;
}

/**
 * Resolve a task's ids to real tag rows, in the order the tags themselves are sorted
 * (not the order they were added to the task) so the same set always renders identically
 * on both phones. Ids with no row yet are dropped — see the edit note.
 */
export function resolveTags<T extends { id: string }>(
  ids: readonly string[],
  tags: readonly T[],
): T[] {
  if (!ids.length) return [];
  const wanted = new Set(ids);
  return tags.filter((t) => wanted.has(t.id));
}

/**
 * Does a task pass the active tag filter? "Any of", not "all of": filter chips that
 * intersect collapse to an empty list as soon as a second chip is tapped, which reads as
 * a broken filter rather than a narrower one. An empty filter matches everything.
 */
export function matchesTagFilter(
  taskTagIds: readonly string[],
  filterIds: readonly string[],
): boolean {
  if (!filterIds.length) return true;
  return taskTagIds.some((id) => filterIds.includes(id));
}

/**
 * Tag ids that no longer resolve to a row, for the caller that wants to clean a task up.
 * Kept separate from `resolveTags` because dropping an id from DISPLAY is always right,
 * while dropping it from STORAGE is only right once you know the tag was really deleted
 * rather than just not synced yet.
 */
export function danglingTagIds<T extends { id: string }>(
  ids: readonly string[],
  tags: readonly T[],
): string[] {
  const known = new Set(tags.map((t) => t.id));
  return ids.filter((id) => !known.has(id));
}
