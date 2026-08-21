/**
 * padState.test.ts — the three pad sizes: cycling, slicing, counting, and degradation.
 *
 * Two guarantees matter here beyond the arithmetic:
 *
 *  1. **A closed card draws no rows, but every one of those rows is still live.** The
 *     summary count is computed from the FULL list, never from what's visible — otherwise
 *     folding a card away would quietly tell the user they have less to do.
 *  2. **A bad stored value can't blank a card.** `card_states` is a JSON column that an older
 *     build, a hand-edited backup, or an AI-generated import can put anything into.
 */
import {
  PAD_STATES,
  isDoneRowStillInPlace,
  isPadState,
  nextPadState,
  padHiddenCount,
  padSpareLines,
  padVisibleRows,
  defaultPadState,
  resolveCardState,
  sanitizeCardStates,
  withCardState,
} from '@/lib/padState';
import { PAD_PREVIEW_ROWS, PAD_SPARE_LINES } from '@/constants/theme';

const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('nextPadState', () => {
  it('cycles preview → open → preview, so one chevron covers both', () => {
    expect(nextPadState('preview')).toBe('open');
    expect(nextPadState('open')).toBe('preview');
  });

  it('returns to the starting state after one full lap of every state', () => {
    let state = PAD_STATES[0];
    for (let i = 0; i < PAD_STATES.length; i++) state = nextPadState(state);
    expect(state).toBe(PAD_STATES[0]);
  });
});

describe('padVisibleRows', () => {
  it('draws the first PAD_PREVIEW_ROWS in the middle state', () => {
    expect(padVisibleRows(rows, 'preview')).toEqual(rows.slice(0, PAD_PREVIEW_ROWS));
  });

  it('draws everything when open', () => {
    expect(padVisibleRows(rows, 'open')).toEqual(rows);
  });

  it('never returns more rows than it was given', () => {
    const two = ['a', 'b'];
    expect(padVisibleRows(two, 'preview')).toEqual(two);
    expect(padVisibleRows([], 'open')).toEqual([]);
  });

  it('copies rather than aliasing the caller`s array', () => {
    const open = padVisibleRows(rows, 'open');
    open.push('h');
    expect(rows).toHaveLength(7);
  });
});

describe('padHiddenCount', () => {
  it('reports what preview holds back', () => {
    expect(padHiddenCount(rows.length, 'preview')).toBe(rows.length - PAD_PREVIEW_ROWS);
  });

  it('reports nothing hidden when open', () => {
    expect(padHiddenCount(rows.length, 'open')).toBe(0);
  });

  it('never goes negative when the list is shorter than the preview', () => {
    expect(padHiddenCount(1, 'preview')).toBe(0);
    expect(padHiddenCount(0, 'preview')).toBe(0);
  });

  it('agrees with padVisibleRows — visible + hidden is always the whole list', () => {
    for (const state of PAD_STATES) {
      expect(padVisibleRows(rows, state).length + padHiddenCount(rows.length, state)).toBe(
        rows.length
      );
    }
  });
});

describe('padSpareLines', () => {
  it('draws the spare lines in both open states', () => {
    expect(padSpareLines('preview')).toBe(PAD_SPARE_LINES);
    expect(padSpareLines('open')).toBe(PAD_SPARE_LINES);
  });
});

describe('isDoneRowStillInPlace', () => {
  it('keeps a row ticked today where it is, so the tap is visibly acknowledged', () => {
    expect(isDoneRowStillInPlace('2026-07-30', '2026-07-30')).toBe(true);
  });

  it('sinks a row ticked on any earlier day', () => {
    expect(isDoneRowStillInPlace('2026-07-29', '2026-07-30')).toBe(false);
    expect(isDoneRowStillInPlace('2025-01-01', '2026-07-30')).toBe(false);
  });

  it('treats an unstamped row as finished a while ago, so it sinks', () => {
    // A row ticked by a build older than the stamp column has ''. "Long ago" is the right
    // reading — the alternative would pin every historical row to today's pad forever.
    expect(isDoneRowStillInPlace('', '2026-07-30')).toBe(false);
  });

  it('does not treat a future stamp as today', () => {
    // Can only happen from a clock change or an edited backup; it must not stick around.
    expect(isDoneRowStillInPlace('2026-07-31', '2026-07-30')).toBe(false);
  });
});

describe('resolveCardState', () => {
  it('returns a surface`s stored state', () => {
    expect(resolveCardState({ notes: 'open' }, 'notes')).toBe('open');
  });

  // 2026-08-21: the default is per-surface now, not one constant. Both halves are asserted,
  // because "everything starts closed" is only true as a sentence while the exception list is
  // short — a third surface resting open would need this test changed, which is the point.
  it('rests the excepted surfaces at preview — To-do`s Today and Me`s Notes', () => {
    expect(defaultPadState('plans')).toBe('preview');
    expect(defaultPadState('notes')).toBe('preview');
    expect(resolveCardState({}, 'notes')).toBe('preview');
    expect(resolveCardState(undefined, 'plans')).toBe('preview');
  });

  // ⚠️ **Every surface rests at 'preview' as of 2026-08-21, with no exception list.** This axis
  // briefly rested at 'closed' for all but two surfaces, mirroring lib/collapsedCards.ts — two
  // mechanisms owning open/closed with two columns and two answers to what the word means, which
  // is the *"not all cards can be collapsed"* half of the report. `'closed'` is gone from
  // `PadState`; a card's fold is lib/collapsedCards.ts over lib/cardRegistry.ts, for every card.
  it('rests every surface at preview', () => {
    expect(defaultPadState('habits')).toBe('preview');
    expect(defaultPadState('shopping')).toBe('preview');
    expect(defaultPadState('health')).toBe('preview');
    expect(defaultPadState('homeTodo')).toBe('preview');
    expect(defaultPadState('notes')).toBe('preview');
    expect(resolveCardState({}, 'habits')).toBe('preview');
    expect(resolveCardState(undefined, 'habits')).toBe('preview');
  });

  it('ignores another surface`s entry', () => {
    expect(resolveCardState({ shopping: 'open' }, 'notes')).toBe('preview');
  });

  it('degrades an unknown value to that surface`s own resting state', () => {
    expect(resolveCardState({ notes: 'gigantic' }, 'notes')).toBe('preview');
    expect(resolveCardState({ habits: 'gigantic' }, 'habits')).toBe('preview');
  });
});

describe('withCardState', () => {
  it('merges rather than replacing — one card`s chevron must not clear another`s', () => {
    expect(withCardState({ notes: 'open' }, 'shopping', 'open')).toEqual({
      notes: 'open',
      shopping: 'open',
    });
  });

  it('overwrites the same surface', () => {
    expect(withCardState({ notes: 'preview' }, 'notes', 'open')).toEqual({ notes: 'open' });
  });

  // The bag is "what the user moved", never "what every surface is set to". Storing a value
  // that equals the default would freeze that surface if the default ever moved again.
  it('deletes the key when the chosen state IS the surface`s resting state', () => {
    expect(withCardState({ notes: 'open' }, 'notes', 'preview')).toEqual({});
    expect(withCardState({ habits: 'open' }, 'habits', 'preview')).toEqual({});
  });

  it('keeps other surfaces while deleting one back to its default', () => {
    expect(withCardState({ notes: 'open', habits: 'open' }, 'notes', 'preview')).toEqual({
      habits: 'open',
    });
  });

  it('returns a new object, so the store sees a changed reference', () => {
    const before = { notes: 'open' };
    expect(withCardState(before, 'notes', 'open')).not.toBe(before);
    expect(before).toEqual({ notes: 'open' });
  });

  it('does not mutate the input when deleting a key back to the default', () => {
    const before = { notes: 'open' };
    expect(withCardState(before, 'notes', 'preview')).not.toBe(before);
    expect(before).toEqual({ notes: 'open' });
  });

  it('copes with no stored states at all', () => {
    expect(withCardState(undefined, 'notes', 'open')).toEqual({ notes: 'open' });
  });
});

describe('sanitizeCardStates', () => {
  it('keeps valid entries', () => {
    expect(sanitizeCardStates({ notes: 'preview', plans: 'open' })).toEqual({
      notes: 'preview',
      plans: 'open',
    });
  });

  it('drops unknown values and non-strings', () => {
    expect(sanitizeCardStates({ notes: 'gigantic', plans: 4, shopping: 'open' })).toEqual({
      shopping: 'open',
    });
  });

  it('survives anything a bad column could hold', () => {
    expect(sanitizeCardStates(null)).toEqual({});
    expect(sanitizeCardStates(undefined)).toEqual({});
    expect(sanitizeCardStates('open')).toEqual({});
    expect(sanitizeCardStates(['open'])).toEqual({});
    expect(sanitizeCardStates(7)).toEqual({});
  });
});

describe('isPadState', () => {
  it('accepts exactly the three states', () => {
    for (const state of PAD_STATES) expect(isPadState(state)).toBe(true);
    expect(isPadState('expanded')).toBe(false);
    expect(isPadState('')).toBe(false);
    expect(isPadState(undefined)).toBe(false);
  });
});

describe('pad sizes are presentation only', () => {
  it('padState.ts reaches no notification, reminder, db or store module', () => {
    // Same structural guarantee lib/cardLayout.ts carries: how BIG a card is drawn must never
    // be able to create, cancel or reschedule anything. A closed card still owns its rows'
    // reminders. If this needs store state, pass it in as an argument.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'padState.ts'),
      'utf8'
    );
    const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m: string[]) => m[1]);
    for (const spec of imports) {
      expect(spec).not.toMatch(/notifications|reminders|\/db$|store\//);
    }
    // The only runtime import is the token module; lib/cardLayout is type-only.
    expect(imports).toContain('@/constants/theme');
  });
});
