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
      slots: { 'row.right': 'nonsense', 'bench.a': 'button' },
    });
    expect(out.controls).toEqual({});
    expect(out.slots).toEqual({ 'bench.a': 'button' });
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
  it('cannot reach a store, the DB, or the notification layer', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'designLab.ts'), 'utf8');
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const spec of imports) {
      expect(spec).not.toMatch(/store\//);
      expect(spec).not.toMatch(/lib\/db/);
      expect(spec).not.toMatch(/lib\/notifications/);
      expect(spec).not.toMatch(/lib\/reminders/);
      expect(spec).not.toMatch(/lib\/liveSync|lib\/syncService/);
    }
  });
});
