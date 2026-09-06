/**
 * shoppingRowConformance.test.ts — S1.0: ShoppingRow/WeekListCard actually CALL rowListStyle(),
 * not merely import it.
 *
 * `docs/audit/ROW_ENUMERATION.md`'s Part 3 names the exact blind spot this file exists to close:
 * `lib/__tests__/screenRhythm.test.ts`'s "listed rows" describe block only checks that a file's
 * source contains the literal substring `"from '@/lib/rowList'"` — true of a file that imports
 * the module and does its own thing with the corners (`components/PadSheet.tsx` passes it today
 * on the strength of importing the *constants* alone). This file is deliberately NOT added to
 * that describe block (out of scope for S1.0, and its `PAD_SHEET`/`HABITS_SURFACE`/
 * `PLAN_TASK_CARD` triad is S1.1's to extend) — it is a new, separate guard for the two files
 * S1.0 converged.
 *
 * ── WHY A CALL-SHAPE REGEX AND NOT A RENDER TEST ──────────────────────────────────────────────
 * There is no renderer in this project's devDependencies (no react-test-renderer /
 * @testing-library/react-native, and `jest.config.js` sets `testEnvironment: 'node'`) — the same
 * constraint `lib/__tests__/screenHeaderContract.test.ts`'s header documents. So this reads
 * source, same precedent, but asks a narrower, stronger question than "does the string
 * `@/lib/rowList` appear anywhere": does `rowListStyle(` appear as an actual CALL — followed by
 * an opening `{` (every real call site in this codebase passes an object literal;
 * `import { rowListStyle }` cannot itself satisfy `rowListStyle\(\{`) — and is that call's
 * `rail:` argument the resolved shopping hue, not a re-typed literal. A file could still import
 * the function and call it with a no-op argument that this can't catch (the S1.0 brief's own
 * caveat about style objects, `ROW_ENUMERATION.md` Part 4) — but it can no longer pass on the
 * strength of the import line alone, which is the concrete failure mode this closes.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Source with its leading JSDoc header stripped — those blocks legitimately DESCRIBE the old
 *  shape being replaced (e.g. "the old `borderLeftWidth: 3`"), and matching prose would push a
 *  later session to delete the explanation to get the test green. Same guard
 *  lib/__tests__/screenHeaderContract.test.ts and __tests__/onboardingFlow.test.ts use. */
function code(rel: string): string {
  const src = read(rel);
  return src.startsWith('/**') ? src.slice(src.indexOf('*/') + 2) : src;
}

const SHOPPING_ROW = 'components/ShoppingRow.tsx';
const WEEK_LIST_CARD = 'components/WeekListCard.tsx';

describe('ShoppingRow / WeekListCard — rule 5 conformance (S1.0)', () => {
  it('ShoppingRow.tsx CALLS rowListStyle(), not just imports it', () => {
    const src = code(SHOPPING_ROW);
    expect(src).toMatch(/from '@\/lib\/rowList'/);
    // A real invocation, not the import line: an opening brace right after the paren, the
    // shape of every call site in this codebase (`rowListStyle({ isDark, first, last, rail })`).
    expect(src).toMatch(/rowListStyle\(\{/);
  });

  it("the call passes first/last/rail through, not a hand-rolled substitute", () => {
    const src = code(SHOPPING_ROW);
    const call = src.match(/rowListStyle\(\{[^}]*\}\)/)?.[0];
    expect(call).toBeTruthy();
    expect(call).toMatch(/first:/);
    expect(call).toMatch(/last:/);
    expect(call).toMatch(/rail(:|,|\s|\})/); // `rail` shorthand or `rail: rail`
  });

  it('WeekListCard.tsx no longer left-borders rowsCard, and passes the resolved shopping hue as rail to every ShoppingRow', () => {
    const src = code(WEEK_LIST_CARD);
    // The old rail mechanism (a box-level border, coloured per-region) is gone.
    expect(src).not.toMatch(/borderLeftWidth:\s*3/);
    expect(src).not.toMatch(/borderLeftColor:\s*theme\.good/);
    expect(src).not.toMatch(/borderLeftColor:\s*theme\.accent/);
    // The new rail mechanism (a per-row prop, one hue) is present at every ShoppingRow call
    // site. Four direct `<ShoppingRow` instances in this file (filtered, dish-grouped, in-cart,
    // purchased) plus the position booleans threaded through `renderReorderableRow` for the
    // fifth (the reorderable ungrouped rows, whose actual `<ShoppingRow>` lives in
    // app/(tabs)/shopping.tsx).
    const railMatches = src.match(/rail=\{screenColor\.base\}/g) ?? [];
    expect(railMatches.length).toBeGreaterThanOrEqual(4);
    const firstLastMatches = src.match(/first=\{[^}]+\}\s*\n\s*last=\{[^}]+\}/g) ?? [];
    expect(firstLastMatches.length).toBeGreaterThanOrEqual(4);
  });

  it('rowsCard keeps its radius and horizontal padding — only the rail-mimicking border left', () => {
    const src = code(WEEK_LIST_CARD);
    expect(src).toMatch(/rowsCard:\s*\{\s*borderRadius:\s*Radius\.md,\s*paddingHorizontal:\s*Spacing\.md\s*\}/);
  });

  it('the redundant per-row rowDivider is gone from WeekListCard.tsx — rowListStyle supplies the hairline now', () => {
    const src = code(WEEK_LIST_CARD);
    expect(src).not.toMatch(/rowDivider:/);
    expect(src).not.toMatch(/styles\.rowDivider/);
  });

  it("app/(tabs)/shopping.tsx forwards first/last/rail into the reorderable row's ShoppingRow", () => {
    const src = code('app/(tabs)/shopping.tsx');
    expect(src).toMatch(/renderReorderableRow=\{\(item, first, last\)/);
    expect(src).toMatch(/first=\{first\}/);
    expect(src).toMatch(/last=\{last\}/);
    expect(src).toMatch(/rail=\{screenHue\}/);
  });
});
