# Stale/Unused Code Audit — 2026-08-01

Scope: a full headless test pass (typecheck, jest, lint, the web-preview flow-test)
plus a source-level sweep for dead code and stale references — not just the
doc-vs-doc drift `DESIGN_RULES_AUDIT.md` already tracks, but things that live in
`lib/`/`store/`/`app/`/`components/` themselves. Triggered by a report of stale
"cream"/"orange" theme references and BubbleMenu mentions; both turned out to be
real, plus a few nobody had written down yet.

**Nothing in this file was changed as part of writing it** — this is a documentation
pass only, per the task. Fixes are recommended, not applied.

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
- The fix is documentation, matching the existing pattern: add these five to the
  "Inert columns" note in `store/useSettingsStore.ts`, or a new one-line note next
  to them in `lib/db.ts` explaining they belong to a feature that was cut before
  ever reaching the settings layer.

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

- Not fixed here — flagging because it reads as an incomplete port rather than an
  intentional Plans/Shopping difference, and the fix (add `newFields` to
  `TaskCard`'s props, wrap its meta/price in `tight` `NewSinceGlow`s the way
  `ShoppingRow` does) is small if the maintainer wants it.

### 2.3 Minor: unused imports flagged by `eslint` (test files only)

| File | Warning |
|---|---|
| `__tests__/useEnergyStore.test.ts:10` | `'db'` imported but never used |
| `lib/__tests__/firstRunOptions.test.ts:22,29` | `'HANDEDNESS_SETTINGS'`, `'handednessChoiceOf'` imported but never used |

Test-only, no runtime effect. Trivial cleanup, listed for completeness since the
task asked for stale/unused references broadly.

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

**Also stale, not in that table**: `DESIGN_SYSTEM_LIBRARY_INDEX.md` — the doc whose
whole job is routing readers to the right library — still uses `theme.orange` as
its own worked example in its "Key Principle" section (line 54: *"always use
tokens (`Spacing.md`, `FontSize.lg`, `theme.orange`, etc.)"*). The index that's
supposed to be trustworthy repeats the dead token name.

### 3.2 `DESIGN_SYSTEM_IMPLEMENTATION.md` — self-flagged for deletion, still here

`DESIGN_SYSTEM_LIBRARY_INDEX.md` (lines 60-63) already calls this out as "a frozen
2026-06-25 checklist from an earlier, now-superseded design pass... not a live
reference... flagged for the maintainer to confirm deletion." It's still a 382-line
file in the repo root, last touched 2026-07-27 (a month after being flagged),
referencing a "5 colour schemes" system and a `components/TaskItem.tsx` that don't
exist. Nobody has actually deleted it; it's dead weight sitting next to the doc
that says it's dead.

### 3.3 `ANIMATION_GUIDELINES.md`'s `tug()` haptic — confirmed genuinely unused

The doc already says `tug()` is "exported but currently unused (its intended
consumer, a radial `BubbleMenu`, was dropped before porting)". Confirmed by grep:
`lib/haptics.ts:61` is the only occurrence of `tug` in the codebase — zero call
sites. Accurate as documented; no action needed beyond noting it's still true.

### 3.4 Stale item in `USABILITY_FIX_PLAN.md` itself

Line 216 lists cleaning up "stale `t.nav.close`/BubbleMenu references" as an open
to-do. The `t.nav.close` half is already done (§2.4) — the plan doc just hasn't
been updated to reflect it. Small, but worth flagging since the doc reads as if
the work is still pending.

### 3.5 `DESIGN_RULES_AUDIT.md`'s own stale-doc table has one outdated row

Its table (line 229) says `AGENTS.md` references a `npm run wraps:all` script that
doesn't exist. Checked current `AGENTS.md`: it now only references `npm run wraps`
(with `--lang=no --width=360` flags) — the `wraps:all` mention is gone. That row is
no longer accurate; the audit meant to catch drift has itself drifted.

---

## 4. Summary table

| Item | Where | Status |
|---|---|---|
| 5 `bubble_*` DB columns | `lib/db.ts:310,319-322` | **New finding** — orphaned, undocumented even in the "Inert columns" note |
| Plans tab drops `newFields` from the glow hook | `app/(tabs)/plans.tsx:861` | **New finding** — likely incomplete port vs. Shopping, not a documented decision |
| 3 unused test-file imports | `__tests__/useEnergyStore.test.ts`, `lib/__tests__/firstRunOptions.test.ts` | **New finding** — trivial, eslint-flagged |
| `COLOR_THEME_LIBRARY.md` describes dead theme system | whole file | Known (DESIGN_RULES_AUDIT.md) — confirmed still true |
| `DESIGN_SYSTEM_LIBRARY_INDEX.md` still says `theme.orange` | line 54 | **New finding** — the index itself, not just the library it points to |
| `DESIGN_SYSTEM_IMPLEMENTATION.md` flagged for deletion, still present | whole file | Known (self-flagged) — confirmed still not deleted, 5+ weeks later |
| `tug()` haptic unused | `lib/haptics.ts:61` | Known (ANIMATION_GUIDELINES.md) — confirmed accurate |
| `t.nav.close` cleanup item is done but doc says pending | `USABILITY_FIX_PLAN.md:216` | **New finding** — stale to-do, work already done |
| `DESIGN_RULES_AUDIT.md`'s `wraps:all` row is outdated | `DESIGN_RULES_AUDIT.md:229` | **New finding** — the audit's own table drifted |
| No orphaned component/lib/store files | — | Verified clean |
| All AGENTS.md-claimed deletions (Bonsai, BubbleMenu, first-run.tsx, etc.) | — | Verified clean |

No fixes were applied — this is the documentation pass the task asked for. The
recommended next step for each "New finding" row is a small, separate, reviewable
change (matching how `DESIGN_RULES_AUDIT.md` itself deferred its cleanup), not
bundled here.
