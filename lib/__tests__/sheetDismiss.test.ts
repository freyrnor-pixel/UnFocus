/**
 * sheetDismiss.test.ts — a sheet's dismiss pill has to announce itself as a button.
 *
 * Found 2026-08-30, and found the way these things usually are: not by reading the code, but by
 * a harness failing. `scripts/preview.mjs` reaches the new Manage cards sheet's "Done" with
 * `getByRole('button', { name: 'Done' })` — the same locator it uses for every other control in
 * the walk — and it timed out. The control was a `PressableScale` with a `<Text>` child and no
 * `accessibilityRole`, so react-native-web rendered a plain `<div>`: on screen it is obviously a
 * button, to anything that reads the tree it is a paragraph.
 *
 * ⚠️ **It was not one file. It was all ten**, including `components/LayoutPickerSheet.tsx`, the
 * sheet the new one was modelled on — which is exactly how the defect propagated. Every one of
 * these is the ONLY way out of a modal that covers the screen, so a screen-reader user who opens
 * one has no announced control to leave by. TypeScript cannot see it, the pixel gate cannot see
 * it (an ARIA role draws nothing), and `npm run wraps` measures text it has no reason to visit.
 *
 * The scan is deliberately structural rather than a list of components: any NEW sheet that copies
 * this pattern is covered the moment it is written, which is the property the ten copies lacked.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

/** Every file that draws a `styles.doneBtn` pill — the shared shape of a sheet's way out. */
function sheetFiles(): string[] {
  const out: string[] = [];
  for (const dir of ['components', 'app']) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (!f.endsWith('.tsx')) continue;
      const src = readFileSync(join(ROOT, dir, f), 'utf8');
      if (/styles\.doneBtn\b/.test(src)) out.push(`${dir}/${f}`);
    }
  }
  return out;
}

describe('every sheet dismiss pill is an announced button', () => {
  const files = sheetFiles();

  it('finds the sheets to check', () => {
    // A guard on the guard: if the pill is ever renamed, this test would otherwise pass by
    // checking nothing — the silent-skip failure this repo's audits keep getting bitten by.
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files)('%s declares accessibilityRole on every doneBtn pressable', (file) => {
    const src = readFileSync(join(ROOT, file), 'utf8');
    const opens = [...src.matchAll(/styles\.doneBtn\b/g)];
    expect(opens.length).toBeGreaterThan(0);
    for (const m of opens) {
      // Walk back to the tag this style belongs to. `<Button>` owns its own role, so a caller
      // that uses the shared component is correct by construction and is not the subject here —
      // components/HealthIssuesSheet.tsx was the one that did; it is deleted (2026-09-01) and
      // its body is a card pane now, but the carve-out stands for whichever sheet uses the
      // shared component next — it should not be made to restate what Button already declares.
      const head = src.slice(0, m.index);
      const tagStart = head.lastIndexOf('<');
      const tag = src.slice(tagStart, tagStart + 40);
      if (/^<Button\b/.test(tag)) continue;

      // ⚠️ The tag ends at the first `>` that is NOT the tail of an arrow function. An inline
      // `onPress={() => …}` before the role is what made a first cut of this test report a
      // false failure on app/share-modal.tsx, whose pill is in fact correct.
      const tail = src.slice(tagStart, tagStart + 1600);
      let end = -1;
      for (let i = 1; i < tail.length; i += 1) {
        if (tail[i] === '>' && tail[i - 1] !== '=') { end = i; break; }
      }
      const decl = tail.slice(0, end + 1);
      const what = `${file} @${tag.split(/[\s>]/)[0]}`;
      expect(`${what}: ${/accessibilityRole=/.test(decl)}`).toBe(`${what}: true`);
    }
  });
});
