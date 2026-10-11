/**
 * motifs.ts — GENERATED FILE. Do not edit by hand.
 *
 * Run `node scripts/build-motifs.mjs` to regenerate from assets/decorative/*.svg.
 * Edit the SVGs (or the generator), never this file — hand edits are lost on the next run.
 *
 * The decorative motif geometry, derived from the logo mark's own vocabulary: halo ring,
 * brush-daub canopy, forking trunk, ground arc, floating dots. Each `-light`/`-dark` SVG
 * pair is geometrically identical and differs only in colour and opacity, so one entry here
 * holds the shared geometry plus BOTH opacities (`o` light, `od` dark) and no colour at
 * all — the consumer passes a theme token, which keeps components free of raw hex.
 *
 * Connections:
 *   Imports → nothing (deliberately dependency-free, like lib/cardLayout.ts and lib/growth.ts)
 *   Used by → components/Motif.tsx (the only renderer)
 *   Data    → none — pure data
 *
 * Edit notes:
 *   - Elements are painted back-to-front; `els` order is load-bearing.
 *   - Coordinates are in the motif's own viewBox (`w` × `h`), never screen pixels.
 *   - Only the motifs something draws are kept (2026-10-11: halo-ring for the tour finale,
 *     leaf-icon for HabitLeading). The tab backdrops, the tree illustrations and the other
 *     ornaments were deleted with their SVGs once nothing drew them — git history has them.
 */

/** What a part of a motif is, so a consumer can treat parts differently without re-parsing. */
export type MotifRole = 'stroke' | 'canopy' | 'ring' | 'wash' | 'dot' | 'shape' | 'ground';

/** A trunk/branch line (`stroke`), or a filled shape — a leaf or a slab of bark (`shape`). */
export type MotifPath = {
  t: 'p'; role: 'stroke' | 'shape';
  d: string; w: number; fill?: boolean; c?: number; o: number; od: number;
};
/** A brush-daub canopy blob (rotated, never a plain circle), or the shadow pooled under a trunk. */
export type MotifEllipse = {
  t: 'e'; role: 'canopy' | 'ground';
  cx: number; cy: number; rx: number; ry: number; rot: number; c?: number; o: number; od: number;
};
/** A halo outline (`ring`, has `w`), a large soft fill (`wash`), or a floating dot. */
export type MotifCircle = {
  t: 'c'; role: 'ring' | 'wash' | 'dot';
  cx: number; cy: number; r: number; w?: number; c?: number; o: number; od: number;
};

/**
 * An illustration's own colours, one entry per mode, index-aligned — element `c` indexes
 * into these. Present ONLY on the illustrated set; a tintable motif has no `pal` and is
 * coloured entirely by the token its consumer passes.
 *
 * Yes, this is raw hex in a constants file, which the rest of this pipeline exists to avoid.
 * It is the honest place for it: these are an illustration's pigments, no more themeable than
 * the pixels in assets/bg-light.png, and the alternative — a component holding them — is
 * strictly worse. The tintable path is untouched and still carries no colour at all.
 */
export type MotifPalette = { light: readonly string[]; dark: readonly string[] };
export type MotifElement = MotifPath | MotifEllipse | MotifCircle;

export type Motif = { w: number; h: number; els: readonly MotifElement[]; pal?: MotifPalette };

/**
 * `as const` on the raw object keeps the KEY NAMES literal (so MotifId is a union of ids and
 * a typo is a compile error), but it also narrows every element field to its literal value —
 * which makes `d: string` unassignable and breaks any consumer that filters by `t`. Widening
 * through an explicit Record annotation on the export gives both: literal ids, ordinary
 * element types.
 */
const RAW = {
  'halo-ring': {
    w: 200,
    h: 200,
    els: [
      { t:'c', role:'ring', cx:100, cy:100, r:94, w:1.5, o:0.275, od:0.3575 },
      { t:'c', role:'wash', cx:100, cy:100, r:94, o:0.05, od:0.09 },
      { t:'c', role:'dot', cx:150, cy:55, r:3, o:0.35, od:0.455 },
      { t:'c', role:'dot', cx:158, cy:70, r:2, o:0.35, od:0.455 },
      { t:'c', role:'dot', cx:38, cy:120, r:2.5, o:0.35, od:0.455 },
    ],
  },
  'leaf-icon': {
    w: 24,
    h: 24,
    els: [
      { t:'p', role:'shape', d:'M12.0,20.0 Q18.9,14.8 12.0,5.0 Q5.1,14.8 12.0,20.0 Z', w:0, fill:true, o:1, od:1 },
      { t:'p', role:'stroke', d:'M12.0,20.0 L12.0,5.0', w:0.8, o:0.4, od:0.4 },
    ],
  },
} as const;

export type MotifId = keyof typeof RAW;

export const MOTIFS: Record<MotifId, Motif> = RAW;

export const MOTIF_IDS = Object.keys(MOTIFS) as MotifId[];

