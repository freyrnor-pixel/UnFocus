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
      els.push({ t: 'p', role: 'stroke', d: attr(a, 'd'), w: num(a, 'stroke-width', 1), o: opacity });
    } else if (tag === 'ellipse') {
      // transform="rotate(<deg> <cx> <cy>)" — only the angle matters, the origin is the
      // ellipse's own centre in every delivered file.
      const rot = a.match(/rotate\(\s*(-?[\d.]+)/);
      els.push({
        t: 'e',
        role: 'canopy',
        cx: num(a, 'cx'), cy: num(a, 'cy'), rx: num(a, 'rx'), ry: num(a, 'ry'),
        rot: rot ? Number(rot[1]) : 0,
        o: opacity,
      });
    } else {
      const rad = num(a, 'r');
      const role = fill === 'none' ? 'ring' : rad >= 20 ? 'wash' : 'dot';
      const el = { t: 'c', role, cx: num(a, 'cx'), cy: num(a, 'cy'), r: rad, o: opacity };
      if (role === 'ring') el.w = num(a, 'stroke-width', 1);
      els.push(el);
    }
  }
  return { w: Number(vb[1]), h: Number(vb[2]), els };
}

/** Merge a light/dark pair into one geometry list carrying both opacities. */
function merge(light, dark, id) {
  if (light.w !== dark.w || light.h !== dark.h) throw new Error(`${id}: viewBox mismatch`);
  if (light.els.length !== dark.els.length) throw new Error(`${id}: element count mismatch`);
  const els = light.els.map((l, i) => {
    const d = dark.els[i];
    // Geometry must match exactly — that is the assumption the whole single-entry design
    // rests on, so fail loudly rather than silently preferring the light file.
    for (const k of Object.keys(l)) {
      if (k === 'o') continue;
      if (l[k] !== d[k]) throw new Error(`${id}: element ${i} differs in "${k}" between light and dark`);
    }
    return { ...l, o: r4(l.o), od: r4(d.o) };
  });
  return { w: light.w, h: light.h, els };
}

/** Serialise one element as a compact single-line object literal. */
function ser(e) {
  const parts = [`t:'${e.t}'`, `role:'${e.role}'`];
  if (e.t === 'p') parts.push(`d:'${e.d}'`, `w:${r4(e.w)}`);
  else if (e.t === 'e') parts.push(`cx:${r4(e.cx)}`, `cy:${r4(e.cy)}`, `rx:${r4(e.rx)}`, `ry:${r4(e.ry)}`, `rot:${r4(e.rot)}`);
  else {
    parts.push(`cx:${r4(e.cx)}`, `cy:${r4(e.cy)}`, `r:${r4(e.r)}`);
    if (e.w !== undefined) parts.push(`w:${r4(e.w)}`);
  }
  parts.push(`o:${e.o}`, `od:${e.od}`);
  return `{ ${parts.join(', ')} }`;
}

// ── Collect the pairs ────────────────────────────────────────────────────────────────────
const files = readdirSync(SRC).filter((f) => f.endsWith('-light.svg'));
const ids = files.map((f) => f.replace(/-light\.svg$/, '')).sort();
if (!ids.length) throw new Error(`no *-light.svg found in ${SRC}`);

const motifs = new Map();
for (const id of ids) {
  const light = parse(join(SRC, `${id}-light.svg`));
  const dark = parse(join(SRC, `${id}-dark.svg`));
  const lightSrc = readFileSync(join(SRC, `${id}-light.svg`), 'utf8');
  const darkSrc = readFileSync(join(SRC, `${id}-dark.svg`), 'utf8');
  if (lightSrc.includes(DARK_HEX) || darkSrc.includes(LIGHT_HEX)) {
    throw new Error(`${id}: a file uses the other theme's colour — check the export`);
  }
  motifs.set(id, merge(light, dark, id));
}

// ── Emit ─────────────────────────────────────────────────────────────────────────────────
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

// Written by scripts/author-screen-bgs.mjs alongside the strip itself, so the panel order has
// exactly one source of truth rather than being restated here.
const panelOrder = JSON.parse(readFileSync(join(SRC, 'strip-panels.json'), 'utf8'));

const body = ids
  .map((id) => {
    const m = motifs.get(id);
    return `  '${id}': {\n    w: ${m.w},\n    h: ${m.h},\n    els: [\n${m.els.map((e) => `      ${ser(e)},`).join('\n')}\n    ],\n  },`;
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
export type MotifRole = 'stroke' | 'canopy' | 'ring' | 'wash' | 'dot';

/** A trunk/branch line. */
export type MotifPath = { t: 'p'; role: 'stroke'; d: string; w: number; o: number; od: number };
/** A brush-daub canopy blob — rotated, never a plain circle. */
export type MotifEllipse = {
  t: 'e'; role: 'canopy';
  cx: number; cy: number; rx: number; ry: number; rot: number; o: number; od: number;
};
/** A halo outline (\`ring\`, has \`w\`), a large soft fill (\`wash\`), or a floating dot. */
export type MotifCircle = {
  t: 'c'; role: 'ring' | 'wash' | 'dot';
  cx: number; cy: number; r: number; w?: number; o: number; od: number;
};
export type MotifElement = MotifPath | MotifEllipse | MotifCircle;

export type Motif = { w: number; h: number; els: readonly MotifElement[] };

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
