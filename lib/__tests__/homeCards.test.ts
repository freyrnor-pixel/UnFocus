/**
 * homeCards.test.ts — a card that was REMOVED is not a card that lost its only surface.
 *
 * `sanitizeHomeCardOrder` has to give two opposite answers to the same input shape (a stored
 * order missing a kind), and which one is right depends entirely on whether the missing card is
 * reachable anywhere else:
 *
 *   - **Removed** ('goals' 2026-07-29; 'habits', 'health' and 'medicine' 2026-08-22, when the
 *     bottom nav went back to five tabs): the plain unknown-kind filter is exactly right.
 *     Nothing is lost — Habits and Health are tabs, and Medicine is a card on the Health tab.
 *   - **Appended** ('plans', 'shopping'): a stored order not naming one of these means the card
 *     is simply absent from that install, with no error and nothing on screen saying so. Every
 *     stored row in existence was written while both were DROPPED kinds (2026-08-19 → 2026-08-22),
 *     so a filter-only change would have restored them for nobody.
 *
 * ⚠️ **The two lists swapped places in the same pass**, which is the sharpest illustration of why
 * this parse exists at all: nothing about a kind's NAME says which treatment it gets, only
 * whether the surface behind it has anywhere else to live today.
 *
 * That is the reason this parse lives in a module of its own rather than inside
 * app/(tabs)/index.tsx, and the reason the append is on READ rather than only a lib/db.ts
 * migration: a one-shot UPDATE runs once per install and would miss a row written afterwards by
 * an older build — a restored backup, or a paired device that has not updated yet. (There IS
 * such a migration in the 2026-08-22 release, because appending puts the returning kinds at the
 * END and the maintainer named an order; the append is the safety net under it, not the plan.)
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { HOME_CARD_KINDS, sanitizeHomeCardOrder } from '@/lib/homeCards';

describe('the default order', () => {
  it('matches the settings store, which is the other place it is written down', () => {
    // A source scan rather than an import: the defaults are inline in the store's initial
    // state, and pulling that module in would drag lib/db and the notification layer into a
    // test of a dependency-free parse. Both literals must agree — the store's is what a fresh
    // row gets, this module's is the fallback when that row is corrupt or empty.
    const store = readFileSync(
      join(__dirname, '..', '..', 'store', 'useSettingsStore.ts'),
      'utf8'
    );
    const literal = `[${HOME_CARD_KINDS.map((k) => `'${k}'`).join(', ')}]`;
    expect(store).toContain(`homeCardOrder: ${literal},`);
    expect(store).toContain(`readJson<string[]>(row, 'home_card_order', ${literal})`);
  });

  it("is the day's tasks, then Notes, then Shopping — the maintainer's sentence, in order", () => {
    // 2026-08-22: *"'Home' had easy access to todays tasks, Notes, and shopping."* The ORDER is
    // part of the instruction, not an implementation detail, which is why this pins the array
    // rather than the set. Habits/health/medicine left in the same pass — each has a tab or a
    // card on one, so a preview here would be the duplication the five-tab split exists to end.
    expect([...HOME_CARD_KINDS]).toEqual(['plans', 'notes', 'shopping']);
  });
});

describe('an ordinary stored order', () => {
  it('is returned as-is when it already has every current kind', () => {
    expect(sanitizeHomeCardOrder(['plans', 'notes', 'shopping'])).toEqual([
      'plans',
      'notes',
      'shopping',
    ]);
  });

  it('keeps the order the user dragged the cards into', () => {
    expect(sanitizeHomeCardOrder(['shopping', 'plans', 'notes'])).toEqual([
      'shopping',
      'plans',
      'notes',
    ]);
  });

  it('drops duplicates, keeping the first position', () => {
    expect(sanitizeHomeCardOrder(['plans', 'notes', 'plans', 'shopping'])).toEqual([
      'plans',
      'notes',
      'shopping',
    ]);
  });

  it('falls back to the default when nothing survives', () => {
    expect(sanitizeHomeCardOrder([])).toEqual([...HOME_CARD_KINDS]);
    expect(sanitizeHomeCardOrder(['goals', 'bonsai'])).toEqual([...HOME_CARD_KINDS]);
  });
});

describe('the kinds that were removed rather than moved', () => {
  it("drops 'habits', 'health' and 'medicine' with no substitution", () => {
    // Habits and Health are bottom-nav tabs again and Medicine is a card on the Health tab, so
    // filtering them costs nobody a surface — the opposite of the 'plans'/'shopping' case below.
    // This is the shape EVERY stored row is in at the moment the 2026-08-22 pass ships, which is
    // why the release also empties the column: the append below would otherwise land both
    // returning cards after Notes.
    expect(sanitizeHomeCardOrder(['habits', 'notes', 'health', 'medicine'])).toEqual([
      'notes',
      'plans',
      'shopping',
    ]);
  });

  it("drops 'goals', which shipped for one day in 2026-07 and had somewhere else to be", () => {
    expect(sanitizeHomeCardOrder(['plans', 'goals', 'notes', 'shopping'])).toEqual([
      'plans',
      'notes',
      'shopping',
    ]);
  });

  it('falls back to the default when the row named ONLY removed kinds', () => {
    // A user who had hidden every survivor before the pass. Returning just the appended kinds
    // out of the loop below would be a stranger answer than the full default.
    expect(sanitizeHomeCardOrder(['habits', 'health', 'medicine'])).toEqual([...HOME_CARD_KINDS]);
  });
});

describe('the appended kinds — the cards a stored row cannot name yet', () => {
  it("appends 'plans' to an order that does not name it", () => {
    expect(sanitizeHomeCardOrder(['notes', 'shopping'])).toEqual(['notes', 'shopping', 'plans']);
  });

  // Every stored row in existence was written while 'shopping' was a dropped kind, so this is
  // not an edge case — it is the shape EVERY install is in the moment the restore ships.
  it("appends 'shopping' to every order written while it was dropped", () => {
    expect(sanitizeHomeCardOrder(['plans', 'notes'])).toEqual(['plans', 'notes', 'shopping']);
  });

  it('appends both when both are missing, in ALWAYS_PRESENT order', () => {
    expect(sanitizeHomeCardOrder(['notes'])).toEqual(['notes', 'plans', 'shopping']);
  });

  it('is a no-op when the kind is already present, wherever it sits', () => {
    expect(sanitizeHomeCardOrder(['shopping', 'notes', 'plans'])).toEqual([
      'shopping',
      'notes',
      'plans',
    ]);
  });

  it("leaves 'notes' out when the user has removed it", () => {
    // The one card here that CAN be hidden for good: its content is a preview of a surface the
    // card itself expands into, so losing it loses a shortcut, not a feature. The two appends
    // above are deliberately asymmetric with this — see lib/homeCards.ts's warning.
    expect(sanitizeHomeCardOrder(['plans', 'shopping'])).toEqual(['plans', 'shopping']);
  });
});
