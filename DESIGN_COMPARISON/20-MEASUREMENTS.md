# 20 — What was measured

Every figure in `20-IMPLEMENTATION.md` comes from here. All of it was rendered in the
pre-installed Chromium (`/opt/pw-browsers/chromium-1194`) and sampled, not read off the CSS —
because the interesting failures in this round (a peek line that does not fit, a light-mode
colour inherited from the dark page, a backdrop that breaks a contrast floor) are all invisible
in source.

**Substitution:** the mockups' `styles.css` was never delivered, so every `--feature-*`,
`--bubble-ink`, `--text-muted`, `--neutral` and `--font-sans` is undefined. Measurements were
taken with the app's own `IDENTITY_HUES` injected and a 1em box standing in for `<ion-icon>`
(the CDN is unreachable from this environment). Geometry is unaffected by either substitution
except where noted.

---

## 1. Chrome geometry

`20-corrected-screens.html`, 352×716 frame.

| | mockup | app today | app source |
|---|---|---|---|
| header → first card, at rest | **12** | **0** | `ScreenScaffold.tsx:796` |
| last card → nav, bottom of scroll | 28 | 0 | `ScreenScaffold.tsx:798` |
| side inset — header | 14 | 8 | `headerFloatH = Spacing.sm` `:537` |
| side inset — content cards | 14 | 16 | each screen's `paddingHorizontal: Spacing.md` |
| side inset — nav | 14 | 8 | `app/(tabs)/_layout.tsx:299-313` |
| card gap | 12 | 16 | `SCREEN_GAP` |
| card radius | 20 | 16 | `Radius.md` |
| card padding | 13 even | 16 h / 8 top / 16 bottom | `Card.tsx:293-312` |
| header height / title | 60 / 21px | 67 / 24px | `theme.ts:509-520` |
| nav height / radius | 54 / 22 | 72 / 24 | `BottomNav.tsx:106,224` |
| control button | 29 | 36 (`IconSize.action`) | `theme.ts:351` |
| row min-height | 44 | 48 (`MIN_TAP_TARGET`) | `theme.ts:325` |

The app's zero gap is not an oversight — `contentPad.paddingTop = contentTopClear`, and
`contentTopClear = headerBlockHeight − topInset = HEADER_HEIGHT` exactly, because
`headerFloatBottom = 0` (`:534`). The two move together by construction.

**The 28-vs-12 asymmetry is the mockup's own bug.** `.stack` has `padding-bottom: 96px` against
a nav occupying 54 + 14 = 68px of the frame's bottom. 96 − 68 = 28. To match the top it wants
80px, not 96.

## 2. The peek line does not fit

Available width ≈ card width − card padding − icon − gaps − control cluster:
`320 − 28 − 36 − 22 − 66 ≈ 168px` in `20-glass-card-system.html`, ≈189px in
`20-corrected-screens.html` (13px padding, 34px icon, 29px buttons).

**`20-glass-card-system.html`, English — 7 of 8 truncate:**

| card | peek | over by |
|---|---|---|
| Today's tasks | "3 of 7 done · 2 for this morning" | 63px |
| Habits | "4 rings going · 2 untouched" | 36px |
| Goals | "2 goals · Move more is 60% there" | 79px |
| Shopping list | "11 items · 2 lists" | — fits |
| Health | "Slept 6h 40m · 1 med left" | 20px |
| Plans | "2 today · next at 15:00" | 1px |
| Scan results | "Receipt · 6 items found" | 5px |
| Why cards collapse | "Tap the chevron to keep a card small" | 104px |

**`20-corrected-screens.html`, Norwegian — 4 of 15 truncate:** "2 av 5 gjort · neste 15:00"
(2px), "2 planlagt · første 12. sep" (7px), "Sov 6t 40m · 1 medisin igjen" (25px),
"2 mål · Bevege meg mer 60 %" (34px).

English is the *shorter* language here and still fails 7 of 8. The budget is real.

## 3. Contrast

Sampled per text node against the **composited** pixel behind it (text hidden, screenshot,
pixel read) rather than against a declared colour — the cards are translucent over a washed
backdrop, so the declared value is not what the eye gets.

`20-corrected-screens.html`, dark — **11 of 12 pass**:

| token | colour | ratio | need | |
|---|---|---|---|---|
| quick-add placeholder | `#7C8698` | **4.22** | 4.5 | **FAIL** |
| peek line | `#98A2B6` | 7.12 | 4.5 | pass |
| hint (italic) | `#8B94A6` | 6.08 | 4.5 | pass |
| row right value | `#98A2B6` | 6.20 | 4.5 | pass |
| done row title | `#8B94A6` | 5.39 | 4.5 | pass |
| group row count | `#98A2B6` | 6.70 | 4.5 | pass |
| empty state text | `#98A2B6` | 6.63 | 4.5 | pass |
| nav inactive label | `#8B94A6` | 5.84 | 4.5 | pass |
| card title | `#EDF0F6` | 15.96 | 3.0 | pass |
| segment inactive | `#AEB8C9` | 7.96 | 4.5 | pass |
| quick-add chip | `#FFD700` | 7.40 | 4.5 | pass |

`20-glass-card-system.html`, **light**, Manage cards sheet: `.sheet` declares no `color` — only
`.dark .sheet` does — so every string inherits the document body's `#E6E9EF` onto a
`rgba(255,255,255,.72)` sheet. ≈**1.2:1**. Title, subtitle, card names, group tags and segment
labels are all affected.

## 4. Tap targets

`20-corrected-screens.html`, elements under 44px in either axis:

| control | drawn | count |
|---|---|---|
| card header button (`.gc-btn`) | 29×29 | 32 |
| topbar button (`.tbtn`) | 32×32 | 7 |
| quick-add buttons (`.qbtn`) | 29×29 | 10 |
| nav item | 60×36 | 25 |
| segment button | 95×40 | 3 |

The app draws 36px and reaches 48 via `hitSlopFor`. Adopting the smaller *visual* is what makes
the mockup's header read lighter; the 48px reach is separate and must survive.

## 5. Content reads through the chrome

Scrolled mid-way on the To-do tab: the hint line "Det er da det begynner å funke." is legible
**through** the topbar (`rgba(18,23,36,.62)`, `blur(20px)`), and "Når som helst" with its peek
line is legible through the nav (`rgba(14,18,29,.78)`), overlapping the "Hjem" and "Vaner"
labels. Screenshot taken; this is not a subtle artefact.

The app's `nav` and `overlay` surface tiers are opaque precisely to prevent this
(2026-08-18: *"should still not show elements behind it when user is scrolling. Only the
backdrop."*).

## 6. The backdrop wash vs. the hue ladder

Backdrop sampled with all cards and chrome hidden, across the card band (x 0.15–0.85,
y 0.15–0.85 of the frame):

- centre: `rgb(10,13,21)` — the frame's own `#0A0D15`; the wash does **not** reach the middle.
- brightest in-band: `rgb(40,38,18)`, luminance 0.0188.
- app today, dark: every in-band pixel is `#000000`, luminance 0 — the orbs are held out of the
  middle by construction (`chromeRhythm.test.ts` §6).

A card is `surfaceGlass` = `rgba(255,255,255,0.1412)` over the ground:

| ground | card surface | todo | habits | health | shopping | notes |
|---|---|---|---|---|---|---|
| `#000000` (today) | `rgb(36,36,36)` | 11.07 | 8.94 | 7.13 | 5.71 | 4.51 |
| `rgb(40,38,18)` (washed) | `rgb(70,69,51)` | 6.93 | 5.60 | **4.47** | **3.58** | **2.83** |

Three of five fail AA 4.5:1 at full wash.

Minimum L\* clearing AA on the card surface, and how many rungs ≥7 L\* apart still fit below
saturated amber's 86.9 ceiling:

| wash | card surface | min L\* | band | rungs |
|---|---|---|---|---|
| 0 | `rgb(36,36,36)` | 57.9 | 29.0 | **5** |
| ×0.25 | `rgb(45,45,40)` | 60.9 | 26.0 | 4 |
| ×0.5 | `rgb(53,52,44)` | 64.0 | 22.9 | 4 |
| ×0.75 | `rgb(62,61,48)` | 68.1 | 18.8 | 3 |
| ×1 | `rgb(70,69,51)` | 72.2 | 14.7 | 3 |

### New hue angles were searched for, and the current set kept

The brief was "new hues, you derive them", narrowed by the headroom finding below to *hue angle
only* — the five L\* rungs cannot move. So the angles were searched: for each rung, every hue at
5° steps whose most-saturated form lands within 1.2 L\* of that rung, scored on the worst
pairwise dichromat separation across ~8M combinations.

A mechanically better set exists. It scores **deutan 38.2 / protan 38.2** against the current
set's **30.8 / 17.6** — a real gain on protanopia, the current set's weakest axis (which still
clears the documented floor of 12).

It is not an improvement in use, and the search is what shows why:

| rung | found | current |
|---|---|---|
| To-do | `#E0E000` (h 60) | `#FFD700` (h 51) |
| Habits | `#FFA8E9` (h 315) | `#05D9E8` (h 185) |
| Health | `#FF8F8F` (h 0) | `#FF8CB2` (h 340) |
| Shopping | `#BF80FF` (h 270) | `#24B451` (h 140) |
| Notes | `#8F8F00` (h 60) | `#B660FF` (h 275) |

To-do and Notes land on **the same hue angle**, which reads as one colour at two lightnesses
rather than as two categories — the exact confusion the separation score is supposed to measure
and cannot see, because ΔE between a bright yellow and an olive is large while the *relationship*
between them is obvious. And the semantics invert: Shopping becomes violet, Notes olive, Habits
pink. A pure-separation optimum optimises the wrong thing.

**Recommendation: keep the current five.** They were derived on 2026-08-17 against these same
constraints plus semantic fit, they clear every floor, and the only axis a search improves is one
that already passes. Churning them would cost the app's colour identity for a metric gain nobody
can see.

### ⚠️ The correction: there is no headroom at all, and the wash's STRENGTH was never the issue

Measured after building phase 2, and it revises the table above rather than confirming it.

`surfaceGlass` over `#000000` composites to `#242424`, whose luminance is **L 0.0176**. The
ceiling for Notes (`#B660FF`, the ladder's bottom rung) to clear AA 4.5:1 on the card is
**L 0.0178**. That is a margin of 0.0002 — a ground of grey **1** is already enough to push the
composite over.

So "dim the wash to ≤25%" was the wrong frame, including in this document's own first reading.
The wash's strength is close to irrelevant; what protects every chromatic token is entirely the
**geometry** — that nothing lights the pixels a card sits on. A per-tab hue on the existing
corner discs is therefore free at any sane opacity, and a wash reaching the card band is unsafe
at any opacity. `lib/__tests__/chromeRhythm.test.ts` §6 now checks both halves: the discs never
reach the middle, and the hue layer indexes into those same discs rather than declaring its own.

Measured in the shipped app after the change, sampling the gutter (x=3 and x=387, outside every
card) at 390px:

| tab | top-right corner | bottom-left corner | mid-gutter | brightest gutter L |
|---|---|---|---|---|
| Shop | `rgb(7,29,21)` | `rgb(11,15,16)` | `rgb(0,0,0)` | 0.0098 |
| To-do | `rgb(21,31,17)` | `rgb(22,17,13)` | `rgb(0,0,0)` | 0.0118 |
| Home | `rgb(23,32,16)` | `rgb(22,16,12)` | `rgb(0,0,0)` | 0.0125 |
| Habits | `rgb(4,32,34)` | `rgb(9,16,24)` | `rgb(0,0,0)` | 0.0129 |
| Health | `rgb(21,27,32)` | `rgb(20,12,21)` | `rgb(0,0,0)` | 0.0111 |

The hue is legibly per-tab (Shop green-dominant, Habits cyan, To-do/Home gold), the corners peak
below the mockup's 0.0188, and **the mid-gutter — the height at which cards sit — is pure black
on every tab**.

---

The current five sit at L\* 86.9 / 79.3 / 71.7 / 64.7 / 57.6 — steps of 7.6 / 7.6 / 7.0 / 7.1
in a 29.0 band that needs 7.26 average. **The ladder is exactly full**, and the hues are already
on the sRGB gamut boundary at their lightness (C\* 43–93), so "more vivid" is not available at
any wash strength. Only hue *angle* is free.

## 7. Composer behaviour

`20-card-editor-system.html`, driven end to end. **The mechanics are sound:**

- primary button starts `disabled` at every depth ✓
- arms on first input ✓
- **More escalates to the sheet and carries the typed value** ✓ (`"Book the dentist"` arrived
  prefilled with Save enabled) — this is the tier-3 escalation `AddRow` documents as missing
- Cancel removes both sheet and scrim, leaving no orphan ✓

**Two fit problems:**

Option chip rows wrap to two lines, in English, on 9 rows across 5 cards — while the file's own
spec says chip rows "scroll horizontally rather than wrapping past two lines":

| card | wrapped row |
|---|---|
| task | This morning / Afternoon / Evening / No time |
| habits | times / minutes / glasses · Morning / Midday / Evening / Never |
| goals | This month / 3 months / This year / Pick a date · km / sessions / books / % |
| health | Sleep / Movement / Water / Medication / Mood · glasses / ml / minutes · Now / This morning / Last night / Pick a time |
| shared | 30 min before / 1 hour / The day before / Never |

The app's `QuickAddOptionsPanel` already solves this: `flexBasis: '46%'` pairs two per line and
lets an odd last cell stretch. Use it rather than porting free-wrapping chips.

Sheet depth overflows its own frame and scrolls internally: habits +23px, goals +23px,
Plans +70px. Plans is why Plans has a full editor; habits and goals do not, and should.

## 8. Manage cards row does not fit

`grip + icon + name + group tag + Open/Peek segment` in 296px: 3 of 7 names truncate —
"Today's tasks" by 25px, "Shopping list" by 55px, "Scan results" by 49px.

---

## How to re-run any of this

Scripts live in the session scratchpad, not the repo (they depend on the substitution above and
on absolute paths). The method, if it needs repeating:

```js
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
// inject the token substitution + an ion-icon stub via addInitScript
// geometry:  getBoundingClientRect + getComputedStyle
// truncation: textOverflow === 'ellipsis' && scrollWidth > clientWidth
// contrast:  addStyleTag('*{color:transparent!important}'), screenshot, read the pixel
//            under each node's centre with pngjs, then WCAG relative luminance
```

The contrast step is the one worth keeping: measuring a declared colour against a declared
background is what let PR #540's assertions pass while measuring a ground the app did not draw.
