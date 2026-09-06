# EXECUTION_RULES.md — how a change gets made here

**Written:** 2026-09-06 · **Replaces:** the process half of `CLAUDE.md` (its A1–A4 reporting
contract is absorbed here, not deleted twice) · **Does NOT replace:** `DESIGN_RULES.md`.

---

## Why this exists

The maintainer's complaint, verbatim: *"code changes and visual changes have not always been
successful, and there have been a lot of really specific rules that don't always work, and code
checking has often failed."*

All three halves of that are correct, and they are one problem, not three.

This repo has **33 numbered design invariants, 18 root markdown documents, 4 visual harnesses and
133 test suites** — and still ships changes that do not do what the session said they did. More
rules did not fix it. The rules are not the failure.

**The failure is that the checking lies.** Five measured examples, all found in a single session
on 2026-09-06:

| what was claimed | what was true |
|---|---|
| `npm run visual` reported `0 changed` for the shopping screens | The walk's seeding step silently no-ops; `shopping-populated` is **byte-identical** to `shopping-empty` (`md5sum`-confirmed). It has never once photographed a populated list. |
| Four baselines "changed" by 86292 px | The same four report the *exact same* pixel count. The gate was measuring its own duplicate captures. |
| A guard proved three files share one row recipe | It asserted the substring `from '@/lib/rowList'` appeared in the file. A tree where nothing ever *called* the function passed it. |
| `INVARIANTS.md` stated the row question was "an open design question" | It had been answered **the same day**. The doc was stale on arrival. |
| Docs stated `HabitsSurface` hand-rolls its own row box | It had imported and called the shared recipe for a week. |

Every one of those is a check that **could not fail**, or a claim with **no owner and no date**.
That is the thing to fix.

---

## The one idea

> **Prefer a mechanism that makes the defect impossible over a rule that forbids it.**

The single thing in this codebase that has never drifted is `lib/cardRegistry.ts`: a card is
declared there and drawn by `components/Card.tsx`, and an unregistered `id` is a **`tsc` error**.
Nobody has to remember the rule, nobody can review it wrong, and no doc can go stale about it.

Everything below is that idea applied. When you are about to write a rule, ask first whether you
can instead make the wrong thing not compile.

---

## The rules

There are seven. If you cannot hold them in your head, there are too many — say so rather than
adding an eighth.

### 1. A check that cannot fail is not a check

**Before you trust any new guard, make it fail.** Break the code it guards — `git stash` the fix,
change a value, delete the call — run it, watch it go red, restore, watch it go green. Report both
results. A guard whose fail→pass was never demonstrated does not count as verification and must
not be cited as one.

This is what caught the row-recipe guard: it passed on a file that imported a constant and did its
own thing.

### 2. A harness that reports "unchanged" must prove it looked

`unchanged`, `0 findings` and `all green` are only evidence if the harness **saw the thing you
changed**. Before citing a clean run as proof, confirm the harness actually rendered the state
under test — the populated screen, the empty screen, the theme, the language.

When you cannot confirm it, the result is `unverified`, not `pass`. Say *"the walk does not reach
this screen"*, never *"the harness found no problems"*.

Measure the baseline on a stashed tree before you measure the fix, so you know that harness's own
noise rather than assuming it has none.

### 3. Three words, and only three

Every claim about a change carries exactly one:

| word | means |
|---|---|
| `verified-by-<harness>` | a **named** harness saw it — and per rule 2, it really saw it |
| `verified-by-device` | the maintainer confirmed it on a real install |
| `unverified` | nothing could see it — **the item stays open** |

**"Fixed" is not one of them.** Neither is "done", "working", or "should be fine". An `unverified`
item is not finished, no matter how confident the diff looks.

Say up front which classes are blind to this change. The standing ones: Android optical centring,
`Fonts.italic` on Android, native shadow and corner rendering, `expo-blur`, gestures and haptics,
`app/scan.tsx`, and dark-on-dark or one-level light shifts.

### 4. Enumerate before fixing, and fix all of them

Open every visual or structural change by grepping **every** implementation of the thing you are
about to change and listing them `file:line`. Fix all, or write down why not — in the diff, not
just in chat.

Three files once drew three different rows while the guard compared two of them. One session
found five shopping-row call sites where the brief named one.

### 5. Every claim has a date and one owner

A fact lives in exactly one file. Everywhere else points at it.

When you change something a document asserts, **fix the document in the same commit** — including
file-header `Connections:` blocks. When a claim is superseded, mark it superseded with the date
and keep the old text as history; do not silently rewrite it and do not leave it standing.

If two documents disagree, that is a bug of the same severity as a failing test.

### 6. A decision not written to a file does not exist

A ruling reasoned through in conversation and never written down **will** be re-derived, wrongly,
by the next session. This has already happened here more than once.

Before asking the maintainer anything: write the question into `DECISIONS_OPEN.md` first — the
options with their **measured** costs, and what it blocks. Then ask in plain language. The
maintainer is a non-technical product owner: put the technical detail in the file and the *choice*
in the question. Then stop. Do not pick a default and proceed.

When it is answered, the answer moves to where the code lives, dated.

### 7. One device round trip per item

End any session touching rendering with a verification card: numbered, both themes, one
observable per line, answerable with numbers alone.

**Two failures on one line stops the item.** It goes to `DECISIONS_OPEN.md`, not to a third
attempt. Two failures means the diagnosis is wrong, not the implementation.

---

## The verification card

```
## Verification — <session id>
Fixed at N call sites: <file:line list>
Harnesses that saw it: <names>  ·  Blind to this change: <names or "none">

Check on device, both themes:
1. [dark]  <screen> → <element>: <observable>.     pass / fail
2. [light] <same>                                  pass / fail

Reply with the numbers only. Anything not listed was not changed.
```

---

## What is NOT changing

`DESIGN_RULES.md`'s numbered invariants stay exactly as they are. They govern **values** —
spacing, contrast, tap targets, durations, copy tone — and the CI-enforced ones
(`designTokens.test.ts`, `colors.test.ts`, `copyTone.test.ts`) work. They were never the problem.

`DESIGN_RULES_AUDIT.md` still records which of them are open conflicts and therefore not binding.
Read it before "fixing" one.

---

## The standing debt this ruleset exists to clear

Three known-broken checks. Until each is fixed, **do not cite it as evidence**:

1. **`scripts/screenshot-states.mjs` seeding no-ops silently.** `shopping-populated` and
   `shopping-monthly` are byte-identical to `shopping-empty`. `tryButton()` returns without
   throwing when its target is missing, and every `shot()` after it still runs. Fix: a seeding
   step that cannot be skipped without failing the run.
2. **`lib/__tests__/screenRhythm.test.ts:429-434` asserts an import string, not a call.** The
   `<RowBox>` work (session S1.1) is the fix: one component that is the sole caller of
   `rowListStyle()`, so the type system sees what the substring cannot.
3. **The visual gate's coverage gaps are reported but not enforced.** Three screens the baseline
   set wants, the walk cannot produce. A gap should fail the run, not print a line.

Rule 2 is why these are listed here rather than left in a harness doc: a broken check is worse
than no check, because it is cited as proof.
