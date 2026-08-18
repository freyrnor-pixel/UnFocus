/**
 * dialogButtonLayout.test.ts — a `flex` shorthand next to `flexBasis: 'auto'` deletes the label
 * on device (2026-08-18).
 *
 * The report was a habit's "Hvor ofte?" picker rendering as four blank pills, and every change
 * made through it going wrong. Both halves are the same defect: `components/AppModal.tsx`'s
 * `styles.button` carried `flex: 1`, and its stacked-layout companion `buttonColumnItem` sets
 * `flexBasis: 'auto'` beside it.
 *
 * **The mechanism, from Yoga's own source** (`ReactCommon/yoga/yoga/node/Node.cpp`,
 * `Node::processFlexBasis`): an `auto` basis does not stop there — it falls through to
 *
 *     if (style_.flex().isDefined() && style_.flex().unwrap() > 0.0f)
 *       return config_->useWebDefaults() ? ofAuto() : points(0);
 *
 * and React Native leaves `useWebDefaults_` false (`config/Config.h`). So `flex: 1` +
 * `flexBasis: 'auto'` resolves to basis **0**, and the `flexGrow: 0` beside it means the button
 * can never grow back: Yoga clamps it to padding + border and the label is squeezed out of the
 * box. In the COLUMN layout that basis is the HEIGHT — hence pills exactly `paddingVertical * 2
 * + borderWidth * 2` tall, with nothing in them.
 *
 * Reproduced headlessly in real Yoga (yoga-layout@3), the method `HEADER_CLIP_DEBUG.md`
 * established for the identical 2026-07-16 header-title bug — whose subtree, re-run as a
 * control, still reproduces (Text 0dp, measureFunc never called). Modelling this dialog's real
 * chain from the Modal root down gave **18dp** with the `flex: 1` and **42dp** without; the web
 * preview measures the same button at **41dp**.
 *
 * Two reasons it survived so long, both worth keeping in mind:
 *   - **A two-button dialog was never affected.** It takes the ROW layout, which never applied
 *     `buttonColumnItem`, so `confirmDestructive` — Cancel plus one red button, the app's most
 *     common dialog by far — always looked right. Only 3+ buttons stack.
 *   - **react-native-web is the mirror image and cannot see it.** RNW emits the CSS `flex: 1`
 *     shorthand and then the longhands after it, so `flex-basis: auto` wins and the button sizes
 *     to content. The preview, `npm run wraps` and every screenshot in `review-bundle/` render
 *     these dialogs correctly. The comment that used to sit on `buttonColumnItem` asserted
 *     "Native was always fine" for exactly that reason — it was written from the web symptom.
 *
 * Source-scanning rather than rendering: the node env has no layout engine, and the one harness
 * that does lay out (the web preview) is the one that provably cannot reproduce this.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

/** Source with every comment removed — this file's own notes name the bug they replaced, so an
 *  assertion about what the code does has to read code, not prose. */
const code = (rel: string) =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** The body of one `name: { … }` entry inside a StyleSheet.create block. */
function styleBody(source: string, name: string): string | null {
  const m = source.match(new RegExp(`\\b${name}:\\s*\\{([^{}]*)\\}`));
  return m ? m[1] : null;
}

describe('AppModal — a stacked dialog button sizes to its label', () => {
  const source = code('components/AppModal.tsx');

  it('has no `flex` shorthand on the shared button style', () => {
    const button = styleBody(source, 'button');
    expect(button).toBeTruthy();
    // `flex: 1` here is the whole bug — it poisons the column layout's `flexBasis: 'auto'`.
    expect(button).not.toMatch(/\bflex:\s*\d/);
    // The rest of the shared style is untouched.
    expect(button).toMatch(/paddingVertical/);
    expect(button).toMatch(/alignItems/);
  });

  it('states grow/shrink/basis explicitly for BOTH layouts, and `flex` in neither', () => {
    for (const name of ['buttonRowItem', 'buttonColumnItem']) {
      const body = styleBody(source, name);
      expect(body).toBeTruthy();
      expect(body).toMatch(/flexGrow:/);
      expect(body).toMatch(/flexShrink:/);
      expect(body).toMatch(/flexBasis:/);
      expect(body).not.toMatch(/\bflex:\s*\d/);
    }
    // The row halves split the line the way the old `flex: 1` did; the column sizes to content.
    expect(styleBody(source, 'buttonRowItem')).toMatch(/flexGrow:\s*1/);
    expect(styleBody(source, 'buttonColumnItem')).toMatch(/flexGrow:\s*0/);
    expect(styleBody(source, 'buttonColumnItem')).toMatch(/flexBasis:\s*'auto'/);
  });

  it('applies exactly one of the two per button, chosen by the layout', () => {
    // A `cond && style` pair would leave the row case with no grow at all; this has to be a
    // ternary so both branches name a style.
    expect(source).toMatch(
      /buttons\.length === 2\s*\?\s*styles\.buttonRowItem\s*:\s*styles\.buttonColumnItem/
    );
    expect(source).not.toMatch(/buttons\.length !== 2 && styles\.buttonColumnItem/);
  });
});

describe('the poisonous pair does not exist anywhere else', () => {
  // `flexBasis: 'auto'` is only ever dangerous next to a `flex: N`. A percentage or numeric
  // basis is returned by `processFlexBasis` before it ever consults `flex`, so those are safe
  // and are deliberately not flagged here.
  function tsxFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${entry}`;
      if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
      if (statSync(join(ROOT, rel)).isDirectory()) tsxFiles(rel, out);
      else if (/\.tsx?$/.test(entry)) out.push(rel);
    }
    return out;
  }

  it('no single style object combines a `flex` shorthand with `flexBasis: \'auto\'`', () => {
    const offenders: string[] = [];
    for (const file of [...tsxFiles('app'), ...tsxFiles('components'), ...tsxFiles('lib')]) {
      const source = code(file);
      // Each `name: { … }` entry, non-nested — which is every style in this repo's sheets.
      for (const m of source.matchAll(/\b([A-Za-z0-9_]+):\s*\{([^{}]*)\}/g)) {
        const body = m[2];
        if (/\bflex:\s*\d/.test(body) && /flexBasis:\s*'auto'/.test(body)) {
          offenders.push(`${file} → ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
