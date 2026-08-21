/**
 * collapsedCards.test.ts — the fold-away bag, and the rules that keep a card findable.
 *
 * **This file's premise inverted on 2026-08-21.** It used to say every unknown, malformed or
 * legacy value had to resolve to "open", on the reasoning that a card folded away hides a
 * surface with no way back. That reasoning was always half wrong — a folded card keeps its
 * header, its count and its chevron, so the way back is on screen — and the maintainer has
 * since asked for closed to be the resting state (*"All card start in closed state, except
 * 'Today' 'Notes' and 'Shopping' in middle screen"*). What is guarded now is that the resting
 * state comes from ONE place (lib/cardDefaults.ts), that the bag stores only what the user has
 * moved off it, and that the exception list names ids that really exist.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { CARDS_OPEN_AT_REST, PAD_SURFACES_OPEN_AT_REST } from '@/lib/cardDefaults';
import {
  CARD_IDS,
  CollapsedCards,
  defaultCollapsed,
  isCollapsed,
  sanitizeCollapsedCards,
  withCollapsed,
} from '@/lib/collapsedCards';

describe('isCollapsed — absent means the card`s resting state', () => {
  it('reads an unset card as closed', () => {
    expect(isCollapsed({}, 'healthWeek')).toBe(true);
  });

  it('survives an undefined bag', () => {
    // The state before the column has ever been written.
    expect(isCollapsed(undefined, 'healthWeek')).toBe(true);
  });

  it('reads an excepted card as open when unset', () => {
    expect(isCollapsed({}, 'plansToday')).toBe(false);
  });

  it('reads a stored value in both directions', () => {
    expect(isCollapsed({ healthWeek: true }, 'healthWeek')).toBe(true);
    // An explicit false is meaningful now: with closed as the default, it is the only way to
    // record "I opened this one". Before the inversion this case was legacy data.
    expect(isCollapsed({ healthWeek: false }, 'healthWeek')).toBe(false);
    expect(isCollapsed({ plansToday: true }, 'plansToday')).toBe(true);
  });
});

describe('defaultCollapsed — one short exception list', () => {
  it('rests To-do`s Today open', () => {
    expect(defaultCollapsed('plansToday')).toBe(false);
  });

  it('rests every other card closed', () => {
    for (const id of CARD_IDS) {
      if (CARDS_OPEN_AT_REST.includes(id)) continue;
      expect(defaultCollapsed(id)).toBe(true);
    }
  });

  // The exception lists are typed as plain strings to avoid an import cycle, so nothing but
  // this test stops a typo there from silently exempting nothing at all.
  it('names only real card ids', () => {
    for (const id of CARDS_OPEN_AT_REST) expect(CARD_IDS as readonly string[]).toContain(id);
  });

  it('names only real pad surfaces', () => {
    const padSurfaces = ['shopping', 'plans', 'homeTodo', 'notes', 'habits', 'health'];
    for (const id of PAD_SURFACES_OPEN_AT_REST) expect(padSurfaces).toContain(id);
  });

  // "Everything starts closed" is only true as a sentence while this stays short. A fourth
  // entry is a maintainer decision, and it should cost a failing test to make it.
  it('excepts no more cards than the maintainer named', () => {
    expect(CARDS_OPEN_AT_REST.length + PAD_SURFACES_OPEN_AT_REST.length).toBeLessThanOrEqual(4);
  });
});

describe('withCollapsed — the bag holds only what the user moved', () => {
  it('stores a card opened against its resting state', () => {
    expect(withCollapsed({}, 'habitsList', false)).toEqual({ habitsList: false });
  });

  it('DELETES when the chosen state IS the resting state', () => {
    const out = withCollapsed({ habitsList: false }, 'habitsList', true);
    expect(out).toEqual({});
    expect('habitsList' in out).toBe(false);
  });

  it('stores an excepted card the same way, in the other direction', () => {
    expect(withCollapsed({}, 'plansToday', true)).toEqual({ plansToday: true });
    expect(withCollapsed({ plansToday: true }, 'plansToday', false)).toEqual({});
  });

  it('leaves other cards alone', () => {
    const before: CollapsedCards = { habitsList: false, healthWeek: false };
    expect(withCollapsed(before, 'habitsList', true)).toEqual({ healthWeek: false });
  });

  it('does not mutate the bag it was given', () => {
    // The store holds this object; mutating it in place would skip Zustand's identity check and
    // leave the chevron drawn from a value nothing re-rendered for.
    const before: CollapsedCards = { habitsList: true };
    withCollapsed(before, 'healthWeek', true);
    expect(before).toEqual({ habitsList: true });
  });

  it('round-trips every id in both directions', () => {
    for (const id of CARD_IDS) {
      expect(isCollapsed(withCollapsed({}, id, true), id)).toBe(true);
      expect(isCollapsed(withCollapsed({}, id, false), id)).toBe(false);
    }
  });

  it('empties back to {} after moving every card and putting it back', () => {
    let bag: CollapsedCards = {};
    for (const id of CARD_IDS) bag = withCollapsed(bag, id, !defaultCollapsed(id));
    expect(Object.keys(bag)).toHaveLength(CARD_IDS.length);
    for (const id of CARD_IDS) bag = withCollapsed(bag, id, defaultCollapsed(id));
    // `{}` has to keep meaning "the app as designed" however much the user has fiddled.
    expect(bag).toEqual({});
  });
});

describe('sanitizeCollapsedCards — a bad value falls back to the resting state', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', ['habitsList']],
    ['a string', 'habitsList'],
    ['a number', 3],
  ])('degrades %s to an empty bag', (_label, raw) => {
    expect(sanitizeCollapsedCards(raw)).toEqual({});
  });

  it('drops an id this build does not know', () => {
    // A card removed in a later build, or a typo in a hand-edited backup. Keeping it would be
    // harmless today and a wrongly-folded card the day someone adds that id back.
    expect(sanitizeCollapsedCards({ notACard: true, habitsList: false })).toEqual({
      habitsList: false,
    });
  });

  it.each([
    ['a truthy string', 'yes'],
    ['1', 1],
    ['null', null],
  ])('drops %s as a value — only a real boolean counts', (_label, value) => {
    expect(sanitizeCollapsedCards({ habitsList: value })).toEqual({});
  });

  // Keeps the "only what the user moved" invariant true for a bag that reached us from an
  // older build, where every stored value was a `true` that now agrees with the default.
  it('drops a value that matches the card`s resting state', () => {
    expect(sanitizeCollapsedCards({ habitsList: true, healthWeek: true })).toEqual({});
    expect(sanitizeCollapsedCards({ plansToday: false })).toEqual({});
  });

  it('passes a clean bag through unchanged', () => {
    const bag = { habitsList: false, healthMedicine: false, plansToday: true };
    expect(sanitizeCollapsedCards(bag)).toEqual(bag);
  });
});

// The module header claims this and nothing checked it — the shape AGENTS.md's "a header that
// ASSERTS a safety property is not evidence the property holds" gotcha is about. It matters
// more now that the module imports something: a card's resting state is read on every tab's
// render path, so it must not be able to reach a store, the DB or the notification layer.
describe('lib/cardDefaults.ts and lib/collapsedCards.ts stay dependency-free', () => {
  const read = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
  const banned = [/@\/store\//, /@\/lib\/db/, /@\/lib\/notifications/, /@\/lib\/reminders/, /@\/lib\/liveSync/, /expo-/];

  it.each(['collapsedCards.ts', 'cardDefaults.ts', 'padState.ts'])('%s imports nothing heavy', (file) => {
    const imports = read(file)
      .split('\n')
      .filter((l) => /^import /.test(l))
      .join('\n');
    for (const pattern of banned) expect(imports).not.toMatch(pattern);
  });

  it('cardDefaults imports nothing at all, so neither reader can cycle through it', () => {
    expect(read('cardDefaults.ts')).not.toMatch(/^import /m);
  });
});

describe('the ids themselves', () => {
  it('has no duplicates', () => {
    // Two cards sharing a key would fold each other away.
    expect(new Set(CARD_IDS).size).toBe(CARD_IDS.length);
  });

  it('reserves no id that collides with a pad surface', () => {
    // lib/padState.ts's LayoutSurface keys the OTHER, three-state collapse. The two live in
    // different columns, so a collision is not a data bug — it is a sign somebody has given one
    // card both mechanisms, which is the thing lib/collapsedCards.ts's header forbids.
    const padSurfaces = ['shopping', 'plans', 'homeTodo', 'notes', 'habits', 'health'];
    for (const id of CARD_IDS) expect(padSurfaces).not.toContain(id);
  });
});
