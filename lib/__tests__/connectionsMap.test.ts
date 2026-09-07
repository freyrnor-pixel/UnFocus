/**
 * connectionsMap.test.ts — every path a `Connections:` block names must exist.
 *
 * **Why this is a test and not a convention.** `AGENTS.md` tells every session, in as many
 * words: *"Trust AGENTS.md's hand-maintained dependency maps. Don't grep the repo to re-derive
 * what's already written in the `Connections:` blocks in file headers."* That instruction is
 * only safe while the blocks are true, and nothing was checking them. Measured on 2026-09-07,
 * before this file existed: **183 dangling entries across 103 of the 319 files that carry a
 * block** — 39% of the map pointed at something that is not there.
 *
 * Three different faults were hiding in that number, and only the first is "stale docs":
 *
 *   1. **Paths that MOVED.** `app/plans.tsx`, `app/habits.tsx`, `app/shopping.tsx` and
 *      `app/index.tsx` went into `app/(tabs)/` with the 2026-08-22 five-tab restore. 92 entries,
 *      every one of them a file that exists at a different path.
 *   2. **Components that were DELETED.** `components/CollapsedSection.tsx` is the clearest:
 *      deleted 2026-08-21 in `9d1a307` when its five drawers became registry cards, and still
 *      named 43 times across 23 files afterwards — including in a `Connections: Imports →` line
 *      claiming a file imported it.
 *   3. **Components that NEVER EXISTED.** `app/task-form.tsx`, `components/MedicineTrayCard.tsx`
 *      and `components/HintCard.tsx` appear in these maps and have never existed in any branch
 *      in the repo's history (`git log --all` finds no commit that ever added them). Roughly 19
 *      entries pointing at files that were never real.
 *
 * The third is why this guard exists rather than a docs sweep. A stale path is a thing that
 * decayed; an invented one was wrong the day it was written, and a reader following it loses the
 * same amount of time either way. This is EXECUTION_RULES.md's one idea applied to prose —
 * *prefer a mechanism that makes the defect impossible over a rule that forbids it* — and its
 * rule 5, *every claim has a date and one owner*, given something that can actually fail.
 *
 * ⚠️ **Scoped to the `Connections:` block ON PURPOSE, and the rest of a header is deliberately
 * exempt.** This repo's headers name what they replaced — *"`NAV_PEEK` lived here until…"*,
 * *"was a `CollapsedSection` drawer (2026-08-21)"* — and `lib/__tests__/chromeRhythm.test.ts`'s
 * `code()` helper says why that prose is load-bearing: it is what stops a later session
 * re-adding a reversed decision. A guard that banned every mention of a deleted file would
 * delete exactly the history the repo keeps on purpose. The `Connections:` block is different in
 * kind: it is a factual dependency map, it is what AGENTS.md sends people to instead of
 * grepping, and it has no reason to name a file that is not there.
 *
 * So: mention a deleted component anywhere you like in prose, with a date. Do not put it in the
 * map.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');

/** Every source file in the repo, excluding dependencies and build output. */
function sourceFiles(dir = ROOT, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path.relative(ROOT, full));
  }
  return out;
}

/**
 * The `Connections:` block of a file header, if it has one.
 *
 * It runs from the `Connections:` line to the next blank comment line or the end of the JSDoc,
 * which is the shape every one of the 319 blocks in this repo uses.
 */
function connectionsBlock(src: string): string | null {
  const m = src.match(/\*\s*Connections:\n([\s\S]*?)(?:\n \*\n|\n \*\/)/);
  return m ? m[1] : null;
}

const PATH_RE = /(?:components|lib|app|store|constants|hooks)\/[A-Za-z0-9_./-]+/g;

/**
 * Words that mark a path as a HISTORICAL mention rather than a live dependency.
 *
 * ⚠️ This list is why the guard is usable at all. Several `Connections:` blocks deliberately
 * record what they replaced, inside the block — *"⚠️ **components/StageTree is DELETED
 * (2026-09-01)**"*, *"components/GoalsSheet.tsx, the popup it used to open, is deleted"*,
 * *"replaced components/ShoppingStoreMode, retired 2026-08-20"*, *"components/HintSheet.tsx was
 * a fifth caller for one day in August 2026"*. Every one of those is correct, dated and worth
 * keeping: EXECUTION_RULES.md rule 5 asks for exactly that (*"mark it superseded with the date
 * and keep the old text as history"*), and chromeRhythm.test.ts's `code()` helper explains what
 * the prose is for — it stops a later session re-adding a reversed decision.
 *
 * So a dead path is fine here **as long as the block says it is dead**. What is not fine is a
 * path presented as a live dependency that does not exist. That is the whole distinction this
 * guard draws, and it is why it reads context rather than just matching paths.
 */
const DEAD_MARKERS = /\b(deleted|delete[sd]?|retired|removed|gone|never existed|no longer|used to|was a|were a|gained|gains|gone since|gutted|gone in)\b/i;

/**
 * Repo-relative paths named inside a block, paired with the text around them.
 *
 * Trailing punctuation is stripped because these blocks are prose — an entry routinely ends a
 * clause (`lib/db.ts)`, `app/plans.tsx,`). A bare directory (`components/cover/`) names a
 * folder, not a file.
 */
function referencedPaths(block: string): { ref: string; context: string }[] {
  const out: { ref: string; context: string }[] = [];
  const seen = new Set<string>();
  for (const m of block.matchAll(PATH_RE)) {
    const ref = m[0].replace(/[.,;)]+$/, '').replace(/\/$/, '');
    if (!ref.includes('/') || seen.has(ref)) continue;
    // Only FILE-SHAPED tokens are dependency claims. These blocks are prose, and a path-looking
    // fragment is often a phrase: `Data → pure functions + a React context (no store/DB)`,
    // `components/cover/`, `app/store/component`. A claim either carries a .ts/.tsx extension or
    // names a component/hook — CamelCase or `useThing`, with at least one lower-case letter so an
    // acronym like `store/DB` is not mistaken for a filename.
    const leaf = ref.slice(ref.lastIndexOf('/') + 1);
    const fileShaped = /\.tsx?$/.test(ref) || /^(?:use)?[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/.test(leaf);
    if (!fileShaped) continue;
    seen.add(ref);
    // A window either side, so a marker in the same clause is seen. Blocks wrap at ~100 chars,
    // so this spans the line the entry is on and its continuation.
    const from = Math.max(0, (m.index ?? 0) - 190);
    out.push({ ref, context: block.slice(from, (m.index ?? 0) + ref.length + 190) });
  }
  return out;
}

function exists(ref: string): boolean {
  const full = path.join(ROOT, ref);
  if (fs.existsSync(full)) return true;
  return ['.ts', '.tsx', '.js', '.jsx'].some((ext) => fs.existsSync(full + ext));
}

describe('Connections: blocks name files that exist', () => {
  const files = sourceFiles();

  it('finds the blocks at all — a parse that matched nothing would pass silently', () => {
    // The failure mode this whole file exists to stop, applied to itself: a regex that quietly
    // stops matching turns this suite green while checking nothing. 319 blocks on 2026-09-07.
    const withBlock = files.filter((f) => connectionsBlock(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(withBlock.length).toBeGreaterThan(250);
  });

  it('every path in every block resolves to a real file', () => {
    const dangling: string[] = [];
    for (const f of files) {
      const block = connectionsBlock(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      if (!block) continue;
      for (const { ref, context } of referencedPaths(block)) {
        if (exists(ref)) continue;
        // A path the block itself marks as dead is history, not a broken dependency claim.
        if (DEAD_MARKERS.test(context)) continue;
        dangling.push(`${f} -> ${ref}`);
      }
    }
    // Listed in full rather than counted: the point of failing is to say WHICH line to fix.
    expect(dangling).toEqual([]);
  });
});
