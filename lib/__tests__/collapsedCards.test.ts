/**
 * collapsedCards.test.ts — the fold-away bag, and the rules that keep a card findable.
 *
 * **This file's premise inverted on 2026-08-21.** It used to say every unknown, malformed or
 * legacy value had to resolve to "open", on the reasoning that a card folded away hides a
 * surface with no way back. That reasoning was always half wrong — a folded card keeps its
 * header, its count and its chevron, so the way back is on screen — and the maintainer has
 * since asked for closed to be the resting state (*"All card start in closed state, except
 * 'Today' 'Notes' and 'Shopping' in middle screen"*). What is guarded now is that the resting
 * state comes from ONE place (lib/cardRegistry.ts's `openAtRest`), that the bag stores only what the user has
 * moved off it, and that the exception list names ids that really exist.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { CARD_KEYS, cardSpec } from '@/lib/cardRegistry';
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
    expect(isCollapsed({}, 'healthIssues')).toBe(true);
  });

  it('survives an undefined bag', () => {
    // The state before the column has ever been written.
    expect(isCollapsed(undefined, 'healthIssues')).toBe(true);
  });

  it('reads an excepted card as open when unset', () => {
    expect(isCollapsed({}, 'homeToday')).toBe(false);
  });

  it('reads a stored value in both directions', () => {
    expect(isCollapsed({ healthIssues: true }, 'healthIssues')).toBe(true);
    // An explicit false is meaningful now: with closed as the default, it is the only way to
    // record "I opened this one". Before the inversion this case was legacy data.
    expect(isCollapsed({ healthIssues: false }, 'healthIssues')).toBe(false);
    expect(isCollapsed({ homeToday: true }, 'homeToday')).toBe(true);
  });
});

describe('defaultCollapsed — one short exception list', () => {
  it('rests Home`s Today open', () => {
    expect(defaultCollapsed('homeToday')).toBe(false);
  });

  it('rests every other card closed', () => {
    for (const id of CARD_IDS) {
      if (cardSpec(id).openAtRest) continue;
      expect(defaultCollapsed(id)).toBe(true);
    }
  });

  // "Everything starts closed" is only true as a sentence while this stays bounded. Home keeps
  // THREE — the number the maintainer named, Today/Notes/Shopping — and a fourth there is a
  // decision that should cost a failing test to make. Every OTHER screen may except at most its
  // OWN first card (2026-08-26, phase 5 decision (b) of DESIGN_COMPARISON/19-IMPLEMENTATION.md
  // — see lib/__tests__/cardRegistry.test.ts's fuller version of this same rule, which also
  // checks it's the right card, not just the right count).
  it('excepts no more cards than the maintainer named', () => {
    const excepted = CARD_KEYS.filter((k) => cardSpec(k).openAtRest);
    expect(excepted.length).toBeLessThanOrEqual(7);
    const byScreen = new Map<string, number>();
    for (const key of excepted) {
      const screen = cardSpec(key).screen;
      byScreen.set(screen, (byScreen.get(screen) ?? 0) + 1);
    }
    for (const [screen, count] of byScreen) {
      expect(count).toBeLessThanOrEqual(screen === 'home' ? 3 : 1);
    }
  });
});

describe('withCollapsed — the bag holds only what the user moved', () => {
  it('stores a card opened against its resting state', () => {
    expect(withCollapsed({}, 'healthMedicine', false)).toEqual({ healthMedicine: false });
  });

  it('DELETES when the chosen state IS the resting state', () => {
    const out = withCollapsed({ healthMedicine: false }, 'healthMedicine', true);
    expect(out).toEqual({});
    expect('healthMedicine' in out).toBe(false);
  });

  it('stores an excepted card the same way, in the other direction', () => {
    expect(withCollapsed({}, 'homeToday', true)).toEqual({ homeToday: true });
    expect(withCollapsed({ homeToday: true }, 'homeToday', false)).toEqual({});
  });

  it('leaves other cards alone', () => {
    const before: CollapsedCards = { healthMedicine: false, healthIssues: false };
    expect(withCollapsed(before, 'healthMedicine', true)).toEqual({ healthIssues: false });
  });

  it('does not mutate the bag it was given', () => {
    // The store holds this object; mutating it in place would skip Zustand's identity check and
    // leave the chevron drawn from a value nothing re-rendered for.
    const before: CollapsedCards = { healthMedicine: true };
    withCollapsed(before, 'healthIssues', true);
    expect(before).toEqual({ healthMedicine: true });
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
    ['an array', ['healthMedicine']],
    ['a string', 'healthMedicine'],
    ['a number', 3],
  ])('degrades %s to an empty bag', (_label, raw) => {
    expect(sanitizeCollapsedCards(raw)).toEqual({});
  });

  it('drops an id this build does not know', () => {
    // A card removed in a later build, or a typo in a hand-edited backup. Keeping it would be
    // harmless today and a wrongly-folded card the day someone adds that id back.
    expect(sanitizeCollapsedCards({ notACard: true, healthMedicine: false })).toEqual({
      healthMedicine: false,
    });
  });

  it.each([
    ['a truthy string', 'yes'],
    ['1', 1],
    ['null', null],
  ])('drops %s as a value — only a real boolean counts', (_label, value) => {
    expect(sanitizeCollapsedCards({ healthMedicine: value })).toEqual({});
  });

  // Keeps the "only what the user moved" invariant true for a bag that reached us from an
  // older build, where every stored value was a `true` that now agrees with the default.
  it('drops a value that matches the card`s resting state', () => {
    expect(sanitizeCollapsedCards({ healthMedicine: true, healthIssues: true })).toEqual({});
    expect(sanitizeCollapsedCards({ homeToday: false })).toEqual({});
  });

  it('passes a clean bag through unchanged', () => {
    const bag = { healthIssues: false, healthMedicine: false, homeToday: true };
    expect(sanitizeCollapsedCards(bag)).toEqual(bag);
  });
});

// The module header claims this and nothing checked it — the shape AGENTS.md's "a header that
// ASSERTS a safety property is not evidence the property holds" gotcha is about. It matters
// more now that the module imports something: a card's resting state is read on every tab's
// render path, so it must not be able to reach a store, the DB or the notification layer.
describe('lib/cardRegistry.ts and lib/collapsedCards.ts stay dependency-free', () => {
  const read = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
  const banned = [/@\/store\//, /@\/lib\/db/, /@\/lib\/notifications/, /@\/lib\/reminders/, /@\/lib\/liveSync/, /expo-/];

  it.each(['collapsedCards.ts', 'cardRegistry.ts', 'padState.ts'])('%s imports nothing heavy', (file) => {
    const imports = read(file)
      .split('\n')
      .filter((l) => /^import /.test(l))
      .join('\n');
    for (const pattern of banned) expect(imports).not.toMatch(pattern);
  });

  // The registry is imported by both fold and expand and is evaluated on every tab's render
  // path, so its own imports must be TYPE-only — an erased import cannot pull a store in.
  it('cardRegistry imports only types', () => {
    const imports = read('cardRegistry.ts')
      .split('\n')
      .filter((l) => /^import /.test(l));
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line).toMatch(/^import type /);
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
