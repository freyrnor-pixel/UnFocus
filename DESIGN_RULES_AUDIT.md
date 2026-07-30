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
| 7 | Order by what's needed first | **OPEN** |
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
| 18 | Visible focus state | **OPEN** (needs device) |
| 19 | Confirm destructive, undo everything else | PASS |
| 20 | Respect reduce-motion | **FIXED** |
| 21 | Motion means something, ≤200ms | **FIXED** |
| 22 | Plain, short, second person | PASS |
| 23 | No guilt, urgency, judgment | PASS (+ **CONFLICT #7**) |
| 24 | An action keeps its name | PASS |
| 25 | Empty/error states give direction | PASS |

---

## FIXED in this pass

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
- `MIN_TAP_TARGET = 44`
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

### Rule 7 — content is ordered by category, not by need (To-do tab)

On `app/(tabs)/plans.tsx`'s **Today** tab, the **Whenever** card (the no-date backlog —
by definition the least time-sensitive thing on the screen) renders *above* the day's own
content. In the preview walkthrough it occupies the top third of the screen showing
"Whenever 0 / Nothing here yet", pushing today's actual list below it. Rule 7's example is
literally "today → next action → everything else".

Not fixed here because it's a section-order change to a tab the user reads daily, and it
interacts with the `Now and next` / `One thing at a time` layouts, which already reorder
this surface. Worth doing deliberately, not as a drive-by in a tokens pass.

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

---

## CONFLICTS — flagged, code unchanged, awaiting your ruling

Full table in `DESIGN_RULES.md` § *Open conflicts*. Summarised with what a ruling would cost:

| # | The disagreement | If the rule wins | If the code wins |
|---|---|---|---|
| **1** | Scale is 4/8/**12**/16/24/32 vs shipped 4/8/16/24/32/**48** | Adding 12 makes every existing `Spacing.md` ambiguous; removing 48 touches 3 call sites | Amend rule 1 to name the shipped set. Cheapest option, and the test already enforces "multiple of 4" |
| **2** | "No arbitrary values" vs 76 sub-token literals in `components/*.tsx` | A 44-file mechanical pass with real visual risk — these are 1–6px optical corrections, not a rival scale | Add a sentence permitting sub-token optical nudges, and cap them (say ≤6px) |
| **3** | Max 3 type sizes vs `FontSize` (7) + `Type` (8 roles) + `HEADER_TITLE_BASE_SIZE` | Finishing the `FontSize`→`Type` migration *and* collapsing `Type` to 3 roles — a large, app-wide retypesetting | Reword as "max 3 per screen" (which the app may already satisfy) and finish the migration separately |
| **4** | Max 2 font weights vs 4 in real use (semibold 168×, bold 140×, medium 42×, regular 21×) | Remapping ~370 call sites | Rule 16 becomes "max 2 per screen" |
| **5** | One accent vs 1 + 9 `feat` + 9 `card` hues, `screenColor.ts` and `domainColor.ts` deliberately allowed to disagree on one screen | Deleting the identity-hue system — this is a core part of how the app reads | Carve out identity hues explicitly; they're wayfinding, not action colour. The contrast test already holds them to 3:1 ink |
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

| Doc | Claims | Actual |
|---|---|---|
| `SPACING_LAYOUT_LIBRARY.md` | `Radius.sm` 10, `md` 18, `lg` 26 | 12 / 16 / 24 |
| `COLOR_THEME_LIBRARY.md` | 6 colour themes; `theme.orange`, `theme.cream` | `ThemeName = 'default'`; tokens are `accent`, `bg`, `surface` |
| `TYPOGRAPHY_LIBRARY.md` | 7 sizes / 5 weights as the standard | Accurate, but conflicts with rules 14/16 (see #3/#4) |
| `AGENTS.md` | references `npm run wraps:all` | No such script |
| `DESIGN_SYSTEM_IMPLEMENTATION.md` | already flagged frozen/stale by the index | Still present; flagged for deletion |

This is exactly why `DESIGN_RULES.md` points at `constants/` and at tests rather than
restating numbers. Fixing these is a separate, uncontroversial cleanup — not done here to
keep this pass reviewable.

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
