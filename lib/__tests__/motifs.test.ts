/**
 * motifs.test.ts — the contracts the decorative motif art has to keep.
 *
 * constants/motifs.ts is generated from assets/decorative/*.svg, so these are not tests of
 * hand-written logic — they are tests of the ART, pinned in code because the art is the thing
 * that silently broke. When the design system was delivered, its own stated edge-continuity
 * rule held for only one of its three backdrops, and one of them put its canopy straight
 * through the region where cards live. Neither failure is visible in a diff, and neither
 * throws at runtime; you just get a backdrop that quietly looks wrong. Hence:
 *
 *   (The centre-box and strip contracts left with the tab backdrops on 2026-10-11 — nothing
 *   draws a backdrop motif any more; git history has both tests.)
 *   3. The VOCABULARY. Canopy is brush-daub — rotated ellipses, never plain circles
 *      (decorativemotifs.md: "don't reintroduce plain circles/rectangles").
 */
import { MOTIFS, type MotifId } from '@/constants/motifs';

const ids = Object.keys(MOTIFS) as MotifId[];

// ── Structure ─────────────────────────────────────────────────────────────────────────────

describe('every motif is well-formed', () => {
  test('there are motifs at all, and each has geometry', () => {
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(MOTIFS[id].els.length).toBeGreaterThan(0);
      expect(MOTIFS[id].w).toBeGreaterThan(0);
      expect(MOTIFS[id].h).toBeGreaterThan(0);
    }
  });

  test.each(ids)('%s: opacities are in range, and dark is never weaker than light', (id) => {
    for (const e of MOTIFS[id].els) {
      expect(e.o).toBeGreaterThan(0);
      expect(e.o).toBeLessThanOrEqual(1);
      expect(e.od).toBeGreaterThan(0);
      expect(e.od).toBeLessThanOrEqual(1);
      // Dark mode reads against a much darker field, so the art is lifted, never dimmed.
      expect(e.od).toBeGreaterThanOrEqual(e.o);
    }
  });

  test.each(ids)('%s: canopy is brush-daub, never a plain circle', (id) => {
    for (const e of MOTIFS[id].els) {
      if (e.role === 'canopy') {
        expect(e.t).toBe('e');
        // "Brush daub" IS the rotation — an axis-aligned ellipse reads as a plain oval, which
        // is the thing the logo vocabulary is defined against.
        expect(e.rot).not.toBe(0);
      }
      // The inverse matters just as much: an ellipse that isn't canopy would mean the
      // generator's role mapping has drifted from the art. The one legitimate unrotated
      // ellipse is the illustrated set's ground shadow, pooled under a trunk — foliage it
      // is not, and labelling it 'canopy' to satisfy this test would make the role map lie.
      if (e.t === 'e') expect(e.role).toBe(e.rot === 0 ? 'ground' : 'canopy');
    }
  });
});

// ── Colour: tintable vs illustrated ───────────────────────────────────────────────────────

/**
 * Two kinds of motif, and the difference is load-bearing rather than cosmetic. A TINTABLE
 * motif carries no colour at all and is painted by whatever token its consumer passes — that
 * is what lets one backdrop be recoloured per tab. An ILLUSTRATION carries its own palette,
 * because a nine-colour painted tree cannot be expressed as one token.
 *
 * The risk this guards is a tintable motif silently acquiring a palette (it would stop
 * responding to the theme, on every screen, with nothing to see in review) or an illustration
 * losing one (every element collapses to a single flat colour).
 */
describe('colour is carried one of exactly two ways', () => {
  test.each(ids)('%s: palette and element colour indices agree', (id) => {
    const m = MOTIFS[id];
    const withIndex = m.els.filter((e) => e.c !== undefined);

    if (!m.pal) {
      // Tintable: nothing may carry a colour index, or it would be pointing at a palette
      // that does not exist.
      expect(withIndex).toHaveLength(0);
      return;
    }

    // Both modes must define the same slots — an element index is shared between them.
    expect(m.pal.dark).toHaveLength(m.pal.light.length);
    expect(m.pal.light.length).toBeGreaterThan(1); // one colour would mean it should be tintable

    // Every element resolves, and every declared colour is actually used — an unreferenced
    // slot means the generator's dedupe drifted from what it assigned.
    expect(withIndex).toHaveLength(m.els.length);
    for (const e of m.els) {
      expect(e.c).toBeGreaterThanOrEqual(0);
      expect(e.c).toBeLessThan(m.pal.light.length);
    }
    expect(new Set(m.els.map((e) => e.c)).size).toBe(m.pal.light.length);

    for (const hex of [...m.pal.light, ...m.pal.dark]) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

});
