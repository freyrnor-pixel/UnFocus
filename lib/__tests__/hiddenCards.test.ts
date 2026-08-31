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
 * 3. **There is ONE mechanism, on all five screens.** ⚠️ This assertion was the opposite until
 *    2026-09-01: it pinned the sheet to the four non-Home tabs, because Home hid cards through
 *    a per-card ⋮ over its own `settings.homeCardOrder` column and two mechanisms acting on one
 *    card is how a card comes back from one and stays gone in the other. The maintainer's
 *    ruling — *"One button per screen for reordering and/or hiding cards instead of the three
 *    dots was disregarded"* — settles that by removing the OTHER mechanism, not by adding a
 *    second one: `lib/homeCards.ts`, `components/HomeCardManager.tsx` and
 *    `components/CardMenuSheet.tsx` are deleted, so what the old assertion was protecting
 *    against no longer exists to conflict with. What is pinned now is the absence of a second
 *    route: no screen may draw a per-card ⋮ again.
 */
import { readdirSync, readFileSync } from 'fs';
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

describe('one mechanism, on all five screens', () => {
  it('is mounted by every tab screen, Home included', () => {
    const tabs = ['index', 'shopping', 'plans', 'habits', 'health'];
    for (const f of tabs) expect(read(`app/(tabs)/${f}.tsx`)).toMatch(/<ManageCardsSheet/);
  });

  it('names a screen the registry actually has cards for', () => {
    const screens = ['shop', 'todo', 'habits', 'health', 'home'] as const;
    for (const screen of screens) expect(cardsForScreen(screen).length).toBeGreaterThan(0);
  });

  it('⚠️ nothing rebuilds the per-card ⋮ the sheet replaced', () => {
    // The three files are deleted; this is what stops the SHAPE coming back under a new name.
    // A card-level hide route is not a smaller version of this sheet — it is the second
    // mechanism the old scoping rule existed to prevent, and the reason it could be dropped is
    // that the first one went away.
    //
    // IMPORTS and JSX only, deliberately, not a bare string scan: several files legitimately
    // mention these names in prose ("same idiom as HomeCardManager"), and a scan that fails on
    // a comment teaches the next session to delete the history rather than the code.
    const offenders: string[] = [];
    for (const dir of ['components', 'app/(tabs)']) {
      for (const file of readdirSync(join(ROOT, dir))) {
        if (!file.endsWith('.tsx')) continue;
        const src = read(`${dir}/${file}`);
        if (/from '@\/(components\/(CardMenuSheet|HomeCardManager)|lib\/homeCards)'/.test(src)) offenders.push(file);
        if (/<CardMenu(Button|Sheet)\b/.test(src)) offenders.push(file);
        if (/\bhomeCardOrder:/.test(src)) offenders.push(file); // a write, not a mention
      }
    }
    expect(offenders).toEqual([]);
  });

  it('⚠️ no screen with the sheet also draws a "Retired" shelf', () => {
    // lib/hiddenCards.ts's own header: the sheet lists every card present-or-absent, so a shelf
    // would be a second place saying the same thing. Home had one BECAUSE its hide affordance
    // was per-card; that reason left with the ⋮.
    expect(read('lib/cardRegistry.ts')).not.toMatch(/^\s*homeRetired: \{/m);
  });
});
