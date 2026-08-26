/**
 * cardRegistry.test.ts — the generator, not the instances.
 *
 * Every previous guard on card anatomy was a source scan over an ALLOWLIST, so a new card was
 * compliant by default and the tests stayed green while the screen stayed wrong. These
 * assertions are about the registry itself: every card that is drawn is declared, every card
 * that is declared is drawn, and every `'none'` is a decision somebody wrote down.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { CARDS, CARD_KEYS, CardKey, cardSpec, cardsForScreen } from '@/lib/cardRegistry';
import { CARD_IDS } from '@/lib/collapsedCards';
import { EXPANDABLE_CARD_IDS } from '@/lib/expandableCards';

const ROOT = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !full.includes('__tests__')) out.push(full);
  }
  return out;
}

const SOURCES = ['app', 'components', 'lib', 'store'].flatMap((d) => walk(join(ROOT, d)));
const ALL_SOURCE = SOURCES.map((f) => readFileSync(f, 'utf8')).join('\n');

describe('every declaration is honest', () => {
  it('gives a card that does not fold a written reason', () => {
    for (const key of CARD_KEYS) {
      const spec = cardSpec(key);
      if (spec.fold === 'persisted') continue;
      expect(spec.foldDeclined?.trim().length ?? 0).toBeGreaterThan(20);
    }
  });

  it('gives a card that does not expand a written reason', () => {
    for (const key of CARD_KEYS) {
      const spec = cardSpec(key);
      if (spec.expand === 'surface') continue;
      // Long enough to be a sentence: "n/a" or "TODO" is the thing this exists to refuse. The
      // repo banned stub full-screen panes on 2026-08-21, so declining is supported and a
      // placeholder is not — but only as a decision, never as a gap.
      expect(spec.expandDeclined?.trim().length ?? 0).toBeGreaterThan(20);
    }
  });

  it('never carries a reason for something it does do', () => {
    for (const key of CARD_KEYS) {
      const spec = cardSpec(key);
      if (spec.fold === 'persisted') expect(spec.foldDeclined).toBeUndefined();
      if (spec.expand === 'surface') expect(spec.expandDeclined).toBeUndefined();
    }
  });
});

describe('each screen has a deliberate order', () => {
  it.each(['home', 'todo', 'shop', 'habits', 'health'] as const)('%s numbers its cards uniquely', (screen) => {
    const keys = cardsForScreen(screen);
    expect(keys.length).toBeGreaterThan(0);
    const orders = keys.map((k) => cardSpec(k).order);
    for (const order of orders) expect(typeof order).toBe('number');
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('gives a nested card no screen position, because it has none', () => {
    for (const key of CARD_KEYS) {
      const spec = cardSpec(key);
      if (!spec.nested) continue;
      expect(spec.order).toBeUndefined();
      // A nested card names a real host, and the host is not itself nested.
      expect(CARD_KEYS).toContain(spec.nested as CardKey);
      expect(cardSpec(spec.nested as CardKey).nested).toBeUndefined();
    }
  });

  // Closed is the resting state. Two SEPARATE exceptions, and the rule has to say both:
  // (1) Home keeps its three maintainer-named cards (Today/Notes/Shopping, 2026-08-21 — "all
  // cards start closed, except 'Today' 'Notes' and 'Shopping' in middle screen") — up to three
  // there, and this test doesn't care which three. (2) Every OTHER screen may rest its own
  // FIRST card open (2026-08-26, phase 5 decision (b) of DESIGN_COMPARISON/19-IMPLEMENTATION.md
  // — "the first card on each screen rests open"), at most one there, and it has to actually BE
  // that screen's lowest `order`. This replaced a flat global cap of 3, which was right only
  // while Home was the one screen with an exception at all — the cap stopped being a sentence
  // the moment a second screen got one.
  it('opens at most three cards at rest on Home, at most one elsewhere — and elsewhere it must be that screen\'s first card', () => {
    for (const screen of ['home', 'todo', 'shop', 'habits', 'health'] as const) {
      const keys = cardsForScreen(screen);
      const openKeys = keys.filter((k) => cardSpec(k).openAtRest);
      if (screen === 'home') {
        expect(openKeys.length).toBeLessThanOrEqual(3);
        continue;
      }
      expect(openKeys.length).toBeLessThanOrEqual(1);
      if (openKeys.length === 1) {
        const firstKey = [...keys].sort((a, b) => (cardSpec(a).order ?? 0) - (cardSpec(b).order ?? 0))[0];
        expect(openKeys[0]).toBe(firstKey);
      }
    }
  });
});

describe('the derived unions are the registry', () => {
  it('folds exactly the persisted cards', () => {
    expect([...CARD_IDS].sort()).toEqual(CARD_KEYS.filter((k) => cardSpec(k).fold === 'persisted').sort());
  });

  it('expands exactly the surface cards', () => {
    expect([...EXPANDABLE_CARD_IDS].sort()).toEqual(
      CARD_KEYS.filter((k) => cardSpec(k).expand === 'surface').sort(),
    );
  });

  it('has no duplicate keys', () => {
    expect(new Set(CARD_KEYS).size).toBe(CARD_KEYS.length);
  });
});

describe('declared and drawn are the same set', () => {
  // The half tsc cannot do: `id: CardKey` makes an UNDECLARED card impossible, and nothing in
  // the type system notices a declared card that nothing mounts. A dead entry is what kept
  // `shopLists`' stub pane alive with a passing test over it for two days.
  it('mounts every declared card somewhere', () => {
    for (const key of CARD_KEYS) {
      expect(ALL_SOURCE.includes(`'${key}'`) || ALL_SOURCE.includes(`"${key}"`)).toBe(true);
    }
  });

  it('names a real i18n key for every title', () => {
    // Cheap smoke test: the title thunks are typed against `Translations`, so this is really
    // asserting that none of them was stubbed out to a literal.
    for (const key of CARD_KEYS) expect(typeof CARDS[key].title).toBe('function');
  });
});
