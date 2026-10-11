/**
 * fontFamily.test.ts — every text style names an app font (2026-10-11).
 *
 * A style with a `fontSize` and no `fontFamily` renders in the PLATFORM font: Roboto on
 * Android, San Francisco on iOS, whatever the machine has on web. 132 such styles (hints,
 * descriptions, empty states, meta lines) were found while making the visual gate
 * machine-independent — on web they were the only text that differed between CI and the dev
 * image, and on a phone they were the only text not in Nunito.
 *
 * The exceptions are size MODIFIERS drawn after a base style that already sets the face —
 * naming a family on them would override the base's weight.
 *
 * Connections:
 *   Imports → node:fs, node:path, glob over app/ and components/
 *   Used by → jest
 *   Data    → none
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/** file → modifier style → the base style it is always drawn after. */
const MODIFIERS: Record<string, Record<string, string>> = {
  'components/ShoppingRow.tsx': { nameBig: 'name', qtyLeadBig: 'qtyLead' },
  'components/StarterCard.tsx': { textCompact: 'text' },
};

function tsxFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) return name === '__tests__' ? [] : tsxFiles(rel);
    return rel.endsWith('.tsx') ? [rel] : [];
  });
}

function styleBodies(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/\n\s+(\w+): \{([^{}]*)\}/g)) out.set(m[1], m[2]);
  return out;
}

test('every text style with a fontSize names an app font', () => {
  const missing: string[] = [];
  for (const file of [...tsxFiles('app'), ...tsxFiles('components')]) {
    const styles = styleBodies(readFileSync(join(ROOT, file), 'utf8'));
    for (const [name, body] of styles) {
      if (!/fontSize/.test(body) || /fontFamily/.test(body)) continue;
      if (MODIFIERS[file]?.[name]) continue;
      missing.push(`${file}: ${name}`);
    }
  }
  expect(missing).toEqual([]);
});

test.each(Object.entries(MODIFIERS).flatMap(([file, mods]) => Object.entries(mods).map(([mod, base]) => [file, mod, base])))(
  '%s: modifier %s rides on %s, which sets the face',
  (file, _mod, base) => {
    const styles = styleBodies(readFileSync(join(ROOT, file), 'utf8'));
    expect(styles.get(base)).toMatch(/fontFamily/);
  },
);
