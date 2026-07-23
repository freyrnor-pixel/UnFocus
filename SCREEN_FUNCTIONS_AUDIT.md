# UnFocus — Screen Functions & UX Audit

> **Purpose.** A canonical, per-screen inventory of *every user-facing function* in
> the app, followed by an audit that flags mismatches, inconsistent practices, bad
> flows, and screen overload.
>
> **Guiding lens — predictability.** A user should be able to *expect* what each
> screen holds and *not have to learn the whole app*. Every finding below is judged
> against two goals stated for UnFocus: **simple to use**, and **familiar to how
> mainstream apps behave**.
>
> Generated 2026-07-23 from a full source walk. This is a **descriptive** document —
> no behavior was changed. Fixes are a separate, approval-gated follow-up.

---

# Part 1 — Per-screen function inventory

Legend for *where it lives*: **header** · **card** · **FAB** · **inline row** ·
**swipe** · **long-press** · **sub-tab** · **modal/sheet**.

## Universal chrome (every screen)

### Bottom tab bar — `components/BottomNav.tsx`
| Action | Where |
|---|---|
| Switch to Shopping / Plans / Home / Health / Scan | 5 tabs; Home is the centre gradient FAB |
| Page between the 5 tabs by swiping left/right | anywhere on a tab screen (native pager) |

### Screen header — `components/ScreenHeader.tsx`
| Action | Where | Notes |
|---|---|---|
| Open Settings | header gear (top-right; mirrors left when left-handed) | present on all 5 tabs |
| Show/hide this screen's hint | header ⓘ | auto-expands on first visit |
| Toggle Debug / annotate mode | header bug icon | |
| Email all debug notes | header green ✓ | only when debug on |
| Delete all debug notes (confirmed) | header red ○ | only when debug on |
| Download & apply OTA update | header cloud icon | **Home only**, only when an update is ready |

### Debug annotate overlay — `components/DebugNoteAnchor.tsx`
| Action | Where |
|---|---|
| Tap **or** long-press a wrapped card/section/header to add a note | any annotated element, only while debug mode is on |
| Reopen/edit a saved note | its corner bubble badge |

---

## Home — `app/(tabs)/index.tsx`
| Action | Where |
|---|---|
| Toggle "Task notifications" / "Weekly reminders" | two Switches inside the ⓘ hint |
| Enter card-edit mode (reorder, delete, add cards) | **long-press** any preview card (~400ms) |
| Drag to reorder preview cards | card-edit mode |
| Delete a preview card | × badge in card-edit mode |
| Add back a removed card kind (Notes/Plans/Shopping) | "Add a card" tile in card-edit mode |
| **Notes card**: open Notes / toggle a note's check / record a voice note / add a note inline / show more-less / expand "Checked" | `components/HomeNotesCard.tsx` |
| **Plans card**: toggle a task done / show more-less / expand "Done today" / ghost "add a plan" → Plans | `components/PlanTaskCard.tsx` (read-only preview; row→editor disabled here) |
| **Shopping card**: open Shopping / + item to cart / expand In-list·In-cart·Purchased / full row actions (swipe-remove, stepper, delete) | `components/HomeShoppingCard.tsx` |
| **Shared card**: triage incoming shares | shown only when incoming shares exist |
| Energy meter | shown only when Energy system enabled |

## Shopping — `app/(tabs)/shopping.tsx`
Sticky 4 sub-tabs: **Weekly · Monthly · Food · Catalogue**. ⓘ hint holds weekly-reset
weekday chips + monthly-reset-date input.

**Weekly sub-tab**
| Action | Where |
|---|---|
| Allocate an unallocated dish's ingredients into a dated list | per-dish "Allocate" → list chooser modal |
| Instantiate a saved list into a week | drag saved list onto a week section, or tap for week chooser |
| Reassign a week list to another week | **long-press-drag** a collapsed WeekListCard between sections |
| Create a weekly list (empty / from saved) | "+ New weekly list" → modal |
| Rename a list | tap its name → inline TextInput |
| Expand/collapse · focus a list · lock/unlock · Save · Discard | WeekListCard header icons |
| List kebab (⋮): Saved lists / Sync to saved / List settings / Delete | WeekListCard menu |
| Add item (inline) / from monthly (multi-select) / from a dish | "In list" section controls |
| Filter list by name search + category | `ShoppingFilterBar` |
| Move item to cart / **swipe-left to remove** / qty −+ / × delete / **long-press-drag to reorder or merge into dish** | each `ShoppingRow` |
| Finish (Scan receipt / Upload / Skip) | "Done shopping" CTA → modal |

**Monthly sub-tab**
| Action | Where |
|---|---|
| Search + category filter | `ShoppingFilterBar` |
| Rename list / open Budget / reset this list / lock / delete | per list-card header (Budget pill → `/budget`) |
| Add item to focused weekly list | row check circle |
| Edit / delete an item | tap row body → UpdateSheet (when unlocked) |
| Qty −+ / × delete | `MonthlyTableRow` |
| Add item (inline) / Add dish | list controls |
| Create a list / Reset all monthly lists | bottom rows (reset → confirm modal) |

**Food sub-tab** — `components/FoodTab.tsx`
| Action | Where |
|---|---|
| Collapse/expand a meal-type section / add a dish | section header + "+" → new-dish modal |
| Expand dish ingredients | dish row / chevron |
| Add dish to week list / monthly list | dish "+" circle → popup |
| Add / remove ingredient / duplicate dish / delete dish | expanded dish |
| New dish: name, difficulty, draft ingredients (catalog autocomplete), Save/Cancel | new-dish modal |

**Catalogue sub-tab** — `components/CatalogueTab.tsx`
| Action | Where |
|---|---|
| Search + clear / add item (name + price) | top controls |
| Inline edit (name/price/save/delete) / trash delete | per row |
| Jump the list A–Z | **hold-and-drag** vertical scrubber |

## Plans (Tasks) — `app/(tabs)/plans.tsx`
Sticky 3 sub-tabs: **Today · This week · All tasks**. ⓘ hint holds a "Start with work
mode" Switch. Person-filter chip row in People/family mode.
| Action | Where |
|---|---|
| Toggle task done | task check circle |
| Open the **inline** editor (All tab): title, assignees, steps, repeat/recurrence, start date, time-box, "Shared out", Delete/Discard/Save | tap row/chevron → `TaskCard` inline editor |
| Expand step checklist only (Today/Week) | tap row |
| Create a task inline | AddRow / per-day `InlineTaskAdd` |
| Expand "Done (n)" | per section |
| Accept / Dismiss a received shared task | `SharedTasksSection` (All tab) |

## Health — `app/(tabs)/health.tsx`
| Action | Where |
|---|---|
| Open a symptom's detail | "This week" symptom row → `/health-detail` |
| Open the full health log | "Health-log" footer link → `/health-log` |
| **Habits** (embedded): person filter · Today/Week/Month tabs | habits section header |
| Habit: expand / −+ adjust / edit (gear → `/habit-form`) / rest-day toggle | per `HabitCard` |
| Quick-create a habit inline | habits AddRow |
| Navigate months (Month view) | ‹ / › arrows |

## Scan — `app/(tabs)/scan.tsx`
| Mode | Actions |
|---|---|
| **Idle** | Take photo · Choose from library · Add manually · Scan QR code |
| **Result** | pick monthly list · toggle item selection · edit item name · pick category · Add to list (n) · Cancel |
| **Manual** | store selector (+ custom-store sheet) · monthly-list picker · items text · price · Add to list · Cancel |
| **QR overlay** | scan a code → import shared shopping/tasks · Cancel |

---

## Secondary screens

**Notes — `app/notes.tsx`**: per note — toggle check, edit header/body, "Add to
shopping" (sheet), "Add to plans" (→ `/task-form` prefilled), delete. `VoiceNoteFAB`
bottom-right to dictate a note.

**Shared — `app/shared.tsx`**: Shopping / Tasks tabs; per row toggle done (mirrors to
source) or remove; Active + "Done" sections.

**Budget — `app/budget.tsx`**: month ‹ ›; Set/Edit budget → editor modal. Receipt list
is display-only.

**Automations — `app/automations.tsx`**: "+ New automation" → inline form (trigger
chips, action chips, message/item input, Save/Cancel); per rule active Switch + delete.

**Settings — `app/settings.tsx`** (horizontally-scrollable tabs):
- **Generelt**: Energy system + capacity steppers; profile (name, language); appearance
  (dark mode); accessibility (reduced motion, particles, glass, font size, left-handed,
  horizontal timeline); Send Feedback; Debug mode + reset notes; device features
  (voice/contacts/location/calendar); local account (create, auto-backup, back up now,
  save/share/restore); LAN sync (→ `/pair-device`); check for updates; **reset data**
  (monthly / tasks / onboarding — each confirmed).
- **Modi**: work mode (+ auto-activate + hours + work-day chips + holidays); parent/child
  (password); people/family (add/remove profiles); school mode; Freyr demo mode.
- **Handle**: weekly-reset weekday chips; monthly-reset-date.
- **Varsler**: weekly reminders + time; task/habit/persistent notification switches; quiet
  hours; "Automatisering" → `/automations`.

**Pair device — `app/pair-device.tsx`**: LAN sync Switch; per-device remove; "Add device"
wizard (show my code / scan a code).

**Capture — `app/capture.tsx`** (modal): multiline text; Capture/Save.

### Form screens
- **task-form — `app/task-form.tsx`** (~20 controls): title (+ dictation), date chips +
  calendar, time (Set/Whenever) + HH:MM, type (start-at/time-box) + duration, energy,
  repeat + weekday chips, hint, contact (pick/call/remove), location, goal, "Then"
  follower, steps (add/toggle/reorder/delete), delete task.
- **habit-form — `app/habit-form.tsx`**: title, energy, profiles, notification (single/
  count/interval), recurrence (daily/weekly/monthly/flexible), goals, "More options"
  (icon + category), delete.
- **health-form — `app/health-form.tsx`**: issue typeahead (+ add new symptom), severity
  1–5, start when (chips/calendar/time), finished (Ongoing switch / end date+time), notes,
  delete.
- **health-log — `app/health-log.tsx`**: "log symptom" → `/health-form`; tap section row →
  `/health-detail`.
- **health-detail — `app/health-detail.tsx`**: tap entry row → `/health-form` edit; 90-day
  sparkline display-only.
- **inventory-edit — `app/inventory-edit.tsx`**: inline add; per row checkbox + edit/delete.
  *(No wired entry point — see audit.)*
- **share-modal — `app/share-modal.tsx`**: select all/none; toggle per item; "Share
  Selected" → QR; "Shared →" → `/shared`. *(No wired entry point — see audit.)*

### Onboarding — `app/onboarding/*`
`language` → `restore` (restore backup / "I'm new") → `privacy` → `guided` (**Guided** →
tour / **Explore** → straight to Home) → `intro` (feature tour) → `index` (name → finish).

---

# Part 2 — Audit: findings & recommendations

Each finding: what it is · why it hurts predictability/simplicity · a suggested
direction. Ordered roughly by user impact. **Nothing here is implemented yet.**

## A. Inconsistent gestures for the same intent — *high impact*

**A1. "Remove" is a swipe in one place and a trash icon everywhere else.**
Swipe-left-to-remove lives **only** in `components/ShoppingRow.tsx` (weekly lists +
the Home shopping card). Monthly and Catalogue rows *deliberately dropped* swipe;
Plans, Notes, Health, Shared use a trash/× icon; Automations uses ×. A user who
learns "swipe to delete" on the weekly list will try it on the monthly list and it
won't work — and vice-versa.
→ *Direction:* pick one delete affordance app-wide (mainstream apps lean on swipe
**or** a visible trash, rarely both inconsistently). Either bring swipe to the other
lists or drop it from ShoppingRow in favor of the trailing ×.

**A2. Long-press means three unrelated things.**
Long-press = *drag-to-reorder* (shopping rows, week cards, `DraggableTaskRow`),
*enter card-edit mode* (Home preview cards), and *annotate* (Debug mode). Same
gesture, three outcomes depending on where you are.
→ *Direction:* keep long-press for one primary meaning (reorder) and give the others
a visible entry point (see D1).

## B. Two editors for one object — *high impact*

**B1. Tasks have two different editors.** The Plans tab edits a task through the
**inline** `TaskCard` editor; Notes' "Add to plans" opens the full **`/task-form`**
modal route. They expose *different field sets*, so "editing a task" looks different
depending on how you got there. `/task-form` is otherwise almost orphaned (only Notes
reaches it).
→ *Direction:* choose one canonical task editor. Either route the inline card to
`/task-form` too, or retire `/task-form` and prefill the inline editor from Notes.

**B2. Habits have the same split** (inline quick-add on Health vs. full `/habit-form`).
Lower stakes than tasks because the inline path is add-only, but worth aligning the
mental model the same way.

## C. Dead / unreachable surface — *medium (hygiene)*

**C1. `/share-modal` has no caller.** No `router.push('/share-modal')` exists anywhere
in the codebase; its header comments claim Shopping/Plans/Home callers that don't
exist. Meanwhile sharing *is* reachable (Plans "Shared out" switch, Scan QR import,
`/shared`) — so this modal is a second, disconnected share path.
**C2. `/inventory-edit` has no caller** either; the Monthly sub-tab folds the same
logic inline.
→ *Direction:* wire each to a real entry point or delete it. Two ways to "share" and a
dead inventory editor are exactly the kind of thing that erodes a predictable model.

## D. Discoverability gaps — *medium*

**D1. Home card management is invisible.** Reorder/delete/add of the Home preview
cards is reachable *only* by long-pressing a card — there is no visible hint or menu.
Users won't discover it.
→ *Direction:* add a small visible "edit"/⋮ affordance (mainstream home-screen editors
show one), keeping long-press as a shortcut.

**D2. Voice capture appears in several forms** — Home Notes card mic, Notes
`VoiceNoteFAB`, task-form dictation, `?capture=voice` deep link — each with a
different affordance. Consistent, but the entry points aren't obviously the "same"
feature.
→ *Direction:* use one recognizable mic affordance/placement across surfaces.

## E. Name-vs-content mismatches — *medium*

**E1. "Health" tab also owns Habits.** The tab icon/name says symptom tracking, but a
whole Habits system (Today/Week/Month, adjust, reminders) lives inside it. A user
looking for habits has to *learn* they're under Health.
→ *Direction:* either rename the tab to cover both (e.g. "Health & Habits") or surface
Habits where users expect it. At minimum, make the split legible on entry.

**E2. "Scan" also does QR import of shares**, not just receipt OCR. Reasonable, but the
tab name only promises scanning receipts.
→ *Direction:* label the QR-import mode clearly within Scan so it's not a surprise.

## F. Screen overload — *the compress/move question*

**F1. Shopping = 4 dense sub-tabs.** Weekly alone carries: allocate, saved-list
drag/instantiate, week-drag reassignment, inline add, add-from-monthly, add-from-dish,
filter (search + category), per-row cart/stepper/swipe-remove/drag-merge, lock, kebab
(4 options), and a "done shopping" receipt flow. That is a lot to hold in one screen.
→ *Direction:* candidate to compress — e.g. collapse the per-list kebab options,
consider whether "Catalogue" and "Food" need to be peers of the two shopping lists or
could live one level down.

**F2. Settings = 4 tabs, ~40+ controls, plus five "modes"** (work, parent/child,
people/family, school, Freyr/demo). Several are power-user/rare.
→ *Direction:* candidate to move rarely-used modes behind an "Advanced" grouping so the
first screen stays scannable.

**F3. task-form = ~20 field controls** on one screen (contact, location, goal, "Then"
follower, energy, recurrence, time-box…). Powerful, but heavy for "add a task."
→ *Direction:* consider progressive disclosure — a short default form with an
"advanced options" reveal (relates to B1: consolidating on one editor is the moment to
do this).

## G. Smaller consistency notes — *low*

- **Add patterns vary**: always-present inline AddRow (Notes, Plans, Catalogue, weekly)
  vs. modal/sheet (Food new-dish, Monthly UpdateSheet) vs. FAB (habits). Not wrong, but
  worth a deliberate rule for when each is used.
- **"Focus/eye" and "info/ⓘ"** both live in the header cluster alongside gear + debug;
  the header is getting crowded on Home specifically (adds the OTA cloud icon).
- **Reset actions** are scattered (Shopping reset-list / reset-all; Settings reset
  monthly / tasks / onboarding) — consistent in styling (confirm-gated, danger) but
  spread across places.

---

## Suggested next steps (for discussion — not done here)
1. Decide a single delete affordance (A1) and a single task editor (B1) — highest
   predictability wins.
2. Resolve the two dead routes (C1/C2) — cheap hygiene.
3. Add a visible entry for Home card editing (D1).
4. Then tackle the bigger "compress/move" questions (F1–F3), which are design changes,
   not mechanical fixes.
