/**
 * useCatalogStore.ts — item catalog + purchase history (store/price/category learning)
 *
 * Zustand store backing the scan/shopping autocomplete: remembers known grocery
 * items with their last store, price, and category, and logs every purchase.
 * Powers the suggest() typeahead and learns from recordPurchases() so suggestions
 * improve. Also supports resetItemPrice() for escape-hatch correction of misread OCR prices.
 *
 * Phase 5 real port (2026-07-02) — replaces the Decision 015/015a typed-only stub.
 * suggest() returns full StoreItem rows (id/name/category/store/price); its
 * consumers (AddItemSheet, AddDishSheet) only read id/name/price, so the stub's
 * narrower CatalogSuggestion shape is a structural subset — they keep compiling.
 *
 * Connections:
 *   Imports → lib/catalogSeed, lib/db, lib/dataAccess, lib/id, lib/receipt (findFuzzyMatch —
 *             recordPurchases() dedup, 2026-07-20)
 *   Used by → components/AddItemSheet.tsx, components/AddDishSheet.tsx (suggest),
 *             components/CatalogueTab.tsx (the Shopping screen's "Catalogue" tab — addItem/
 *             updateItem/removeItem CRUD), components/FoodTab.tsx + components/WeekListCard.tsx
 *             (suggest); app/scan.tsx + app/_layout.tsx (future — startup load / purchase logging)
 *   Data    → defines a Zustand store; owns SQLite tables store_items (catalog) and purchase_log (append-only history, optionally linked to a receipts row via receipt_id)
 *
 * Edit notes:
 *   - seedCatalog() runs at most ONCE per CATALOG_SEED_VERSION (tracked in the app_meta
 *     key/value table), not on every load() — the old per-load re-seed was ~570 synchronous
 *     writes and the main cause of slow catalogue/startup. It uses stable name-derived IDs
 *     ('cat_<name>') with INSERT OR IGNORE, all inside one transaction. Bump CATALOG_SEED_VERSION
 *     whenever lib/catalogSeed.ts changes so the seed re-runs once. Renaming seed items orphans old rows.
 *   - price_source ('seed' | 'purchase') tracks where a row's price came from: seedCatalog() re-syncs
 *     'seed' rows with lib/catalogSeed.ts when the seed version changes, but never overwrites a price once a real purchase sets it to 'purchase'.
 *   - purchase_log is append-only and pruned by RETENTION_DAYS in lib/db.ts; recordPurchases() also upserts the catalog row's store/category, but only raises price — a new purchase price below the existing catalog price never lowers it (store/category still update unconditionally).
 *   - recordPurchases()'s optional receiptId links each purchase_log row to a receipts row (purchase_log.receipt_id) for a future budget screen — pass it whenever a receipt was already created; omit it for purchases with no receipt (e.g. manual catalog edits).
 *   - recordPurchases() matches a purchased name against the catalog via findFuzzyMatch
 *     (lib/receipt.ts), not exact equality (2026-07-20) — an OCR near-miss updates the
 *     existing catalog row instead of inserting a permanent near-duplicate.
 *   - resetItemPrice(id, newPrice) directly updates a store_items row's price and sets price_source = 'purchase' — escape hatch for correcting misread OCR prices.
 *   - addItem/updateItem/removeItem back the Catalogue tab's manual CRUD. removeItem SOFT-deletes
 *     (sets `deleted = 1`) rather than DELETEing, because seedCatalog() re-inserts every seed row
 *     on each load(); load() filters `deleted = 0`. User-added rows use generateId() (not the
 *     'cat_<name>' seed id) so re-adding a deleted seed name creates a fresh live row.
 *   - load() JS-collates the loaded rows with localeCompare('no') so `items` is stored in
 *     Norwegian display order (SQL orderBy sorts by byte value and mis-orders æ/ø/å). Doing
 *     it once here — not per Catalogue-tab mount — keeps opening that tab instant; the
 *     mutation methods (addItem/updateItem/recordPurchases/resetItemPrice) re-sort the same way.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import { Row, loadAll, insertRow, readStr, readReal, tx } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { CATALOG_SEED } from '@/lib/catalogSeed';
import { findFuzzyMatch } from '@/lib/receipt';

export type StoreItem = {
  id: string;
  name: string;
  category: string;
  store: string;
  price: number;
};

export type PurchaseInput = {
  name: string;
  category?: string;
  store: string;
  price: number;
  wasOnList: boolean;
};

type CatalogStore = {
  items: StoreItem[];
  load: () => void;
  suggest: (query: string, limit?: number) => StoreItem[];
  recordPurchases: (purchases: PurchaseInput[], receiptId?: string) => void;
  resetItemPrice: (id: string, newPrice: number) => void;
  /** Add a user-authored catalogue item (the Catalogue tab's "+"). Returns the new row id. */
  addItem: (input: { name: string; price?: number; category?: string; store?: string }) => string;
  /** Edit a catalogue item's name/price/category (Catalogue tab inline edit). */
  updateItem: (id: string, patch: { name?: string; price?: number; category?: string; store?: string }) => void;
  /** Delete a catalogue item (Catalogue tab delete button). */
  removeItem: (id: string) => void;
};

function rowToItem(row: Row): StoreItem {
  return {
    id: readStr(row, 'id'),
    name: readStr(row, 'name'),
    category: readStr(row, 'category') || 'other',
    store: readStr(row, 'store'),
    price: readReal(row, 'price'),
  };
}

// Bump this whenever lib/catalogSeed.ts changes (items added/removed or seed prices
// edited) so the one-time gate below re-runs the seed once to pick the changes up.
const CATALOG_SEED_VERSION = '1';
const CATALOG_SEED_META_KEY = 'catalog_seed_version';

function catalogSeedVersion(): string {
  try {
    const row = db.getFirstSync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      [CATALOG_SEED_META_KEY]
    );
    return row?.value ?? '';
  } catch {
    return '';
  }
}

/**
 * Seed the catalogue from lib/catalogSeed.ts. Previously this ran ~2 autocommitting
 * writes per item on EVERY load() (~570 synchronous statements) — the main cause of
 * the slow catalogue/startup. Now it runs at most once per CATALOG_SEED_VERSION, and
 * wraps the whole thing in a single transaction (one commit instead of ~570).
 */
function seedCatalog(): void {
  if (catalogSeedVersion() === CATALOG_SEED_VERSION) return;
  const now = new Date().toISOString();
  tx(() => {
    for (const s of CATALOG_SEED) {
      // Stable ID derived from name so this is safe to re-run for a new seed version.
      const stableId = 'cat_' + s.name.toLowerCase().replace(/\s+/g, '_');
      try {
        db.runSync(
          `INSERT OR IGNORE INTO store_items (id, name, category, store, price, price_source, last_updated)
           VALUES (?, ?, ?, '', ?, 'seed', ?)`,
          [stableId, s.name, s.category, s.price, now]
        );
        // Keep seed-sourced prices in sync with lib/catalogSeed.ts when the seed version
        // changes. Stops touching the row once a real purchase marks it price_source = 'purchase'.
        db.runSync(
          `UPDATE store_items SET price = ?, price_source = 'seed' WHERE id = ? AND price_source = 'seed'`,
          [s.price, stableId]
        );
      } catch (err) {
        // Log errors for debugging, but still continue seeding other items.
        console.error(`Failed to seed item ${s.name}:`, err);
      }
    }
    db.runSync(
      'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
      [CATALOG_SEED_META_KEY, CATALOG_SEED_VERSION]
    );
  });
}

export const useCatalogStore = create<CatalogStore>((set, get) => ({
  items: [],

  load() {
    seedCatalog();
    // Collate in JS with localeCompare('no') so æ/ø/å order correctly (SQL orderBy
    // sorts by byte value and mis-orders them). Sorting HERE — once, at startup load —
    // means `items` is stored in final display order, so CatalogueTab renders it
    // directly with no per-mount sort (that 287-item locale sort used to run every time
    // the Catalogue tab was opened, adding a "loading" beat to the tap). The mutation
    // methods below already keep this order after edits.
    const rows = loadAll('store_items', rowToItem, { where: 'deleted = 0' });
    rows.sort((a, b) => a.name.localeCompare(b.name, 'no'));
    set({ items: rows });
  },

  suggest(query, limit = 8) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const matches = get().items.filter((i) => {
      const ln = i.name.toLowerCase();
      if (!ln.includes(q) || seen.has(ln)) return false;
      seen.add(ln);
      return true;
    });
    matches.sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return ap !== bp ? ap - bp : a.name.localeCompare(b.name, 'no');
    });
    return matches.slice(0, limit);
  },

  recordPurchases(purchases, receiptId) {
    if (purchases.length === 0) return;
    const now = new Date().toISOString();
    const next = [...get().items];

    // One transaction for all per-item writes (was up to 2 autocommits per item);
    // per-item try/catch still keeps logging best-effort. set() runs after, so a
    // rollback can't leave in-memory state ahead of the DB.
    tx(() => {
    for (const p of purchases) {
      const name = p.name.trim();
      if (!name) continue;
      try {
        insertRow('purchase_log', {
          id: generateId(),
          item_name: name,
          store: p.store,
          price: p.price,
          was_on_list: p.wasOnList ? 1 : 0,
          purchased_at: now,
          receipt_id: receiptId ?? null,
        });
      } catch { /* logging is best-effort */ }

      // Fuzzy, not exact, match: an OCR-scanned name that's a near-miss of an
      // existing catalog entry (whitespace, a 1-2 char misread) should update
      // that row instead of permanently bloating the catalog with a near-dupe
      // (2026-07-20 — same matcher app/scan.tsx already uses for the Katalog
      // price-match, applied here to the catalog-insert path too).
      const matchedName = findFuzzyMatch(name, next.map((i) => i.name));
      const idx = matchedName ? next.findIndex((i) => i.name === matchedName) : -1;
      if (idx >= 0) {
        // Catalog price only ever moves up from a real purchase — a lower price
        // on a later receipt (sale, different store) doesn't overwrite the
        // catalog's known price.
        const priceIncreased = p.price > next[idx].price;
        const merged: StoreItem = {
          ...next[idx],
          store: p.store || next[idx].store,
          price: priceIncreased ? p.price : next[idx].price,
          category: p.category ?? next[idx].category,
        };
        next[idx] = merged;
        try {
          db.runSync(
            `UPDATE store_items SET store = ?, price = ?, category = ?, last_updated = ?,
              price_source = CASE WHEN ? THEN 'purchase' ELSE price_source END
             WHERE id = ?`,
            [merged.store, merged.price, merged.category, now, priceIncreased ? 1 : 0, merged.id]
          );
        } catch { /* ignore */ }
      } else {
        const id = generateId();
        const item: StoreItem = { id, name, category: p.category ?? 'other', store: p.store, price: p.price };
        next.push(item);
        try {
          insertRow('store_items', {
            id,
            name: item.name,
            category: item.category,
            store: item.store,
            price: item.price,
            last_updated: now,
            price_source: 'purchase',
          });
        } catch { /* ignore */ }
      }
    }
    });

    next.sort((a, b) => a.name.localeCompare(b.name, 'no'));
    set({ items: next });
  },

  addItem({ name, price = 0, category = 'other', store = '' }) {
    const trimmed = name.trim();
    const id = generateId();
    const now = new Date().toISOString();
    const item: StoreItem = { id, name: trimmed, category, store, price };
    try {
      insertRow('store_items', {
        id,
        name: trimmed,
        category,
        store,
        price,
        last_updated: now,
        price_source: 'purchase',
      });
    } catch { /* ignore */ }
    const next = [...get().items, item].sort((a, b) => a.name.localeCompare(b.name, 'no'));
    set({ items: next });
    return id;
  },

  updateItem(id, patch) {
    const idx = get().items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const now = new Date().toISOString();
    const updated: StoreItem = {
      ...get().items[idx],
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.store !== undefined ? { store: patch.store } : {}),
    };
    try {
      db.runSync(
        "UPDATE store_items SET name = ?, price = ?, category = ?, store = ?, price_source = 'purchase', last_updated = ? WHERE id = ?",
        [updated.name, updated.price, updated.category, updated.store, now, id]
      );
    } catch { /* ignore */ }
    const next = [...get().items];
    next[idx] = updated;
    next.sort((a, b) => a.name.localeCompare(b.name, 'no'));
    set({ items: next });
  },

  removeItem(id) {
    // Soft-delete: seedCatalog() re-inserts seed rows on every load(), so a hard DELETE
    // of a seed item would resurrect on next focus. Tombstoning the row keeps it out of
    // both the seed re-insert (row still exists) and the catalogue (load() filters deleted=0).
    try {
      db.runSync('UPDATE store_items SET deleted = 1 WHERE id = ?', [id]);
    } catch { /* ignore */ }
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  resetItemPrice(id, newPrice) {
    const idx = get().items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const now = new Date().toISOString();
    const updated: StoreItem = {
      ...get().items[idx],
      price: newPrice,
    };
    const next = [...get().items];
    next[idx] = updated;
    try {
      db.runSync(
        'UPDATE store_items SET price = ?, price_source = ?, last_updated = ? WHERE id = ?',
        [newPrice, 'purchase', now, id]
      );
    } catch { /* ignore */ }
    next.sort((a, b) => a.name.localeCompare(b.name, 'no'));
    set({ items: next });
  },
}));
