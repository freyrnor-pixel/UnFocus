/**
 * quadraticLookup.test.ts — bans the O(n²) order-projection shape at call sites.
 *
 * **What this catches.** Seven files had independently written the same two expressions:
 *
 *     orderedIds.map((id) => items.find((x) => x.id === id))     // O(n²)
 *     orderedIds.filter((id) => items.some((x) => x.id === id))  // O(n²)
 *
 * Each is a linear scan per id. With the handful of rows a test or a fresh install has, that is
 * free; with a year of a real user's data it is quadratic, and two of the seven ran inside a drag,
 * which re-renders per frame. `projectOrder` / `retainKnownIds` (lib/reorder.ts) do the same work
 * with one Map or Set — see `reorder.test.ts`, which pins them as differential tests against the
 * exact expressions banned here.
 *
 * **Why a SOURCE SCAN is the right instrument here, unusually.** CLAUDE.md's A2 list is blunt
 * that "a regex can confirm code exists but never that it runs", and PR #712 deleted two
 * assertions that had been pinning the text of a dead line. That warning is about asserting
 * BEHAVIOUR through source text — a regex cannot tell you a predicate still evaluates true.
 *   This test asserts no behaviour. The defect IS the shape: a nested scan is quadratic whether
 * or not it runs, and the fix is the same wherever it appears. There is nothing here that could
 * go constant-false behind the regex's back, because there is no predicate — only a syntax this
 * repo has decided not to hand-write any more. That is the one case a source scan fits, and the
 * distinction is worth keeping straight rather than reading this as licence for more of them.
 *
 * **The allowlist is a ratchet**, like designTokens.test.ts's: it may shrink, never grow. Adding
 * an entry means writing down why a quadratic scan is correct there — which, for a list the user
 * can grow, it generally is not.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/** Every app source file, so the scan cannot drift behind a newly added directory. */
function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name === '__tests__' || e.name === '__mocks__') return [];
    if (e.isDirectory()) return sources(join(dir, e.name));
    return /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [];
  });
}

const FILES = ['app', 'components', 'store', 'lib'].flatMap(sources);

/**
 * `.map(x => arr.find(...))` and friends. Deliberately narrow: it requires the inner call to be a
 * `find`/`some`/`findIndex`/`indexOf` on a DIFFERENT expression than the callback's own parameter,
 * which is what makes it a nested scan rather than an ordinary predicate.
 */
const NESTED_SCAN =
  /\.(?:map|filter|forEach|flatMap)\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>\s*(?!\1\b)[A-Za-z_$][\w$.]*\.(?:find|some|findIndex|indexOf)\(/;

/**
 * Empty, and meant to stay that way. An entry here is a claim that a quadratic scan over that
 * data is correct — i.e. that the collection is bounded by something other than the user.
 */
const ALLOWLIST: string[] = [];

describe('no hand-written O(n²) order projection', () => {
  it('uses lib/reorder.ts\'s projectOrder / retainKnownIds instead of a nested scan', () => {
    const offenders: string[] = [];
    for (const rel of FILES) {
      if (ALLOWLIST.includes(rel)) continue;
      const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
        if (NESTED_SCAN.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('still recognises the banned shape, so a green run means something', () => {
    // A scan that has quietly stopped matching is worse than no scan — it reports clean forever.
    // These are the seven expressions this test was written against, verbatim.
    expect(NESTED_SCAN.test('.map((id) => wheneverAll.find((tk) => tk.id === id))')).toBe(true);
    expect(NESTED_SCAN.test('.filter((id) => habits.some((h) => h.id === id))')).toBe(true);
    expect(NESTED_SCAN.test('drag.order.map((id) => groups.ungroupedUnchecked.find((i) => i.id === id))')).toBe(true);
    // ...and does not fire on an ordinary predicate over the callback's own parameter.
    expect(NESTED_SCAN.test('.filter((task) => task.tags.some((t) => t === tag))')).toBe(false);
    expect(NESTED_SCAN.test('.map((item) => item.name)')).toBe(false);
  });
});
