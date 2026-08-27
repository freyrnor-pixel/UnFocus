# Design-system comparison — one task per file

Comparison of the **UnFocus Design System** Claude Design project
(`ec3299ab-36de-4990-9d47-c1a3e7a0b321`) against `main` as of 2026-08-04, split into
independent tasks so each can run in its own Code session without re-deriving the others.

**Do them in filename order.** The order is dependency-ordered, not priority-ordered —
06 decides a hue that 07/08/09/11 all consume, and 02 ships an asset 03 mounts.

---

## The two findings that produced this list

**1. The tokens are already in sync — there is nothing to port.**
`tokens/colors.css`, `tokens/spacing.css`, `tokens/typography.css` in the design project
carry a header saying they were regenerated *from* `constants/colors.ts` / `constants/theme.ts`
on 2026-08-04. Every hex, spacing step, radius and font size matches the repo exactly
(verified value by value). **No session in this folder should "port a colour" or "port a
spacing token".** The divergence is entirely in *where* the shared tokens get applied.

**2. The tree art shipped but was never mounted.**
PR #481 added 13 illustration assets and compiled 5 of them into `constants/motifs.ts`
(`tree-natural-seed`/`sprout`/`sapling`, `leaf-icon`, `leaf-sprig`). A grep of every `.tsx`
under `app/`, `components/`, `lib/` finds **zero** mounts. The only motifs the app actually
renders are `halo-ring` (TourSpotlight), `trunk-divider` (SectionDivider), `empty-branch`
(StarterCard) and `onboarding-triptych` (onboarding backdrop). Tasks 01–05 are that gap.

---

## Order

| # | File | Decision | Size | Blocked by |
|---|---|---|---|---|
| 01 | `01-empty-state-seed-tree.md` | Seed tree instead of the bare branch in empty states | XS | — |
| 02 | `02-port-tree-natural-full.md` | Port the missing 4th growth stage | S | — |
| 03 | `03-where-the-tree-appears.md` | Habits / Home / Energy — where a stage tree binds | M | 02 |
| 04 | `04-leaf-accents.md` | `leaf-icon` + `leaf-sprig` as inline marks | S | — |
| 05 | `05-screen-backdrop.md` | Redraw the corner branches in the leaf style | M | 02 |
| 06 | `06-which-colour-system.md` | 4 card hues vs 9 feature hues (**feeds 07–09, 11**) | S | — |
| 07 | `07-card-edge-borders.md` | Gradient identity edge vs flat hairline | S | 06 |
| 08 | `08-accent-stripe.md` | 4px left stripe, and what it replaces | S | 06, 07 |
| 09 | `09-header-count-pill.md` | Coloured count pill vs the grey summary sentence | XS | 06 |
| 10 | `10-boxed-vs-ruled-rows.md` | **The big fork.** Notepad rules vs bordered row boxes | L | — |
| 11 | `11-checkbox-colour.md` | Domain-hued check rings | XS | 06, 10 |
| 12 | `12-check-position-confirm.md` | Confirm the design is stale here (likely no-op) | XS | — |
| 13 | `13-energy-pips-confirm.md` | Confirm the design is stale here (likely no-op) | XS | — |
| 14 | `14-time-box-colon.md` | Time boxes show `:`, not a vertical line | XS–S | — |
| 15 | `15-toggles-always-sliders.md` | Every boolean is a coloured/grey slider | M | — |
| 16 | `16-solid-pressable-materials.md` | Borders on buttons/icons; hard, solid, pressable | L | 06 |

12 and 13 exist so the two stale-design items are recorded as *decided*, not forgotten.
Both are expected to close with a doc line and no code.

---

## ⚠️ The list above has a hole in it — `CardMenuSheet` (closed 2026-08-04)

**Sixteen files, and none of them covered the one component the design project itself flags
as a real gap.** Its readme names `components/surfaces/CardMenuSheet` as

> *"the one component in this project with no direct counterpart in the app. The repo has the
> shape ad-hoc in a couple of places but no shared component — a real, un-filled gap rather
> than a stale spec."*

Because it never got a task file, none of PRs #486–#491 built it; `grep CardMenuSheet` across
the repo returned nothing. It shipped as **workstream A** (2026-08-04): `components/CardMenuSheet.tsx`,
mounted on all four Home cards, with the menus built in `app/(tabs)/index.tsx` (the rows write
`settings.homeCardOrder` and flip the reorder mode, which no preview card can reach).

The lesson worth keeping is about *how this list was produced*, not about the component: it was
derived by diffing the design project against `main`, so it could only ever find things that
exist on **both** sides in different form. A component present in the design and **absent** from
the app has no diff to show up in. If this comparison is ever re-run, walk the design project's
own component manifest as a checklist as well as diffing.

**14–16 come from maintainer notes on 2026-08-04, not from the design project.** They are
independent of 01–13 and can be pulled forward if they matter more — **15 and 16 probably
should be.** They are about how the app *feels* rather than how it compares to a reference,
and 16 in particular ("things lack a border", "I want things to feel pressable, hard, solid")
is a material direction that touches more surfaces than anything in 01–13.

Two scope splits to know before starting any of them:
- **07 owns card edges. 16 owns buttons, icon buttons, chips and the FAB.** Don't do the same
  work twice, and don't let 16 add per-row borders — that is task 10's option (b).
- **06 now carries a named colour complaint** (habits' `#1F7A2E`, and Recurring's section hue).
  That is the concrete part of 06; the abstract 4-hue-vs-9-hue question is secondary to it.
  **Both halves are now CLOSED** — Recurring was fixed on 2026-08-04 and habits shipped as
  `#218432` the same day, after the maintainer overruled that task's decline. See 06's Outcome
  block; don't re-derive either.

---

## Read this before starting any of them

Every task file assumes these. They are not repeated in full per file.

**Don't re-derive the dependency map.** Every `.ts`/`.tsx` opens with a JSDoc header listing
its imports, callers and data. Read the header of the files the task names; do not grep the
repo to rebuild what the header already states. If a header is wrong, fix it in the same edit.

**Don't re-fetch the design project unless the task says to.** Each file below already
quotes the relevant design source inline. `DesignSync` calls cost a round trip; the task
files exist so you don't need them. Where a task genuinely needs a file from the project,
it names the exact path so you can `get_file` once.

**Don't read `AGENTS.md` end to end.** It is ~13.5 KB and auto-loads via `CLAUDE.md`. The
task file names the specific sections that matter.

**Verification, in order of cost:**
1. `npx tsc --noEmit` — always. Catches broken imports, type errors, and missing i18n keys
   (`no: typeof en` makes key parity a compile error).
2. `scripts/test-changed.sh` — only for behavioural changes. A pure style/move/header edit
   gets step 1 only. Report which suites ran, not "all green".
3. `npm run preview` — only when the task says the change needs to be *seen*. It builds Expo
   Web and drives it with Playwright into `preview-shots/`. Slow (~2–4 min); don't run it for
   a colour constant.
4. `npm run wraps -- --lang=no --width=360` — only when a task changes a row's horizontal
   content. Norwegian at 360px is the worst case and finds ~7x more near-misses than English.

**Design rules that gate a merge:** `DESIGN_RULES.md` has 25 numbered invariants; three are
CI-enforced — tap targets/motion tokens (`lib/__tests__/designTokens.test.ts`), palette
contrast (`colors.test.ts`), copy tone (`copyTone.test.ts`). Never a bare `44`, `hitSlop: 8`
or `duration: 220` — use `MIN_TAP_TARGET`/`HitSlop` (`constants/theme.ts`) and `Duration.*`
(`constants/motion.ts`). Eight of the 25 rules have open conflicts with shipped decisions and
are **not** binding — check `DESIGN_RULES_AUDIT.md` before "fixing" one.

**Nothing in this folder touches the AI setup guide.** Every task here is presentational.
Do **not** bump `AI_SETUP_SCHEMA_VERSION` in any of them.

**Nothing in this folder needs a native build.** All of it is JS/UI, so it ships over OTA.
No `runtimeVersion` bump, no EAS build trigger.

**Finish the way every change finishes:** commit on the `claude/**` branch, open a PR into
`main`, **merge it yourself**. OTA (`update.yml`) fires only on push to `main` — a branch
push publishes nothing to users.

---

## Free fix, whoever gets there first

`components/Motif.tsx`'s `Used by →` line claims `components/EnergyMeter.tsx (halo-ring)`.
EnergyMeter does not import Motif; the real `halo-ring` caller is
`components/TourSpotlight.tsx:211`. One-line header correction — fold it into whichever of
01–05 you run first.

---

## Later additions (not part of the 01–18 dependency order)

**19 — The card surface reset (2026-08-25).** Not a design-project comparison: a response to
*"Todays look is messy, clouded, and looks like 10 steps back in design."* Ships a **live,
operable per-screen prototype** (`19-card-surface-reset.html`) rather than a diff, on the
maintainer's instruction to *"show me a mockup per screen I can test before we implement."*
Read `19-card-surface-reset.md` for the four decisions — two of which **reverse shipped
rulings** (the ⤢ returns, 2026-08-22; rows are boxed, 2026-08-15) — and for the measured cost
of each. Nothing under `app/`, `components/`, `lib/`, `store/` or `constants/` has been
touched yet; implementation waits on a device test.

**19-IMPLEMENTATION.md — the handoff.** Approved 2026-08-25. Ordered phases with the exact files,
the tests that must be *updated* rather than merely passed, and the traps (the `surface`/
`surfaceGlass` derived pair, `collected` missing from the live-sync whitelist, the composer
focus-steal guard). Start there, not here.

**20 — The corrected screens (2026-08-27).** Three mockups on top of #638:
`20-corrected-screens.html` (the five tabs, and the one that wins where they disagree),
`20-card-editor-system.html` (round 19's **phase 7**) and `20-glass-card-system.html` (round
19's **phase 8**). Start at **`20-IMPLEMENTATION.md`**; `20-MEASUREMENTS.md` is the evidence
behind every number in it.

Four reversals were ruled on: a **resting gap returns** (overturning 2026-08-19/20's "no
gaps" — spent on `contentPad` only, so the scroll seam is untouched), the header cluster goes
**chevron-first**, the **italic 💡 hint line comes back** (overturning 2026-08-17), and header
buttons draw **29/32px** with the 48px reach kept.

⚠️ Three things in the mockups are **defects, not design**: chrome translucent enough that
content reads through it while scrolling (regresses 2026-08-18), a peek line that truncates
7 of 8 times *in English*, and a Manage cards sheet whose light-mode text inherits the dark
page's colour at ≈1.2:1. ⚠️ And the per-tab backdrop wash **cannot ship at the drawn strength**:
it lifts the card ground enough to fail AA for three of the five identity hues and cuts the
ladder from five rungs to three. That decision gates phase 2.
