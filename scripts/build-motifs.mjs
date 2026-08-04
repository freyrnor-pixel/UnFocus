#!/usr/bin/env node
/**
 * build-motifs.mjs — turn assets/decorative/*.svg into constants/motifs.ts.
 *
 * The app cannot import .svg files (no react-native-svg-transformer, and adding one would
 * still leave the hardcoded #3B82F6/#60A5FA in the way of per-tab feature-colour tinting).
 * So the geometry is generated into TypeScript instead — the same "path data lives in TS"
 * shape components/ScreenBackground.tsx has always used, but produced by a script so a
 * re-export from the design tool is one command and nothing drifts by transcription.
 *
 * What it relies on (verified across all 26 delivered files):
 *   - Every `-light`/`-dark` pair is geometrically IDENTICAL. They differ only in the single
 *     colour (#3B82F6 vs #60A5FA) and in per-element opacity. So one geometry entry carries
 *     both opacities (`o` light, `od` dark) and no colour at all — the consumer passes a
 *     theme token, which is what keeps the no-raw-hex rule intact and lets a backdrop be
 *     recoloured per tab from lib/screenColor.ts.
 *   - Only three element types appear: <path> (always fill="none" + stroke), <ellipse>
 *     (always filled + rotated — the brush-daub canopy), and <circle> (filled, or fill="none"
 *     for the halo ring).
 *
 * Roles exist so a consumer can treat parts of a motif differently (e.g. tint only the
 * canopy) without re-parsing anything:
 *   stroke = trunk/branch line · canopy = brush daub · ring = halo outline
 *   wash   = large soft fill   · dot    = floating dot
 *
 * Usage: node scripts/build-motifs.mjs   (writes constants/motifs.ts)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'decorative');
const OUT = join(ROOT, 'constants', 'motifs.ts');

const LIGHT_HEX = '#3B82F6';
const DARK_HEX = '#60A5FA';

/** Pull one attribute off an element's attribute string. */
const attr = (a, name) => {
  const m = a.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : undefined;
};
const num = (a, name, dflt) => {
  const v = attr(a, name);
  return v === undefined ? dflt : Number(v);
};

/** Round to 4dp and drop the trailing zeros, so the generated file stays readable. */
const r4 = (n) => Number(n.toFixed(4));

/**
 * Parse one SVG into { w, h, els }. Element order is preserved — these files are painted
 * back-to-front (washes first, strokes and dots last), so order is load-bearing.
 */
function parse(file) {
  const svg = readFileSync(file, 'utf8');
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vb) throw new Error(`${file}: expected a viewBox anchored at 0 0`);

  const els = [];
  const re = /<(path|circle|ellipse)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(svg))) {
    const [, tag, a] = m;
    const opacity = num(a, 'opacity', 1);
    const fill = attr(a, 'fill');

    if (tag === 'path') {
      // A path is either a stroked LINE (fill="none" + stroke — the trunk/branch vocabulary
      // the ellipse motifs are built from) or a FILLED SHAPE (the illustrated set's leaves and
      // bark). Reading only stroke-width, as this did before the illustrations landed, turned
      // every filled leaf into an unstroked 1px hairline.
      const filled = fill !== undefined && fill !== 'none';
      els.push(
        filled
          ? { t: 'p', role: 'shape', d: attr(a, 'd'), w: 0, fill: true, col: fill, o: opacity }
          : { t: 'p', role: 'stroke', d: attr(a, 'd'), w: num(a, 'stroke-width', 1), col: attr(a, 'stroke'), o: opacity }
      );
    } else if (tag === 'ellipse') {
      // transform="rotate(<deg> <cx> <cy>)" — only the angle matters, the origin is the
      // ellipse's own centre in every delivered file.
      const rot = a.match(/rotate\(\s*(-?[\d.]+)/);
      // A rotated ellipse is a brush-daub canopy. An UNROTATED one only ever appears in the
      // illustrated set, where it is the soft shadow pooled under the trunk — calling that a
      // canopy would make the role map lie about the one element that isn't foliage.
      const rotation = rot ? Number(rot[1]) : 0;
      els.push({
        t: 'e',
        role: rotation === 0 ? 'ground' : 'canopy',
        cx: num(a, 'cx'), cy: num(a, 'cy'), rx: num(a, 'rx'), ry: num(a, 'ry'),
        rot: rotation,
        col: fill,
        o: opacity,
      });
    } else {
      const rad = num(a, 'r');
      const role = fill === 'none' ? 'ring' : rad >= 20 ? 'wash' : 'dot';
      const el = { t: 'c', role, cx: num(a, 'cx'), cy: num(a, 'cy'), r: rad, o: opacity };
      el.col = role === 'ring' ? attr(a, 'stroke') : fill;
      if (role === 'ring') el.w = num(a, 'stroke-width', 1);
      els.push(el);
    }
  }
  return { w: Number(vb[1]), h: Number(vb[2]), els };
}

/**
 * Merge a light/dark pair into one geometry list carrying both opacities.
 *
 * Colour is handled one of two ways, decided per motif by how many distinct colours the
 * light file actually uses:
 *
 *   ONE colour  → the classic tintable motif. The colour is DROPPED entirely and the
 *                 consumer passes a theme token, exactly as before. Output is unchanged.
 *   MANY        → an illustration (the natural-tree set). Geometry alone can't carry it, so
 *                 the motif gets a `pal`: the distinct (light, dark) colour pairs in
 *                 first-appearance order, with each element holding an index into it.
 *
 * The second case is the reason `col` is excluded from the geometry equality check below —
 * differing colour between the two files is the entire point; differing GEOMETRY is still a
 * hard error.
 */
function merge(light, dark, id) {
  if (light.w !== dark.w || light.h !== dark.h) throw new Error(`${id}: viewBox mismatch`);
  if (light.els.length !== dark.els.length) throw new Error(`${id}: element count mismatch`);

  const pairs = [];
  const indexOf = new Map();

  const els = light.els.map((l, i) => {
    const d = dark.els[i];
    // Geometry must match exactly — that is the assumption the whole single-entry design
    // rests on, so fail loudly rather than silently preferring the light file.
    for (const k of Object.keys(l)) {
      if (k === 'o' || k === 'col') continue;
      if (l[k] !== d[k]) throw new Error(`${id}: element ${i} differs in "${k}" between light and dark`);
    }
    const key = `${l.col}|${d.col}`;
    if (!indexOf.has(key)) {
      indexOf.set(key, pairs.length);
      pairs.push([l.col, d.col]);
    }
    return { ...l, c: indexOf.get(key), o: r4(l.o), od: r4(d.o) };
  });

  if (new Set(pairs.map(([lc]) => lc)).size <= 1) {
    // Tintable: strip the colour bookkeeping back off so these entries stay byte-identical
    // to what this generator produced before illustrations existed.
    for (const e of els) { delete e.c; delete e.col; }
    return { w: light.w, h: light.h, els };
  }

  for (const e of els) delete e.col;
  return {
    w: light.w,
    h: light.h,
    els,
    pal: { light: pairs.map(([lc]) => lc), dark: pairs.map(([, dc]) => dc) },
  };
}

/** Serialise one element as a compact single-line object literal. */
function ser(e) {
  const parts = [`t:'${e.t}'`, `role:'${e.role}'`];
  if (e.t === 'p') {
    parts.push(`d:'${e.d}'`, `w:${r4(e.w)}`);
    if (e.fill) parts.push('fill:true');
  } else if (e.t === 'e') parts.push(`cx:${r4(e.cx)}`, `cy:${r4(e.cy)}`, `rx:${r4(e.rx)}`, `ry:${r4(e.ry)}`, `rot:${r4(e.rot)}`);
  else {
    parts.push(`cx:${r4(e.cx)}`, `cy:${r4(e.cy)}`, `r:${r4(e.r)}`);
    if (e.w !== undefined) parts.push(`w:${r4(e.w)}`);
  }
  if (e.c !== undefined) parts.push(`c:${e.c}`);
  parts.push(`o:${e.o}`, `od:${e.od}`);
  return `{ ${parts.join(', ')} }`;
}

// ── Collect the pairs ────────────────────────────────────────────────────────────────────
// Two source directories: the tintable motifs sit directly in assets/decorative/, the
// full-colour illustrated set in assets/decorative/illustrations/. They're kept apart because
// they are different KINDS of art, not because the generator treats the folders differently —
// what actually decides the handling is how many colours a file uses (see merge()).
const dirs = [
  { dir: SRC, tintable: true },
  { dir: join(SRC, 'illustrations'), tintable: false },
];

const sources = new Map();
for (const { dir, tintable } of dirs) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    continue; // the illustrations folder is optional
  }
  for (const f of entries.filter((n) => n.endsWith('-light.svg'))) {
    sources.set(f.replace(/-light\.svg$/, ''), { dir, tintable });
  }
}
const ids = [...sources.keys()].sort();
if (!ids.length) throw new Error(`no *-light.svg found under ${SRC}`);

const motifs = new Map();
for (const id of ids) {
  const { dir, tintable } = sources.get(id);
  const light = parse(join(dir, `${id}-light.svg`));
  const dark = parse(join(dir, `${id}-dark.svg`));
  // The cross-theme guard catches a light file exported with the dark hex (or vice versa),
  // which is a real and otherwise-silent export mistake. It only makes sense for the tintable
  // set, whose whole palette IS those two hexes — an illustration legitimately uses many
  // colours, some of which coincide with them.
  if (tintable) {
    const lightSrc = readFileSync(join(dir, `${id}-light.svg`), 'utf8');
    const darkSrc = readFileSync(join(dir, `${id}-dark.svg`), 'utf8');
    if (lightSrc.includes(DARK_HEX) || darkSrc.includes(LIGHT_HEX)) {
      throw new Error(`${id}: a file uses the other theme's colour — check the export`);
    }
  }
  const merged = merge(light, dark, id);
  if (tintable && merged.pal) {
    throw new Error(`${id}: sits in the tintable folder but uses ${merged.pal.light.length} colours — move it to illustrations/`);
  }
  motifs.set(id, merged);
}

// ── Emit ─────────────────────────────────────────────────────────────────────────────────
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

// Written by scripts/author-screen-bgs.mjs alongside the strip itself, so the panel order has
// exactly one source of truth rather than being restated here.
const panelOrder = JSON.parse(readFileSync(join(SRC, 'strip-panels.json'), 'utf8'));

const body = ids
  .map((id) => {
    const m = motifs.get(id);
    const pal = m.pal
      ? `    pal: {\n      light: [${m.pal.light.map((c) => `'${c}'`).join(', ')}],\n      dark: [${m.pal.dark.map((c) => `'${c}'`).join(', ')}],\n    },\n`
      : '';
    return `  '${id}': {\n    w: ${m.w},\n    h: ${m.h},\n${pal}    els: [\n${m.els.map((e) => `      ${ser(e)},`).join('\n')}\n    ],\n  },`;
  })
  .join('\n');

const out = `/**
 * motifs.ts — GENERATED FILE. Do not edit by hand.
 *
 * Run \`node scripts/build-motifs.mjs\` to regenerate from assets/decorative/*.svg.
 * Edit the SVGs (or the generator), never this file — hand edits are lost on the next run.
 *
 * The decorative motif geometry, derived from the logo mark's own vocabulary: halo ring,
 * brush-daub canopy, forking trunk, ground arc, floating dots. Each \`-light\`/\`-dark\` SVG
 * pair is geometrically identical and differs only in colour and opacity, so one entry here
 * holds the shared geometry plus BOTH opacities (\`o\` light, \`od\` dark) and no colour at
 * all — the consumer passes a theme token. That is what keeps components free of raw hex and
 * lets one backdrop be recoloured per tab from lib/screenColor.ts.
 *
 * Connections:
 *   Imports → nothing (deliberately dependency-free, like lib/cardLayout.ts and lib/growth.ts)
 *   Used by → components/Motif.tsx (the only renderer), components/ScreenBackground.tsx
 *   Data    → none — pure data
 *
 * Edit notes:
 *   - Elements are painted back-to-front; \`els\` order is load-bearing.
 *   - Coordinates are in the motif's own viewBox (\`w\` × \`h\`), never screen pixels.
 *   - \`screen-bg-strip\` is the five tab backdrops as ONE continuous 1950×844 run (5 × 390),
 *     slid with the pager rather than swapped per tab, so the branch never breaks at a seam.
 *     Panel k occupies x [390k, 390(k+1)) in bottom-nav order: shopping, plans, home, health,
 *     habits. \`screen-bg-calm\` is the standalone 390×844 backdrop for sub-tier screens.
 *     lib/__tests__/motifs.test.ts pins the strip's geometry and the protected centre box
 *     (x 84–306, y 236–612 per panel) that cards live in.
 *   - Regenerate the strip with \`node scripts/author-screen-bgs.mjs\` — it is authored from a
 *     shared spine, which is what makes continuity structural instead of a coordinate two
 *     files have to agree on. Don't hand-edit screen-bg-strip-*.svg.
 */

/** What a part of a motif is, so a consumer can treat parts differently without re-parsing. */
export type MotifRole = 'stroke' | 'canopy' | 'ring' | 'wash' | 'dot' | 'shape' | 'ground';

/** A trunk/branch line (\`stroke\`), or a filled shape — a leaf or a slab of bark (\`shape\`). */
export type MotifPath = {
  t: 'p'; role: 'stroke' | 'shape';
  d: string; w: number; fill?: boolean; c?: number; o: number; od: number;
};
/** A brush-daub canopy blob (rotated, never a plain circle), or the shadow pooled under a trunk. */
export type MotifEllipse = {
  t: 'e'; role: 'canopy' | 'ground';
  cx: number; cy: number; rx: number; ry: number; rot: number; c?: number; o: number; od: number;
};
/** A halo outline (\`ring\`, has \`w\`), a large soft fill (\`wash\`), or a floating dot. */
export type MotifCircle = {
  t: 'c'; role: 'ring' | 'wash' | 'dot';
  cx: number; cy: number; r: number; w?: number; c?: number; o: number; od: number;
};

/**
 * An illustration's own colours, one entry per mode, index-aligned — element \`c\` indexes
 * into these. Present ONLY on the illustrated set; a tintable motif has no \`pal\` and is
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
 * \`as const\` on the raw object keeps the KEY NAMES literal (so MotifId is a union of ids and
 * a typo is a compile error), but it also narrows every element field to its literal value —
 * which makes \`d: string\` unassignable and breaks any consumer that filters by \`t\`. Widening
 * through an explicit Record annotation on the export gives both: literal ids, ordinary
 * element types.
 */
const RAW = {
${body}
} as const;

export type MotifId = keyof typeof RAW;

export const MOTIFS: Record<MotifId, Motif> = RAW;

export const MOTIF_IDS = Object.keys(MOTIFS) as MotifId[];

/** The full-screen backdrops: the sliding tab strip and the standalone sub-tier one. */
export const SCREEN_BG_IDS = MOTIF_IDS.filter((id) => id.startsWith('screen-bg-'));

/**
 * Which tab each 390-wide panel of \`screen-bg-strip\` belongs to, left to right.
 *
 * This MUST match the <TopTabs.Screen> order in app/(tabs)/_layout.tsx, because the strip is
 * slid by that navigator's index — if they disagree, every tab quietly shows its neighbour's
 * art. lib/__tests__/motifs.test.ts checks the two against each other.
 */
export const STRIP_PANEL_ORDER = ${JSON.stringify(panelOrder)} as const;
`;

writeFileSync(OUT, out);
console.log(`motifs: ${ids.length} pairs → constants/motifs.ts`);
for (const id of ids) console.log(`  ${camel(id).padEnd(22)} ${motifs.get(id).els.length} elements`);
