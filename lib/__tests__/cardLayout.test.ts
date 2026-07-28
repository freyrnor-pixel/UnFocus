/**
 * cardLayout.test.ts — resolution, validation, and the "layouts are presentation only" guarantee.
 *
 * The resolution tests cover the degradation paths that keep a bad stored value from blanking
 * a screen: an override for the wrong surface, an id from a build that has since renamed it,
 * a non-string value, an array where an object was expected.
 *
 * The last block is the important one. A layout decides how existing data is DRAWN; it must
 * never decide what the app DOES. A row the active layout doesn't render still owns its
 * reminders. That is enforced structurally — lib/cardLayout.ts and lib/useNewSinceSeen.ts are
 * not permitted to reach the notification or store layers at all — so the guarantee can't be
 * broken by a later edit without this test failing.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DETAIL_LEVELS,
  FALLBACK_LAYOUT,
  LAYOUT_SPECS,
  SURFACE_LAYOUTS,
  isLayoutValidFor,
  resolveLayout,
  resolveLayoutSpec,
  sanitizeCardLayouts,
  sanitizeDetailLevel,
  withSurfaceLayout,
  type LayoutSurface,
} from '@/lib/cardLayout';

const SURFACES = Object.keys(SURFACE_LAYOUTS) as LayoutSurface[];

describe('resolveLayout', () => {
  it('prefers a valid per-surface override over the global default', () => {
    expect(resolveLayout('shopping', { shopping: 'inStore' }, 'basic')).toBe('inStore');
  });

  it('falls back to the global default when there is no override', () => {
    expect(resolveLayout('shopping', {}, 'everything')).toBe('everything');
    expect(resolveLayout('shopping', undefined, 'basic')).toBe('basic');
  });

  it('ignores an override that belongs to a different surface', () => {
    // 'inStore' is a Shopping layout; Notes must not accept it.
    expect(resolveLayout('notes', { notes: 'inStore' }, 'basic')).toBe('basic');
  });

  it('ignores an unknown override id and an unknown global default', () => {
    expect(resolveLayout('plans', { plans: 'cozyMode' }, 'normal')).toBe('normal');
    expect(resolveLayout('plans', {}, 'cozyMode')).toBe(FALLBACK_LAYOUT);
  });

  it('never dead-ends — every surface resolves to a real spec from empty input', () => {
    for (const surface of SURFACES) {
      const spec = resolveLayoutSpec(surface, undefined, undefined);
      expect(spec).toBeDefined();
      expect(spec.id).toBe(FALLBACK_LAYOUT);
    }
  });
});

describe('surface/layout registry integrity', () => {
  it('offers all three detail levels on every surface, so the global default always applies', () => {
    for (const surface of SURFACES) {
      for (const level of DETAIL_LEVELS) {
        expect(isLayoutValidFor(surface, level)).toBe(true);
      }
    }
  });

  it('has a spec for every layout any surface offers', () => {
    for (const surface of SURFACES) {
      for (const id of SURFACE_LAYOUTS[surface]) {
        expect(LAYOUT_SPECS[id]).toBeDefined();
        expect(LAYOUT_SPECS[id].id).toBe(id);
      }
    }
  });

  it('offers "By person" on plans only — it is the only surface with a per-person notion', () => {
    expect(isLayoutValidFor('plans', 'byPerson')).toBe(true);
    for (const surface of SURFACES.filter((s) => s !== 'plans')) {
      expect(isLayoutValidFor(surface, 'byPerson')).toBe(false);
    }
  });

  it('makes "By person" a GROUPING change, not another density level', () => {
    // It re-groups the same rows; drawing them differently too would make it a second,
    // confusing axis next to basic/normal/everything.
    const byPerson = LAYOUT_SPECS.byPerson;
    const normal = LAYOUT_SPECS.normal;
    expect(byPerson.groupByPerson).toBe(true);
    expect(byPerson.density).toBe(normal.density);
    expect(byPerson.showMeta).toBe(normal.showMeta);
    expect(byPerson.showPrice).toBe(normal.showPrice);
    expect(byPerson.showExtras).toBe(normal.showExtras);
  });

  it('leaves every other layout ungrouped, so grouping is opt-in', () => {
    for (const id of Object.keys(LAYOUT_SPECS) as (keyof typeof LAYOUT_SPECS)[]) {
      if (id !== 'byPerson') expect(LAYOUT_SPECS[id].groupByPerson).toBeFalsy();
    }
  });

  it('groups by aisle ONLY in "In the store"', () => {
    // Every other layout leaves Weekly rows in the order the user dragged them into. If
    // groupByAisle ever leaked onto another layout it would silently re-cluster that list
    // and undo a manual drag every time it rendered — the exact reason
    // lib/shoppingGroups.ts keeps groupByCategory off the Weekly tab by default.
    expect(LAYOUT_SPECS.inStore.groupByAisle).toBe(true);
    for (const id of Object.keys(LAYOUT_SPECS) as (keyof typeof LAYOUT_SPECS)[]) {
      if (id !== 'inStore') expect(LAYOUT_SPECS[id].groupByAisle).toBeFalsy();
    }
  });

  it('offers "In the store" on shopping only', () => {
    expect(isLayoutValidFor('shopping', 'inStore')).toBe(true);
    for (const surface of SURFACES.filter((s) => s !== 'shopping')) {
      expect(isLayoutValidFor(surface, 'inStore')).toBe(false);
    }
  });

  it('keeps "basic" strictly less detailed than "everything"', () => {
    const basic = LAYOUT_SPECS.basic;
    const everything = LAYOUT_SPECS.everything;
    expect(basic.showMeta).toBe(false);
    expect(basic.showPrice).toBe(false);
    expect(basic.showExtras).toBe(false);
    expect(everything.showMeta).toBe(true);
    expect(everything.showPrice).toBe(true);
    expect(everything.showExtras).toBe(true);
  });
});

describe('withSurfaceLayout', () => {
  it('sets an override without disturbing other surfaces', () => {
    expect(withSurfaceLayout({ plans: 'nowNext' }, 'shopping', 'inStore')).toEqual({
      plans: 'nowNext',
      shopping: 'inStore',
    });
  });

  it('clearing an override removes the key so the surface follows the global default again', () => {
    const next = withSurfaceLayout({ plans: 'nowNext', shopping: 'inStore' }, 'shopping', null);
    expect(next).toEqual({ plans: 'nowNext' });
    expect(resolveLayout('shopping', next, 'basic')).toBe('basic');
  });

  it('does not mutate the input', () => {
    const before = { shopping: 'inStore' };
    withSurfaceLayout(before, 'plans', 'nowNext');
    expect(before).toEqual({ shopping: 'inStore' });
  });
});

describe('sanitizers', () => {
  it('drops unknown surfaces, wrong-surface ids, and non-string values', () => {
    expect(
      sanitizeCardLayouts({
        shopping: 'inStore',
        plans: 'inStore', // valid id, wrong surface
        bogusSurface: 'normal',
        notes: 42,
        health: 'everything',
      })
    ).toEqual({ shopping: 'inStore', health: 'everything' });
  });

  it('survives non-object input', () => {
    expect(sanitizeCardLayouts(null)).toEqual({});
    expect(sanitizeCardLayouts(undefined)).toEqual({});
    expect(sanitizeCardLayouts('nope')).toEqual({});
    expect(sanitizeCardLayouts(['inStore'])).toEqual({});
  });

  it('normalizes the global detail level', () => {
    expect(sanitizeDetailLevel('everything')).toBe('everything');
    expect(sanitizeDetailLevel('inStore')).toBe(FALLBACK_LAYOUT); // not a global-level value
    expect(sanitizeDetailLevel(undefined)).toBe(FALLBACK_LAYOUT);
    expect(sanitizeDetailLevel(7)).toBe(FALLBACK_LAYOUT);
  });
});

describe('layouts are presentation only', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  // If one of these ever needs to import a store, the feature has drifted: something is
  // deciding behaviour from a display preference. Pass the value in as an argument instead.
  const FORBIDDEN = [
    'lib/notifications',
    'expo-notifications',
    'lib/reminders',
    'lib/medicineNotifications',
    'store/use',
  ];

  it.each(['cardLayout.ts', 'useNewSinceSeen.ts'])(
    '%s reaches no notification or store module',
    (file) => {
      const source = read(file);
      // Strip the JSDoc header so prose *describing* the rule doesn't trip it.
      const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '');
      for (const forbidden of FORBIDDEN) {
        expect(code).not.toContain(forbidden);
      }
    }
  );

  it('cardLayout.ts is fully dependency-free', () => {
    const code = read('cardLayout.ts').replace(/\/\*\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/^\s*import\s/m);
  });
});
