# Open decisions — things waiting on the maintainer

**What this file is for.** A question only the maintainer can answer, parked where they will
actually see it, instead of in a paragraph of `AGENTS.md`.

**Why it exists.** On 2026-08-29 the report was *"visual condensing of cards seems like it has
not landed."* It had partly landed. What had not landed was the part that needed a ruling — the
mockup's ~12px rhythm against the app's deliberate 4/8/16/24/32/48 spacing scale — and that
ruling was never requested. It was written down instead, in `AGENTS.md`, as:

> ⚠️ **NOT done in that pass**: `SCREEN_GAP` (16) and `Card`'s padding. The mockup's numbers
> translate to ~12 at this width, which is not a rung on the deliberate … scale … That is a
> design-system decision (add a rung, or don't), **not a defect.**

That note is correct and it was invisible. The maintainer re-reported the symptom two days
later, a session was spent proving the code was on `main` and the OTA had published, and the
answer was in a doc nobody had reason to re-read. **A decision recorded in prose is a decision
that will be re-derived, not made.**

## The rules

1. **Deferring work is fine. Deferring it silently is not.** If a pass stops because it needs a
   ruling, the ruling goes here in the same PR that stops.
2. **State the options with their measured costs**, not "we should decide about spacing". The
   maintainer should be able to answer from this file alone.
3. **Name what it blocks**, so the cost of not answering is visible.
4. **Delete the row when it is answered**, and put the answer where the code lives.
5. A row here is **not** a TODO, a nice-to-have, or a bug. Those go in the code or a PR. This is
   only for *"an agent cannot legitimately choose this."*

---

## Open

_None._

---

## Answered

### Should the pixel gate run in CI, and what would we pay for it?
**Asked:** 2026-08-29 · **Answered:** 2026-08-30 · **It was a bug, not a trade.**

The premise was wrong. This was filed as a cost question — pin the toolchain, bless from CI,
raise the tolerance, or containerise the capture — because all 21 baselines came back "changed"
by a uniform 0.1-1.05% on the runner and that looked like an environment difference nobody could
close cheaply.

It was a **dependency range**. `@playwright/test` sat on `^1.61.1`, so the library had drifted
to a version whose launch defaults render text differently from the one that blessed the
baselines, while this environment's pre-installed Chromium stayed at the 1194 build that
Playwright **1.56** pins. CI installed what the library asked for; local used what the machine
had; neither was wrong and they disagreed.

⚠️ **The browser BINARY was not the variable** — `chromium.executablePath()` resolves to the same
`chromium-1194` on either library version, and launching it reports the same `141.0.7390.37`.
Re-blessing was still needed when the library moved. So the thing to pin is the LIBRARY, and the
hardcoded browser path this repo used to carry in seven scripts actively hid the problem by
making the local run look stable while CI diverged.

Fixed by pinning to `~1.56.0` and deleting the revision from the code entirely (every harness now
lets Playwright resolve the browser it pins). `lib/__tests__/visualGate.test.ts` keeps the range
on `~`, keeps a revision out of the scripts, and asserts CI still runs the gate. None of the four
costed options was paid.

### Card density: the mockup's 12px against a 6-rung spacing scale
**Asked:** 2026-08-29 · **Answered:** 2026-08-29 · **Blocked:** round 20 phase 1, and every
"the app feels less dense than the mockup" report since.

The mockup (`DESIGN_COMPARISON/20-MEASUREMENTS.md` §1) wants a 12px card gap and 12px of
breathing room against the app's `SCREEN_GAP` 16 and `CHROME_REST_GAP` 8. 12 is not a rung on
the `Spacing` scale, so taking it means widening the scale.

| option | cost |
|---|---|
| Add a 12 rung and use it | The scale goes 6 rungs → 7. Closest to the mockup. |
| Tighten within the scale (16 → 8) | Scale stays pure; a bigger trim than asked for, likely too tight. |
| Leave it | The gap between mockup and app stays, and gets re-reported. |

**Answer: add the 12 rung** — *"12px, but also focus on where and how things are placed as well.
Just decreasing pure space is not the entire thing."*

So the follow-through is not only the gap: the same measured table has the bottom nav at 72
against the mockup's 54, the header at 67 against 60, and `Radius.md` at 16 against 20 — and
round 19's phase 8 (Manage cards generalised beyond Home) is still unbuilt, which is the
"where things are placed" half.
