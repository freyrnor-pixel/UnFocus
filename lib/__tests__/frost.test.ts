/**
 * frost.test.ts — the truth table of `shouldFrost` (lib/frost.ts).
 *
 * A Surface's frosted slice is gated on eight inputs. The defect this repo has already shipped
 * once is a rendering predicate that quietly went constant (CLAUDE.md, "A predicate that has gone
 * constant"), so this evaluates the predicate over EVERY combination rather than reading its
 * source, and asserts both that it can be true and exactly when.
 */
import { shouldFrost } from '@/lib/frostRule';

const CONTEXTS = ['ambient', 'nav', 'overlay'] as const;
const BOOLS = [false, true];

function* combos() {
  for (const enabled of BOOLS)
    for (const hasTint of BOOLS)
      for (const staticPressed of BOOLS)
        for (const reduceEffects of BOOLS)
          for (const glassSurfaces of BOOLS)
            for (const context of CONTEXTS)
              for (const frosted of BOOLS)
                for (const paintingHidden of BOOLS)
                  yield { enabled, hasTint, staticPressed, reduceEffects, glassSurfaces, context, frosted, paintingHidden };
}

describe('shouldFrost', () => {
  it('is true for exactly the panes in front of the painting, with both user switches allowing it', () => {
    let trues = 0;
    for (const c of combos()) {
      const expected =
        c.enabled && !c.hasTint && !c.staticPressed && !c.reduceEffects && c.glassSurfaces && !c.paintingHidden &&
        (c.context !== 'overlay' || c.frosted);
      expect({ c, got: shouldFrost(c) }).toEqual({ c, got: expected });
      if (expected) trues++;
    }
    // ambient (×2 frosted values) + nav (×2) + overlay with frosted (×1) = 5 true rows.
    expect(trues).toBe(5);
  });

  it('never frosts a sheet unless it asks to', () => {
    const base = { enabled: true, hasTint: false, staticPressed: false, reduceEffects: false, glassSurfaces: true, frosted: false, paintingHidden: false };
    expect(shouldFrost({ ...base, context: 'overlay' })).toBe(false);
    expect(shouldFrost({ ...base, context: 'overlay', frosted: true })).toBe(true);
  });

  it('honours "Reduce visual effects" and "Glass surfaces" on every context', () => {
    for (const context of CONTEXTS) {
      const on = { enabled: true, hasTint: false, staticPressed: false, glassSurfaces: true, frosted: true, paintingHidden: false, context };
      expect(shouldFrost({ ...on, reduceEffects: true })).toBe(false);
      expect(shouldFrost({ ...on, reduceEffects: false, glassSurfaces: false })).toBe(false);
    }
  });
});
