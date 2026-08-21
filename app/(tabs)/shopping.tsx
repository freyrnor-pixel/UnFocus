/**
 * shopping.tsx — Shopping hub. Four always-visible groups, no tab switch, in the order the
 * maintainer settled on 2026-08-21: **Shopping lists → Food → Catalogue → Monthly.**
 *
 * That order is an answer to a question, so it is worth not re-deriving. `CONSISTENCY_AUDIT.md`
 * §13 asked whether Dishes and Catalogue should sit under one "Inventory" header, and whether
 * Monthly should move directly ABOVE the lists it feeds (it renders the items a weekly list is
 * built from). The answer named the order and neither of the groupings: *"Shopping lists, food
 * and Catalogue, Monthly."* So the lists you open on a trip come first, the two libraries next,
 * and Monthly last — and there is deliberately no "Inventory" header over Dishes and Catalogue,
 * and nothing presenting Monthly as a parent of the shopping list.
 *
 * **No more tab switch (2026-08-20, card-element standardization pass).** Weekly and Monthly
 * used to be two `components/TabSlider.tsx` tabs — pick one, the other's content is unmounted
 * from view. Both now render unconditionally, one after the other, each under a plain
 * `components/SectionRail.tsx` header (hue dot + label + count, no wrapping card — a card
 * around a stack of cards reads as a nested panel, and each list is already its own Surface
 * card). Monthly used to render FIRST in the DOM, which that pass admitted was *"leftover
 * source order from when this was extracted, not a deliberate call"* and left as a follow-up;
 * this is that follow-up. The three groups are `weeklyGroup` / `foodCatalogueLinks` /
 * `monthlyGroup` consts now, composed in one readable line in the return, so the next change of
 * mind about the order costs a line rather than relocating ~700 lines of drag/merge JSX. The old
 * cross-tab "item just landed in Weekly" tick cue is gone with the tab switch — there's no
 * longer an other tab for it to have landed on unseen. Everything downstream of the tab
 * bar — `WeekListCard`, the Monthly `catalogCard`s, the drag/merge/flight-animation state, the
 * sheets/modals — is untouched; only the switch that hid one group while showing the other
 * was removed.
 *
 * **Down from four in-place tabs to two, plus two peer cards (UX audit F1, 2026-07-23;
 * reshaped again 2026-08-20)**: Food and Catalogue used to be full sticky-tab peers of Weekly/
 * Monthly, but they're opened far less often — screen-overload candidate the audit flagged.
 * They went through three shapes since: a small two-button row → two
 * `components/CollapsedSection.tsx` fold-away drawers (2026-08-10) → their current shape,
 * `foodCatalogueLinks`, two always-open `components/SectionCard.tsx`s at the standard card
 * header (badge · title · count · expand), shown at the foot of the screen. **Since 2026-08-10
 * they MOUNT `components/FoodTab`/`components/CatalogueTab`
 * (in `embedded` mode) as their body** — the whole Food surface and a searchable, addable,
 * editable slice of the Catalogue, usable without leaving this screen. **Since 2026-08-20 the
 * name press EXPANDS the card in place** (components/CardExpandHost.tsx's `shopDishes`/
 * `shopCatalogue`, mounting the FULL non-embedded FoodTab/CatalogueTab) rather than pushing
 * `/food`/`/catalogue` — those routes stay valid for deep links only. Catalogue's complete
 * virtualised list and A–Z scrubber still need the non-embedded body; only where it renders
 * changed. Both components are otherwise unchanged — `embedded` only unwraps the chrome that
 * assumes a screen backdrop (see each file's own edit note).
 * ⚠️ **Weekly and Monthly did NOT get the same `embedded`/`CardExpandHost` full-screen
 * treatment Food/Catalogue have** — that was deliberately scoped OUT of the 2026-08-20
 * tabs-to-cards pass. Each list is ~2000 lines of window-coordinate drag/merge state and
 * flight-animation refs shared across the whole screen closure, which is a materially
 * higher-risk extraction than Food/Catalogue's — see `lib/expandableCards.ts`'s edit notes
 * (the `shopLists` EXPAND id was removed on 2026-08-21 — see lib/expandableCards.ts; the lists
 * group folds instead, which is what it actually needed). A future pass can finish
 * it the same way; this pass only removed the tab SWITCH.
 *
 * The "Week lists" group renders an "Unallocated" card (dish
 * ingredients pushed to the week from the Food screen, sentinel listId UNALLOCATED_LIST_ID)
 * then one WeekListCard per non-template shopping_lists row plus an empty "create new
 * list" card. The "Monthly" group (Shopping/Monthly redesign, 2026-07-22) renders one
 * lock-gated card PER named Monthly list (store/useMonthlyListStore.ts) — each with its
 * own tap-to-rename name, own budget pill (→ app/budget.tsx, listId param), own manual
 * reset icon, dish-grouped + ungrouped curated items, add-to-list triggers, and
 * purchased-this-month history — plus a "+ New list" row and a small relocated "reset all
 * lists" link at the bottom. Replaces the old single global Katalog card.
 *
 * Connections:
 *   Imports → components/InlineAddItem, components/AddDishSheet (AddDishTarget type),
 *             components/NarratorQuote (2026-08-19 — an unlocked monthly list with nothing
 *             in it; see that file's header for the three empty states it stays out of),
 *             components/StarterCard (first-run explainer, shown while
 *             there are no weekly lists and no items — text-only as of 2026-07-28, no example
 *             rows any more), components/AppModal (showAppModal),
 *             components/CardAccent (CardAccentBadge),
 *             components/ConfirmationBanner, components/DraggableTaskRow,
 *             components/ExpandableCard, components/Collapsible + components/AnimatedChevron
 *             (the purchased-this-month trip groups — see that block's own note),
 *             components/FlightOverlay (FlightPill, Flight, FlightRect),
 *             components/IconButton,
 *             components/ListSettingsSheet, components/MonthlyResetSummaryModal,
 *             components/MonthlyResetReviewSheet,
 *             components/MonthlyTableRow, components/SavedListsModal, components/SavedListsSection,
 *             components/ScreenScaffold, components/SharedRequestsSection (gated on
 *             settings.featureSharing — the only opt-in left on this screen; the
 *             Food/Catalogue row, scan icon, Budget pill and spend-pace line are all
 *             unconditional as of the 2026-07-25 defaults revision),
 *             components/ShoppingFilterBar, components/ShoppingRow,
 *             components/KeepAwakeInStore (holds the screen awake while the in-store chip
 *             layout is showing — mounted here, once, as a sibling of ScreenScaffold; it
 *             replaced components/ShoppingStoreMode, retired 2026-08-20), components/Surface,
 *             components/UpdateSheet, components/WeekListCard,
 *             components/PressableScale, components/SectionRail,
 *             constants/theme, react-native (AppState — the payday-boundary check also
 *             runs on app foreground now, not just navigation focus; see the edit note),
 *             lib/date (todayStr, dateStr, getWeekRangeContaining, weekOfMonthlyCycle,
 *             dateRangeForCycleWeek, formatDateRange), lib/haptics (success,
 *             heavy, warning), lib/i18n, lib/money (formatKr), lib/shoppingGroups (groupByDish,
 *             groupByCategory, computeListGroups, listProgress, catalogItemsForList),
 *             lib/shoppingCategories (categoryPresets, categoryLabel),
 *             lib/reorder (reorderByDrag), lib/useAppTheme, lib/prefill (usePrefill — a note
 *             sent here seeds THIS week's add row),
 *             lib/domainColor, lib/budget (computeSpendPace),
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
 *             app/_layout.tsx); FoodTab/CatalogueTab do too (FoodTab additionally drives
 *             useMealStore). This screen mounts both again as of 2026-08-10 — inside the
 *             Food/Catalogue drawers — and reads each store only for the drawer's own count.
 *
 * Edit notes:
 *   - **The payday-boundary check also runs on app foreground, not just navigation focus
 *     (2026-08-13).** `runShoppingDateChecks()` (recurring-list roll-forward + the
 *     `resetReviewVisible` detection) used to live entirely inside the `useFocusEffect` below,
 *     which fires only on a NAVIGATION event. This screen stays mounted at all times (the tab
 *     pager is `lazy: false`), so a session parked on Shopping across a payday boundary — or
 *     backgrounded and reopened on Shopping without switching tabs — never re-ran the check;
 *     only an unrelated tab-away-and-back did. Measured on the web preview: onboard just before
 *     a period boundary, cross it while parked on this tab, simulate a background→foreground
 *     cycle with no tab switch — the review sheet stayed hidden until fixed. Same class of bug
 *     as the Habits tab's stale `today` (lib/useNowMinutes.ts, lib/__tests__/todayFreshness),
 *     except the stale part here is WHEN the check runs rather than a captured value, so the
 *     fix is a second trigger (`AppState` 'active') rather than a live tick — this only needs
 *     to catch up once per app-open, not stay reactive to the minute.
 *   - **MD3-flavoured declutter pass (2026-08-13, from an outside review).** Four asks, and
 *     what each became. (1) **The ⓘ body is a bottom sheet now** — components/HintSheet.tsx,
 *     mounted with the other overlays instead of at the top of `shoppingIntro`, where opening
 *     it shoved every list down the screen. The ⓘ was already its only trigger; only the
 *     landing place changed. Its reset-cadence controls came along unchanged and its
 *     `useKeyboardLift` did NOT (a Modal is outside the ScrollView that hook scrolls — the
 *     sheet's own KeyboardAvoidingView replaces it). (2) **The empty-list line lost its fill
 *     and border** (`sectionEmpty`) — it was the app's real-Input look, so an empty list read
 *     as a text field; same complaint the locked+empty variant was restyled for two days
 *     earlier, and the same quiet centred line Habits and Health already draw. (3)
 *     **"Manage inventory" and "Reset all monthly lists now" moved into each monthly card's
 *     ⋮** (`openMonthlyListOptions`) — an archive-box glyph that never said "inventory", and
 *     a muted caption-shaped row under the last card that was the furthest-reaching action on
 *     the tab. (4) **The seeded monthly list is localized at render time** —
 *     `monthlyListLabel()` (store/useMonthlyListStore.ts), because lib/db.ts's seed migration
 *     wrote the English literal "Monthly" and a migration can't know the language.
 *     **Two asks were deliberately NOT done**, on the maintainer's call: detaching the header
 *     from the sticky tab bar and restyling the tabs as an MD3 underline (that seam is
 *     transparent — the 2026-08-10 chrome pass attached them precisely because scrolled
 *     content flickered through it, and components/TabSlider.tsx's accent-filled pill IS the
 *     screen-tier shape for a pick-one question), and reshaping the bottom nav's active pill
 *     (measured on the web preview: it is centred on its tab to within 0.9px — see
 *     components/BottomNav.tsx's `gap` note for the one real defect that turned up).
 *   - **Food/Catalogue link icons upgraded to CardAccentBadge (2026-07-26, user feedback: the
 *     two buttons read as too plain/undefined)**: `foodCatalogueLinks`'s bare `Ionicons` glyphs
 *     (just accent-colored, on the Surface's neutral fill) swapped for `CardAccentBadge` at a
 *     small size=24 — gives each button a filled, colored circle instead of a thin outline icon
 *     so "Mat"/"Katalog" catch the eye without reintroducing the 2026-07-14 "muddy whole-card
 *     tint" the Surface `borderColor`-only convention was chosen to avoid (see Surface.tsx).
 *     **Badge colour switched from the domain palette to this screen's own hue (2026-08-06,
 *     `accentOverride`)** — both cards' edges were already the ambient shopping green (neither
 *     sets its own `borderColor`), so a gold/amber badge on top read as a mismatched icon.
 *   - **One primary, everything else secondary (2026-08-09)**: this screen had FOUR
 *     equally-weighted outlined controls — "Add new item", "Add dish", both "New list"
 *     triggers — and no dominant action at all, which is `DESIGN_RULES.md` rule 6 ("exactly
 *     one primary action per screen, visually dominant"). Adding an item is what the screen
 *     is for, so `components/InlineAddItem.tsx`'s collapsed bar took the solid accent fill
 *     and is now the ONE primary here; `addTrigger` ("Add dish") was already the right
 *     weight and is unchanged; both "New list" triggers moved off neutral white onto the
 *     same accent tint, since being the only white control read as a difference in KIND
 *     when it is only a difference in what gets created. **Borders were not removed from
 *     anything** — the 2026-08-05 card reset makes them the grouping signal, so the fix
 *     here is weight, not edges. The Food/Catalogue links are navigation, not actions, and
 *     stay out of this hierarchy. They were an inline two-tile row of this screen's own
 *     making until 2026-08-10, when they became components/CollapsedSection.tsx drawers like
 *     every other sub-screen link in the app — and, later the same day, drawers whose body is
 *     the destination component itself rather than a preview of it (see `foodCatalogueLinks`).
 *   - **Card-header declutter pass (2026-07-23)**: several small UI cleanups across both
 *     tabs' list cards. (1) Monthly's "Add dish" trigger (`addTrigger`) now matches the
 *     "Add new item" bar (`InlineAddItem`)'s shape/background/text style — they used to
 *     look like two different affordances. (2) `NewMonthlyListRow`'s collapsed trigger and
 *     this file's own Weekly "+ New list" trigger (`newListTrigger`) are both now a
 *     big-ish plain white/surface button with just a "+" glyph (icon-only,
 *     accessibilityLabel carries the name) instead of a smaller accent-tinted labeled
 *     pill. **Both halves of (2) have since been reversed**: the labels came back (a bare
 *     glyph is worst on the empty tab, where the trigger matters most) and the white/surface
 *     fill went back to accent-tinted on 2026-08-09 — see the CTA-weight note below. (3) The lock icon on both WeekListCard and each Monthly list card moved out of
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
 *     preview card showed one AGGREGATE figure instead (summed
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
 *     segments, replacing the old per-tab `TabBoxHighlight` boxes. Same shared component as
 *     app/plans.tsx and app/settings.tsx's tab bars. Every tab's `accent` in
 *     `TAB_META` is the neutral brand
 *     `theme.accent` (blue), so the pill's hue matches Plans and the
 *     bottom nav — one consistent "selected" colour app-wide (visual-audit 2026-07-20: Weekly's
 *     old green `theme.good` + Food's meal-domain accent read as a competing selection colour
 *     against the blue nav on the same screen).
 *     **That sliding pill is this screen's ONE solid accent fill (2026-08-01, addendum B.1)**
 *     and it should stay that way. In the same pass the active tab's count badge was inverted
 *     (`contrastOn(accent)` fill, accent number) so it stops being a second accent fill inside
 *     the first — it was previously accent-on-accent and had no visible edge at all — and the
 *     accent "+" was taken off the Monthly rows' inline stepper (components/MonthlyTableRow.tsx)
 *     and the add panel's quantity stepper (components/InlineAddItem.tsx). What is deliberately
 *     still accent-filled here: the catalog row's checked/restock mark (the app-wide done
 *     state), the "In cart" section rule (a 2px 40%-opacity ruled line paired with its own
 *     label, whose sibling "To buy" section uses `theme.good` the same way — demoting one half
 *     breaks the pair), the weekday chip inside the ⓘ hint (only on screen while the hint is
 *     open, and it matches the identical control in Settings → Personal), and NewSinceGlow's
 *     edge (a transient marker shown only right after a layout switch).
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
 *     session). Surface `surfaceContext="overlay"`, which named "sticky headers... nav bar" as
 *     its use case. **That prop has been a no-op since the 2026-08-05 card reset** (corrected
 *     2026-08-08): every context renders the same flat opaque fill, so it documents intent
 *     rather than selecting a finish. See Surface.tsx's own note on it.
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
 *     docs/archive/SCREEN_FUNCTIONS_AUDIT.md finding C1. Plans got the same `onSharePress` wiring
 *     (`kind=t`) on 2026-07-28 once share-modal grew a "Send as text" export
 *     (`lib/shareText.ts`) alongside its QR code; Plans' per-task "Shared out" switch
 *     (`components/TaskCard.tsx`) is unrelated — that still writes directly to
 *     `useSharedStore` without going through share-modal at all.
 *   - **Scan header button (2026-07-23, audit findings E2/F1)**: `onScanPress` (same
 *     pattern as `onSharePress` above) pushes `/scan` — Scan's own idle screen still offers
 *     both receipt OCR and QR import, so this one button is the sole replacement for the
 *     bottom-nav tab Scan used to occupy. The existing "Shopping done!" Scan/Upload choices
 *     (line ~245) already pushed `/scan` directly and are unaffected by this move.
 *   - **Still dropped**: SiteSwipeView's swipe-between-screens wrapper (Phase 3e, not
 *     ported, not required by A2-1/A2-4).
 *   - `ConfirmationBanner` renders as a sibling of ScreenScaffold, not inside its
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
 *     a single `<FlightOverlay>` mounted as a sibling of ScreenScaffold (NOT inside
 *     it — ScreenScaffold's children scroll inside its internal ScrollView, same reasoning
 *     as `ConfirmationBanner`'s placement below). `handleScreenScroll` clears in-flight
 *     flights on scroll since window-space coords go stale. See
 *     ANIMATION_GUIDELINES.md's "Flight / Cross-Section Travel Animations" section.
 *   - **Keyboard-avoidance (2026-07-31)**: the Monthly list rename field gets its own
 *     `lib/useKeyboardLift` — see that hook's doc / components/AddRow.tsx for the underlying
 *     Android `windowSoftInputMode=resize` fix. The monthly-reset-date field was the other
 *     consumer until 2026-08-20; it lives in Settings → Personal now.
 *   - **⚠️ There is no ⓘ hint on this screen (2026-08-20).** It had been four shapes in a
 *     month — auto-opening first-visit card, collapsed-until-tapped card, bottom sheet, and
 *     closable inline card — and the maintainer ended the series rather than picking a fifth:
 *     *"The top text box can be removed"*, with tips belonging to a card's empty state. Its
 *     sentence is on the StarterCard that renders while both list groups are empty. The two
 *     reset-cadence pickers it used to carry had already gone to Settings → Personal on
 *     2026-08-13; the LINK to them went with the banner, since Settings is one tap away on this
 *     screen's own header gear and a card whose whole body is a door elsewhere is what the
 *     original ⓘ complaint was about.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, LayoutAnimation, Modal, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShoppingStore, ShoppingItem, MonthlyResetSummary, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { useShoppingListStore, ShoppingList } from '@/store/useShoppingListStore';
import { useMealStore } from '@/store/useMealStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useMonthlyListStore, MonthlyList, monthlyListLabel } from '@/store/useMonthlyListStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useAutomationStore } from '@/store/useAutomationStore';
import ShoppingRow from '@/components/ShoppingRow';
import LayoutPickerSheet from '@/components/LayoutPickerSheet';
import { useSurfaceLayout } from '@/lib/useSurfaceLayout';
import { usePrefill } from '@/lib/prefill';
import { useNewSinceSeen } from '@/lib/useNewSinceSeen';
import MonthlyTableRow from '@/components/MonthlyTableRow';
import InlineAddItem from '@/components/InlineAddItem';
import AddDishSheet, { AddDishTarget } from '@/components/AddDishSheet';
import UpdateSheet from '@/components/UpdateSheet';
import MonthlyResetSummaryModal from '@/components/MonthlyResetSummaryModal';
import MonthlyResetReviewSheet from '@/components/MonthlyResetReviewSheet';
import SharedRequestsSection from '@/components/SharedRequestsSection';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import { confirmDestructive, showAppModal } from '@/components/AppModal';
import Surface from '@/components/Surface';
import ScreenScaffold from '@/components/ScreenScaffold';
import ExpandableCard from '@/components/ExpandableCard';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import PressableScale from '@/components/PressableScale';
import Button from '@/components/Button';
import WeekListCard from '@/components/WeekListCard';
import ShoppingFilterBar from '@/components/ShoppingFilterBar';
import FlightOverlay, { FlightRow, Flight, FlightRect } from '@/components/FlightOverlay';
import SavedListsModal from '@/components/SavedListsModal';
import SavedListsSection from '@/components/SavedListsSection';
import ListSettingsSheet from '@/components/ListSettingsSheet';
import ShoppingItemSheet from '@/components/ShoppingItemSheet';
import KeepAwakeInStore from '@/components/KeepAwakeInStore';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import IconButton from '@/components/IconButton';
import NarratorQuote from '@/components/NarratorQuote';
import StarterCard from '@/components/StarterCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';
import Card from '@/components/Card';
import SectionRail from '@/components/SectionRail';
import FoodTab from '@/components/FoodTab';
import CatalogueTab, { CatalogueHeaderControls } from '@/components/CatalogueTab';
import NewMonthlyListRow from '@/components/NewMonthlyListRow';
import { success, heavy, warning } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr, dateStr, getWeekRangeContaining, weekOfMonthlyCycle, dateRangeForCycleWeek, formatDateRange } from '@/lib/date';
import { useAppTheme, useAccessibility } from '@/lib/useAppTheme';
import { useKeyboardLift } from '@/lib/useKeyboardLift';
import { Fonts, FontSize, HitSlop, MIN_TAP_TARGET, OpticalCenter, Radius, SCREEN_GAP, Spacing, TITLE_FIELD, Type } from '@/constants/theme';
import { groupByDish, groupByCategory, computeListGroups, listProgress, catalogItemsForList } from '@/lib/shoppingGroups';
import { categoryPresets, categoryLabel } from '@/lib/shoppingCategories';
import { reorderByDrag } from '@/lib/reorder';
import { formatKr } from '@/lib/money';
import { computeSpendPace } from '@/lib/budget';
import { getDomainColor } from '@/lib/domainColor';
import { getScreenColor } from '@/lib/screenColor';

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
  // Kept for the Unallocated section's meal-origin accent bar (Decision 043) only — the Food/
  // Catalogue link badges below used to draw this too and read as gold/amber icons on the
  // screen's green cards (2026-08-06, user report: "upper left icons still wrong color");
  // those now take the screen's own hue instead (`accentOverride`).
  const mealDomainColor = getDomainColor(theme, 'meal');
  // `getScreenColor` (plain function), not `useScreenColor` (context hook) — this component
  // renders ScreenScaffold below, so it sits above that provider; see health.tsx's note.
  const screenHue = getScreenColor(theme, 'shopping').base;

  // Fire the 'shopping_opened' automation trigger once per screen visit (mount).
  // Rules are already loaded by app/_layout.tsx's startup bootstrap.
  useEffect(() => {
    useAutomationStore.getState().fireTrigger('shopping_opened');
  }, []);

  // Full-screen expansion (2026-08-20) — Dishes and Catalogue are peer cards now, not
  // CollapsedSection drawers; see the `foodCatalogueLinks` note below for the full shape.
  // (The monthly-reset DATE field that used to live here, with its own local draft buffer and
  // its own useKeyboardLift, is gone as of 2026-08-20 — it had already moved to Settings →
  // Personal on 2026-08-13, and the ⓘ banner that still drew it went with the banner pass,
  // leaving the state behind with nothing reading it. The Monthly list's RENAME field below is
  // a different control and still uses useKeyboardLift; that one is genuinely in the scroll
  // content.)
  // The Katalog card's lock (2026-08-20). Owned here rather than inside components/
  // CatalogueTab.tsx because the button that flips it is in that card's SectionCard header.
  // Local and NOT persisted: a per-visit safety catch on a one-tap delete, not a preference,
  // and it must never sync — a paired phone locking your catalogue is nonsense.
  const [catalogueLocked, setCatalogueLocked] = useState(true);
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
  // The row's detail sheet (components/ShoppingItemSheet.tsx). Holds the item itself rather
  // than an id so the sheet still has content to draw while it animates out; it re-reads the
  // live row from the store by id, so a stale object here can't be written back.
  const [detailItem, setDetailItem] = useState<ShoppingItem | null>(null);
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
  const monthlyNameLift = useKeyboardLift<TextInput>();

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
  const itemsLoaded = useShoppingStore((s) => s.loaded);

  // Card layout (2026-07-27). `layoutSpec` decides how rows are DRAWN; it is read-only here
  // and feeds nothing but rendering — no reminder, automation, or sync path consults it.
  const layoutSpec = useSurfaceLayout('shopping');
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  // Arrived from a note's ⋯ → Send it to… → Shopping list (2026-07-30). The text seeds the add
  // row of the list that covers today — `currentList` is the same helper Home's card uses to
  // pick its default target, so both entry points agree on which list "the shopping list" is.
  const prefill = usePrefill();
  const prefillListId = useShoppingListStore((s) => s.currentList(todayStr()))?.id;
  // Sizes for the Food/Catalogue drawer rails. A library's size is a size, not a score, so
  // unlike Goals and Earlier days these two do carry a count. (Until 2026-08-10 these were
  // `dishNames`/`catalogNames` arrays feeding a names-only preview; the drawers mount the real
  // FoodTab/CatalogueTab now, and each reads its own store.)
  const dishCount = useMealStore((s) => s.dishes).length;
  // `catalogCount` went with the Catalogue card's `count` prop (2026-08-21) — see the note at
  // that card. Nothing else on this screen showed it.
  // "Arrived while you were away" glow. Computed once per visit against the surface's seen
  // watermark, so switching layout keeps the same rows marked and the user can find them
  // again in the new arrangement. `itemsLoaded` (not `items.length`) is the readiness gate —
  // see the store field's comment for why that distinction matters.
  // Shopping's layouts don't collapse rows — every item is drawn in all four — so the row
  // diff is normally empty and the FIELD diff is what does the work here: switching from
  // "Just the basics" to "Normal"/"Show everything" reveals quantities, steppers and prices
  // on rows that were already on screen, and those values glow. Rows still participate so
  // that a list which genuinely changed shape between visits is covered too.
  // Fixed key, not `shopping:${tab}` (2026-08-20, tabs-to-cards pass) — Weekly no longer has
  // an OTHER tab to be hidden behind, so there's only one surface identity for this glow to
  // track now.
  const visibleItemIds = useMemo(
    () => items.filter((i) => i.status === 'inWeeklyList').map((i) => i.id),
    [items]
  );
  const { ids: newSinceIds, fields: newFields } = useNewSinceSeen(
    'shopping:weekly',
    visibleItemIds,
    useMemo(
      () => ({ meta: layoutSpec.showMeta, price: layoutSpec.showPrice, extras: layoutSpec.showExtras }),
      [layoutSpec]
    ),
    layoutSpec.id,
    itemsLoaded
  );
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
  // Sharing is the one opt-in left on this screen (Settings → Advanced → Features),
  // off on a fresh install. Scan & receipts and Food & recipes used to be opt-in too
  // (2026-07-25) but are now always on — see store/useSettingsStore.ts's "Inert
  // columns" note — so their call sites below no longer read a flag at all.
  // Sharing is hidden wholesale while the single-user basics are reworked (2026-08-05) —
  // see lib/sharingVisibility.ts. The setting is still read so nothing else changes shape.
  const featureSharing = useSettingsStore((s) => s.featureSharing) && SHARING_VISIBLE;

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

  /**
   * Roll any overdue recurring list forward to the period containing today, and open the
   * payday-boundary review sheet once per period, when today's day-of-month has reached
   * monthlyResetDate and we haven't already reset for this period.
   *
   * Extracted (2026-08-13) so it can run from BOTH `useFocusEffect` below (a navigation event)
   * AND an `AppState` 'active' listener — see that effect for why. `advanceRecurringLists()` is
   * a no-op once every recurring list is already current, so it's safe to call from either
   * trigger; the shopping reload only fires when it actually created a list, since a full
   * table reload + a visible reflow is real cost paid on every no-op call otherwise.
   *
   * Reads settings via `getState()` (not a render-time selector) so it sees the latest
   * persisted values, and doesn't guard on `resetReviewVisible` — `setResetReviewVisible(true)`
   * when it's already true is a same-value setState, which React no-ops, so there is nothing to
   * gain from a stale-closure-prone check here. Opens the interactive review sheet rather than
   * resetting immediately — lastMonthlyReset is only stamped once the user actually dismisses
   * it (finalizeMonthlyReset), so a backgrounded/killed app with the sheet still open just
   * re-opens it next time instead of silently skipping the period.
   */
  const runShoppingDateChecks = useCallback(() => {
    const today = todayStr();
    if (advanceRecurringLists(today)) loadShopping();

    const periodKey = today.slice(0, 7); // YYYY-MM
    const settings = useSettingsStore.getState();
    const alreadyResetThisPeriod = settings.lastMonthlyReset.slice(0, 7) === periodKey;
    if (!alreadyResetThisPeriod && new Date().getDate() >= settings.monthlyResetDate) {
      setResetReviewVisible(true);
    }
  }, [loadShopping, advanceRecurringLists]);

  // Runs the checks above on every focus; also closes both add sheets on blur (mirrors the old
  // app: the receipt pop-up's Scan/Upload choices would otherwise leave a sheet open behind
  // whatever screen it pushed to).
  useFocusEffect(
    useCallback(() => {
      runShoppingDateChecks();
    }, [runShoppingDateChecks])
  );

  /**
   * Also run the same checks on app foreground, independent of navigation (2026-08-13).
   *
   * `useFocusEffect` only fires on a navigation event — this screen stays mounted at all
   * times (the tab pager is `lazy: false`), so backgrounding the app on the Shopping tab and
   * reopening it WITHOUT switching tabs never re-triggers the focus effect, and the boundary
   * check silently sits on whatever it last saw. Measured on the web preview: onboard just
   * before a period boundary, cross it while parked on this tab, then simulate a
   * background→foreground cycle with no tab switch — the review sheet stayed hidden; only an
   * unrelated tab-away-and-back made it appear. That's the same class of bug the Habits tab
   * had (a clock-dependent outcome that only re-evaluates on a discrete event, not on time
   * actually passing) — see lib/useNowMinutes.ts and lib/__tests__/todayFreshness.test.ts —
   * except here the stale part is WHEN the check runs, not a captured value going stale, so
   * the fix is a second trigger rather than a live tick: this only needs to catch up once per
   * app-open, not stay reactive to the minute the way a mounted screen's date does.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runShoppingDateChecks();
    });
    return () => sub?.remove();
  }, [runShoppingDateChecks]);

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

  /**
   * Nothing on the Weekly tab at all — no real lists, no saved templates, nothing loose in the
   * Unallocated bucket. Named because it now drives TWO things that must agree: whether the
   * empty card renders, and whether the "Create a new list" trigger renders instead of it
   * (2026-08-13 — the two used to stack, see the call site). Inlining the condition twice is
   * how they would drift into both showing or neither.
   */
  const isWeeklyEmpty =
    nonTemplateLists.length === 0 && unallocatedItems.length === 0 && templateLists.length === 0;

  // The list's purchased rows come from computeListGroups()'s own `purchased` bucket now
  // (2026-08-11) — this screen used to build a separate listId→purchased map here, which was
  // a SECOND definition of a section computeListGroups already had every input for. One
  // definition, so the week card and store mode can't disagree about what "Kjøpt" contains.

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
    // commits the trip and confirms in place. Scan & receipts is always on (2026-07-25
    // defaults revision), so this modal always offers all three choices.
    showAppModal(t.doneShoppingReceiptTitle, t.doneShoppingReceiptBody, [
      { text: t.scanReceiptBtn, onPress: () => { doneShopping(list.id, label, monthlyResetDate); router.push({ pathname: '/scan', params: { autoCapture: 'camera' } }); } },
      { text: t.uploadPhotoBtn, onPress: () => { doneShopping(list.id, label, monthlyResetDate); router.push({ pathname: '/scan', params: { autoCapture: 'library' } }); } },
      { text: t.skipBtn, style: 'cancel', onPress: () => { doneShopping(list.id, label, monthlyResetDate); heavy(); setConfirm(t.doneShoppingSuccessText); } },
    ]);
  }

  /**
   * Quick-add tray (2026-08-20) — append one bundle from lib/shoppingStarters.ts to `listId`.
   *
   * Three things it leans on rather than reimplementing:
   *   - **`add()` dedups.** Same status + listId + name bumps the existing row's amount rather
   *     than inserting a second one (Decision 021), so tapping "Basisvarer" twice gives you
   *     ×2 milk, not two milk rows — which is also why the tray needs no "already added"
   *     state of its own.
   *   - **The catalogue owns the price.** The bundle carries names and categories only; the
   *     price is looked up from `store_items` by exact name, which is why
   *     lib/__tests__/shoppingStarters.test.ts asserts every bundle name exists in the seed.
   *     An unknown name is not an error — it lands at 0, exactly like a hand-typed item the
   *     catalogue has never seen.
   *   - **One user action, one confirmation.** The per-item `onAddInlineItem` path fires a
   *     toast and a `success()` each time; a bundle fires one of each, with a count.
   */
  function handleAddStarterBundle(listId: string, starterItems: readonly { name: string; category: string }[]) {
    const catalog = useCatalogStore.getState().items;
    for (const starter of starterItems) {
      const known = catalog.find((c) => c.name === starter.name);
      add({
        name: starter.name,
        amount: '1',
        unit: '',
        listType: 'weekly',
        store: '',
        price: known?.price ?? 0,
        inventoryQty: 0,
        isTemporary: false,
        targetQuantity: 1,
        status: 'inWeeklyList',
        listId,
        category: starter.category,
      });
    }
    success();
    setConfirm(t.shoppingStarters.added(starterItems.length));
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
    confirmDestructive({
      title: t.deleteListConfirmTitle,
      message: t.deleteListConfirmBody,
      confirmLabel: t.deleteList,
      onConfirm: () => removeList(listId),
    });
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
    confirmDestructive({
      title: t.deleteListConfirmTitle,
      message: t.deleteListConfirmBody,
      confirmLabel: t.deleteList,
      onConfirm: () => removeMonthlyList(listId),
    });
  }

  /** Kebab menu (2026-07-23 declutter pass) — Reset and Delete moved off the header's
   *  action row (which also carries the Budget pill + Manage inventory icon) into one
   *  overflow entry point, same "tuck rare actions behind ⋮" convention WeekListCard's
   *  openListOptions already uses. */
  /**
   * The monthly card's ⋮ menu. Grew from two entries to four on 2026-08-13, in the same
   * declutter spirit as the 2026-07-23 pass that created it: the header row carried a
   * `file-tray-full-outline` IconButton for "Manage inventory" whose glyph reads as an
   * archive box and says nothing about inventory, and the Monthly tab ended with a small
   * muted "Reset all monthly lists now" line floating under the last card, looking like a
   * caption rather than a control. Both are secondary or destructive; both live here now.
   *
   * "Reset all lists" is the odd one out and is worded to say so — it is the one entry in a
   * per-list menu that does NOT act on this list alone. It is placed after this list's own
   * reset so the narrower action is read first, and it keeps its own confirm dialog
   * (`resetAllConfirmVisible`), which names the scope again before anything happens.
   */
  function openMonthlyListOptions(list: MonthlyList) {
    showAppModal(monthlyListLabel(list, t.defaultMonthlyListName), undefined, [
      { text: t.scanReceiptForListAction, onPress: () => router.push({ pathname: '/scan', params: { target: 'monthly', listId: list.id } }) },
      { text: t.manageInventoryAction, onPress: () => router.push({ pathname: '/inventory-edit', params: { listId: list.id } }) },
      { text: t.resetMonthlyListAction, onPress: () => { warning(); setResetListConfirmId(list.id); } },
      { text: t.resetAllMonthlyListsAction, onPress: handleManualMonthlyReset },
      ...(!list.locked ? [{ text: t.deleteMonthlyListAction, style: 'destructive' as const, onPress: () => handleDeleteMonthlyList(list.id) }] : []),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  function startMonthlyListNameEdit(list: MonthlyList) {
    // Seeds the field with what the user SEES, not the stored literal — otherwise renaming
    // the seeded list starts you editing the English "Monthly" you were never shown.
    setMonthlyListNameInput(monthlyListLabel(list, t.defaultMonthlyListName));
    setEditingMonthlyListId(list.id);
  }

  function commitMonthlyListRename(list: MonthlyList) {
    const trimmed = monthlyListNameInput.trim();
    // Compared against the DISPLAYED name as well as the stored one: on the seeded list those
    // differ, so opening the field and closing it again without typing would otherwise write
    // the localized default in as a real name — a rename the user never made.
    const unchanged = trimmed === list.name || trimmed === monthlyListLabel(list, t.defaultMonthlyListName);
    if (trimmed && !unchanged) renameMonthlyList(list.id, trimmed);
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

  // Screen intro chrome (first-run explainer + incoming shared requests), shown once above
  // both list groups now (2026-08-20, tabs-to-cards pass — see the header note at the top of
  // this file). This used to be shared by two hidden-behind-a-tab sections; now it's just the
  // top of a scrollable stack, same as any other screen's intro.
  //
  // **The tour target moved here from the old sticky tab row.** Its Shopping step is about the
  // weekly and monthly lists — "a weekly list for groceries and a monthly one for what the
  // house needs; the weekly list starts fresh on the day you choose" — and the starter card
  // below says the same thing. The old anchor (the TabSlider that switched between them) is
  // gone along with the tab switch itself.
  // ⚠️ **The target is CONDITIONAL, and it always was — only the condition changed
  // (2026-08-20).** It used to hang off a dismissible intro banner that returned null once
  // closed; that banner is deleted app-wide, and what is here now is the starter card, which
  // renders only while the lists are empty. Either way the guided tour runs once, immediately
  // after onboarding on a fresh install, when the lists ARE empty — so it is a reliable target
  // for the one visit that matters. Don't reuse this target id assuming it's always present
  // later in the tree; for a returning user with a full list there is nothing here to ring.
  const shoppingIntro = (
    <TourTarget id="tour.shopping.list">
    <>
      {/* First-run explainer (2026-07-26, example rows dropped 2026-07-28): when to add
          something, and what the two reset cadences actually mean — the weekly/monthly
          distinction is exactly what's opaque before you have one of each. No suggested-add
          example rows here any more (user report: Shopping doesn't need one, just a short
          explanation) — text-only. This screen KEEPS the two-line weekly/monthly form while
          Home's card dropped to one short line (2026-07-30, `t.starters.shopping.text`): this
          is where the two lists actually sit side by side, so the split is the point here and
          a detail there. Gated on no weekly lists
          AND no items anywhere, NOT on monthlyLists: lib/db.ts seeds one empty monthly list on
          install (the `INSERT … WHERE NOT EXISTS` migration), so that count is never 0 and
          would suppress this for every new user. Items covers the seeded list having been
          filled in. */}
      {/* ⚠️ **No ⓘ banner since 2026-08-20.** It had been four shapes in a month — an
          auto-opening first-visit card, a collapsed-until-you-tap-ⓘ card, a bottom sheet, and a
          closable inline card — and the maintainer ended the series rather than picking a fifth:
          *"The top text box can be removed"*, with tips belonging to a card's empty state. Its
          sentence is on the StarterCard directly below, which is what this screen says while it
          has nothing on it. The cadence LINK went too, not just the pickers: Settings is one tap
          away on this screen's own header gear, and a card whose whole body is a door to another
          screen is the thing the original ⓘ complaint was about. */}
      {lists.length === 0 && items.length === 0 && (
        <StarterCard
          text={`${t.hints.shopping.text}\n• ${t.starters.shopping.textWeekly}\n• ${t.starters.shopping.textMonthly}`}
        />
      )}
      {/* Incoming shared shopping requests — opt-in via settings.featureSharing
          (off for fresh installs). Anything already received stays in the store and
          reappears untouched if sharing is turned back on. */}
      {featureSharing && <SharedRequestsSection kind="shopping" />}
    </>
    </TourTarget>
  );

  // Food and Catalogue moved off the sticky tab row to button-launched sub-screens
  // (UX audit F1, 2026-07-23) — Weekly/Monthly are the two things a user opens
  // constantly; Food (dish library) and Catalogue (master item list) are visited far
  // less often and didn't need to be permanent peers of the two shopping lists.
  // Always on (2026-07-25 defaults revision) — Food & recipes used to be opt-in via
  // settings.featureFood, but that's now permanently true (see store/useSettingsStore.ts's
  // "Inert columns" note), so this row is unconditional like Weekly/Monthly above it.
  // **Peer cards, not drawers (2026-08-20, "full-screen card expansion")** — this used to be
  // two components/CollapsedSection.tsx drawers (2026-08-10 → 2026-08-20); the fold chevron is
  // gone, so both are always-open `SectionCard`s at the standard header shape (badge · title ·
  // count · expand). The body IS the destination, mounted (unchanged since 2026-08-10): Food
  // shows the real `FoodTab` and Catalogue the real `CatalogueTab`, each `embedded` (presentation
  // only — it unwraps the `Surface`s that assume a screen backdrop, so the card isn't wrapping
  // a second card). `embedded` mode's own "capped run" IS the collapsed preview now — no
  // separate preview logic needed.
  //   **The push became an expand.** Both title presses and CatalogueTab's own `onOpenFull`
  // used to push /food / /catalogue; both now call `expandCard()` instead — see
  // components/CardExpandHost.tsx's `shopDishes`/`shopCatalogue` registry entries, which mount
  // the FULL (non-embedded) FoodTab/CatalogueTab, the same components app/food.tsx and
  // app/catalogue.tsx (still valid back-compat routes) render — Catalogue's registry entry
  // passes `scrollable: false` since CatalogueTab's non-embedded body is its own virtualising
  // FlatList, which must not be nested inside a second ScrollView.
  //   `fast-food`, not `restaurant`: the crossed fork+knife read as a ✕ / cancel glyph at badge
  // size, and next to the word "Food" it looked like a close button (2026-07-28 design review).
  // The three groups this screen stacks, as consts rather than inline JSX, so the ORDER is one
  // readable line in the return instead of ~700 lines of drag/merge/flight-animation JSX that
  // has to be physically relocated to change it. `foodCatalogueLinks` below was already written
  // this way; these two follow it.
  //
  // **No outer card wraps a group.** Each already renders its own per-list Surface cards
  // (WeekListCard, the Monthly `catalogCard`s), and a card around a stack of cards reads as the
  // nested panel the 2026-08-18 blueprint pass banned. `components/SectionRail.tsx` alone gives
  // each group the same header language as the rest of the app without adding that box.
  const weeklyGroup = (
    // ⚠️ **A `Card`, not a bare rail over loose cards (2026-08-21).** Shop drew ~12 top-level
    // `Surface`s: two group headers sitting on the backdrop with a stack of per-list cards under
    // each, plus the two library cards. The registry's boundary settles it — a CARD is a thing
    // the registry names, a SECTION is drawn one-per-row-of-user-data — so the group is the
    // card and each list inside it is a section. That is also how "every card has a ⤢" is
    // reached here: mostly by shrinking the set of cards, not by adding buttons.
    //
    // The GROUP folds, not the lists inside it: a list's card is drawn one per row of data, so
    // an id built from its list id would accumulate entries for lists that no longer exist —
    // lib/collapsedCards.ts's singleton rule.
    //
    // This is the one Shop card that RESTS OPEN: the "Shopping" in the maintainer's *"All card
    // start in closed state, except 'Today' 'Notes' and 'Shopping'"*.
    <Card id="shopLists" count={nonTemplateLists.length || undefined}>
      {true && (
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
                    <PressableScale style={[styles.allocateBtn, { backgroundColor: theme.good }]} onPress={() => handleAllocate(groupItems)} hitSlop={HitSlop.snug} scaleTo={0.97}>
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
                        <PressableScale onPress={() => removeWithSource(item.id)} hitSlop={HitSlop.base} accessibilityLabel={t.removeItemLabel} scaleTo={0.93}>
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
                      <PressableScale style={[styles.allocateBtn, { backgroundColor: theme.good }]} onPress={() => handleAllocate([item])} hitSlop={HitSlop.snug} scaleTo={0.97}>
                        <Ionicons name="arrow-forward" size={14} color={theme.textInverse} />
                      </PressableScale>
                      <PressableScale onPress={() => removeWithSource(item.id)} hitSlop={HitSlop.base} accessibilityLabel={t.removeItemLabel} scaleTo={0.93}>
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
              empty card below covers that case instead of 4 redundant "no lists here"
              sections. */}
          {(nonTemplateLists.length > 0 || templateLists.length > 0) && [1, 2, 3, 4].map((week) => {
            const weekRange = dateRangeForCycleWeek(todayStr(), monthlyResetDate, week, weeklyResetDay);
            const weekLists = listsByWeek[week] ?? [];
            const isDropTarget =
              (weekDrag != null && weekDrag.targetWeek === week && weekDrag.startWeek !== week) ||
              (savedListDrag != null && savedListDrag.targetWeek === week);

            return (
              <React.Fragment key={week}>
                <View
                  ref={(node) => handleRegisterWeekSectionNode(week, node)}
                  style={[
                    styles.weekSection,
                    isDropTarget && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                  ]}
                >
                {/* ⚠️ **The app's one section header, at its smaller tier (2026-08-21).** This
                    was a hand-rolled `<Text>` pair — the THIRD header idiom on a screen that has
                    two `SectionRail` groups above it, which is what `CONSISTENCY_AUDIT.md` §13
                    measured against *"Use of sub-headers to show user what is what"*. Its SIZE
                    was never the problem (a heading inside a group should be smaller than the
                    group's); being hand-rolled was, because nothing tied its anatomy to the
                    header one level up.
                      `divider={false}`: these four sections sit in their own bordered
                    `weekSection` box, so a hairline under the name would be a second line inside
                    one edge. The date range moves to the `right` slot, which is where a section
                    header's trailing value sits on every other rail in the app. */}
                <SectionRail
                  hue={screenHue}
                  tier="sub"
                  divider={false}
                  label={t.weekNumberChip(week)}
                  right={
                    <Text style={[styles.weekSectionRange, { color: theme.textMuted }]}>
                      {formatDateRange(weekRange.startDate, weekRange.endDate, t.monthsShort, language)}
                    </Text>
                  }
                />

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
                          purchased={groups.purchased}
                          onToggleLock={() => handleToggleLock(list)}
                          onRename={(name) => renameList(list.id, name)}
                          onOpenSavedLists={() => setSavedListsListId(list.id)}
                          onOpenListSettings={() => setListSettingsListId(list.id)}
                          onDelete={() => handleDeleteList(list.id)}
                          onSyncToTemplate={() => handleSyncListToTemplate(list)}
                          onSaveAsTemplate={() => handleSaveListAsTemplate(list)}
                          onToggleItem={(item) => toggle(item.id)}
                          onRemoveItem={handleRemoveWeeklyItem}
                          onOpenItem={setDetailItem}
                          onDecrementCartItem={handleDecrementCartItem}
                          // A note sent here (lib/prefill.ts) seeds THIS week's add row only
                          // — the list whose date range contains today — so a prefill can
                          // never land on a week the user isn't looking at.
                          addPrefill={list.id === prefillListId ? prefill : undefined}
                          onAddStarterBundle={(starterItems) => handleAddStarterBundle(list.id, starterItems)}
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
                          spec={layoutSpec}
                          newSinceIds={newSinceIds}
                          newFields={newFields}
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
                                onOpenDetail={() => setDetailItem(item)}
                                inStockLabel={t.inStockLabel}
                                locked={list.locked}
                                spec={layoutSpec}
                                isNewSince={newSinceIds.has(item.id)}
                                newFields={newFields}
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

          {/* Creating a new list has no single text field to fill (it's auto-named by
              date range, then offers a start-empty/from-saved choice), so it genuinely
              doesn't fit the AddRow / pad type-line shape the other tabs use — it's a
              "tap to open a chooser" trigger, and that difference is real rather than an
              inconsistency to iron out.
              What WAS an inconsistency: it carried no visible label. The 2026-08-03
              walkthrough hit this on an empty Shopping tab — a big empty box and an
              unexplained "+" — and it was the only primary add in the app that didn't say
              what it does. The label is back (same change, same reasoning, as the Monthly
              tab's NewMonthlyListRow twin: a bare glyph declutters a busy row, but this
              trigger's hardest moment is an empty tab where there is nothing to declutter
              and everything to explain).

              **The empty state and the trigger are ONE card now (2026-08-13.)** Maintainer:
              "Merge the 'No lists this week yet' and the 'Make New list' when it's empty so
              that creating the first just looks like editing the default card that is there
              when there are No lists. When there are lists, we can use the make New list
              button." They used to stack — an `EmptyState` card saying "Make a new list
              below to get started", then the thing it pointed at — so an empty tab spent
              two cards saying one thing, and the card was inert while the real affordance
              was somewhere else.
              Empty: one card whose body IS the two choices, so the first list is made by
              filling in the card already on screen. Not empty: the trigger alone, exactly
              as before.
              The chooser modal is skipped on the empty path deliberately — with only two
              options and a whole card to hold them, putting them behind a dialog is one tap
              and one context switch for nothing. It stays on the not-empty path, where the
              trigger is a single row with no room to spell them out. */}
          {isWeeklyEmpty ? (
            // Neutral edge (theme.border) instead of the default screen-hue edge, so this
            // reads as a quiet "nothing here yet", not a coded surface (2026-07-20 unify
            // placeholder cards).
            <Surface style={styles.weekEmptyCard}>
              <Text style={[styles.weekEmptyTitle, { color: theme.text }]}>{t.weekEmptyTitle}</Text>
              <Text style={[styles.weekEmptyBody, { color: theme.textMuted }]}>{t.weekEmptyBody}</Text>
              <PressableScale
                style={[styles.newListTrigger, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                onPress={handleCreateNewWeeklyList}
                accessibilityRole="button"
                accessibilityLabel={t.startEmptyList}
                scaleTo={0.97}
              >
                <Ionicons name="add" size={22} color={theme.accent} />
                <Text style={[styles.newListTriggerLabel, { color: theme.accent }]}>
                  {t.startEmptyList}
                </Text>
              </PressableScale>
              <PressableScale
                style={styles.weekEmptySecondary}
                onPress={() => setSavedListsListId('__new__')}
                accessibilityRole="button"
                accessibilityLabel={t.savedListsTitle}
                scaleTo={0.97}
              >
                <Text style={[styles.weekEmptySecondaryLabel, { color: theme.accent }]}>
                  {t.savedListsTitle}
                </Text>
              </PressableScale>
            </Surface>
          ) : (
            <PressableScale
              // SECONDARY — accent-tinted, the same weight as "Add dish" and the Monthly
              // tab's NewMonthlyListRow twin (2026-08-09). See that file for the reasoning;
              // the two triggers are deliberately kept identical.
              style={[styles.newListTrigger, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
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
              <Ionicons name="add" size={22} color={theme.accent} />
              <Text style={[styles.newListTriggerLabel, { color: theme.accent }]}>
                {t.newWeeklyListTitle}
              </Text>
            </PressableScale>
          )}
        </>
      )}

    </Card>
  );

  const monthlyGroup = (
    <Card id="shopMonthly" count={monthlyLists.length || undefined}>

      {true && (
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
              <Text style={[styles.sectionEmpty, { color: theme.textMuted }]}>
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
                      {/* No `size` — the IconButton default (2026-08-21). Was `size={22}`;
                          see components/CatalogueTab.tsx's `CatalogueHeaderControls`. */}
                      <IconButton
                        icon={locked ? 'lock-closed' : 'lock-open-outline'}
                        label={locked ? t.unlockListButtonLabel : t.lockListButtonLabel}
                        onPress={() => toggleMonthlyListLocked(list.id)}
                        active={locked}
                      />
                      {editingMonthlyListId === list.id ? (
                        <TextInput
                          ref={monthlyNameLift.ref}
                          style={[styles.monthlyNameInput, { color: theme.text, borderColor: theme.border }]}
                          value={monthlyListNameInput}
                          onChangeText={setMonthlyListNameInput}
                          placeholder={t.newMonthlyListNamePlaceholder}
                          placeholderTextColor={theme.textMuted}
                          onSubmitEditing={() => commitMonthlyListRename(list)}
                          onFocus={monthlyNameLift.onFocus}
                          onBlur={() => { monthlyNameLift.onBlur(); commitMonthlyListRename(list); }}
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
                          <Text style={[styles.catalogHeaderTitle, { color: theme.text }]} numberOfLines={1}>{monthlyListLabel(list, t.defaultMonthlyListName)}</Text>
                        </PressableScale>
                      )}
                    </View>
                    <View style={styles.catalogHeaderActions}>
                      {/* Budget is always available (2026-07-25 defaults revision — Scan &
                          receipts is no longer an opt-in, so neither is the screen that reads
                          its spend figures). */}
                      {/* 2026-07-31 (A.5): was theme.featBudget (the retired amber "money"
                          screen hue) on the border, icon and label. This is the one LABELLED
                          call-to-action in a header row of otherwise unlabelled ancillary
                          IconButtons, so it takes `accent` rather than a neutral — a neutral
                          outline would sink the Budget entry point into the chrome beside it. */}
                      <PressableScale
                        style={[styles.budgetPill, { borderColor: theme.accent }]}
                        onPress={() => router.push({ pathname: '/budget', params: { listId: list.id } })}
                        accessibilityRole="button"
                        accessibilityLabel={t.budget.title}
                        hitSlop={HitSlop.snug}
                        scaleTo={0.97}
                      >
                        <Ionicons name="wallet-outline" size={14} color={theme.accent} />
                        <Text style={[styles.budgetPillText, { color: theme.accent }]}>{t.budget.title}</Text>
                      </PressableScale>
                      {/* "Manage inventory" moved into the ⋮ menu (2026-08-13) — see
                          openMonthlyListOptions. It was an archive-box glyph in a row that
                          also holds Budget and ⋮, and nothing about the glyph said
                          "inventory"; the menu says it in words. */}
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
                      {view.catalogItems.length === 0 && locked ? (
                        // Locked + empty is the one case InlineAddItem (below, gated on
                        // `!locked`) never renders — the real fix is unlocking, via the
                        // padlock icon up in the header, which carries no cue that it's the
                        // way out. Tapping this row unlocks directly instead (2026-08-11 fix
                        // — the Goals drawer had the same "empty line points at a control it
                        // doesn't render" bug at the time; see components/WeekListCard.tsx's
                        // matching note). Unlocking never confirms (unlike
                        // locking-while-dirty), so this can call the toggle straight.
                        // ⚠️ Restyled the same day: the first cut copied sectionEmpty's solid
                        // filled+bordered look, which is also this app's real-Input look —
                        // reads as a text field, and this is a button. Dashed + unfilled +
                        // the same lock-open-outline glyph the header's own unlock IconButton
                        // uses (line ~1746), so the row's icon matches the action it performs
                        // instead of borrowing the "+" ghost-add glyph for something that
                        // isn't an add. Maintainer: "buttons should look like buttons and
                        // text fields like text fields."
                        <PressableScale
                          onPress={() => toggleMonthlyListLocked(list.id)}
                          accessibilityRole="button"
                          accessibilityLabel={t.monthlyListEmptyLocked}
                          style={[styles.monthlyEmptyLocked, { borderColor: theme.border }]}
                        >
                          <Ionicons name="lock-open-outline" size={16} color={theme.accent} />
                          <Text style={[styles.monthlyEmptyLockedText, { color: theme.textMuted }]}>{t.monthlyListEmptyLocked}</Text>
                        </PressableScale>
                      ) : view.catalogItems.length === 0 ? (
                        // The narrator (2026-08-19), where "Ingenting her ennå — legg til
                        // din første faste vare." used to be. Unlocked-and-empty is the one
                        // branch here that IS just an empty list: `InlineAddItem` renders
                        // directly below it, so the way in is already on screen and the line
                        // above it never had to point at anything.
                        //
                        // ⚠️ Deliberately NOT applied to the two branches either side. The
                        // locked+empty one above is a BUTTON (tapping it unlocks — the
                        // 2026-08-11 fix), and a quote would take away the only way out of
                        // that state; the one below is a SEARCH that matched nothing, where
                        // the honest answer is that your filter is too narrow, not a joke.
                        <NarratorQuote category="shopping" />
                      ) : view.filteredCatalogItems.length === 0 ? (
                        <Text style={[styles.sectionEmpty, { color: theme.textMuted }]}>{t.monthlyPreviewEmpty}</Text>
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
                          {/* `Button variant="secondary"` since 2026-08-10 — the accentSoft
                              fill the 2026-08-09 pass deliberately left it at, now drawn by
                              the shared component instead of hand-rolled. Note this is a
                              RUNG ABOVE FoodTab's "Add dish", which is ghost: there it is
                              one of five repeated per-meal-section triggers, here it is the
                              screen's single secondary action under InlineAddItem's solid
                              primary. Same label, different weight, because weight is
                              relative to the screen it sits on. */}
                          <Button
                            label={t.addDishBtn}
                            icon="restaurant-outline"
                            variant="secondary"
                            onPress={() => setDishSheetTarget({ mode: 'monthly', listId: list.id })}
                            style={styles.addItemSpacing}
                          />
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
                              {/* One expand affordance, one reveal (2026-08-08). This header
                                  drew its own ▲/▼ as a bold text glyph and hard-swapped it,
                                  and popped the rows in with no transition — the only place
                                  in the app still doing either. `AnimatedChevron` rotates the
                                  shared Ionicon and `Collapsible` clip-reveals the body, the
                                  same pair every other expander here uses. */}
                              <PressableScale style={[styles.sectionHeaderRow, { backgroundColor: theme.surfaceMuted }]} onPress={() => setPurchasedExpanded(expanded ? null : trip.id)} scaleTo={0.97}>
                                <Text style={[styles.weekLabel, { color: theme.textMuted }]}>{trip.label}</Text>
                                <AnimatedChevron open={expanded} />
                              </PressableScale>
                              <Collapsible open={expanded}>
                                {/* Decision 043 rule 1: this already sits inside the list's own
                                    outer Surface (catalogCard) — plain View + theme.surface fill,
                                    matching every sibling rowsCard, instead of a second glass layer. */}
                                <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
                                  {tripItems.map((item, idx) => (
                                    <View key={item.id}>
                                      <ShoppingRow item={item} variant="purchased" onToggle={() => {}} onRemove={() => removeWithSource(item.id)} />
                                      {idx < tripItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                                    </View>
                                  ))}
                                </View>
                              </Collapsible>
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
          {/* "Reset all monthly lists now" moved into every card's ⋮ (2026-08-13) — see
              openMonthlyListOptions. It was a small muted icon+label row floating under the
              last card with no card of its own, which read as a caption on the tab rather
              than a control, while being the most far-reaching action on the screen. */}
        </>
      )}

    </Card>
  );

  const foodCatalogueLinks = (
    <>
      <View>
        {/* ⚠️ **Dishes wears the FOOD hue, not the screen's green (consistency audit,
            2026-08-21).** Maintainer: *"Dishes color coding is weak/pale"* and *"color coding
            must be based on visual navigation."* Both were true, and the cause was not the
            drawing — it was that Dishes had no colour of its own to draw. `domain="meal"`
            resolves through lib/domainColor.ts to `cardMeal`, which constants/colors.ts aliases
            onto `IDENTITY_HUES.shopping.hue` — the same emerald as `cardShop`, `cardBudget` and
            `cardScan` — so every card on this tab was one colour and the badge glyph was the
            only thing telling them apart.
              An orange for food already exists (`featMeal`, `#FF7A1A` dark / `#EA580C` light).
            Its own comment says food *"can't just take Shopping's green"*, and the justification
            for letting it — that Food has no card sharing a screen with Shopping — stopped being
            true on 2026-08-20, when Dishes and Catalogue became siblings on this scroll.
              `badgeHue` (new passthrough on SectionCard) is what makes the badge follow `hue`
            rather than the aliased domain colour. The CARD's edge is untouched and still the
            screen's — the 2026-08-05 reset owns that, and this is not reopening it. */}
        <Card id="shopDishes" count={dishCount}>
          <FoodTab embedded onNotify={setConfirm} />
        </Card>
      </View>
      <View>
        {/* ⚠️ **No `count` on THIS card, and it is the only content card without one
            (2026-08-21).** Its header is the most crowded in the app — badge, title, camera,
            lock, fold and ⤢ — because the 2026-08-20 pass put the camera and the lock *"in the
            top part"* and the 2026-08-21 pass gave every card a fold. Something had to yield,
            and a tally of how many items the catalogue holds is the one thing in that row that
            neither acts nor names: the list saying so is directly below it. Measured, not
            guessed — with the count, "Catalogue" truncated to "Catal…" at 430px.
              The count rule (AGENTS.md: *"a size yes, a score no"*) governs what a count may
            MEAN, not that every card owes one. */}
        <Card
          id="shopCatalogue"
          // The camera and the lock sit in the card's HEADER (2026-08-20, maintainer: *"the two
          // buttons for camera and lock should be in the top part instead"*) — they were inside
          // the list's own first box, which is deleted. `CardExpandButton` stays LAST, which is
          // the app-wide rule this pass settled: whatever a card's own controls are, ⤢ is the
          // right-most thing in the header.
          controls={<CatalogueHeaderControls locked={catalogueLocked} onToggleLock={() => setCatalogueLocked((v) => !v)} />}
        >
          <CatalogueTab embedded onNotify={setConfirm} locked={catalogueLocked} />
        </Card>
      </View>
    </>
  );

  return (
    <>
    <ScreenScaffold title={t.shoppingTitle} tier="site" screenKey="shopping" bottomNav={false} pagerFloatingNav ownBackground={false} onSharePress={featureSharing ? () => router.push('/share-modal?kind=s') : undefined} onLayoutPress={() => setLayoutPickerOpen(true)} onScroll={handleScreenScroll}>
      {/* Debug notes: one anchor for the whole list region. Don't also wrap the inner
          cards/rows — one DebugNoteAnchor per region (no nesting). */}
      <DebugNoteAnchor id="shopping.list" label="Shopping — List" style={styles.content}>
          {shoppingIntro}

          {/* ⚠️ **Order settled 2026-08-21 by the maintainer**, asked whether Dishes and
              Catalogue should sit under one "Inventory" header and whether Monthly should move
              above the lists it feeds: *"Shopping lists, food and Catalogue, Monthly."* So —
              the lists you open on a trip first, the two libraries next, and Monthly last.
              Two things that answer names by NOT doing them, so the gaps read as decisions:
              there is no "Inventory" grouping header (Dishes and Catalogue are each their own
              card, and a header over two cards would be a fourth header idiom on a screen that
              just got down to one), and Monthly is not presented as the basis the shopping list
              is built from — it is simply last. `CONSISTENCY_AUDIT.md` §13 has the question.
                This REPLACES the old source-order arrangement (Monthly, then Weekly, then the
              libraries), which the file's own comment admitted was *"leftover source order from
              when this was extracted, not a deliberate call"*. */}
          {weeklyGroup}

          {/* Doors out of this screen go at the FOOT of it (2026-08-10). They sat above the
              lists while they were a compact two-tile row; as full drawers that would put the
              two least-visited surfaces on the screen ahead of the thing you opened Shopping
              to do (DESIGN_RULES.md rule 7). Bottom-of-screen is also where To-do and Habits
              put theirs, so the placement matches the shape. */}
          {foodCatalogueLinks}

          {monthlyGroup}

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
      <LayoutPickerSheet
        visible={layoutPickerOpen}
        surface="shopping"
        onClose={() => setLayoutPickerOpen(false)}
      />
      <ShoppingItemSheet
        visible={detailItem !== null}
        item={detailItem ? items.find((i) => i.id === detailItem.id) ?? detailItem : null}
        onClose={() => setDetailItem(null)}
      />
    </ScreenScaffold>
    {/* Conditionally mounted, and that IS the lock's scope — see components/KeepAwakeInStore.tsx.
        Once, at screen level: the layout is a per-surface setting, so every week list shares
        this spec, and useKeepAwake's shared tag makes per-card mounts release each other's lock. */}
    {layoutSpec.chips && <KeepAwakeInStore />}
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
            <Button label={t.no} variant="ghost" onPress={() => setResetConfirmVisible(false)} style={styles.dialogBtn} />
            <Button label={t.yes} variant="danger" onPress={handleConfirmReset} style={styles.dialogBtn} />
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
            <Button label={t.no} variant="ghost" onPress={() => setResetListConfirmId(null)} style={styles.dialogBtn} />
            <Button
              label={t.yes}
              variant="danger"
              onPress={() => { if (resetListConfirmId) handleResetOneList(resetListConfirmId); }}
              style={styles.dialogBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // The screen owns the vertical rhythm (2026-08-08). `gap` here, and NO vertical margin on
  // any card in the stack — see SCREEN_GAP's doc in constants/theme.ts for the five different
  // gaps this replaced. A child that is always mounted but sometimes zero-height (a closed
  // Collapsible) must be grouped or conditionally rendered, or it books a gap slot for nothing.
  // No vertical padding (2026-08-19): components/ScreenScaffold.tsx clips this content
  // flush to the header's glass and the nav bar's, and a margin here is the blank strip
  // that clip exists to delete. Horizontal padding stays — the side gutters are backdrop.
  content: { paddingHorizontal: Spacing.md, gap: SCREEN_GAP },
  // Link out to Settings → Personal, inside the intro card. The weekly-reset weekday row and
  // the monthly-reset date field used to live in this card's body; they are real settings and
  // they moved there (2026-08-13). This is a door, not a duplicate control — two live copies of
  // one setting is the drift this repo keeps paying for.
  hintSettingsLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: MIN_TAP_TARGET },
  hintSettingsLinkLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, ...OpticalCenter },
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

  catalogCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  catalogHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catalogHeaderTitle: { fontFamily: Type.heading.fontFamily, fontSize: Type.heading.size },
  catalogHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // Budget entry point (moved here from app/(tabs)/scan.tsx, 2026-07-19 — Budget is only
  // reachable via Shopping now; relocated again 2026-07-22 from the shared shoppingIntro
  // chrome, where it repeated on all 4 tabs, into the Monthly tab's own header row —
  // Budget is a monthly-spend concept, so it now shows only there). Bordered pill, inline
  // with the reset/lock icons (no alignSelf needed — sits in a row, not standalone).
  // **Deliberately NOT converted to `Button` in the 2026-08-10 CTA pass**, unlike the four
  // add triggers: this is NAVIGATION (it pushes /budget), not an action on this screen, so
  // it is outside the one-primary hierarchy for the same reason the Food/Catalogue links
  // are — see this file's "One primary, everything else secondary" note. It is also a small
  // pill in an icon row, not a full-width CTA, so `Button`'s geometry would be wrong for it.
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
  // `addTrigger`/`addTriggerText` deleted 2026-08-10 — Monthly's "Add dish" is
  // `Button variant="secondary"` now, which draws that exact shape (accentSoft fill, own
  // edge, MIN_TAP_TARGET, centred icon + label) without a fourth hand-rolled copy of it.
  // Only the spacing above it is this file's to decide.
  addItemSpacing: { marginTop: Spacing.sm },

  // Shopping — Monthly redesign (2026-07-22): tap-to-edit Monthly list name, mirroring
  // WeekListCard's nameEditing/nameInput idiom (greyed placeholder disappears once typed).
  // Row layout (2026-07-23) so the lock icon sits inline right before the name.
  monthlyNameWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  monthlyNamePreviewBtn: { flex: 1, minWidth: 0, paddingVertical: 2 },
  // ⚠️ **`TITLE_FIELD` (2026-08-21, CONSISTENCY_AUDIT.md §1).** This was an UNDERLINE
  // (`borderBottomWidth: 1`) for the same job components/WeekListCard.tsx drew as a box —
  // renaming a list in its own card header — so the Shop tab shipped both shapes at once.
  // The box won: an underline is a second field shape, and FIELD_RADIUS is the one number.
  monthlyNameInput: TITLE_FIELD,
  // Relocated global "reset every list" entry point — a quiet text row under the list
  // cards + "+ New list", not a prominent icon (each list's own reset icon is the primary
  // affordance now).

  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  dialogBox: { borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 340, gap: Spacing.lg },
  dialogMessage: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size, textAlign: 'center' },
  dialogBody: { fontSize: FontSize.sm, textAlign: 'center', marginTop: -Spacing.sm },
  dialogBtns: { flexDirection: 'row', gap: Spacing.sm },
  // 2026-08-10: both reset confirms are `components/Button` now — ghost for No, danger for
  // Yes. They were hand-rolled PressableScales filled `#1E3A5F` and `#4A90D9` with `#FFFFFF`
  // ink: three hardcoded hexes that followed neither palette, so the dialog stayed navy in
  // light mode, and — worse — the button that erases a month of lists was drawn as the
  // *lighter blue* of two blues, with no danger signal and no hierarchy at all. All this
  // style carries now is the flex that splits the row.
  dialogBtn: { flex: 1 },
  // Visual-audit 2026-07-11: background/border colour applied inline (theme) at each
  // call site — was bare muted text floating on the particle background.
  // Plain centred muted text — no fill, no border (2026-08-13). It was a filled, bordered,
  // left-aligned box, which is this app's real-Input look: an empty list read as an empty text
  // FIELD you were meant to type into. That is the same complaint the locked+empty variant
  // below was restyled for on 2026-08-11 ("buttons should look like buttons and text fields
  // like text fields") — this is the other half of it, and it matches what the Habits and
  // Health tabs already draw for an empty section. The locked variant KEEPS its dashed edge:
  // it is a real tap target (it unlocks the list), and a border is what says so.
  sectionEmpty: { fontSize: FontSize.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, textAlign: 'center' },
  // The locked+empty monthly-list variant of sectionEmpty — a real tap target (it unlocks the
  // list), so it's floored to MIN_TAP_TARGET (DESIGN_RULES rule 17). Dashed + unfilled rather
  // than sectionEmpty's solid fill — that filled look is also this app's real-Input look, and
  // this is a button, not a field (2026-08-11 restyle, see the call site's note).
  monthlyEmptyLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
  },
  monthlyEmptyLockedText: { flex: 1, minWidth: 0, fontSize: FontSize.sm },
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

  // **No left rail here, unlike `WeekListCard`'s identically-named style — checked
  // 2026-08-10 and deliberately left different.** Weekly's 3px rail is a STATUS signal:
  // `theme.good` on the in-list/aisle blocks, `theme.accent` on the in-cart one, i.e. it
  // separates "still to buy" from "already picked up". Monthly's blocks have no such
  // distinction — they are ungrouped items and dish groups, all the same kind of thing — so
  // adding a rail here would be decoration wearing a signal's clothing, and removing it from
  // Weekly would drop a real one. Don't "unify" these two into one shape.
  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  // Inset past the check so the column of checks reads as one line down the card
  // Full-width now (2026-07-30): the check moved to the right margin, so there is no leading
  // column left to inset past, and a rule that crosses the whole line reads as ruled paper.
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

  weekLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },

  // The empty Weekly tab's one card — it holds its own explanation AND the two ways to make a
  // first list (2026-08-13), so it needs real padding and a gap, where it used to be a thin
  // wrapper around an EmptyState that brought its own.
  weekEmptyCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  weekEmptyTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, textAlign: 'center', ...OpticalCenter },
  weekEmptyBody: { fontSize: FontSize.sm, textAlign: 'center', ...OpticalCenter },
  // "Saved lists" — the second, quieter way in. A worded row rather than a second filled
  // trigger: two accent-tinted buttons of equal weight in one card is two primaries.
  weekEmptySecondary: { minHeight: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
  weekEmptySecondaryLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, ...OpticalCenter },
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
  // `weekSectionHeaderRow` and `weekSectionLabel` moved into components/SectionRail.tsx's `sub`
  // tier on 2026-08-21 — see the call site. The date range survives as that rail's `right` slot.
  weekSectionRange: { fontSize: FontSize.xs },
  weekSectionEmptyText: { fontSize: FontSize.sm, paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xs },
  // Big-ish plain white/surface "+ Create a new list" button — primary action on the Weekly
  // tab. Icon-only from 2026-07-23 until 2026-08-03; see the comment at the trigger.
  newListTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Between the glyph and its label — `gap`, not a margin, so the pair stays centred as one
    // unit at any font scale.
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  newListTriggerLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
});
