/**
 * cardOrder.test.ts — the fifth card axis, and the one property that makes it safe to store.
 *
 * A stored order is a PREFERENCE LIST, not the truth. Every other axis stores a departure from a
 * default and reads `{}`/`[]` as "the app as designed"; this one stores a whole arrangement, which
 * is the shape that can go stale. The failure mode it must not have: a card added to the registry
 * after a user reordered a screen is absent from their stored list, and a stored-order-is-truth
 * model would simply never draw it — a new surface invisible to exactly the users who care most
 * about their layout, with no error anywhere. `orderedCards` returning the COMPLETE set is what
 * closes that, and it is the first thing asserted here.
 *
 * The no-op contract on both mutators is the second: they return the same object REFERENCE when
 * nothing moves, so "the button did nothing" is a testable assertion rather than a silent write
 * that re-renders every subscriber. Same guard `lib/storeCrud.ts` exists for one rung down, for
 * the reason AGENTS.md records: a no-op that costs nothing visible is not missed by a test suite
 * unless it is pinned deliberately.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { cardsForScreen } from '@/lib/cardRegistry';
import type { CardKey } from '@/lib/cardRegistry';
import { orderedCards, sanitizeCardOrder, withCardMoved, withCardOrder } from '@/lib/cardOrder';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const TODO = cardsForScreen('todo');
const SHOP = cardsForScreen('shop');

describe('sanitizeCardOrder — anything unrecognised becomes "the app as designed"', () => {
  it('reads a never-written column as no preference at all', () => {
    expect(sanitizeCardOrder(undefined)).toEqual({});
    expect(sanitizeCardOrder(null)).toEqual({});
  });

  it('rejects a value of the wrong SHAPE rather than half-applying it', () => {
    // The array shape hiddenCards uses is the most plausible wrong value here — the two columns
    // sit next to each other and are written by the same sheet.
    expect(sanitizeCardOrder(['todoToday'])).toEqual({});
    expect(sanitizeCardOrder('todoToday')).toEqual({});
    expect(sanitizeCardOrder(7)).toEqual({});
    expect(sanitizeCardOrder({ todo: 'todoToday' })).toEqual({});
  });

  it('drops unknown ids and keeps the rest', () => {
    expect(sanitizeCardOrder({ todo: [TODO[1], 'notACard', 42, null, TODO[0]] })).toEqual({
      todo: [TODO[1], TODO[0]],
    });
  });

  it('drops an id that belongs to ANOTHER screen', () => {
    // A card that moved screens between builds, or a restored backup. Keeping it would put a
    // Shop card in To-do's order, where `orderedCards` would filter it anyway — but the stored
    // value would go on growing a ghost nobody can see or remove.
    expect(sanitizeCardOrder({ todo: [TODO[0], SHOP[0]] })).toEqual({ todo: [TODO[0]] });
  });

  it('drops a screen the registry does not know', () => {
    expect(sanitizeCardOrder({ notAScreen: [TODO[0]] })).toEqual({});
  });

  it('de-duplicates, so one card cannot hold two positions', () => {
    expect(sanitizeCardOrder({ todo: [TODO[0], TODO[0], TODO[1]] })).toEqual({
      todo: [TODO[0], TODO[1]],
    });
  });

  it('round-trips a clean value', () => {
    const value = { todo: [...TODO].reverse(), shop: SHOP };
    expect(sanitizeCardOrder(value)).toEqual(value);
  });
});

describe('orderedCards — the stored list is a preference, never the whole truth', () => {
  it('falls back to registry order with no stored value', () => {
    expect(orderedCards({}, 'todo')).toEqual(TODO);
    expect(orderedCards({ todo: [] }, 'todo')).toEqual(TODO);
  });

  it('honours a complete stored order', () => {
    const reversed = [...TODO].reverse();
    expect(orderedCards({ todo: reversed }, 'todo')).toEqual(reversed);
  });

  it('⚠️ APPENDS a card the stored list has never heard of, rather than dropping it', () => {
    // The whole reason this function exists. A list written before a card was added is short by
    // exactly that card; a new surface must still appear for someone who has reordered a screen.
    const partial = [TODO[TODO.length - 1]];
    const result = orderedCards({ todo: partial }, 'todo');
    expect(result).toHaveLength(TODO.length);
    expect(result[0]).toBe(partial[0]);
    expect([...result].sort()).toEqual([...TODO].sort());
  });

  it('keeps the unmentioned cards in REGISTRY order among themselves', () => {
    const result = orderedCards({ todo: [TODO[TODO.length - 1]] }, 'todo');
    expect(result.slice(1)).toEqual(TODO.slice(0, -1));
  });

  it('ignores a stored id the screen no longer has', () => {
    const result = orderedCards({ todo: [SHOP[0] as CardKey, ...TODO] }, 'todo');
    expect(result).toEqual(TODO);
  });

  it('never invents, duplicates or loses a card, whatever the stored value', () => {
    for (const screen of ['shop', 'todo', 'home', 'habits', 'health'] as const) {
      const all = cardsForScreen(screen);
      for (const stored of [[], [all[0]], [...all].reverse(), all]) {
        const result = orderedCards({ [screen]: stored }, screen);
        expect(new Set(result).size).toBe(result.length);
        expect([...result].sort()).toEqual([...all].sort());
      }
    }
  });
});

describe('withCardMoved — one step, and a same-reference no-op at the ends', () => {
  it('moves a card down and back up again', () => {
    const down = withCardMoved({}, 'todo', TODO[0], 1);
    expect(orderedCards(down, 'todo')).toEqual([TODO[1], TODO[0], ...TODO.slice(2)]);
    const up = withCardMoved(down, 'todo', TODO[0], -1);
    expect(orderedCards(up, 'todo')).toEqual(TODO);
  });

  it('writes a COMPLETE list even when the stored one was partial or absent', () => {
    const moved = withCardMoved({}, 'todo', TODO[0], 1);
    expect(moved.todo).toHaveLength(TODO.length);
  });

  it('returns the SAME object at either end, so the button visibly does nothing', () => {
    const order = {};
    expect(withCardMoved(order, 'todo', TODO[0], -1)).toBe(order);
    expect(withCardMoved(order, 'todo', TODO[TODO.length - 1], 1)).toBe(order);
  });

  it('returns the SAME object for an id that is not on that screen', () => {
    const order = {};
    expect(withCardMoved(order, 'todo', SHOP[0], 1)).toBe(order);
  });

  it('leaves every other screen alone', () => {
    const before = { shop: [...SHOP].reverse() };
    const after = withCardMoved(before, 'todo', TODO[0], 1);
    expect(after.shop).toBe(before.shop);
  });

  it('never returns a value the sanitizer would change', () => {
    let order = sanitizeCardOrder({});
    for (const id of TODO) order = withCardMoved(order, 'todo', id, 1);
    expect(sanitizeCardOrder(order)).toEqual(order);
  });
});

describe('withCardOrder — the drag commit', () => {
  it('replaces a screen outright', () => {
    const reversed = [...TODO].reverse();
    expect(orderedCards(withCardOrder({}, 'todo', reversed), 'todo')).toEqual(reversed);
  });

  it('returns the SAME object when the drag ends where it started', () => {
    const order = {};
    expect(withCardOrder(order, 'todo', TODO)).toBe(order);
    const reversed = [...TODO].reverse();
    const moved = withCardOrder(order, 'todo', reversed);
    expect(withCardOrder(moved, 'todo', reversed)).toBe(moved);
  });
});

describe('lib/cardOrder.ts stays dependency-free', () => {
  // The header claims it; AGENTS.md's "a header that ASSERTS a safety property is not evidence
  // the property holds" gotcha is why it is checked. This one runs on every screen's render.
  const banned = [
    /@\/store\//,
    /@\/lib\/db/,
    /@\/lib\/notifications/,
    /@\/lib\/reminders/,
    /@\/lib\/liveSync/,
    /expo-/,
    /react/,
  ];

  it('imports nothing heavy', () => {
    const imports = read('lib/cardOrder.ts')
      .split('\n')
      .filter((l) => /^import /.test(l))
      .join('\n');
    for (const pattern of banned) expect(imports).not.toMatch(pattern);
  });
});
