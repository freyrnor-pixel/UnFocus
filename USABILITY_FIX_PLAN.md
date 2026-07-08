# UnFocus — Usability Fix Plan (per point)

Companion to `USABILITY_ANALYSIS.md`. Each point below is **self-contained** so a
fresh session (post-`/clear`) can execute it without re-deriving context. Work on
branch `claude/app-usability-analysis-j88ev9` (PR #95). Follow `AGENTS.md`
conventions: all UI text through `useT()`/`lib/i18n.ts` (add to **both** `en` and
`no`), dates as `YYYY-MM-DD`, update the JSDoc `Connections:` header on any file
whose imports/callers change, run `npx tsc --noEmit` locally after each point.

Points are ordered by priority. Each is an independent commit — do them one at a
time and push (updates PR #95). Read the named file's header before editing it.

---

## Point 1 — Reconcile color-theme keys (P0, highest impact) ✅ start here

**Problem:** Picker offers `['default','tech','gothic','nature','fluffy']`
(`app/settings.tsx:116`) but runtime `getThemePalette` only knows
`'default'|'summer'|'nature'|'fluffyPink'|'gothic'|'blackWhite'`
(`constants/colors.ts:38`, fallback-to-default at `:591-596`). So `tech`→Default,
`fluffy`→Default, and `blackWhite`/`summer` are unreachable.

**Decision needed before coding (ask the user):** which final theme set to ship?
Recommended: `['default','summer','nature','fluffyPink','gothic','blackWhite']`
(all six that actually have runtime palettes) — drops the broken `tech`, fixes
`fluffy`→`fluffyPink`, and exposes `blackWhite` (high-contrast) + `summer`.

**Steps (for the recommended option):**
1. `store/useSettingsStore.ts:41` — change `ColorTheme` union to the six runtime keys.
   Add a migration mapping for existing installs: any stored `'tech'` or `'fluffy'`
   → remap on load (`'fluffy'`→`'fluffyPink'`, `'tech'`→`'default'`) in the store's
   `load()` so persisted bad values don't linger.
2. `app/settings.tsx:116` — set `COLOR_THEME_KEYS` to the six runtime keys.
3. `app/settings.tsx:903` — swatch preview reads `THEMES[key].orange` from
   `constants/theme.ts`. Confirm `constants/theme.ts THEMES` has entries for all six
   keys (esp. `summer`, `fluffyPink`, `blackWhite`); if not, add preview swatch colors
   there (pull representative accent from `constants/colors.ts`).
4. `lib/i18n.ts themeNames` — ensure EN+NO labels exist for all six keys
   (add `summer`, `fluffyPink`, `blackWhite`; remove/keep `tech`/`custom` as unused).
5. `app/onboarding/step5.tsx:63-64` — same key set as the picker.
6. Verify `getThemePalette` receives only valid keys now; the fallback stays as a safety net.

**Verify:** launch app, open Settings › Utseende, select each theme, confirm the
rendered accent/background actually changes (not all-blue). Check onboarding step 5 too.

**Note:** `constants/theme.ts`'s `getTheme`/`buildCustomTheme`/`getSoftTheme` are dead
(preview-only). Out of scope here — do not wire them.

---

## Point 2 — Disambiguate "Focus mode" naming (P0, cheap)

**Problem:** Settings "Focus mode" persists `essentialsModeEnabled`
(`app/settings.tsx:310-321`); the Home header eye toggle is ephemeral `useState`
reset on navigate-away (`app/index.tsx:23-24,97-98,131-132`). Same name, unrelated.

**Steps:**
1. Rename the Home transient control's label to something distinct, e.g.
   "Calm view" / "Hide extras" (NO: "Ro-visning" / "Skjul ekstra"). The label comes
   from a hint/tooltip; the control is the eye in `components/ScreenHeader.tsx:79-90`.
   Add a new i18n key rather than reusing the essentials label.
2. Leave the persisted Settings toggle as "Focus mode" (or rename it instead — pick
   one owner of the name). Confirm the two no longer collide in i18n.

**Verify:** the Settings label and the Home eye tooltip read as two different things.

---

## Point 3 — Fix Home hint symbol + mount it (P0, cheap)

**Problem:** `hints.home` says "tap ⭐" (`lib/i18n.ts:912-915`) but the control is an
eye icon; and Home (`app/index.tsx`) mounts **no** `HintCard`, so the hint never shows.

**Steps:**
1. Edit `hints.home` (EN+NO) to reference the eye, and update the copy to match the
   renamed control from Point 2 (do Point 2 first for consistent wording).
2. Mount `<HintCard section="home" />` (match the existing HintCard API — see any
   mounted example, e.g. `app/plans.tsx:72`) near the top of Home's scroll content in
   `app/index.tsx`. Gated on `settings.showHints` automatically (`HintCard.tsx:41`).
3. Optional: also mount authored-but-unused hints where sensible (`hints.shopping` on
   `app/shopping.tsx`). Keep scope tight — Home is the required fix.

**Verify:** with hints enabled, Home shows a hint that names the eye control correctly.

---

## Point 4 — Split the notification toggle (P0)

**Problem:** The "Planvarsler" switch writes both `taskNotificationsEnabled` AND
`habitNotificationsEnabled` (`app/settings.tsx:828-831`); no separate habit control.

**Steps (recommended: two independent toggles):**
1. `app/settings.tsx` Varsler tab — split into two switch rows: "Task reminders"
   (`taskNotificationsEnabled`) and "Habit reminders" (`habitNotificationsEnabled`),
   each writing only its own field via `applyAndSync()`.
2. Add i18n labels/hints for both (EN+NO).
3. Re-sync path: confirm the screen still re-syncs reminders on change (existing
   `applyAndSync()` already does; verify both fields are covered).
4. Check `store/useSettingsStore.ts` already has both fields (it does) — no migration needed.

**Verify:** toggling task reminders off leaves habit reminders on and vice-versa;
scheduled notifications reflect each independently.

---

## Point 5 — Localize currency (P0)

**Problem:** Money uses `toFixed()` + hardcoded `" kr"` (`.` decimals), wrong for NO.
Call sites: `lib/i18n.ts:172,1119`, `app/budget.tsx:190,209`, `app/scan.tsx:583`,
`components/ShoppingRow.tsx:273`, `components/MonthlyResetSummaryModal.tsx:65-90`,
`components/MonthlyTableRow.tsx:80-83`, `components/AddItemSheet.tsx:178`,
`components/AddDishSheet.tsx:305`, `components/AddSourceChooser.tsx:179`.

**Steps:**
1. Add `formatCurrency(amount: number, lang?: string): string` to `lib/` (near
   `lib/date.ts`'s locale helpers, or in `lib/date.ts` itself for locality). NO →
   comma decimal + non-breaking-space thousands + " kr"; EN → current `.` style.
   Read current lang from the settings store when `lang` omitted (mirror
   `getTranslations()` pattern).
2. Replace every `.toFixed(2)+' kr'` / `${x.toFixed(2)} kr` call site above with
   `formatCurrency(x)`. Update each file's header `Connections:` import line.
3. For the two i18n strings that embed currency (`lib/i18n.ts:172,1119`), refactor so
   the number is formatted at the call site, not baked into the translation.

**Verify:** in NO, budget/scan/monthly totals show `1 234,50 kr`; in EN unchanged.

---

## Point 6 — Route stray placeholders through i18n (P0, small)

**Problem:** English/literal placeholders bypass `useT()`:
`app/task-form.tsx:356` `placeholder="min"` (the visible one); also `HH:MM`/time
literals at `app/task-form.tsx:306`, `app/habit-form.tsx:313,375,382`,
`components/QuickAddSheet.tsx:182` where `i18n.ts` already defines
`reminderTimePlaceholder`/`timePlaceholder`.

**Steps:**
1. Add a `minutesPlaceholder` (or reuse `durationLabel`-adjacent) key (EN "min",
   NO "min"/"minutter") and use it at `task-form.tsx:356`.
2. Replace hardcoded `"HH:MM"`/time literals with the existing i18n keys.

**Verify:** switch app to NO, open task/habit forms — no English placeholder text.

---

## Point 7 — Accessibility labels on shared primitives (P3, high leverage)

**Problem:** Icon-only buttons unlabeled; shared button primitives lack role/state.
One change to the shared primitives fixes many screens.

**Steps:**
1. `components/AddFAB.tsx:53-63` — add `accessibilityLabel` (from i18n, e.g. "Add") +
   `accessibilityRole="button"`; give the `'sm'` 32×32 variant a `hitSlop` to reach 44px
   (`AddFAB.tsx:41`).
2. `components/Button.tsx:66-92` — add `accessibilityRole="button"` and
   `accessibilityState={{ disabled, busy }}`.
3. `components/SaveButton.tsx:81-94` — add role/state; bump effective hit target to 44px.
4. `components/BottomNav.tsx:53-64` — add `accessibilityRole="button"` to all items and
   an `accessibilityLabel` to the icon-only centre Home button (use `t.nav.home`).
5. `components/ScreenHeader.tsx:74-77` — add `accessibilityLabel` to the settings gear
   (e.g. `t.nav`/settings label).
6. Follow the good reference: `components/IconButton.tsx:61-63`.

**Verify:** with a screen reader (or a11y inspector), the +, Home, gear, and disabled
buttons announce a name + role + state.

---

## Point 8 — Gesture affordances + Undo (P1, larger)

**Problem:** Swipe-nav, swipe-delete (destructive, no undo), long-press-drag reorder,
long-press-edit, and the pet feed mechanic have no visible affordance.

**Steps:**
1. Swipe-between-sites (`components/SiteSwipeView.tsx` via `ScreenScaffold.tsx:128-129`):
   add a subtle page/dot indicator or a first-run hint. Also fix stale "SiteSwipeView
   dropped" comments in site-screen headers (`app/shopping.tsx:93`, `app/scan.tsx:18`,
   `app/budget.tsx:18`, `app/automations.tsx:15`, `app/index.tsx:52`).
2. Shopping row swipe-delete (`components/ShoppingRow.tsx:186-215`): add an Undo action
   to the `ConfirmationBanner` shown after removal. Undo requires re-inserting the
   removed row — capture the row snapshot before delete. Note catalog items "return to
   inventory" vs delete (`:230-232`); Undo must restore the correct prior state.
   Undo was intentionally deferred (`REBUILD_DECISIONS.md:1761-1764`) — confirm with
   user before building.
3. Long-press-drag reorder (`components/DraggableTaskRow.tsx:116-140`): add a faint drag
   handle affordance.
4. Habits tap/long-press (`app/habits.tsx:271-273`): ensure `hints.habits` is mounted
   and clearly states "hold to edit".

**Verify:** each gesture has a discoverable cue; swipe-delete offers a working Undo.

---

## Point 9 — Navigation IA: surface Habits & Meals (P1)

**Problem:** Habits reachable only via Health (`app/health.tsx:359`); Meals only via a
Home "More" chip (`app/index.tsx:306`); Scan holds a top-level tab.

**Decision needed (ask user):** either (a) swap Scan out of the bottom nav for Habits
or Meals, or (b) add a clearer secondary launcher (e.g. a visible section on Home).
Bottom-nav items are defined in `lib/siteNav.ts` `SITE_ITEMS` — changing them touches
`components/BottomNav.tsx` and the `goToSite` shallow-stack logic. This is an IA
decision; do not change nav without user sign-off.

---

## Point 10 — Decide fate of stranded share/QR surfaces (P1)

**Problem:** `app/share-modal.tsx` has zero `push('/share-modal')` callers (Share pill
dropped, `app/shopping.tsx:92`); `app/shared.tsx`, `app/inventory-edit.tsx`,
`app/_scaffold-demo.tsx` are effectively orphaned.

**Decision needed (ask user):** (a) wire a Share entry point back into Shopping/Plans
headers and keep the feature, or (b) delete the dead surfaces (`share-modal.tsx`,
`_scaffold-demo.tsx`, possibly `inventory-edit.tsx`) plus their now-dead stores/i18n.
Either way, clean up the stale `t.nav.close`/BubbleMenu references noted in the doc-
hygiene section. Confirm direction before removing code.

---

## Point 11 — Onboarding consistency (P2)

**Steps:**
1. Add a "Skip for now" affordance to steps 4, 5, 6 to match steps 2–3
   (`app/onboarding/step2.tsx:156`, `step3.tsx:116` are the pattern).
2. Step 4 (`app/onboarding/step4.tsx:40-47`): make notifications an explicit opt-in
   toggle instead of silent auto-enable, and request the OS permission at that moment
   (currently only at step 6 finish, `step6.tsx:88`).
3. Step 3 (`step3.tsx:41-45`): surface the weekly-reset-day choice instead of silently
   forcing Monday.
4. Explore branch (`app/onboarding/guided.tsx:42-51`): after skipping, either introduce
   the pet later or add a one-time Home nudge that the pet/theme features exist.
5. Consider a time picker for the free-text `HH:MM` fields (step2/step3) — optional.

**Verify:** every onboarding step past the first is skippable; notifications are opt-in
with the OS prompt shown at opt-in time.

---

## Point 12 — Empty states, input feedback, material contrast (P4, polish)

**Steps:**
1. Standardize ad-hoc empty states on `components/EmptyState.tsx` with a CTA. Priority:
   Habits empty (`app/habits.tsx:386,472`) currently passes title-only and dead-ends —
   add an "Add habit" action button.
2. Settings invalid-input silent revert (`app/settings.tsx:750-757,770-781`): show a
   brief `ConfirmationBanner`/message on rejected numeric input.
3. Re-check `textMuted` contrast on rock/metal/glass material finishes
   (`components/Surface.tsx:107-108,159`, `constants/theme.ts:859-917`) — text tokens
   are tuned against the plain surface only. Adjust muted token per finish if <4.5:1.

**Verify:** habits empty state has a working CTA; rejected settings input shows feedback;
text stays legible on all material finishes.

---

## Documentation hygiene (bundle into whichever commit touches these files)

- Remove dead **BubbleMenu** references (`AGENTS.md`, `CLAUDE.md`, `constants/theme.ts`,
  `lib/i18n.ts` `t.nav.close`, various headers) — the component is deleted, not disabled.
- Fix stale "no caller wired yet" headers on `app/task-form.tsx`, `app/habit-form.tsx`.
- Fix stale "SiteSwipeView dropped" comments (it's mounted via `ScreenScaffold`).

---

## Recommended commit sequence
1–6 (P0 correctness, each its own commit) → 7 (a11y primitives) → 8, 9, 10 (each needs a
user decision first) → 11 (onboarding) → 12 (polish). Push after each; PR #95 updates.
Points 1, 9, 10 have open decisions flagged **"ask user"** — resolve those before coding them.
