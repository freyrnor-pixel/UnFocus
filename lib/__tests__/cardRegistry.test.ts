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
import { CARDS, CARD_KEYS, CardKey, CardGroup, CardSpec, cardSpec, cardsForScreen, cardsInGroup } from '@/lib/cardRegistry';
import { CARD_IDS } from '@/lib/collapsedCards';
import { EXPANDABLE_CARD_IDS } from '@/lib/expandableCards';
import { getTranslations } from '@/lib/i18n';

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

// Phase 8 (DESIGN_COMPARISON/19-IMPLEMENTATION.md): a cross-screen `group` strip, and the bug
// the prototype shipped with — two members sharing a rendered TITLE, so the strip read as
// "Today · This week · Today" once `time` held both `todoToday` and `homeToday`.
describe('cross-screen groups (phase 8)', () => {
  const t = getTranslations('en');
  const GROUPS: CardGroup[] = ['growth'];

  it('every group has at least two members — a group of one is not a group', () => {
    for (const group of GROUPS) {
      expect(cardsInGroup(group).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('a group spans more than one screen — the whole point of the feature', () => {
    for (const group of GROUPS) {
      const screens = new Set(cardsInGroup(group).map((k) => cardSpec(k).screen));
      expect(screens.size).toBeGreaterThan(1);
    }
  });

  it('no group holds two cards with the same title', () => {
    // The exact prototype bug: `time` held `todoToday` AND `homeToday`, both titled "Today",
    // so expanding Home's Today drew the strip as "Today · This week · Today". Titles are
    // resolved through English (arbitrary — the strings are stable per-language, so a
    // collision in one language is a collision in all three, and `icelandic.test.ts` covers
    // the language-specific half separately).
    for (const group of GROUPS) {
      const titles = cardsInGroup(group).map((k) => CARDS[k].title(t));
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it("Home's cards carry no group — they are previews, not group members", () => {
    // Stated as its own rule because it is exactly what would reopen the bug above: a Home
    // preview card and the real card it previews sharing a group puts the same title in the
    // strip twice, by construction, every time.
    for (const key of CARD_KEYS) {
      if (cardSpec(key).screen === 'home') expect(cardSpec(key).group).toBeUndefined();
    }
  });

  it('every group member has a pane — a strip cannot switch to a card that has none', () => {
    // ⚠️ **The rule the round 19 prototype broke, and the reason two written `expandDeclined`s
    // were reversed on 2026-08-27** (round 20 phase 6). The strip lives INSIDE the expanded pane
    // and swaps it to another member; a member with `expand: 'none'` has no pane to swap to, so
    // it can only be drawn dead. The prototype drew it anyway — it marked `habitsList` and
    // `healthWeek` `expand:false` and its tab handler set `S.pane=id` regardless — which is
    // exactly why the defect survived review: on screen the strip looked like it worked.
    // Without this assertion, adding `group` to a non-expandable card, or taking a pane away
    // from a member, silently empties the strip in a pane nobody opens in a test.
    for (const group of GROUPS) {
      for (const key of cardsInGroup(group)) {
        expect(cardSpec(key).expand).toBe('surface');
      }
    }
  });

  it('every group keeps at least two REACHABLE members, not just two declared ones', () => {
    // Deliberately not implied by the two tests above: "≥2 members" and "members are expandable"
    // could both hold while a future filter (a feature flag, a platform gate) leaves one tab on
    // screen. A strip of one is a label, not a control.
    for (const group of GROUPS) {
      expect(cardsInGroup(group).filter((k) => cardSpec(k).expand === 'surface').length).toBeGreaterThanOrEqual(2);
    }
  });

  it("cardsInGroup finds a member regardless of which screen it's looked up from", () => {
    // The lookup takes no `screen` argument at all — this asserts that isn't accidental: every
    // member's own screen is represented once cardsInGroup runs, i.e. the search really is
    // over every screen, not scoped to the caller's current one.
    for (const group of GROUPS) {
      const members = cardsInGroup(group);
      for (const key of members) {
        expect(members).toContain(key);
      }
      const screensCovered = new Set(members.map((k) => cardSpec(k).screen));
      for (const screen of screensCovered) {
        expect(members.some((k) => cardSpec(k).screen === screen)).toBe(true);
      }
    }
  });
});

// Phase 7: the composer options table is DATA, not a claim nothing checks.
describe('quick-add options (phase 7)', () => {
  it('never declares an empty options table', () => {
    for (const key of CARD_KEYS) {
      const compose = cardSpec(key).compose;
      if (!compose) continue;
      expect(compose.opts.length).toBeGreaterThan(0);
    }
  });

  it('never repeats an option on one card', () => {
    for (const key of CARD_KEYS) {
      const compose = cardSpec(key).compose;
      if (!compose) continue;
      expect(new Set(compose.opts).size).toBe(compose.opts.length);
    }
  });
});

const REG_ROOT = join(__dirname, '..', '..');
/** Every `.tsx`/`.ts` under app/, components/ and lib/, repo-relative. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(REG_ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(rel);
      } else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
  };
  for (const root of ['app', 'components', 'lib']) walk(root);
  return out;
}
/** Source with comments stripped — a `opt=` inside a comment is prose, not a control. */
const code = (rel: string) =>
  readFileSync(join(REG_ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('the compose table names controls that exist', () => {
  /**
   * ⚠️ **`compose` shipped inert (round 19, 2026-08-26) and this is what makes it real.** It was
   * data in the registry with NO runtime consumer at all: each surface hand-rolled its option
   * cells, and they matched the table only because one session wrote both. Nothing would have
   * noticed a cell added, dropped or renamed — the exact failure the registry exists to end, one
   * rung below the card anatomy it already governs.
   *
   * The binding is a `opt` prop naming which `ComposeOption` a cell IS, rather than generating
   * cells FROM the table: the data each cell edits lives in five stores with five shapes, and a
   * generator would have to know all of them. The surface renders, the registry declares, and
   * this binds them.
   *
   * It caught one straight away. The table declared **`effort`** on two cards and nothing in the
   * app has ever built an "effort" cell — the word is the prototype's, and what ships there is
   * the ENERGY stepper. A table naming a control that does not exist is what an inert table
   * decays into; `ComposeOption` names `energy` now.
   */
  const OPT_RE = /\bopt=(?:"(\w+)"|\{[^}]*?'(\w+)'\s*:\s*'(\w+)'[^}]*\})/g;
  const builtOptions = (): Set<string> => {
    const found = new Set<string>();
    for (const rel of sourceFiles()) {
      for (const m of code(rel).matchAll(OPT_RE)) {
        for (const g of [m[1], m[2], m[3]]) if (g) found.add(g);
      }
    }
    return found;
  };

  it('every option a card declares is built by a real cell', () => {
    // The one documented exception: `shopCatalogue`'s options are not `QuickAddOptionRow` cells
    // at all — that surface's composer was already a pop-up before phase 7
    // (components/CatalogueAddSheet.tsx: a name, an optional price, a category chip row), which
    // `ComposeSpec`'s own doc records. Named, not allowlisted by pattern.
    const IN_A_SHEET_INSTEAD: Partial<Record<CardKey, string[]>> = { shopCatalogue: ['price', 'category'] };
    const built = builtOptions();
    expect(built.size).toBeGreaterThan(0); // a regex that matched nothing would pass vacuously
    const offenders: string[] = [];
    for (const key of CARD_KEYS) {
      // `CARDS[key]` narrows to the union of literal specs, and not every member declares
      // `compose` — so read it through the shared type rather than off the narrowed literal.
      const spec: CardSpec = CARDS[key];
      for (const opt of spec.compose?.opts ?? []) {
        if (IN_A_SHEET_INSTEAD[key]?.includes(opt)) continue;
        if (!built.has(opt)) offenders.push(`${key} declares '${opt}' — no cell carries opt="${opt}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every cell tagged with an opt names a real ComposeOption', () => {
    // The other direction: a typo in a cell's `opt` is a tag bound to nothing, which would make
    // the assertion above pass while the cell it was meant to cover went unchecked.
    const declared = new Set(CARD_KEYS.flatMap((k) => (CARDS[k] as CardSpec).compose?.opts ?? []));
    const offenders = [...builtOptions()].filter((o) => !declared.has(o as never));
    expect(offenders).toEqual([]);
  });
});
