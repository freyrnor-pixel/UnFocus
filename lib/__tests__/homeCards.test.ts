/**
 * homeCards.test.ts — a card that was MERGED is not a card that was deleted.
 *
 * The 5→3 tab merge (2026-08-20) took 'habits' out of `HOME_CARD_KINDS`, but the habits list
 * did not leave Home — it became a section inside the 'plans' card. `sanitizeHomeCardOrder`'s
 * plain unknown-kind filter, which is exactly right for a card that was genuinely removed
 * ('goals', 2026-07-29), gives the WRONG answer for that: it silently drops the entry, and for
 * the user who had removed the To-do card and kept Habits it drops their habits list with it —
 * no error, no empty state, just a surface that is gone and a card on screen that shows no sign
 * of where it went. Nothing else in the app would notice.
 *
 * That is the whole reason this parse lives in a module of its own rather than inside
 * app/(tabs)/index.tsx, and the reason the fold-in is on READ rather than a lib/db.ts migration:
 * a one-shot UPDATE runs once per install and would miss a row written afterwards by an older
 * build — a restored backup, or a paired device that has not updated.
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

  it('no longer contains habits — it is a section inside the plans card now', () => {
    expect(HOME_CARD_KINDS).not.toContain('habits');
  });
});

describe('an ordinary stored order', () => {
  it('is returned as-is', () => {
    expect(sanitizeHomeCardOrder(['shopping', 'plans', 'notes'])).toEqual(['shopping', 'plans', 'notes']);
  });

  it('drops duplicates, keeping the first position', () => {
    expect(sanitizeHomeCardOrder(['plans', 'notes', 'plans'])).toEqual(['plans', 'notes']);
  });

  it('drops a kind that was genuinely deleted, with no substitution', () => {
    // 'goals' shipped as a fifth card on 2026-07-28 and was gone the next day. There is
    // nowhere for it to fold into, and that is the correct outcome for a deletion.
    expect(sanitizeHomeCardOrder(['plans', 'goals', 'notes'])).toEqual(['plans', 'notes']);
  });

  it('falls back to the default when nothing survives', () => {
    expect(sanitizeHomeCardOrder([])).toEqual([...HOME_CARD_KINDS]);
    expect(sanitizeHomeCardOrder(['goals', 'bonsai'])).toEqual([...HOME_CARD_KINDS]);
  });
});

describe("the merged 'habits' entry", () => {
  it('is dropped when plans is already there, since the section rides on that card', () => {
    // The ordinary case: every install shipped with both, so the filter alone is right and
    // promoting would produce a duplicate 'plans'.
    expect(sanitizeHomeCardOrder(['plans', 'habits', 'notes', 'shopping'])).toEqual([
      'plans',
      'notes',
      'shopping',
    ]);
  });

  it('is PROMOTED to plans when the user had removed the To-do card', () => {
    // The case the fold-in exists for. Without it this returns ['notes'] and the habits list
    // is gone from Home with nothing saying so.
    expect(sanitizeHomeCardOrder(['habits', 'notes'])).toEqual(['plans', 'notes']);
  });

  it('is promoted IN PLACE, not appended', () => {
    // Card order is a user's arrangement; a surface reappearing at the bottom of a list it
    // used to head reads as a different change from the one that happened.
    expect(sanitizeHomeCardOrder(['notes', 'habits', 'shopping'])).toEqual([
      'notes',
      'plans',
      'shopping',
    ]);
  });

  it('survives as the only entry', () => {
    // HomeCardManager enforces a floor of one card, so this is reachable: a user down to the
    // Habits card alone must not land on the full default order.
    expect(sanitizeHomeCardOrder(['habits'])).toEqual(['plans']);
  });

  it('does not resurrect other dropped kinds while folding', () => {
    expect(sanitizeHomeCardOrder(['goals', 'habits'])).toEqual(['plans']);
  });
});
