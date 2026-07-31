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
 * all — the consumer passes a theme token. That is what keeps components free of raw hex and
 * lets one backdrop be recoloured per tab from lib/screenColor.ts.
 *
 * Connections:
 *   Imports → nothing (deliberately dependency-free, like lib/cardLayout.ts and lib/growth.ts)
 *   Used by → components/Motif.tsx (the only renderer), components/ScreenBackground.tsx
 *   Data    → none — pure data
 *
 * Edit notes:
 *   - Elements are painted back-to-front; `els` order is load-bearing.
 *   - Coordinates are in the motif's own viewBox (`w` × `h`), never screen pixels.
 *   - `screen-bg-strip` is the five tab backdrops as ONE continuous 1950×844 run (5 × 390),
 *     slid with the pager rather than swapped per tab, so the branch never breaks at a seam.
 *     Panel k occupies x [390k, 390(k+1)) in bottom-nav order: shopping, plans, home, health,
 *     habits. `screen-bg-calm` is the standalone 390×844 backdrop for sub-tier screens.
 *     lib/__tests__/motifs.test.ts pins the strip's geometry and the protected centre box
 *     (x 84–306, y 236–612 per panel) that cards live in.
 *   - Regenerate the strip with `node scripts/author-screen-bgs.mjs` — it is authored from a
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
/** A halo outline (`ring`, has `w`), a large soft fill (`wash`), or a floating dot. */
export type MotifCircle = {
  t: 'c'; role: 'ring' | 'wash' | 'dot';
  cx: number; cy: number; r: number; w?: number; o: number; od: number;
};
export type MotifElement = MotifPath | MotifEllipse | MotifCircle;

export type Motif = { w: number; h: number; els: readonly MotifElement[] };

/**
 * `as const` on the raw object keeps the KEY NAMES literal (so MotifId is a union of ids and
 * a typo is a compile error), but it also narrows every element field to its literal value —
 * which makes `d: string` unassignable and breaks any consumer that filters by `t`. Widening
 * through an explicit Record annotation on the export gives both: literal ids, ordinary
 * element types.
 */
const RAW = {
  'canopy-corner': {
    w: 160,
    h: 160,
    els: [
      { t:'p', role:'stroke', d:'M70 90 C68 105 72 135 70 150', w:3, o:0.5, od:0.65 },
      { t:'e', role:'canopy', cx:36.2, cy:60.6, rx:20.9, ry:12.2, rot:-18, o:0.28, od:0.36 },
      { t:'e', role:'canopy', cx:62.8, cy:45.4, rx:22.8, ry:13.3, rot:8, o:0.39, od:0.5 },
      { t:'e', role:'canopy', cx:91.3, cy:47.3, rx:22, ry:12.9, rot:-10, o:0.5, od:0.65 },
      { t:'e', role:'canopy', cx:116, cy:62.5, rx:19, ry:11.4, rot:20, o:0.28, od:0.36 },
      { t:'e', role:'canopy', cx:51.4, cy:77.7, rx:19, ry:11.4, rot:-6, o:0.39, od:0.5 },
      { t:'e', role:'canopy', cx:83.7, cy:73.9, rx:23.6, ry:13.7, rot:4, o:0.5, od:0.65 },
      { t:'e', role:'canopy', cx:108.4, cy:79.6, rx:18.2, ry:10.6, rot:15, o:0.28, od:0.36 },
      { t:'c', role:'dot', cx:30, cy:120, r:3, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:130, cy:50, r:2.5, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:112, cy:30, r:2, o:0.3, od:0.39 },
    ],
  },
  'card-edge-vine': {
    w: 40,
    h: 320,
    els: [
      { t:'p', role:'stroke', d:'M18 10 C10 60 22 100 14 150 C6 200 20 250 16 312', w:2.2, o:0.35, od:0.455 },
      { t:'e', role:'canopy', cx:4.6, cy:55.8, rx:7.7, ry:4.5, rot:-18, o:0.21, od:0.28 },
      { t:'e', role:'canopy', cx:14.4, cy:50.2, rx:8.4, ry:4.9, rot:8, o:0.28, od:0.36 },
      { t:'e', role:'canopy', cx:24.9, cy:50.9, rx:8.1, ry:4.8, rot:-10, o:0.15, od:0.2 },
      { t:'e', role:'canopy', cx:34, cy:56.5, rx:7, ry:4.2, rot:20, o:0.21, od:0.28 },
      { t:'e', role:'canopy', cx:10.2, cy:62.1, rx:7, ry:4.2, rot:-6, o:0.28, od:0.36 },
      { t:'e', role:'canopy', cx:22.1, cy:60.7, rx:8.7, ry:5, rot:4, o:0.15, od:0.2 },
      { t:'e', role:'canopy', cx:31.2, cy:62.8, rx:6.7, ry:3.9, rot:15, o:0.21, od:0.28 },
      { t:'e', role:'canopy', cx:0.8, cy:176.4, rx:6.6, ry:3.8, rot:-18, o:0.28, od:0.36 },
      { t:'e', role:'canopy', cx:9.2, cy:171.6, rx:7.2, ry:4.2, rot:8, o:0.15, od:0.2 },
      { t:'e', role:'canopy', cx:18.2, cy:172.2, rx:7, ry:4.1, rot:-10, o:0.21, od:0.28 },
      { t:'e', role:'canopy', cx:26, cy:177, rx:6, ry:3.6, rot:20, o:0.28, od:0.36 },
      { t:'e', role:'canopy', cx:5.6, cy:181.8, rx:6, ry:3.6, rot:-6, o:0.15, od:0.2 },
      { t:'e', role:'canopy', cx:15.8, cy:180.6, rx:7.4, ry:4.3, rot:4, o:0.21, od:0.28 },
      { t:'e', role:'canopy', cx:23.6, cy:182.4, rx:5.8, ry:3.4, rot:15, o:0.28, od:0.36 },
      { t:'c', role:'dot', cx:26, cy:250, r:3, o:0.25, od:0.325 },
    ],
  },
  'empty-branch': {
    w: 220,
    h: 200,
    els: [
      { t:'p', role:'stroke', d:'M110 60 C108 92.5 112 157.5 110 190', w:2.5, o:0.35, od:0.455 },
      { t:'p', role:'stroke', d:'M100 110 C85 100 74 96 60 90', w:1.6, o:0.25, od:0.325 },
      { t:'p', role:'stroke', d:'M120 95 C136 86 148 82 164 76', w:1.6, o:0.25, od:0.325 },
      { t:'c', role:'dot', cx:60, cy:90, r:2.5, o:0.25, od:0.325 },
      { t:'c', role:'dot', cx:164, cy:76, r:2.5, o:0.25, od:0.325 },
      { t:'c', role:'dot', cx:110, cy:58, r:2.5, o:0.25, od:0.325 },
      { t:'p', role:'stroke', d:'M50 190 Q110 180 170 190', w:2, o:0.25, od:0.325 },
    ],
  },
  'fab-halo': {
    w: 100,
    h: 100,
    els: [
      { t:'c', role:'wash', cx:50, cy:50, r:48, o:0.08, od:0.14 },
      { t:'c', role:'wash', cx:50, cy:50, r:34, o:0.12, od:0.2 },
      { t:'c', role:'wash', cx:50, cy:50, r:20, o:0.18, od:0.28 },
    ],
  },
  'ground-arc': {
    w: 300,
    h: 40,
    els: [
      { t:'p', role:'stroke', d:'M20 28 Q150 18 280 28', w:2, o:0.35, od:0.455 },
      { t:'c', role:'dot', cx:70, cy:26, r:2, o:0.25, od:0.325 },
      { t:'c', role:'dot', cx:230, cy:24, r:2, o:0.25, od:0.325 },
    ],
  },
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
  'holder-blob-lg': {
    w: 360,
    h: 300,
    els: [
      { t:'e', role:'canopy', cx:59, cy:117, rx:60.5, ry:35.2, rot:-18, o:0.09, od:0.14 },
      { t:'e', role:'canopy', cx:136, cy:73, rx:66, ry:38.5, rot:8, o:0.12, od:0.18 },
      { t:'e', role:'canopy', cx:218.5, cy:78.5, rx:63.8, ry:37.4, rot:-10, o:0.07, od:0.1 },
      { t:'e', role:'canopy', cx:290, cy:122.5, rx:55, ry:33, rot:20, o:0.09, od:0.14 },
      { t:'e', role:'canopy', cx:103, cy:166.5, rx:55, ry:33, rot:-6, o:0.12, od:0.18 },
      { t:'e', role:'canopy', cx:196.5, cy:155.5, rx:68.2, ry:39.6, rot:4, o:0.07, od:0.1 },
      { t:'e', role:'canopy', cx:268, cy:172, rx:52.8, ry:30.8, rot:15, o:0.09, od:0.14 },
      { t:'c', role:'ring', cx:180, cy:150, r:140, w:1.2, o:0.16, od:0.208 },
    ],
  },
  'holder-blob-md': {
    w: 280,
    h: 220,
    els: [
      { t:'e', role:'canopy', cx:52, cy:86, rx:44, ry:25.6, rot:-18, o:0.08, od:0.11 },
      { t:'e', role:'canopy', cx:108, cy:54, rx:48, ry:28, rot:8, o:0.11, od:0.16 },
      { t:'e', role:'canopy', cx:168, cy:58, rx:46.4, ry:27.2, rot:-10, o:0.14, od:0.2 },
      { t:'e', role:'canopy', cx:220, cy:90, rx:40, ry:24, rot:20, o:0.08, od:0.11 },
      { t:'e', role:'canopy', cx:84, cy:122, rx:40, ry:24, rot:-6, o:0.11, od:0.16 },
      { t:'e', role:'canopy', cx:152, cy:114, rx:49.6, ry:28.8, rot:4, o:0.14, od:0.2 },
      { t:'e', role:'canopy', cx:204, cy:126, rx:38.4, ry:22.4, rot:15, o:0.08, od:0.11 },
      { t:'c', role:'ring', cx:140, cy:110, r:104, w:1.2, o:0.175, od:0.2275 },
    ],
  },
  'onboarding-triptych': {
    w: 1170,
    h: 844,
    els: [
      { t:'p', role:'stroke', d:'M125 780 Q195 770 265 780', w:2, o:0.3, od:0.39 },
      { t:'p', role:'stroke', d:'M195 780 C193 740 197 710 195 685', w:3, o:0.6, od:0.78 },
      { t:'c', role:'dot', cx:195, cy:682, r:8, o:0.33, od:0.429 },
      { t:'p', role:'stroke', d:'M195 685 C260 670 320 630 390 610', w:2.2, o:0.6, od:0.78 },
      { t:'p', role:'stroke', d:'M390 610 C460 590 520 570 585 550 C620 540 650 555 660 595', w:3, o:0.6, od:0.78 },
      { t:'p', role:'stroke', d:'M585 550 C560 535 540 526 512 516 M598 558 C628 542 652 532 682 520', w:2, o:0.48, od:0.624 },
      { t:'e', role:'canopy', cx:558.6, cy:540.8, rx:13.2, ry:7.7, rot:-18, o:0.13, od:0.17 },
      { t:'e', role:'canopy', cx:575.4, cy:531.2, rx:14.4, ry:8.4, rot:8, o:0.19, od:0.24 },
      { t:'e', role:'canopy', cx:593.4, cy:532.4, rx:13.9, ry:8.2, rot:-10, o:0.24, od:0.31 },
      { t:'e', role:'canopy', cx:609, cy:542, rx:12, ry:7.2, rot:20, o:0.13, od:0.17 },
      { t:'e', role:'canopy', cx:568.2, cy:551.6, rx:12, ry:7.2, rot:-6, o:0.19, od:0.24 },
      { t:'e', role:'canopy', cx:588.6, cy:549.2, rx:14.9, ry:8.6, rot:4, o:0.24, od:0.31 },
      { t:'e', role:'canopy', cx:604.2, cy:552.8, rx:11.5, ry:6.7, rot:15, o:0.13, od:0.17 },
      { t:'p', role:'stroke', d:'M660 595 C710 578 750 550 780 605', w:2.5, o:0.6, od:0.78 },
      { t:'p', role:'stroke', d:'M780 605 C826 626 900 664 975 690', w:2.8, o:0.6, od:0.78 },
      { t:'c', role:'ring', cx:975, cy:430, r:180, w:1.3, o:0.21, od:0.273 },
      { t:'p', role:'stroke', d:'M900 800 Q975 790 1050 800', w:2, o:0.3, od:0.39 },
      { t:'p', role:'stroke', d:'M975 800 C973 700 977 620 975 550', w:4, o:0.6, od:0.78 },
      { t:'p', role:'stroke', d:'M975 620 C935 590 905 570 865 545 M975 560 C1015 535 1045 520 1085 500', w:2.3, o:0.51, od:0.663 },
      { t:'e', role:'canopy', cx:895.8, cy:448.4, rx:39.6, ry:23, rot:-18, o:0.18, od:0.24 },
      { t:'e', role:'canopy', cx:946.2, cy:419.6, rx:43.2, ry:25.2, rot:8, o:0.26, od:0.33 },
      { t:'e', role:'canopy', cx:1000.2, cy:423.2, rx:41.8, ry:24.5, rot:-10, o:0.33, od:0.43 },
      { t:'e', role:'canopy', cx:1047, cy:452, rx:36, ry:21.6, rot:20, o:0.18, od:0.24 },
      { t:'e', role:'canopy', cx:924.6, cy:480.8, rx:36, ry:21.6, rot:-6, o:0.26, od:0.33 },
      { t:'e', role:'canopy', cx:985.8, cy:473.6, rx:44.6, ry:25.9, rot:4, o:0.33, od:0.43 },
      { t:'e', role:'canopy', cx:1032.6, cy:484.4, rx:34.6, ry:20.2, rot:15, o:0.18, od:0.24 },
      { t:'c', role:'dot', cx:860, cy:540, r:3, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:1090, cy:496, r:3, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:930, cy:400, r:2.5, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:1030, cy:390, r:2.5, o:0.3, od:0.39 },
    ],
  },
  'screen-bg-calm': {
    w: 390,
    h: 844,
    els: [
      { t:'c', role:'wash', cx:330, cy:90, r:150, o:0.05, od:0.1 },
      { t:'p', role:'stroke', d:'M0 660 C60 640 90 600 160 610 C230 620 260 580 390 600', w:2.2, o:0.5, od:0.65 },
      { t:'c', role:'dot', cx:160, cy:610, r:4, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:260, cy:580, r:3, o:0.3, od:0.39 },
      { t:'e', role:'canopy', cx:301.4, cy:82.2, rx:14.3, ry:8.3, rot:-18, o:0.06, od:0.09 },
      { t:'e', role:'canopy', cx:319.6, cy:71.8, rx:15.6, ry:9.1, rot:8, o:0.08, od:0.12 },
      { t:'e', role:'canopy', cx:339.1, cy:73.1, rx:15.1, ry:8.8, rot:-10, o:0.1, od:0.16 },
      { t:'e', role:'canopy', cx:356, cy:83.5, rx:13, ry:7.8, rot:20, o:0.06, od:0.09 },
      { t:'e', role:'canopy', cx:311.8, cy:93.9, rx:13, ry:7.8, rot:-6, o:0.08, od:0.12 },
      { t:'e', role:'canopy', cx:333.9, cy:91.3, rx:16.1, ry:9.4, rot:4, o:0.1, od:0.16 },
      { t:'e', role:'canopy', cx:350.8, cy:95.2, rx:12.5, ry:7.3, rot:15, o:0.06, od:0.09 },
    ],
  },
  'screen-bg-strip': {
    w: 1950,
    h: 844,
    els: [
      { t:'p', role:'stroke', d:'M0 660 C32.5 665 130 696.6667 195 690 C260 683.3333 325 620 390 620 C455 620 520 686.6667 585 690 C650 693.3333 715 638.3333 780 640 C845 641.6667 910 701.6667 975 700 C1040 698.3333 1105 632.5 1170 630 C1235 627.5 1300 682.5 1365 685 C1430 687.5 1495 644.1667 1560 645 C1625 645.8333 1690 697.5 1755 690 C1820 682.5 1917.5 615 1950 600', w:2.2, o:0.45, od:0.585 },
      { t:'p', role:'stroke', d:'M0 182C36 150 54 128 78 116', w:1.8, o:0.4, od:0.52 },
      { t:'e', role:'canopy', cx:57.2, cy:114.1, rx:9.24, ry:5.355, rot:-18, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:68.75, cy:106.75, rx:10.08, ry:5.88, rot:8, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:81.35, cy:107.8, rx:9.765, ry:5.67, rot:-10, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:91.85, cy:114.1, rx:8.4, ry:5.04, rot:20, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:63.5, cy:121.45, rx:8.4, ry:5.04, rot:-6, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:78.2, cy:119.35, rx:10.395, ry:6.09, rot:4, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:88.7, cy:122.5, rx:8.085, ry:4.725, rot:15, o:0.14, od:0.182 },
      { t:'c', role:'dot', cx:120, cy:78, r:3, o:0.28, od:0.364 },
      { t:'c', role:'dot', cx:30, cy:214, r:2.5, o:0.28, od:0.364 },
      { t:'p', role:'stroke', d:'M780 196C742 166 726 142 704 130', w:1.8, o:0.4, od:0.52 },
      { t:'e', role:'canopy', cx:683.2, cy:128.1, rx:9.24, ry:5.355, rot:-18, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:694.75, cy:120.75, rx:10.08, ry:5.88, rot:8, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:707.35, cy:121.8, rx:9.765, ry:5.67, rot:-10, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:717.85, cy:128.1, rx:8.4, ry:5.04, rot:20, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:689.5, cy:135.45, rx:8.4, ry:5.04, rot:-6, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:704.2, cy:133.35, rx:10.395, ry:6.09, rot:4, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:714.7, cy:136.5, rx:8.085, ry:4.725, rot:15, o:0.14, od:0.182 },
      { t:'c', role:'dot', cx:658, cy:92, r:3, o:0.28, od:0.364 },
      { t:'c', role:'dot', cx:750, cy:224, r:2.5, o:0.28, od:0.364 },
      { t:'p', role:'stroke', d:'M780 150C820 118 842 100 872 96', w:1.8, o:0.4, od:0.52 },
      { t:'p', role:'stroke', d:'M872 96C940 62 1016 70 1080 112', w:1.5, o:0.42, od:0.546 },
      { t:'p', role:'stroke', d:'M1170 176C1132 150 1110 128 1080 112', w:1.8, o:0.4, od:0.52 },
      { t:'p', role:'stroke', d:'M975 690C973 664 977 646 975 628', w:1.8, o:0.4, od:0.52 },
      { t:'e', role:'canopy', cx:852, cy:94, rx:8.8, ry:5.1, rot:-18, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:863, cy:87, rx:9.6, ry:5.6, rot:8, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:875, cy:88, rx:9.3, ry:5.4, rot:-10, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:885, cy:94, rx:8, ry:4.8, rot:20, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:858, cy:101, rx:8, ry:4.8, rot:-6, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:872, cy:99, rx:9.9, ry:5.8, rot:4, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:882, cy:102, rx:7.7, ry:4.5, rot:15, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:1069.28, cy:117.84, rx:8.096, ry:4.692, rot:-18, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:1079.4, cy:111.4, rx:8.832, ry:5.152, rot:8, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:1090.44, cy:112.32, rx:8.556, ry:4.968, rot:-10, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:1099.64, cy:117.84, rx:7.36, ry:4.416, rot:20, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:1074.8, cy:124.28, rx:7.36, ry:4.416, rot:-6, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:1087.68, cy:122.44, rx:9.108, ry:5.336, rot:4, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:1096.88, cy:125.2, rx:7.084, ry:4.14, rot:15, o:0.14, od:0.182 },
      { t:'c', role:'dot', cx:975, cy:66, r:3.2, o:0.28, od:0.364 },
      { t:'c', role:'dot', cx:930, cy:196, r:2.5, o:0.28, od:0.364 },
      { t:'c', role:'dot', cx:1030, cy:188, r:2.5, o:0.28, od:0.364 },
      { t:'p', role:'stroke', d:'M1560 452C1534 428 1524 400 1512 378', w:1.8, o:0.4, od:0.52 },
      { t:'e', role:'canopy', cx:1500.8, cy:373.9, rx:8.36, ry:4.845, rot:-18, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:1511.25, cy:367.25, rx:9.12, ry:5.32, rot:8, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:1522.65, cy:368.2, rx:8.835, ry:5.13, rot:-10, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:1532.15, cy:373.9, rx:7.6, ry:4.56, rot:20, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:1506.5, cy:380.55, rx:7.6, ry:4.56, rot:-6, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:1519.8, cy:378.65, rx:9.405, ry:5.51, rot:4, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:1529.3, cy:381.5, rx:7.315, ry:4.275, rot:15, o:0.14, od:0.182 },
      { t:'c', role:'dot', cx:1488, cy:316, r:2.8, o:0.28, od:0.364 },
      { t:'c', role:'dot', cx:1544, cy:520, r:2.5, o:0.28, od:0.364 },
      { t:'p', role:'stroke', d:'M1560 474C1584 448 1594 420 1608 398', w:1.8, o:0.4, od:0.52 },
      { t:'e', role:'canopy', cx:1588.8, cy:393.9, rx:8.36, ry:4.845, rot:-18, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:1599.25, cy:387.25, rx:9.12, ry:5.32, rot:8, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:1610.65, cy:388.2, rx:8.835, ry:5.13, rot:-10, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:1620.15, cy:393.9, rx:7.6, ry:4.56, rot:20, o:0.14, od:0.182 },
      { t:'e', role:'canopy', cx:1594.5, cy:400.55, rx:7.6, ry:4.56, rot:-6, o:0.19, od:0.247 },
      { t:'e', role:'canopy', cx:1607.8, cy:398.65, rx:9.405, ry:5.51, rot:4, o:0.25, od:0.325 },
      { t:'e', role:'canopy', cx:1617.3, cy:401.5, rx:7.315, ry:4.275, rot:15, o:0.14, od:0.182 },
      { t:'c', role:'dot', cx:1630, cy:336, r:2.8, o:0.28, od:0.364 },
      { t:'c', role:'dot', cx:1576, cy:540, r:2.5, o:0.28, od:0.364 },
    ],
  },
  'trunk-divider': {
    w: 400,
    h: 50,
    els: [
      { t:'p', role:'stroke', d:'M20 25 C90 10 140 40 200 22 C260 6 320 38 380 20', w:2, o:0.4, od:0.52 },
      { t:'c', role:'dot', cx:60, cy:15, r:3, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:140, cy:36, r:2.5, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:220, cy:14, r:3, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:300, cy:32, r:2.5, o:0.3, od:0.39 },
      { t:'c', role:'dot', cx:360, cy:16, r:2.5, o:0.3, od:0.39 },
    ],
  },
} as const;

export type MotifId = keyof typeof RAW;

export const MOTIFS: Record<MotifId, Motif> = RAW;

export const MOTIF_IDS = Object.keys(MOTIFS) as MotifId[];

/** The full-screen backdrops: the sliding tab strip and the standalone sub-tier one. */
export const SCREEN_BG_IDS = MOTIF_IDS.filter((id) => id.startsWith('screen-bg-'));

/**
 * Which tab each 390-wide panel of `screen-bg-strip` belongs to, left to right.
 *
 * This MUST match the <TopTabs.Screen> order in app/(tabs)/_layout.tsx, because the strip is
 * slid by that navigator's index — if they disagree, every tab quietly shows its neighbour's
 * art. lib/__tests__/motifs.test.ts checks the two against each other.
 */
export const STRIP_PANEL_ORDER = ["shopping","plans","home","habits","health"] as const;
