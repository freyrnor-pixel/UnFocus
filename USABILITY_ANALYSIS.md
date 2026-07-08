# UnFocus — Usability & UX Analysis

_ADHD life-management app (Expo SDK 56, React Native, Expo Router, Zustand + SQLite, bilingual EN/NO)._
_Analysis date: 2026-07-04. Scope: navigation, onboarding, interactions, settings, i18n, accessibility, theming._

This is a review-only document — no code was changed. Findings are grouped by
severity and each carries a file reference and a concrete suggested improvement.
"Confirmed" items were verified against the source; "Observed" items are strong
signals worth a device check.

---

## P0 — Confirmed functional bugs (visible to users)

### 1. Two of five color themes silently render as Default; a high-contrast theme is unreachable
**Confirmed.** The settings picker and onboarding offer keys that the runtime
palette module does not recognize.

- Picker keys: `['default', 'tech', 'gothic', 'nature', 'fluffy']` — `app/settings.tsx:116`
- Runtime palette names: `'default' | 'summer' | 'nature' | 'fluffyPink' | 'gothic' | 'blackWhite'` — `constants/colors.ts:38`
- `getThemePalette()` falls back to Default for any unknown key — `constants/colors.ts:591-596`

Result:
- **`tech`** → not in `colors.ts` → renders Default (blue), though its swatch previews sky-blue.
- **`fluffy`** → runtime key is `fluffyPink`, not `fluffy` → renders Default, though its swatch previews pink.
- `default`, `gothic`, `nature` map correctly.
- **`blackWhite`** (a high-contrast accessibility theme) and `summer` exist in `colors.ts` but **cannot be selected** from the picker.
- Onboarding step 5 writes `colorTheme` from the same mismatched keys — `app/onboarding/step5.tsx:63-64`.

Root cause: `ColorTheme` (store), `themeNames` (i18n), `constants/theme.ts` `THEMES`
(swatch previews), and `constants/colors.ts` `THEMES` (runtime) have drifted out of
sync. Note `constants/theme.ts` is now **preview/swatch color only** — its
`getTheme`/`getSoftTheme`/`buildCustomTheme` helpers are not on any render path.

**Improvement:** reconcile the key sets to one source of truth. Rename `fluffy`→`fluffyPink`
(or alias it), add `tech` to `colors.ts` (or drop it from the picker), and expose
`blackWhite` as a selectable high-contrast option.

### 2. "Focus mode" names two unrelated features
**Confirmed.** Same label, two different behaviors and lifetimes:
- Settings › Generelt "Focus mode" persists `essentialsModeEnabled` — `app/settings.tsx:310-321` (`settings.tsx:52-53`).
- The Home header eye toggle is ephemeral local `useState`, reset on navigate-away — `app/index.tsx:23-24,97-98,131-132`.

A user toggling one expects the other to reflect it; they don't.
**Improvement:** rename one (e.g. Home's transient control → "Hide extras" / "Calm view")
so the persisted setting and the momentary toggle read as distinct.

### 3. Home hint points at "⭐", but the control is an eye — and the hint never shows
**Confirmed.** `hints.home` copy says _"tap ⭐ to focus on essentials only"_
(`lib/i18n.ts:912-915`), but the control is an eye icon (`components/ScreenHeader.tsx:79-90`).
Worse, **Home mounts no `HintCard`**, so the authored hint is never displayed at all
(`app/index.tsx`; confirmed no mount). `hints.shopping`, `hints.settings`,
`hints.shared`, `hints.automations` are likewise authored but unmounted.
**Improvement:** fix the symbol to match the eye, and mount the hint on Home (the one
screen whose hint teaches its own signature feature).

### 4. One notification switch silently controls both task and habit reminders
**Confirmed.** The "Planvarsler" toggle writes both `taskNotificationsEnabled` **and**
`habitNotificationsEnabled` together — `app/settings.tsx:828-831`. There is no separate
habit-notification control anywhere, so a user who wants habit reminders but not task
reminders (or vice-versa) cannot get it.
**Improvement:** split into two toggles, or relabel to make the combined scope explicit.

### 5. Currency is not localized for Norwegian
**Confirmed.** All money uses `toFixed()` + hardcoded `" kr"`, forcing `.` decimals
(NO convention is `1 234,50 kr`). No `Intl`/`toLocaleString` anywhere. Examples:
`lib/i18n.ts:172,1119`, `app/budget.tsx:190,209`, `app/scan.tsx:583`,
`components/ShoppingRow.tsx:273`, `components/MonthlyResetSummaryModal.tsx:65-90`,
`components/MonthlyTableRow.tsx:80-83`. (Dates _are_ localized correctly —
`lib/date.ts:92-116`.)
**Improvement:** a single `formatCurrency(amount, lang)` helper in `lib/` used everywhere.

### 6. Stray English placeholder in the NO UI
**Confirmed.** `app/task-form.tsx:356` hardcodes `placeholder="min"` (English word for the
duration field). Several time/number placeholders also bypass `useT()` even though
`i18n.ts` defines `reminderTimePlaceholder`/`timePlaceholder`: e.g.
`app/task-form.tsx:306`, `app/habit-form.tsx:313,375,382`, `components/QuickAddSheet.tsx:182`.
**Improvement:** route these through the existing i18n keys.

---

## P1 — Discoverability & intuitiveness

### 7. Whole-app swipe navigation has no visible affordance
**Confirmed.** `SiteSwipeView` is mounted on every site-tier screen via `ScreenScaffold`
(`components/ScreenScaffold.tsx:128-129`, default on), so left/right swipes move between
Home/Shopping/Plans/Health/Scan. There is **no dot indicator, edge peek, or hint** that
this exists — it's discoverable only by accident. (Several screen headers still say
SiteSwipeView is "dropped/not ported" — those comments are stale.)
**Improvement:** add a subtle page-indicator or first-run hint; at minimum fix the stale headers.

### 8. Load-bearing gestures are unlabeled, and destructive ones have no undo
**Confirmed.**
- Shopping row **swipe-left-to-remove** — `components/ShoppingRow.tsx:186-215`; reveal only
  appears mid-drag. For catalog items the same gesture "puts back to inventory" instead of
  deleting, cued only by a different icon (`:230-232`) — one gesture, two outcomes.
- **Long-press-drag to reorder** rows (~180 ms) — `components/DraggableTaskRow.tsx:116-140`; no handle.
- Habits: **tap = expand, long-press = edit** — `app/habits.tsx:271-273`; long-press-to-remove a
  linked child — `app/habits.tsx:631`. Only taught in one hint string.
- Pet: **drag a "treat" onto the pet to feed it** — `components/Pet.tsx:135-161`; entirely hidden.
- `WeekListCard`: tap the name to rename, tap the progress line to focus — `WeekListCard.tsx:202,232-238`.

No undo exists for swipe-delete or dish-merge — confirmed intentionally not built
(`REBUILD_DECISIONS.md:1761-1764`, `app/shopping.tsx:77`); only a passive
`ConfirmationBanner` (~2.2 s, `components/ConfirmationBanner.tsx:57`).
**Improvement:** add affordances (drag handles, static reveal chevrons) and an Undo action on
destructive confirmations.

### 9. Common sections are buried; niche ones hold prime nav slots
**Confirmed.** Bottom nav is Shopping / Plans / **Home** / Health / Scan (`lib/siteNav.ts`).
- **Habits** is reachable only through the **Health** screen (`app/health.tsx:359`) — a non-obvious parent.
- **Meals** ("Food") is reachable only via a Home "More" chip (`app/index.tsx:306`).
- **Scan** (a camera) occupies a top-level slot.

**Improvement:** reconsider whether Scan deserves a permanent tab over Habits/Meals, or add a
clearer secondary launcher for the buried sections.

### 10. The QR-share feature is stranded (no way to start a share)
**Confirmed.** `app/share-modal.tsx` has **zero `push('/share-modal')` call sites**; the Shopping
header "Share pill" was deliberately dropped (`app/shopping.tsx:92`). So a user can only
_receive_ a share (via Scan), never _initiate_ one. `app/shared.tsx` is reachable only through
that dead modal or an inbound scan; `app/inventory-edit.tsx` has no wired entry point (its own
header admits this); `app/_scaffold-demo.tsx` is a dev screen reachable only by direct URL.
**Improvement:** either wire a share entry point back in, or remove the stranded surfaces to cut
dead weight and confusion.

### 11. Focus (Home eye) resets silently, and header controls move with handedness
**Observed/Confirmed.** The Home eye toggle silently turns off on navigate-away
(`app/index.tsx:97-98`) with no persistence and no equivalent elsewhere. `ScreenHeader` mirrors
the gear/eye to the opposite corner when `leftHanded` is set (`components/ScreenHeader.tsx:71-109`)
— the settings gear can be top-left or top-right, which can surprise.
**Improvement:** persist Focus (or signal it clearly), and make handedness mirroring more predictable.

---

## P2 — Onboarding consistency

**Confirmed** (`app/onboarding/*`):
- **"Skip for now" exists on steps 2–3 but disappears on 4–6** (`step2.tsx:156`, `step3.tsx:116`; absent thereafter). A user who learned they can skip loses the option mid-wizard.
- **Step 4 auto-enables notifications** (`remindersEnabled`, `taskNotificationsEnabled`, a Sat-14:00 weekly reminder) with **no opt-out on that screen** — `step4.tsx:40-47`.
- **OS permission is only requested at Finish (step 6)** (`step6.tsx:88`), far from where notifications were "confirmed" in step 4 — deny → toggles read ON in Settings with no OS permission.
- **Weekly reset day is silently forced to Monday** (`step3.tsx:41-45`), collected nowhere.
- **The "Explore" branch leaves the pet disabled** and skips theme/handedness/work-mode with no later prompt — `guided.tsx:42-51`, `guided.tsx:19-20`. Those users get a materially different app and no signal the features exist.
- **Free-text `HH:MM` time inputs** with no picker; bad input silently reverts on blur — `step2.tsx:106,116`, `step3.tsx:78`.
- Progress dots advertise "6 steps" but the flow is 9 screens (language/privacy/guided sit outside the count).

**Improvement:** consistent skip affordance throughout, an explicit notifications opt-in on step 4
with the OS prompt at that moment, a visible weekly-reset choice, and a later nudge for
Explore-path users to enable the pet/theme.

---

## P3 — Accessibility

**Confirmed.** Only ~12 of 50 files with pressables set any accessibility props
(34 props across 226 pressables). `components/PressableScale.tsx` sets no default role.
- **Icon-only buttons with no screen-reader name:** the shared "+" `components/AddFAB.tsx:53-63`;
  the centre Home button `components/BottomNav.tsx:53-64`; the settings gear has a role but
  **no label** `components/ScreenHeader.tsx:74-77`. `app/index.tsx` (Home) has zero a11y props.
- **Shared primitives lack role/state:** `components/Button.tsx:66-92` (app-wide) sets no
  `accessibilityRole="button"` / disabled/busy state; `components/SaveButton.tsx:81-88` likewise.
  Good reference implementations exist (`components/IconButton.tsx:61-63`, `SwatchPicker.tsx:52-54`).
- **Sub-44px touch targets:** `AddFAB` `'sm'` is 32×32 with no `hitSlop` (`AddFAB.tsx:41`);
  `SaveButton` is height 34 (`SaveButton.tsx:93-94`).
- **Font scaling:** OS scaling is respected (no `allowFontScaling={false}`), but there is
  **no `maxFontSizeMultiplier` cap** anywhere, and many fixed-height containers +
  `numberOfLines={1}` (28 occurrences) will clip rather than reflow. The in-app font-size
  setting is applied inconsistently — inline `fontSize` bypasses `useScaledStyles`
  (`components/Button.tsx:88`, `AddFAB.tsx:62`), so that preference has uneven effect.

**Improvement:** add labels/roles to shared button primitives (fixes most gaps at once),
enforce 44px hit targets, and either cap font multipliers or let fixed-height chrome grow.

---

## P4 — Empty states, feedback & readability polish

**Confirmed.**
- **Inconsistent empty states:** a shared `components/EmptyState.tsx` (icon+title+CTA) is used in
  only two places (`app/habits.tsx:386,472`, `app/inventory-edit.tsx:100`) and there passed
  _title only_ — no guidance, no CTA. Everywhere else is ad-hoc muted `<Text>`
  (Home/notes/automations/shared/budget/health). Habits' empty state is a dead-end (no "add" CTA)
  despite `EmptyState` supporting one.
- **Silent settings writes:** `applyAndSync()`/`settings.update()` fire per toggle with no
  confirmation and no error handling (`app/settings.tsx:187-203`); invalid numeric input reverts
  with no message (`settings.tsx:750-757,770-781`).
- **Material finishes can undercut text contrast:** `getMaterialStyle` recolors surfaces
  (rock/metal darken; glass is translucent over an unknown backdrop) while text tokens stay tuned
  against the _plain_ surface — `components/Surface.tsx:107-108,159`, `constants/theme.ts:859-917`.
  Contrast becomes contingent on the Material setting, which isn't re-validated.
- **NO-string truncation risk:** longer Norwegian words in single-line chrome —
  `components/BottomNav.tsx:76` (tab labels), `ScreenHeader.tsx:98` (title).

**Improvement:** standardize on `EmptyState` with a CTA, surface rejected-input feedback, and
re-check `textMuted` contrast on the rock/metal/glass finishes.

---

## Documentation hygiene (not user-facing)

- `AGENTS.md` / `CLAUDE.md` and several headers describe **BubbleMenu** (radial FAB) as
  "commented out." It is in fact **deleted** — `components/BubbleMenu.tsx` does not exist
  (`REBUILD_DECISIONS.md:132`). Dead references remain in `constants/theme.ts`, `lib/i18n.ts`
  (`t.nav.close`), and multiple headers.
- Stale "no caller wired yet" headers on `app/task-form.tsx` and `app/habit-form.tsx` (both now
  have callers), and "SiteSwipeView dropped" comments on several site screens (it's mounted).

---

## Suggested priority order

1. **Theme key mismatch (#1)** — two themes are broken today and a high-contrast option is hidden. Highest impact, contained fix.
2. **Notification toggle split (#4)** and **i18n gaps (#5, #6)** — small, high-confidence correctness fixes.
3. **"Focus mode" naming + Home hint (#2, #3)** — cheap clarity wins.
4. **Accessibility labels on shared primitives (#7 in P3)** — one change to `Button`/`AddFAB`/`BottomNav` fixes many screens.
5. **Gesture affordances + Undo (#8)** and **onboarding consistency (P2)** — larger, higher-value UX work.
6. **Decide the fate of the stranded share/QR surfaces (#10).**
