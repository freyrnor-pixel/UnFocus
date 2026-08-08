# DESIGN_RULES.md — audit

**Date:** 2026-07-30. **Scope:** all 25 rules in `DESIGN_RULES.md`, measured against the
shipped app at commit `232cd74`.

**Method.** Token-layer rules were measured from `constants/theme.ts`, `constants/colors.ts`
and `constants/motion.ts` plus a source scan of `components/` and `app/`. Contrast was
computed with the repo's own `contrastRatio()`/`contrastOn()`. Screen-level rules were
checked against `npm run preview` (Playwright walks onboarding + all 5 tabs) and
`npm run wraps -- --lang=no --width=360`. Rules needing a device — gesture feel, real focus
rings, native shadow rendering — are marked as such rather than guessed at.

**Verdicts:** **PASS** · **FIXED** (broken, repaired in this pass) · **OPEN** (real gap, not
yet fixed, no conflict blocking it) · **CONFLICT** (contradicts a deliberate shipped
decision — flagged, code deliberately unchanged, needs a maintainer ruling).

---

## Scorecard

| # | Rule | Verdict |
|---|------|---------|
| 1 | Fixed spacing scale | **CONFLICT #1 + #2** |
| 2 | ≥16px card padding | PASS |
| 3 | ≥12px sibling gap / ≥24px section gap | PASS |
| 4 | One idea per row | PASS |
| 5 | Whitespace over lines | **CONFLICT #8** |
| 6 | Exactly one primary action per screen | PASS (with one note) |
| 7 | Order by what's needed first | **FIXED** (2026-08-01) |
| 8 | Same element, same position | PASS |
| 9 | Nothing jumps after load | **CONFLICT #8** |
| 10 | AA contrast | **FIXED** |
| 11 | Never colour alone | PASS |
| 12 | One accent colour | **CONFLICT #5** |
| 13 | Low-saturation backgrounds | PASS |
| 14 | Max 3 type sizes | **CONFLICT #3** |
| 15 | One focal point | **OPEN** |
| 16 | Max 2 font weights | **CONFLICT #4** |
| 17 | ≥44×44 targets | **FIXED** (+ **CONFLICT #6**) |
| 18 | Visible focus state | **OPEN** (needs device) — one real violation found + fixed 2026-08-05, see below |
| 19 | Confirm destructive, undo everything else | PASS |
| 20 | Respect reduce-motion | **FIXED** |
| 21 | Motion means something, ≤200ms | **FIXED** |
| 22 | Plain, short, second person | PASS |
| 23 | No guilt, urgency, judgment | PASS (+ **CONFLICT #7**) |
| 24 | An action keeps its name | PASS |
| 25 | Empty/error states give direction | PASS |

---

## FIXED in this pass

### Rule 7 — content ordered by category, not by need (To-do tab) — fixed 2026-08-01

Was OPEN in the 2026-07-30 pass: on `app/(tabs)/plans.tsx`, the **Whenever** card (the no-date
backlog — by definition the least time-sensitive thing on the screen) rendered *above* the day's
own content on **Today** and above the weekday groups on **This week**. In the preview
walkthrough it took the top third of the screen showing "Whenever 0 / Nothing here yet", pushing
today's actual list below it, on a tab whose name is Today. Rule 7's example is literally
"today → next action → everything else".

Fixed deliberately, as its own change rather than a drive-by:

- **Today** and **This week** now render their own content first; Whenever follows as a
  **collapsed drawer** (header + count visible, body behind a chevron, default closed).
- The drawer is the *same* mechanism as the neighbouring "Done (n)" zone — `PressableScale` +
  `SectionRail` + `AnimatedChevron` + `components/Collapsible`, wrapped in a `Surface` shell that
  matches `SectionCard`'s box — so both fold-aways read as one pattern (local `CollapsedSection`
  in `plans.tsx`).
- **All tasks is unchanged**: Whenever stays expanded at the top there, where it is a real
  section of the content rather than an interruption.
- The `Now and next` / `One thing at a time` interaction the original entry worried about is
  intact: `focusFirst` still drops the Whenever section from Today entirely (that predates this
  change), and `focusMode` still truncates the drawer's rows exactly as before.
- Presentation only: nothing was filtered or rescheduled, and every row in the drawer keeps its
  reminders and its place in the section count. Its ids left `visibleTaskIds` for the same reason
  finished rows are excluded — a permanently-collapsed row can't be a difference between two
  layouts, and glowing one nobody can see would be worse than not glowing it.

The related **rule 15** note below ("Whenever 0" rendered at heading size while empty) is reduced
by the same change — the heading is still heading-sized, but it is no longer the first thing on
the tab and no longer occupies a screenful with nothing in it.

### Rule 10 — contrast: the semantic trio failed AA as text

`good`, `bad` and `warn` are used as **small text**, not only as fills —
`MedicineTrayCard`'s "Taken at 08:15", `ShoppingRow`'s in-stock meta, `WeekListCard`'s
section label. Measured against `bg` (the harder of the two backgrounds), light mode:

| Token | Was | Ratio | Now | Ratio |
|---|---|---|---|---|
| `good` | `#1FA974` | **2.69:1** — failed even the 3:1 non-text floor | `#177E56` | 4.53:1 |
| `bad` | `#EF4444` | 3.37:1 | `#CA3939` | 4.53:1 |
| `warn` | `#BF7A1C` | 3.13:1 | `#9A6217` | 4.55:1 |

Each was darkened along its own hue until it cleared 4.5:1 — same approach as the
2026-07-24 pass that raised `border` to clear 1.4.11. Dark mode already measured 7–10:1 and
is untouched. `constants/colors.ts` only; no component changed.

`lib/__tests__/colors.test.ts` grew from 4 contrast assertions to a palette-wide sweep (72
tests): the semantic trio as text, `border` as non-text, all five soft-background/ink pairs,
`accentInk` on `accent`, and `contrastOn()` ink on all 18 `feat`/`card` identity hues.

### Rule 17 — tap targets: no token existed at all

There was no minimum-target constant anywhere. `44` was hardcoded in 19 files and `hitSlop`
carried **eight different bare numbers** (8×51, 6×24, 13×7, 4×4, 12×4, 16×2, 10, 2).

Added to `constants/theme.ts`:
- `MIN_TAP_TARGET = 44` — **now 48** (2026-08-08, Material Design 3, on the maintainer's
  instruction; it clears WCAG 2.2's 44 with margin). Every `HitSlop` value rose by 2px with it
  so each token still lifts exactly the control size its label promises, and
  `RowTrailing.actionSlop`'s vertical went 8→10 because 28 + 16 was exactly 44. The rest of
  this section is the original 2026-07-31 pass and reads 44 throughout — treat those as the
  history, not the current number.
- `hitSlopFor(visualSize)` — computes the slop needed to *reach* 44. This is the one that
  matters: a guessed `hitSlop={6}` on a 22px check yields 34px, which passes review by
  looking like a token and still fails WCAG.
- `HitSlop.{tight,snug,base,check,loose}` — each labelled with the smallest control it
  actually makes compliant, not just its px value.

Migrated 24 hardcoded `44`s across 16 files and ~100 `hitSlop` props across 36 files.
`IconButton`'s `Math.max(44, size + 8)` — the one place already doing this correctly —
became `Math.max(MIN_TAP_TARGET, size + Spacing.sm)` and is now the documented pattern.
`DatePickerCalendar`'s 40px day cell moved to `hitSlopFor(CELL)`.

Deliberately **not** migrated (coincidental 44s, not targets): `PlanTaskCard`'s `timeBox`
and `hNowMarker`, `scan.tsx`'s `itemPrice` column, `FoodTab`'s `amountInput` width,
`onboarding/guided.tsx`'s decorative `optionBadge`. All four are allowlisted in the test
with a reason.

### Rule 20 — reduce-motion: one real hole

Coverage was better than expected: every component with a raw duration already guarded on
`useAccessibility().reducedMotion`. **`components/FlightOverlay.tsx` did not** — the
item-flies-to-cart animation ran unconditionally, and neither owner
(`app/(tabs)/shopping.tsx`, `app/(tabs)/index.tsx`) gated its own `setFlights()`. Guarded
inside the overlay, since that's the single choke point both callers render through. The
guard still fires `onFlightEnd` so the owner's state cleanup happens and the clone can't leak.

`Badge.tsx` and `IconButton.tsx` import reanimated without a guard but only *receive* an
animated style from `PressableScale` — no violation.

### Rule 21 — motion: 40 raw millisecond literals

Migrated across 20 files to `Duration.*`. Five tokens were added for durations that had no
name: `pressIn` (80 — PressableScale's tester-validated press-in, deliberately distinct from
`PRESS_DURATION`'s 90), `pulse` (600), `hold` (900), `holdOut` (400), `value` (250).

One allowlist entry: `components/ParticleBackground.tsx`'s per-particle 7000–10500ms drifts,
which are scenery data rather than an interaction's timing (and already gated on
reduce-motion plus a user setting).

---

## OPEN — real gaps, nothing blocking them

### Rule 15 — two focal points on Home, one spent on an empty section

- **Home**: the greeting ("Good day!", hero size) and the Energy card (ten saturated
  accent-blue pills in a row) compete. The greeting is the largest type; the Energy meter is
  by far the highest-contrast element. Rule 13 says the highest contrast on a screen goes to
  the one thing you want looked at.
- **To-do**: "Whenever 0" is rendered at heading size + weight while the section is empty —
  emphasis spent on nothing. Same root cause as the rule 7 finding.

### Rule 18 — focus states unverified

`FormControls.tsx` wires `onFocus`/`onBlur` and the app has a `getGlow()` focus halo, but
whether *every* interactive element shows a visible focus state under keyboard/switch
navigation can't be established headlessly — react-native-web's focus model isn't native's.
Needs a device pass with TalkBack/VoiceOver or a hardware keyboard.

**One concrete violation was found and fixed since (2026-08-05) — by eye, not by this audit.**
The app's two composers — `components/PadTypeRow.tsx` (every Home card's type line, the Habits
tab, the To-do timeline, Shopping) and `components/AddRow.tsx` (/plans' Whenever, health-log,
automations) — had **no focus state at all**, and no field either: no border, no fill, no
radius. `PadTypeRow` compounded it by rendering its prompt as a hand-rolled `Text` layer gated
on `!focused`, so tapping the line *removed* the only mark on it. Focused-and-empty was a bare
blinking caret on blank card. The user reported it as "Not visible where user is typing, looks
unnatural"; it went unnoticed here because an audit that reads source and measures static
layout never puts a surface into its focused state.

Both are now bordered fields with an accent focus border, sharing `FormControls.Input`'s shape.
`scripts/preview.mjs` and `scripts/measure-wraps.mjs` each gained a step that *focuses* a
quick-add and captures/measures it, so the state is at least observed from now on.

This does not close the rule: it was one element, found visually. The remaining question —
whether every interactive element shows focus under keyboard/switch navigation — still needs
the device pass.

---

## CONFLICTS — flagged, code unchanged, awaiting your ruling

Full table in `DESIGN_RULES.md` § *Open conflicts*. Summarised with what a ruling would cost:

| # | The disagreement | If the rule wins | If the code wins |
|---|---|---|---|
| **1** | Scale is 4/8/**12**/16/24/32 vs shipped 4/8/16/24/32/**48** | Adding 12 makes every existing `Spacing.md` ambiguous; removing 48 touches 3 call sites | Amend rule 1 to name the shipped set. Cheapest option, and the test already enforces "multiple of 4" |
| **2** | "No arbitrary values" vs 76 sub-token literals in `components/*.tsx` | A 44-file mechanical pass with real visual risk — these are 1–6px optical corrections, not a rival scale | Add a sentence permitting sub-token optical nudges, and cap them (say ≤6px) |
| **3** | Max 3 type sizes vs `FontSize` (7) + `Type` (8 roles) + `HEADER_TITLE_BASE_SIZE` | Finishing the `FontSize`→`Type` migration *and* collapsing `Type` to 3 roles — a large, app-wide retypesetting | Reword as "max 3 per screen" (which the app may already satisfy) and finish the migration separately |
| **4** | Max 2 font weights vs 4 in real use (semibold 168×, bold 140×, medium 42×, regular 21×) | Remapping ~370 call sites | Rule 16 becomes "max 2 per screen" |
| **5** | One accent vs 1 + 4 live `card` domain hues (`lib/domainColor.ts`). *(Corrected 2026-08-04, DESIGN_COMPARISON/06: this row previously also counted 9 `feat` screen hues as a second live, disagreeing system — `lib/screenColor.ts` was actually retired 2026-07-31, addendum A.5, zero production consumers; the `feat*` tokens are dormant, contrast-tested only. That task reaffirmed keeping it retired rather than reviving it for card colour.)* | Deleting the identity-hue system — this is a core part of how the app reads | Carve out identity hues explicitly; they're wayfinding, not action colour. The contrast test already holds them to 3:1 ink |
| **6** | Every target ≥44 vs `PAD_ROW_HEIGHT` 38, `Button` `sm` 36, FormControls' 40px rows | Undoing your own 2026-07-30 "lines can be compressed" request | Note the exception and require compensating `hitSlop` — which `hitSlopFor()` now makes a one-liner |
| **7** | Never "!" vs 13 celebratory strings ("Nice work!", "Bra jobbet!") | Rewriting warm confirmations into flat ones, in an app whose whole point is not being punitive | Narrow rule 23's "!" clause to urgency/guilt only. **Recommended** — the clause is a proxy for the real rule, and here it fires on the opposite of the target |
| **8** | Whitespace over lines / nothing jumps vs the notepad pass's full-width rules, first-visit hint auto-expand, `NewSinceGlow` | Undoing the 2026-07-30 "look like notepads" work and the teaching layer | Carve out ruled-sheet surfaces (rule 5) and first-visit teaching (rule 9). The glow already only fires on an explicit user action |

My read: **#7 and #5 should go the code's way** (the rules are proxies that misfire here),
**#1 is a cheap doc fix**, and **#3/#4 are worth rewording to "per screen"**, which is what
rules 14 and 16 actually say in their own text — the app-wide reading is the stricter one and
probably not what was meant.

---

## PASS — with evidence

- **Rules 2, 3** — `Spacing.md` (16) is the standard card padding, `PAD_GUTTER` the single
  notepad inset; sibling gaps read consistently in the preview shots.
- **Rule 8** — header icons are right-anchored, so ⓘ and ⚙ land at identical x on Home and
  To-do even though To-do carries an extra layout icon. Verified in the preview shots and
  by `getHeaderMetrics` producing identical title boxes on a site vs sub screen (24px/35px
  line box on both).
- **Rule 11** — status is never colour-only: the done treatment is strikethrough **and**
  fade (`DONE_ROW_OPACITY`), medicine trays carry text state ("still due"), tabs pair the
  pill with a label.
- **Rule 19** — 107 `showAppModal` call sites, only 2 raw `Alert.alert`; confirm bodies
  consistently say "This cannot be undone."; `ConfirmationBanner` provides undo across 8
  surfaces.
- **Rules 22–25** — the copy scan found **zero** guilt/urgency hits across both languages
  for 16 banned patterns (EN: missed/overdue/forgot/should have/behind/too late/hurry;
  NO: glem*/gikk glipp/forsinket/for sent/du burde/haster/mislyktes). This isn't luck —
  `AGENTS.md` records the "still due, never missed" precedent, habits have no negative kind,
  and goal strength floors at neutral. Rule 23 was already the app's practice; it just had
  no written home or test.
- **Layout robustness** — `npm run wraps --lang=no --width=360` (the worst realistic case)
  reports **0 wrapped control rows** and only 2 near-miss wraps, both ≤24px. The 2 truncations
  are the documented BottomNav `adjustsFontSizeToFit` false positive.

---

## Stale docs found along the way

Not part of the rules, but discovered while deciding where to point them — several
`*_LIBRARY.md` files have drifted from `constants/`:

| Doc | Claims | Actual | Status |
|---|---|---|---|
| `SPACING_LAYOUT_LIBRARY.md` | `Radius.sm` 10, `md` 18, `lg` 26 | 12 / 16 / 24 | **Fixed 2026-08-01** |
| `COLOR_THEME_LIBRARY.md` | 6 colour themes; `theme.orange`, `theme.cream` | `ThemeName = 'default'`; tokens are `accent`, `bg`, `surface` | **Rewritten 2026-08-01** (STALE_CODE_AUDIT.md) |
| `TYPOGRAPHY_LIBRARY.md` | 7 sizes / 5 weights as the standard | Accurate, but conflicts with rules 14/16 (see #3/#4) | Open — not a factual error, a rule conflict |
| ~~`AGENTS.md` references `npm run wraps:all`~~ | — | This row was itself stale: current `AGENTS.md` only references `npm run wraps` | **Removed 2026-08-01** — no longer true |
| `DESIGN_SYSTEM_IMPLEMENTATION.md` | already flagged frozen/stale by the index | Was still present 5+ weeks after being flagged | **Deleted 2026-08-01** (STALE_CODE_AUDIT.md) |

This is exactly why `DESIGN_RULES.md` points at `constants/` and at tests rather than
restating numbers.

**The five-library follow-up — done 2026-08-01** (full detail: STALE_CODE_AUDIT.md §5.8).
The flagged count (62 occurrences of `theme.white`/`cream`/`orange`/`gray`) turned out to
understate it: counting every `theme.*` access in those five files gives **88 dead of 102**,
because `theme.textLight`, `theme.green`, `theme.danger`, `theme.dangerLight`, `theme.blue`
and `theme.blueTint` are equally gone and weren't in the original grep. The pass also found
three things a token swap would have preserved: two components documented in full that have
**never existed in this repo** (`Avatar`, `SwatchPicker`), and two `constants/theme.ts`
exports cited as the way to colour icons that likewise don't exist (`FeatureColors`,
`THEME_ICONS`).

Outcome — **2 deleted, 3 reconciled**:
- `CARD_CONTAINER_LIBRARY.md` and `SHADOW_ELEVATION_LIBRARY.md` **deleted**. Not a token
  problem: their *pattern* is the anti-pattern. Both teach hand-rolling a card from
  `backgroundColor` + `...Shadow.card` + a raw `Radius`, which is precisely what `<Surface>`
  exists to stop. Renaming their tokens would have produced ~960 lines of plausible-looking
  wrong guidance and removed the ⚠️ banners currently warning readers off. Both had already
  been independently judged stale by two earlier sessions (PROGRESS_LOG.md:1391 records one
  of them consulting `Surface.tsx`'s docstring instead).
- `BUTTON_LIBRARY.md`, `ICON_LIBRARY.md`, `FORM_PATTERNS_LIBRARY.md` **fixed in place** —
  their subject matter is real and their component APIs check out against source.

(`PROGRESS_LOG.md` and `REBUILD_DECISIONS.md` also contain many of these names, but
correctly so — they're dated history describing what was true at the time and should not be
rewritten.)

---

## What now guards this in CI

`.github/workflows/ci.yml` already runs `typecheck` + `lint` + `test:coverage` on every PR
into `main`, and `jest.config.js` picks up `lib/__tests__/**`, so no workflow change was
needed.

| Test | Guards | Count |
|---|---|---|
| `lib/__tests__/colors.test.ts` | rule 10 — palette-wide contrast, both modes | 72 |
| `lib/__tests__/designTokens.test.ts` | rules 1/17/21 — token shape, **plus a source scan** failing on any bare `44`, `hitSlop={n}` or `duration: n` in `components/`+`app/` | 21 |
| `lib/__tests__/copyTone.test.ts` | rule 23 — 16 banned patterns over both languages + an `!` ratchet | 19 |

All three were verified by deliberately breaking them: injecting `'You missed 3 tasks
yesterday!'`, setting `MIN_TAP_TARGET = 40`, restoring a bare `minHeight: 44`, and reverting
`good` to `#1FA974` each produced the expected failure, and each reverted clean.

The two allowlists (`designTokens`'s literal exemptions, `copyTone`'s 13 `!` strings) are
**ratchets in the sense of `jest.config.js`'s coverage thresholds: they may shrink, never
grow.** Adding an entry means writing down why it isn't a violation.

---

## Design-project comparison — divergences deliberately NOT ported (2026-08-04)

**Scope.** The "UnFocus Design System" Claude Design project
(`ec3299ab-36de-4990-9d47-c1a3e7a0b321`) was compared against `main` on 2026-08-04; the
review is split per task under `DESIGN_COMPARISON/`. Its tokens are already in sync — the
project's `tokens/*.css` were regenerated *from* `constants/colors.ts`/`constants/theme.ts`
and match value for value, so **no session should ever "port a colour" or "port a spacing
token" from it.** The divergence is entirely in where the shared tokens get applied.

This section exists so the items below stop costing a session's attention. Several parts of
that project are not proposals at all — they are **recreations of this app's own superseded
states**, and a later session opening the project will otherwise rediscover them and
re-propose them as design direction. They are not.

| Design-project artefact | What it shows | Verdict |
|---|---|---|
| `TasksScreen.jsx` `TaskRow` | Check on the **left**, two separate trailing action icons | **Do not port** |
| `EnergyMeter.jsx` `Pip` | A flash glyph inside **every** pip, filled and hollow alike | **Do not port** |
| `HomeScreen.jsx` `DayRail` | Fixed 56px time column, 20px minimum connector, simple sorted list | **Do not port** |
| `screen-bg-{calm,grow,list}` | Per-screen-type backdrops + an edge-continuity rule | **Declined** |
| `natural-tree.card.html` bindings | Stage advances on habit streak / Energy fullness / focus session | **Declined** |
| `HomeScreen.jsx` cards | Colours every card from the 9-hue `--c-feat-*` set | **Declined** (kept the 4-hue `--c-card-*` system, option (a)) |
| `natural-tree.card.html` leaf iconography | Leaf as row-leading bullet, card-corner accent, and icon-button glyph | **Partially adopted** — corner accent only (option (b)), landed differently from the design's literal example |

**1. Check position and trailing icons** (`DESIGN_COMPARISON/12`). The design's left-check +
dual-trailing-icon row is this app's **pre-2026-07-30** state. The check moved to the right
margin app-wide in that pass (maintainer's call), and the assorted per-surface trailing
trash/send/put-back buttons collapsed into ONE row-level ⋯ action —
`[leading?] title → ONE meta line → ONE right-hand value → [⋯ action] → [○ check]`. Reverting
is not a style choice: full-width notepad rules exist *because* there is no leading check
column to inset past, and `ShoppingRow`'s `ROW_DIVIDER_INSET` was deleted in the same pass.
A left check means re-introducing the inset or living with rules running under the checkboxes.

**2. Energy pips** (`DESIGN_COMPARISON/13`). `components/EnergyMeter.tsx`'s header says
outright: don't reinstate the flash-icon. The 2026-07-31 rework exists because ten saturated
pips and "10 / 10" **read as a score**, which is the one thing Energy must not be; putting a
glyph back inside ten saturated pips walks straight into that. There is also an arithmetic
floor — the pip shrank to `PIP_SIZE` (18) because at the audited 360px worst case, ten pips +
the value at the `large` font scale + the edit glyph + gaps came to ≈318px of 328px available.
The pip row clips rather than overflows, so that failure is invisible in a casual screenshot.

Worth recording that the two **agree on four of five points**, so nothing else here is a gap:
surplus pips (soft accent fill, accent outline, capped at 4 both sides), the boost chip
(deliberately *neutral* on both sides — borrowed energy is a footnote about today, not a
reward), the permanent italic hint under a hairline rule, and "not a card" (no background, no
shadow, no padding). Only the flash glyph diverges, and it diverges on purpose.

Also: `EnergyMeter`'s **StarterCard tutorial state** (2026-08-03, gate
`!hasEnergyItems && !hasSetCapacity` **and** all three source stores `loaded`) has no
equivalent in the design project. It is not an unexplained extra — a full ten-pip bar with
nothing able to spend it is the "reads as a score" problem at its worst, on the first screen a
new user sees. Do not remove it as an inconsistency with the reference.

**3. The day rail.** The app's day view is `lib/dayGrid.ts`'s **elastic** axis with a live
now-line, log-curve gap compression, and a deliberate split: ahead of now is the timeline with
real durations and visible gaps; behind now the day collapses flush. "A gap ahead of you is
room; the identical gap behind you is an accusation." The design's rail has no now-line and no
collapse — it is much simpler *and* much less capable.

**4. Per-screen backdrops** (`DESIGN_COMPARISON/05`). Declined; full reasoning in
`components/ScreenBackground.tsx`'s header. Short version: PR #449 was reverted for a MOTION
reason, not an art reason, and the design's edge-continuity rule does not address motion. A
nicer picture on the same mechanism re-runs a known failure. `screen-bg-strip`/`screen-bg-calm`
remain in `constants/motifs.ts` as **retained source art** — generated and tested, mounted
nowhere, deliberately.

**5. Tree stage bindings** (`DESIGN_COMPARISON/03`). Declined, and this one was already
decided independently: `assets/decorative/illustrations/README.md` records the maintainer's
2026-08-04 call that the art was taken and the bindings were not. Binding a stage tree to
habit streaks, Energy `current / capacity`, or a focus session all contradict `lib/growth.ts`
— growth in this app is numberless, backdrop-only, and must never read as a reward firing off
a tap. (The focus-session binding is doubly out: there is no focus-session feature to bind to.)
What WAS adopted is the art's own governing rule, **"floor at seed, never bare"**, now live in
`components/StarterCard.tsx` — the bare `empty-branch` watermark became `tree-natural-seed`,
so the app's one "nothing here yet" mark reads as potential rather than absence.

The fourth growth stage (`tree-natural-full-*`) is still missing and is **not** blocking
anything now that no binding consumes it — see that README for why it cannot be fetched from
a remote session, and why authoring a substitute is the wrong move.

**6. Boxed rows** (`DESIGN_COMPARISON/10`). ~~The design boxes every row (border + fill + gap);
the app rules them flush on one sheet. Declined — boxed rows are cards inside a card, which is
the exact complaint PR #483 fixed one day earlier, and `PadSheet`/`PadRow` exist because of a
direct user report ("look like notepads", "related cards/things in other screens should look
practically the same"). Recorded in `components/PadSheet.tsx`'s header.~~

**⛔ REVERSED — the decline did not survive the day (noted 2026-08-08).** The maintainer's
card-design reset later on 2026-08-05 adopted boxing after all: the notepad rules are deleted
and `components/PadSheet.tsx:113-128` draws one 1.25px, `Radius.sm` bordered box per row in the
screen's own hue at the FIELD rung, separated by a `Spacing.xs` gap. `DESIGN_RULES.md` rule 5
("whitespace over lines") was overruled in the same pass. **See item 12 below, which carries
the same reversal.** The `theme.border → theme.rule` divider fix item 12 records was real and
shipped, but the divider it fixed no longer exists.

**7. Which colour system colours a card** (`DESIGN_COMPARISON/06`, 2026-08-04 — gates tasks
07/08/09/11). The design's `HomeScreen.jsx` colours every card from the 9-hue `--c-feat-*` set;
the app colours cards from the 4-hue `--c-card-*` set (`lib/domainColor.ts`). **Decision: keep
the 4-hue system everywhere (option (a)), zero visible change from the top-level choice.**

Declined (b)/(c) — moving cards fully or partly onto `feat*` — for a reason the task file's own
framing (written against `tokens/colors.css`, which mirrors the palette values, not which
systems are actually wired up) didn't have: `lib/screenColor.ts`, the module that used to route
`feat*` hues to screens, was already **fully retired 2026-07-31 (addendum A.5)**, four days
before this task ran. Every consumer — `ScreenColorContext`, `ScreenScaffold`'s `screenColor`
prop, `app/scan.tsx`, `app/(tabs)/shopping.tsx`, `components/NoteRow.tsx`, `app/(tabs)/habits.tsx`
— was migrated off it; `grep -rn "\.feat[A-Z]"` over `app/`+`components/` returns nothing.
`screenColor.ts`'s own header states why: "That collided with the per-card identity hues...
two different systems were competing for the same 2.5px bevel. The screen-hue term lost."
Reviving it for (b)/(c) means relitigating that retirement, which is a bigger and more
consequential call than an S-sized task should make alone — so it stayed declined. (This also
means `DESIGN_RULES.md`/`DESIGN_RULES_AUDIT.md`'s Open conflict #5, which described
`screenColor.ts` and `domainColor.ts` as two live systems "deliberately allowed to disagree,"
was itself stale by four days; corrected in the same edit as this note.)

Declined (d) — a Notes identity hue — because `cardNote: IDENTITY_NEUTRAL` is A.3's deliberate
"four things a person actually thinks of as a separate part of their life," not an oversight;
adding a fifth hue for Notes reopens that the same way (b)/(c) reopen A.5, and it wasn't what
the maintainer actually flagged today (see below).

**The maintainer's named complaint** ("the current color scheme is not pleasing, like the one
for recurring and habits," 2026-08-04) got two different-sized answers:
- **Habits** (`IDENTITY_HUES.habits`) — **FIXED. `#1F7A2E` → `#218432`, shipped 2026-08-04.**
  It was confirmed here as the outlier (darker/more saturated than `todo`/`health`, L\* 44.81)
  and then **left unchanged**, on the reasoning that it's one of the four mutually-constrained,
  mode-invariant, CI-pinned hues (`lib/__tests__/colors.test.ts` asserts its exact L\*, its
  ΔE2000 from the other three, and Shopping's ≥15 L\* gap from it), so touching it means
  re-deriving and re-pinning those constants for a system every card in the app shares — "out
  of proportion for this task's budget". **That decline was overruled by the maintainer the
  same day: where the design system conflicts with a decision already recorded in this repo's
  docs, the design system wins.** The recorded candidate was applied as-is. The blast radius
  was exactly what the decline predicted and nothing more — one palette value, one test
  constant (`DOCUMENTED_LSTAR.habits` 44.8 → 48.3), and prose.
  Re-verified with `colors.test.ts`'s own inline Lab/CIEDE2000 math (not taken on trust):
  L\* **44.811 → 48.329**, Lab hue angle **141.971° → 142.022°** (a 0.05° shift — it is the
  same green), white badge ink **5.410:1 → 4.761:1** on the fill and **7.021:1 → 6.478:1** on
  the gradient's second stop, ΔE2000 **52.23** vs `todo` / **63.14** vs `health` (≫25), L\* gap
  to Shopping **25.84 → 22.33** (≫15). Every constraint `colors.test.ts` checks still clears.
  **One correction to what was recorded here**: chroma is *not* "unchanged at 57.87" — C\*
  rises **54.381 → 57.875** with the lightness. The claim was wrong about the number and right
  about the effect (it doesn't read washed out). Also worth knowing before lightening it
  further: the white-ink margin on the fill is now 0.26 over AA, so this is as bright as this
  hue goes while `#FFFFFF` stays its declared ink.
  Full derivation: the addendum note above `IDENTITY_NEUTRAL` in `constants/colors.ts`.
- **Recurring** (`app/(tabs)/plans.tsx`'s `repeatingHue`) — **fixed**. It borrows a card-identity
  domain purely for a distinct look (the section has no real identity of its own); that borrow
  was `meal`, which the 2026-07-31 four-hue collapse silently aliased onto `cardShop`'s exact
  gold (`#D9A441`) — so Recurring had been rendering in the literal Shopping-tab colour for four
  days with nobody having chosen that, which reads as arbitrary/muddy rather than as its own
  identity. That's the real defect, not the gold hue itself. Fixed by switching the borrow to
  `health` (`#A84A60`, rose) — the one card-identity hue nothing else on the Plans or Home
  screens already carries, so it doesn't cost another surface its distinctiveness. Zero new
  palette tokens, one file (`app/(tabs)/plans.tsx`, plus its comment in `components/SectionCard.tsx`).

Screenshots were not taken for this task — `npm run preview` is skipped per the task's own
Verify section when no visible hue actually changed under test, and the Recurring fix is
precise enough to verify from source (`getDomainColor(theme, 'health').accent`) and the
contrast numbers above rather than a screenshot. `npx tsc --noEmit` and
`lib/__tests__/colors.test.ts` (unchanged — no palette token was touched) are the verification.

**8. Card edge: gradient identity hue vs flat hairline** (`DESIGN_COMPARISON/07`, 2026-08-04 —
blocks 08). `components/Surface.tsx` draws a card's edge as a beveled `LinearGradient` ring
(light top → true hue mid → dark bottom) keyed to the card's identity hue. The design project
draws a flat, single-colour edge instead — but disagrees with itself on which flat colour:
`ui_kits/unfocus_app/HomeScreen.jsx` uses `border-strong` (`#2B5FD9`, saturated blue) while
`components/surfaces/HabitCard.jsx` uses the neutral `border` (`#7284A2`). "What the design
does" isn't one answer here, so there was never a colour to port — only a shape to choose.

**Decision: keep the beveled gradient edge exactly as-is (option (a)). No code changed.**

This one isn't a fresh call — it's a maintainer decision that already happened, on the record,
twice. `AGENTS.md`'s "row rule + matte buttons" section states outright that a near-identical
proposal from design-system v6 was reviewed and rejected: *"**NOT taken from that spec**:
dropping the accent stripe / category-as-a-dot — the gradient badge, keycap edge and domain
ramp stay (maintainer's call, #390/#393/#410)."* "Domain ramp" is this exact beveled edge.
And `components/CardAccent.tsx`'s header dates the specific reversal this task would be
re-running: the card badge and edge both went through a flatten-then-revert cycle already —
flattened 2026-07-24 ("the complaint was the gradient sticker reading as a separate object"),
then **"re-gradiented" 2026-07-26** in the same pass that widened `Surface.tsx`'s
`EDGE_WIDTH` 1.5→2.5px, because the flat/thin era "had progressively drained identity colour
out of cards." Options (b)/(c)/(d) are all shapes of exactly that flattening, nine days later,
argued from a design reference that contradicts itself on the replacement colour. That isn't
new evidence against a dated, twice-made call — it's the same debate a third time.

The task file's own ⚠️ adds a second, independent reason not to move on (b)/(c) alone: removing
colour from the edge leaves the gradient badge as the sole identity carrier unless 08's stripe
lands in the same change, and 08 has its own unresolved blocker (a stripe alone can't tell
same-hue domains apart — Shopping and Food are both `#D9A441` — so it only rescues (b)'s cost
if 08 *also* solves where the glyph lives, which isn't guaranteed). With real users already on
this build (`AGENTS.md`'s 2026-07-13 banner: a merge to `main` reaches installed apps on next
launch), shipping a visibly quieter card now on the hope some future session finishes the other
half is the wrong trade for an S task to take alone.

(c) — flat 1.5px `borderStrong` — is the task file's own explicit anti-recommendation
(`#2B5FD9` at 1.5px reads as "a loud blue frame around every card on the screen"); not
seriously considered. (d) — keep the hue, drop the light→dark ramp — doesn't cost identity the
way (b)/(c) do, but it still un-does the specific 2026-07-26 "re-gradiented" call above, and it
would put cards out of step with the same beveled-ring technique `Button.tsx`'s rim already
uses via the same `computeRimGradient()` (`constants/theme.ts`) — a card with a flat edge next
to a button with a beveled rim reads as two material languages, not one.

**For 08: land as (c) — no stripe.** Per 08's own interaction table: *"(a) identity gradient
edge kept → Stripe is a third hue expression — likely too much. Lean (c)."* 07 landed (a), so
that row applies directly; 08 doesn't need to re-derive this call, only confirm it still holds.

No screenshots — nothing drew differently, so `npm run preview` has nothing new to show.
Verification is `npx tsc --noEmit` (unchanged) plus reading `Surface.tsx`'s existing
`EDGE_WIDTH`/`edgeHue` chain, which already matches option (a) byte for byte.

**Addendum, 2026-08-05 — superseded by explicit maintainer override.** The maintainer, shown
this exact history (including the #390/#393/#410 precedent and the 2026-07-24→26 flatten/revert
cycle) and asked to confirm before proceeding, chose to override it: drop the light-top/dark-
bottom ramp anyway. This is closer to option (d) above ("keep the hue, drop the ramp") than to
(b)/(c) — the per-card/per-button identity hue is UNCHANGED, `computeRimGradient()` just returns
one flat tone instead of three graded stops. The "two material languages" objection to (d)
(cards flat next to a beveled button rim) doesn't apply here, since Button.tsx's rim uses the
same `computeRimGradient()` function and went flat in the same change — cards and buttons stay
in the same material language, it's just flat now instead of graded. Recorded here rather than
rewriting the entry above, because the original call was reasoned and real; this is a conscious
change of direction, not a discovery that the 2026-08-04 analysis was wrong. See
`computeRimGradient()`'s own header in `constants/theme.ts` for the implementation and the
full reasoning chain.

**9. The 4px left accent stripe** (`DESIGN_COMPARISON/08`, 2026-08-04 — blocked by 06/07).
Every card in the design project (`ui_kits/unfocus_app/HomeScreen.jsx`'s `CardShell`,
`components/surfaces/HabitCard.jsx`) draws a 4px full-height colour bar down the card's left
edge as a flex-row first child, sibling to the content. The app has no equivalent structure.

**Decision: (c) — no stripe. Badge stays the sole identity carrier. No code changed.**

Independently re-derived, not rubber-stamped from item 8's hand-off note — the task file's own
interaction table is unambiguous once 07's outcome is known: *"(a) identity gradient edge kept
→ Stripe is a third hue expression — likely too much. Lean (c)."* 07 landed (a) (item 7 above),
so that row is the one that applies, and it points at (c) on its own without needing 08's other
arguments to carry it.

Those other arguments corroborate rather than merely pad the conclusion. The task file counts
the colour moves a card already carries under 07(a) — gradient badge, hue-gradient bevel edge,
and (from task 09) possibly a coloured count pill — and observes a stripe on top makes four
expressions of one fact, on a screen (`npm run wraps`) already measured tight on horizontal
room; a stripe is also the *most* peripherally-legible of the four, so adding it isn't a neutral
fourth voice, it's arguably the loudest one on a card that doesn't need a loudest one.

The task file also flags its own hard blocker, worth recording here because it rules out (b)
specifically and so removes the one option that could have made a stripe worth its cost: **a
stripe alone cannot distinguish two same-hue domains** — Shopping and Food both render
`#D9A441`. Today that's resolved by `CardAccentBadge`'s per-domain glyph (`CardAccent.tsx`'s
`DOMAIN_ICON`: shop=cart vs meal=restaurant vs budget=wallet, all on the same gold). Dropping
the badge for a stripe (option (b)) would delete the one thing that tells those cards apart
without replacing it, and the task file names this correctly as a blocker, not a nitpick. With
(b) off the table and the interaction table pointing at (c) over (a), (c) is the only outcome
both lines of the task's own reasoning converge on.

`CardAccent.tsx`'s header already reads "expresses it as ONE colour move: a gradient icon
BADGE" — true before this task and still true after, since nothing drew differently. No header
edit needed, unlike the task file's "Close out" instruction, which was written assuming a
stripe shipped.

No screenshots — nothing drew differently, so `npm run preview` has nothing new to show.
Verification is `npx tsc --noEmit` only; no behavioural change, so `scripts/test-changed.sh`
and `npm run wraps` (both listed as "required" in the task file for the case where the stripe
actually lands) don't apply to a decision that adds no code.

**10. The coloured count pill vs the grey summary sentence** (`DESIGN_COMPARISON/09`,
2026-08-04 — blocked by 06, resolves 08's "possibly" hedge). The design project's `CountBadge`
(`ui_kits/unfocus_app/HomeScreen.jsx`) is a small pill beside the card title — 16% accent wash,
**accent-coloured text**. The app instead spends a whole second line under the title, a
`theme.textMuted` sentence ("{left}/{total} left", `components/HomeNotesCard.tsx` and three
siblings).

**Decision: (c) — pill replaces the sentence, as a deletion. Landed on all four Home cards
(`HomeNotesCard.tsx`, `HomeHabitsCard.tsx`, `HomeShoppingCard.tsx`, `PlanTaskCard.tsx`).**

Not a straight port of the design's pill, for a reason the task file's own ⚠️ flagged and
`lib/domainColor.ts` already makes a hard rule, not a taste call: **"AN IDENTITY HUE IS A FILL.
IT IS NEVER TEXT AND NEVER AN ICON COLOUR"** (A.4 rule 1, dated 2026-07-31 — before this task
ran). The design's pill draws the hue as BOTH the wash and the text; Shopping's gold is
2.25:1 on its own soft wash, which fails AA outright, not just "when the hue is light" as the
task file hedged — it fails for the specific hue this app already has. So the pill ships with
the wash only (`domainColor.soft`, an explicitly permitted "fill-shaped derivative" per that
same rule) and the number in **plain `theme.textMuted` ink**, never `domainColor.accent`. This
sidesteps the contrast question entirely rather than computing per-hue overrides.

**Position: a header-row sibling at a fixed slot, not inline after the title text**, despite
the design's "sitting beside the card title." Two independent reasons converged on this, not
one: (1) the task's own "preserve" section says the four cards' counts line up vertically down
the screen, which only survives if the pill sits at the same x on every card — impossible if
it trails variable-length, variable-language title text, but automatic if it's a row sibling
after a `flex: 1` title column; (2) it's exactly the near-miss-wrap case `npm run wraps
--lang=no` exists to catch — a pill racing a long Norwegian title on one line. `Badge.tsx`
gained optional `bg`/`fg`/`borderColor`/`tabularNums` overrides rather than a new component,
per the task file's own steer to check it first.

**Shopping got no second pill.** `HomeShoppingCard.tsx` already had a coloured count badge —
the flight-animation target items fly to when ticked off, `domainColor.soft` fill + plain ink,
independently arrived at the same A.4-compliant shape this task was about to build. Adding a
*second* pill beside the title would have put two domain-hued count chips in one header, which
is more chrome than the sentence it replaced — the opposite of this folder's point. The
sentence's fraction moved INTO that existing badge instead (now "{remaining}/{total}", was a
bare total); only the label changed, so the flight animation's target node is untouched.

**Habits' pill is a third fill on top of a fourth.** `HomeHabitsCard.tsx` already draws the
identity hue as badge + edge + a progress-bar fill (all three permitted "fill-shaped
derivatives" per A.4 rule 1) — the pill is a fourth. Checked against the precedent this could
have collided with: A.4 rule 3 removed a whole-HEADER wash specifically because it repeated
the same idea (*this card is Habits*) a third time with no new information. The pill isn't
that — it's the same fill vocabulary carrying a number (today's remaining count) nothing else
on the card shows, the same distinction that already let the progress bar and the badge
coexist. Recorded in that file's own edit notes so a later pass doesn't "simplify" it back
down by removing one of the four on a miscounted "too much colour" instinct.

`PlanTaskCard.tsx` keeps its progress bar ALWAYS mounted (2026-08-03's "nothing jumps" fix,
unrelated to and unchanged by this task) but the pill itself is safe to gate on
`countableTasks.length > 0` like the other three cards, not forced always-on: it shares the
title's line rather than adding a second one, and `headerTopRow`'s pre-existing `minHeight: 32`
already bounds the row to the same height with or without it — only the row's width moves,
which was never what the "nothing jumps" fix was guarding against.

**No new i18n key.** The pill shows bare `"{left}/{total}"` digits, not the old sentence's
localised word ("left" / "igjen") — a wordless fraction next to a title is the design's own
"holding just the number" framing, and needs no translation. `t.pad.summary` (the sentence
string) is kept, not orphaned: all four cards still call it for the pill's
`accessibilityLabel`, so a screen reader gets the full sentence while sighted users get the
compact digits.

Verification: `npx tsc --noEmit`; `scripts/test-changed.sh` (no jest suite covers these four
presentational cards directly — `copyTone.test.ts` still ran clean since no new/changed
`lib/i18n.ts` string was added); `npm run wraps -- --lang=no --width=360` (the case this task
was flagged as the near-miss risk for).

**11. Leaf iconography — `leaf-icon` / `leaf-sprig` as inline marks** (`DESIGN_COMPARISON/04`,
2026-08-04). `natural-tree.card.html`'s "Practical UI use" section proposes three placements:
a leaf as a list-row leading bullet, `leaf-sprig` as a card-corner accent, and a leaf inside an
icon-only button.

**Decision: option (b) only — a card-corner accent, on `components/HomeHabitsCard.tsx`.**
Options (a) (row-leading bullet) and (c)/icon-button were not built.

Row-leading bullet declined for the reason the task file itself raised: `components/
HabitIcon.tsx`'s `hasChosenHabitIcon()` gate exists specifically because a universal leading
mark next to the row's real trailing check ("`[⋯ action] [○ check]`") was already tried and
reverted as visual noise. A leaf in every row's leading slot is that same shape. The task
file's own narrower version of (a) — a leaf only on habits with no chosen icon, filling the
gap `hasChosenHabitIcon()` leaves blank — was left for a follow-up rather than folded in here:
it touches four separate row-render call sites (`app/(tabs)/habits.tsx`'s card/week/month rows
plus `HomeHabitsCard`'s own), each at a different icon size, and the task file itself flags
that shape of change as needing `npm run wraps -- --lang=no --width=360` — more surface than
this S-sized pass should mix into the same commit as a presentational corner accent.

**The corner accent did not land as literally specified**, for a fact the task file's own
technical table states outright: `leaf-sprig` `pal`s to a fixed blue ramp that `color` cannot
override (`constants/motifs.ts`, `Motif.tsx`'s header), and the task file warns that using it
on a non-blue-family card "will read as a foreign object." `HomeHabitsCard` — the closest
domain match, and the only candidate left once `components/StarterCard.tsx` was ruled out
(task 01 already put `tree-natural-seed` there; two tree/leaf illustrations on one card is the
same "second illustration competing with the tree itself" the task file bans) — carries the
Habits identity hue, `#218432` (`#1F7A2E` until 2026-08-04), green. So `leaf-icon` (tintable,
no `pal`) was used instead, at
a larger size, exactly the substitution the task file itself names as the fallback for a
non-blue surface: *"or use `leaf-icon` at a larger size instead."*

**Not tinted `domainColor.accent` either**, despite the task file's own example doing exactly
that. This audit's item 10 (immediately above) already counts FOUR identity-hue
fill-derivatives stacked on this one card — badge, card edge, progress-bar fill, count pill —
and states the reasoning for why a fifth would be too many: A.4 rule 3 removed a whole-header
wash specifically for repeating "this is Habits" a third time with no new information. A
tinted decorative leaf carries no information at all (unlike the count pill, which does), so
it is exactly the case that reasoning already ruled out. `color={theme.textMuted}` instead —
the same neutral token `components/SectionDivider.tsx`'s `trunk-divider` motif already uses —
at `opacity={0.45}`, tucked top-right and painted BEFORE the header row (so the badge/count
pill, drawn after, stack on top and simply hide it wherever they're opaque; confirmed in the
`npm run preview` screenshot — a small pale-grey leaf silhouette in the card's top-right
corner, gone where the pill would sit, visible above and around it).

Icon-button placement (the design's third example) was not pursued — no existing icon-only
button in this app currently has a leaf-shaped gap to fill the way the corner accent did, and
inventing one wasn't in scope.

Verification: `npx tsc --noEmit`. Presentational only (a `Motif` mount + one style, no gate/
data change), so `scripts/test-changed.sh` and `npm run wraps` were not required by the task
file for this option; `npm run preview` was run per the task's own "needs preview" flag and
confirms the placement in `preview-shots/11-home.png`.

**12. Boxed rows, confirmed and closed** (`DESIGN_COMPARISON/10`, 2026-08-04).

> **⛔ "Closed" lasted one day (noted 2026-08-08).** The card-design reset later on 2026-08-05
> adopted boxing — rows are bordered boxes now and the notepad rules are gone. See item 6's
> reversal note. Everything below is preserved as the reasoning of the day, and two parts of it
> are still live: the **`ShoppingRow`/`MonthlyTableRow` conversion cost** is still unpaid (they
> remain the largest un-migrated rows), and the **`PAD_ROW_HEIGHT` 38 decline** still stands —
> 38 is below `MIN_TAP_TARGET` and hit-slop-compensated on purpose, at the user's own request.
> The `theme.border → theme.rule` divider fix shipped and was correct; the divider it fixed has
> since been deleted, so it is now history rather than current behaviour.

Item 6 above
already recorded the verdict — **option (a), keep ruled, decline boxing** — as part of an
earlier session's broad pass over the comparison folder. This entry is the dedicated task-10
session that actually re-verified that call and shipped the one concrete fix it turned up.

**Boxing was declined for the reasons item 6 already gives** — re-confirmed, not re-litigated:
boxed rows are cards inside a card, the exact shape PR #483 moved Habits away from a day
earlier; adopting it means converting `ShoppingRow`/`MonthlyTableRow` and `TaskCard` in the
*opposite* direction from the in-flight `PadRow` migration at the same time; and `PadSheet`'s
spare lines (inert blank ruled lines that keep a short list reading as a page, not a card that
ran out) have no boxed equivalent — deleting them changes how every short list terminates,
which the design never accounted for. Option (d)'s first candidate (raise `PAD_ROW_HEIGHT`
past 38px) was also declined — the task file's own warning that 38 is already below
`MIN_TAP_TARGET` and hit-slop-compensated made it the more expensive, less reversible move.

**What (d) actually found: a real bug, not a taste call.** `components/PadSheet.tsx` — the
shared ruled-row implementation behind `HomeNotesCard`, `HomeHabitsCard`, `HomeShoppingCard`,
`PlanTaskCard` and the Home habit/note lists — was drawing its notepad divider with
`theme.border` (the ≥3:1 control-boundary token) rather than `theme.rule` (`#D3DBE6`,
1.396:1 on surface, added 2026-07-31 addendum A.1 *specifically* for "decorative row divider
ONLY… deliberately BELOW the 3:1 control-boundary floor"). PadSheet predates `theme.rule` by
one day and was never migrated onto it. `app/(tabs)/habits.tsx`'s own hand-rolled divider (PR
#483, one day later still) already used `theme.rule` correctly, so the app had two different
row-divider strengths side by side — the exact "related cards/things in other screens should
look practically the same" complaint `PadSheet` exists to fix, just moved one level down from
layout into colour. Confirmed visually: `preview-shots/11-home.png` (Home's Habits/To-do
cards, pre-fix) showed a distinctly solid blue-grey line under "Type task"/"Type habit";
post-fix it reads as a faint paper rule, matching Habits' own divider. **Fix: one line in
`PadSheet.tsx`, `theme.border` → `theme.rule` — no new token, no value change, no geometry
change.** Recorded in that file's own header in the same edit.

Verification: `npx tsc --noEmit` clean. `scripts/test-changed.sh` found no related suites
(PadSheet has no dedicated test file; `lib/__tests__/stableLayout.test.ts` source-scans it for
structure, not colour, and was unaffected). `npm run preview` — 0 page/console errors, all
store round-trip assertions `true`; `preview-shots/11-home.png` and `22-home-note-added.png`
re-captured with the fainter rule visible under every Home card's type line and spare lines.
`npm run wraps -- --lang=no --width=360` — unchanged from the known-benign baseline (1 wrapped
control row, the documented `goals-sheet` `starterChips` false positive; the 2 truncated + 2
near-miss findings are `medicine-form`/`tour-step`/`onboarding-privacy`/`energy-config-sheet`,
none of them PadSheet consumers) — expected, since a colour swap changes no width.

**13. Domain-hued check rings — the design was already shipped, and it had a contrast bug**
(`DESIGN_COMPARISON/11`, 2026-08-04). The task file's premise ("the app's checks are neutral")
is **stale**, the same way 12 and 13's were: `components/PadRow.tsx` already took the design's
option **(a)** — every caller passes `domainColor.accent` and the ring was hued in BOTH states.
So there was nothing to port. What the review actually found is that the file's own ⚠️
constraint had already come true in shipped code.

**The bug.** An empty check ring is a control boundary, and WCAG 1.4.11 puts a 3:1 floor on
one. Measured against the light palette (`surface #FFFFFF` / `bg #E2EAF5`), three of the four
identity hues clear it comfortably — todo `#3F52B5` 6.806/5.614, habits `#218432` 4.761/3.927
(`#1F7A2E` 5.410/4.463 when this was measured; the 2026-08-04 lightening kept it clear of the
3:1 floor), health `#A84A60` 5.507/4.542 — but shopping/meal `#D9A441` measures
**2.249:1 / 1.855:1**. It
therefore looked fine on every surface except the app's highest-volume checkbox surface. The
ticked state carried the same failure one layer in: the glyph used `theme.accentInk`, which is
the ink for `theme.accent` (the app accent), not for the domain fill under it — white on gold
is that same 2.249:1.

**Fix: option (c), the task file's own recommendation.** Empty ring → `theme.border`
(3.792/3.128, the token contrast-tuned for exactly this job). Ticked → the domain hue arrives
as a FILL, which is what A.4 rule 1 says an identity hue is for, with the glyph on
`contrastOn(accent)` — the same derivation `lib/domainColor.ts` uses for its own `ink`, so the
checkmark now inherits `colors.test.ts`'s ≥3:1 assertion instead of sitting outside it. You get
the colour at the moment it means something and lose ten coloured empty rings competing with
row text on a full list. No token added, no hue changed, no geometry changed.

**Scope: `PadRow` only, and the app is deliberately left with two check systems** — stated
plainly here because the task file warns "a half-hued app is worse than a neutral one." This
edit covers the four Home cards, `app/(tabs)/habits.tsx`'s `HabitCard` and
`components/NoteRow.tsx`. It does NOT cover `components/ShoppingRow.tsx` or
`components/TaskCard.tsx`, and those were left alone on purpose: they don't use a domain hue at
all, they use `theme.good` with `contrastOn(theme.good)` — a *status* colour, already
contrast-correct, and a different idea from identity. Unifying status-green and identity-hue
checks is a real design call about what a tick MEANS, not a colour swap, and it belongs in its
own task rather than being smuggled into an XS contrast fix.

Verification: `npx tsc --noEmit` clean; `lib/__tests__/designTokens.test.ts` +
`lib/__tests__/colors.test.ts` — 2 suites, 130 tests, all passing (the two the task file names);
`npm run preview` — 0 page errors, 0 console errors, all store round-trip assertions true, and
`preview-shots/11-home.png` confirms the empty rings now read as neutral. Contrast figures above
were computed directly from the WCAG relative-luminance formula against the shipped tokens.
