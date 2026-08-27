# 20 — Implementation handoff: the corrected screens

**Read this before writing any code.** It is the plan for turning three approved mockups into
the real app. Where this doc and a mockup disagree, **the mockup wins** — it is what the
maintainer looked at and said yes to. Where two mockups disagree,
**`20-corrected-screens.html` wins**; it is the latest and the maintainer named it so.

This round lands on top of PR #638, which built round 19's phases 1–6. The app therefore
*already has* the boxed rows, the returned ⤢, the focus-only field glow and the restructured
registry that these mockups assume. Round 19's phases **7** and **8** were never built, and
two of these three files are their prototypes.

All of it is JS/UI, so **it ships over OTA**: no `runtimeVersion` bump, no EAS build.

## Read first, in this order

1. `20-corrected-screens.html` — the five tabs, dark, 352×716, Norwegian. The target.
2. `20-card-editor-system.html` — one composer at three depths. This is round 19's **phase 7**.
3. `20-glass-card-system.html` — card states, related-card groups, Manage cards. Round 19's
   **phase 8**.
4. `20-MEASUREMENTS.md` — what was measured in a browser rather than read off the CSS. Every
   number in this doc comes from there. **Read it before arguing with any figure here.**
5. `19-IMPLEMENTATION.md`, phases 7 and 8 — not superseded, absorbed.
6. `AGENTS.md`, "One card shape — the card registry"; `DESIGN_RULES.md` §8;
   `DESIGN_RULES_AUDIT.md` for which rules are **not** binding.

## ⚠️ The mockups are missing their token file

All three `<link rel="stylesheet" href="styles.css">`, and that file was never delivered. Every
`--feature-*`, `--bubble-ink`, `--text-muted`, `--neutral` and `--font-sans` is therefore
**undefined**: accent icon backgrounds compute to `rgba(0,0,0,0)` and every `color-mix()` glow
to `none`. Opened as-is, the mockups render colourless.

Everything in this round was measured with the app's own `IDENTITY_HUES` substituted in
(`todo #FFD700`, `habits #05D9E8`, `health #FF8CB2`, `shopping #24B451`, `notes #B660FF`, plus
`meals #FF7A1A`, `scan #7C5CFF`). The mockups' per-tab mapping matches that set exactly —
task→Hjem+Gjøremål, shop→Handle, habits→Vaner, health→Helse — so the substitution is
almost certainly what was intended. **It is still a substitution.** If `styles.css` turns up
and disagrees, phase 2 is the only phase affected.

The mockups' own note says it best: if new per-tab hues are wanted they belong in a named
scheme, *"never inline, or scheme switching breaks across 5 schemes × light/dark."*

## Ground rules that do not bend

- **A caller never describes a card, it names one.** `<Card id="todoToday">`. Everything visual
  is data in `lib/cardRegistry.ts`. Do not add a prop to `Card` or to `SectionCard`.
- **`MIN_TAP_TARGET` is 48.** This round shrinks header buttons to the mockup's 29px *visual*
  size. The 48px reach through `hitSlopFor` is not negotiable and is CI-enforced.
- **Content must never read through chrome.** See "What the mockups get wrong" below.
- **A card is registry-named; a section is drawn one-per-row of user data.** A section gets no
  `Surface`, no persisted fold id and no ⤢ — it rides its parent's.
- **No guilt copy.** No first person outside `NarratorQuote`.
- Every file you touch gets its `Connections:` / Edit-notes header updated **in the same edit**.

---

## The four reversals, and what each costs

The maintainer ruled on all four. They are listed here with the ruling they overturn so the
next session does not "fix" them back.

### 1. A resting gap returns — and the edges line up

**Overturns:** 2026-08-19 *"delete the blank strip… flush at rest too"* and 2026-08-20
*"no gaps"*.

Measured today: `contentPad.paddingTop === contentTopClear === HEADER_HEIGHT` exactly, because
`headerFloatBottom = 0`. The first card rests flush against the header glass and the last rests
flush against the nav card. The mockup has **12px** at the top.

**This is reconcilable with the ruling it overturns, and the existing code comment says how:**
*"the margin is where content is CUT, the padding is where it RESTS."* The 2026-08-19 complaint
was about the strip a card gets **sliced across while scrolling**, and about the corner notches
— both of which live on `viewportInset`. A resting gap spent on `contentPad` alone re-creates
neither. **Spend it on `contentPad`. Never on `viewportInset`.**

Separately, and not something any ruling ever chose: the chrome is inset `headerFloatH =
Spacing.sm = 8` while every screen's content is inset `Spacing.md = 16`, so **the header card's
left edge sits 8px outside every content card's left edge**. The mockup insets header, cards
and nav all at 14. One inset, all three.

### 2. The cluster is chevron-first

**Overturns:** the note at `components/Card.tsx:250-256`, which has said `controls → ⤢ → fold`
with *"the fold is last"* since 2026-08-26 (and `controls → fold` before that).

The mockup draws **fold → controls → ⤢**, with the ⤢ outermost. `lib/__tests__/cardAnatomy.test.ts`
pins the current order and must be rewritten, not merely made to pass.

### 3. The hint line comes back, italic and bulbed

**Overturns:** 2026-08-17's *"A native app should not read like a manual… Delete all lightbulb
(💡) sections entirely"*, which deleted `components/CardHintNote.tsx`, every 💡, and
`fontStyle: 'italic'` from all 14 files that carried it.

One slot, **two lines maximum**, muted, directly under the header. Note the mockup puts it on
cards that already have content, which is precisely what the 2026-08-17 pass objected to — that
is the reversal, and it was made knowingly.

⚠️ **Use `Fonts.italic`** (`Nunito_400Regular_Italic`), never `fontStyle: 'italic'`. RN does not
synthesise italic onto a named custom family on **Android**, and every harness in this repo
(web preview, wraps, halos, every screenshot, tsc) renders a perfect slant over what would ship
upright. Same shape as the widget-palette lesson: a difference no local check can see.

### 4. Header buttons draw smaller

29px in the card header, 32px in the topbar, against the app's `IconSize.action` 36. Visual
only — the hit target stays 48. This makes the cluster noticeably lighter, which is most of why
the mockup's headers read cleaner than the app's.

---

## ⚠️ What the mockups get wrong

Three things in these files are defects, not design. Do not port them.

### Chrome is too translucent — content reads through it

The topbar is `rgba(18,23,36,.62)` and the nav `rgba(14,18,29,.78)`, both blurred. Mid-scroll,
card text is plainly legible **through** the header, and on the To-do tab "Når som helst" and
its peek line collide with the nav's labels. This regresses the 2026-08-18 ruling: *"header and
bottom nav should still not show elements behind it when user is scrolling. Only the backdrop."*

The app already satisfies that ruling by making `nav` and `overlay` opaque
(`Surface`'s `overlapsCards`). **Keep them opaque. Take the mockup's geometry, not its alpha.**

### The peek line does not fit its own content

Measured in `20-glass-card-system.html`'s own live frame, in **English**: 7 of 8 peek lines
truncate, from 1px (Plans) to 104px (the hint card). "3 of 7 done · 2 for this morning" is 63px
over. In `20-corrected-screens.html`, in Norwegian, 4 of 15 truncate.

The available width is **~168–189px** at a 352px frame. This is a real budget and the mockup
does not respect it. Phase 3 authors to the budget and adds a guard; see there.

### Manage cards is unreadable in light mode, and does not fit

`.sheet` sets no `color` in light — only `.dark .sheet` does — so it inherits the document's
`#E6E9EF` onto a near-white sheet, ≈1.2:1. And 3 of 7 card names truncate ("Today's …",
"Sho…", "Sca…"): grip + icon + name + group tag + Open/Peek segment does not fit 296px.

### Smaller things worth knowing

- The quick-add placeholder `#7C8698` measures **4.22:1**, under AA 4.5. Every other text token
  in the mockups passes.
- The bottom of scroll leaves **28px** under the last card against **12px** at the top — the
  96px bottom padding overshoots a 54px nav + 14px inset. Make the two ends agree.
- The composer's option rows are free-wrapping chips and wrap to two lines on 9 rows across 5
  cards *in English*, while the file's own spec says they "scroll horizontally rather than
  wrapping". The app's `QuickAddOptionsPanel` already pairs cells properly; use it.
- The sheet depth overflows its own frame on habits/goals (+23px) and Plans (+70px).
- The full editor's Delete is an unlabelled red icon. The app routes every destructive confirm
  through `confirmDestructive()`; keep doing that.

---

## ⚠️ The backdrop wash and the identity hues are in direct tension

This is the decision the round turns on, and **phase 2 must not start until it is made.**

The mockups' headline fix is that *"cards sat on flat near-black, so blur produced uniform grey
slabs"* — so the backdrop now carries three accent washes per tab. That is a real diagnosis. But
it lightens the ground a card is composited over, and every contrast floor in this app is
measured against that ground.

The ladder is **already full**. Against the post-#638 card surface `#242424`, AA 4.5:1 needs
L\* ≥ 57.9, and saturated amber tops out at 86.9 — 29.0 L\* for five rungs, 7.26 apart, against
a rule asking ≥7. The five hues already sit on the sRGB gamut boundary at their lightness.
**There is no headroom for "more vivid"; only for different hue angles at the same rungs.**

Sampling the mockup's backdrop under the card band: the centre is untouched `#0A0D15`, but the
brightest in-band pixel is `rgb(40,38,18)`. A card composited on that is `rgb(70,69,51)`:

| hue | on `#242424` | on the washed ground |
|---|---|---|
| todo `#FFD700` | 11.07 | 6.93 |
| habits `#05D9E8` | 8.94 | 5.60 |
| health `#FF8CB2` | 7.13 | **4.47 FAIL** |
| shopping `#24B451` | 5.71 | **3.58 FAIL** |
| notes `#B660FF` | 4.51 | **2.83 FAIL** |

And how many rungs survive, by wash strength:

| wash | card surface | min L\* for AA | rungs @7 L\* |
|---|---|---|---|
| 0 (app today) | `rgb(36,36,36)` | 57.9 | **5** |
| ×0.25 | `rgb(45,45,40)` | 60.9 | 4 |
| ×0.5 | `rgb(53,52,44)` | 64.0 | 4 |
| ×1 (as drawn) | `rgb(70,69,51)` | 72.2 | **3** |

This is the PR #540 shape `AGENTS.md` warns about: the composite assertions go on passing while
measuring a ground the app no longer draws. `__tests__/glassMaterial.test.ts` measures against
`#000000`, and `lib/__tests__/chromeRhythm.test.ts` §6 keeps the orbs out of the middle *for
this reason*.

**Three options, for the maintainer:**

- **A — keep five hues, dim the wash.** Hold it to ≲25% of the drawn strength and out of the
  card band. Keeps the identity system; gets most of the "glass has something to blur" effect.
  New hue *angles* only. **Recommended.**
- **B — full wash, four hues.** Merge two categories. Buys the mockup's backdrop for one
  identity colour.
- **C — full wash, hues off the card entirely.** Colour lives only in the badge glyph on a
  neutral plate, which `badgeGlyphFor` already handles contrast-safely. Biggest change.

---

## Phases

One commit each; one PR into `main`, merged.

### Phase 0 — this handoff
`20-IMPLEMENTATION.md`, `20-MEASUREMENTS.md`, the three HTML files, and an `00-INDEX.md` entry.

### Phase 1 — chrome geometry
`components/ScreenScaffold.tsx`, the five tab screens.

- `CHROME_REST_GAP = Spacing.sm` (8 — on the scale; the mockup's 12 is not). Spend it on
  **`contentPad` only**, both ends, so the top and bottom agree.
- One horizontal inset for header, cards and nav. Measure both directions against
  `npm run wraps -- --width=360` before choosing: widening the chrome costs nothing, narrowing
  the cards costs text width.
- **Do not touch chrome opacity.**
- `lib/__tests__/screenRhythm.test.ts` and `chromeRhythm.test.ts` assert the zero gap today.
  They need rewriting.

### Phase 2 — backdrop and hues *(gated on A/B/C above)*
`components/ScreenBackground.tsx`, `constants/colors.ts`, `lib/__tests__/colors.test.ts`,
`__tests__/glassMaterial.test.ts`. Whatever ground ends up drawn, `glassMaterial` must measure
against **that**, or the suite lies.

### Phase 3 — the card header
`components/Card.tsx`, `components/SectionRail.tsx`, `lib/cardRegistry.ts`,
`lib/__tests__/cardAnatomy.test.ts`.

- **Peek line**: a `peek` field on the registry spec, rendered by `SectionRail` under the label,
  one line, muted, hidden at full-screen. Author every string to the ~180px budget, and
  **extend `scripts/measure-wraps.mjs` to fail on a truncating peek**. Without that guard the
  feature rots silently — the mockup's own 7-of-8 is the proof.
- **Cluster** → fold → controls → ⤢.
- **Buttons** → 29/32px visual, 48px reach.
- Counts stay, alongside the peek.

### Phase 4 — the hint line
One slot, two lines, `Fonts.italic`, `bulb-outline`. `lib/__tests__/exampleRows.test.ts` §4
asserts its absence today and must be rewritten, as must the italic ban in `chromeRhythm`.

### Phase 5 — composer options per card *(round 19 phase 7)*
`lib/cardRegistry.ts` gains `compose: { depth, opts }`, per 19's table extended by
`20-card-editor-system.html`. Reuse `QuickAddOptionsPanel`'s pairing, not the mockup's wrapping
chips. Wire the escalation the mockup proves out — **More carries the typed value into the
sheet** — which closes `AddRow`'s documented "no tier 3" gap.

⚠️ **Any new options slot must spread `controlsResponderProps`**
(`lib/__tests__/composerFocusSteal.test.ts`). The dependent option — a weekday row that exists
only once Repeat says Weekly — is *exactly* the control that froze the shipped app: a picker in
a `<Modal>` takes window focus, the field blurs, and a composer that tears itself down on blur
disposes of itself behind the open dialog. Re-arm the flag in `onFocus` too.

### Phase 6 — groups and Manage cards *(round 19 phase 8)*
`lib/cardRegistry.ts` gains `group`; generalise `components/HomeCardManager.tsx` beyond Home.
Group lookup must search **every** screen — Growth spans Habits' card and two of Health's, which
is the point of the feature. Two prototype defects to fix first: the row must fit 360px, and
**no group may hold two cards with the same title** (19's own finding — `time` held both
`todoToday` and `homeToday`, both "Today", and the strip drew *Today · This week · Today*).
Home's cards are previews and carry no group. Add a test.

---

## Verification

1. `npx tsc --noEmit` — phase 3's registry field and 5/6's derived unions find the work for you.
2. `scripts/test-changed.sh` — expect `screenRhythm`, `chromeRhythm`, `cardAnatomy`,
   `exampleRows`, `colors` and `glassMaterial` to need **updating**, not merely to pass.
3. `npm run halos` — must stay 0 clipped through the composer work.
4. `npm run wraps -- --lang=no --width=360` — **read the "screens measured" line (22)**, not the
   totals. This audit fails by *un-measuring* screens, and phases 1 and 3 will move its walk.
5. `npm run preview` — proves the write paths survive phase 5.
6. `npm run review-bundle` — before/after. The gap and the edge alignment are judged here.
7. PR into `main` and **merge it**.

## Do NOT

- Do not copy the mockups' chrome alpha. Content must not read through chrome.
- Do not spend the resting gap on `viewportInset`; `contentPad` only.
- Do not use `fontStyle: 'italic'` for the hint.
- Do not give a card header a literal 48px button box — 29/32 visual, `hitSlopFor` for reach.
- Do not re-add the 5% identity-hue pane wash (exported and rejected 2026-08-20).
- Do not raise the ladder past five rungs, or drop a hue below its measured AA floor.
- Do not bump `runtimeVersion` — this is all JS.
