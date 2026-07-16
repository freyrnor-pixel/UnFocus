# Header clip — debugging log (2026-07-16)

**Status: FIX #8 SHIPPED — TRUE root cause found and reproduced headlessly in real Yoga.**
This file is committed to the repo (it was previously lost with an ephemeral session
container); keep updating it here until the bug is confirmed dead on device.

## Round 3 (2026-07-16, later) — THE root cause: `flex: 1` on the title Text

**#199 (fix #7) FAILED on device** (bundle 019f6a58 confirmed): user screenshot shows the
same straight-line bottom crop on "Hjem", Settings header still missing, and "Fokus-modus"
label reported too small. Screenshot analysis: the controls (ⓘ / Fokus-modus / gear) in the
SAME band are NOT cut; below the cut is band-bg filler. So the crop line is a box boundary
that none of seven font/band fixes ever moved — not text metrics.

**Root cause (reproduced in real Yoga, headlessly — first true repro of this bug):**
`styles.title` had **`flex: 1` on the Text itself**. Harmless while the Text was a direct
child of the header ROW (main axis = width). But commit `ce90fd8` (Jul 13 — debug notes)
wrapped the title in DebugNoteAnchor/`titleWrap`, a **COLUMN** View → `flex:1` became
**flexBasis:0 on the HEIGHT**. Yoga simulation (yoga-layout@3, exact subtree:
headerBlock→outer(flex:1)→mask(flexGrow:1)→row(center,pad 8)→titleWrap(flex:1)→Text):

| | Text frame | row | measureFunc called? |
|---|---|---|---|
| with `flex:1` on Text | **0dp tall** | 40dp (icons+padding only) | **NO — never** |
| without | 41dp | 57dp | yes |

Android paints the StaticLayout glyphs from the zero-height frame and they slice in a
straight line (~40dp region — matches the screenshot's cut). **The text measure function
is never even called**, so no fontSize/lineHeight/includeFontPadding/band change could
ever matter — the entire 7-fix history was fighting a layout bug with font tools.
Browser flexbox (react-native-web) resolves flex-basis:0 children of auto-height
containers from their content contribution (41px measured) — web could never reproduce
this **by construction** (different layout engine, not just different font metrics).

Timeline confirms: wrapper added Jul 13 → first clip report Jul 14-15 → all fixes after.
Also unifies the Settings report: Android's sub-tier header is title-only (no back link,
no gear) — 0dp title + white glass band on Settings' white plainBackground = "no header
at all."

**Fix #8 (this round):**
- Removed `flex: 1` from `styles.title` (width was always owned by titleWrap's flex:1).
- Debug mode now also draws colored outlines: **BLUE** = headerBlock band
  (ScreenScaffold), **RED** = header Surface edge, **GREEN** = title Text frame. With the
  magenta numbers caption, one screenshot pins any remaining clip to its exact box.
- `focusLabel` FontSize.xs→sm (tester: "Fokus-modus too small").
- Yoga sim script preserved below for re-running (scratchpad-only, not committed as code).

The #199 changes (allowFontScaling={false} + verbatim getHeaderMetrics values) stay —
the SP double-scaling was a second real defect, just not the visible one.

<details><summary>Yoga simulation script (yoga-layout@3)</summary>

Model headerBlock(h=HEADER_HEIGHT+inset, padTop=inset) → outer(flex:1) →
mask(flexGrow:1, alignSelf:stretch, overflow:hidden) → row(row, alignItems:center,
padV 8, padH 16, gap 16) → [titleWrap(flex:1) → Text(measureFunc h=41)] +
controls(120×24). Toggle `text.setFlex(1)` and compare `getComputedHeight()`.
Result above; measureFunc is skipped entirely when flex:1 is set.
</details>

---

## Session 2 (2026-07-16, branch `claude/header-clip-debug-mjhzqx`) — the double-scaling root cause

**Found in RN source, not guessed**: `react-native/ReactAndroid/.../views/text/TextAttributes.kt`
(`effectiveLineHeight`, line ~76): when `allowFontScaling` is true (the default), Android
converts the style `lineHeight` **from SP** — `toPixelFromSP(lineHeight, effectiveMaxFontSizeMultiplier)`
— i.e. **multiplies it by the OS font scale (capped by maxFontSizeMultiplier)**.

- The #194/#195 premise — *"a px lineHeight never scales; only fontSize does"* — is
  **exactly backwards** on Android. `getHeaderMetrics` pre-multiplied `titleLineHeight`
  by the capped scale, then RN multiplied it **again**: at the reporter's enlarged text
  size (1.4×), style lineHeight 57 rendered as a ~80px line box while the band math
  assumed 57 in an 89px band. The row overflowed → straight-line bottom crop.
- Explains why **#194 (bigger lineHeight) made it worse**: a bigger pre-scaled value gets
  double-scaled into an even bigger box.
- Explains why **web never reproduced it**: react-native-web performs no SP conversion on
  lineHeight, and the earlier 1.4× "simulation" forced the values manually — so web
  measured `Text height == lineHeight` and the math looked correct on a renderer that
  lacks the doubling.

**Fix shipped (this branch)**: the title Text now sets `allowFontScaling={false}` and takes
BOTH `fontSize` and `lineHeight` verbatim from `getHeaderMetrics` (which now also returns
`titleFontSize` and applies the capped OS scale itself, once). Accessibility sizing still
works — same 1.4 cap, applied in one place. `includeFontPadding: false` +
`textAlignVertical: 'center'` (#198) are kept. Jest invariants added
(`__tests__/headerMetrics.test.ts`).

**Settings/sub-tier web check (new)**: `scripts/preview.mjs` now walks Home → gear →
Settings and measures both headers. Result: **sub-tier renders fine on web** (title
visible, box height == lineHeight == 41 @ scale 1.0). So the "Settings has no header"
report is also Android-native. Note: on Android the sub-tier header contains ONLY the
title (back link is iOS-only, no gear) — if the title is fully clipped by the same
mechanism, the header reads as "missing entirely". One mechanism can explain both reports.

**On-device diagnostics shipped**: with Debug mode ON (`settings.debugModeEnabled`), every
header renders a small magenta numbers caption: `fs<fontScale> fz<fontSize> lh<lineHeight>
bh<bandHeight> t<measuredTextHeight>@<yOffset>`. If anything still clips, the reporter
screenshots Home + Settings and the numbers land here — no more blind fixes.

**If the numbers come back geometrically correct but it still clips**: go structural
(step 4 below) — content-sized header instead of fixed band + `numberOfLines={1}` +
explicit lineHeight, or `adjustsFontSizeToFit` (BottomNav pattern) as a shrink-to-fit
guarantee.

---

# Original handoff (session 1, kept for the record)

**Status then: UNRESOLVED.** Header titles are still clipped on device after 6 attempts.
A second, possibly-related bug surfaced: **the Settings screen has NO header at all**
("hasn't had for a while") — this is the strongest un-investigated lead.

## The bug(s)

1. **Screen header titles clipped along the bottom on Android.** e.g. Home "Hjem"
   renders as "Hiem". User describes the cut as **"whole bottom edge cut straight"**
   (a straight horizontal crop across ALL letters, not just descender tails j/g/p/y).
   Reported that an earlier fix that *increased* lineHeight made it **worse**.
2. **Settings screen (tier="sub") shows no header at all.** Newly reported, "for a
   while." NOT yet investigated. Likely the key clue — see Next Steps.

## Delivery is NOT the problem (confirmed)

- Device: runtime `1.3.0`, channel `preview`. `app.json` `runtimeVersion` = `1.3.0` (match).
- Device bundle progressed on-screen: `019f67a7` (Jul 15, pre-fixes) → `019f6a0f` →
  **`019f6a32`** (current). `019f6a32` is the `adbd956` OTA (includeFontPadding fix,
  published Jul 16 09:12, run succeeded). **So the device IS running the latest code.**
- The OTA pipeline (`update.yml`, fires on push to `main`) works every time.

## Two font-scaling axes (both grow fontSize, historically NOT lineHeight)

- **OS**: `maxFontSizeMultiplier: 1.4` on all RNText (`app/_layout.tsx`, value from
  `MAX_FONT_SCALE` in `constants/theme.ts`). Applied by RN at render.
- **In-app**: Size setting small/default/**large(1.2x)** via `useScaledStyles`
  (`lib/useAppTheme.ts`), rewrites `fontSize` in the stylesheet.
- NOTE: the header title uses a plain `StyleSheet` (NOT `useScaledStyles`), so only the
  OS axis scales the title; `PixelRatio.getFontScale()` drives `getHeaderMetrics`.

## All fixes tried (chronological) — every one FAILED to fix the clip

| PR | commit | change | outcome |
|----|--------|--------|---------|
| #186 | f995e5c | `HEADER_HEIGHT` 56→64 (ScreenScaffold band) | FAILED |
| #189 | 1f212e9 | added `fontFamily: Nunito_700Bold`, hardcoded `lineHeight: 36`, title `FontSize.xl(22)`→`xxl(28)`, `HEADER_HEIGHT` 64→72 | FAILED |
| #194 | e4c5f8d | `lineHeight` computed inline, scales w/ `PixelRatio.getFontScale()` × 1.45 ratio | FAILED — user said **worse** |
| #195 | 36d00bc | `getHeaderMetrics(scale)` in theme.ts scales BOTH line box AND band (`headerHeight = titleLineHeight + 32`); `MAX_FONT_SCALE`→theme.ts | FAILED |
| #197 | c3921a8 | (a) `useScaledStyles` now scales `lineHeight` too [in-app axis]; (b) **OTA pending-update fix** via `Updates.useUpdates()` isUpdatePending — surfaces/applies already-downloaded updates | (b) **WORKED** for delivery; header still clipped |
| #198 | adbd956 | **`includeFontPadding: false` + `textAlignVertical: 'center'`** on `styles.title` | **live on device (019f6a32), STILL clipped per user** |

## Key diagnostic findings

- **Web preview (react-native-web) renders ALL site-tier headers cleanly** — at scale
  1.0 AND at a simulated 1.4× (temporarily forced `getHeaderMetrics` scale=1.4 + title
  `fontSize:39`). Measured title `Text` height via `onLayout` = **exactly `lineHeight`
  (57 at 1.4× sim)**, fits the 89px band. So **the layout math is correct and the web
  cannot reproduce the bug.** Screenshots in `preview-shots/` (gitignored).
- Therefore the clip is **Android-native**. It cannot be reproduced headlessly here:
  no Android emulator (no KVM/virtualization), and browsers lack `includeFontPadding`.
- `includeFontPadding` was set **nowhere** in the repo (Android default `true`) until
  #198. The #198 hypothesis: Android's font padding is added on top of `lineHeight` and
  offsets the glyph down inside the `numberOfLines={1}` box → straight-line bottom crop.
  **#198 did NOT fix it** → either the hypothesis is wrong/incomplete, or something else
  clips (see Settings clue).

## Header render path (facts, from code trace)

`ScreenScaffold` headerBlock `View` (`components/ScreenScaffold.tsx:~290`, absolute,
`top:0`, `height: HEADER_HEIGHT + topInset`, `paddingTop: topInset`, `zIndex:100`) →
`ScreenHeader` (`style=headerFill={flex:1}`) → `Surface` → `DebugNoteAnchor` (plain
`flex:1` View when debug off) → `Text`.

- `HEADER_HEIGHT = getHeaderMetrics(PixelRatio.getFontScale()).headerHeight` (`ScreenScaffold.tsx:222`).
- The ONLY `overflow:hidden` in the path is `Surface`'s mask (`components/Surface.tsx:250`
  `mask: { overflow:'hidden', alignSelf:'stretch', flexGrow:1 }`) — glass rounded-corner
  mask, load-bearing, do NOT remove.
- Title `Text` (`ScreenHeader.tsx` ~288): `fontSize:28`, `fontFamily:Nunito_700Bold`,
  inline `lineHeight=titleLineHeight`, `numberOfLines={1}`, now `includeFontPadding:false`
  + `textAlignVertical:'center'`.
- `getHeaderMetrics` (`constants/theme.ts:149`): `titleLineHeight = ceil(28*scale*1.45)`;
  `headerHeight = titleLineHeight + Spacing.sm*2(16) + Spacing.md(16)`. Values:
  scale 1.0 → lineHeight 41, band 73; scale 1.4 → lineHeight 57, band 89.
- ALL screens route through this one `ScreenHeader` title (site + sub tiers). The
  "version" info is an `ExpandableCard` inside `app/settings.tsx`, not a separate screen.

## STRONGEST UN-INVESTIGATED LEAD: Settings has no header

The Settings screen uses `<ScreenScaffold tier="sub" ...>`. If **all** titles are
clipped AND Settings shows **no** header, the common cause may NOT be font rendering at
all — it may be the **header band collapsing / the title being positioned off-screen or
under the status bar**, varying by tier/screen. The web preview NEVER navigated to
Settings (script only walks the 5 site tabs), so the sub-tier header was never verified.

Reconsider the whole premise: maybe the "cut" is the **band too short / title mis-positioned
vertically** (so you see only the top sliver of a title, and Settings' title falls entirely
into the clipped/hidden region), NOT a font-descender/includeFontPadding issue. #198 may
have been chasing the wrong mechanism.

## Next steps (recommended order)

1. **Get a real on-device measurement.** Temporarily render the computed values as
   visible text on Home (or via a debug note): `PixelRatio.getFontScale()`,
   `titleLineHeight`, `HEADER_HEIGHT`, and the title `Text`'s `onLayout` height +
   `measureInWindow` y-position. Have the user screenshot it. This is the ONLY way to
   see the actual device numbers, since nothing here reproduces Android. This will show
   whether the band/title is where the math expects, or collapsed/mis-positioned.
2. **Investigate the sub-tier header path** in `ScreenHeader.tsx` (the `tier==='sub'`
   branch: back link + title) and why Settings shows no header. Extend
   `scripts/preview.mjs` to navigate into Settings (gear icon on Home header) and
   screenshot it — check if sub-tier is broken on web too.
3. **Reconsider the root cause as a layout/positioning bug**, not a font bug: check
   `topInset` handling, the absolute `headerBlock`, whether the Surface content sits at
   the top vs is pushed down, and whether `HEADER_HEIGHT` could compute small on device.
4. **Consider a robust structural rewrite** of the header if the band/mask model keeps
   fighting: render the header title in normal flow sized to its content (no fixed
   absolute band + overflow:hidden over the title), or drop `numberOfLines={1}` +
   explicit `lineHeight`, or add `adjustsFontSizeToFit` (BottomNav pattern,
   `components/BottomNav.tsx:130`) as a last-resort shrink-to-fit guarantee.
5. Only ship after an on-device screenshot confirms the fix — do NOT ship blind again
   (that was the repeated mistake; web verification is impossible for this Android bug).

## Process lesson

Fixes #186–#198 were shipped without ever reproducing the bug (web can't; no emulator),
so 5 of 6 "verified" against a renderer that never had the bug. Next session: get device
numbers FIRST (step 1), then fix, then confirm on device.

## Git / workflow notes

- Branch: `claude/headers-cutoff-updates-6f4and`. Its PRs are merged; treat new work as
  fresh — rebase onto latest `main`, force-with-lease push, open a NEW PR, merge to `main`
  (that triggers `update.yml` → OTA). Standing rule: always merge to `main`.
- OTA delivery to device is reliable now (#197). User applies via cold restart; the
  in-app update button/Settings now also surface pending downloads.
- tsc passes for all current code. Jest: no tests cover the header files.
