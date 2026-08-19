/**
 * homeCards.test.ts — a card that was REMOVED is not a card that lost its only surface.
 *
 * `sanitizeHomeCardOrder` has to give two opposite answers to the same input shape (a stored
 * order missing a kind), and which one is right depends entirely on whether the missing card is
 * reachable anywhere else:
 *
 *   - **Removed** ('goals' 2026-07-29; 'plans' and 'shopping' 2026-08-19, when To-do took the
 *     middle tab and Home became "Me"): the plain unknown-kind filter is exactly right. Nothing
 *     is lost — each of those surfaces is a whole tab or its own screen.
 *   - **Appended** ('habits', 'health'): a stored order not naming one of these means the
 *     surface is simply gone from that install, with no error, no empty state and nothing on
 *     screen saying where it went. Health has no screen of its own at all; Habits' card is the
 *     only way to the pushed habits screen.
 *
 * That is the whole reason this parse lives in a module of its own rather than inside
 * app/(tabs)/index.tsx, and the reason the append is on READ rather than a lib/db.ts migration:
 * a one-shot UPDATE runs once per install and would miss a row written afterwards by an older
 * build — a restored backup, or a paired device that has not updated yet.
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

  it('is the personal three, and neither neighbouring tab', () => {
    // 2026-08-19: a preview of a tab one swipe away is the duplication that pass removed.
    expect([...HOME_CARD_KINDS]).toEqual(['habits', 'notes', 'health']);
  });
});

describe('an ordinary stored order', () => {
  it('is returned as-is when it already has every current kind', () => {
    expect(sanitizeHomeCardOrder(['notes', 'habits', 'health'])).toEqual([
      'notes',
      'habits',
      'health',
    ]);
  });

  it('keeps the order the user dragged the cards into', () => {
    expect(sanitizeHomeCardOrder(['health', 'notes', 'habits'])).toEqual([
      'health',
      'notes',
      'habits',
    ]);
  });

  it('drops duplicates, keeping the first position', () => {
    expect(sanitizeHomeCardOrder(['habits', 'notes', 'habits', 'health'])).toEqual([
      'habits',
      'notes',
      'health',
    ]);
  });

  it('falls back to the default when nothing survives', () => {
    expect(sanitizeHomeCardOrder([])).toEqual([...HOME_CARD_KINDS]);
    expect(sanitizeHomeCardOrder(['goals', 'bonsai'])).toEqual([...HOME_CARD_KINDS]);
  });
});

describe('the kinds that were removed rather than moved', () => {
  it("drops 'plans' and 'shopping' with no substitution", () => {
    // Both are whole tabs now (To-do is the CENTRE tab), so filtering them costs nobody a
    // surface — the opposite of the 'health' case below. This is the shape EVERY stored row is
    // in at the moment the 2026-08-19 pass ships.
    expect(sanitizeHomeCardOrder(['plans', 'habits', 'notes', 'shopping', 'health'])).toEqual([
      'habits',
      'notes',
      'health',
    ]);
  });

  it("drops 'goals', which shipped for one day in 2026-07 and had somewhere else to be", () => {
    expect(sanitizeHomeCardOrder(['habits', 'goals', 'notes', 'health'])).toEqual([
      'habits',
      'notes',
      'health',
    ]);
  });

  it('falls back to the default when the row named ONLY removed kinds', () => {
    // A user who had hidden all three survivors before the pass. Returning `['habits','health']`
    // out of the appends below would be a stranger answer than the full default.
    expect(sanitizeHomeCardOrder(['plans', 'shopping'])).toEqual([...HOME_CARD_KINDS]);
  });
});

describe('the appended kinds — the surfaces with nowhere else to be', () => {
  it("appends 'health' to an order that predates it", () => {
    expect(sanitizeHomeCardOrder(['habits', 'notes'])).toEqual(['habits', 'notes', 'health']);
  });

  it("appends 'habits' to an order that does not name it", () => {
    expect(sanitizeHomeCardOrder(['notes', 'health'])).toEqual(['notes', 'health', 'habits']);
  });

  it('appends both when both are missing, habits first', () => {
    expect(sanitizeHomeCardOrder(['notes'])).toEqual(['notes', 'habits', 'health']);
  });

  it('is a no-op when the kind is already present, wherever it sits', () => {
    expect(sanitizeHomeCardOrder(['health', 'habits', 'notes'])).toEqual([
      'health',
      'habits',
      'notes',
    ]);
  });

  it("leaves 'notes' out when the user has removed it", () => {
    // The one card here that CAN be hidden for good: its content is a preview of a surface the
    // card itself expands into, so losing it loses a shortcut, not a feature. The two appends
    // above are deliberately asymmetric with this — see lib/homeCards.ts's warning.
    expect(sanitizeHomeCardOrder(['habits', 'health'])).toEqual(['habits', 'health']);
  });
});
