#!/usr/bin/env node
/**
 * collect-review-bundle.mjs — packages the app's UI surface into a set of files an
 * outside reviewer (a person or another AI) can read cold, without a checkout.
 *
 * Three outputs, in `review-bundle/`:
 *   1. `source/*.md`  — every component / screen / design-token file's FULL source,
 *      concatenated into chunked Markdown files (each under CHUNK_BYTES so a single
 *      file fits in a normal context window), each with its own table of contents.
 *   2. `CONNECTIONS.md` — who imports whom, derived from the real `@/` import
 *      statements rather than from prose, cross-checked against the hand-written
 *      `Connections:` blocks in each file's JSDoc header.
 *   3. `INVENTORY.csv` + `README.md` — a machine-readable index and the orientation
 *      note a reviewer reads first.
 *
 * Screenshots are produced separately by `scripts/screenshot-states.mjs` and land in
 * `review-bundle/screens/`; this script does not touch that directory.
 *
 * Usage: node scripts/collect-review-bundle.mjs [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'review-bundle');
const CHUNK_BYTES = 220_000;

/** Which trees go into the bundle, and how each is grouped into source files. */
const GROUPS = [
  {
    id: 'components',
    title: 'Components',
    blurb: 'Every reusable UI component. This is the app\'s visual vocabulary.',
    files: () => listFiles('components', /\.tsx$/),
  },
  {
    id: 'screens',
    title: 'Screens (Expo Router)',
    blurb:
      'Every routed screen. `app/(tabs)/*` are the five bottom-nav tabs; everything else is ' +
      'a pushed sub-screen or modal reached from one of them.',
    files: () => listFiles('app', /\.tsx$/, true),
  },
  {
    id: 'design-tokens',
    title: 'Design tokens & theme',
    blurb:
      'The colour / spacing / type / motion system every component reads from. Read this ' +
      'group before suggesting any visual change — a colour or spacing suggestion should be ' +
      'expressed as a change to these tokens, not as a hardcoded value in a component.',
    files: () => [
      ...listFiles('constants', /\.ts$/),
      'lib/useAppTheme.ts',
      'lib/screenColor.ts',
      'lib/domainColor.ts',
      'lib/personColor.ts',
      'lib/cardLayout.ts',
      'lib/useScaledStyles.ts',
      'lib/designLab.ts',
    ].filter((f) => fs.existsSync(path.join(ROOT, f))),
  },
];

/** Directories walked when building the reverse-import graph (wider than the bundle). */
const GRAPH_DIRS = ['components', 'app', 'lib', 'store', 'constants'];

// ---------------------------------------------------------------------------
// file discovery
// ---------------------------------------------------------------------------

function listFiles(dir, re, recursive = false) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) out.push(...listFiles(rel, re, true));
    } else if (re.test(entry.name)) {
      out.push(rel);
    }
  }
  return out.sort();
}

function allSourceFiles() {
  const out = [];
  for (const dir of GRAPH_DIRS) out.push(...listFiles(dir, /\.(ts|tsx)$/, true));
  return out.filter((f) => !f.includes('__tests__') && !f.includes('__mocks__'));
}

// ---------------------------------------------------------------------------
// header + import parsing
// ---------------------------------------------------------------------------

/**
 * Pull the leading JSDoc block apart. Every .ts/.tsx file in this repo opens with one
 * (see AGENTS.md "Read the file header first"), but the parse degrades to empty fields
 * rather than throwing when a file doesn't.
 */
function parseHeader(src) {
  const match = src.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  if (!match) return { purpose: '', description: '', connections: '', editNotes: '' };
  const body = match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n')
    .trim();

  const lines = body.split('\n');
  const first = lines[0] || '';
  const purpose = first.includes('—') ? first.split('—').slice(1).join('—').trim() : first.trim();

  const sectionAt = (name) => {
    const i = lines.findIndex((l) => l.trim().startsWith(name));
    if (i === -1) return '';
    const collected = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (/^\s*[A-Z][A-Za-z ]+:\s*$/.test(l) && !l.startsWith(' ')) break;
      if (/^(Connections|Edit notes):/.test(l.trim()) ) break;
      collected.push(l);
    }
    return collected.join('\n').trim();
  };

  const descEnd = lines.findIndex((l) => /^(Connections|Edit notes):/.test(l.trim()));
  const description = lines
    .slice(1, descEnd === -1 ? lines.length : descEnd)
    .join('\n')
    .trim();

  return {
    purpose,
    description,
    connections: sectionAt('Connections:'),
    editNotes: sectionAt('Edit notes:'),
  };
}

/** Resolve a `@/foo/bar` specifier to the repo-relative file it actually names. */
function resolveAlias(spec) {
  const base = spec.replace(/^@\//, '');
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts', '']) {
    const candidate = base + ext;
    if (fs.existsSync(path.join(ROOT, candidate)) && fs.statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

function localImports(src) {
  const out = new Set();
  const re = /from\s+['"](@\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const resolved = resolveAlias(m[1]);
    if (resolved) out.add(resolved);
  }
  return [...out].sort();
}

function externalPackages(src) {
  const out = new Set();
  const re = /from\s+['"]([^'".@][^'"]*|@[^/'"]+\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1].startsWith('@/')) continue;
    out.add(m[1].split('/').slice(0, m[1].startsWith('@') ? 2 : 1).join('/'));
  }
  return [...out].sort();
}

/** Zustand stores + notification/db layers a file reaches, for the "Data" column. */
function dataTouches(imports) {
  const stores = imports.filter((i) => i.startsWith('store/')).map((i) => path.basename(i, '.ts'));
  const infra = imports.filter((i) => /^lib\/(db|sqlite|dataAccess|notifications|reminders|liveSync|syncService)/.test(i));
  return [...stores, ...infra.map((i) => i.replace(/^lib\//, '').replace(/\.tsx?$/, '()'))];
}

// ---------------------------------------------------------------------------
// build the model
// ---------------------------------------------------------------------------

console.log('> reading sources');
const files = allSourceFiles();
const model = new Map();

for (const rel of files) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const header = parseHeader(src);
  const imports = localImports(src);
  model.set(rel, {
    rel,
    src,
    bytes: Buffer.byteLength(src),
    lines: src.split('\n').length,
    header,
    imports,
    packages: externalPackages(src),
    data: dataTouches(imports),
    importedBy: [],
  });
}

for (const entry of model.values()) {
  for (const dep of entry.imports) {
    const target = model.get(dep);
    if (target) target.importedBy.push(entry.rel);
  }
}
for (const entry of model.values()) entry.importedBy.sort();

/** Which routed screens can reach a component, following the import graph transitively. */
const SCREEN_RE = /^app\/.*\.tsx$/;
function reachingScreens(rel, seen = new Set()) {
  if (seen.has(rel)) return [];
  seen.add(rel);
  const out = new Set();
  for (const parent of model.get(rel)?.importedBy || []) {
    if (SCREEN_RE.test(parent)) out.add(parent);
    for (const s of reachingScreens(parent, seen)) out.add(s);
  }
  return [...out].sort();
}
for (const entry of model.values()) {
  entry.screens = SCREEN_RE.test(entry.rel) ? [entry.rel] : reachingScreens(entry.rel);
}

// ---------------------------------------------------------------------------
// writers
// ---------------------------------------------------------------------------

fs.rmSync(path.join(OUT, 'source'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'source'), { recursive: true });

const langOf = (rel) => (rel.endsWith('.tsx') ? 'tsx' : 'ts');

function writeGroupChunks(group) {
  const groupFiles = group.files().filter((f) => model.has(f));
  const chunks = [];
  let current = [];
  let size = 0;
  for (const rel of groupFiles) {
    const entry = model.get(rel);
    if (size > 0 && size + entry.bytes > CHUNK_BYTES) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(rel);
    size += entry.bytes;
  }
  if (current.length) chunks.push(current);

  const written = [];
  chunks.forEach((chunkFiles, i) => {
    const name =
      chunks.length === 1 ? `${group.id}.md` : `${group.id}-${String(i + 1).padStart(2, '0')}.md`;
    const lines = [];
    lines.push(`# ${group.title}${chunks.length > 1 ? ` — part ${i + 1} of ${chunks.length}` : ''}`);
    lines.push('');
    lines.push(group.blurb);
    lines.push('');
    lines.push(
      'Every file below is reproduced in full, opening JSDoc header included. Those headers ' +
        'are hand-maintained and state each file\'s purpose, its connections and its known traps ' +
        '— read them before the code.'
    );
    lines.push('');
    lines.push('## Contents');
    lines.push('');
    for (const rel of chunkFiles) {
      const e = model.get(rel);
      lines.push(`- \`${rel}\` — ${e.header.purpose || '(no header)'} (${e.lines} lines)`);
    }
    lines.push('');
    for (const rel of chunkFiles) {
      const e = model.get(rel);
      lines.push('---');
      lines.push('');
      lines.push(`## \`${rel}\``);
      lines.push('');
      const meta = [];
      if (e.screens.length) meta.push(`**Reachable from:** ${e.screens.map((s) => `\`${s}\``).join(', ')}`);
      if (e.importedBy.length)
        meta.push(`**Imported by:** ${e.importedBy.map((s) => `\`${s}\``).join(', ')}`);
      if (e.data.length) meta.push(`**Data:** ${e.data.join(', ')}`);
      if (meta.length) {
        lines.push(meta.join('  \n'));
        lines.push('');
      }
      lines.push('```' + langOf(rel));
      lines.push(e.src.replace(/\s+$/, ''));
      lines.push('```');
      lines.push('');
    }
    const file = path.join(OUT, 'source', name);
    fs.writeFileSync(file, lines.join('\n'));
    written.push({ name, files: chunkFiles.length, bytes: fs.statSync(file).size });
    console.log(`  source/${name} — ${chunkFiles.length} files, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  });
  return { group, chunks: written, count: groupFiles.length, files: groupFiles };
}

console.log('> writing source bundles');
const groupResults = GROUPS.map(writeGroupChunks);

// --- CONNECTIONS.md --------------------------------------------------------

console.log('> writing CONNECTIONS.md');
{
  const L = [];
  L.push('# How things are connected');
  L.push('');
  L.push(
    'Generated from the real `@/…` import statements in the source, not from prose — so this ' +
      'is the wiring as it actually is. Read alongside each file\'s own `Connections:` header ' +
      'block (reproduced in the `source/` bundles), which additionally records *why*.'
  );
  L.push('');
  L.push('## The shape of the app');
  L.push('');
  L.push('```');
  L.push('Screens (app/)  ->  Zustand stores (store/)  ->  SQLite (lib/db.ts)');
  L.push('      |                                              ^');
  L.push('      +-> components/ ---------------------------------+');
  L.push('               |');
  L.push('               +-> lib/useAppTheme.ts -> constants/{colors,theme,motion}.ts');
  L.push('               +-> lib/i18n.ts (useT) — every string, EN + NO');
  L.push('```');
  L.push('');
  L.push(
    'Navigation is file-based (Expo Router). `components/BottomNav.tsx` is the only ' +
      'primary navigation: five tabs, in this order — **Shopping · To-do · Home · Habits · Health**. ' +
      'Every other screen is pushed from one of those five.'
  );
  L.push('');

  // Tab tree
  L.push('## Screen tree');
  L.push('');
  const screens = [...model.keys()].filter((r) => SCREEN_RE.test(r)).sort();
  for (const rel of screens) {
    const e = model.get(rel);
    const kids = e.imports.filter((i) => i.startsWith('components/'));
    L.push(`### \`${rel}\``);
    L.push('');
    L.push(e.header.purpose || '(no header)');
    L.push('');
    if (kids.length) {
      L.push(`Mounts: ${kids.map((k) => `\`${path.basename(k, '.tsx')}\``).join(', ')}`);
      L.push('');
    }
    if (e.data.length) {
      L.push(`Data: ${e.data.join(', ')}`);
      L.push('');
    }
  }

  // Component table
  L.push('## Component index');
  L.push('');
  L.push('| Component | Purpose | Imported by | Reachable from screens |');
  L.push('|---|---|---|---|');
  for (const rel of listFiles('components', /\.tsx$/)) {
    const e = model.get(rel);
    if (!e) continue;
    const name = path.basename(rel, '.tsx');
    const purpose = (e.header.purpose || '').replace(/\|/g, '\\|').slice(0, 120);
    const by = e.importedBy.length
      ? e.importedBy.map((b) => path.basename(b).replace(/\.tsx?$/, '')).join(', ')
      : '_(nothing — dead code?)_';
    const from = e.screens.length ? e.screens.map((s) => s.replace(/^app\//, '')).join(', ') : '—';
    L.push(`| \`${name}\` | ${purpose} | ${by} | ${from} |`);
  }
  L.push('');

  // Shared-component hot list
  L.push('## Most-shared components');
  L.push('');
  L.push('A visual change to one of these lands everywhere at once — the highest-leverage place to suggest a change, and the riskiest.');
  L.push('');
  const hot = [...model.values()]
    .filter((e) => e.rel.startsWith('components/'))
    .sort((a, b) => b.importedBy.length - a.importedBy.length)
    .slice(0, 20);
  L.push('| Component | Used by N files |');
  L.push('|---|---|');
  for (const e of hot) L.push(`| \`${path.basename(e.rel, '.tsx')}\` | ${e.importedBy.length} |`);
  L.push('');

  // Orphans
  const orphans = [...model.values()].filter(
    (e) => e.rel.startsWith('components/') && e.importedBy.length === 0
  );
  if (orphans.length) {
    L.push('## Components nothing imports');
    L.push('');
    L.push('Either mounted dynamically, or genuinely unreferenced. Worth flagging in a review.');
    L.push('');
    for (const e of orphans) L.push(`- \`${e.rel}\``);
    L.push('');
  }

  // Mermaid overview of the tab screens
  L.push('## Tab screens and their components');
  L.push('');
  L.push('```mermaid');
  L.push('graph LR');
  const tabScreens = screens.filter((s) => s.startsWith('app/(tabs)/') && !s.endsWith('_layout.tsx'));
  const idOf = (s) => s.replace(/[^A-Za-z0-9]/g, '_');
  for (const s of tabScreens) {
    L.push(`  ${idOf(s)}["${path.basename(s, '.tsx')}"]`);
    for (const c of model.get(s).imports.filter((i) => i.startsWith('components/'))) {
      L.push(`  ${idOf(s)} --> ${idOf(c)}["${path.basename(c, '.tsx')}"]`);
    }
  }
  L.push('```');
  L.push('');

  fs.writeFileSync(path.join(OUT, 'CONNECTIONS.md'), L.join('\n'));
}

// --- INVENTORY.csv ---------------------------------------------------------

console.log('> writing INVENTORY.csv');
{
  const rows = [['file', 'kind', 'lines', 'bytes', 'purpose', 'imports', 'imported_by', 'screens', 'data']];
  const esc = (v) => `"${String(v).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
  for (const rel of [...model.keys()].sort()) {
    const e = model.get(rel);
    const kind = rel.startsWith('components/')
      ? 'component'
      : rel.startsWith('app/')
        ? 'screen'
        : rel.startsWith('store/')
          ? 'store'
          : rel.startsWith('constants/')
            ? 'tokens'
            : 'lib';
    rows.push([
      rel,
      kind,
      e.lines,
      e.bytes,
      e.header.purpose,
      e.imports.length,
      e.importedBy.length,
      e.screens.join(' '),
      e.data.join(' '),
    ].map(esc));
  }
  fs.writeFileSync(path.join(OUT, 'INVENTORY.csv'), rows.map((r) => r.join(',')).join('\n'));
}

// --- README.md -------------------------------------------------------------

console.log('> writing README.md');
{
  // Indented so they nest under the `source/` bullet rather than reading as siblings of it.
  const totals = groupResults.map(
    (g) => `  - **${g.group.title}** — ${g.count} files, in ${g.chunks.map((c) => `\`source/${c.name}\``).join(', ')}`
  );
  const shots = fs.existsSync(path.join(OUT, 'screens'))
    ? fs.readdirSync(path.join(OUT, 'screens')).filter((f) => f.endsWith('.png')).length
    : 0;

  const L = [];
  L.push('# UnFocus — UI review bundle');
  L.push('');
  L.push(`Generated ${new Date().toISOString().slice(0, 10)} from the \`main\` line of the app.`);
  L.push('');
  L.push('## What this is');
  L.push('');
  L.push(
    'UnFocus is a local-only ADHD life-management app (React Native / Expo, TypeScript, ' +
      'Zustand + SQLite). Norwegian-first but fully bilingual. Five bottom-nav tabs — ' +
      '**Shopping · To-do · Home · Habits · Health** — with everything else pushed from those five.'
  );
  L.push('');
  L.push('This bundle exists so a reviewer who has never seen the codebase can judge its **layout and visuals** and suggest changes. It contains:');
  L.push('');
  L.push(`- \`screens/\` — ${shots || 'N'} screenshots covering every screen and its different states, with \`screens/INDEX.md\` captioning each one and saying what state it is in.`);
  L.push('- `CONNECTIONS.md` — how everything wires together: the screen tree, which components each screen mounts, which components are shared (and so highest-leverage to change), and what data each touches.');
  L.push('- `source/` — the complete source of every component, screen and design-token file:');
  L.push(...totals);
  L.push('- `INVENTORY.csv` — the same index, machine-readable.');
  L.push('');
  L.push('## How to review it');
  L.push('');
  L.push('1. Start with `screens/INDEX.md` and look at the shots in order — that is the app as a user meets it.');
  L.push('2. Read `CONNECTIONS.md` to see which component draws the thing you want to change, and what else that component draws.');
  L.push('3. Open the matching file in `source/` — its JSDoc header states the intent and the traps before you read a line of code.');
  L.push('');
  L.push('## Ground rules the app already holds itself to');
  L.push('');
  L.push('Suggestions that violate these have already been considered and rejected; suggestions that work *within* them are the useful kind.');
  L.push('');
  L.push('- **One card design.** A card is a flat opaque page with ONE border. No glass, no blur, no translucency, no inner rim. Colour lives only in the border, and its hue comes from the *screen* (To-do blue, Habits sky, Health teal, Shopping green, Notes yellow, Home/Settings neutral). Hue is graded card → field → button, deeper/thicker to lighter/thinner.');
  L.push('- **Row anatomy is fixed:** `[leading?] title → ONE meta line → ONE right-hand value → [⋯ action] → [○ check]`. The check is on the right, like the ticks on a paper checklist. One meta line, one right-hand value — a fifth thing goes into a detail sheet, never onto a third row line.');
  L.push('- **One rhythm.** The screen owns the vertical gap between cards (`SCREEN_GAP`), not the cards. A tight card is fixed in the container, never by giving the card a margin.');
  L.push('- **Three tiers of composer.** Tier 1 is the line (the name, and committing there must always make a valid row); tier 2 is the 2–4 options visible while typing; tier 3 is everything else behind a worded "More options". No blind tap-cycles — a stepper for a number, a picker for a choice.');
  L.push('- **No guilt.** No streak-break state, no "missed"/"overdue"/"behind", no counts or percentages on the day log, no scoring. A thing not yet done is "still due". Reward is ambient (the backdrop tints and grows branches) and shows no number anywhere.');
  L.push('- **Bilingual.** Every string comes from `lib/i18n.ts` in both EN and NO. Norwegian is typically ~20% longer — a layout that only fits in English is a bug.');
  L.push('- **Tap targets** go through `MIN_TAP_TARGET` (48px) and motion through `Duration.*`; bare numbers fail CI.');
  L.push('');
  L.push('## What feedback is most useful');
  L.push('');
  L.push('- Hierarchy: on each screen, is the most important thing the most prominent thing?');
  L.push('- Density and rhythm: where does the spacing lie about what is related to what?');
  L.push('- The card/border system: does one flat border per card carry enough separation, or does something need a second signal?');
  L.push('- Empty and first-run states versus full ones — both are in `screens/`.');
  L.push('- Anything that reads as scoring, judgement or pressure, given the no-guilt rule above.');
  L.push('- Concrete suggestions naming the component in `CONNECTIONS.md` that would carry them.');
  L.push('');
  fs.writeFileSync(path.join(OUT, 'README.md'), L.join('\n'));
}

console.log(`> done — ${OUT}`);
