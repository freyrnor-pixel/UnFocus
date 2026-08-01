# Stale/Unused Code Audit — 2026-08-01

Scope: a full headless test pass (typecheck, jest, lint, the web-preview flow-test)
plus a source-level sweep for dead code and stale references — not just the
doc-vs-doc drift `DESIGN_RULES_AUDIT.md` already tracks, but things that live in
`lib/`/`store/`/`app/`/`components/` themselves. Triggered by a report of stale
"cream"/"orange" theme references and BubbleMenu mentions; both turned out to be
real, plus a few nobody had written down yet.

**Update, same day:** every "New finding" below was fixed in a follow-up pass — see
§5. The findings sections below are left as originally written (the state found, not
the state after fixing) so the "before" is still legible; §5 is the record of what
changed and why.

---

## 1. Test results (headless — no device, per AGENTS.md's testing section)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **Clean.** No errors. |
| `npx jest` (full suite) | **994/994 passed**, 65 suites, 18.9s. |
| `npx eslint .` | **0 errors, 20 warnings** (listed in §3.3 — all pre-existing, none introduced here). |
| `npm run preview` (Expo Web + Playwright: onboarding → guided tour → all 5 tabs → add task/habit/medicine+dose → notes edit/send-to → layout switch → Settings) | **0 page errors, 0 console errors.** Every scripted flow (incl. the SQLite write→read round-trips) reported `true`. |

The app and its logic layer are healthy. Everything below is about **leftover
references and dead wiring**, not breakage.

---

## 2. New findings (not previously documented anywhere in the repo)

### 2.1 Five orphaned `bubble_*` SQLite columns — the actual leftover code from BubbleMenu

`BubbleMenu` itself is thoroughly documented as deleted (AGENTS.md, CLAUDE.md,
`PREFERENCES.md`, `USABILITY_ANALYSIS.md`, `AUDIT.md` all confirm
`components/BubbleMenu.tsx` doesn't exist). What nothing mentions is that its
settings columns are still being created on every fresh install, and they are
**more orphaned than the documented "Inert columns"** — those at least have a
mapped TS field and a value you can read from the store; these have neither:

```
lib/db.ts:310  "ALTER TABLE settings ADD COLUMN bubble_material TEXT DEFAULT 'glass'",
lib/db.ts:319  "ALTER TABLE settings ADD COLUMN bubble_size REAL DEFAULT 50",
lib/db.ts:320  "ALTER TABLE settings ADD COLUMN bubble_spacing REAL DEFAULT 78",
lib/db.ts:321  "ALTER TABLE settings ADD COLUMN bubble_spring_intensity REAL DEFAULT 50",
lib/db.ts:322  "ALTER TABLE settings ADD COLUMN bubble_anim_speed REAL DEFAULT 50",
```

Grepped for `bubbleMaterial`/`bubbleSize`/`bubbleSpacing`/`bubbleSpringIntensity`/
`bubbleAnimSpeed` (camelCase, as they'd appear if mapped) across every `.ts`/`.tsx`
file: **zero matches outside `lib/db.ts` itself.** They're not in the `Settings`
type, not in any `FieldMap`, not read or written anywhere. `useSettingsStore.ts`'s
own "Inert columns" doc block (line 81) — which exists specifically to track this
class of leftover — doesn't mention them.

- Per this repo's "never drop a column" rule, deleting the migration lines isn't
  the fix (`PRAGMA user_version` indexes into the array).
- **Fixed — see §5.1.** Documented, matching the existing pattern: added to a new
  "Orphaned columns" note in `store/useSettingsStore.ts` (right after the existing
  `glassBlur`/`glass_blur` precedent for a column that never had a TS field), plus a
  one-line `ORPHANED` comment at each migration line in `lib/db.ts`. A sixth column
  pair, `custom_primary_color`/`custom_secondary_color` (the deleted pre-rebuild
  custom-theme system's colour pickers), turned up the same way while fixing this
  and got the same treatment.

### 2.2 `app/(tabs)/plans.tsx` computes field-level glow data and then discards it

`lib/useNewSinceSeen.ts` returns `{ ids, fields }` — `fields` drives `NewSinceGlow`'s
`tight` mode, the per-field "a value appeared when you switched layout" marker
(e.g. a price becoming visible). `app/(tabs)/shopping.tsx:608` uses both halves and
threads `newFields` all the way down through `WeekListCard` → `ShoppingRow`, which
wraps its meta line and price in their own tight-mode `NewSinceGlow`s
(`components/ShoppingRow.tsx:314,336`).

`app/(tabs)/plans.tsx:859-871` calls the same hook and destructures
`fields: newFields` — but nothing downstream ever receives it. `TaskCard` (the
component every Plans list row renders through) takes no `newFields` prop at all;
its only `NewSinceGlow` usage (`components/TaskCard.tsx:667`) is whole-row,
non-`tight`. `eslint` catches this as an unused-variable warning
(`'newFields' is assigned a value but never used`), but the actual bug is one
level up: the Plans tab's layout system exposes `showMeta`/`showPrice`/`showExtras`
per layout (exactly the kind of per-field reveal `tight` glow exists for — see
`layoutSpec.showMeta`/`showPrice`/`showExtras` fed into the same hook call), so
switching e.g. into a layout that reveals price on a task row currently gets
**no** glow on that price — only a brand-new row gets marked. Shopping has this;
Plans doesn't, and there's no design note saying that's deliberate.

- **Fixed — see §5.2.** Flagged as an incomplete port rather than an intentional
  Plans/Shopping difference; the maintainer chose to wire up the missing feature
  (rather than just delete the dead variable) so Plans matches Shopping's field-level
  glow behaviour.

### 2.3 Minor: unused imports flagged by `eslint` (test files only)

| File | Warning |
|---|---|
| `__tests__/useEnergyStore.test.ts:10` | `'db'` imported but never used |
| `lib/__tests__/firstRunOptions.test.ts:22,29` | `'HANDEDNESS_SETTINGS'`, `'handednessChoiceOf'` imported but never used |

Test-only, no runtime effect. Trivial cleanup, listed for completeness since the
task asked for stale/unused references broadly. **Fixed — see §5.3.**

### 2.4 Verified clean (checked, not stale)

- No orphaned `components/*.tsx` or `lib/*.ts`/`store/*.ts` files — every file is
  referenced from somewhere else in the tree. (The four `lib/*.web.ts` files that
  a naive "grep for the basename" check flags are the documented Metro
  `.web` sibling-resolution pattern, not dead code — see AGENTS.md.)
- Every file AGENTS.md/CLAUDE.md claim is deleted (`lib/bonsai.ts`,
  `components/BonsaiCard.tsx`, `components/BonsaiTree.tsx`, `app/first-run.tsx`,
  `app/onboarding/{intro,language,features}.tsx`, `components/HomeGoalsCard.tsx`,
  `components/DebugOverlay.tsx`, `components/BubbleMenu.tsx`) is genuinely absent.
- `t.nav.close` (an i18n key `USABILITY_FIX_PLAN.md:216` lists as a stale reference
  to clean up) no longer exists in `lib/i18n.ts` — already fixed in code; the plan
  doc's action item is done and just never got checked off (see §3.4).

---

## 3. Stale references already partially documented elsewhere — verified + consolidated

The repo already tracks some of this in `DESIGN_RULES_AUDIT.md`'s "Stale docs found
along the way" table. Re-verified each row against the current tree and added what
that table doesn't cover.

### 3.1 `COLOR_THEME_LIBRARY.md` — describes a theme system that was removed at the rebuild

Confirmed still 100% inaccurate against `constants/theme.ts`/`constants/colors.ts`:
documents 6 named colour themes (Default/Tech/Gothic/Nature/Fluffy/Custom) and a
token set (`theme.cream`, `theme.orange`, `theme.orangeLight`, `theme.brown`,
`theme.brownLight`, `theme.white`, `theme.offWhite`, `theme.gray`, `theme.grayLight`)
— none of which exist. Grepped every `.ts`/`.tsx` file for `.orange`/`.cream` as a
theme-token access: zero hits anywhere in real code. The actual system is one
theme (`ThemeName = 'default'`, light/dark only) with tokens `bg`/`surface`/
`surfaceMuted`/`surfaceInset`/`text`/`textMuted`/`accent`/`accentInk`/`border`/the
feature-colour octet. `REBUILD_DECISIONS.md` itself already contains a callout
(lines 8-12) warning readers off exactly this doc. This was already flagged in
`DESIGN_RULES_AUDIT.md`'s table — confirmed still true, not re-fixed there.
**Fixed — see §5.4.**

**Also stale, not in that table**: `DESIGN_SYSTEM_LIBRARY_INDEX.md` — the doc whose
whole job is routing readers to the right library — still uses `theme.orange` as
its own worked example in its "Key Principle" section (line 54: *"always use
tokens (`Spacing.md`, `FontSize.lg`, `theme.orange`, etc.)"*). The index that's
supposed to be trustworthy repeats the dead token name. **Fixed — see §5.4.**

### 3.2 `DESIGN_SYSTEM_IMPLEMENTATION.md` — self-flagged for deletion, still here

`DESIGN_SYSTEM_LIBRARY_INDEX.md` (lines 60-63) already calls this out as "a frozen
2026-06-25 checklist from an earlier, now-superseded design pass... not a live
reference... flagged for the maintainer to confirm deletion." It's still a 382-line
file in the repo root, last touched 2026-07-27 (a month after being flagged),
referencing a "5 colour schemes" system and a `components/TaskItem.tsx` that don't
exist. Nobody has actually deleted it; it's dead weight sitting next to the doc
that says it's dead. **Deleted — see §5.5.**

### 3.3 `ANIMATION_GUIDELINES.md`'s `tug()` haptic — confirmed genuinely unused

The doc already says `tug()` is "exported but currently unused (its intended
consumer, a radial `BubbleMenu`, was dropped before porting)". Confirmed by grep:
`lib/haptics.ts:61` is the only occurrence of `tug` in the codebase — zero call
sites. Accurate as documented; no action needed beyond noting it's still true.

### 3.4 Stale item in `USABILITY_FIX_PLAN.md` itself

Line 216 lists cleaning up "stale `t.nav.close`/BubbleMenu references" as an open
to-do. The `t.nav.close` half is already done (§2.4) — the plan doc just hasn't
been updated to reflect it. Small, but worth flagging since the doc reads as if
the work is still pending. **Fixed — see §5.6** (also confirmed the other two
"Documentation hygiene" bullets in that same doc were independently already done).

### 3.5 `DESIGN_RULES_AUDIT.md`'s own stale-doc table has one outdated row

Its table (line 229) says `AGENTS.md` references a `npm run wraps:all` script that
doesn't exist. Checked current `AGENTS.md`: it now only references `npm run wraps`
(with `--lang=no --width=360` flags) — the `wraps:all` mention is gone. That row is
no longer accurate; the audit meant to catch drift has itself drifted. **Fixed — see
§5.7.**

---

## 4. Summary table

| Item | Where | Status |
|---|---|---|
| 5 `bubble_*` DB columns (+ 1 more found while fixing: `custom_primary_color`/`custom_secondary_color`) | `lib/db.ts` | **Fixed 2026-08-01** — documented as orphaned (§5.1) |
| Plans tab drops `newFields` from the glow hook | `app/(tabs)/plans.tsx` | **Fixed 2026-08-01** — feature wired up to match Shopping (§5.2) |
| 3 unused test-file imports | `__tests__/useEnergyStore.test.ts`, `lib/__tests__/firstRunOptions.test.ts` | **Fixed 2026-08-01** — removed (§5.3) |
| `COLOR_THEME_LIBRARY.md` describes dead theme system | whole file | **Fixed 2026-08-01** — rewritten to match `constants/colors.ts` (§5.4) |
| `DESIGN_SYSTEM_LIBRARY_INDEX.md` still says `theme.orange` | line 54 | **Fixed 2026-08-01** (§5.4) |
| `DESIGN_SYSTEM_IMPLEMENTATION.md` flagged for deletion, still present | whole file | **Deleted 2026-08-01** (§5.5) |
| `tug()` haptic unused | `lib/haptics.ts:61` | Known (ANIMATION_GUIDELINES.md) — confirmed accurate, left as-is (still reserved for a feature that may return) |
| `t.nav.close` cleanup item is done but doc says pending | `USABILITY_FIX_PLAN.md:216` | **Fixed 2026-08-01** — plan doc updated (§5.6) |
| `DESIGN_RULES_AUDIT.md`'s `wraps:all` row is outdated | `DESIGN_RULES_AUDIT.md:229` | **Fixed 2026-08-01** (§5.7) |
| `SPACING_LAYOUT_LIBRARY.md`'s `Radius` numbers + `theme.white`/`theme.cream` samples | whole file | **Fixed 2026-08-01**, found while fixing the above (§5.7) |
| No orphaned component/lib/store files | — | Verified clean, no action needed |
| All AGENTS.md-claimed deletions (Bonsai, BubbleMenu, first-run.tsx, etc.) | — | Verified clean, no action needed |

---

## 5. Follow-up fixes applied (2026-08-01, same-day)

The maintainer asked for the findings above to actually be cleaned up rather than
left as recommendations. What changed, file by file:

### 5.1 Orphaned DB columns documented

`store/useSettingsStore.ts`'s header gained a new "Orphaned columns that never even
had a TS field" bullet (next to the existing `glassBlur` precedent), listing all six
columns (`bubble_material`, `bubble_size`, `bubble_spacing`,
`bubble_spring_intensity`, `bubble_anim_speed`, `custom_primary_color`,
`custom_secondary_color`) and why each exists. `lib/db.ts` got a one-line `ORPHANED`
comment at each migration line pointing back to that note. Columns themselves are
untouched, per the never-drop-columns rule.

### 5.2 Plans tab field-level glow wired up

`components/TaskCard.tsx` gained a `newFields?: { meta, price, extras }` prop and
wraps its time label, assignee cue, each tag pill, and goal dot in `tight`
`NewSinceGlow`s keyed to `meta`/`meta`/`meta`/`extras` respectively — mirroring
`ShoppingRow`'s meta/price pattern. `app/(tabs)/plans.tsx` now passes `newFields`
into every `TaskCard` it renders (directly and via `FocusFirstToday`, which gained
the prop). `price` is accepted for type parity with `ShoppingRow` but is never true
for a task (no task has a price). Verified with `tsc --noEmit` + the full `jest`
suite (both clean/passing after the change — see the top-level task's test log).

### 5.3 Unused test imports removed

Dropped the unused `db` import from `__tests__/useEnergyStore.test.ts` and the
unused `HANDEDNESS_SETTINGS`/`handednessChoiceOf` imports from
`lib/__tests__/firstRunOptions.test.ts`. `eslint` warning count dropped from 20 to
16 (the remaining 16 are pre-existing, unrelated to this audit — import ordering in
`habits.tsx`, a `react-hooks/exhaustive-deps` warning in `BottomNav.tsx`, and two
`require()`-style imports in `padState.test.ts`).

### 5.4 `COLOR_THEME_LIBRARY.md` rewritten, `DESIGN_SYSTEM_LIBRARY_INDEX.md` fixed

`COLOR_THEME_LIBRARY.md` is now a from-scratch reference matching
`constants/colors.ts`'s real single-theme token system: the full `ThemePalette`
token table, the four-hue card-identity system (and its load-bearing L*
constraint), `contrastOn`/`contrastRatio`, and the real `getMaterialStyle`/
`getGlow` surface-finish helpers — replacing the 6-theme/`theme.cream`/
`theme.orange` content entirely. `DESIGN_SYSTEM_LIBRARY_INDEX.md`'s "Key
Principle" section now cites `theme.accent` instead of `theme.orange`, and its
callout about `DESIGN_SYSTEM_IMPLEMENTATION.md` now says it was deleted rather
than flagging it as still-pending.

### 5.5 `DESIGN_SYSTEM_IMPLEMENTATION.md` deleted

Removed outright — confirmed before deleting that it had zero unique content
(entirely superseded by `DESIGN_RULES.md`/`DESIGN_RULES_AUDIT.md` and the other
`*_LIBRARY.md` files), and that `DESIGN_SYSTEM_LIBRARY_INDEX.md` had already flagged
it for exactly this five-plus weeks ago.

### 5.6 `USABILITY_FIX_PLAN.md` to-dos closed out

Point 10's cross-reference to the `t.nav.close`/BubbleMenu cleanup now says it's
done. The "Documentation hygiene" section is marked ✅ done with a per-bullet
confirmation (BubbleMenu references, `app/task-form.tsx`/`app/habit-form.tsx`
headers, "SiteSwipeView dropped" comments — all three independently verified clean).

### 5.7 `DESIGN_RULES_AUDIT.md`'s stale-doc table corrected, `SPACING_LAYOUT_LIBRARY.md` fixed

The table's `wraps:all` row is corrected to note it was itself outdated. The
`COLOR_THEME_LIBRARY.md`/`DESIGN_SYSTEM_IMPLEMENTATION.md` rows now say what
happened instead of "not done here". `SPACING_LAYOUT_LIBRARY.md`'s `Radius` numbers
(`sm`/`md`/`lg` were 10/18/26, corrected to 12/16/24 to match `constants/theme.ts`)
and its `theme.white`/`theme.cream` code-sample references (corrected to
`theme.surface`/`theme.bg`) were fixed in the same pass, since the table already
flagged that file's `Radius` drift and the token-name errors were sitting right
next to it.

**Deliberately not done, and flagged instead** (`DESIGN_RULES_AUDIT.md`'s table
carries the detail): the same dead token names also appear in code samples across
`BUTTON_LIBRARY.md` (16 occurrences), `CARD_CONTAINER_LIBRARY.md` (23),
`ICON_LIBRARY.md` (10), `SHADOW_ELEVATION_LIBRARY.md` (9), and
`FORM_PATTERNS_LIBRARY.md` (4). That's a bigger, separate five-file reconciliation
pass, not a quick swap — left for a dedicated follow-up rather than rushed here.
`PROGRESS_LOG.md` and `REBUILD_DECISIONS.md` also contain many of these names, but
correctly so (dated history) and were not touched.

### Verification

`npx tsc --noEmit` and the full `npx jest` suite (994/994) both stayed clean/passing
after every code change in §5.1–5.3; `npx eslint .` dropped from 20 to 16 warnings
(the 4 fixed, no new ones introduced). Doc-only changes (§5.4–5.7) don't affect
either check.
