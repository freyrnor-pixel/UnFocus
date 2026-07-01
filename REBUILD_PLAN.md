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

---

## Native build prerequisites (before the first new APK/AAB)

Not a porting phase — a build-time checklist. An OTA update **cannot** add
native modules, plugins, or permissions, so every capability below must be
present in the APK/AAB that ships. Miss one and the feature fails silently at
runtime (permission denied / module not linked). Source of truth for the
current native surface is `package.json` + `app.json`.

### 1. Native capability inventory (already declared — carry forward as-is)

| Capability | Package(s) | Permission / key | Config plugin in app.json? |
|---|---|---|---|
| Microphone / voice input | `expo-speech-recognition`, `expo-audio` | `RECORD_AUDIO`, iOS `NSMicrophoneUsageDescription` | `expo-audio` ✅ / `expo-speech-recognition` ❌ (see §2) |
| OCR / receipt scanning | `@react-native-ml-kit/text-recognition` | — (on-device ML Kit) | autolinked, no plugin |
| Camera | `expo-camera` | camera perm | ✅ |
| Photo library / image picker | `expo-image-picker`, `expo-media-library` | photos perm | `expo-image-picker` ✅ / `expo-media-library` ❌ (see §2) |
| Location (foreground + background) | `expo-location` | `ACCESS_COARSE/FINE/BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, iOS location + `UIBackgroundModes: location` | ✅ |
| Calendar | `expo-calendar` | `READ/WRITE_CALENDAR`, iOS `NSCalendarsUsageDescription` | ✅ |
| Contacts | `expo-contacts` | `READ/WRITE_CONTACTS`, iOS `NSContactsUsageDescription` | ❌ perms hand-written (see §2) |
| Motion / activity / pedometer | `expo-sensors` | `ACTIVITY_RECOGNITION` | ✅ |
| Local notifications | `expo-notifications` | — | ✅ |
| Background tasks / fetch | `expo-background-task`, `expo-task-manager` | iOS `UIBackgroundModes: fetch, processing` | ✅ (both) |
| Local database | `expo-sqlite` | — | ✅ |
| OTA updates | `expo-updates` | — | ✅ |
| Haptics / vibration | `expo-haptics` | — | autolinked |

Standard native runtime deps also compiled in (no permissions, but native — so
they require the build): `react-native-reanimated` + `react-native-worklets`,
`react-native-gesture-handler`, `react-native-screens`,
`react-native-safe-area-context`, plus `expo-font` / `expo-asset` /
`expo-constants` / `expo-linking` / `expo-status-bar`.

### 2. Config-plugin gaps to fix in app.json before building

Three packages are in `dependencies` but NOT registered in the `plugins` array,
so a fresh `expo prebuild` may not wire their native permissions correctly:

- **`expo-speech-recognition`** — add its config plugin (injects iOS
  `NSSpeechRecognitionUsageDescription` + the Android speech intents).
  `RECORD_AUDIO` alone is not enough.
- **`expo-media-library`** — add the plugin with a permission string, or drop the
  dep if `expo-image-picker` already covers receipt-photo selection.
- **`expo-contacts`** — permissions are hand-written into `android.permissions` +
  `ios.infoPlist` today (works), but adding the plugin is the robust route.

### 3. New capabilities requested — require native additions (future work)

All three are native and OTA-incapable; each needs a new build:

- **Home-screen widgets** — iOS WidgetKit + Android AppWidget. Requires native
  targets / a config plugin (e.g. `@bacons/apple-targets` for the iOS widget
  extension; `react-native-android-widget` for Android). New build; not OTA-able.
- **Visual / media previews in notifications** — iOS rich media requires a
  **Notification Service Extension** target (to attach downloaded images);
  `expo-notifications` `attachments` only render when that extension is present.
  Android uses big-picture / large-icon notification styling. New build required.
- **Lock-screen visibility** — two distinct things:
  - *Notification* on the lock screen — Android via
    `setNotificationChannelAsync({ lockscreenVisibility })` (JS-configurable at
    channel creation, so OTA-able); iOS shows notifications on the lock screen by
    default. This piece does **not** need a native change.
  - *Lock-screen widgets* (iOS 16+ accessory widget families) — WidgetKit,
    native, needs a new build (ties into the widgets item above).

### Build reminder (mirrors AGENTS.md "Builds and updates")

Everything in §2–§3 is a native change → new APK/AAB via `build-android.yml`
(debug artifact) or EAS `production` profile (signed release). Bump **both**
`version` and `runtimeVersion` in `app.json` to the same new value so OTA updates
retarget the new runtime, and keep `slug` = `all-the-small-things`.
