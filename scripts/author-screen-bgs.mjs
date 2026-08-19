#!/usr/bin/env node
/**
 * author-screen-bgs.mjs — emit the tab backdrop strip into assets/decorative/.
 *
 * ── Why a STRIP and not five separate files ────────────────────────────────────────────────
 * The design system's `decorativemotifs.md` states an edge-continuity contract — a backdrop's
 * branch crosses the LEFT edge at y=660 and the RIGHT edge at y=600 (viewBox 390×844) — whose
 * stated purpose is that adjacent screens "look like one continuous line rather than three
 * unrelated backgrounds". Two problems with taking that literally:
 *
 *   1. Of the three delivered backdrops only `screen-bg-calm` honoured it at all.
 *      `screen-bg-grow`'s paths never reach x=0 or x=390 (trunk at x≈195, branches stopping at
 *      x=70/x=320); `screen-bg-list`'s trunk runs x≈350–372 top to bottom, touching neither.
 *   2. Even honoured exactly, the rule cannot produce one line: a panel LEAVES at y=600 and the
 *      next ENTERS at y=660, so every seam steps 60px. Rendering five conforming panels side by
 *      side shows the step plainly.
 *
 * So the tabs are authored as ONE continuous 1170×844 strip (3 × 390) and the app slides
 * it with the pager, exactly as onboarding slides the triptych. (It was 1950×844 / 5 × 390
 * until the 2026-08-20 5→3 tab merge — the strip's width is derived from PANELS.length, so
 * re-running this script is the whole migration.) Continuity is then structural
 * rather than a coordinate two files have to agree on, and the strip as a whole still enters at
 * y=660 and leaves at y=600 — the contract's endpoints, honoured across the whole run.
 * `screen-bg-calm` is left exactly as delivered for sub-tier/non-pager screens, where it stands
 * alone and its own edge values are the right ones.
 *
 * ── The centre box ────────────────────────────────────────────────────────────────────────
 * Each panel has a protected region (x 84–306, y 236–612 in panel coordinates) where cards and
 * content live. It is the long-standing reason ScreenBackground's art is corners-only and why
 * assets/bg-light.png was retired, and it is the other thing `screen-bg-grow` violated (canopy
 * at x 70–320, y 280–350, squarely behind Home's cards). The spine therefore stays below
 * y=612 wherever it crosses a panel's middle, and every interior sits above the box (y < 236)
 * or in a side margin (x < 84 / x > 306). lib/__tests__/motifs.test.ts pins both.
 *
 * Usage: node scripts/author-screen-bgs.mjs && node scripts/build-motifs.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'decorative');

const LIGHT = '#3B82F6';
const DARK = '#60A5FA';
const PANEL_W = 390;
const H = 844;

/**
 * Pager order — this MUST match the <TopTabs.Screen> order in app/(tabs)/_layout.tsx, because
 * the strip is slid by that navigator's index. Getting it wrong shows each tab its neighbour's
 * art, with no crash and nothing visible in a diff; it happened once already, when a stale
 * prose ordering in AGENTS.md was trusted over the navigator.
 * **Three panels since 2026-08-20** (was shopping, plans, home, habits, health).
 */
const PANELS = ['shopping', 'plans', 'home'];
const STRIP_W = PANEL_W * PANELS.length;

/** Dark mode must read harder against a much darker field. Matches the ratios measured across
 *  the delivered light/dark pairs: ×1.3 for lines and dots, more for the soft fills. */
const DARK_GAIN = { stroke: 1.3, canopy: 1.3, dot: 1.3 };

const r4 = (n) => Number(n.toFixed(4));
const dk = (o, kind) => r4(Math.min(1, o * DARK_GAIN[kind]));

/** Opacity budget from decorativemotifs.md: fills 0.1–0.3, strokes 0.4–0.85. */
const OP = { spine: 0.45, limb: 0.4, dot: 0.28 };

// ── The spine ────────────────────────────────────────────────────────────────────────────
/**
 * Waypoints every half-panel — so the length is `2 × PANELS.length + 1`, and it has to be
 * re-cut whenever the panel count changes (7 for three panels; it was 11 for five). Every
 * point that lands mid-panel (odd index, i.e. inside the centre box's x-range) is held at
 * y ≥ 685, well below the box's lower edge at 612; the dips to 620–645 all occur at panel
 * boundaries, which are outside the box. Starts at 660 and ends at 600 — the contract's two
 * edge values, across the whole strip.
 */
const SPINE_Y = [660, 690, 620, 690, 640, 700, 600];
if (SPINE_Y.length !== 2 * PANELS.length + 1) {
  throw new Error(
    `SPINE_Y has ${SPINE_Y.length} waypoints; ${PANELS.length} panels need ${2 * PANELS.length + 1}. ` +
      'Re-cut it keeping 660 first, 600 last, and every ODD index (mid-panel) at y >= 685.'
  );
}

/** Catmull-Rom through the waypoints, converted to cubic Béziers — one smooth path, no joins. */
function spinePath() {
  const pts = SPINE_Y.map((y, i) => [r4((i * STRIP_W) / (SPINE_Y.length - 1)), y]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || pts[i + 1];
    const c1 = [r4(p1[0] + (p2[0] - p0[0]) / 6), r4(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [r4(p2[0] - (p3[0] - p1[0]) / 6), r4(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// ── Interiors ────────────────────────────────────────────────────────────────────────────
const path = (d, o = OP.limb, w = 1.8) => ({ kind: 'stroke', d, w, o });
const dot = (cx, cy, r, o = OP.dot) => ({ kind: 'dot', cx, cy, r, o });

/**
 * A brush-daub canopy: overlapping rotated ellipses, never plain circles — the logo's own
 * vocabulary. Deterministic (no RNG), so a re-run reproduces byte-identical files.
 */
function canopy(cx, cy, scale = 1) {
  return [
    [-16, 2, 8.8, 5.1, -18, 0.14], [-5, -5, 9.6, 5.6, 8, 0.19], [7, -4, 9.3, 5.4, -10, 0.25],
    [17, 2, 8.0, 4.8, 20, 0.14], [-10, 9, 8.0, 4.8, -6, 0.19], [4, 7, 9.9, 5.8, 4, 0.25],
    [14, 10, 7.7, 4.5, 15, 0.14],
  ].map(([dx, dy, rx, ry, rot, o]) => ({
    kind: 'canopy',
    cx: r4(cx + dx * scale), cy: r4(cy + dy * scale),
    rx: r4(rx * scale), ry: r4(ry * scale), rot, o,
  }));
}

/**
 * Each tab's interior, in PANEL-LOCAL coordinates (0–390). Offset onto the strip below. Each
 * is visibly different so the backdrop alone tells you which tab you are on, while the shared
 * spine keeps the slide between any two of them unbroken.
 */
const INTERIORS = {
  // `habits` and `health` are kept below though nothing renders them — the render loop iterates
  // PANELS, so an unused key costs nothing, and hand-authored art is expensive to recover if
  // either ever gets a panel back. Do not treat their presence as a claim that they are drawn.
  // Leftmost tab: weight gathers toward the top-left.
  shopping: [
    path('M0 182 C36 150 54 128 78 116'),
    ...canopy(74, 112, 1.05),
    dot(120, 78, 3), dot(30, 214, 2.5),
  ],
  // Mirrored to the top-right, so tab 1 → tab 2 carries the weight across the screen.
  plans: [
    path('M390 196 C352 166 336 142 314 130'),
    ...canopy(310, 126, 1.05),
    dot(268, 92, 3), dot(360, 224, 2.5),
  ],
  // Home is the fuller one — canopy in BOTH top corners joined by an arc, plus a short trunk
  // stub off the spine. All of it above y=236 or below y=612.
  home: [
    path('M0 150 C40 118 62 100 92 96'),
    path('M92 96 C160 62 236 70 300 112', 0.42, 1.5),
    path('M390 176 C352 150 330 128 300 112'),
    path('M195 690 C193 664 197 646 195 628'),
    ...canopy(88, 92, 1.0),
    ...canopy(304, 116, 0.92),
    dot(195, 66, 3.2), dot(150, 196, 2.5), dot(250, 188, 2.5),
  ],
  // Weight drops to the right margin, mid-height — outside the box because x > 306.
  habits: [
    path('M390 452 C364 428 354 400 342 378'),
    ...canopy(346, 372, 0.95),
    dot(318, 316, 2.8), dot(374, 520, 2.5),
  ],
  // Rightmost tab: the mirror of habits, in the left margin (x < 84).
  health: [
    path('M0 474 C24 448 34 420 48 398'),
    ...canopy(44, 392, 0.95),
    dot(70, 336, 2.8), dot(16, 540, 2.5),
  ],
};

/** Shift a panel-local element onto the strip. Paths are shifted by rewriting their x values. */
function offset(el, dx) {
  if (el.kind === 'stroke') {
    const d = el.d.replace(/([MC])([^MCZ]*)/g, (_, cmd, nums) => {
      const shifted = nums.trim().split(/[\s,]+/).map(Number)
        .map((n, i) => (i % 2 === 0 ? r4(n + dx) : n));
      return `${cmd}${shifted.join(' ')}`;
    });
    return { ...el, d };
  }
  return { ...el, cx: r4(el.cx + dx) };
}

// ── Render ───────────────────────────────────────────────────────────────────────────────
function render(hex, isDark) {
  const o = (v, kind) => (isDark ? dk(v, kind) : v);
  const lines = [
    `<path d="${spinePath()}" fill="none" stroke="${hex}" stroke-width="2.2" stroke-linecap="round" opacity="${o(OP.spine, 'stroke')}"></path>`,
  ];
  PANELS.forEach((name, i) => {
    for (const raw of INTERIORS[name]) {
      const e = offset(raw, i * PANEL_W);
      const op = o(e.o, e.kind);
      if (e.kind === 'stroke') {
        lines.push(`<path d="${e.d}" fill="none" stroke="${hex}" stroke-width="${e.w}" stroke-linecap="round" opacity="${op}"></path>`);
      } else if (e.kind === 'canopy') {
        lines.push(`<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${hex}" opacity="${op}" transform="rotate(${e.rot} ${e.cx} ${e.cy})"></ellipse>`);
      } else {
        lines.push(`<circle cx="${e.cx}" cy="${e.cy}" r="${e.r}" fill="${hex}" opacity="${op}"></circle>`);
      }
    }
  });
  return `<svg viewBox="0 0 ${STRIP_W} ${H}" xmlns="http://www.w3.org/2000/svg">\n${lines.join('\n')}\n</svg>`;
}

writeFileSync(join(OUT, 'screen-bg-strip-light.svg'), render(LIGHT, false));
writeFileSync(join(OUT, 'screen-bg-strip-dark.svg'), render(DARK, true));
// The panel order is picked up by scripts/build-motifs.mjs and re-exported from
// constants/motifs.ts, so lib/__tests__/motifs.test.ts can check it against the real
// <TopTabs.Screen> order. Getting this wrong shows each tab its neighbour's art and is
// invisible in a diff — it happened once already.
writeFileSync(join(OUT, 'strip-panels.json'), `${JSON.stringify(PANELS, null, 2)}\n`);
console.log(`screen-bg-strip: ${STRIP_W}×${H}, ${PANELS.length} panels (${PANELS.join(' → ')})`);
