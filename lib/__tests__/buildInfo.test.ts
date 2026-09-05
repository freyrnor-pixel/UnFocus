/**
 * buildInfo.test.ts — the build stamp cannot rot into decoration
 *
 * `constants/buildInfo.ts` is rewritten in CI by `scripts/stamp-build-info.mjs` (a regex over
 * three `export const` lines) so the running app can name the commit it was built from. Two
 * ways that mechanism dies silently, and this file closes both:
 *
 *   1. Someone reformats the constants — multi-line, template literal, `as const` — and the
 *      generator's regex matches zero times. It exits non-zero by design, but only if the
 *      shapes it expects are the shapes here. Asserted directly against the script's source.
 *   2. Someone "helpfully" commits a real SHA. Then every build after that commit reports the
 *      wrong one, which is worse than reporting none — this is the exact failure mode
 *      docs/archive/AGENTS_HISTORY.md records for the widget palette ("a hand-copied constant
 *      with a comment telling you to keep it in step is not a mechanism").
 *
 * Cheap and dependency-free, like the module it guards.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUILD_COMMIT,
  BUILD_SUBJECT,
  BUILD_TIME,
  DEV_SHA,
  MAX_SUBJECT,
  isStamped,
  shortCommit,
} from '@/constants/buildInfo';

const ROOT = join(__dirname, '..', '..');
const MODULE_SRC = readFileSync(join(ROOT, 'constants', 'buildInfo.ts'), 'utf8');
const SCRIPT_SRC = readFileSync(join(ROOT, 'scripts', 'stamp-build-info.mjs'), 'utf8');
const WORKFLOW_SRC = readFileSync(join(ROOT, '.github', 'workflows', 'update.yml'), 'utf8');

describe('build stamp — the committed file is the DEV placeholder', () => {
  it('never carries a real commit SHA', () => {
    // A 40-char hex string here means someone stamped and committed. See the module's notes.
    expect(BUILD_COMMIT).toBe(DEV_SHA);
    expect(BUILD_COMMIT).not.toMatch(/^[0-9a-f]{40}$/);
    expect(BUILD_TIME).toBe('');
  });

  it('reports "development" rather than a blank when unstamped', () => {
    // A blank row in Settings reads as a rendering bug; the word reads as the true answer.
    expect(isStamped()).toBe(false);
    expect(shortCommit()).toBe(DEV_SHA);
    expect(BUILD_SUBJECT.length).toBeGreaterThan(0);
  });
});

describe('build stamp — the generator can still find its fields', () => {
  // Mirrors scripts/stamp-build-info.mjs's FIELDS table. If this drifts, the script exits
  // non-zero in CI rather than shipping an unstamped bundle — but a red test here is the
  // cheaper place to find out.
  const FIELDS = ['BUILD_COMMIT', 'BUILD_SUBJECT', 'BUILD_TIME'] as const;

  it.each(FIELDS)('%s is exactly one single-line string literal', (name) => {
    const hits = MODULE_SRC.match(new RegExp(`^export const ${name} = '.*';$`, 'gm'));
    expect(hits).toHaveLength(1);
  });

  it('the script names every field this module exports for it', () => {
    for (const name of FIELDS) expect(SCRIPT_SRC).toContain(name);
  });

  it('the script refuses to write silently — it exits non-zero on a shape change', () => {
    expect(SCRIPT_SRC).toMatch(/process\.exit\(1\)/);
  });
});

describe('build stamp — it is wired into the publish path', () => {
  it('update.yml stamps BEFORE it publishes', () => {
    // Match the real command, not the words: prose ABOUT `eas update` appears in comments on
    // both sides of the step, so a bare indexOf('eas update') compares against a comment.
    const stampAt = WORKFLOW_SRC.indexOf('run: node scripts/stamp-build-info.mjs');
    const publishAt = WORKFLOW_SRC.indexOf('eas update --branch');
    expect(stampAt).toBeGreaterThan(-1);
    expect(publishAt).toBeGreaterThan(-1);
    // The stamp has to be inside the bundle it describes.
    expect(stampAt).toBeLessThan(publishAt);
  });

  it('the subject cap is honoured on both sides', () => {
    expect(MAX_SUBJECT).toBe(72);
    expect(SCRIPT_SRC).toContain('MAX_SUBJECT = 72');
  });
});
