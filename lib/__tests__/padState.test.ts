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
  DEFAULT_PAD_STATE,
  PAD_STATES,
  isPadState,
  nextPadState,
  padHiddenCount,
  padSpareLines,
  padVisibleRows,
  resolveCardState,
  sanitizeCardStates,
  withCardState,
} from '@/lib/padState';
import { PAD_PREVIEW_ROWS, PAD_SPARE_LINES } from '@/constants/theme';

const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('nextPadState', () => {
  it('cycles closed → preview → open → closed, so one chevron covers all three', () => {
    expect(nextPadState('closed')).toBe('preview');
    expect(nextPadState('preview')).toBe('open');
    expect(nextPadState('open')).toBe('closed');
  });

  it('returns to the starting state after one full lap of every state', () => {
    let state = PAD_STATES[0];
    for (let i = 0; i < PAD_STATES.length; i++) state = nextPadState(state);
    expect(state).toBe(PAD_STATES[0]);
  });
});

describe('padVisibleRows', () => {
  it('draws nothing when closed', () => {
    expect(padVisibleRows(rows, 'closed')).toEqual([]);
  });

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
  it('reports the whole list as hidden when closed — the rows are still there', () => {
    expect(padHiddenCount(rows.length, 'closed')).toBe(rows.length);
  });

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
  it('draws no spare paper on a closed card', () => {
    // A closed card is header + summary + the type line; spare rules there would undo the
    // point of closing it.
    expect(padSpareLines('closed')).toBe(0);
  });

  it('draws the spare lines in both open states', () => {
    expect(padSpareLines('preview')).toBe(PAD_SPARE_LINES);
    expect(padSpareLines('open')).toBe(PAD_SPARE_LINES);
  });
});

describe('resolveCardState', () => {
  it('returns a surface`s stored state', () => {
    expect(resolveCardState({ notes: 'closed' }, 'notes')).toBe('closed');
  });

  it('defaults to preview, so an upgrading user sees roughly the card they already had', () => {
    expect(DEFAULT_PAD_STATE).toBe('preview');
    expect(resolveCardState({}, 'notes')).toBe('preview');
    expect(resolveCardState(undefined, 'notes')).toBe('preview');
  });

  it('ignores another surface`s entry', () => {
    expect(resolveCardState({ shopping: 'open' }, 'notes')).toBe('preview');
  });

  it('degrades an unknown value instead of resolving to nothing', () => {
    expect(resolveCardState({ notes: 'gigantic' }, 'notes')).toBe('preview');
  });
});

describe('withCardState', () => {
  it('merges rather than replacing — one card`s chevron must not clear another`s', () => {
    expect(withCardState({ notes: 'open' }, 'shopping', 'closed')).toEqual({
      notes: 'open',
      shopping: 'closed',
    });
  });

  it('overwrites the same surface', () => {
    expect(withCardState({ notes: 'open' }, 'notes', 'closed')).toEqual({ notes: 'closed' });
  });

  it('returns a new object, so the store sees a changed reference', () => {
    const before = { notes: 'open' };
    expect(withCardState(before, 'notes', 'closed')).not.toBe(before);
    expect(before).toEqual({ notes: 'open' });
  });

  it('copes with no stored states at all', () => {
    expect(withCardState(undefined, 'notes', 'open')).toEqual({ notes: 'open' });
  });
});

describe('sanitizeCardStates', () => {
  it('keeps valid entries', () => {
    expect(sanitizeCardStates({ notes: 'closed', plans: 'open' })).toEqual({
      notes: 'closed',
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
