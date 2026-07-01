# Rebuild Plan

Phase order. One phase per Claude Code session. Don't batch.

0. **Planning files** — create REBUILD_DECISIONS.md, PROGRESS_LOG.md,
   REBUILD_PLAN.md. (Done in the session that creates this list.)
1. **Foundation: universal screen scaffold** — port the minimum set of
   foundation files needed to satisfy Decision 001 (constants, lib helpers,
   Surface primitive, the three background components, ScreenHeader,
   BottomNav, and a new ScreenScaffold wrapper). Demo screen proves it works.
2. **Remaining primitives** — Button, Badge, IconButton, ProgressBar,
   PressableScale, FormControls, EmptyState, ConfirmationBanner, HintCard.
3. **Composites** — sub-batched; one sub-phase per Claude Code session.
   The header rule ("one phase per session, don't batch") applies to each
   sub-phase, not to Phase 3 as a whole. Several composites are decision-
   gated and must route to their own decision session rather than a generic
   port — marked ⚠ below.

   - **3a — Foundational composites** ✅ DONE (see PROGRESS_LOG). AppModal,
     ExpandableCard, SectionDivider, AddDivider, CompletionGlow. These are
     the structural/leaf composites the rest of Phase 3 depends on;
     ExpandableCard is the lynchpin (Decision 009 routes all three Home
     previews through it).
   - **3b — Sheets** (all overlay glass, Decision 008). AddItemSheet,
     QuickAddSheet, AddDishSheet, ShoppingQuickAddSheet, UpdateSheet,
     ListSettingsSheet. AddItemSheet is explicitly out of the A2 redesign
     (Decision 011 A2-5) — faithful port, not a restyle.
   - **3c — Cards & rows** (⚠ decision-gated — do NOT port as a uniform
     batch). PlanTaskCard ⚠ (Plans preview redesign, Decision 009 #3 —
     Session B, resolve with user first), ShoppingRow ⚠ (Decision 011
     A2·1, two-line redesign + ripples R1/R2/R3), WeekListCard ⚠
     (entangled with Decision 009 #2 + 011), NextTaskCard, NoteRow,
     MonthlyTableRow. Only the un-gated rows are plain ports; the ⚠ items
     route to their dedicated sessions.
   - **3d — Timeline & interaction.** DayTimeline, DraggableTaskRow (⚠ role
     pending verification as the drag-reorder primitive under Decision 011
     R1), DatePickerCalendar, AddFAB, AddSourceChooser, EnergyCheckIn.
   - **3e — Icons, pickers, misc leaves.** HabitIcon, InventoryIcon,
     GradientSwatch, HuePicker, SwatchPicker, QRCodeDisplay, SaveButton,
     StickySaveBar, InboxSection (⚠ Decision 009 Session A refactor —
     Surface→ExpandableCard + inline note edit), SharedRequestsSection,
     SavedListsModal, MonthlyResetSummaryModal, Pet, SiteSwipeView,
     DebugOverlay.

   Scope each sub-phase only when the prior one is logged done in
   PROGRESS_LOG.md. Do NOT pre-write 3c–3e prompts. Where a component is
   marked ⚠, its decision must be resolved and recorded in
   REBUILD_DECISIONS.md before that component's code is written.
4. **Flagged-for-redesign components** — resolve any remaining items in
   FEATURE_INVENTORY.docx edit notes that flag a component for redesign.
   BubbleMenu is already resolved (Decision 001: remove).
5. **Stores + paired screens** — port each store alongside the smallest
   screen that uses it.
6. **Screens (smallest/most independent first → onboarding last):**
   - Self-contained forms: task-form.tsx, habit-form.tsx, inventory-edit.tsx
   - Single-purpose: plans.tsx, capture.tsx, share-modal.tsx, notes.tsx
   - Mid-complexity sites: shopping.tsx, habits.tsx, meals.tsx, health.tsx,
     budget.tsx, scan.tsx, automations.tsx, shared.tsx
   - Home: index.tsx
   - Onboarding last: app/onboarding/*

Each phase: read REBUILD_DECISIONS.md and PROGRESS_LOG.md before touching
code, then append a summary to PROGRESS_LOG.md before ending the session.
