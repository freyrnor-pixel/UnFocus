# SETTINGS_GAP_2026-09-08.md — the Settings screen against `Settings_Screen_2026-09-08.html`

**Run:** 2026-09-08, from a maintainer upload of a Settings mockup plus one instruction:
*"Settings screen has to be updated."*
**Source audited:** `docs/audit/Settings_Screen_2026-09-08.html`, committed beside this file so
the next reader can check every claim below. (The v3 audit had to open by noting its mockup was
*not* in the repo and every claim was therefore unverifiable — see `V3_GAP_2026-09-07.md` §0.
Committing the source first is now the habit.)

**Scope, decided with the maintainer before any code was written:**
1. Restructure to the mockup's information architecture, using settings that **already exist**.
2. Leave out the rows the mockup draws that this repo removed on purpose.

So this is not an audit that ends in a recommendation — the restructure shipped in the same
commit. What follows is the ledger of what moved, what was skipped, and why.

**Method:** the same four buckets `V3_GAP_2026-09-07.md` established — (a) built · (b) conflicts
with a shipped decision · (c) absorbed with a documented deviation · (d) a feature build, not a
settings row. Bucket (b) is again the one that matters.

---

## Bottom line

**The mockup is a good specification of STRUCTURE and a poor specification of INVENTORY.**

Its structural argument is correct and was worth acting on: Settings had drifted back to one
overloaded General tab plus a catch-all called "Personal" holding three unrelated subjects, and
every group was a collapsed accordion. The mockup answers both — topic tabs, and no accordions.
That half is built.

Its inventory is a different app. Of the ~45 rows it draws, **13 are settings this repo deleted
with evidence, or features that have never existed.** Four of those five Appearance groups
(colour themes, custom accent hue, materials, wallpaper) are the largest single block in the
mockup and none of them has any backing in the code at all.

Two things stopped the structure from being copied literally:

1. **Five tabs do not fit.** Measured, not estimated. §3.
2. **The mockup's own visual language is not this app's** — it is flat iOS-Settings on `#EDEFF3`,
   and it consumes 20+ CSS custom properties from a `styles.css` that was not supplied (the same
   blocking gap as v3 §1). Its LOOK was therefore not treated as normative; its STRUCTURE was.

---

## 1. Built (bucket a)

| mockup | where it landed |
|---|---|
| "Lister" as its own tab | `tab === 'lists'` — Shopping cadence + a new Content card |
| "Varsler" as its own tab | `tab === 'notifications'` — the whole notification card, unchanged |
| Profil = name + language, no accordion | General, flat card |
| Utseende = dark mode + text size, no accordion | General, flat card (see §3 for why not its own tab) |
| Tilgjengelighet | General, flat card — was a tab away on Personal |
| "Innhold" links | Lists → Content: Catalogue and Food |
| Permissions grouped with data | More, beside Backup/Version |
| Flat, always-open cards throughout | every card except Shopping (§4) |

## 2. Conflicts with a shipped decision (bucket b) — NOT built

Each row below writes a column **nothing in the app reads.** Restoring the UI would restore the
exact defect the deletion was recorded to fix. Re-read the cited note before reviving one.

| mockup row | removed | evidence |
|---|---|---|
| Jobb-modus, Aktiver automatisk, Arbeidstid, Arbeidsdager | 2026-07-25 | columns inert; `useSettingsStore.ts` "Inert columns" |
| Norske helligdager | 2026-07-25 | same |
| Månedlig budsjett | 2026-07-22 | budget is per Monthly list (`useMonthlyListStore.ts`); the global `monthlyBudgetNok` is inert |
| Last inn / Fjern testdata | 2026-08-17 | `freyrMode*`; `lib/freyrModeSeed.ts` survives with no caller |

`showHints` deserves its own line because it is the subtle one. The mockup's "Tips og
forklaringer" maps to a real `Settings` field with a real column — and **zero consumers**. It
would have been the easiest row here to add and would have done nothing, silently. Same class as
the photo-format picker deleted on 2026-08-17: a control over a value nothing reads.

## 3. Absorbed with a documented deviation (bucket c)

**Four tabs, not five, and the fourth is "More" / "Mer" / "Meira".**

Appearance was built as its own tab first, exactly as drawn. Then `npm run wraps --lang=no
--width=360`:

```
TRUNCATED single-line text: 10
  over by 30px | avail=35 15px [settings] "Utseende"
  over by 29px | avail=33 15px [settings] "Avansert"
  over by 28px | avail=32 15px [settings] "Generelt"
  over by 23px | avail=27 15px [settings] "Varsler"
  over by 18px | avail=20 15px [settings] "Lister"
```

All five at once — the row had ~294px and the five labels needed ~395px. `components/TabSlider.tsx`
has no scroll mode **by design**, and its header names this remedy directly: *"if a caller's
options don't fit in one non-scrolling row, the fix is the caller's: shorten the labels or merge
two tabs into one, not add scrolling back."* Both were needed — four tabs still overflowed while
the fourth label was "Avansert" (62px).

Appearance and Accessibility merged into General; `advanced`'s **tab label** became the short word
while `config.sections.advanced` keeps the long form. Re-measured:

| language | tab truncations before | after |
|---|---|---|
| Norwegian | 5 | 0 |
| Icelandic | — | 0 |

(Norwegian's remaining single truncation, `"Bare det viktigste"`, is a layout-detail label that
predates this change and is untouched by it; Icelandic's two `health-form` ones likewise.)

⚠️ **Re-splitting these tabs, or restoring "Avansert"/"Advanced" as the fourth label, requires
re-running wraps in all three languages first.** Icelandic is the binding one — "Tilkynningar" is
twelve characters, which is why the Icelandic tab label is "Boð".

## 4. One accordion survives, on purpose

Every card is open now **except Shopping**, which stays a `DisclosureRow` because it is the one
`?section=` deep-link target: the link has to have something to open and scroll to
(`SettingsSection` in `app/settings.tsx`, guarded by `__tests__/settingsDeepLink.test.ts`).
Flattening it would break the deep-link contract, not just its appearance.

`?tab=personal` is now an invalid tab and falls back to General. That is safe today and the test
proves it: the sender-agnostic scan finds **no** `/settings?…` link anywhere in the app. There is
deliberately no back-compat alias — an alias for a tab nothing links to is a guess kept alive.

## 5. A feature build, not a settings row (bucket d) — NOT built

The mockup's Utseende tab is four groups deep in features that have no backing in this codebase:

| mockup | reality |
|---|---|
| Fargetema — 6 themes | `export type ColorTheme = 'default'` — a single-member union. `THEMES` has one entry |
| Egen aksentfarge (hue slider) | `custom_primary_color`/`custom_secondary_color` are **orphaned columns** — never mapped into the store, no `update()` path. From the pre-rebuild theme system |
| Materiale — Glass/Metall/Stein/Papir/Enkel | `bubble_material` is orphaned too, from the `BubbleMenu` dropped before porting (Decision 008 #5). And the app was deliberately **flattened** on 2026-09-07 — there is no `BlurView` left — so this would reverse a shipped decision *and* need a new surface-rendering layer |
| Bakgrunnsbilde | nothing, in any file |
| Følgesvenn (name + 5 species) | nothing |
| Behold fullførte varer · Grupper etter butikkavdeling | no setting; aisle grouping is surface-local state |
| Kamera-tillatelse | no setting (the camera is requested at the point of use) |

Each is a genuine feature request wearing a settings row's clothes. None was half-built to make
the screen resemble the picture — a toggle over a value nothing reads is the specific failure
this repo has removed five times already.

---

## What a next session would need

To build §5's Appearance block properly, in dependency order:

1. **The mockup's `styles.css` was not supplied** — 20+ custom properties (`--color-primary`,
   `--surface-card`, `--radius-md`, `--priority-high`, …) are consumed and none defined. Same
   blocker as v3 §1. Not needed for the restructure that shipped; **required** before anyone
   claims to have matched the mockup's colours.
2. A decision on whether colour themes come back at all — `docs/archive/COLOR_THEME_LIBRARY.md`
   records the system being deliberately collapsed to one palette. This mockup is the first thing
   since to ask for six, and it does not say why.
3. Only then: authoring 5 × (light + dark) palettes, and a re-bless of every visual baseline.
