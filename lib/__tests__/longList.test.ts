/**
 * longList.test.ts — the ceiling on an already-unfolded list.
 *
 * What these pin is that the cap is INVISIBLE until it matters. The everyday case — a section
 * with fewer rows than LONG_LIST_CAP — must be byte-for-byte the old behaviour: same array, same
 * identity, no control drawn. A performance floor that changes what a normal user sees is not a
 * floor, it is a redesign.
 */
import { longListHidden, longListVisible } from '@/lib/longList';
import { LONG_LIST_CAP } from '@/constants/theme';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

describe('longListVisible', () => {
  it('returns the SAME array when nothing is held back, so no memo downstream is disturbed', () => {
    // Identity, not just equality: a fresh array every render would make this cap cost more
    // than the rows it saves.
    const under = rows(LONG_LIST_CAP - 1);
    expect(longListVisible(under, false)).toBe(under);
    const exact = rows(LONG_LIST_CAP);
    expect(longListVisible(exact, false)).toBe(exact);
    const over = rows(LONG_LIST_CAP + 1);
    expect(longListVisible(over, true)).toBe(over);
  });

  it('draws exactly LONG_LIST_CAP rows once the list is over it', () => {
    const over = rows(LONG_LIST_CAP + 250);
    expect(longListVisible(over, false)).toHaveLength(LONG_LIST_CAP);
  });

  it('keeps the list in order and takes it from the FRONT', () => {
    // The Done zone is newest-first; taking from the back would show the oldest completions,
    // which is the opposite of what the section is for.
    const over = rows(LONG_LIST_CAP + 5);
    const shown = longListVisible(over, false);
    expect(shown[0]).toBe(over[0]);
    expect(shown[shown.length - 1]).toBe(over[LONG_LIST_CAP - 1]);
  });

  it('shows everything once the user asks, however long', () => {
    const over = rows(LONG_LIST_CAP * 20);
    expect(longListVisible(over, true)).toHaveLength(LONG_LIST_CAP * 20);
  });

  it('handles an empty list without inventing a control', () => {
    expect(longListVisible([], false)).toEqual([]);
    expect(longListHidden(0, false)).toBe(0);
  });
});

describe('longListHidden — the number on the control, and when it is absent', () => {
  it('is 0 at and below the cap, so the control never renders in the everyday case', () => {
    expect(longListHidden(0, false)).toBe(0);
    expect(longListHidden(LONG_LIST_CAP - 1, false)).toBe(0);
    expect(longListHidden(LONG_LIST_CAP, false)).toBe(0);
  });

  it('counts exactly what is not drawn', () => {
    expect(longListHidden(LONG_LIST_CAP + 1, false)).toBe(1);
    expect(longListHidden(LONG_LIST_CAP + 373, false)).toBe(373);
  });

  it('is 0 once everything is shown, so the control disappears rather than saying "0 more"', () => {
    expect(longListHidden(LONG_LIST_CAP + 373, true)).toBe(0);
  });

  it('agrees with longListVisible at every boundary', () => {
    // The two are read together at the call site — the control's count must equal what the
    // slice left out, or the row lies about how much is behind it.
    for (const total of [0, 1, LONG_LIST_CAP - 1, LONG_LIST_CAP, LONG_LIST_CAP + 1, LONG_LIST_CAP * 3]) {
      const all = rows(total);
      for (const showAll of [false, true]) {
        expect(longListHidden(total, showAll)).toBe(total - longListVisible(all, showAll).length);
      }
    }
  });
});

describe('the cap is a ceiling, not a preview', () => {
  it('is far above PAD_PREVIEW_ROWS, or it would be a second preview length', () => {
    // These answer different questions (see lib/longList.ts's header). If they ever converge,
    // one of them has drifted into the other's job.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PAD_PREVIEW_ROWS } = require('@/constants/theme');
    expect(LONG_LIST_CAP).toBeGreaterThan(PAD_PREVIEW_ROWS * 5);
  });
});
