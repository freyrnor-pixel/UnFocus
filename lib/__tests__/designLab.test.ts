/**
 * designLab.test.ts — the design lab's registry, sanitizer and resolvers.
 *
 * Two things are being protected here, and only one of them is ordinary unit testing:
 *
 *   1. **Sanitizing is total.** A stored bag arrives from a JSON column that a backup, an
 *      older build or a hand edit can have mangled. It can set the colour of text on its own
 *      background and the size of every tap target, so "drops junk, never propagates it,
 *      never throws" is a safety property rather than a nicety.
 *   2. **The module cannot reach the app's machinery.** It is read inside render paths on
 *      every screen (useAppTheme, useScaledStyles, Surface), so an import of a store, the DB
 *      or the notification layer would put that machinery in a render path. The same
 *      import-graph scan lib/__tests__/cardLayout.test.ts runs for the same reason.
 */
import fs from 'fs';
import path from 'path';
import {
  COLOR_KNOBS,
  CONTROL_KNOBS,
  DEFAULT_SHAPE,
  EMPTY_OVERRIDES,
  EMPTY_PLAYGROUND,
  MIN_TAP_TARGET_FLOOR,
  SHAPE_KNOBS,
  SLOT_KNOBS,
  applyColorOverrides,
  clampShape,
  describeOverrides,
  isDefaultShape,
  isEmptyOverrides,
  isValidHex,
  normalizeHex,
  resolveControl,
  resolveShape,
  resolveSlot,
  sanitizeLabOverrides,
  CARD_KNOBS,
  DESIGN_LAB_VERSION,
  MAX_CARD_NOTE,
  MAX_PARTS_PER_CARD,
  MAX_PART_LABEL,
  PART_KINDS,
  PART_SLOT_ORDER,
  SLOTS_FOR_KIND,
  cardKnob,
  describeCards,
  orderedParts,
  resolveCardSpec,
  sanitizeCards,
  slotAtPoint,
  // v3 — the playground
  BODY_COLS,
  CARD_SKELETONS,
  MAX_CARDS_PER_SCREEN,
  MAX_SCREENS,
  MAX_SCREEN_TITLE,
  PART_GROUPS,
  PART_GROUP_OF,
  clampPlace,
  describePlayground,
  diffParts,
  isPlaceableSlot,
  partsInGroup,
  sanitizePlayground,
  type CardId,
  type CardPart,
  type LabOverrides,
} from '@/lib/designLab';
import { getThemePalette } from '@/constants/colors';

const palette = getThemePalette('default', false);

/** A bag with one of everything set, for the round-trip and describe tests. */
function fullBag(): LabOverrides {
  return {
    colors: { light: { accent: '#112233' }, dark: { accent: '#445566' } },
    shape: { radiusScale: 2 },
    controls: { boolean: 'segmented' },
    slots: { 'row.right': 'price' },
    cards: {},
    playground: EMPTY_PLAYGROUND,
    note: 'because the edges are too loud',
  };
}

describe('hex handling', () => {
  it('accepts both #rgb and #rrggbb, and nothing else', () => {
    expect(isValidHex('#abc')).toBe(true);
    expect(isValidHex('#AABBCC')).toBe(true);
    expect(isValidHex('  #aabbcc  ')).toBe(true);
    expect(isValidHex('aabbcc')).toBe(false);
    expect(isValidHex('#aabbc')).toBe(false);
    expect(isValidHex('red')).toBe(false);
    expect(isValidHex('rgba(0,0,0,0.5)')).toBe(false);
    expect(isValidHex(null)).toBe(false);
    expect(isValidHex(123)).toBe(false);
  });

  it('expands shorthand and lowercases', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('#AaBbCc')).toBe('#aabbcc');
  });
});

describe('sanitizeLabOverrides', () => {
  it('returns an empty bag for anything that is not an object', () => {
    for (const junk of [null, undefined, 0, 'x', [], true, NaN]) {
      expect(sanitizeLabOverrides(junk)).toEqual(EMPTY_OVERRIDES);
    }
  });

  it('drops unknown colour keys and malformed values, keeping the good ones', () => {
    const out = sanitizeLabOverrides({
      colors: {
        light: { accent: '#ABC', notATokenAtAll: '#ffffff', bg: 'red', text: 42 },
        dark: { accent: '#123456' },
      },
    });
    expect(out.colors.light).toEqual({ accent: '#aabbcc' });
    expect(out.colors.dark).toEqual({ accent: '#123456' });
  });

  it('refuses to override accentInk, which is re-derived and would be discarded anyway', () => {
    const out = sanitizeLabOverrides({ colors: { light: { accentInk: '#ffffff' } } });
    expect(out.colors.light).toEqual({});
  });

  it('clamps out-of-range numbers instead of dropping or trusting them', () => {
    const out = sanitizeLabOverrides({ shape: { radiusScale: 9999, spacingScale: -50 } });
    expect(out.shape.radiusScale).toBe(3);
    expect(out.shape.spacingScale).toBe(0.4);
  });

  it('drops non-finite numbers and non-numbers outright', () => {
    const out = sanitizeLabOverrides({
      shape: { radiusScale: NaN, spacingScale: Infinity, borderScale: '2', rowHeight: null },
    });
    expect(out.shape).toEqual({});
  });

  it('never lets the tap target fall below the WCAG floor', () => {
    const out = sanitizeLabOverrides({ shape: { minTapTarget: 4 } });
    expect(out.shape.minTapTarget).toBe(MIN_TAP_TARGET_FLOOR);
    expect(resolveShape(out).minTapTarget).toBeGreaterThanOrEqual(MIN_TAP_TARGET_FLOOR);
  });

  it('drops control and slot values that are not declared variants', () => {
    const out = sanitizeLabOverrides({
      controls: { boolean: 'hologram', notASlot: 'switch' },
      slots: { 'row.right': 'nonsense', 'row.leading': 'badge' },
    });
    expect(out.controls).toEqual({});
    expect(out.slots).toEqual({ 'row.leading': 'badge' });
  });

  // The three bench slots were retired on 2026-08-07 (the card editor replaced them). A bag
  // stored before that still names them, and must load as though it never had.
  it('drops the retired bench slots from an older stored bag', () => {
    const out = sanitizeLabOverrides({
      slots: { 'bench.a': 'button', 'bench.b': 'slider', 'row.meta': 'tags' },
    });
    expect(out.slots).toEqual({ 'row.meta': 'tags' });
  });

  it('caps the free-text note rather than storing an unbounded string', () => {
    const out = sanitizeLabOverrides({ note: 'x'.repeat(5000) });
    expect(out.note.length).toBe(2000);
  });

  it('round-trips a bag it produced itself', () => {
    const bag = fullBag();
    expect(sanitizeLabOverrides(JSON.parse(JSON.stringify(bag)))).toEqual(bag);
  });
});

describe('resolving', () => {
  it('treats a bag with only a note as empty for rendering purposes', () => {
    expect(isEmptyOverrides({ ...EMPTY_OVERRIDES, note: 'hello' })).toBe(true);
  });

  it('returns the SAME palette object when nothing is overridden', () => {
    // Referential stability is what keeps useAppTheme's memo from invalidating for a user who
    // has never opened the lab — a fresh object here would re-render the whole app every tick.
    expect(applyColorOverrides(palette, EMPTY_OVERRIDES, false)).toBe(palette);
  });

  it('applies only the mode being asked for', () => {
    const bag = fullBag();
    expect(applyColorOverrides(palette, bag, false).accent).toBe('#112233');
    expect(applyColorOverrides(palette, bag, true).accent).toBe('#445566');
  });

  it('fills shape defaults and recognises the shipped geometry', () => {
    expect(resolveShape(EMPTY_OVERRIDES)).toEqual(DEFAULT_SHAPE);
    expect(isDefaultShape(resolveShape(EMPTY_OVERRIDES))).toBe(true);
    expect(isDefaultShape(resolveShape({ ...EMPTY_OVERRIDES, shape: { radiusScale: 2 } }))).toBe(false);
  });

  it('falls back to what the app ships for an unset control or slot', () => {
    for (const knob of CONTROL_KNOBS) {
      expect(resolveControl(knob.id, EMPTY_OVERRIDES)).toBe(knob.fallback);
      expect(knob.variants).toContain(knob.fallback);
    }
    for (const knob of SLOT_KNOBS) {
      expect(resolveSlot(knob.id, EMPTY_OVERRIDES)).toBe(knob.fallback);
      expect(knob.options).toContain(knob.fallback);
    }
  });
});

describe('describeOverrides', () => {
  it('reports nothing when nothing changed', () => {
    expect(describeOverrides(EMPTY_OVERRIDES, palette, false)).toEqual([]);
  });

  it('omits an override that happens to equal the value it replaces', () => {
    const bag: LabOverrides = {
      ...EMPTY_OVERRIDES,
      colors: { light: { accent: palette.accent.toLowerCase() }, dark: {} },
      shape: { radiusScale: DEFAULT_SHAPE.radiusScale },
      controls: { boolean: 'switch' },
    };
    expect(describeOverrides(bag, palette, false)).toEqual([]);
  });

  it('carries the real BEFORE value, not the default, for colours', () => {
    const bag: LabOverrides = { ...EMPTY_OVERRIDES, colors: { light: { accent: '#000000' }, dark: {} } };
    const [row] = describeOverrides(bag, palette, false);
    expect(row.before).toBe(palette.accent);
    expect(row.after).toBe('#000000');
    expect(row.group).toBe('COLOUR');
    expect(row.source).toContain('constants/colors.ts');
    expect(row.usedBy.length).toBeGreaterThan(0);
  });

  it('covers all four groups', () => {
    const groups = describeOverrides(fullBag(), palette, false).map((c) => c.group);
    expect(new Set(groups)).toEqual(new Set(['COLOUR', 'SHAPE', 'CONTROLS', 'SLOTS']));
  });
});

describe('the registry itself', () => {
  it('has a provenance and a used-by line on every knob — the export is worthless without them', () => {
    for (const knob of [...COLOR_KNOBS, ...SHAPE_KNOBS, ...CONTROL_KNOBS, ...SLOT_KNOBS]) {
      expect(knob.source.length).toBeGreaterThan(0);
      expect(knob.usedBy.length).toBeGreaterThan(0);
    }
  });

  it('gives every shape knob a default inside its own declared range', () => {
    for (const knob of SHAPE_KNOBS) {
      const value = DEFAULT_SHAPE[knob.id];
      expect(value).toBeGreaterThanOrEqual(knob.min);
      expect(value).toBeLessThanOrEqual(knob.max);
      expect(clampShape(knob.id, value)).toBe(value);
    }
  });

  it('declares a default for every ShapeOverrides field', () => {
    expect(new Set(SHAPE_KNOBS.map((k) => k.id))).toEqual(new Set(Object.keys(DEFAULT_SHAPE)));
  });

  it('names only real palette tokens', () => {
    for (const knob of COLOR_KNOBS) {
      expect(palette).toHaveProperty(knob.id as string);
    }
  });
});

describe('import graph', () => {
  // Mirrors lib/__tests__/cardLayout.test.ts. This module is evaluated inside render paths on
  // every screen; a store/DB/notification import here would drag that machinery into them, and
  // would also make a presentation-only bag able to schedule or cancel something.
  // The two v3 modules join the scan: designLabPlace is called from the same render paths, and
  // designLabEdit is the only thing that writes a bag — a store import there would give it two
  // ways to persist, one of them bypassing the screen's debounce.
  it.each(['designLab.ts', 'designLabPlace.ts', 'designLabEdit.ts'])(
    '%s cannot reach a store, the DB, or the notification layer',
    (file) => {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec).not.toMatch(/store\//);
        expect(spec).not.toMatch(/lib\/db/);
        expect(spec).not.toMatch(/lib\/notifications/);
        expect(spec).not.toMatch(/lib\/reminders/);
        expect(spec).not.toMatch(/lib\/liveSync|lib\/syncService/);
      }
    },
  );
});

// ── Cards (2026-08-07) ───────────────────────────────────────────────────────

/** The habits card with a slider bolted on and its title made loud. */
function editedHabitCard(): LabOverrides {
  const spec = resolveCardSpec('habit', EMPTY_OVERRIDES);
  const parts: CardPart[] = spec.parts.map((p) =>
    p.id === 'title' ? { ...p, size: 'lg', weight: 'bold', label: 'How much' } : p,
  );
  parts.push({ id: 'slider-1', kind: 'slider', slot: 'body', label: 'Today', color: 'accent', size: 'md', weight: 'regular' });
  return { ...EMPTY_OVERRIDES, cards: { habit: { parts, note: 'the count should be draggable' } } };
}

describe('the card registry', () => {
  it('gives every card a source and a description an agent can act on', () => {
    for (const knob of CARD_KNOBS) {
      expect(knob.source.trim().length).toBeGreaterThan(0);
      expect(knob.usedBy.trim().length).toBeGreaterThan(0);
      expect(knob.domain.trim().length).toBeGreaterThan(0);
      expect(knob.screen.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate card ids', () => {
    const ids = CARD_KNOBS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // A default part in an illegal slot would be dropped by the sanitizer the moment the card
  // was opened and saved — the card would silently lose a piece of itself on first touch.
  it('places every shipped part in a slot its own kind allows', () => {
    for (const knob of CARD_KNOBS) {
      for (const part of knob.defaultParts) {
        expect(PART_KINDS).toContain(part.kind);
        expect(SLOTS_FOR_KIND[part.kind]).toContain(part.slot);
      }
    }
  });

  it('keeps part ids unique within a card, since the id is what tracks a move', () => {
    for (const knob of CARD_KNOBS) {
      const ids = knob.defaultParts.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('ships every card with at least one part, and never more than the cap', () => {
    for (const knob of CARD_KNOBS) {
      expect(knob.defaultParts.length).toBeGreaterThan(0);
      expect(knob.defaultParts.length).toBeLessThanOrEqual(MAX_PARTS_PER_CARD);
    }
  });

  it('draws every declared slot from the one ordering list', () => {
    for (const slots of Object.values(SLOTS_FOR_KIND)) {
      for (const slot of slots) expect(PART_SLOT_ORDER).toContain(slot);
    }
  });

  it('offers a slot for every kind, so no kind is unaddable', () => {
    for (const kind of PART_KINDS) {
      expect(SLOTS_FOR_KIND[kind].length).toBeGreaterThan(0);
    }
  });
});

describe('sanitizeCards', () => {
  it('drops an unknown card id', () => {
    expect(sanitizeCards({ notACard: { parts: [{ id: 'a', kind: 'text', slot: 'title' }] } })).toEqual({});
  });

  it('drops an unknown kind, an unknown slot, and an illegal kind/slot pair', () => {
    const raw = {
      todo: {
        parts: [
          { id: 'ok', kind: 'text', slot: 'title' },
          { id: 'badKind', kind: 'hologram', slot: 'title' },
          { id: 'badSlot', kind: 'text', slot: 'nowhere' },
          // A slider genuinely cannot go in the right-hand string column.
          { id: 'badPair', kind: 'slider', slot: 'right' },
        ],
      },
    };
    expect(sanitizeCards(raw).todo?.parts.map((p) => p.id)).toEqual(['ok']);
  });

  it('drops a duplicate part id rather than letting two parts share one identity', () => {
    const raw = { todo: { parts: [
      { id: 'title', kind: 'text', slot: 'title' },
      { id: 'title', kind: 'text', slot: 'meta' },
    ] } };
    expect(sanitizeCards(raw).todo?.parts).toHaveLength(1);
  });

  it('accepts a palette token or a hex as a colour, and nothing else', () => {
    const raw = { todo: { parts: [
      { id: 'a', kind: 'text', slot: 'title', color: 'accent' },
      { id: 'b', kind: 'text', slot: 'meta', color: '#ABC' },
      { id: 'c', kind: 'text', slot: 'body', color: 'rebeccapurple' },
      { id: 'd', kind: 'text', slot: 'footer', color: 'accentInk' },
    ] } };
    const parts = sanitizeCards(raw).todo?.parts ?? [];
    expect(parts.map((p) => p.color)).toEqual(['accent', '#aabbcc', '', '']);
  });

  it('falls back rather than dropping when only size or weight is junk', () => {
    const raw = { todo: { parts: [{ id: 'a', kind: 'text', slot: 'title', size: 'enormous', weight: 7 }] } };
    expect(sanitizeCards(raw).todo?.parts[0]).toMatchObject({ size: 'sm', weight: 'regular' });
  });

  it('caps parts, labels and the per-card note', () => {
    const parts = Array.from({ length: MAX_PARTS_PER_CARD + 5 }, (_, i) => ({
      id: `p${i}`, kind: 'text', slot: 'body', label: 'x'.repeat(MAX_PART_LABEL + 40),
    }));
    const out = sanitizeCards({ todo: { parts, note: 'n'.repeat(MAX_CARD_NOTE + 100) } }).todo!;
    expect(out.parts).toHaveLength(MAX_PARTS_PER_CARD);
    expect(out.parts[0].label).toHaveLength(MAX_PART_LABEL);
    expect(out.note).toHaveLength(MAX_CARD_NOTE);
  });

  // v3 split the old blanket "drop an empty card" rule in two. Emptying a card is a real
  // answer — a blank card is where building starts — so it is kept and read back empty.
  it('keeps a card the maintainer emptied on purpose', () => {
    expect(sanitizeCards({ todo: { parts: [] } })).toEqual({ todo: { parts: [], note: '' } });
    expect(sanitizeCards({ todo: { parts: [{ id: 'x', kind: 'nope', slot: 'title' }] } }))
      .toEqual({ todo: { parts: [], note: '' } });
  });

  // …but the original safety argument survives intact: a row with no `parts` ARRAY is
  // malformed, not a decision, and defaulting it in would let a hand-edited backup blank a
  // card by omission.
  it('still drops a card row with no parts array at all', () => {
    expect(sanitizeCards({ todo: {} })).toEqual({});
    expect(sanitizeCards({ todo: { parts: 'lots' } })).toEqual({});
    expect(sanitizeCards({ todo: { note: 'words but no parts' } })).toEqual({});
  });

  it('survives every shape of junk without throwing', () => {
    [null, undefined, 7, 'cards', [], { todo: 5 }, { todo: { parts: 'lots' } }].forEach((raw) => {
      expect(() => sanitizeCards(raw)).not.toThrow();
    });
  });
});

describe('card back-compatibility', () => {
  // The stored bag is one JSON column. A v1 bag predates `cards` entirely and must keep
  // loading unchanged — a widening, not a break, which is why the version bump is only a
  // signal to whoever reads the exported file.
  it('loads a v1 bag (no `cards` field) with everything else intact', () => {
    const v1 = {
      colors: { light: { accent: '#112233' }, dark: {} },
      shape: { radiusScale: 2 },
      controls: { boolean: 'segmented' },
      slots: { 'row.right': 'price' },
      note: 'from before cards existed',
    };
    const out = sanitizeLabOverrides(v1);
    expect(out.cards).toEqual({});
    expect(out.colors.light.accent).toBe('#112233');
    expect(out.shape.radiusScale).toBe(2);
    expect(out.note).toBe('from before cards existed');
  });

  // v2 added `cards`; v3 added `playground` AND stopped writing `cards`. Both bumps exist so
  // a reader can tell "nothing was built" from "this file predates the field".
  it('loads a v2 bag (no `playground` field) with everything else intact', () => {
    const v2 = {
      colors: { light: { accent: '#112233' }, dark: {} },
      shape: { radiusScale: 2 },
      cards: { habit: { parts: [{ id: 'title', kind: 'text', slot: 'title', label: '', color: '', size: 'md', weight: 'semibold' }], note: '' } },
      note: 'from before screens existed',
    };
    const out = sanitizeLabOverrides(v2);
    expect(out.playground).toEqual(EMPTY_PLAYGROUND);
    expect(out.cards.habit?.parts).toHaveLength(1);
    expect(out.colors.light.accent).toBe('#112233');
    expect(out.note).toBe('from before screens existed');
  });

  it('is at version 3, so a reader can tell "nothing built" from "predates screens"', () => {
    expect(DESIGN_LAB_VERSION).toBe(3);
  });

  it('round-trips a bag carrying a card through the sanitizer unchanged', () => {
    const bag = editedHabitCard();
    expect(sanitizeLabOverrides(bag)).toEqual(bag);
  });
});

describe('resolveCardSpec', () => {
  it('opens an untouched card as the one the app ships', () => {
    for (const knob of CARD_KNOBS) {
      expect(resolveCardSpec(knob.id, EMPTY_OVERRIDES).parts).toEqual(knob.defaultParts);
    }
  });

  // The registry's arrays are readonly, but a shared reference is still one `.push` from
  // rewriting the shipped card for the rest of the session.
  it('hands back a fresh array and fresh parts, not the registry’s own', () => {
    const a = resolveCardSpec('todo', EMPTY_OVERRIDES);
    a.parts[0].label = 'mutated';
    expect(resolveCardSpec('todo', EMPTY_OVERRIDES).parts[0].label).toBe('');
  });

  it('prefers the stored composition once a card has been touched', () => {
    const bag = editedHabitCard();
    expect(resolveCardSpec('habit', bag).parts.some((p) => p.id === 'slider-1')).toBe(true);
    expect(resolveCardSpec('habit', bag).note).toBe('the count should be draggable');
  });

  it('returns an empty spec for an id that is not a card', () => {
    expect(resolveCardSpec('nope' as CardId, EMPTY_OVERRIDES).parts).toEqual([]);
  });

  it('exposes the registry entry by id', () => {
    expect(cardKnob('habit')?.source).toContain('habits.tsx');
    expect(cardKnob('nope' as CardId)).toBeUndefined();
  });
});

describe('orderedParts', () => {
  it('sorts by slot, keeping the maintainer’s own order inside a slot', () => {
    const spec = {
      note: '',
      parts: [
        { id: 'z', kind: 'text', slot: 'footer', label: '', color: '', size: 'sm', weight: 'regular' },
        { id: 'm2', kind: 'text', slot: 'meta', label: 'second', color: '', size: 'sm', weight: 'regular' },
        { id: 'h', kind: 'text', slot: 'header', label: '', color: '', size: 'sm', weight: 'regular' },
        { id: 'm1', kind: 'text', slot: 'meta', label: 'first', color: '', size: 'sm', weight: 'regular' },
      ] as CardPart[],
    };
    expect(orderedParts(spec).map((p) => p.id)).toEqual(['h', 'm2', 'm1', 'z']);
  });
});

describe('describeCards', () => {
  it('says nothing about a card that was never opened', () => {
    expect(describeCards(EMPTY_OVERRIDES)).toEqual([]);
  });

  // Same rule describeOverrides follows for a knob set back to its default: a report that
  // lists everything says nothing about what the maintainer cares about.
  it('says nothing about a card opened and left alone', () => {
    const untouched = resolveCardSpec('todo', EMPTY_OVERRIDES);
    expect(describeCards({ ...EMPTY_OVERRIDES, cards: { todo: untouched } })).toEqual([]);
  });

  it('reports a card whose only change is a note', () => {
    const spec = resolveCardSpec('todo', EMPTY_OVERRIDES);
    const out = describeCards({ ...EMPTY_OVERRIDES, cards: { todo: { ...spec, note: 'too busy' } } });
    expect(out).toHaveLength(1);
    expect(out[0].changes).toEqual([]);
    expect(out[0].note).toBe('too busy');
  });

  it('carries the card’s provenance, so the report names the file to edit', () => {
    const [card] = describeCards(editedHabitCard());
    expect(card.id).toBe('habit');
    expect(card.source).toBe(cardKnob('habit')!.source);
    expect(card.usedBy).toBe(cardKnob('habit')!.usedBy);
  });

  it('tells added, removed, moved and restyled apart', () => {
    const spec = resolveCardSpec('todo', EMPTY_OVERRIDES);
    const parts = spec.parts
      .filter((p) => p.id !== 'tags')                                   // removed
      .map((p) => (p.id === 'goalDot' ? { ...p, slot: 'leading' as const } : p))  // moved
      .map((p) => (p.id === 'title' ? { ...p, size: 'lg' as const } : p));        // restyled
    parts.push({ id: 'btn-1', kind: 'button', slot: 'footer', label: 'Do it', color: '', size: 'sm', weight: 'semibold' });

    const [card] = describeCards({ ...EMPTY_OVERRIDES, cards: { todo: { parts, note: '' } } });
    const byKind = (kind: string) => card.changes.filter((c) => c.kind === kind).map((c) => c.part.id);
    expect(byKind('added')).toEqual(['btn-1']);
    expect(byKind('removed')).toEqual(['tags']);
    expect(byKind('moved')).toEqual(['goalDot']);
    expect(byKind('restyled')).toEqual(['title']);
  });

  it('spells out what actually differs, so the report needs no second lookup', () => {
    const [card] = describeCards(editedHabitCard());
    const title = card.changes.find((c) => c.part.id === 'title')!;
    expect(title.kind).toBe('restyled');
    expect(title.detail).toContain('size md → lg');
    expect(title.detail).toContain('weight semibold → bold');
    expect(title.detail).toContain('"How much"');

    const slider = card.changes.find((c) => c.part.id === 'slider-1')!;
    expect(slider.kind).toBe('added');
    expect(slider.detail).toContain('body');
    expect(slider.detail).toContain('accent');
  });

  it('reports a moved part once, not as a removal plus an addition', () => {
    const spec = resolveCardSpec('todo', EMPTY_OVERRIDES);
    const parts = spec.parts.map((p) => (p.id === 'time' ? { ...p, slot: 'meta' as const } : p));
    const [card] = describeCards({ ...EMPTY_OVERRIDES, cards: { todo: { parts, note: '' } } });
    expect(card.changes).toHaveLength(1);
    expect(card.changes[0]).toMatchObject({ kind: 'moved', detail: 'right → meta' });
  });

  it('walks the cards in registry order, whatever order they were stored in', () => {
    const cards = {
      note: { parts: [{ id: 'x', kind: 'text', slot: 'body', label: '', color: '', size: 'sm', weight: 'regular' }] as CardPart[], note: '' },
      todo: { parts: [{ id: 'y', kind: 'text', slot: 'body', label: '', color: '', size: 'sm', weight: 'regular' }] as CardPart[], note: '' },
    };
    const order = describeCards({ ...EMPTY_OVERRIDES, cards }).map((c) => c.id);
    const registryOrder = CARD_KNOBS.map((k) => k.id).filter((id) => order.includes(id));
    expect(order).toEqual(registryOrder);
  });
});

describe('slotAtPoint — where a dragged part lands', () => {
  // A card's positions, laid out the way the real one is: the row's title and meta sit inside
  // the row, and body/footer are the card's own space below it.
  const boxes = {
    leading: { x: 10, y: 100, width: 30, height: 40 },
    title: { x: 50, y: 100, width: 200, height: 20 },
    meta: { x: 50, y: 122, width: 200, height: 18 },
    right: { x: 260, y: 100, width: 40, height: 40 },
    body: { x: 10, y: 150, width: 290, height: 60 },
    footer: { x: 10, y: 215, width: 290, height: 40 },
  };

  it('finds the slot the point is inside', () => {
    expect(slotAtPoint('text', boxes, 60, 110)).toBe('title');
    expect(slotAtPoint('text', boxes, 60, 130)).toBe('meta');
    expect(slotAtPoint('text', boxes, 20, 120)).toBe('leading');
    expect(slotAtPoint('slider', boxes, 100, 180)).toBe('body');
    expect(slotAtPoint('slider', boxes, 100, 230)).toBe('footer');
  });

  // The whole point of SLOTS_FOR_KIND: a slider dropped on the title must NOT quietly land
  // in the body instead — a drop that goes somewhere else is how you get a card you didn't ask
  // for. It answers nothing, and the caller leaves the part where it was.
  it('answers nothing over a slot this kind may not take', () => {
    expect(slotAtPoint('slider', boxes, 60, 110)).toBeNull();   // slider over the title
    expect(slotAtPoint('slider', boxes, 20, 120)).toBeNull();   // slider over the leading
    expect(slotAtPoint('divider', boxes, 60, 130)).toBeNull();  // divider over the meta line
  });

  it('answers nothing when the point is off every box', () => {
    expect(slotAtPoint('text', boxes, 5, 5)).toBeNull();
    expect(slotAtPoint('text', boxes, 1000, 1000)).toBeNull();
  });

  // Positions nest — the title and the meta line are inside the row's body box. A point in
  // two boxes belongs to the more specific one, or every drop near the top of a card would
  // land in whatever encloses it.
  it('prefers the smallest containing box when they overlap', () => {
    const nested = {
      body: { x: 0, y: 0, width: 300, height: 300 },
      title: { x: 50, y: 50, width: 100, height: 20 },
    };
    expect(slotAtPoint('text', nested, 60, 55)).toBe('title');
    expect(slotAtPoint('text', nested, 250, 250)).toBe('body');
  });

  it('ignores a slot that has not been measured, or measured as nothing', () => {
    expect(slotAtPoint('text', { title: { x: 0, y: 0, width: 0, height: 0 } }, 0, 0)).toBeNull();
    expect(slotAtPoint('text', {}, 10, 10)).toBeNull();
  });

  it('counts the edges as inside, so a drop on a boundary still lands', () => {
    expect(slotAtPoint('text', boxes, 50, 100)).toBe('title');
    expect(slotAtPoint('text', boxes, 250, 120)).toBe('title');
  });
});

// ── v3: the playground ───────────────────────────────────────────────────────

/** One built screen with one blank-origin card on it. */
function builtBag(): LabOverrides {
  return {
    ...EMPTY_OVERRIDES,
    playground: {
      screens: [
        {
          id: 'screen-1',
          screen: 'habits',
          title: 'Morning',
          note: 'this is the screen I actually open first',
          cards: [
            {
              id: 'card-1',
              origin: 'blank',
              title: 'Today',
              note: 'the slider should be the thing you reach for',
              parts: [
                { id: 'title-1', kind: 'text', slot: 'title', label: 'What now', color: '', size: 'md', weight: 'semibold' },
                { id: 'slider-1', kind: 'slider', slot: 'body', label: 'How much', color: 'accent', size: 'md', weight: 'regular', place: { row: 0, col: 0, span: 4 } },
                { id: 'button-1', kind: 'button', slot: 'body', label: 'Do it', color: '', size: 'sm', weight: 'regular', place: { row: 1, col: 0, span: 2 } },
              ],
            },
          ],
        },
      ],
      note: '',
    },
  };
}

describe('part placement', () => {
  it('keeps a place on the card’s own space and drops it anywhere else', () => {
    const place = { row: 1, col: 1, span: 2 };
    const body = sanitizeCards({ todo: { parts: [{ id: 'b', kind: 'slider', slot: 'body', place }] } }).todo!;
    expect(body.parts[0].place).toEqual(place);

    // A row slot's position IS its slot, so a place there would be a second, disagreeing answer.
    const row = sanitizeCards({ todo: { parts: [{ id: 't', kind: 'text', slot: 'title', place }] } }).todo!;
    expect(row.parts[0].place).toBeUndefined();
  });

  it('clamps a place into the grid rather than rejecting the part', () => {
    expect(clampPlace({ row: -3, col: -1, span: 0 })).toEqual({ row: 0, col: 0, span: 1 });
    expect(clampPlace({ row: 2.7, col: 9, span: 99 })).toEqual({ row: 2, col: BODY_COLS - 1, span: 1 });
    expect(clampPlace({ row: 1, col: 2, span: 4 })).toEqual({ row: 1, col: 2, span: 2 });
  });

  // A part whose place is junk keeps everything else about itself. Losing the whole part over
  // a stale co-ordinate would delete something the maintainer built.
  it('drops a malformed place but keeps the part', () => {
    const out = sanitizeCards({
      todo: { parts: [{ id: 'b', kind: 'slider', slot: 'body', label: 'keep me', place: { row: 'x' } }] },
    }).todo!;
    expect(out.parts).toHaveLength(1);
    expect(out.parts[0].label).toBe('keep me');
    expect(out.parts[0].place).toBeUndefined();
  });

  it('knows which slots take a place at all', () => {
    expect(isPlaceableSlot('body')).toBe(true);
    expect(isPlaceableSlot('footer')).toBe(true);
    for (const slot of ['header', 'leading', 'title', 'meta', 'right', 'action', 'check', 'trailing'] as const) {
      expect(isPlaceableSlot(slot)).toBe(false);
    }
  });
});

describe('the skeletons', () => {
  it('offers a blank card and nothing hidden behind it', () => {
    expect(CARD_SKELETONS.map((s) => s.origin)).toEqual(['blank', 'row', 'heading']);
    expect(CARD_SKELETONS[0].parts).toHaveLength(0);
  });

  // The same invariant CARD_KNOBS already carries: a shipped part in an illegal slot would
  // render nothing and then sit in the exported document as an instruction nobody can follow.
  it('puts every skeleton part in a slot its kind allows', () => {
    for (const skeleton of CARD_SKELETONS) {
      for (const part of skeleton.parts) {
        expect(SLOTS_FOR_KIND[part.kind]).toContain(part.slot);
      }
    }
  });

  it('gives every skeleton part a unique id, so a move can be told from a replacement', () => {
    for (const skeleton of CARD_SKELETONS) {
      const ids = skeleton.parts.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('PART_GROUP_OF', () => {
  it('files every kind in exactly one group, so a new kind cannot go missing from the shelf', () => {
    for (const kind of PART_KINDS) {
      expect(PART_GROUPS).toContain(PART_GROUP_OF[kind]);
    }
    const filed = PART_GROUPS.flatMap((g) => partsInGroup(g));
    expect(filed.slice().sort()).toEqual(PART_KINDS.slice().sort());
    expect(filed).toHaveLength(PART_KINDS.length);
  });

  it('leaves no group empty', () => {
    for (const group of PART_GROUPS) expect(partsInGroup(group).length).toBeGreaterThan(0);
  });

  it('keeps a group in PART_KINDS order, so the shelf does not reshuffle between renders', () => {
    const words = partsInGroup('words');
    expect(words).toEqual(PART_KINDS.filter((k) => PART_GROUP_OF[k] === 'words'));
  });
});

describe('diffParts', () => {
  const shipped: CardPart[] = [
    { id: 'title', kind: 'text', slot: 'title', label: '', color: '', size: 'md', weight: 'semibold' },
    { id: 'check', kind: 'checkbox', slot: 'check', label: '', color: '', size: 'sm', weight: 'regular' },
  ];

  it('says nothing when nothing differs', () => {
    expect(diffParts(shipped, shipped.map((p) => ({ ...p })))).toEqual([]);
  });

  it('tells the four verdicts apart', () => {
    const proposed: CardPart[] = [
      { ...shipped[0], size: 'lg' },                                   // restyled
      { ...shipped[1], slot: 'leading' },                              // moved
      { id: 'slider-1', kind: 'slider', slot: 'body', label: '', color: '', size: 'sm', weight: 'regular' },
    ];
    const kinds = diffParts(shipped, proposed).map((c) => c.kind);
    expect(kinds).toContain('restyled');
    expect(kinds).toContain('moved');
    expect(kinds).toContain('added');
    expect(diffParts(shipped, [shipped[0]]).map((c) => c.kind)).toEqual(['removed']);
  });

  // A part is matched by id and nothing else — that is what keeps a move ONE line rather than
  // a removal plus an addition, which would read as two decisions instead of one.
  it('reports a moved part once', () => {
    const moved = diffParts(shipped, [shipped[0], { ...shipped[1], slot: 'leading' }]);
    expect(moved).toHaveLength(1);
    expect(moved[0].kind).toBe('moved');
    expect(moved[0].detail).toContain('check → leading');
  });
});

describe('sanitizePlayground', () => {
  it('reads back a built playground unchanged', () => {
    const bag = builtBag();
    expect(sanitizeLabOverrides(bag)).toEqual(bag);
  });

  it('is empty for anything that is not a playground', () => {
    for (const raw of [null, undefined, 7, 'screens', [], { screens: 'lots' }]) {
      expect(sanitizePlayground(raw)).toEqual(EMPTY_PLAYGROUND);
    }
  });

  // You make a screen before you put anything on it. Dropping an empty one would delete the
  // screen out from under the person filling it.
  it('keeps a screen with no cards on it yet', () => {
    const out = sanitizePlayground({ screens: [{ id: 's1', screen: 'plans', title: '', cards: [], note: '' }] });
    expect(out.screens).toHaveLength(1);
    expect(out.screens[0].cards).toEqual([]);
  });

  it('drops a screen with no id or no cards array — malformed, not empty', () => {
    expect(sanitizePlayground({ screens: [{ screen: 'plans', cards: [] }] }).screens).toEqual([]);
    expect(sanitizePlayground({ screens: [{ id: 's1', screen: 'plans' }] }).screens).toEqual([]);
  });

  it('drops duplicate screen and card ids, which would break move tracking', () => {
    const dupScreens = sanitizePlayground({
      screens: [{ id: 's1', cards: [] }, { id: 's1', cards: [] }],
    });
    expect(dupScreens.screens).toHaveLength(1);

    const dupCards = sanitizePlayground({
      screens: [{ id: 's1', cards: [{ id: 'c1', parts: [] }, { id: 'c1', parts: [] }] }],
    });
    expect(dupCards.screens[0].cards).toHaveLength(1);
  });

  it('falls back to blank for an unknown origin rather than dropping the card', () => {
    const out = sanitizePlayground({ screens: [{ id: 's1', cards: [{ id: 'c1', origin: 'nope', parts: [] }] }] });
    expect(out.screens[0].cards[0].origin).toBe('blank');
  });

  it('keeps a real card id as the origin, since that is what the diff is measured against', () => {
    const out = sanitizePlayground({ screens: [{ id: 's1', cards: [{ id: 'c1', origin: 'todo', parts: [] }] }] });
    expect(out.screens[0].cards[0].origin).toBe('todo');
  });

  it('caps screens, cards and titles', () => {
    const screens = Array.from({ length: MAX_SCREENS + 4 }, (_, i) => ({
      id: `s${i}`,
      title: 't'.repeat(MAX_SCREEN_TITLE + 20),
      cards: Array.from({ length: MAX_CARDS_PER_SCREEN + 4 }, (_, j) => ({ id: `c${j}`, parts: [] })),
    }));
    const out = sanitizePlayground({ screens });
    expect(out.screens).toHaveLength(MAX_SCREENS);
    expect(out.screens[0].title).toHaveLength(MAX_SCREEN_TITLE);
    expect(out.screens[0].cards).toHaveLength(MAX_CARDS_PER_SCREEN);
  });

  it('survives every shape of junk without throwing', () => {
    const junk = [
      { screens: [null, 5, [], { id: 's1', cards: [null, 7, { id: 'c', parts: [null, 'x'] }] }] },
      { screens: [{ id: 's1', screen: 5, title: [], cards: [], note: {} }] },
    ];
    junk.forEach((raw) => expect(() => sanitizePlayground(raw)).not.toThrow());
  });

  it('counts as a change, so an untouched app is still the fast path', () => {
    expect(isEmptyOverrides(EMPTY_OVERRIDES)).toBe(true);
    expect(isEmptyOverrides(builtBag())).toBe(false);
  });
});

describe('describePlayground', () => {
  it('says nothing about an empty playground', () => {
    expect(describePlayground(EMPTY_OVERRIDES)).toEqual([]);
  });

  it('says nothing about a screen with no cards and nothing to say', () => {
    const bag = { ...EMPTY_OVERRIDES, playground: { screens: [{ id: 's1', screen: 'plans', title: '', cards: [], note: '' }], note: '' } };
    expect(describePlayground(bag)).toEqual([]);
  });

  it('reports an empty screen that carries a note — the note is the whole request', () => {
    const bag = { ...EMPTY_OVERRIDES, playground: { screens: [{ id: 's1', screen: 'plans', title: '', cards: [], note: 'nothing belongs here' }], note: '' } };
    expect(describePlayground(bag)).toHaveLength(1);
  });

  // A card built from blank has nothing to be measured against, so the only honest report is
  // the whole composition.
  it('exports a blank-origin card in full, with no diff', () => {
    const [screen] = describePlayground(builtBag());
    const [card] = screen.cards;
    expect(card.diff).toBeUndefined();
    expect(card.composition).toHaveLength(3);
    expect(card.composition.map((l) => l.part.id)).toEqual(['title-1', 'slider-1', 'button-1']);
  });

  it('states where a placed part sits, and leaves a flowing one blank', () => {
    const [screen] = describePlayground(builtBag());
    const lines = screen.cards[0].composition;
    expect(lines.find((l) => l.part.id === 'slider-1')!.where).toBe('r0 c0 w4');
    expect(lines.find((l) => l.part.id === 'button-1')!.where).toBe('r1 c0 w2');
    expect(lines.find((l) => l.part.id === 'title-1')!.where).toBe('');
  });

  it('bands each part the way the card reads', () => {
    const [screen] = describePlayground(builtBag());
    const byId = new Map(screen.cards[0].composition.map((l) => [l.part.id, l.band]));
    expect(byId.get('title-1')).toBe('row');
    expect(byId.get('slider-1')).toBe('body');
  });

  // The lab's original question — "the to-do card, but with the tick moved" — has to survive
  // inside the playground, which is what `origin` is for.
  it('gives an origin card BOTH its full composition and its diff against the real one', () => {
    const shipped = cardKnob('todo')!;
    const parts = shipped.defaultParts.map((p) => (p.id === 'check' ? { ...p, slot: 'leading' as const } : { ...p }));
    const bag: LabOverrides = {
      ...EMPTY_OVERRIDES,
      playground: { screens: [{ id: 's1', screen: 'plans', title: '', note: '', cards: [{ id: 'c1', origin: 'todo', title: '', note: '', parts }] }], note: '' },
    };
    const card = describePlayground(bag)[0].cards[0];
    expect(card.originSource).toBe(shipped.source);
    expect(card.composition.length).toBe(parts.length);
    expect(card.diff!.map((c) => c.kind)).toEqual(['moved']);
  });

  it('carries the screen’s and the card’s own words', () => {
    const [screen] = describePlayground(builtBag());
    expect(screen.note).toBe('this is the screen I actually open first');
    expect(screen.cards[0].note).toBe('the slider should be the thing you reach for');
  });

  it('walks screens in the order they were built, not in registry order', () => {
    const bag: LabOverrides = {
      ...EMPTY_OVERRIDES,
      playground: {
        screens: [
          { id: 'b', screen: 'health', title: '', note: 'second built', cards: [] },
          { id: 'a', screen: 'plans', title: '', note: 'first built', cards: [] },
        ],
        note: '',
      },
    };
    expect(describePlayground(bag).map((s) => s.id)).toEqual(['b', 'a']);
  });
});
