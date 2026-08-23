/**
 * homeCards.test.ts — a card that was REMOVED is not a card that lost its only surface, and a
 * card the USER hid is neither.
 *
 * `sanitizeHomeCardOrder` has to give three different answers to the same input shape (a stored
 * order missing a kind), and which one is right depends on why it is missing:
 *
 *   - **Removed** ('goals' 2026-07-29; 'habits', 'health' and 'medicine' 2026-08-22, when the
 *     bottom nav went back to five tabs): the plain unknown-kind filter is exactly right.
 *     Nothing is lost — Habits and Health are tabs, and Medicine is a card on the Health tab.
 *   - **Not yet nameable** ('plans', 'shopping' in a row written between 2026-08-19 and
 *     2026-08-22, when neither was a kind): repaired by appending, because that install would
 *     otherwise simply not have the card, with no error and nothing on screen saying so.
 *   - **Hidden on purpose** (any kind, in a row this build wrote): left out. Both restored kinds
 *     preview a whole TAB, so hiding one costs a shortcut rather than a surface, and the Retired
 *     shelf at the foot of Home is the way back.
 *
 * ⚠️ **The middle and the last case are the same input**, which is why the parse looks at what
 * the row DOES name: a legacy kind is the evidence that its author never had the chance to name
 * the missing one. Shipping the repair without that test made the ⋮ menu's "Hide" move Today and
 * Shopping to the bottom of Home instead of retiring them (2026-08-23).
 *
 * That is the reason this parse lives in a module of its own rather than inside
 * app/(tabs)/index.tsx, and the reason the repair is on READ rather than only a lib/db.ts
 * migration: a one-shot UPDATE runs once per install and would miss a row written afterwards by
 * an older build — a restored backup, or a paired device that has not updated yet. (There IS
 * such a migration in the 2026-08-22 release, because appending puts the returning kinds at the
 * END and the maintainer named an order; the repair is the safety net under it, not the plan.)
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

describe('the repair — a LEGACY row gets the kinds it could not have named', () => {
  // Every order written between 2026-08-19 and 2026-08-22 named 'habits'/'health'/'medicine'
  // and could not name 'plans' or 'shopping', which were not kinds at all in that window. A
  // lib/db.ts migration empties the column for installs that take the update in order; this
  // covers the row that arrives afterwards — a restored backup, or a device left behind.
  it("puts 'plans' back for a row that names a kind from the old card set", () => {
    expect(sanitizeHomeCardOrder(['notes', 'shopping', 'habits'])).toEqual([
      'notes',
      'shopping',
      'plans',
    ]);
  });

  it('puts both back, in RESTORED_KINDS order', () => {
    expect(sanitizeHomeCardOrder(['notes', 'health', 'medicine'])).toEqual([
      'notes',
      'plans',
      'shopping',
    ]);
  });

  it('is a no-op when the legacy row already names them', () => {
    expect(sanitizeHomeCardOrder(['shopping', 'notes', 'plans', 'goals'])).toEqual([
      'shopping',
      'notes',
      'plans',
    ]);
  });
});

describe('a row this build wrote is left alone — hiding a card sticks', () => {
  // ⚠️ The regression this pair exists for (2026-08-23). The append ran on EVERY order, carried
  // over from when it held cards with no other surface in the app — so hiding Today or Shopping
  // from the ⋮ menu wrote an order the very next read undid, and the card reappeared at the
  // BOTTOM of Home instead of in the Retired shelf. Both kinds preview a whole TAB now, so
  // hiding one costs a shortcut, not a surface.
  it("keeps 'plans' hidden when the user hid it", () => {
    expect(sanitizeHomeCardOrder(['notes', 'shopping'])).toEqual(['notes', 'shopping']);
  });

  it("keeps 'shopping' hidden when the user hid it", () => {
    expect(sanitizeHomeCardOrder(['plans', 'notes'])).toEqual(['plans', 'notes']);
  });

  it('keeps a single surviving card single, rather than refilling the screen', () => {
    expect(sanitizeHomeCardOrder(['notes'])).toEqual(['notes']);
  });

  it("leaves 'notes' out when the user has removed it, as it always has", () => {
    expect(sanitizeHomeCardOrder(['plans', 'shopping'])).toEqual(['plans', 'shopping']);
  });

  it('still falls back to the default when the user hid every card', () => {
    // The one case where a choice is overruled, and it predates this pass: an empty result is
    // indistinguishable from a corrupt row, and a Home tab with nothing on it is not a state
    // worth reproducing faithfully. The Retired shelf is how the other hides are undone.
    expect(sanitizeHomeCardOrder([])).toEqual([...HOME_CARD_KINDS]);
  });
});
