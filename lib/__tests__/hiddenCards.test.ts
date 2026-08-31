/**
 * hiddenCards.test.ts — putting a card away, and the three properties that make it safe.
 *
 * Hiding is the fourth and most drastic of the card axes: a collapsed card keeps its header, its
 * count and its chevron, so the way back is on screen — a hidden one is not drawn at all, and the
 * only way back is components/ManageCardsSheet.tsx. That asymmetry is what these tests guard.
 *
 * 1. **The module stays dependency-free.** `useIsCardHidden` runs in the render path of EVERY
 *    card in the app (components/Card.tsx calls it unconditionally), so the arithmetic behind it
 *    must not be able to reach a store, the DB, the notification layer or the sync layer. Same
 *    source scan lib/__tests__/collapsedCards.test.ts runs, for the same reason.
 * 2. **Unknown ids are dropped on read**, so a card removed from the registry or a backup from an
 *    older build cannot leave a sheet row pointing at nothing.
 * 3. **Nothing hides a Home card.** Home has its own mechanism (components/HomeCardManager.tsx +
 *    lib/homeCards.ts's forced-restore rule, which exists because Home's cards are PREVIEWS of
 *    other tabs). Two mechanisms acting on one card is how a card comes back from one and stays
 *    gone in the other, so the sheet is only mounted by the four non-Home tabs — asserted here
 *    against their real source rather than promised in a header.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { CARD_KEYS, cardsForScreen } from '@/lib/cardRegistry';
import type { CardKey } from '@/lib/cardRegistry';
import { isHidden, sanitizeHiddenCards, withHidden } from '@/lib/hiddenCards';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('sanitizeHiddenCards — anything unrecognised becomes "the app as designed"', () => {
  it('reads a never-written column as nothing hidden', () => {
    expect(sanitizeHiddenCards(undefined)).toEqual([]);
    expect(sanitizeHiddenCards(null)).toEqual([]);
  });

  it('rejects a value of the wrong SHAPE rather than half-applying it', () => {
    // The bag shape collapsedCards uses is the most plausible wrong value here, since the two
    // columns sit next to each other and are edited by the same kind of pass.
    expect(sanitizeHiddenCards({ todoMonth: true })).toEqual([]);
    expect(sanitizeHiddenCards('todoCalendar')).toEqual([]);
    expect(sanitizeHiddenCards(7)).toEqual([]);
  });

  it('drops unknown ids and keeps the rest', () => {
    expect(sanitizeHiddenCards(['todoCalendar', 'notACard', 42, null])).toEqual(['todoCalendar']);
  });

  it('de-duplicates, so a row cannot be listed twice', () => {
    expect(sanitizeHiddenCards(['todoCalendar', 'todoCalendar'])).toEqual(['todoCalendar']);
  });

  it('round-trips a clean value', () => {
    const value = ['todoCalendar', 'todoRecurring'];
    expect(sanitizeHiddenCards(value)).toEqual(value);
  });
});

describe('withHidden — one id moves, every other card is left alone', () => {
  it('adds and removes', () => {
    expect(withHidden([], 'todoCalendar', true)).toEqual(['todoCalendar']);
    expect(withHidden(['todoCalendar'], 'todoCalendar', false)).toEqual([]);
  });

  it('is idempotent in both directions', () => {
    expect(withHidden(['todoCalendar'], 'todoCalendar', true)).toEqual(['todoCalendar']);
    expect(withHidden([], 'todoCalendar', false)).toEqual([]);
  });

  it('does not disturb its neighbours', () => {
    const before: CardKey[] = ['todoCalendar', 'todoRecurring'];
    expect(withHidden(before, 'todoWhenever', true)).toEqual([...before, 'todoWhenever']);
    expect(withHidden(before, 'todoCalendar', false)).toEqual(['todoRecurring']);
  });

  it('never returns a value the sanitizer would change', () => {
    let bag = sanitizeHiddenCards([]);
    for (const id of CARD_KEYS) bag = withHidden(bag, id, true);
    expect(sanitizeHiddenCards(bag)).toEqual(bag);
  });
});

describe('isHidden', () => {
  it('defaults to visible for every card the registry knows', () => {
    for (const id of CARD_KEYS) expect(isHidden([], id)).toBe(false);
  });

  it('reads a stored id', () => {
    expect(isHidden(['todoCalendar'], 'todoCalendar')).toBe(true);
    expect(isHidden(['todoCalendar'], 'todoRecurring')).toBe(false);
  });
});

describe('lib/hiddenCards.ts stays dependency-free', () => {
  // The header claims it; AGENTS.md's "a header that ASSERTS a safety property is not evidence
  // the property holds" gotcha is why it is checked. This one runs on every card's render.
  const banned = [/@\/store\//, /@\/lib\/db/, /@\/lib\/notifications/, /@\/lib\/reminders/, /@\/lib\/liveSync/, /expo-/];

  it('imports nothing heavy', () => {
    const imports = read('lib/hiddenCards.ts')
      .split('\n')
      .filter((l) => /^import /.test(l))
      .join('\n');
    for (const pattern of banned) expect(imports).not.toMatch(pattern);
  });
});

describe('the sheet is scoped to the four non-Home tabs', () => {
  // Home's cards are previews of other tabs and carry lib/homeCards.ts's forced-restore rule.
  // If both mechanisms could act on one card, a card put away here would come back there.
  it('is mounted by exactly the four tab screens, and never for Home', () => {
    const mounts = ['shopping', 'plans', 'habits', 'health'].map((f) => read(`app/(tabs)/${f}.tsx`));
    for (const src of mounts) expect(src).toMatch(/<ManageCardsSheet/);
    expect(read('app/(tabs)/index.tsx')).not.toMatch(/ManageCardsSheet/);
  });

  it('names a screen the registry actually has cards for', () => {
    const screens = ['shop', 'todo', 'habits', 'health'] as const;
    for (const screen of screens) expect(cardsForScreen(screen).length).toBeGreaterThan(0);
    // Home's cards exist and are deliberately unreachable from this sheet.
    expect(cardsForScreen('home').length).toBeGreaterThan(0);
  });
});
