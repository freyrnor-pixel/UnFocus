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
    // 'habits' and 'health' both included so neither append (their own describe blocks below)
    // has anything to add here.
    expect(sanitizeHomeCardOrder(['plans', 'habits', 'notes', 'plans', 'health'])).toEqual([
      'plans',
      'habits',
      'notes',
      'health',
    ]);
  });

  it('drops a kind that was genuinely deleted, with no substitution', () => {
    // 'goals' shipped as a fifth card on 2026-07-28 and was gone the next day. There is
    // nowhere for it to fold into, and that is the correct outcome for a deletion — unlike
    // 'health' below, 'goals' still has somewhere else to be (Habits/Plans' own drawer).
    expect(sanitizeHomeCardOrder(['plans', 'habits', 'goals', 'notes', 'health'])).toEqual([
      'plans',
      'habits',
      'notes',
      'health',
    ]);
  });

  it('falls back to the default when nothing survives', () => {
    expect(sanitizeHomeCardOrder([])).toEqual([...HOME_CARD_KINDS]);
    expect(sanitizeHomeCardOrder(['goals', 'bonsai'])).toEqual([...HOME_CARD_KINDS]);
  });

  it('appends the new health kind to an order that predates it', () => {
    // Health left the bottom nav ENTIRELY for this pass — unlike 'goals' (which had somewhere
    // else to be), a stored order not naming 'health' yet means the surface is gone from every
    // existing install with nothing on screen saying so. Every row in existence at ship time
    // predates 'health' by definition, so this is the ordinary path, not an edge case.
    expect(sanitizeHomeCardOrder(['plans', 'habits', 'notes', 'shopping'])).toEqual([
      'plans',
      'habits',
      'notes',
      'shopping',
      'health',
    ]);
  });
});

describe("the appended 'health' entry", () => {
  it('is a no-op when health is already present, wherever it sits', () => {
    expect(sanitizeHomeCardOrder(['health', 'plans', 'habits', 'notes'])).toEqual([
      'health',
      'plans',
      'habits',
      'notes',
    ]);
    expect(sanitizeHomeCardOrder(['plans', 'health', 'habits', 'notes'])).toEqual([
      'plans',
      'health',
      'habits',
      'notes',
    ]);
  });

  it('stacks with the habits un-fold — both missing at once', () => {
    // The exact shape every real install's stored row is in right now: the pre-un-fold,
    // pre-health chain terminates at ["plans","habits","goals","notes","shopping"], which
    // filters to ["plans","habits","notes","shopping"] once 'goals' drops — habits already
    // present, health missing, appended at the end.
    expect(sanitizeHomeCardOrder(['plans', 'notes', 'shopping'])).toEqual([
      'plans',
      'habits',
      'notes',
      'shopping',
      'health',
    ]);
  });

  it('is appended even when the order is otherwise empty after filtering', () => {
    expect(sanitizeHomeCardOrder(['goals'])).toEqual([...HOME_CARD_KINDS]);
  });
});

describe("the un-folded 'habits' entry", () => {
  it('is a no-op when habits is already present, wherever it sits', () => {
    // Reordering post-un-fold must not be re-corrected back next to plans every time. 'health'
    // included in each input so its own append has nothing to add here.
    expect(sanitizeHomeCardOrder(['habits', 'plans', 'notes', 'health'])).toEqual([
      'habits',
      'plans',
      'notes',
      'health',
    ]);
    expect(sanitizeHomeCardOrder(['notes', 'habits', 'plans', 'health'])).toEqual([
      'notes',
      'habits',
      'plans',
      'health',
    ]);
  });

  it('does nothing when plans is ALSO missing — nothing to splice it after', () => {
    // If the user removed the To-do card too, there is no anchor position left to restore
    // habits at without inventing one; the surface stays reachable via "Add a card" instead.
    // 'health' still gets appended regardless — that append has no anchor requirement.
    expect(sanitizeHomeCardOrder(['notes', 'shopping'])).toEqual(['notes', 'shopping', 'health']);
  });

  it('survives as the only entry once un-folded next to plans', () => {
    expect(sanitizeHomeCardOrder(['plans'])).toEqual(['plans', 'habits', 'health']);
  });

  it('does not resurrect other dropped kinds while un-folding', () => {
    expect(sanitizeHomeCardOrder(['goals', 'plans'])).toEqual(['plans', 'habits', 'health']);
  });
});
