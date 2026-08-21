# Handoff — Neurodivergent UI redesign (Shopping/Tasks/Menu/Health/Scan)

**Branch:** `claude/neurodivergent-ui-redesign-x2xji7`
**Status:** All planned work implemented + verified headlessly. PR open into `main`.
**Approved plan:** `/root/.claude/plans/shopping-neurodivergent-...md` (mirrored below).

The maintainer reported all 5 main screens read as "cheap" / low-contrast / hard to
parse for the target users (autism, ADHD, anxiety, depression). This branch fixes
the shared card system + per-screen structure, and adds a People/family assignment
mode. Four scope decisions were confirmed with the user before implementing:
1. **Global** card/depth overhaul (not just targeted patches).
2. Tasks: chevron-collapse **keeps the task as unfinished** (auto-save), never discards; blank new card is dropped. Explicit Discard stays the delete path.
3. Include **people/family assignment in Tasks now**, gated by a new Settings toggle.
4. Gate: a **new "People / family" toggle**; profile management **moved to Settings** (shared by Tasks + Habits).

## What's done (commit-by-commit on the branch)

1. **Foundation** — `components/Surface.tsx` now uses an opaque `theme.border` edge
   (light mode keeps the glass top highlight) instead of the invisible
   translucent-white material edge. `constants/colors.ts` light palette deepened
   `surfaceMuted #E4EEF9` / `surfaceInset #D3E4F6` and strengthened `border #9BBBE6`
   (all validated AA via `contrastRatio()`). `components/SlideSelector.tsx` track
   gets a border. Decorative 🌿 stripped from `timelineEmpty`/`dayViewAllDone`/
   `noPlansToday` in `lib/i18n.ts` (both langs).
2. **People/family plumbing** — new `peopleModeEnabled` setting + `tasks.assignee`
   column (migrations in `lib/db.ts`); wired through `store/useSettingsStore.ts` and
   `store/useTaskStore.ts` (type/TaskInput/rowToTask/TASK_COLUMNS/add default).
   Profile add/remove UI added to `app/settings.tsx` (ported from Health).
3. **Tasks** (`app/(tabs)/plans.tsx`, `components/TaskCard.tsx`) — restyled bordered
   Save/Discard bar (icons, attached), chevron-collapse = keep-as-unfinished,
   consistent "Shared out" section header, NO `taskTitlePlaceholder` fixed
   ("Oppgave"→"Hva må gjøres?"), "For"/assignee chip row + row cue + person filter,
   all gated on People mode.
4. **Health** (`app/(tabs)/health.tsx`, `app/habit-form.tsx`) — Health-log is now a
   grouped card; Today/Week/Month uses the shared SlideSelector; profile management
   removed (moved to Settings), person row is filter-only + gated; habit-form "For"
   gated too; habits stay visible when the mode is off.
5. **Home/Shopping/Scan** — Home even preview rhythm (greeting bottom margin);
   Shopping new-list card spacing + Week EmptyState + Monthly header regains a
   left title; Scan idle screen rebuilt as consistent bordered option cards with
   tinted icon badges (`chooseFromLibrary`/`addManually`/`scanQrCode`).

New i18n: `peopleMode.*` (label/hint/profilesHint/addPlaceholder/addButton/
removeTitle/removeBody/filterAll) + `weekEmptyTitle`/`weekEmptyBody`, both languages.

## Verification (all green)
- `npx tsc --noEmit` — clean (also enforces EN/NO i18n parity).
- `scripts/test-changed.sh --all` — 84/84 Jest pass.
- `npm run preview` (Expo-Web + Playwright, `preview-shots/`) — walked onboarding +
  all 5 tabs, **0 page errors / 0 console errors**; add-task round-trip persisted
  `true` (proves the new `assignee` write→read path through sql.js).
- **Not covered (needs maintainer's device):** true native pixel/gesture sign-off
  (glass blur, shadows, haptics, Reanimated timing) — web preview is
  layout/logic-faithful only.

## What remains for the next session
1. **Optional visual polish** from a device pass (the whole point is the *feel*):
   confirm the new border/depth reads well on native glass, and that the Scan
   option cards + Tasks save-bar look right with real blur/shadow.
2. **Publish per repo standing rule** (`CLAUDE.md`/`AGENTS.md`): this is JS/UI +
   store/migration only — **no native surface change**, so no new build and
   `runtimeVersion` stays. The PR into `main` must be **merged** (OTA `update.yml`
   fires only on push to `main`). Merging was left to this continuation because the
   session ran low on tokens — do it after any final review.
3. If the maintainer wants the People filter to also drive Home/Focus previews, that
   was out of scope here (only Tasks/Health filter today).

## Key files touched
Shared: `components/Surface.tsx`, `constants/colors.ts`, `components/SlideSelector.tsx`, `lib/i18n.ts`.
Screens: `app/(tabs)/plans.tsx`, `components/TaskCard.tsx`, `app/(tabs)/health.tsx`, `app/habit-form.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/shopping.tsx`, `app/(tabs)/scan.tsx`, `app/settings.tsx`.
Data: `store/useTaskStore.ts`, `store/useSettingsStore.ts`, `lib/db.ts`.
