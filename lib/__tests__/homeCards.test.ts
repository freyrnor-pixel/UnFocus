/**
 * homeCards.test.ts — a card that was MERGED is not a card that was deleted, and reversing a
 * merge must not lose the same surface a second time.
 *
 * The 5→3 tab merge (2026-08-20 morning) took 'habits' out of `HOME_CARD_KINDS` and folded a
 * stored 'habits' entry into 'plans' (the section rode on that card). The SAME-DAY "full-screen
 * card expansion" pass reversed it hours later: Habits is a first-class, independently
 * expandable card again, and 'health' joined the same day as a genuinely NEW kind (Health left
 * the bottom nav for a Home card). `sanitizeHomeCardOrder`'s plain unknown-kind filter, which is
 * exactly right for a card that was genuinely removed ('goals', 2026-07-29), gives the WRONG
 * answer for the UN-fold: a stored order from the folded window has no 'habits' entry at all, so
 * the filter alone leaves it silently absent — no error, no empty state, just a surface that
 * used to be there and now isn't, with nothing on screen saying where it went.
 *
 * That is the whole reason this parse lives in a module of its own rather than inside
 * app/(tabs)/index.tsx, and the reason the un-fold is on READ rather than a lib/db.ts migration:
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

  it('contains habits and health — both are first-class cards again', () => {
    expect(HOME_CARD_KINDS).toContain('habits');
    expect(HOME_CARD_KINDS).toContain('health');
  });
});

describe('an ordinary stored order', () => {
  it('is returned as-is when it already has every current kind', () => {
    expect(sanitizeHomeCardOrder(['shopping', 'plans', 'habits', 'notes', 'health'])).toEqual([
      'shopping',
      'plans',
      'habits',
      'notes',
      'health',
    ]);
  });

  it('drops duplicates, keeping the first position', () => {
    // 'habits' included so the un-fold (its own describe block below) has nothing to add here.
    expect(sanitizeHomeCardOrder(['plans', 'habits', 'notes', 'plans'])).toEqual(['plans', 'habits', 'notes']);
  });

  it('drops a kind that was genuinely deleted, with no substitution', () => {
    // 'goals' shipped as a fifth card on 2026-07-28 and was gone the next day. There is
    // nowhere for it to fold into, and that is the correct outcome for a deletion.
    expect(sanitizeHomeCardOrder(['plans', 'habits', 'goals', 'notes'])).toEqual(['plans', 'habits', 'notes']);
  });

  it('falls back to the default when nothing survives', () => {
    expect(sanitizeHomeCardOrder([])).toEqual([...HOME_CARD_KINDS]);
    expect(sanitizeHomeCardOrder(['goals', 'bonsai'])).toEqual([...HOME_CARD_KINDS]);
  });

  it('does not auto-add the new health kind to an order that predates it', () => {
    // Unlike habits (which WAS on Home and would otherwise vanish), health is a genuinely NEW
    // surface — an existing order simply not naming it yet is not a data-loss case, it is the
    // same "removed with no substitution" shape 'goals' already covers. It reaches Home via
    // "Add a card" like any other addable kind.
    expect(sanitizeHomeCardOrder(['plans', 'habits', 'notes', 'shopping'])).toEqual([
      'plans',
      'habits',
      'notes',
      'shopping',
    ]);
  });
});

describe("the un-folded 'habits' entry", () => {
  it('is spliced back in, directly after plans, when it is missing but plans is present', () => {
    // The case the un-fold exists for: a row written during the brief 5→3-merge window (or by
    // an older build, or restored from a backup, or synced from a paired device still on it).
    // Without it this returns ['plans', 'notes'] and the habits list is gone from Home with
    // nothing saying so.
    expect(sanitizeHomeCardOrder(['plans', 'notes', 'shopping'])).toEqual([
      'plans',
      'habits',
      'notes',
      'shopping',
    ]);
  });

  it('is a no-op when habits is already present, wherever it sits', () => {
    // Reordering post-un-fold must not be re-corrected back next to plans every time.
    expect(sanitizeHomeCardOrder(['habits', 'plans', 'notes'])).toEqual(['habits', 'plans', 'notes']);
    expect(sanitizeHomeCardOrder(['notes', 'habits', 'plans'])).toEqual(['notes', 'habits', 'plans']);
  });

  it('does nothing when plans is ALSO missing — nothing to splice it after', () => {
    // If the user removed the To-do card too, there is no anchor position left to restore
    // habits at without inventing one; the surface stays reachable via "Add a card" instead,
    // the same answer a genuinely new kind gets.
    expect(sanitizeHomeCardOrder(['notes', 'shopping'])).toEqual(['notes', 'shopping']);
  });

  it('survives as the only entry once un-folded next to plans', () => {
    expect(sanitizeHomeCardOrder(['plans'])).toEqual(['plans', 'habits']);
  });

  it('does not resurrect other dropped kinds while un-folding', () => {
    expect(sanitizeHomeCardOrder(['goals', 'plans'])).toEqual(['plans', 'habits']);
  });
});
