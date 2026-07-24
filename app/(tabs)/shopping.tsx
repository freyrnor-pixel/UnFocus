/**
 * shopping.tsx — Shopping hub with two in-place tabs (Weekly, Monthly) plus two
 * button-launched sub-screens (Food, Catalogue).
 *
 * **Down from four in-place tabs to two, plus buttons (UX audit F1, 2026-07-23)**: Food
 * and Catalogue used to be full sticky-tab peers of Weekly/Monthly, but they're opened
 * far less often — screen-overload candidate the audit flagged. They're now
 * `foodCatalogueLinks`, a small two-button row (pushing `/food` and `/catalogue`) shown
 * above the list content on both remaining tabs, rather than their own tab-bar slots.
 * `components/FoodTab`/`components/CatalogueTab` themselves are unchanged — only where
 * they're mounted moved (see app/food.tsx / app/catalogue.tsx).
 *
 * Tabbed shopping screen. The "Week lists" tab renders an "Unallocated" card (dish
 * ingredients pushed to the week from the Food screen, sentinel listId UNALLOCATED_LIST_ID)
 * then one WeekListCard per non-template shopping_lists row plus an empty "create new
 * list" card. The "Monthly" tab (Shopping/Monthly redesign, 2026-07-22) renders one
 * lock-gated card PER named Monthly list (store/useMonthlyListStore.ts) — each with its
 * own tap-to-rename name, own budget pill (→ app/budget.tsx, listId param), own manual
 * reset icon, dish-grouped + ungrouped curated items, add-to-list triggers, and
 * purchased-this-month history — plus a "+ New list" row and a small relocated "reset all
 * lists" link at the bottom. Replaces the old single global Katalog card. A screen-level
 * sticky bar (Decision 011 A2-1) holds the 2-tab switcher plus a per-tab summary line.
 *
 * Connections:
 *   Imports → components/InlineAddItem, components/AddDishSheet (AddDishTarget type),
 *             components/HintCard, components/AppModal (showAppModal),
 *             components/ConfirmationBanner, components/DraggableTaskRow,
 *             components/ExpandableCard, components/FlightOverlay (FlightPill, Flight, FlightRect),
 *             components/IconButton,
 *             components/ListSettingsSheet, components/MonthlyResetSummaryModal,
 *             components/MonthlyResetReviewSheet,
 *             components/MonthlyTableRow, components/SavedListsModal, components/SavedListsSection,
 *             components/ScreenScaffold, components/SharedRequestsSection,
 *             components/ShoppingFilterBar, components/ShoppingRow, components/Surface,
 *             components/UpdateSheet, components/WeekListCard,
 *             components/PressableScale, components/TabSlider, components/SectionDivider,
 *             constants/theme,
 *             lib/date (todayStr, dateStr, getWeekRangeContaining, weekOfMonthlyCycle,
 *             dateRangeForCycleWeek, formatDateRange), lib/haptics (success,
 *             heavy, warning), lib/i18n, lib/money (formatKr), lib/shoppingGroups (groupByDish,
 *             groupByCategory, computeListGroups, listProgress, catalogItemsForList),
 *             lib/shoppingCategories (categoryPresets, categoryLabel),
 *             lib/reorder (reorderByDrag), lib/useAppTheme,
 *             lib/useFirstVisitHint, lib/domainColor, lib/screenColor, lib/budget (computeSpendPace),
 *             store/useSettingsStore, store/useShoppingListStore, store/useMonthlyListStore,
 *             store/useReceiptStore, components/NewMonthlyListRow,
 *             store/useShoppingStore (incl. UNALLOCATED_LIST_ID), @expo/vector-icons (Ionicons)
 *   Used by → Expo Router route "/shopping" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → useShoppingStore (items/trips) + useShoppingListStore (lists, incl. each
 *             list's locked/isTemplate state) + useMonthlyListStore (Monthly lists, each with
 *             its own budgetNok/lastReset/locked) + useSettingsStore (monthlyResetDate — still
 *             one global payday-boundary date, shared by every Monthly list) + useReceiptStore
 *             (receipts, each list's own pace line filters by monthlyListId).
 *             WeekListCard reads useCatalogStore internally (loaded at startup by
 *             app/_layout.tsx); app/food.tsx/app/catalogue.tsx's FoodTab/CatalogueTab do too
 *             (FoodTab additionally drives useMealStore) — this screen no longer mounts
 *             either directly (UX audit F1, 2026-07-23).
 *
 * Edit notes:
 *   - **Card-header declutter pass (2026-07-23)**: several small UI cleanups across both
 *     tabs' list cards. (1) Monthly's "Add dish" trigger (`addTrigger`) now matches the
 *     "Add new item" bar (`InlineAddItem`)'s shape/background/text style — they used to
 *     look like two different affordances. (2) `NewMonthlyListRow`'s collapsed trigger and
 *     this file's own Weekly "+ New list" trigger (`newListTrigger`) are both now a
 *     big-ish plain white/surface button with just a "+" glyph (icon-only,
 *     accessibilityLabel carries the name) instead of a smaller accent-tinted labeled
 *     pill. (3) The lock icon on both WeekListCard and each Monthly list card moved out of
 *     the crowded right-side action row and now sits beside the list name on the left —
 *     same `onToggleLock`/locked-gating behavior, just relocated; it still fully works,
 *     nothing was removed. (4) Monthly list cards gained a kebab (⋮) menu
 *     (`openMonthlyListOptions`) that now holds "Reset this list" and "Delete this list" —
 *     previously a separate 32px `refresh-circle` icon + a conditionally-shown trash
 *     IconButton, both stacked in the same row as Budget/Manage-inventory/Lock/Delete.
 *     (5) The Monthly tab's per-card "Monthly list" section label above the items list is
 *     gone — redundant with the card's own name header and the fact it's already in the
 *     Monthly tab. (6) "Save as template" moved from a button at the bottom of
 *     `SavedListsModal` into a direct entry in WeekListCard's kebab menu
 *     (`onSaveAsTemplate`/`handleSaveListAsTemplate`) — see that component's header for why
 *     (the old button made no sense in the "+ New list → Saved lists" browse context,
 *     where there's no "current list" yet to save).
 *   - **Saved-lists drag + sync-back (2026-07-22)**: `components/SavedListsSection` renders
 *     as an expandable accordion above the week sections, listing every template list —
 *     drag a row (screen-owned `handleSavedListDragStart/Move/End`, reusing the week-drag's
 *     `weekSectionNodes`/`weekSectionRectsRef` registry) or tap it for a "Week 1-4" chooser
 *     onto a week section to instantiate it there (`addTemplateToWeek`, also now the shared
 *     path for the older per-list `SavedListsModal`'s onSelectTemplate). `instantiateTemplate`
 *     took a `today` string before and always targeted "the week containing today" — it now
 *     takes an explicit `startDate`/`endDate` so a drop can target ANY week-of-cycle section,
 *     and every instantiated list stamps `sourceTemplateId` back to its template.
 *     `addTemplateToWeek` blocks (toast `t.templateAlreadyInWeek`) instantiating the SAME
 *     template into a week section that already has a list sourced from it — only a
 *     per-section duplicate is blocked; the same template can still be used across different
 *     weeks. `usedTemplateIds` (derived from every live list's `sourceTemplateId`) marks a
 *     template "in use" in SavedListsSection without removing or disabling it, so it's still
 *     copyable elsewhere. WeekListCard's kebab menu gained a "Sync to saved list" entry
 *     (`onSyncToTemplate`, shown only when `list.sourceTemplateId` is set) that calls the new
 *     `syncListToTemplate` store action — overwrites the template's items with this list's
 *     current ones — then re-runs `loadShopping()` since that store action writes
 *     shopping_items rows directly, same reload-after-direct-write pattern as
 *     advanceRecurringLists. The week-section render guard also changed from
 *     `nonTemplateLists.length > 0` to `(nonTemplateLists.length > 0 || templateLists.length >
 *     0)` — a saved list needs a drop target even before the first live list exists.
 *   - **Spend-pace line (2026-07-22, made per-list later the same day)**: each Monthly list
 *     card shows its OWN pace figure (`view.pace` inside `monthlyListViews`, actual kr/day
 *     since that list's own lastReset vs. its own budgetedNok, paced over the payday-to-payday
 *     period) under its header row, via lib/budget.ts's computeSpendPace() fed only that
 *     list's receipts (useReceiptStore rows tagged with its id) — same calculation/copy
 *     (`t.budget.perDaySpend`) as app/budget.tsx's own pace row for that list. The Home Shopping
 *     preview card (components/HomeShoppingCard.tsx) shows one AGGREGATE figure instead (summed
 *     budget vs. every tagged receipt) — see app/(tabs)/index.tsx's shoppingPace memo. Hidden
 *     (returns null) for a list with no budget set or that's never been reset.
 *   - **Weekly redesign: week sections + per-list draft save/discard (2026-07-22)**: the
 *     Weekly tab's lists are no longer a flat `nonTemplateLists.map`. `listsByWeek`
 *     (useMemo, keyed 1-4 via `weekOfMonthlyCycle`) buckets them into one section per week
 *     of the monthly cycle; all 4 sections always render (once ≥1 list exists) since each
 *     is a drag-drop target, registered via `handleRegisterWeekSectionNode`/
 *     `weekSectionRectsRef`. Each collapsed `WeekListCard` (collapsed by default now —
 *     `expandedListIds`) is wrapped in a screen-owned `DraggableTaskRow` instance (a SECOND,
 *     independent one alongside the existing item-level reorder rows) — dropping it over a
 *     different section's measured rect (`handleWeekDragStart/Move/End`, same
 *     measureInWindow window-space idiom as the item drag-to-merge code) reassigns the
 *     list's startDate/endDate via `dateRangeForCycleWeek` (+ recomputes `name` if
 *     `!isCustomName`) through `updateList`.
 *     Separately, each list now supports a **full local draft**: unlocking captures a
 *     snapshot (`listSnapshots`, keyed by list id: name/isCustomName/its inWeeklyList
 *     items) via `captureListSnapshot`; `dirtyByListId` (useMemo) diffs live state against
 *     it on every render. WeekListCard's Save/Discard buttons call
 *     `handleSaveListChanges` (re-baselines the snapshot) / `handleDiscardListChanges`
 *     (→ `revertListToSnapshot`, which undoes adds via `putBackToInventory`/
 *     `removeWithSource` and undoes removes/edits via the new `restoreDeleted` store action
 *     + `update`). Pressing the lock icon while dirty (`handleToggleLock` → `requestLock`)
 *     opens a `showAppModal` "Save & lock / Discard & lock / Cancel" prompt instead of
 *     locking straight away. `unsavedListCount` (was `unlockedListCount`) now counts
 *     actually-dirty lists for the sticky-bar badge, not just unlocked ones.
 *   - **Budget-scoping + unsaved-badge pass (2026-07-22)**: the "Budsjett" pill moved out of
 *     `shoppingIntro` (was rendered on all 4 tabs) into the Monthly tab's own
 *     `catalogHeaderRow`/`catalogHeaderActions`, inline with the reset/lock icons — Budget is a
 *     monthly-spend concept, so it now shows only there, and every other tab lost that extra row
 *     of vertical space. Weekly's "Unsaved: N list(s) still unlocked" banner (a full-width
 *     unbordered sentence) was replaced with a small icon+count badge (`styles.unsavedBadge`,
 *     lock-open icon + number) — `t.unsavedShoppingBanner(n)` is now only the accessibilityLabel,
 *     not visible text. Also shortened WeekListCard's `addFromMonthlyOption`/`addFromDishOption`
 *     i18n strings (were truncating in Norwegian inside their half-width bordered buttons).
   *   - **"Manage inventory" entry point (UX audit C2, 2026-07-23)**: each Monthly list's
   *     header row got a `file-tray-full-outline` IconButton pushing `/inventory-edit` with
   *     that list's id — the resurrected standalone inventory-edit screen (deleted, then
   *     restored per this decision) that gives a distraction-free add/edit/delete view over
   *     the exact same `status==='catalog'` rows this tab shows inline. Both now share
   *     `lib/shoppingGroups.ts`'s `catalogItemsForList()` instead of each filtering/sorting
   *     independently.
 *   - **Popup + real category filter pass (2026-07-22)**: Weekly's "Add from monthly" now opens
 *     `components/AddFromMonthlyModal` as a centered popup (checkbox multi-select, batch
 *     commit) instead of WeekListCard's old inline panel — `onAddMonthlyToWeek` (per-item) was
 *     replaced by `onAddMonthlyItemsToWeek` (batch; loops `addToWeeklyFromCatalog` here and
 *     shows one consolidated toast, `t.itemsAddedToList`, instead of one per item). Also added
 *     `ShoppingFilterBar` (name search + category dropdown) to the Monthly tab
 *     (`monthlyTabSearch`/`monthlyTabCategory` state) — `catalogItems` is filtered into
 *     `filteredCatalogItems` before feeding `groupByDish`/`groupByCategory`; picking a specific
 *     category skips the category-cluster-divider step (`ungroupedCategoryGroups` returns `[]`)
 *     since every visible row already shares that category. `monthlyTotal` still sums the full
 *     unfiltered `catalogItems` — the filter narrows what's visible, not the running total. The
 *     same `ShoppingFilterBar` is used on Weekly (see WeekListCard.tsx) — category was
 *     previously display-only everywhere (a tag + cluster divider); this is the first place
 *     either tab actually filters/searches by it.
 *   - **Shopping-cleanup pass (2026-07-20)**: `addDishOpen` (boolean) became `dishSheetTarget`
 *     (`AddDishTarget | null`, from components/AddDishSheet) so the one shared `<AddDishSheet>`
 *     mount near the bottom of this file serves both Monthly's "Legg til rett" trigger
 *     (`{mode:'monthly'}`) and any Weekly WeekListCard's new "From a dish" add-chooser option
 *     (`{mode:'weekly', listId}`, via the `onOpenDishSheet` prop wired at the WeekListCard call
 *     site) — a weekly target writes straight into that list, skipping the Unallocated bucket
 *     entirely; the Food-tab → Unallocated → `handleAllocate` path is untouched and still works
 *     for staging a dish before a dated list exists. Also added `ungroupedCategoryGroups`
 *     (`groupByCategory` over Monthly's `ungroupedRestItems`) — only resorts into
 *     quiet-captioned clusters when more than one category is actually present; the common
 *     (nobody's categorised anything) case renders flat, unchanged. `handleAddItem` and the
 *     Weekly `onAddInlineItem` callback both now thread an optional `category` through to
 *     `add()`.
 *   - **Tab bar (2026-07-23, shared component)**: the Weekly/Monthly switcher is
 *     `components/TabSlider.tsx` — a single accent pill SLIDES between the two content-sized
 *     segments (same motion as the Day/Week/Month `SlideSelector`), replacing the old
 *     per-tab `TabBoxHighlight` boxes. Same shared component as app/(tabs)/plans.tsx and
 *     app/settings.tsx's tab bars. Every tab's `accent` in `TAB_META` is the neutral brand
 *     `theme.accent` (blue), so the pill's hue matches Plans, Health's SlideSelector, and the
 *     bottom nav — one consistent "selected" colour app-wide (visual-audit 2026-07-20: Weekly's
 *     old green `theme.good` + Food's meal-domain accent read as a competing selection colour
 *     against the blue nav on the same screen).
 *   - **Sticky-bar label fix (visual-audit, 2026-07-11)**: the summary-row ternary fell
 *     through to a `tab === 'food' ? foodTabLabel : catalogueTabLabel` catch-all for any
 *     tab that wasn't `'monthly'` or `'weekly'`-with-a-`focusedList` — so a fresh/empty
 *     Weekly tab (no focused list yet) showed "Katalog" instead of "Ukelister". Added an
 *     explicit `tab === 'weekly'` branch before the catch-all.
 *   - **Decision 044a (2026-07-09):** removed the Monthly tab's staging tray
 *     (per-item pendingRestock checkbox → confirm button); MonthlyTableRow's checkbox
 *     now calls addToWeeklyFromCatalog directly, with undo via putBackToInventory in
 *     the confirmation toast. `pendingRestock` stays in the type/DB as vestigial.
 *     Also deleted `components/AddSourceChooser.tsx` and its `addSourceChooserListId`
 *     wiring here — both were already dead code (the weekly "+" flow it served was
 *     superseded by WeekListCard's inline add row back on 2026-07-06; nothing ever
 *     set `addSourceChooserListId` to a real id). `AddItemSheet` is catalog-only now
 *     — see its own header.
 *   - **Shopping/Food redesign (2026-07-08)**: four in-place tabs now — Weekly, Monthly,
 *     Food, Catalogue (all switch content in place; none navigate to a separate screen).
 *     The old /meals and /create-grouping screens were DELETED; the "Create grouping" FAB
 *     is gone. Food (components/FoodTab) is where dishes are made now — meal-type sections
 *     (glass-tinted per meal colour), each dish a collapsed row (name · total price · "+"),
 *     "+" opening a popup with "Add to week list" (→ weekly Unallocated bucket) / "Add to
 *     monthly list" (→ status:'catalog'), expandable to ingredient rows. Catalogue
 *     (components/CatalogueTab) is the master item list, sectioned by type, with add/edit/
 *     delete. The Monthly tab dropped its embedded seed-catalogue section (moved to the
 *     Catalogue tab) and keeps a direct add-to-monthly trigger (bordered pill, matching
 *     WeekListCard's monthlyTrigger shape — design-consistency pass replaced the earlier
 *     AddFAB size="sm" bubble, which itself had replaced an even earlier AddDivider "—+—"
 *     line). Weekly gained the Unallocated card; each unallocated dish/item can be
 *     allocated into a real dated list. Weekly's "New list" action is the same trigger-pill
 *     family, sized more prominently as the tab's primary action.
 *   - New file (2026-07-02, Session A2·2). app/shopping.tsx never existed in this repo
 *     before this session — this is a from-scratch build against Decision 011 (A2-1,
 *     A2-4) and Decision 017, using the old repo's app/shopping.tsx only as a reference
 *     for behavior/copy, not a line-for-line port. See PROGRESS_LOG for the full scope
 *     trail (this session expanded well past its original "re-layout an existing file"
 *     brief once it turned out the file, WeekListCard, and three Phase-3e components
 *     didn't exist yet).
 *   - **A2-1 sticky bar**: uses ScreenScaffold's new `stickyBelowHeader` slot (added this
 *     session). Surface `surfaceContext="overlay"` per Surface.tsx's own docstring, which
 *     names "sticky headers... nav bar" as the overlay use case — `ScreenHeader`/`BottomNav`
 *     also use `overlay` (the earlier doc-vs-source inconsistency flagged here has since
 *     been fixed in both files).
 *     Reserved sticky height is always `STICKY_HEIGHT_TABS` (tab row only) — the Weekly
 *     summary row under the tabs was removed (debug-note 2026-07-21).
 *   - **A2-1 focused list**: `focusedListId` still picks which non-template list is the
 *     focused one (Decision 017 Q3/Q4), now feeding only WeekListCard's `focused` prop (the
 *     sticky summary row that used to read it is gone). Falls back to the first list when
 *     nothing is explicitly focused yet or the focused list was deleted. WeekListCard's own
 *     compact progress line (non-focused lists only) calls `onFocus` to switch it.
 *   - **A2-4 body order**: SharedRequestsSection →
 *     per-list WeekListCards (each carrying its own collapsed
 *     "Bought this week" history — see WeekListCard.tsx) → "create new list" card. Monthly
 *     reset is a manual action in the sticky bar's overflow menu, not an automatic
 *     mount-time effect — see the store-stub note below.
 *   - **Decision 011 R1 reorder + Decision 022 drag-to-merge wiring** (window-coordinate,
 *     2026-07-03): this screen owns hit-testing/live-reflow/persistence for both. Native
 *     nodes are registered up from DraggableTaskRow (each ungrouped reorder row, via
 *     `registerNode`) and WeekListCard (each "From meals" dish-group card, via
 *     `registerDishGroupNode`), keyed `listId:itemId` / `listId:dishName`. At drag-start
 *     they're measured with `measureInWindow` into `dragSnapshotRef` / `dishRectsRef` — a
 *     shared **window** space, the only frame where the ungrouped section and the dish
 *     cards (different parents) are comparable. The dragged row measures ITSELF inside
 *     DraggableTaskRow and reports live window centerY. On move: if that centerY falls in a
 *     dish-group band → mark it the merge/join target (WeekListCard highlights it via
 *     `mergeHighlightDish`); otherwise run the R1 reorder preview (`computeTargetIndex` +
 *     `LayoutAnimation`). On drop over a dish (Decision 022): a same-name ingredient in that
 *     dish → `mergeItems` (sum + adopt dishName, drop the standalone row); no same-name →
 *     `update(dishName)` so the item joins THIS dish instance (never edits the dish's base
 *     recipe — that's managed elsewhere; per the 2026-07-03 design answer). Reorder persists
 *     via `reorderItem` 'up'/'down' as before. Only the ungrouped section is reorderable;
 *     dish/bought rows still have no move affordance. `dragRef` mirrors `drag` state so the
 *     drop handler reads the final drag synchronously. measureInWindow snapshots are taken
 *     once at drag-start (no mid-drag re-measure) — an approximation, no live-app verification
 *     this session. Decision 022's ephemeral *undo* affordance is deferred (a transient
 *     ConfirmationBanner confirms the merge for now — see PROGRESS_LOG 2026-07-03).
 *   - **2026-07-24 fix**: `registerDishGroupNode`/`mergeHighlightDish` were documented above
 *     but never actually wired — `handleRegisterDishNode` had no caller, so `dishRectsRef`
 *     was always empty and drag-to-merge silently never triggered. Re-wired both props on
 *     the WeekListCard call below; WeekListCard now renders each dish's unchecked items
 *     inside a registered per-dish wrapper View (see its header) instead of one flat array,
 *     so there's a real node per dish to measure/highlight again. Gesture behavior itself
 *     couldn't be verified on a device this session (see AGENTS.md) — typecheck/lint/tests
 *     pass but this still wants a real-device pass before calling it fully confirmed.
 *   - **Mount-time store hydration**: app/_layout.tsx loads every store at startup now, so
 *     this screen's focus effect no longer re-initialises the DB or re-hydrates
 *     settings/shopping/list/catalog — it only runs the behavior that's more than hydration:
 *     advanceRecurringLists(today) (re-loading shopping items after ONLY when it returns
 *     true, i.e. it actually rolled a list forward — a no-op focus skips the reload so the
 *     list doesn't reflow after paint) and the automatic payday-boundary monthly-reset
 *     detection, which now just opens MonthlyResetReviewSheet (resetReviewVisible) instead
 *     of resetting immediately — see that component's header and finalizeMonthlyReset()
 *     below for the actual buildMonthlyResetSummary()/monthlyReset()/lastMonthlyReset
 *     sequence, which now only runs once the user dismisses the sheet (Skip or Confirm),
 *     not at trigger-detection time.
 *   - The 'shopping_opened' automation trigger fires once per mount; rules are already loaded
 *     by _layout's startup bootstrap. "Shopping done!"'s Scan/Upload choices route to /scan
 *     (autoCapture camera/library); Skip commits the trip in place.
 *   - **Share pill restored (2026-07-23)**: re-wired via `ScreenScaffold`'s new optional
 *     `onSharePress` (site-tier header controls), pushing `/share-modal?kind=s` — see
 *     SCREEN_FUNCTIONS_AUDIT.md finding C1. Plans doesn't need the same treatment: its
 *     per-task "Shared out" switch (`components/TaskCard.tsx`) already writes directly to
 *     `useSharedStore` without a QR step.
 *   - **Scan header button (2026-07-23, audit findings E2/F1)**: `onScanPress` (same
 *     pattern as `onSharePress` above) pushes `/scan` — Scan's own idle screen still offers
 *     both receipt OCR and QR import, so this one button is the sole replacement for the
 *     bottom-nav tab Scan used to occupy. The existing "Shopping done!" Scan/Upload choices
 *     (line ~245) already pushed `/scan` directly and are unaffected by this move.
 *   - **Still dropped**: SiteSwipeView's swipe-between-screens wrapper (Phase 3e, not
 *     ported, not required by A2-1/A2-4).
 *   - `ConfirmationBanner` renders as a sibling of `<ScreenScaffold>`, not inside its
 *     children — ScreenScaffold's children render inside its internal ScrollView, and
 *     ConfirmationBanner is a plain absolutely-positioned overlay (not a `<Modal>` like
 *     the sheets below it), so nesting it in scrollable content would make it scroll
 *     away instead of staying fixed near the top of the screen.
 *   - **Shopping — Monthly redesign (2026-07-22)**: the Monthly tab was previously a single
 *     lock-gated global Katalog card (Decision 011 A2-3 had left it a light, unredesigned
 *     port). It now renders `monthlyListViews` (one view-model per store/useMonthlyListStore.ts
 *     row) — each list gets the SAME full section layout the old single card had (dish groups,
 *     ungrouped rows, add-item/add-dish triggers, purchased-this-month), just scoped by
 *     `monthlyListId`. The shared name+category filter bar sits once above every card, not
 *     once per card. `catalogLockedSession`/Decision 029's session-only lock is GONE — each
 *     list's lock is now persisted (`monthly_lists.locked`), same as weekly's
 *     `shopping_lists.locked` (a deliberate behavior change: a locked Monthly list now stays
 *     locked across an app restart, where the old single card always re-locked on cold start).
 *     Each list also gets its own lightweight manual reset (`resetListConfirmId` →
 *     `resetMonthlyList(listId)`, no review sheet) alongside a relocated "reset ALL lists"
 *     link at the bottom of the tab, which still opens the full interactive
 *     MonthlyResetReviewSheet (weekly-list keep/discard + inventory qty) — the same flow the
 *     automatic payday-boundary trigger uses. Existing users' single Katalog + its budget/
 *     lastReset migrate onto one auto-created "Monthly" default list (see lib/db.ts's
 *     migrations) so nothing is lost.
 *   - Decision 011a/R4 dish-checkbox wiring (2026-07-02, Phase 4): this session flagged
 *     dish groups as "read-only... no parent/child checkbox binding attempted." Closed
 *     now — toggleDish() here is the bulk roll-up/roll-down action R4 calls for, reusing
 *     the existing per-item toggleCheck (no new store action); WeekListCard's dish-group
 *     ExpandableCard calls it via the new onToggleDish prop. Required loosening
 *     computeListGroups()'s dish grouping to include checked items too (previously
 *     unchecked-only, which made the "dish shows checked" roll-up unobservable) — see
 *     lib/shoppingGroups.ts's own header note.
 *   - **Flight animation (Phase 1, 2026-07-11)**: list→cart toggles fly a `FlightPill`
 *     clone from the toggled row's rect to the target list's "In cart" section header,
 *     reusing the same window-space `measureInWindow` idiom as the drag-to-merge code
 *     above. `cartHeaderNodes` (keyed by listId) is the destination registry, populated by
 *     WeekListCard's `registerCartHeaderNode`; `flights` is screen-owned state rendered by
 *     a single `<FlightOverlay>` mounted as a sibling of `<ScreenScaffold>` (NOT inside
 *     it — ScreenScaffold's children scroll inside its internal ScrollView, same reasoning
 *     as `ConfirmationBanner`'s placement below). `handleScreenScroll` clears in-flight
 *     flights on scroll since window-space coords go stale. See
 *     ANIMATION_GUIDELINES.md's "Flight / Cross-Section Travel Animations" section.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Modal, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShoppingStore, ShoppingItem, MonthlyResetSummary, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { useShoppingListStore, ShoppingList } from '@/store/useShoppingListStore';
import { useMonthlyListStore, MonthlyList } from '@/store/useMonthlyListStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useAutomationStore } from '@/store/useAutomationStore';
import ShoppingRow from '@/components/ShoppingRow';
import EmptyState from '@/components/EmptyState';
import MonthlyTableRow from '@/components/MonthlyTableRow';
import InlineAddItem from '@/components/InlineAddItem';
import AddDishSheet, { AddDishTarget } from '@/components/AddDishSheet';
import UpdateSheet from '@/components/UpdateSheet';
import MonthlyResetSummaryModal from '@/components/MonthlyResetSummaryModal';
import MonthlyResetReviewSheet from '@/components/MonthlyResetReviewSheet';
import SharedRequestsSection from '@/components/SharedRequestsSection';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import { showAppModal } from '@/components/AppModal';
import Surface from '@/components/Surface';
import ScreenScaffold from '@/components/ScreenScaffold';
import ExpandableCard from '@/components/ExpandableCard';
import PressableScale from '@/components/PressableScale';
import WeekListCard from '@/components/WeekListCard';
import ShoppingFilterBar from '@/components/ShoppingFilterBar';
import FlightOverlay, { FlightRow, Flight, FlightRect } from '@/components/FlightOverlay';
import SavedListsModal from '@/components/SavedListsModal';
import SavedListsSection from '@/components/SavedListsSection';
import ListSettingsSheet from '@/components/ListSettingsSheet';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import IconButton from '@/components/IconButton';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TabSlider from '@/components/TabSlider';
import NewMonthlyListRow from '@/components/NewMonthlyListRow';
import SectionDivider from '@/components/SectionDivider';
import { success, heavy, warning } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr, dateStr, getWeekRangeContaining, weekOfMonthlyCycle, dateRangeForCycleWeek, formatDateRange } from '@/lib/date';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { Fonts, FontSize, Radius, Spacing, Type } from '@/constants/theme';
import { groupByDish, groupByCategory, computeListGroups, listProgress, catalogItemsForList } from '@/lib/shoppingGroups';
import { categoryPresets, categoryLabel } from '@/lib/shoppingCategories';
import { reorderByDrag } from '@/lib/reorder';
import { formatKr } from '@/lib/money';
import { computeSpendPace } from '@/lib/budget';
import { getDomainColor } from '@/lib/domainColor';
import { getScreenColor } from '@/lib/screenColor';

type Tab = 'weekly' | 'monthly';

// Reserved sticky-bar height — just the tab row now (the focused-list name + progress summary
// row under the tabs was removed 2026-07-21). Must equal TabSlider's own natural content
// height (border 1×2 + TRACK_PAD 3×2 + segment minHeight 38 = 46) so `stickyBar`'s
// justifyContent:'center' has no leftover space to split unevenly (was 60, a 14px surplus
// that gave the blue pill a bigger vertical inset than horizontal — same bug as Plans'
// STICKY_HEIGHT, fixed 2026-07-24). Matches Plans' STICKY_HEIGHT so the tab→first-card gap
// is consistent across the two list screens.
const STICKY_HEIGHT_TABS = 46;

type DragState = {
  listId: string;
  itemId: string;
  /** Cached at drag-start so the drop handler can match a same-name dish ingredient. */
  itemName: string;
  startOrder: string[];
  order: string[];
  /** Decision 022: dish group currently under the dragged row (valid merge/join target), or null. */
  mergeTargetDish: string | null;
};


export default function ShoppingScreen() {
  const theme = useAppTheme();
  const t = useT();
  const router = useRouter();
  const { reducedMotion } = useAccessibility();
  const mealDomainColor = getDomainColor(theme, 'meal');
  const shopDomainColor = getDomainColor(theme, 'shop');

  // Fire the 'shopping_opened' automation trigger once per screen visit (mount).
  // Rules are already loaded by app/_layout.tsx's startup bootstrap.
  useEffect(() => {
    useAutomationStore.getState().fireTrigger('shopping_opened');
  }, []);

  const [tab, setTab] = useState<Tab>('weekly');
  const [hintOpen, setHintOpen] = useFirstVisitHint('shopping');
  // Local edit buffer for the monthly reset-date field embedded in the first-run hint.
  // Starts empty (placeholder-preview per the input UX pass); committing a valid 1–31
  // updates the setting, leaving it blank keeps the current value.
  const [monthlyDateInput, setMonthlyDateInput] = useState('');
  const [focusedListId, setFocusedListId] = useState<string | null>(null);
  // Which target the shared AddDishSheet is pushing into — Monthly's own trigger, or a
  // specific Weekly list's "From a dish" add-chooser option. null = sheet closed.
  const [dishSheetTarget, setDishSheetTarget] = useState<AddDishTarget | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState<(() => void) | null>(null);
  /** Shows a toast; pass `undo` to add an inline "Undo" action (Decision 044a). */
  const setConfirm = useCallback((message: string | null, undo?: () => void) => {
    setConfirmMessage(message);
    setConfirmUndo(() => undo ?? null);
  }, []);
  const [purchasedExpanded, setPurchasedExpanded] = useState<string | null>(null);
  const [resetSummary, setResetSummary] = useState<MonthlyResetSummary | null>(null);
  const [resetReviewVisible, setResetReviewVisible] = useState(false);
  const [savedListsListId, setSavedListsListId] = useState<string | null>(null);
  const [listSettingsListId, setListSettingsListId] = useState<string | null>(null);
  const [updateItem, setUpdateItem] = useState<ShoppingItem | null>(null);
  // Global "reset every Monthly list now" confirm (relocated 2026-07-22 — see the header's
  // Monthly-lists edit note). Distinct from resetListConfirmId below, which is one list's
  // own lightweight manual reset.
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  // Monthly tab's name+category filter (category was previously display-only — a tag +
  // cluster divider — this makes it an actual filter, same ShoppingFilterBar Weekly uses).
  // Shared across every Monthly list card (one search box, not one per list — 2026-07-22).
  const [monthlyTabSearch, setMonthlyTabSearch] = useState('');
  const [monthlyTabCategory, setMonthlyTabCategory] = useState<string | null>(null);
  // One list's lightweight "reset this list" confirm — id of the list being confirmed, or null.
  const [resetListConfirmId, setResetListConfirmId] = useState<string | null>(null);
  // Tap-to-edit name field, per Monthly list (mirrors WeekListCard's nameEditing/nameInput
  // pattern) — id of the list currently being renamed, or null.
  const [editingMonthlyListId, setEditingMonthlyListId] = useState<string | null>(null);
  const [monthlyListNameInput, setMonthlyListNameInput] = useState('');

  // ── Card collapse (2026-07-22 redesign: collapsed by default) ──
  const [expandedListIds, setExpandedListIds] = useState<Record<string, boolean>>({});
  function toggleListExpanded(listId: string) {
    setExpandedListIds((s) => ({ ...s, [listId]: !s[listId] }));
  }

  // ── Per-list draft snapshot (2026-07-22 redesign: full local draft + save/discard) ──
  // Captured when a list is unlocked (the baseline "last locked" state); cleared on Save
  // or Discard. Presence + a live-vs-snapshot diff (dirtyByListId below) drives the
  // Save/Discard buttons and the lock-with-unsaved-changes confirm. A brand-new list has
  // no snapshot until it's locked once, so Save/Discard never appears for it — nothing to
  // revert to yet (see requestLock below).
  type ListSnapshot = { name: string; isCustomName: boolean; items: ShoppingItem[] };
  const [listSnapshots, setListSnapshots] = useState<Record<string, ListSnapshot>>({});

  // ── Week-section drag (2026-07-22 redesign: reassign a list's week by dragging its
  // collapsed card between week-of-cycle sections; window-coordinate hit-testing, same
  // measureInWindow idiom as the item drag-to-merge / flight-animation code below) ──
  type WeekDragState = { listId: string; startWeek: number; targetWeek: number | null };
  const [weekDrag, setWeekDrag] = useState<WeekDragState | null>(null);
  const weekDragRef = useRef<WeekDragState | null>(null);
  const weekSectionNodes = useRef<Map<number, any>>(new Map());
  const weekSectionRectsRef = useRef<Record<number, { y: number; height: number }>>({});

  // ── Saved-lists drag (2026-07-22): drag a row out of the SavedListsSection accordion
  // onto a week section to instantiate it there. Reuses the same weekSectionNodes/
  // weekSectionRectsRef registry the list-to-list week-reassign drag above measures —
  // both drags target the same 4 sections, just from a different source. ──
  type SavedListDragState = { templateId: string; targetWeek: number | null };
  const [savedListDrag, setSavedListDrag] = useState<SavedListDragState | null>(null);
  const savedListDragRef = useRef<SavedListDragState | null>(null);

  // ── Decision 011 R1 reorder + Decision 022 drag-to-merge (all window-coordinate based) ──
  // Native nodes are registered by DraggableTaskRow (reorder rows) and WeekListCard (dish-group
  // cards) so this screen can measureInWindow() them at drag-start into a shared window space —
  // the only space where the ungrouped section and the "From meals" dish cards are comparable.
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rowNodes = useRef<Map<string, any>>(new Map());
  const dishNodes = useRef<Map<string, any>>(new Map());
  const dragSnapshotRef = useRef<Record<string, { y: number; height: number }>>({});
  const dishRectsRef = useRef<Record<string, { y: number; height: number }>>({});

  // ── Flight animation (Phase 1, 2026-07-11): list→cart toggle flies a floating clone
  // from its measured source rect to the target list's "In cart" section header, both in
  // window space (same measureInWindow idiom as the drag refs above). Cancelled on scroll
  // (see handleScreenScroll) since window-space coords go stale once the user scrolls.
  const cartHeaderNodes = useRef<Map<string, any>>(new Map());
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightCounter = useRef(0);
  const lastScrollY = useRef(0);

  const setDragState = useCallback(
    (next: DragState | null | ((prev: DragState | null) => DragState | null)) => {
      setDrag((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: DragState | null) => DragState | null)(prev) : next;
        dragRef.current = resolved;
        return resolved;
      });
    },
    []
  );

  const items = useShoppingStore((s) => s.items);
  const trips = useShoppingStore((s) => s.trips);
  const add = useShoppingStore((s) => s.add);
  const update = useShoppingStore((s) => s.update);
  const toggle = useShoppingStore((s) => s.toggleCheck);
  const addToWeeklyFromCatalog = useShoppingStore((s) => s.addToWeeklyFromCatalog);
  const putBackToInventory = useShoppingStore((s) => s.putBackToInventory);
  const removeWithSource = useShoppingStore((s) => s.removeWithSource);
  const restoreDeleted = useShoppingStore((s) => s.restoreDeleted);
  const adjustAmount = useShoppingStore((s) => s.adjustAmount);
  const doneShopping = useShoppingStore((s) => s.doneShopping);
  const monthlyReset = useShoppingStore((s) => s.monthlyReset);
  const resetMonthlyList = useShoppingStore((s) => s.resetMonthlyList);
  const buildMonthlyResetSummary = useShoppingStore((s) => s.buildMonthlyResetSummary);
  const reorderItem = useShoppingStore((s) => s.reorder);
  const mergeItems = useShoppingStore((s) => s.mergeItems);
  const recentlyAddedIds = useShoppingStore((s) => s.recentlyAddedIds);
  const monthlyResetDate = useSettingsStore((s) => s.monthlyResetDate);
  const weeklyResetDay = useSettingsStore((s) => s.weeklyResetDay);
  const receipts = useReceiptStore((s) => s.receipts);
  const language = useSettingsStore((s) => s.language);

  const monthlyLists = useMonthlyListStore((s) => s.lists);
  const addMonthlyList = useMonthlyListStore((s) => s.add);
  const renameMonthlyList = useMonthlyListStore((s) => s.rename);
  const toggleMonthlyListLocked = useMonthlyListStore((s) => s.toggleLocked);
  const removeMonthlyList = useMonthlyListStore((s) => s.remove);
  const stampAllMonthlyListsReset = useMonthlyListStore((s) => s.stampAllReset);

  const lists = useShoppingListStore((s) => s.lists);
  const renameList = useShoppingListStore((s) => s.rename);
  const toggleListLocked = useShoppingListStore((s) => s.toggleLocked);
  const updateList = useShoppingListStore((s) => s.update);
  const setListRecurring = useShoppingListStore((s) => s.setRecurring);
  const setListActiveWeeks = useShoppingListStore((s) => s.setActiveWeeks);
  const saveListAsTemplate = useShoppingListStore((s) => s.saveAsTemplate);
  const instantiateTemplate = useShoppingListStore((s) => s.instantiateTemplate);
  const syncListToTemplate = useShoppingListStore((s) => s.syncListToTemplate);
  const addList = useShoppingListStore((s) => s.add);
  const removeList = useShoppingListStore((s) => s.remove);
  const advanceRecurringLists = useShoppingListStore((s) => s.advanceRecurringLists);
  const loadShopping = useShoppingStore((s) => s.load);
  const updateSettings = useSettingsStore((s) => s.update);

  const nonTemplateLists = useMemo(() => lists.filter((l) => !l.isTemplate), [lists]);
  const templateLists = useMemo(() => lists.filter((l) => l.isTemplate), [lists]);
  // Marks a saved list "in use" in SavedListsSection without removing/disabling it — a
  // template stays copyable into other weeks even once it's been used somewhere.
  const usedTemplateIds = useMemo(
    () => new Set(nonTemplateLists.map((l) => l.sourceTemplateId).filter((id): id is string => !!id)),
    [nonTemplateLists]
  );
  const focusedList = useMemo(
    () => nonTemplateLists.find((l) => l.id === focusedListId) ?? nonTemplateLists[0],
    [nonTemplateLists, focusedListId]
  );

  // Recurring-list roll-forward + payday reset detection. Runs on every focus;
  // also closes both add sheets on blur (mirrors the old app: the receipt
  // pop-up's Scan/Upload choices would otherwise leave a sheet open behind
  // whatever screen it pushed to).
  useFocusEffect(
    useCallback(() => {
      // Roll any overdue recurring list forward to the period containing today.
      // A no-op once every recurring list is already current, so it's safe to run
      // on every focus rather than gating it behind a once-per-period flag like
      // the monthly reset below. advanceRecurringLists() writes shopping_items
      // rows directly via the list store, so re-run the shopping load ONLY when it
      // actually created a list — otherwise every focus paid two full-table SQLite
      // scans + a re-render that visibly reflowed the list AFTER the screen painted
      // (focus effects run post-commit). The common case (nothing overdue) now skips it.
      const today = todayStr();
      if (advanceRecurringLists(today)) loadShopping();

      // Automatic payday-boundary reset: once per period, when today's day-of-month
      // has reached monthlyResetDate and we haven't already reset for this period.
      // Read settings via getState() (not a render-time selector) so we see the latest
      // persisted values. Opens the interactive review sheet rather than resetting
      // immediately — lastMonthlyReset is only stamped once the user actually
      // dismisses it (finalizeMonthlyReset), so a backgrounded/killed app with the
      // sheet still open just re-opens it next focus instead of silently skipping
      // the period.
      const periodKey = today.slice(0, 7); // YYYY-MM
      const settings = useSettingsStore.getState();
      const alreadyResetThisPeriod = settings.lastMonthlyReset.slice(0, 7) === periodKey;
      if (!alreadyResetThisPeriod && !resetReviewVisible && new Date().getDate() >= settings.monthlyResetDate) {
        setResetReviewVisible(true);
      }

      return () => {
        setHintOpen(false);
      };
    }, [loadShopping, advanceRecurringLists, resetReviewVisible, setHintOpen])
  );

  // Flat, all-lists-combined catalog — used only by AddFromMonthlyModal (Weekly's "Add from
  // monthly" popup groups these by list itself) and MonthlyResetReviewSheet's whole-household
  // inventory review. Per-list rendering below uses monthlyListViews instead.
  const allCatalogItems = useMemo(
    () => items.filter((i) => i.status === 'catalog').sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  // Per-list item counts for MonthlyResetReviewSheet's "N items" meta line.
  const itemCountByListId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of items) {
      if (i.status === 'inWeeklyList' && i.listId) counts[i.listId] = (counts[i.listId] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  // Shopping — Monthly redesign (2026-07-22): one view-model per named Monthly list, each
  // scoped by monthlyListId — replaces the old single-catalog memos above. The name+category
  // filter (monthlyTabSearch/monthlyTabCategory) is shared across every list's card (one
  // search box, not one per list) but narrows each list's *visible* rows independently;
  // monthlyTotal still sums that list's full unfiltered catalog. Each list's spend-pace
  // (lib/budget.ts's computeSpendPace()) uses its OWN budgetNok/lastReset and only the
  // receipts tagged to it (useReceiptStore's monthlyListId) — null until that list has a
  // budget set and has been through at least one reset (same contract as before, now per list).
  const monthlyListViews = useMemo(() => {
    const q = monthlyTabSearch.trim().toLowerCase();
    return monthlyLists.map((list) => {
      const catalogItems = catalogItemsForList(items, list.id);
      const filteredCatalogItems = catalogItems.filter(
        (i) => (!q || i.name.toLowerCase().includes(q)) && (monthlyTabCategory == null || i.category === monthlyTabCategory)
      );
      const { dishGroups: catalogDishGroups, ungrouped: ungroupedRestItems } = groupByDish(filteredCatalogItems);
      // Skipped once a specific category is picked — every visible row already shares that
      // one category, so a cluster divider would be redundant (mirrors the old single-list logic).
      const ungroupedCategoryGroups = monthlyTabCategory == null ? groupByCategory(ungroupedRestItems) : [];
      const monthlyTotal = catalogItems.reduce((sum, i) => sum + i.price * i.targetQuantity, 0);
      const purchasedByTrip = trips
        .map((trip) => ({
          trip,
          tripItems: items.filter((i) => i.status === 'purchased' && i.shoppingTripId === trip.id && i.monthlyListId === list.id),
        }))
        .filter((g) => g.tripItems.length > 0);
      const listReceipts = receipts.filter((r) => r.monthlyListId === list.id);
      const pace = computeSpendPace(listReceipts, list.budgetNok, monthlyResetDate, list.lastReset);
      return { list, catalogItems, filteredCatalogItems, catalogDishGroups, ungroupedRestItems, ungroupedCategoryGroups, monthlyTotal, purchasedByTrip, pace };
    });
  }, [monthlyLists, items, trips, receipts, monthlyTabSearch, monthlyTabCategory, monthlyResetDate]);
  // Whether ANY list currently has an item — gates showing the shared search/category bar,
  // mirroring the old single-list `catalogItems.length > 0` gate.
  const anyMonthlyItems = useMemo(() => monthlyListViews.some((v) => v.catalogItems.length > 0), [monthlyListViews]);

  // Weekly "Unallocated" bucket — dish ingredients pushed to the week from the Food tab
  // that haven't been assigned to a dated list yet (status inWeeklyList, sentinel listId).
  const unallocatedItems = useMemo(
    () => items.filter((i) => i.status === 'inWeeklyList' && i.listId === UNALLOCATED_LIST_ID && !i.checked),
    [items]
  );
  const { dishGroups: unallocatedDishGroups, ungrouped: unallocatedUngrouped } = useMemo(
    () => groupByDish(unallocatedItems),
    [unallocatedItems]
  );

  const ukelisteBadge = useMemo(
    () =>
      items.filter(
        (i) =>
          i.status === 'inWeeklyList' &&
          !i.checked &&
          (i.listId === UNALLOCATED_LIST_ID || nonTemplateLists.some((l) => l.id === i.listId))
      ).length,
    [items, nonTemplateLists]
  );

  // Decision 044b — cross-tab cue: true while at least one item just landed in the weekly
  // list (Monthly checkbox, Food "Add to week list") and the user isn't looking at Weekly
  // already. Derived straight from the store's self-expiring recentlyAddedIds map, so it
  // clears itself both on tab switch (this expression goes false) and after ~1.8s (the
  // map entry expires) — no extra effect/timer needed here.
  const weeklyAddCue = useMemo(
    () => tab !== 'weekly' && items.some((i) => i.status === 'inWeeklyList' && recentlyAddedIds[i.id]),
    [tab, items, recentlyAddedIds]
  );

  const purchasedByListId = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of items.filter((i) => i.status === 'purchased')) {
      const key = item.listId ?? '';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  // Monthly checkbox (Decision 044a): moves the item straight to the focused weekly
  // list instead of staging it for a separate confirm step. Undoable via the toast.
  function handleAddToWeeklyFromMonthly(item: ShoppingItem) {
    if (!focusedList) {
      setConfirm(t.noWeekListsYet);
      return;
    }
    addToWeeklyFromCatalog(item.id, 1, focusedList.id);
    success();
    setConfirm(t.itemAddedToNamedList(item.name, focusedList.name), () => putBackToInventory(item.id));
  }

  // Weekly/cart rows that came from the Monthly list go back to inventory instead of
  // being deleted outright (their single row IS the standing catalog entry).
  function handleRemoveWeeklyItem(item: ShoppingItem) {
    if (item.fromCatalog) {
      putBackToInventory(item.id);
      success();
      setConfirm(t.itemPutBackToInventory(item.name));
    } else {
      removeWithSource(item.id);
    }
  }

  function handleDoneShopping(list: ShoppingList, checkedCount: number) {
    if (checkedCount === 0) return;
    const label = t.tripLabel(dateStr(new Date()));
    // Scan/Upload commit the trip, then route to /scan with autoCapture so the scanner
    // opens the camera/library straight away (app/scan.tsx is now ported). Skip just
    // commits the trip and confirms in place.
    showAppModal(t.doneShoppingReceiptTitle, t.doneShoppingReceiptBody, [
      { text: t.scanReceiptBtn, onPress: () => { doneShopping(list.id, label, monthlyResetDate); router.push({ pathname: '/scan', params: { autoCapture: 'camera' } }); } },
      { text: t.uploadPhotoBtn, onPress: () => { doneShopping(list.id, label, monthlyResetDate); router.push({ pathname: '/scan', params: { autoCapture: 'library' } }); } },
      { text: t.skipBtn, style: 'cancel', onPress: () => { doneShopping(list.id, label, monthlyResetDate); heavy(); setConfirm(t.doneShoppingSuccessText); } },
    ]);
  }

  function handleAddItem(listId: string, input: { name: string; price: number; targetQuantity: number; isTemporary: boolean; category?: string }) {
    add({ name: input.name, amount: '1', unit: '', listType: 'monthly', store: '', price: input.price, inventoryQty: 0, isTemporary: input.isTemporary, targetQuantity: input.targetQuantity, status: 'catalog', category: input.category, monthlyListId: listId });
    success();
    setConfirm(t.itemAddedToInventory(input.name));
  }

  function handleUpdateSave(patch: { name: string; price: number; targetQuantity: number; isTemporary: boolean }) {
    if (!updateItem) return;
    update(updateItem.id, patch);
    setUpdateItem(null);
    success();
  }

  function handleUpdateDelete() {
    if (!updateItem) return;
    removeWithSource(updateItem.id);
    setUpdateItem(null);
    heavy();
  }

  // ── Weekly "Unallocated" allocation ──
  // Move an unallocated ingredient (or a whole dish's worth) into a real dated week list.
  // Offers one button per existing non-template list; nothing to do if none exist yet.
  function handleAllocate(itemsToMove: ShoppingItem[]) {
    if (itemsToMove.length === 0) return;
    if (nonTemplateLists.length === 0) {
      setConfirm(t.noWeekListsYet);
      return;
    }
    showAppModal(t.allocateToListTitle, '', [
      ...nonTemplateLists.map((l) => ({
        text: l.name,
        onPress: () => {
          for (const it of itemsToMove) update(it.id, { listId: l.id });
          success();
          setConfirm(t.itemsAddedToList(itemsToMove.length));
        },
      })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  function handleMonthlyQty(item: ShoppingItem, delta: number) {
    const next = item.targetQuantity + delta;
    if (next <= 0) {
      removeWithSource(item.id);
    } else {
      update(item.id, { targetQuantity: next });
    }
  }

  const handleDecrementCartItem = useCallback(
    (item: ShoppingItem) => {
      const qty = parseInt(item.amount, 10) || 1;
      if (qty <= 1) {
        // Move item back to "In list" by unchecking it
        toggle(item.id);
        return;
      }
      // Reduce cart item qty by 1
      adjustAmount(item.id, -1);
      // Find or create an "In list" unchecked copy of this item and add 1 there
      const existing = items.find(
        (i) =>
          i.status === 'inWeeklyList' &&
          i.listId === item.listId &&
          !i.checked &&
          i.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      if (existing) {
        adjustAmount(existing.id, 1);
      } else {
        add({
          name: item.name,
          amount: '1',
          unit: item.unit ?? '',
          listType: 'weekly',
          store: item.store ?? '',
          price: item.price,
          inventoryQty: 0,
          status: 'inWeeklyList',
          listId: item.listId,
        });
      }
    },
    [items, toggle, adjustAmount, add]
  );

  function handleCreateNewWeeklyList() {
    const { startDate, endDate } = getWeekRangeContaining(todayStr(), weeklyResetDay);
    addList({ startDate, endDate });
    success();
  }

  function handleDeleteList(listId: string) {
    warning();
    showAppModal(t.deleteListConfirmTitle, t.deleteListConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteList, style: 'destructive', onPress: () => removeList(listId) },
    ]);
  }

  /** "Reset all Monthly lists now" — the full interactive review flow (weekly-list
   *  keep/discard + inventory qty), relocated out of the single old Monthly card's header
   *  now that there are multiple list cards. Still the same flow the automatic
   *  payday-boundary trigger opens. */
  function handleManualMonthlyReset() {
    warning();
    setResetConfirmVisible(true);
  }

  function handleConfirmReset() {
    setResetConfirmVisible(false);
    setResetReviewVisible(true);
  }

  /** Finalizes the ALL-lists monthly reset — fired by MonthlyResetReviewSheet's Skip (empty
   *  array) or Confirm (chosen discards). Discards run first so buildMonthlyResetSummary()/
   *  monthlyReset() see final list state, though order doesn't actually matter functionally
   *  since monthlyReset() filters by item status, not list_id. Stamps every Monthly list's
   *  own lastReset (drives each list's own spend-pace — see store/useMonthlyListStore.ts)
   *  AND the global settings.lastMonthlyReset, which is kept write-only here purely as the
   *  once-per-period bookkeeping flag the automatic payday-boundary detection above reads
   *  (settings.monthlyBudgetNok, the OTHER half of the old global pair, is genuinely unused
   *  now — budget is per list). */
  function finalizeMonthlyReset(discardedListIds: string[]) {
    discardedListIds.forEach(removeList);
    setResetSummary(buildMonthlyResetSummary());
    monthlyReset();
    stampAllMonthlyListsReset(todayStr());
    updateSettings({ lastMonthlyReset: todayStr() });
    setResetReviewVisible(false);
  }

  /** One list's own lightweight "reset this list" — no review sheet, just this list's
   *  catalog/purchased/temporary items back to a clean slate (see resetMonthlyList's header
   *  note for exactly what moves). */
  function handleResetOneList(listId: string) {
    resetMonthlyList(listId);
    useMonthlyListStore.getState().update(listId, { lastReset: todayStr() });
    heavy();
    setResetListConfirmId(null);
  }

  function handleDeleteMonthlyList(listId: string) {
    warning();
    showAppModal(t.deleteListConfirmTitle, t.deleteListConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteList, style: 'destructive', onPress: () => removeMonthlyList(listId) },
    ]);
  }

  /** Kebab menu (2026-07-23 declutter pass) — Reset and Delete moved off the header's
   *  action row (which also carries the Budget pill + Manage inventory icon) into one
   *  overflow entry point, same "tuck rare actions behind ⋮" convention WeekListCard's
   *  openListOptions already uses. */
  function openMonthlyListOptions(list: MonthlyList) {
    showAppModal(list.name, undefined, [
      { text: t.resetMonthlyListAction, onPress: () => { warning(); setResetListConfirmId(list.id); } },
      ...(!list.locked ? [{ text: t.deleteMonthlyListAction, style: 'destructive' as const, onPress: () => handleDeleteMonthlyList(list.id) }] : []),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  function startMonthlyListNameEdit(list: MonthlyList) {
    setMonthlyListNameInput(list.name);
    setEditingMonthlyListId(list.id);
  }

  function commitMonthlyListRename(list: MonthlyList) {
    const trimmed = monthlyListNameInput.trim();
    if (trimmed && trimmed !== list.name) renameMonthlyList(list.id, trimmed);
    setEditingMonthlyListId(null);
  }

  // ── Per-list draft snapshot: capture/clear/save/discard/revert + lock-confirm ──

  /** Canonical per-item key for the dirty diff — only fields the draft actually tracks. */
  function draftItemKey(i: ShoppingItem): string {
    return JSON.stringify([i.name, i.amount, i.checked, i.dishName ?? '', i.category ?? '', i.price, i.orderIndex ?? 0, i.collected, i.targetQuantity]);
  }

  function captureListSnapshot(list: ShoppingList) {
    const snapItems = items
      .filter((i) => i.listId === list.id && i.status === 'inWeeklyList')
      .map((i) => ({ ...i }));
    setListSnapshots((s) => ({ ...s, [list.id]: { name: list.name, isCustomName: list.isCustomName, items: snapItems } }));
  }

  function clearListSnapshot(listId: string) {
    setListSnapshots((s) => {
      if (!(listId in s)) return s;
      const next = { ...s };
      delete next[listId];
      return next;
    });
  }

  // Diffs each snapshotted list's live items/name against its snapshot. A list with no
  // snapshot (never unlocked-then-edited this session) is never dirty.
  const dirtyByListId = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const listId in listSnapshots) {
      const snap = listSnapshots[listId];
      const list = nonTemplateLists.find((l) => l.id === listId);
      if (!list) continue;
      const currentKeys = items
        .filter((i) => i.listId === listId && i.status === 'inWeeklyList')
        .map((i) => `${i.id}:${draftItemKey(i)}`)
        .sort();
      const snapKeys = snap.items.map((i) => `${i.id}:${draftItemKey(i)}`).sort();
      map[listId] =
        list.name !== snap.name ||
        currentKeys.length !== snapKeys.length ||
        currentKeys.some((k, idx) => k !== snapKeys[idx]);
    }
    return map;
  }, [listSnapshots, nonTemplateLists, items]);

  // Sticky-bar badge (2026-07-22): now counts lists with actual unsaved changes, not just
  // "unlocked" ones — a freshly unlocked-but-untouched list no longer trips the badge.
  const unsavedListCount = useMemo(
    () => Object.values(dirtyByListId).filter(Boolean).length,
    [dirtyByListId]
  );

  // Groups non-template lists into the 4 week-of-monthly-cycle sections (1-4) — every
  // section renders even when empty, since each must exist as a drag-drop target.
  const listsByWeek = useMemo(() => {
    const map: Record<number, ShoppingList[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const list of nonTemplateLists) {
      const week = weekOfMonthlyCycle(list.startDate, monthlyResetDate);
      (map[week] ?? (map[week] = [])).push(list);
    }
    return map;
  }, [nonTemplateLists, monthlyResetDate]);

  /** Rewrites the live store back to exactly what `snap` captured — undoes any add/
   *  remove/toggle/qty/merge/rename made since the snapshot, via the same store actions
   *  those operations normally go through (so LWW/sync stamping stays correct). */
  function revertListToSnapshot(listId: string, snap: ListSnapshot) {
    const currentItems = items.filter((i) => i.listId === listId && i.status === 'inWeeklyList');
    const snapById = new Map(snap.items.map((i) => [i.id, i]));
    const curById = new Map(currentItems.map((i) => [i.id, i]));

    // Undo additions made since the snapshot.
    for (const cur of currentItems) {
      if (snapById.has(cur.id)) continue;
      if (cur.fromCatalog) putBackToInventory(cur.id);
      else removeWithSource(cur.id);
    }
    // Undo removals/merges (resurrect) and any other field changes (qty/checked/dish/etc).
    for (const snapItem of snap.items) {
      const cur = curById.get(snapItem.id);
      if (!cur) {
        restoreDeleted(snapItem);
      } else if (draftItemKey(cur) !== draftItemKey(snapItem)) {
        update(snapItem.id, {
          name: snapItem.name,
          amount: snapItem.amount,
          checked: snapItem.checked,
          dishName: snapItem.dishName,
          category: snapItem.category,
          price: snapItem.price,
          orderIndex: snapItem.orderIndex,
          collected: snapItem.collected,
          targetQuantity: snapItem.targetQuantity,
        });
      }
    }
  }

  function handleSaveListChanges(list: ShoppingList) {
    captureListSnapshot(list);
    success();
  }

  function handleDiscardListChanges(list: ShoppingList) {
    const snap = listSnapshots[list.id];
    if (!snap) return;
    revertListToSnapshot(list.id, snap);
    if (list.name !== snap.name || list.isCustomName !== snap.isCustomName) {
      updateList(list.id, { name: snap.name, isCustomName: snap.isCustomName });
    }
    clearListSnapshot(list.id);
    warning();
  }

  /** Lock icon handler: unlocking (currently locked) just captures a fresh baseline and
   *  unlocks, no confirmation needed. Locking (currently unlocked) prompts to save or
   *  discard first if the list is dirty — a bare direct lock otherwise. */
  function handleToggleLock(list: ShoppingList) {
    if (list.locked) {
      captureListSnapshot(list);
      toggleListLocked(list.id);
      return;
    }
    if (!dirtyByListId[list.id]) {
      toggleListLocked(list.id);
      return;
    }
    warning();
    showAppModal(t.unsavedListChangesTitle, t.unsavedListChangesBody, [
      { text: t.saveAndLockBtn, onPress: () => { handleSaveListChanges(list); toggleListLocked(list.id); } },
      { text: t.discardAndLockBtn, style: 'destructive', onPress: () => { handleDiscardListChanges(list); toggleListLocked(list.id); } },
      { text: t.cancel, style: 'cancel' },
    ]);
  }

  // ── Decision 011 R1 reorder + Decision 022 drag-to-merge (screen-owned, window-coordinate) ──

  function handleRegisterRowNode(listId: string, itemId: string, node: any) {
    const key = `${listId}:${itemId}`;
    if (node) rowNodes.current.set(key, node);
    else rowNodes.current.delete(key);
  }

  function handleRegisterDishNode(listId: string, dishName: string, node: any) {
    const key = `${listId}:${dishName}`;
    if (node) dishNodes.current.set(key, node);
    else dishNodes.current.delete(key);
  }

  // ── Flight animation (Phase 1) ──

  function handleRegisterCartHeaderNode(listId: string, node: any) {
    if (node) cartHeaderNodes.current.set(listId, node);
    else cartHeaderNodes.current.delete(listId);
  }

  function handleFlightStart(listId: string, item: ShoppingItem, from: FlightRect) {
    const destNode = cartHeaderNodes.current.get(listId);
    if (!destNode?.measureInWindow) return; // no "In cart" section mounted yet — falls back to today's fade
    destNode.measureInWindow((x: number, y: number, width: number, height: number) => {
      flightCounter.current += 1;
      const key = `${item.id}-${flightCounter.current}`;
      setFlights((prev) => [
        ...prev.filter((f) => f.itemId !== item.id),
        { key, itemId: item.id, from, to: { x, y, width, height }, content: <FlightRow item={item} width={from.width} /> },
      ]);
    });
  }

  function handleFlightEnd(key: string) {
    setFlights((prev) => prev.filter((f) => f.key !== key));
  }

  function handleScreenScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    if (Math.abs(y - lastScrollY.current) > 4 && flights.length > 0) setFlights([]);
    lastScrollY.current = y;
  }

  function handleDragStart(listId: string, itemId: string, itemName: string, order: string[]) {
    // Measure the sibling reorder rows + this list's dish-group cards in window space (the
    // dragged row measures itself inside DraggableTaskRow). measureInWindow's callbacks land
    // within a frame — before the first onDragMove, which only fires once the finger moves
    // past DraggableTaskRow's threshold — so the snapshots are ready by the time they're read.
    dragSnapshotRef.current = {};
    for (const id of order) {
      rowNodes.current.get(`${listId}:${id}`)?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        dragSnapshotRef.current[id] = { y, height: h };
      });
    }
    dishRectsRef.current = {};
    const prefix = `${listId}:`;
    for (const [key, node] of dishNodes.current.entries()) {
      if (!key.startsWith(prefix)) continue;
      const dishName = key.slice(prefix.length);
      node?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        dishRectsRef.current[dishName] = { y, height: h };
      });
    }
    setDragState({ listId, itemId, itemName, startOrder: order, order, mergeTargetDish: null });
  }

  function handleDragMove(listId: string, itemId: string, centerY: number) {
    setDragState((prev) => {
      if (!prev || prev.listId !== listId || prev.itemId !== itemId) return prev;
      // 1. Cross-section merge/join target: the dragged row's window centerY inside a dish band.
      //    Any dish group is a valid drop (same-name → merge, else → join this dish instance).
      let mergeTargetDish: string | null = null;
      for (const dishName in dishRectsRef.current) {
        const r = dishRectsRef.current[dishName];
        if (centerY >= r.y && centerY <= r.y + r.height) {
          mergeTargetDish = dishName;
          break;
        }
      }
      if (mergeTargetDish) {
        if (prev.mergeTargetDish === mergeTargetDish) return prev;
        if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        return { ...prev, mergeTargetDish };
      }
      // 2. Otherwise, in-section reorder preview (Decision 011 R1). Rebuild the order by pulling
      //    the dragged row out and re-inserting it at the finger's stable insertion index — see
      //    lib/reorder.ts for why this can't oscillate (fixes the old up/down flicker).
      const snapshot = dragSnapshotRef.current;
      let order = prev.order;
      if (Object.keys(snapshot).length) {
        const next = reorderByDrag(centerY, prev.order, itemId, snapshot);
        if (next.some((id, i) => id !== prev.order[i])) {
          if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          order = next;
        }
      }
      if (order === prev.order && prev.mergeTargetDish === null) return prev;
      return { ...prev, order, mergeTargetDish: null };
    });
  }

  function handleDragEnd(listId: string, itemId: string) {
    const prev = dragRef.current;
    if (prev && prev.listId === listId && prev.itemId === itemId) {
      if (prev.mergeTargetDish) {
        // Decision 022: dropped onto a dish group. If that dish already holds a same-name
        // ingredient, merge (mergeItems sums amounts + keeps the dish's dishName, drops the
        // standalone row). Otherwise the item simply joins THIS instance of the dish (adopt
        // its dishName) — it never edits the dish's base recipe, which is managed elsewhere.
        const dish = prev.mergeTargetDish;
        const name = prev.itemName.trim().toLowerCase();
        const twin = items.find(
          (i) =>
            i.status === 'inWeeklyList' &&
            i.listId === listId &&
            i.dishName === dish &&
            i.id !== itemId &&
            i.name.trim().toLowerCase() === name
        );
        if (twin) {
          mergeItems(itemId, twin.id);
          setConfirm(t.mergedIntoDish(dish));
        } else {
          update(itemId, { dishName: dish });
          setConfirm(t.movedToDish(dish));
        }
        success();
      } else {
        const fromIndex = prev.startOrder.indexOf(itemId);
        const toIndex = prev.order.indexOf(itemId);
        const delta = toIndex - fromIndex;
        if (delta !== 0) {
          const direction: 'up' | 'down' = delta > 0 ? 'down' : 'up';
          for (let i = 0; i < Math.abs(delta); i++) reorderItem(itemId, direction);
        }
      }
    }
    setDragState(null);
  }

  // ── Week-section drag: drag a collapsed WeekListCard between "week of the monthly
  // cycle" sections to reassign its date range. Same measureInWindow window-space idiom
  // as the item drag-to-merge above — the dragged card measures itself (DraggableTaskRow),
  // the 4 week sections are measured once at drag-start via registered nodes. ──

  function handleRegisterWeekSectionNode(week: number, node: any) {
    if (node) weekSectionNodes.current.set(week, node);
    else weekSectionNodes.current.delete(week);
  }

  function handleWeekDragStart(list: ShoppingList) {
    weekSectionRectsRef.current = {};
    for (const [week, node] of weekSectionNodes.current.entries()) {
      node?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        weekSectionRectsRef.current[week] = { y, height: h };
      });
    }
    const startWeek = weekOfMonthlyCycle(list.startDate, monthlyResetDate);
    const state: WeekDragState = { listId: list.id, startWeek, targetWeek: startWeek };
    weekDragRef.current = state;
    setWeekDrag(state);
  }

  function handleWeekDragMove(listId: string, centerY: number) {
    let targetWeek: number | null = null;
    for (const weekStr in weekSectionRectsRef.current) {
      const week = Number(weekStr);
      const r = weekSectionRectsRef.current[week];
      if (centerY >= r.y && centerY <= r.y + r.height) {
        targetWeek = week;
        break;
      }
    }
    setWeekDrag((prev) => {
      if (!prev || prev.listId !== listId || prev.targetWeek === targetWeek) return prev;
      const next = { ...prev, targetWeek };
      weekDragRef.current = next;
      return next;
    });
  }

  function handleWeekDragEnd(listId: string) {
    const state = weekDragRef.current;
    weekDragRef.current = null;
    setWeekDrag(null);
    if (!state || state.listId !== listId || state.targetWeek == null || state.targetWeek === state.startWeek) return;
    const list = nonTemplateLists.find((l) => l.id === listId);
    if (!list) return;
    const { startDate, endDate } = dateRangeForCycleWeek(todayStr(), monthlyResetDate, state.targetWeek, weeklyResetDay);
    const patch: Partial<ShoppingList> = { startDate, endDate };
    if (!list.isCustomName) patch.name = formatDateRange(startDate, endDate, t.monthsShort, language);
    updateList(listId, patch);
    success();
    setConfirm(t.listMovedToWeek(state.targetWeek));
  }

  // ── Saved-lists drag: drag a SavedListsSection row onto a week section to instantiate
  // it there. Reuses weekSectionNodes/weekSectionRectsRef (already measuring the 4 week
  // sections for the list-to-list drag above) — only the drop target lookup differs. ──

  function handleSavedListDragStart(templateId: string) {
    weekSectionRectsRef.current = {};
    for (const [week, node] of weekSectionNodes.current.entries()) {
      node?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
        weekSectionRectsRef.current[week] = { y, height: h };
      });
    }
    const state: SavedListDragState = { templateId, targetWeek: null };
    savedListDragRef.current = state;
    setSavedListDrag(state);
  }

  function handleSavedListDragMove(templateId: string, centerY: number) {
    let targetWeek: number | null = null;
    for (const weekStr in weekSectionRectsRef.current) {
      const week = Number(weekStr);
      const r = weekSectionRectsRef.current[week];
      if (centerY >= r.y && centerY <= r.y + r.height) {
        targetWeek = week;
        break;
      }
    }
    setSavedListDrag((prev) => {
      if (!prev || prev.templateId !== templateId || prev.targetWeek === targetWeek) return prev;
      const next = { ...prev, targetWeek };
      savedListDragRef.current = next;
      return next;
    });
  }

  function handleSavedListDragEnd(templateId: string) {
    const state = savedListDragRef.current;
    savedListDragRef.current = null;
    setSavedListDrag(null);
    if (!state || state.templateId !== templateId || state.targetWeek == null) return;
    addTemplateToWeek(templateId, state.targetWeek);
  }

  /** Instantiates a saved list into the given week-of-cycle section — shared by the drag
   *  drop above, SavedListsSection's tap-to-choose-week fallback, and the older per-list
   *  SavedListsModal popup. Enforces "only one instance of a given saved list per week
   *  section" (a template already in a DIFFERENT week is fine — only same-week duplicates
   *  are blocked, matching the per-section dedup rule, not a global one). */
  function addTemplateToWeek(templateId: string, week: number) {
    const alreadyInWeek = (listsByWeek[week] ?? []).some((l) => l.sourceTemplateId === templateId);
    if (alreadyInWeek) {
      warning();
      setConfirm(t.templateAlreadyInWeek(week));
      return;
    }
    const { startDate, endDate } = dateRangeForCycleWeek(todayStr(), monthlyResetDate, week, weeklyResetDay);
    const newId = instantiateTemplate(templateId, startDate, endDate);
    if (newId) {
      success();
      setConfirm(t.templateAppliedToast);
      setFocusedListId(newId);
    }
  }

  /** Pushes a copied list's current items back to the saved list it came from — the
   *  "sync back" action in WeekListCard's kebab menu (only shown when sourceTemplateId is
   *  set). syncListToTemplate writes shopping_items rows directly, so refresh useShoppingStore. */
  function handleSyncListToTemplate(list: ShoppingList) {
    if (!syncListToTemplate(list.id)) return;
    loadShopping();
    success();
    setConfirm(t.listSyncedToast);
  }

  /** Saves this list's current items as a new saved/template list — the kebab menu's
   *  direct "Save as template" entry (2026-07-23, moved out of the SavedListsModal
   *  bottom button — see WeekListCard's header). */
  function handleSaveListAsTemplate(list: ShoppingList) {
    saveListAsTemplate(list.id);
    success();
    setConfirm(t.listSavedAsTemplateToast);
  }

  // Active-tab selection colour is the neutral brand accent (theme.accent) for EVERY tab,
  // so this in-app tab bar's "selected" hue matches Plans, Health's SlideSelector, AND the
  // bottom nav (visual-audit 2026-07-20: Weekly's old green `theme.good` + Food's meal-domain
  // accent read as a second, competing "selected" colour on the same screen as the blue nav).
  // The Weekly cross-tab tick cue below stays `theme.good` — that's a status confirmation,
  // not the selection colour.
  const TAB_META: { value: Tab; label: string; accent: string; count: number }[] = [
    { value: 'weekly', label: t.weeklyTabLabel, accent: theme.accent, count: ukelisteBadge },
    { value: 'monthly', label: t.monthlyTabLabel, accent: theme.accent, count: 0 },
  ];

  // Decision 044b's cross-tab cue (a tick popping onto Weekly when an add from
  // Monthly/Food lands there while the user is looking elsewhere) and the list-count
  // badge are baked into each option's `accessory` node here, since TabSlider itself
  // doesn't know about either — it just renders whatever node it's given after the label.
  const tabSliderOptions = TAB_META.map(({ value, label, accent, count }) => {
    const isActive = tab === value;
    return {
      value,
      label,
      color: accent,
      accessory: (
        <>
          {count > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: isActive ? accent : theme.surfaceMuted }]}>
              <Text style={[styles.tabBadgeText, { color: isActive ? theme.accentInk : theme.textMuted }]}>{count}</Text>
            </View>
          )}
          {value === 'weekly' && weeklyAddCue && (
            <Animated.View
              entering={reducedMotion ? undefined : ZoomIn.duration(200)}
              exiting={reducedMotion ? undefined : ZoomOut.duration(150)}
              style={[styles.tabCue, { backgroundColor: theme.good }]}
            >
              <Ionicons name="checkmark" size={10} color={theme.textInverse} />
            </Animated.View>
          )}
        </>
      ),
    };
  });

  // Sticky strip is now just the tab row (debug-note 2026-07-21: the date + amount summary
  // row under the tabs was removed), so it always reserves the tab-only height.
  const stickyHeight = STICKY_HEIGHT_TABS;
  const stickyBelowHeader = (
    // No outer glass card (removed 2026-07-24): TabSlider already draws its own bordered/
    // filled track, so wrapping it in a second Surface card stacked a third layer (outer
    // card + TabSlider's own box + the sliding pill) that read as nested boxes. TabSlider
    // now floats directly, styled with the same side margins as ScreenHeader's own card.
    // (The focused-list name + live-progress summary row under the tabs was removed
    // 2026-07-21 — the per-list card already carries its own name and progress, so the
    // sticky strip is now just the tab row.)
    <TabSlider value={tab} onChange={setTab} options={tabSliderOptions} style={styles.stickyBar} />
  );

  // Screen intro chrome (first-run hint + incoming shared requests), shared by both tabs.
  const shoppingIntro = (
    <>
      <HintCard text={t.hints.shopping.text} open={hintOpen} noPill>
        <View style={[styles.hintSetting, { borderTopColor: theme.hintBorder }]}>
          <Text style={[styles.hintSettingLabel, { color: theme.text }]}>{t.weeklyResetDay}</Text>
          <View style={styles.hintDayRow}>
            {t.dayFull.map((label, i) => (
              <PressableScale
                key={i}
                style={[
                  styles.hintDayChip,
                  { backgroundColor: theme.surfaceMuted },
                  weeklyResetDay === i && { backgroundColor: theme.accent },
                ]}
                onPress={() => updateSettings({ weeklyResetDay: i })}
                scaleTo={0.97}
              >
                <Text style={[
                  styles.hintDayText,
                  { color: theme.text },
                  weeklyResetDay === i && { color: theme.accentInk },
                ]}>
                  {label.slice(0, 3)}
                </Text>
              </PressableScale>
            ))}
          </View>
          <Text style={[styles.hintSettingLabel, { color: theme.text, marginTop: Spacing.sm }]}>{t.monthlyResetDateQuestion}</Text>
          <TextInput
            style={[styles.hintDateInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
            value={monthlyDateInput}
            onChangeText={(v) => {
              setMonthlyDateInput(v);
              const n = parseInt(v, 10);
              if (!isNaN(n) && n >= 1 && n <= 31) updateSettings({ monthlyResetDate: n });
            }}
            onBlur={() => setMonthlyDateInput('')}
            keyboardType="number-pad"
            placeholder={String(monthlyResetDate)}
            placeholderTextColor={theme.textMuted}
            maxLength={2}
            returnKeyType="done"
          />
        </View>
      </HintCard>
      <SharedRequestsSection kind="shopping" />
    </>
  );

  // Food and Catalogue moved off the sticky tab row to button-launched sub-screens
  // (UX audit F1, 2026-07-23) — Weekly/Monthly are the two things a user opens
  // constantly; Food (dish library) and Catalogue (master item list) are visited far
  // less often and didn't need to be permanent peers of the two shopping lists.
  const foodCatalogueLinks = (
    <View style={styles.subScreenLinksRow}>
      <PressableScale
        style={styles.subScreenLinkBtn}
        onPress={() => router.push('/food')}
        accessibilityRole="button"
        accessibilityLabel={t.foodTabLabel}
        scaleTo={0.97}
      >
        <Surface borderColor={mealDomainColor.accent} style={styles.subScreenLinkCard}>
          <Ionicons name="restaurant-outline" size={18} color={mealDomainColor.accent} />
          <Text style={[styles.subScreenLinkText, { color: theme.text }]}>{t.foodTabLabel}</Text>
        </Surface>
      </PressableScale>
      <PressableScale
        style={styles.subScreenLinkBtn}
        onPress={() => router.push('/catalogue')}
        accessibilityRole="button"
        accessibilityLabel={t.catalogueTabLabel}
        scaleTo={0.97}
      >
        <Surface borderColor={shopDomainColor.accent} style={styles.subScreenLinkCard}>
          <Ionicons name="list-outline" size={18} color={shopDomainColor.accent} />
          <Text style={[styles.subScreenLinkText, { color: theme.text }]}>{t.catalogueTabLabel}</Text>
        </Surface>
      </PressableScale>
    </View>
  );

  return (
    <>
    <ScreenScaffold title={t.shoppingTitle} tier="site" bottomNav={false} ownBackground={false} screenColor={getScreenColor(theme, 'shopping').base} stickyGapColor="transparent" stickyBelowHeader={stickyBelowHeader} stickyBelowHeaderHeight={stickyHeight} infoActive={hintOpen} onInfoToggle={() => setHintOpen((v) => !v)} onSharePress={() => router.push('/share-modal?kind=s')} onScanPress={() => router.push('/scan')} onScroll={handleScreenScroll}>
      {/* Debug notes: one anchor for the whole list region. Don't also wrap the inner
          cards/rows — one DebugNoteAnchor per region (no nesting). */}
      <DebugNoteAnchor id="shopping.list" label="Shopping — List" style={styles.content}>
        {shoppingIntro}
        {foodCatalogueLinks}

        {tab === 'monthly' && (
          <>
            {/* Shared name+category filter — one search box narrows every list's visible
                rows at once, rather than one filter bar per card (2026-07-22 redesign). */}
            {anyMonthlyItems && (
              <ShoppingFilterBar
                search={monthlyTabSearch}
                onSearchChange={setMonthlyTabSearch}
                category={monthlyTabCategory}
                onCategoryChange={setMonthlyTabCategory}
                placeholder={t.monthlyPreviewSearchPlaceholder}
              />
            )}

            {monthlyListViews.length === 0 ? (
              <Surface style={styles.catalogCard}>
                <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  {t.monthlyListsEmpty}
                </Text>
              </Surface>
            ) : (
              monthlyListViews.map((view) => {
                const list = view.list;
                const locked = list.locked;
                return (
                  <Surface key={list.id} style={styles.catalogCard}>
                    {/* Title on the left groups with the reset/lock actions on the right
                        (space-between) — the previous right-aligned-only layout left a big empty
                        gap between the tab label and the icons (2026-07-12 redesign). */}
                    <View style={styles.catalogHeaderRow}>
                      <View style={styles.monthlyNameWrap}>
                        {/* Lock sits beside the name (2026-07-23 declutter pass) — same
                            relocation as WeekListCard's lock icon, out of the crowded
                            action row and next to the title it describes. */}
                        <IconButton
                          icon={locked ? 'lock-closed' : 'lock-open-outline'}
                          label={locked ? t.unlockListButtonLabel : t.lockListButtonLabel}
                          onPress={() => toggleMonthlyListLocked(list.id)}
                          active={locked}
                          size={22}
                        />
                        {editingMonthlyListId === list.id ? (
                          <TextInput
                            style={[styles.monthlyNameInput, { color: theme.text, borderColor: theme.border }]}
                            value={monthlyListNameInput}
                            onChangeText={setMonthlyListNameInput}
                            placeholder={t.newMonthlyListNamePlaceholder}
                            placeholderTextColor={theme.textMuted}
                            onSubmitEditing={() => commitMonthlyListRename(list)}
                            onBlur={() => commitMonthlyListRename(list)}
                            returnKeyType="done"
                            autoFocus
                          />
                        ) : (
                          <PressableScale
                            onPress={() => !locked && startMonthlyListNameEdit(list)}
                            style={styles.monthlyNamePreviewBtn}
                            scaleTo={0.98}
                            disabled={locked}
                          >
                            <Text style={[styles.catalogHeaderTitle, { color: theme.text }]} numberOfLines={1}>{list.name}</Text>
                          </PressableScale>
                        )}
                      </View>
                      <View style={styles.catalogHeaderActions}>
                        <PressableScale
                          style={[styles.budgetPill, { borderColor: theme.featBudget }]}
                          onPress={() => router.push({ pathname: '/budget', params: { listId: list.id } })}
                          accessibilityRole="button"
                          accessibilityLabel={t.budget.title}
                          hitSlop={6}
                          scaleTo={0.97}
                        >
                          <Ionicons name="wallet-outline" size={14} color={theme.featBudget} />
                          <Text style={[styles.budgetPillText, { color: theme.featBudget }]}>{t.budget.title}</Text>
                        </PressableScale>
                        <IconButton
                          icon="file-tray-full-outline"
                          label={t.manageInventoryAction}
                          onPress={() => router.push({ pathname: '/inventory-edit', params: { listId: list.id } })}
                        />
                        <IconButton
                          icon="ellipsis-vertical"
                          label={t.listOptionsButtonLabel}
                          onPress={() => openMonthlyListOptions(list)}
                        />
                      </View>
                    </View>

                    {view.pace && (
                      <Text style={[styles.spendPaceText, { color: view.pace.overPace ? theme.warn : theme.good }]}>
                        {t.budget.perDaySpend(String(Math.round(view.pace.actualPerDay)), String(Math.round(view.pace.budgetedPerDay)))}
                      </Text>
                    )}

                    <View style={styles.bodyGap}>
                      {/* SECTION 1 — this list's items (things the user has added). No separate
                          "Monthly list" sub-header (2026-07-23 declutter pass) — the card already
                          shows this list's own name above, and it being a Monthly list is implied
                          by living in the Monthly tab, so the extra label was pure redundancy. */}
                      <View style={styles.section}>
                        {view.catalogItems.length === 0 ? (
                          <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.monthlyListEmpty}</Text>
                        ) : view.filteredCatalogItems.length === 0 ? (
                          <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.monthlyPreviewEmpty}</Text>
                        ) : (
                          <>
                            {view.catalogDishGroups.length > 0 && (
                              <View style={styles.dishGroupsWrap}>
                                {view.catalogDishGroups.map(([dishName, groupItems]) => (
                                  <ExpandableCard key={dishName} title={dishName} subtitle={t.ingredientsCount(groupItems.length)} accentColor={theme.accent} defaultOpen={false}>
                                    {groupItems.map((item, idx) => (
                                      <View key={item.id}>
                                        <MonthlyTableRow
                                          item={item}
                                          onCheckboxPress={() => handleAddToWeeklyFromMonthly(item)}
                                          onPress={!locked ? () => setUpdateItem(item) : undefined}
                                          onIncrement={!locked ? () => handleMonthlyQty(item, 1) : undefined}
                                          onDecrement={!locked ? () => handleMonthlyQty(item, -1) : undefined}
                                          onRemove={!locked ? () => removeWithSource(item.id) : undefined}
                                          temporaryLabel={t.temporaryBadge}
                                        />
                                        {idx < groupItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                                      </View>
                                    ))}
                                  </ExpandableCard>
                                ))}
                              </View>
                            )}
                            {view.ungroupedRestItems.length > 0 && (
                              // More than one category present → cluster with a quiet caption divider
                              // per category; otherwise (the common case — nobody's categorised
                              // anything yet) render flat, same as before, with no extra chrome.
                              view.ungroupedCategoryGroups.length > 1 ? (
                                view.ungroupedCategoryGroups.map(([catKey, catItems]) => (
                                  <View key={catKey}>
                                    <Text style={[styles.categoryClusterLabel, { color: theme.textMuted }]}>
                                      {categoryLabel(t, catKey)}
                                    </Text>
                                    <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                                      {catItems.map((item, idx) => (
                                        <View key={item.id}>
                                          <MonthlyTableRow
                                            item={item}
                                            onCheckboxPress={() => handleAddToWeeklyFromMonthly(item)}
                                            onPress={!locked ? () => setUpdateItem(item) : undefined}
                                            onIncrement={!locked ? () => handleMonthlyQty(item, 1) : undefined}
                                            onDecrement={!locked ? () => handleMonthlyQty(item, -1) : undefined}
                                            onRemove={!locked ? () => removeWithSource(item.id) : undefined}
                                            temporaryLabel={t.temporaryBadge}
                                          />
                                          {idx < catItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                                        </View>
                                      ))}
                                    </View>
                                  </View>
                                ))
                              ) : (
                                <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                                  {view.ungroupedRestItems.map((item, idx) => (
                                    <View key={item.id}>
                                      <MonthlyTableRow
                                        item={item}
                                        onCheckboxPress={() => handleAddToWeeklyFromMonthly(item)}
                                        onPress={!locked ? () => setUpdateItem(item) : undefined}
                                        onIncrement={!locked ? () => handleMonthlyQty(item, 1) : undefined}
                                        onDecrement={!locked ? () => handleMonthlyQty(item, -1) : undefined}
                                        onRemove={!locked ? () => removeWithSource(item.id) : undefined}
                                        temporaryLabel={t.temporaryBadge}
                                      />
                                      {idx < view.ungroupedRestItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                                    </View>
                                  ))}
                                </View>
                              )
                            )}
                            {view.monthlyTotal > 0 && (
                              <Text style={[styles.totalLine, { color: theme.text }]}>{t.monthlyListTotal(formatKr(view.monthlyTotal, 0))}</Text>
                            )}
                          </>
                        )}
                        {/* Add an item straight to this list. The full item catalogue now
                            lives in its own "Catalogue" tab (CatalogueTab); this keeps a direct
                            add-to-monthly affordance where the catalogue section used to sit.
                            Design-consistency pass: a bordered trigger pill (opens the AddItemSheet)
                            matching WeekListCard's "Add from monthly list" trigger — one shared shape
                            for "tap to open a fuller add flow", instead of the old circular AddFAB
                            bubble that read as a third, different add affordance on this screen. */}
                        {!locked && (
                          <>
                            {/* "+ Add item" collapses to a bar and expands into the full add form IN
                                PLACE (no modal) — the multi-field counterpart to components/AddRow, so
                                adding to Monthly uses the same "+ makes a new row, with Add/Discard"
                                affordance as everywhere else. Replaced the AddItemSheet modal
                                (2026-07-19). */}
                            <InlineAddItem
                              label={t.catalogueAddNewBtn}
                              onAdd={(input) => handleAddItem(list.id, input)}
                              categories={categoryPresets(t)}
                              style={styles.addItemSpacing}
                            />
                            {/* Add a whole dish (its ingredients) to this list in place — the
                                in-tab counterpart to the Food tab's "Add to monthly list", so meals can
                                be planned for the month without leaving this tab. Styled to match
                                InlineAddItem's "Add item" bar above (2026-07-23) — same shape,
                                background, and text treatment, so the two add actions read as one
                                consistent affordance instead of two different-looking buttons. */}
                            <PressableScale
                              style={[styles.addTrigger, styles.addItemSpacing, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                              onPress={() => setDishSheetTarget({ mode: 'monthly', listId: list.id })}
                              accessibilityRole="button"
                              accessibilityLabel={t.addDishBtn}
                              scaleTo={0.97}
                            >
                              <Ionicons name="restaurant-outline" size={18} color={theme.accent} />
                              <Text style={[styles.addTriggerText, { color: theme.accent }]}>{t.addDishBtn}</Text>
                            </PressableScale>
                          </>
                        )}
                      </View>

                      {view.purchasedByTrip.length > 0 && (
                        <View style={styles.section}>
                          <View style={[styles.sectionTitleCard, { backgroundColor: theme.surfaceMuted }]}>
                            <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.purchasedThisMonthSection}</Text>
                          </View>
                          {view.purchasedByTrip.map(({ trip, tripItems }) => {
                            const expanded = purchasedExpanded === trip.id;
                            return (
                              <View key={trip.id}>
                                <PressableScale style={[styles.sectionHeaderRow, { backgroundColor: theme.surfaceMuted }]} onPress={() => setPurchasedExpanded(expanded ? null : trip.id)} scaleTo={0.97}>
                                  <Text style={[styles.weekLabel, { color: theme.textMuted }]}>{trip.label}</Text>
                                  <Text style={[styles.disclosureChevron, { color: theme.textMuted }]}>{expanded ? '▲' : '▼'}</Text>
                                </PressableScale>
                                {expanded && (
                                  // Decision 043 rule 1: this already sits inside the list's own
                                  // outer Surface (catalogCard) — plain View + theme.surface fill,
                                  // matching every sibling rowsCard, instead of a second glass layer.
                                  <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                                    {tripItems.map((item, idx) => (
                                      <View key={item.id}>
                                        <ShoppingRow item={item} variant="purchased" onToggle={() => {}} onRemove={() => removeWithSource(item.id)} />
                                        {idx < tripItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </Surface>
                );
              })
            )}

            <NewMonthlyListRow onCreate={(name) => addMonthlyList({ name })} />

            {monthlyListViews.length > 0 && (
              <PressableScale style={styles.resetAllRow} onPress={handleManualMonthlyReset} scaleTo={0.97}>
                <Ionicons name="refresh-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.resetAllText, { color: theme.textMuted }]}>{t.resetAllMonthlyListsAction}</Text>
              </PressableScale>
            )}
          </>
        )}

        {tab === 'weekly' && (
          <>
            {unsavedListCount > 0 && (
              <View
                style={[styles.unsavedBadge, { backgroundColor: theme.accentSoft }]}
                accessibilityLabel={t.unsavedShoppingBanner(unsavedListCount)}
              >
                <Ionicons name="lock-open-outline" size={13} color={theme.accent} />
                <Text style={[styles.unsavedBadgeText, { color: theme.accent }]}>{unsavedListCount}</Text>
              </View>
            )}

            {/* ── Unallocated: dishes added "to the week" from the Food tab, not yet in a dated list ──
                Decision 043 rule 3: featMeal lives on the 4px accent bar only, not the whole
                card's material (a Surface `tint` used to recolor the entire fill/sheen). */}
            {unallocatedItems.length > 0 && (
              <Surface style={[styles.unallocatedCard, styles.unallocatedCardRow]}>
                <View style={[styles.unallocatedAccent, { backgroundColor: mealDomainColor.accent }]} />
                <View style={styles.unallocatedContent}>
                <View style={styles.unallocatedHeader}>
                  <Ionicons name="fast-food-outline" size={18} color={theme.text} />
                  <Text style={[styles.unallocatedTitle, { color: theme.text }]}>{t.unallocatedSection}</Text>
                </View>
                <Text style={[styles.unallocatedHint, { color: theme.textMuted }]}>{t.unallocatedHint}</Text>

                {unallocatedDishGroups.map(([dishName, groupItems]) => (
                  <View key={dishName} style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                    <View style={styles.unallocatedGroupHeader}>
                      <Text style={[styles.unallocatedGroupName, { color: theme.text }]} numberOfLines={1}>{dishName}</Text>
                      <PressableScale style={[styles.allocateBtn, { backgroundColor: theme.good }]} onPress={() => handleAllocate(groupItems)} hitSlop={6} scaleTo={0.97}>
                        <Ionicons name="arrow-forward" size={14} color={theme.textInverse} />
                        <Text style={[styles.allocateBtnText, { color: theme.textInverse }]}>{t.allocateItemLabel}</Text>
                      </PressableScale>
                    </View>
                    {groupItems.map((item, idx) => (
                      <View key={item.id}>
                        <View style={[styles.unallocatedRow, { borderTopColor: theme.border }, idx > 0 && styles.unallocatedRowBorder]}>
                          <Text style={[styles.unallocatedItemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                          <Text style={[styles.unallocatedItemMeta, { color: theme.textMuted }]}>
                            {item.amount}{item.unit ? ` ${item.unit}` : ''}{item.price > 0 ? ` · ${formatKr(item.price, 0)}` : ''}
                          </Text>
                          <PressableScale onPress={() => removeWithSource(item.id)} hitSlop={8} accessibilityLabel={t.removeItemLabel} scaleTo={0.93}>
                            <Ionicons name="close" size={18} color={theme.textMuted} />
                          </PressableScale>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}

                {unallocatedUngrouped.length > 0 && (
                  <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                    {unallocatedUngrouped.map((item, idx) => (
                      <View key={item.id} style={[styles.unallocatedRow, idx > 0 && styles.unallocatedRowBorder, { borderTopColor: theme.border }]}>
                        <Text style={[styles.unallocatedItemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                        <Text style={[styles.unallocatedItemMeta, { color: theme.textMuted }]}>
                          {item.amount}{item.unit ? ` ${item.unit}` : ''}{item.price > 0 ? ` · ${formatKr(item.price, 0)}` : ''}
                        </Text>
                        <PressableScale style={[styles.allocateBtn, { backgroundColor: theme.good }]} onPress={() => handleAllocate([item])} hitSlop={6} scaleTo={0.97}>
                          <Ionicons name="arrow-forward" size={14} color={theme.textInverse} />
                        </PressableScale>
                        <PressableScale onPress={() => removeWithSource(item.id)} hitSlop={8} accessibilityLabel={t.removeItemLabel} scaleTo={0.93}>
                          <Ionicons name="close" size={18} color={theme.textMuted} />
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                )}
                </View>
              </Surface>
            )}

            {/* ── Saved lists: expandable accordion, drag (or tap-to-choose-week) a saved
                list into a week section below to instantiate it there. ── */}
            <SavedListsSection
              templates={templateLists}
              usedTemplateIds={usedTemplateIds}
              onDragStart={handleSavedListDragStart}
              onDragMove={handleSavedListDragMove}
              onDragEnd={handleSavedListDragEnd}
              onQuickAdd={addTemplateToWeek}
            />

            {/* ── Weekly lists, grouped into one section per week of the monthly cycle ──
                All 4 sections always render (each registers itself as a drag-drop target
                via handleRegisterWeekSectionNode) once at least one list OR saved list
                exists — a saved list needs somewhere to be dropped even before the first
                live list is created. With neither, there's nothing to drag yet, so the big
                EmptyState placeholder below covers that case instead of 4 redundant "no
                lists here" sections. */}
            {(nonTemplateLists.length > 0 || templateLists.length > 0) && [1, 2, 3, 4].map((week) => {
              const weekRange = dateRangeForCycleWeek(todayStr(), monthlyResetDate, week, weeklyResetDay);
              const weekLists = listsByWeek[week] ?? [];
              const isDropTarget =
                (weekDrag != null && weekDrag.targetWeek === week && weekDrag.startWeek !== week) ||
                (savedListDrag != null && savedListDrag.targetWeek === week);

              return (
                <React.Fragment key={week}>
                  {week > 1 && <SectionDivider />}
                  <View
                    ref={(node) => handleRegisterWeekSectionNode(week, node)}
                    style={[
                      styles.weekSection,
                      isDropTarget && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                    ]}
                  >
                  <View style={styles.weekSectionHeaderRow}>
                    <Text style={[styles.weekSectionLabel, { color: theme.text }]}>{t.weekNumberChip(week)}</Text>
                    <Text style={[styles.weekSectionRange, { color: theme.textMuted }]}>
                      {formatDateRange(weekRange.startDate, weekRange.endDate, t.monthsShort, language)}
                    </Text>
                  </View>

                  {weekLists.length === 0 ? (
                    <Text style={[styles.weekSectionEmptyText, { color: theme.textMuted }]}>{t.weekSectionEmpty}</Text>
                  ) : (
                    weekLists.map((list) => {
                      const groups = computeListGroups(items, list.id);
                      const groupsProgress = listProgress(groups);
                      const order = groups.ungroupedUnchecked.map((i) => i.id);
                      const displayUngrouped =
                        drag && drag.listId === list.id
                          ? (drag.order.map((id) => groups.ungroupedUnchecked.find((i) => i.id === id)).filter(Boolean) as ShoppingItem[])
                          : groups.ungroupedUnchecked;
                      const expanded = !!expandedListIds[list.id];

                      return (
                        <DraggableTaskRow
                          key={list.id}
                          isOpen={expanded}
                          onDragStart={() => handleWeekDragStart(list)}
                          onDragMove={(centerY) => handleWeekDragMove(list.id, centerY)}
                          onDragEnd={() => handleWeekDragEnd(list.id)}
                        >
                          <WeekListCard
                            list={list}
                            focused={focusedList?.id === list.id}
                            onFocus={() => setFocusedListId(list.id)}
                            expanded={expanded}
                            onToggleExpand={() => toggleListExpanded(list.id)}
                            dirty={!!dirtyByListId[list.id]}
                            onSaveChanges={() => handleSaveListChanges(list)}
                            onDiscardChanges={() => handleDiscardListChanges(list)}
                            dishGroups={groups.dishGroups}
                            ungroupedUnchecked={displayUngrouped}
                            checked={groups.checked}
                            purchased={purchasedByListId.get(list.id) ?? []}
                            onToggleLock={() => handleToggleLock(list)}
                            onRename={(name) => renameList(list.id, name)}
                            onOpenSavedLists={() => setSavedListsListId(list.id)}
                            onOpenListSettings={() => setListSettingsListId(list.id)}
                            onDelete={() => handleDeleteList(list.id)}
                            onSyncToTemplate={() => handleSyncListToTemplate(list)}
                            onSaveAsTemplate={() => handleSaveListAsTemplate(list)}
                            onToggleItem={(item) => toggle(item.id)}
                            onRemoveItem={handleRemoveWeeklyItem}
                            onIncrementItem={(item) => adjustAmount(item.id, 1)}
                            onDecrementItem={(item) => adjustAmount(item.id, -1)}
                            onDecrementCartItem={handleDecrementCartItem}
                            onAddInlineItem={(input) => {
                              add({
                                name: input.name,
                                amount: String(input.qty),
                                unit: '',
                                listType: 'weekly',
                                store: '',
                                price: input.price,
                                inventoryQty: 0,
                                isTemporary: false,
                                targetQuantity: input.qty,
                                status: 'inWeeklyList',
                                listId: list.id,
                                category: input.category,
                              });
                              success();
                              setConfirm(t.itemAddedToList(input.name));
                            }}
                            monthlyItems={allCatalogItems}
                            monthlyLists={monthlyLists}
                            onAddMonthlyItemsToWeek={(monthlyItemsToAdd) => {
                              for (const item of monthlyItemsToAdd) {
                                addToWeeklyFromCatalog(item.id, parseInt(item.amount, 10) || 1, list.id);
                              }
                              success();
                              setConfirm(
                                monthlyItemsToAdd.length === 1
                                  ? t.itemAddedToList(monthlyItemsToAdd[0].name)
                                  : t.itemsAddedToList(monthlyItemsToAdd.length)
                              );
                            }}
                            onDoneShopping={() => handleDoneShopping(list, groupsProgress.inCart)}
                            onOpenDishSheet={() => setDishSheetTarget({ mode: 'weekly', listId: list.id })}
                            registerCartHeaderNode={(node) => handleRegisterCartHeaderNode(list.id, node)}
                            onFlightStart={(item, rect) => handleFlightStart(list.id, item, rect)}
                            registerDishGroupNode={(dishName, node) => handleRegisterDishNode(list.id, dishName, node)}
                            mergeHighlightDish={drag?.listId === list.id ? drag.mergeTargetDish : null}
                            renderReorderableRow={(item) => (
                              <DraggableTaskRow
                                isOpen={false}
                                registerNode={(node) => handleRegisterRowNode(list.id, item.id, node)}
                                onDragStart={() => handleDragStart(list.id, item.id, item.name, order)}
                                onDragMove={(centerY) => handleDragMove(list.id, item.id, centerY)}
                                onDragEnd={() => handleDragEnd(list.id, item.id)}
                              >
                                <ShoppingRow
                                  item={item}
                                  variant="planned"
                                  onToggle={() => toggle(item.id)}
                                  onRemove={() => handleRemoveWeeklyItem(item)}
                                  onIncrement={() => adjustAmount(item.id, 1)}
                                  onDecrement={() => adjustAmount(item.id, -1)}
                                  inStockLabel={t.inStockLabel}
                                  locked={list.locked}
                                  onFlightStart={(rect) => handleFlightStart(list.id, item, rect)}
                                />
                              </DraggableTaskRow>
                            )}
                          />
                        </DraggableTaskRow>
                      );
                    })
                  )}
                  </View>
                </React.Fragment>
              );
            })}

            {nonTemplateLists.length === 0 && unallocatedItems.length === 0 && templateLists.length === 0 && (
              // Neutral edge (theme.border) instead of the default screen-hue edge, so this
              // empty placeholder reads as a quiet "nothing here yet", not a coded surface
              // (2026-07-20 unify placeholder cards).
              <Surface style={styles.weekEmptyCard} borderColor={theme.border}>
                <EmptyState
                  icon="cart-outline"
                  title={t.weekEmptyTitle}
                  body={t.weekEmptyBody}
                />
              </Surface>
            )}

            {/* Creating a new list has no single text field to fill (it's auto-named by
                date range, then offers a start-empty/from-saved choice), so it doesn't fit
                the AddRow shape — it's a "tap to open a chooser" trigger. Big-ish plain
                white/surface button, just a plus sign (2026-07-23 simplification, matching
                the Monthly tab's NewMonthlyListRow trigger) — was a smaller accent-tinted
                bordered pill with an icon+label. */}
            <PressableScale
              style={[styles.newListTrigger, { borderColor: theme.border, backgroundColor: theme.surface }]}
              onPress={() =>
                showAppModal(t.newWeeklyListTitle, '', [
                  { text: t.startEmptyList, onPress: handleCreateNewWeeklyList },
                  { text: t.savedListsTitle, onPress: () => setSavedListsListId('__new__') },
                  { text: t.cancel, style: 'cancel' },
                ])
              }
              accessibilityRole="button"
              accessibilityLabel={t.newWeeklyListTitle}
              scaleTo={0.97}
            >
              <Ionicons name="add" size={26} color={theme.accent} />
            </PressableScale>
          </>
        )}

      </DebugNoteAnchor>

      <AddDishSheet
        visible={dishSheetTarget !== null}
        onClose={() => setDishSheetTarget(null)}
        onAdded={(dishName) =>
          setConfirm(dishSheetTarget?.mode === 'weekly' ? t.dishAddedToWeek(dishName) : t.dishAddedToMonthly(dishName))
        }
        target={dishSheetTarget ?? { mode: 'monthly', listId: monthlyLists[0]?.id ?? '' }}
      />

      <UpdateSheet visible={updateItem !== null} item={updateItem} onClose={() => setUpdateItem(null)} onSave={handleUpdateSave} onDelete={handleUpdateDelete} />

      <MonthlyResetReviewSheet
        visible={resetReviewVisible}
        lists={nonTemplateLists}
        itemCountByListId={itemCountByListId}
        catalogItems={allCatalogItems}
        onReorderLists={(order) => order.forEach((id, i) => useShoppingListStore.getState().update(id, { sortOrder: i }))}
        onSetInventoryQty={(id, qty) => update(id, { inventoryQty: qty })}
        onFinalize={finalizeMonthlyReset}
      />
      <MonthlyResetSummaryModal visible={resetSummary !== null} summary={resetSummary} onClose={() => setResetSummary(null)} />

      <SavedListsModal
        visible={savedListsListId !== null}
        templates={templateLists}
        onClose={() => setSavedListsListId(null)}
        onSelectTemplate={(id) => addTemplateToWeek(id, weekOfMonthlyCycle(todayStr(), monthlyResetDate))}
      />

      <ListSettingsSheet
        visible={listSettingsListId !== null}
        list={nonTemplateLists.find((l) => l.id === listSettingsListId)}
        onClose={() => setListSettingsListId(null)}
        onSetRecurring={(isRecurring, intervalWeeks) => {
          if (listSettingsListId) setListRecurring(listSettingsListId, isRecurring, intervalWeeks);
        }}
        onSetActiveWeeks={(weeks) => {
          if (listSettingsListId) setListActiveWeeks(listSettingsListId, weeks);
        }}
      />
    </ScreenScaffold>
    <FlightOverlay flights={flights} onFlightEnd={handleFlightEnd} />
    <ConfirmationBanner
      message={confirmMessage}
      onDismiss={() => setConfirm(null)}
      actionLabel={confirmUndo ? t.undoBtn : undefined}
      onAction={confirmUndo ?? undefined}
    />

    <Modal visible={resetConfirmVisible} transparent animationType="fade" onRequestClose={() => setResetConfirmVisible(false)}>
      <View style={styles.dialogOverlay}>
        <View style={[styles.dialogBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.dialogMessage, { color: theme.text }]}>{t.resetAllMonthlyListsConfirmTitle}</Text>
          <Text style={[styles.dialogBody, { color: theme.textMuted }]}>{t.resetAllMonthlyListsConfirmBody}</Text>
          <View style={styles.dialogBtns}>
            <PressableScale style={[styles.dialogBtn, styles.dialogBtnNo]} onPress={() => setResetConfirmVisible(false)} scaleTo={0.97}>
              <Text style={styles.dialogBtnText}>{t.no}</Text>
            </PressableScale>
            <PressableScale style={[styles.dialogBtn, styles.dialogBtnYes]} onPress={handleConfirmReset} scaleTo={0.93}>
              <Text style={styles.dialogBtnText}>{t.yes}</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>

    {/* One list's own lightweight "reset this list" confirm (2026-07-22) — no review sheet,
        see resetMonthlyList's header note for exactly what it clears. */}
    <Modal visible={resetListConfirmId !== null} transparent animationType="fade" onRequestClose={() => setResetListConfirmId(null)}>
      <View style={styles.dialogOverlay}>
        <View style={[styles.dialogBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.dialogMessage, { color: theme.text }]}>{t.resetMonthlyListConfirmTitle}</Text>
          <Text style={[styles.dialogBody, { color: theme.textMuted }]}>{t.resetMonthlyListConfirmBody}</Text>
          <View style={styles.dialogBtns}>
            <PressableScale style={[styles.dialogBtn, styles.dialogBtnNo]} onPress={() => setResetListConfirmId(null)} scaleTo={0.97}>
              <Text style={styles.dialogBtnText}>{t.no}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.dialogBtn, styles.dialogBtnYes]}
              onPress={() => { if (resetListConfirmId) handleResetOneList(resetListConfirmId); }}
              scaleTo={0.93}
            >
              <Text style={styles.dialogBtnText}>{t.yes}</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  // Embedded first-run setting inside the ⓘ hint (weekly/monthly reset).
  hintSetting: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: Spacing.xs },
  hintSettingLabel: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  hintDayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  hintDayChip: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: Radius.full,
  },
  hintDayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  hintDateInput: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    textAlign: 'center',
    alignSelf: 'flex-start',
    minWidth: 64,
  },
  // Food/Catalogue entry-point buttons (UX audit F1, 2026-07-23) — shown above the list
  // content on both Weekly and Monthly, since either sub-screen is reachable regardless
  // of which shopping list tab is active.
  subScreenLinksRow: { flexDirection: 'row', gap: Spacing.sm },
  subScreenLinkBtn: { flex: 1 },
  subScreenLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  subScreenLinkText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },

  // Decision 043 rule 2: Spacing.xl above each of the Monthly tab's two named sections.
  bodyGap: { gap: Spacing.xl },
  dishGroupsWrap: { gap: Spacing.xs },

  // Styles TabSlider directly (no wrapping card, see the 2026-07-24 stickyBelowHeader edit
  // note) — side margin matches ScreenHeader's own floated card (headerFloatH); flex:1 +
  // justifyContent:'center' fill and vertically center it within the reserved sticky height.
  stickyBar: { flex: 1, marginHorizontal: Spacing.md, justifyContent: 'center' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontFamily: Fonts.bold },
  tabCue: { width: 16, height: 16, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },

  catalogCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  catalogHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catalogHeaderTitle: { fontFamily: Type.heading.fontFamily, fontSize: Type.heading.size },
  catalogHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Budget entry point (moved here from app/(tabs)/scan.tsx, 2026-07-19 — Budget is only
  // reachable via Shopping now; relocated again 2026-07-22 from the shared shoppingIntro
  // chrome, where it repeated on all 4 tabs, into the Monthly tab's own header row —
  // Budget is a monthly-spend concept, so it now shows only there). Bordered pill, same
  // family as addTrigger below, inline with the reset/lock icons (no alignSelf needed —
  // sits in a row, not standalone).
  budgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  budgetPillText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  // Spend-vs-budget pace line (Decision 026) — sits under the header row, above the
  // Monthly list sections. Same figure/copy as app/budget.tsx's own pace row.
  spendPaceText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginTop: Spacing.xs },
  // Bordered trigger pill — matches WeekListCard's monthlyTrigger shape, the one shared
  // "tap to open a fuller add flow" affordance (design-consistency pass). Matched to
  // InlineAddItem's collapsed "addBar" shape (2026-07-23) so "Add item" and "Add dish"
  // read as the same affordance — same padding/minHeight/background/text style.
  addTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  addTriggerText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  addItemSpacing: { marginTop: Spacing.sm },

  // Shopping — Monthly redesign (2026-07-22): tap-to-edit Monthly list name, mirroring
  // WeekListCard's nameEditing/nameInput idiom (greyed placeholder disappears once typed).
  // Row layout (2026-07-23) so the lock icon sits inline right before the name.
  monthlyNameWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  monthlyNamePreviewBtn: { flex: 1, minWidth: 0, paddingVertical: 2 },
  monthlyNameInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: Type.heading.fontFamily,
    fontSize: Type.heading.size,
    borderBottomWidth: 1,
    paddingVertical: 2,
  },
  // Relocated global "reset every list" entry point — a quiet text row under the list
  // cards + "+ New list", not a prominent icon (each list's own reset icon is the primary
  // affordance now).
  resetAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  resetAllText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },

  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  dialogBox: { borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 340, gap: Spacing.lg },
  dialogMessage: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size, textAlign: 'center' },
  dialogBody: { fontSize: FontSize.sm, textAlign: 'center', marginTop: -Spacing.sm },
  dialogBtns: { flexDirection: 'row', gap: Spacing.sm },
  dialogBtn: { flex: 1, borderRadius: Radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm },
  dialogBtnNo: { backgroundColor: '#1E3A5F' },
  dialogBtnYes: { backgroundColor: '#4A90D9' },
  dialogBtnText: { color: '#FFFFFF', fontFamily: Fonts.bold, fontSize: FontSize.sm, textAlign: 'center' },
  // Visual-audit 2026-07-11: background/border colour applied inline (theme) at each
  // call site — was bare muted text floating on the particle background.
  sectionEmpty: { fontSize: FontSize.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1 },
  totalLine: { fontSize: FontSize.md, fontFamily: Fonts.bold, textAlign: 'right', marginTop: 4 },

  // Compact icon+count indicator (2026-07-22) — replaces an earlier full-sentence banner
  // that read as an unstyled strip of text; self-start so it doesn't stretch full-width.
  unsavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  unsavedBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },

  // Weekly "Unallocated" card
  unallocatedCard: { borderRadius: Radius.md },
  unallocatedCardRow: { flexDirection: 'row' },
  unallocatedAccent: { width: 4, alignSelf: 'stretch' },
  unallocatedContent: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  unallocatedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  unallocatedTitle: { fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
  unallocatedHint: { fontSize: FontSize.xs },
  unallocatedGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: 4 },
  unallocatedGroupName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.bold },
  unallocatedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  unallocatedRowBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  unallocatedItemName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  unallocatedItemMeta: { fontSize: FontSize.xs },
  allocateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4, minHeight: 28 },
  allocateBtnText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },

  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  rowDivider: { height: 1 },
  section: { gap: Spacing.sm },
  // Quiet category-cluster caption (Monthly's ungrouped rows only) — lighter-weight than
  // sectionHeaderRow's bordered/backgrounded treatment, just a small label above each cluster.
  categoryClusterLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: Spacing.xs,
  },
  // Pill background so the per-trip disclosure toggle stays legible over busy backgrounds
  // (Decision 043 rule 2's fixed anatomy — Fonts.semibold/FontSize.lg — is only for the
  // section title itself, sectionLabel below; this row is a repeatable foldout control).
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  sectionLabel: { fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
  // Visual-audit 2026-07-11: gives Monthly-tab section titles the same surfaceMuted-card
  // treatment plans.tsx's sectionHeader() already applies — was bare text, flat/low-contrast
  // against the particle background.
  sectionTitleCard: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm, marginBottom: Spacing.sm },

  disclosureChevron: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  weekLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },

  weekEmptyCard: { borderRadius: Radius.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md },
  // One section per week of the monthly cycle (2026-07-22) — a plain bordered region (not
  // a Surface: WeekListCard is already its own Surface-backed card, so this stays a quiet
  // grouping frame). borderColor/backgroundColor go transparent at rest, tinted to
  // theme.accent/accentSoft only while a dragged card's centerY is over this section.
  weekSection: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  weekSectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, paddingHorizontal: Spacing.xs },
  weekSectionLabel: { fontFamily: Fonts.bold, fontSize: FontSize.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  weekSectionRange: { fontSize: FontSize.xs },
  weekSectionEmptyText: { fontSize: FontSize.sm, paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xs },
  // Big-ish plain white/surface "+" button (2026-07-23) — primary action on the Weekly tab.
  newListTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
});
