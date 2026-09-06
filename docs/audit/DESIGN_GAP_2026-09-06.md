# DESIGN_GAP_2026-09-06.md — the whole app against the proposed design

**Run:** 2026-09-06, at the maintainer's request (*"sjekk hele designet mot foreslått design"*).
**Sources audited:** `19-card-surface-reset.html`, `20-corrected-screens.html`,
`20-card-editor-system.html`, `20-glass-card-system.html`, `19-IMPLEMENTATION.md`,
`20-IMPLEMENTATION.md`, `20-MEASUREMENTS.md`, and `00-INDEX.md`'s tasks 01–18.

**Method:** every difference is bucketed — (a) genuinely unbuilt · (b) empty state ·
(c) superseded by a later dated ruling · (d) explicitly declined · (e) known mockup defect.
A declined or superseded item is **not** a gap. Buckets c/d/e are listed as thoroughly as the
gaps, because re-litigating settled decisions is what this audit exists to prevent.

---

## Bottom line

**The proposed design is essentially built.** Round 19's phases 1–8 and round 20's phases 0–6 all
shipped. All 18 comparison tasks are closed — shipped, declined, or confirmed stale.

Five items remain. **Three are already-scoped sessions**, not discoveries. Two are open questions
that need the maintainer, not an agent.

---

## What remains — bucket (a) only

| # | Item | Size | Status |
|---|---|---|---|
| 1 | `MonthlyTableRow` converge onto `lib/rowList.ts` | M | Decided (option C, 2026-09-06). Scoped as **S1.2**. Not built. |
| 2 | `MedicineSurface` converge onto `lib/rowList.ts` | M | Decided, same ruling. Scoped as **S1.3**. Not built. |
| 3 | `<RowBox>` compile-time wrapper | S–M | Scoped as **S1.1**. The current guard scans an import string, not a call — the weakness this closes. |
| 4 | `Radius.md` is 16; `20-MEASUREMENTS.md` wants 20 | XS | ⚠️ **Needs a maintainer ruling — see below.** |
| 5 | "Denne måneden" truncates at 393px | XS | Copy-only. Flagged 2026-08-26, never actioned. `wraps` sees it as a near-miss, not a hard fail. |

Plus, from the round-20 layout pass run the same day (`DESIGN_GAP` companion findings):

| # | Item | Size |
|---|---|---|
| 6 | Shop's per-week empty state offers two competing actions where the mockup wants one line + one button — a defect the mockup names itself | S |
| 7 | Shop's fresh-install empty state has no action button at all, and sits above the card rather than as its empty body | S |
| 8 | Group rows draw `SectionRail`'s icon-badge + ALL-CAPS + hairline where the mockup draws a boxed dot + label + count + chevron; "Tidligere dager" shows no count | M |

---

## The two open questions

### `Radius.md` — 16 or 20?

`constants/theme.ts:281` sets `Radius.md = 16`. `20-MEASUREMENTS.md` wants 20.

This is **not** a simple port. Raising it reverses an explicit 2026-08-04 maintainer instruction:
*"squarer reads harder… pressure is downward, not back to 18."* The newer 20 figure has never been
weighed against that sentence. `DECISIONS_OPEN.md`'s "Card density" row (2026-08-29) left radius
specifically unanswered.

An agent cannot legitimately choose between two maintainer statements. **Goes to the maintainer.**

### "Denne måneden" at 393px

The one card title that does not fit a mainstream phone width. A shorter Norwegian string fixes it.
Copy is the maintainer's, not an agent's, so it needs a word from them — but it is XS once chosen.

---

## Could not determine

Six motifs are generated into `constants/motifs.ts` with **zero mounts** anywhere in `app/` or
`components/`: `canopy-corner`, `card-edge-vine`, `fab-halo`, `ground-arc`, `holder-blob-lg`,
`holder-blob-md`.

They are most likely leftovers from the tree family deleted 2026-09-01, but unlike
`screen-bg-calm`/`screen-bg-strip` — which carry an explicit "retained on purpose" note — nothing
settles it. No header, test or dated ruling. **Do not delete them on a guess.**

---

## NOT a gap — do not reopen these

This list is the audit's other half. Each of these looks like a divergence from the proposed design
and is in fact a settled decision.

**The tree and its motifs (tasks 01, 02, 03).** Shipped, then **deleted 2026-09-01** on the
maintainer's own instruction: *"remove the Tree in Energy (and wherever else it may be)."*
`components/StarterCard.tsx`'s header says it outright: **"THERE IS NO WATERMARK."** The
`00-INDEX.md` finding that "13 assets shipped and zero were mounted" describes a state that was
first fixed and then deliberately reversed. A report that the tree is "still missing" is describing
the intended app.

**Declined outright (d):** the accent stripe (task 08, reaffirmed 2026-08-10) · per-screen backdrop
redraw (task 05) · tree-stage bindings (task 03) · Notes identity hue · boxed-rows-by-default ·
feature-hue cards · both Gemini halves (task 17).

**Superseded by later rulings (c):** `SectionDivider`/`trunk-divider`, deleted 2026-08-19 and now
actively banned by `screenRhythm.test.ts` · `onboarding-triptych`, retired 2026-08-14 · card edge
material, re-resolved three times, current state is the latest instruction · the hint line's
direction, flipped 2026-09-06 to show on **empty** cards, deliberately contradicting the mockup ·
Home's energy card, where the mockup's Lav/Middels/Høy picker was declined in favour of keeping the
budget model.

**Known mockup defects (e) — never port these.** `20-IMPLEMENTATION.md` names them: chrome
translucent enough that content reads through it while scrolling · a peek line that truncates 7 of
8 times in English · a Manage-cards sheet whose light-mode text lands at ≈1.2:1 · a backdrop wash
that fails AA for 3 of 5 identity hues and cuts the accent ladder from five rungs to three. The app
correctly did **not** adopt any of them.

**Confirmed stale, no work needed:** the time-box colon (task 14 — the app already renders `HH:MM`
with a colon) · check position (12) · energy pips (13).

**Absorbed rather than skipped:** task 16 ("solid pressable materials") went into the Tactile
Glass, neon/OLED and blueprint passes; its own addendum records it as *delivered*, not superseded.
Task 15 (every boolean a slider) is codified as `DESIGN_RULES.md` rule 19a with no violations left.

---

## Doc staleness found while auditing

Two claims that are wrong today. Both are rule-5 violations under `EXECUTION_RULES.md` — a fact
with no owner keeping it current:

1. **`lib/cardRegistry.ts`'s header says `cardsInGroup()` is "read by nothing yet."** It is called
   at `components/CardExpandHost.tsx:300` to draw the cross-screen Growth strip.
2. **`DECISIONS_OPEN.md` carried a line saying Manage cards beyond Home was unbuilt** (2026-08-29).
   `components/ManageCardsSheet.tsx` shipped the next day.

---

## Two things code-complete but `unverified`

Neither is a gap. Both are awaiting the maintainer's device pass, and under
`EXECUTION_RULES.md` rule 3 an `unverified` item stays open:

- **R20.6** — the composer tier-3 "More" escalation, wired at all three call sites.
- **S1.0** — `ShoppingRow`/`WeekListCard` converged onto `lib/rowList.ts`.

⚠️ S1.0's harness evidence is weaker than it looked: the visual walk's `shopping-populated`
capture was byte-identical to `shopping-empty`, so the pixel gate never photographed the rows S1.0
changed. See `EXECUTION_RULES.md`'s standing-debt list.
