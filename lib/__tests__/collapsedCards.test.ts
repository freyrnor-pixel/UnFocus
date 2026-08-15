/**
 * collapsedCards.test.ts — the fold-away bag, and the two rules that keep a card findable.
 *
 * The failure mode this guards is specific and one-directional: a bug that leaves a card OPEN
 * costs a re-tap, and a bug that leaves it COLLAPSED hides a surface with no way back, because
 * the only control that could bring it back is inside the header of the card that vanished. So
 * every unknown, malformed or legacy value has to resolve to "open".
 */
import {
  CARD_IDS,
  CollapsedCards,
  isCollapsed,
  sanitizeCollapsedCards,
  withCollapsed,
} from '@/lib/collapsedCards';

describe('isCollapsed — absent means open', () => {
  it('reads an unset card as open', () => {
    expect(isCollapsed({}, 'healthWeek')).toBe(false);
  });

  it('survives an undefined bag', () => {
    // The state before the column has ever been written — i.e. every existing install.
    expect(isCollapsed(undefined, 'healthWeek')).toBe(false);
  });

  it('reads a stored card as collapsed', () => {
    expect(isCollapsed({ healthWeek: true }, 'healthWeek')).toBe(true);
  });

  it('does not treat a stored `false` as collapsed', () => {
    // withCollapsed never writes one, but a hand-edited backup or an older build might.
    expect(isCollapsed({ healthWeek: false }, 'healthWeek')).toBe(false);
  });
});

describe('withCollapsed — the bag holds only what is folded away', () => {
  it('adds a card', () => {
    expect(withCollapsed({}, 'habitsList', true)).toEqual({ habitsList: true });
  });

  it('DELETES on expand rather than storing false', () => {
    const out = withCollapsed({ habitsList: true }, 'habitsList', false);
    expect(out).toEqual({});
    expect('habitsList' in out).toBe(false);
  });

  it('leaves other cards alone', () => {
    const before: CollapsedCards = { habitsList: true, healthWeek: true };
    expect(withCollapsed(before, 'habitsList', false)).toEqual({ healthWeek: true });
  });

  it('does not mutate the bag it was given', () => {
    // The store holds this object; mutating it in place would skip Zustand's identity check and
    // leave the chevron drawn from a value nothing re-rendered for.
    const before: CollapsedCards = { habitsList: true };
    withCollapsed(before, 'healthWeek', true);
    expect(before).toEqual({ habitsList: true });
  });

  it('round-trips every id', () => {
    for (const id of CARD_IDS) {
      expect(isCollapsed(withCollapsed({}, id, true), id)).toBe(true);
      expect(isCollapsed(withCollapsed({ [id]: true }, id, false), id)).toBe(false);
    }
  });

  it('empties back to {} after collapsing and expanding everything', () => {
    let bag: CollapsedCards = {};
    for (const id of CARD_IDS) bag = withCollapsed(bag, id, true);
    expect(Object.keys(bag)).toHaveLength(CARD_IDS.length);
    for (const id of CARD_IDS) bag = withCollapsed(bag, id, false);
    // `{}` has to keep meaning "nothing is collapsed" however much the user has fiddled.
    expect(bag).toEqual({});
  });
});

describe('sanitizeCollapsedCards — a bad value can only leave a card visible', () => {
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
    // harmless today and a hidden card the day someone adds that id back.
    expect(sanitizeCollapsedCards({ notACard: true, habitsList: true })).toEqual({ habitsList: true });
  });

  it.each([
    ['false', false],
    ['a truthy string', 'yes'],
    ['1', 1],
    ['null', null],
  ])('drops %s as a value — only literal true collapses a card', (_label, value) => {
    expect(sanitizeCollapsedCards({ habitsList: value })).toEqual({});
  });

  it('passes a clean bag through unchanged', () => {
    const bag = { habitsList: true, healthMedicine: true };
    expect(sanitizeCollapsedCards(bag)).toEqual(bag);
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
