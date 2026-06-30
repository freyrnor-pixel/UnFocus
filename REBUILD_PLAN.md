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
3. **Composites** — AppModal, sheets (AddItemSheet, QuickAddSheet,
   AddDishSheet, ShoppingQuickAddSheet, UpdateSheet, ListSettingsSheet),
   cards (ExpandableCard, PlanTaskCard, WeekListCard, NextTaskCard,
   NoteRow, ShoppingRow, MonthlyTableRow), DatePickerCalendar, DayTimeline,
   DraggableTaskRow, SectionDivider, AddDivider, AddFAB, AddSourceChooser,
   CompletionGlow, EnergyCheckIn, HabitIcon, InventoryIcon, GradientSwatch,
   HuePicker, SwatchPicker, QRCodeDisplay, SaveButton, StickySaveBar,
   InboxSection, SharedRequestsSection, SavedListsModal,
   MonthlyResetSummaryModal, Pet, SiteSwipeView, DebugOverlay.
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
