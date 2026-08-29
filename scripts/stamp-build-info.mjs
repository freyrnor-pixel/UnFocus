#!/usr/bin/env node
/**
 * stamp-build-info.mjs — write the current commit into constants/buildInfo.ts
 *
 * Run by .github/workflows/update.yml immediately BEFORE `eas update`, so the stamp is inside
 * the bundle it describes. Never run in a commit: the repo keeps the dev placeholder, and the
 * stamped file exists only in CI's working tree (see that file's edit notes for why).
 *
 * Usage:  node scripts/stamp-build-info.mjs            # reads git HEAD
 *         node scripts/stamp-build-info.mjs --check     # verify the file is stampABLE, no write
 *
 * Exits non-zero if the file does not have the shape it expects — a silent no-op here would
 * ship an "unstamped" build that looks exactly like a local one, which is the failure this
 * whole mechanism exists to prevent.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'constants', 'buildInfo.ts');
const MAX_SUBJECT = 72;
const CHECK_ONLY = process.argv.includes('--check');

/** The three lines the generator owns. Each must match exactly once. */
const FIELDS = [
  { name: 'BUILD_COMMIT', re: /^export const BUILD_COMMIT = '.*';$/m },
  { name: 'BUILD_SUBJECT', re: /^export const BUILD_SUBJECT = '.*';$/m },
  { name: 'BUILD_TIME', re: /^export const BUILD_TIME = '.*';$/m },
];

/** Single-quoted TS string literal, with the two characters that could break it neutralised. */
function tsString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n]+/g, ' ')}'`;
}

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
}

let src = readFileSync(TARGET, 'utf8');

// Fail loudly on a shape change rather than writing nothing. A regex that quietly matches zero
// times is how a generator turns into decoration.
for (const f of FIELDS) {
  const hits = src.match(new RegExp(f.re.source, 'gm'));
  if (!hits || hits.length !== 1) {
    console.error(
      `stamp-build-info: expected exactly one \`export const ${f.name} = '…';\` line in ` +
        `constants/buildInfo.ts, found ${hits ? hits.length : 0}.\n` +
        `That file's edit notes ask for these to stay single-line literals — see them before changing this script.`,
    );
    process.exit(1);
  }
}

if (CHECK_ONLY) {
  console.log('stamp-build-info: constants/buildInfo.ts is stampable ✓');
  process.exit(0);
}

// GITHUB_SHA is the merge commit on a push to main; git rev-parse is the local fallback.
const sha = process.env.GITHUB_SHA || git('rev-parse HEAD');
const rawSubject = git('log -1 --format=%s');
const subject =
  rawSubject.length > MAX_SUBJECT ? `${rawSubject.slice(0, MAX_SUBJECT - 1)}…` : rawSubject;

src = src
  .replace(FIELDS[0].re, `export const BUILD_COMMIT = ${tsString(sha)};`)
  .replace(FIELDS[1].re, `export const BUILD_SUBJECT = ${tsString(subject)};`)
  .replace(FIELDS[2].re, `export const BUILD_TIME = ${tsString(new Date().toISOString())};`);

writeFileSync(TARGET, src);
console.log(`stamp-build-info: ${sha.slice(0, 7)} — ${subject}`);
