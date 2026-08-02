/**
 * useSettingsStore.ts — single-row app settings / preferences
 *
 * Zustand store mirroring the one settings row: user name, language,
 * dark mode, reminder/notification toggles (including quiet hours, task/habit notification toggles), reset cadence,
 * work mode, the optional Energy system (energySystemEnabled + default day/week
 * capacities — see store/useEnergyStore.ts), onboarding state, accessibility flags, monthly
 * grocery budget (monthlyBudgetNok), the local account
 * (accountName/accountCreated — device-only profile, Decision 039), and the debug
 * overlay's enable flag.
 * persistentNotifEnabled toggles the always-current "today's overview" notification
 * (refreshed by app/_layout.tsx, see lib/notifications.ts's refreshPersistentNotification).
 * habitNotificationsEnabled gates all habit reminders.
 * childMode/childModePasswordSet are Decision 038c FLAGS only — the parent password
 * itself lives in expo-secure-store (lib/childLock), never in this row. deviceId is
 * this install's stable identity for LAN live-sync (self-healed on load() if empty);
 * lanSyncEnabled gates whether lib/syncService's transport runs (Decision 038 wiring).
 * freyrModeEnabled/freyrSeedIds back the Additional-modes-tab "Freyr-mode" toggle —
 * see lib/freyrModeSeed.ts for the seed/unseed logic; freyrSeedIds is a JSON blob,
 * not read/written by anything in this file beyond passthrough.
 * firstRunComplete/startScreen (2026-07-30) back the first-run personalization flow
 * (app/onboarding/basics.tsx since 2026-07-31 — app/first-run.tsx is deleted): the first
 * gates whether it runs, the second is which of the 5 pager
 * tabs the app opens on (read at mount by app/(tabs)/_layout.tsx as the navigator's
 * initialRouteName). The flow writes both — plus reducedMotion/particlesEnabled/fontSize/
 * darkMode — in ONE update() call, so it can never half-commit; see lib/firstRunOptions.ts
 * for the option sets and the picks ⇄ settings mapping it uses.
 * planTimelineHorizontal switches the Plans day-view rail (components/PlanTaskCard.tsx)
 * between the default vertical rail and a horizontal one; read by app/(tabs)/index.tsx
 * and passed down as a prop (PlanTaskCard itself stays store-free/presentational).
 * homeCardOrder is the ordered/filtered list of Home preview "kind" ids the user has
 * chosen to keep visible (hold-to-manage, components/HomeCardManager.tsx) — a kind
 * missing from the array is a user-removed card.
 * lifetimeCompletedTasks (2026-07-20) is an internal, non-UI counter — the all-time
 * completed-task count, maintained by store/useTaskStore.ts so it survives
 * pruneOldData() pruning old completed tasks out of the `tasks` table; read
 * directly by app/(tabs)/index.tsx.
 * lifetimeGrowth (2026-07-31) is the same shape of counter for the ambient growth reward —
 * the best streak of active days ever reached, banked by lib/useGrowth.ts and read by
 * components/ScreenBackground.tsx via lib/growth.ts. showGrowth gates what the backdrop
 * draws from it (see that field's own doc).
 * photoAspectRatio (aspect-ratio formats pass) is the app-wide default format for
 * photo tiles — see components/PhotoFrame.tsx and constants/theme.ts's AspectRatio map.
 * featureGoals/featureSharing/featureScan/featureFood/featureAutomations (2026-07-25,
 * defaults revised same day) are the feature flags — each originally hid a purely
 * additive surface when off (see their per-field docs below). Only featureSharing and
 * featureAutomations are still off-by-default opt-in toggles; since the onboarding
 * feature picker was deleted (2026-07-31, B1-1) their ONLY entry point is Settings →
 * Advanced → Features. featureGoals now defaults ON, same as
 * energySystemEnabled, but stays a toggle. featureScan/featureFood are now permanently
 * on and unreadable by any UI gate — see "Inert columns" in Edit notes below.
 * featureMedicine (2026-07-27) gates the Health tab's medicine-tray card (on by default,
 * still a real toggle); medicineTrayTimes/medicineRemindersEnabled configure its four
 * per-tray daily reminders — see store/useMedicineStore.ts + lib/medicineSchedule.ts.
 * energyMode (2026-07-24) picks how the Energy capacity is defined — 'daily'/'weekly'
 * use the flat energyDailyCapacity/energyWeeklyCapacity number and hide the other
 * meter; 'custom' uses energyCustomCapacities (Mon..Sun) per-weekday amounts instead,
 * set via the week-of-steppers row in app/settings.tsx, with the week capacity derived
 * as their sum. See store/useEnergyStore.ts's capacityForDay/capacityForWeek.
 *
 * Connections:
 *   Imports → lib/dataAccess, lib/id, lib/medicineSchedule (TrayTimes + its normalizer/defaults), constants/theme (AspectRatioKey)
 *   Used by → app/_layout.tsx, app/budget.tsx, app/habit-form.tsx, app/(tabs)/health.tsx, app/(tabs)/habits.tsx, app/index.tsx, app/medicine-form.tsx, app/onboarding/* , app/pair-device.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, app/task-form.tsx, components/DebugOverlay.tsx, components/HintCard.tsx, components/MedicineTrayCard.tsx, components/ParticleBackground.tsx, components/PhotoFrame.tsx, components/SharedRequestsSection.tsx, lib/i18n.ts, lib/reminders.ts, lib/syncService.ts, lib/taskCalendar.ts (deviceCalendarId cache), lib/useAppTheme.ts, store/useAutomationStore.ts, store/useHabitStore.ts, store/useMedicineStore.ts, store/useShoppingStore.ts, store/useTaskStore.ts
 *   Data    → defines a Zustand store; owns the single-row SQLite table settings (id = 1)
 *
 * Edit notes:
 *   - Settings live in ONE row (id = 1, inserted by initDb); update() writes only the
 *     columns present in its patch (via rowValues + SETTINGS_COLUMNS) WHERE id = 1 —
 *     NOT a full-row rewrite.
 *   - `loaded` and `workModeSessionOverride` are session-only (never persisted to SQLite).
 *   - update() updates in-memory state even if the DB write throws (e.g. column not yet
 *     migrated), so the UI stays responsive — but the failure is now surfaced via
 *     logDbError so a silently-lost-on-restart setting shows up in logs instead of
 *     vanishing unnoticed.
 *   - New settings columns go through the migrations array in lib/db.ts; add to Settings type, load() mapping, and update()'s column list.
 *   - `contactsEnabled` (2026-07-17) joins `locationEnabled`/`calendarSyncEnabled`/
 *     `voiceNotesEnabled` as the fourth reserve-only permission toggle, all surfaced in
 *     app/settings.tsx's "Device features" card. `deviceCalendarId` is internal (not
 *     user-facing) — the id of the dedicated "UnFocus" device calendar, cached by
 *     lib/taskCalendar.ts's ensureCalendar() so it isn't recreated on every sync.
 *   - **Inert columns (2026-07-25)** — persisted, mapped, and written by update(), but
 *     read by NOTHING in the app. Their Settings UI was removed in the settings
 *     reorganization because the switches did nothing; the columns stay (this repo never
 *     drops columns) so the features can be built later without a migration dance:
 *     `workModeEnabled`, `enforceWorkHours`, `workHoursStart`, `workHoursEnd`, `workDays`,
 *     `holidaysEnabled`, `schoolModeEnabled`, `childMode`, `childModePasswordSet`,
 *     `showHints`, `backgroundLocationEnabled`, `monthlyBudgetNok`
 *     (superseded by per-list budgets in store/useMonthlyListStore.ts). Do NOT wire new
 *     UI to these without building the behaviour they imply.
 *   - **`show_points` LEFT the inert list on 2026-07-31** — exactly the "build the behaviour
 *     it implies" case the note above anticipates. Its TS field is now `showGrowth` (see its
 *     own field doc, near `lifetimeCompletedTasks`/`lifetimeGrowth`) — a real off-by-default
 *     opt-in, same shape as featureSharing/featureAutomations. It briefly gated a
 *     Bonsai/points card on the same day before that was replaced by the ambient growth
 *     backdrop; only the column name still carries the old wording.
 *   - **`childProfiles` joined the inert list on 2026-07-28** — a third flavour: it holds
 *     real user data that was MIGRATED rather than abandoned. The People registry
 *     (store/usePeopleStore.ts) read this `string[]` of names once, on an app_meta-gated
 *     one-shot, and turned each entry into a `people` row with a stable id and a colour;
 *     `tasks.assignee_id` was back-filled from the matching `tasks.assignee` names in the
 *     same transaction. The column is still written by update() and left exactly as it was
 *     so a failed back-fill stays diagnosable from a backup — but no person UI reads it.
 *     Wire new person UI to usePeopleStore, never here. `peopleModeEnabled` is emphatically
 *     NOT inert: it's still the live master switch for every person surface.
 *   - **`featureScan`/`featureFood` joined the inert list the same day (2026-07-25,
 *     defaults-revision follow-up)** — a different flavour of inert than the block
 *     above: these two DID gate real surfaces (the scan icon/receipts/Budget, the
 *     Food+Catalogue row) for about a day, then the maintainer decided both should
 *     just always be on, like Habits/Health. The migration sets both to 1 for every
 *     row (see lib/db.ts); Settings' Features card and the onboarding picker no
 *     longer read either field. `featureGoals` stayed a REAL toggle through the same
 *     revision — only its default flipped from off to on — so it's still in
 *     FEATURE_ROWS (app/settings.tsx) and the onboarding ROWS, unlike these two.
 *   - **`energySystemEnabled` LEFT the inert list again on 2026-07-31** — it is a REAL
 *     on-by-default toggle once more, at the maintainer's request, reversing the
 *     2026-07-26 "Energy is always on, just on 0 by default for simplicity" call. It was
 *     inert for five days; the column has been pinned to 1 for every row that whole time
 *     (lib/db.ts), which is exactly why flipping it back on costs no migration and why
 *     every existing user keeps Energy switched on. It now gates the surfaces it always
 *     implied: the Home meter (components/EnergyMeter.tsx), the To-do tab's
 *     EnergyBalanceCard, both editors' energy steppers and PlanTaskCard's quick-add energy
 *     chip. Gate the SURFACE, never the data — the per-task/habit `energyEnabled`/
 *     `energyValue` columns keep their values while the system is off, so turning it back
 *     on restores every number untouched. NOTE the sibling columns are emphatically NOT
 *     inert either: `energyMode`, `energyDailyCapacity`, `energyWeeklyCapacity` and
 *     `energyCustomCapacities` are still live configuration, still in Settings, and still
 *     read by store/useEnergyStore.ts.
 *   - **Fresh-install feature defaults were audited on 2026-07-31 (B1-1)**, when the
 *     onboarding feature picker was deleted and the defaults had to stand alone. The
 *     migration log was replayed from an empty DB and the resulting `settings` row read
 *     back; every LIVE gating flag already matched the target, so **no migration was
 *     appended**. Fresh install lands on: `energy_system_enabled` 1, `feature_goals` 1,
 *     `feature_medicine` 1, `show_points` 0, `feature_sharing` 0, `feature_automations` 0,
 *     `people_mode_enabled` 0, `lan_sync_enabled` 0, `persistent_notif_enabled` 0,
 *     `debug_mode_enabled` 0. Tasks/Shopping/Habits/Health/Notes have NO flag (core
 *     surfaces) and neither does the AI setup guide — don't add one to satisfy a spec
 *     table. `feature_food`/`feature_scan` land on 1 but are INERT (below): a request to
 *     default Food off cannot be honoured by flipping the column, because nothing reads
 *     it — that needs the Food surface re-gated first, which is a maintainer decision.
 *   - `glassBlur` was removed (2026-07-18 glass simplification — the Android blur-target
 *     subsystem it gated no longer exists). Its `glass_blur` SQLite column is intentionally
 *     left orphaned (never drop columns) — see lib/db.ts's migration comment.
 *   - **Orphaned columns that never even had a TS field (found 2026-08-01,
 *     STALE_CODE_AUDIT.md)** — one step past "inert": these were never mapped into this
 *     store at all, so there's no `update()` path and no way to set them from the app.
 *     `bubble_material`/`bubble_size`/`bubble_spacing`/`bubble_spring_intensity`/
 *     `bubble_anim_speed` were the radial `BubbleMenu`'s tuning knobs — that feature was
 *     dropped before porting (Decision 008 #5) before its settings ever reached this file.
 *     `custom_primary_color`/`custom_secondary_color` were the pre-rebuild custom-theme
 *     system's two colour pickers — no custom theme exists any more (see
 *     COLOR_THEME_LIBRARY.md's rewrite the same day). Never drop the columns; never wire
 *     new UI to them without building the feature they imply.
 *   - **`energySystemEnabled` history**: defaulted `false`, flipped to `true` 2026-07-21 so
 *     the Home Energy meter was visible out of the box, stopped being a toggle at all on
 *     2026-07-26, then became a real on-by-default toggle again on 2026-07-31 (see the
 *     inert-columns note above — it is NOT inert now). Three reversals in eleven days:
 *     check the live FEATURE_ROWS in app/settings.tsx before trusting any prose about it.
 */
import { create } from 'zustand';
import {
  Row,
  FieldMap,
  loadFirst,
  updateRow,
  rowValues,
  readStr,
  readInt,
  readReal,
  readBool,
  readJson,
  readEnum,
  logDbError,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { DEFAULT_TRAY_TIMES, normalizeTrayTimes, TrayTimes } from '@/lib/medicineSchedule';
import { AspectRatioKey } from '@/constants/theme';
import { DetailLevel, sanitizeCardLayouts, sanitizeDetailLevel } from '@/lib/cardLayout';
import { sanitizeCardStates } from '@/lib/padState';

// The app ships a single palette ("Default"). The union is kept as a type so
// existing casts (`as ColorTheme`) still compile; only 'default' is ever stored.
export type ColorTheme = 'default';
export type Language = 'en' | 'no';
export type DarkMode = 'system' | 'on' | 'off';
export type FontSizePref = 'small' | 'default' | 'large';
export type EnergyMode = 'daily' | 'weekly' | 'custom';
/**
 * Which of the 5 pager tabs the app opens on (first-run step 4, and Settings → Personal
 * → Layout). Presentation only — every tab is still one tap away, so no value here can
 * make anything unreachable. The id → route map lives in lib/firstRunOptions.ts.
 */
export type StartScreen = 'home' | 'plans' | 'shopping';
/** Habits' Today/Week/Month selector. Persisted so it survives a remount. */
export type HabitViewTab = 'today' | 'week' | 'month';

export type Settings = {
  userName: string;
  weeklyResetDay: number;
  monthlyResetDate: number;
  remindersEnabled: boolean;
  reminderTime: string;
  taskNotificationsEnabled: boolean;
  setupComplete: boolean;
  /**
   * Gate for the first-run personalization flow (app/onboarding/basics.tsx) — false means the
   * flow hasn't been seen yet. Separate from `setupComplete` on purpose: onboarding
   * establishes the app, this one only adjusts already-applied defaults, so a user can
   * re-run either without the other. Written exactly once per run, in the same patch as
   * the selections themselves, so the flow can never half-commit.
   */
  firstRunComplete: boolean;
  /** Which tab the app opens on — see the StartScreen type above. */
  startScreen: StartScreen;
  workModeEnabled: boolean;
  workHoursStart: string;
  workHoursEnd: string;
  enforceWorkHours: boolean;
  workDays: number[];
  // LIVE again as of 2026-07-31 — was inert (see the removed 2026-07-25 note), now the
  // feature flag for the ambient growth reward (lib/growth.ts +
  // components/ScreenBackground.tsx): off-by-default opt-in, offered on
  // app/onboarding/energy.tsx (it needs a paragraph, not a one-line switch — it was never
  // in the deleted feature picker) and Settings → Advanced → Features (FEATURE_ROWS). Gates
  // only what the BACKDROP draws — the high-water mark still accumulates in lifetimeGrowth
  // while off, so turning it back on reflects the streaks actually built rather than
  // starting bare (same rule as every other feature flag here).
  // NOTE the SQLite column is still `show_points`, from the one-day-lived Bonsai/points
  // system this replaced (2026-07-31). This repo never drops columns — see lib/db.ts.
  showGrowth: boolean;
  showHints: boolean;
  language: Language;
  holidaysEnabled: boolean;
  darkMode: DarkMode;
  /**
   * @deprecated INERT since 2026-07-28 — superseded by the People registry
   * (store/usePeopleStore.ts), whose one-shot back-fill read this list once and turned it
   * into `people` rows. Kept written and readable per the never-drop rule so a bad
   * back-fill stays diagnosable from a backup; nothing reads it for person UI any more.
   * Do NOT wire new UI to it — add to the People registry instead.
   */
  childProfiles: string[];
  // Accessibility (Proposal 4)
  reducedMotion: boolean;
  particlesEnabled: boolean;
  /**
   * Glass surface finish ("Glass, take two", 2026-07-17). On (default) renders the
   * frosted rim/specular/scrim/drifting-sheen glass on cards, buttons, and the FAB; off
   * falls back to plain opaque surfaces — a user-facing reduce-transparency mode.
   */
  glassSurfaces: boolean;
  fontSize: FontSizePref;
  // Left-handed mode
  leftHanded: boolean;
  // Persistent "today's overview" notification
  persistentNotifEnabled: boolean;
  // Notification quiet hours (AP-05)
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  // Monthly grocery budget (AP-06B), shown against receipts in app/budget.tsx
  monthlyBudgetNok: number;
  // Debug mode — feedback pins
  debugModeEnabled: boolean;
  // Last payday-boundary monthly reset, as YYYY-MM-DD; drives the automatic reset check in app/shopping.tsx
  lastMonthlyReset: string;
  // Habit reminders toggle
  habitNotificationsEnabled: boolean;
  // Permission toggles (permission pre-bake)
  locationEnabled: boolean;
  backgroundLocationEnabled: boolean;
  calendarSyncEnabled: boolean;
  voiceNotesEnabled: boolean;
  contactsEnabled: boolean;
  /** Cached id of the dedicated "UnFocus" device calendar created by lib/taskCalendar.ts's
   *  ensureCalendar() — internal, not user-facing. Empty until the first calendar sync. */
  deviceCalendarId: string;
  // Local account (Decision 039) — device-only, user-held profile. No server, no
  // credentials. accountName is a display label; accountCreated (YYYY-MM-DD) is
  // stamped when the user creates their local account (empty = none yet). Both ride
  // along in the local backup file via lib/backup.ts (they live in the settings row).
  accountName: string;
  accountCreated: string;
  // Child-mode variant (Decision 038c) — locked-down mode gated by a parent
  // password. Only flags persist here; the password lives in expo-secure-store
  // (lib/childLock.ts), never in this row.
  childMode: boolean;
  childModePasswordSet: boolean;
  // LAN live-sync (Decision 038 app integration). deviceId is this install's stable
  // identity (self-healed by load() if empty — see below); lanSyncEnabled gates
  // whether lib/syncService's transport runs.
  deviceId: string;
  lanSyncEnabled: boolean;
  // Auto-backup to a persistent, user-visible location, updated on every change
  // when enabled (lib/backup.ts). autoBackupUri is the SAF content:// URI of the
  // single self-updating backup file the user picked on Android (empty on
  // iOS/other, which write the fixed documentDirectory path); autoBackupLabel is a
  // human-readable location shown in Settings; autoBackupLastAt is the ISO
  // timestamp of the last successful auto-backup (drives "Last backed up …").
  autoBackupEnabled: boolean;
  autoBackupUri: string;
  autoBackupLabel: string;
  autoBackupLastAt: string;
  // School mode placeholder — no feature logic yet, toggle persisted for future use.
  schoolModeEnabled: boolean;
  // People / family mode (2026-07-12 redesign) — when on, the person selector (Me +
  // each childProfiles entry) appears in the task editor AND the habit form, and a
  // person filter row appears on Tasks/Health. Profiles are managed in Settings.
  peopleModeEnabled: boolean;
  // Freyr-mode (Additional modes tab) — one-tap seed/unseed of a starter set of
  // shopping/task/habit/note rows via lib/freyrModeSeed.ts. freyrSeedIds is the JSON
  // record of exactly which rows the seed created, so disabling removes only those.
  freyrModeEnabled: boolean;
  freyrSeedIds: string;
  // Plans day-view rail orientation (Home preview) — see
  // components/PlanTaskCard.tsx. false = vertical rail (default), true = horizontal.
  planTimelineHorizontal: boolean;
  // First-run per-screen hints (onboarding slim-down 2026-07-13). Screen keys whose
  // ⓘ hint has already auto-expanded once; a key not present means "first visit — open
  // the hint". Replaces the old setup-wizard steps, which taught these settings up front.
  seenScreenHints: string[];
  // Home preview card management (2026-07-19) — ordered list of visible Home preview
  // "kind" ids ('notes'/'plans'/'shopping'); a kind missing from the array is a
  // user-removed card. Managed by components/HomeCardManager.tsx via hold-to-edit on
  // Home; see app/(tabs)/index.tsx.
  homeCardOrder: string[];
  // Energy system (2026-07-20) — optional per-task energy-budget model replacing the
  // removed Focus mode / task Importance. energySystemEnabled is a REAL on-by-default
  // toggle again as of 2026-07-31 (it was inert 2026-07-26 → 2026-07-31; see the
  // inert-columns note in this file's header for the full back-and-forth):
  // when off, all energy UI is hidden. energyDailyCapacity / energyWeeklyCapacity are
  // the DEFAULT capacities (a plain number) used when no per-period override exists in
  // energy_budgets (store/useEnergyStore.ts). Consumed energy is derived from completed
  // energy-tasks (lib/energy.ts), never stored on settings.
  energySystemEnabled: boolean;
  energyDailyCapacity: number;
  energyWeeklyCapacity: number;
  // Energy mode (2026-07-24) — how the capacity is defined. 'daily'/'weekly' use the
  // flat capacity above and hide the other meter; 'custom' uses energyCustomCapacities
  // (Mon..Sun) instead of energyDailyCapacity, with the week capacity derived as their
  // sum. See store/useEnergyStore.ts's capacityForDay/capacityForWeek.
  energyMode: EnergyMode;
  energyCustomCapacities: number[];
  // All-time completed-task counter (2026-07-20 long-run health pass) — lives here
  // rather than being derived from `tasks` row presence, since pruneOldData() now
  // actually prunes old completed dated tasks. Incremented/decremented by
  // store/useTaskStore.ts at the same sites that fire the 'task_completed'
  // automation trigger (plus remove()/clearAll()); read directly by app/(tabs)/index.tsx.
  lifetimeCompletedTasks: number;
  // Growth high-water mark (2026-07-31) — same "persisted, survives log pruning"
  // shape as lifetimeCompletedTasks above: the user's BEST streak of active days ever
  // reached (lib/growth.ts), banked by lib/useGrowth.ts whenever the current streak beats
  // it. Never decremented — no punishment — which is what makes the backdrop's grown-in
  // border branches permanent while the tint above them is free to fade back to neutral.
  // Column is still `lifetime_bonsai_points` (never dropped); the field was renamed off
  // the deleted Bonsai system on 2026-07-31.
  lifetimeGrowth: number;
  // Default aspect-ratio format for photo tiles (components/PhotoFrame.tsx) app-wide —
  // 'fit' shows a photo's natural proportions; the others center-crop to a fixed ratio.
  // A per-call `format` prop can still override this for a specific tile.
  photoAspectRatio: AspectRatioKey;
  // ---- Feature flags (2026-07-25 settings reorganization; defaults revised same day) ----
  // Each one gates a purely ADDITIVE surface — the app keeps working, the feature's own
  // data/routes stay on disk, and nothing that would break app logic is gated this way
  // (pruning, widget/overview sync, catalog+dish+symptom seeding, the automation store's
  // boot load and the monthly reminder re-arm all stay unconditional).
  //
  // Only featureSharing/featureAutomations are still off-by-default, user-facing
  // toggles — Settings → Advanced → Features, which since the onboarding feature picker
  // was deleted (2026-07-31, B1-1) is their only entry point; a fresh install therefore
  // meets both off and finds them there. featureGoals defaults ON (still a toggle, same
  // Features card). featureScan/featureFood default ON and are no longer read by ANY
  // UI gate — see "Inert columns" in Edit notes for why the fields survive anyway.
  /** Goal linking: GoalPicker in the task/habit editors + the GoalGlowDot on cards. On by default. */
  featureGoals: boolean;
  /** Sharing & QR: the header share icon, HomeSharedCard, and the shared task/request sections. Off by default. */
  featureSharing: boolean;
  /** Unused — Scan & receipts is always on (2026-07-25). See "Inert columns" below. */
  featureScan: boolean;
  /** Unused — Food & recipes is always on (2026-07-25). See "Inert columns" below. */
  featureFood: boolean;
  /** Automations: the entry point to app/automations.tsx. Existing rules still run when off. Off by default. */
  featureAutomations: boolean;
  /** Medicine trays: the dose card on the Health tab + its reminders. On by default, still a toggle. */
  featureMedicine: boolean;
  /**
   * Day log (2026-08-02): makes the day-view's now-line the boundary between what has
   * already happened (a flush, spacing-free list of completed tasks, doses, health
   * entries and captured moments) and what is still ahead (the existing elastic grid).
   * On by default, still a toggle — it restructures the To-do tab's default layout, and
   * off restores the previous rendering exactly. Gates the SURFACE only: `tasks.done_at`
   * keeps being stamped while off, so turning it back on shows a complete history.
   */
  featureDayLog: boolean;
  // Medicine reminders (2026-07-27) — ONE time per tray (morning/midday/evening/night),
  // shared by every medicine in that tray, so a tray fires one notification rather than
  // one per pill. Stored as a JSON map keyed by TrayId; read through
  // lib/medicineSchedule.ts's normalizeTrayTimes so a corrupt/partial column can't
  // produce an unschedulable time. medicineRemindersEnabled is the master switch for
  // those four daily notifications (the card and dose logging work regardless).
  medicineTrayTimes: TrayTimes;
  medicineRemindersEnabled: boolean;
  // ---- Card layouts (2026-07-27) ----
  // How much detail list-bearing surfaces draw, and per-surface exceptions to that.
  // `layoutDetail` is the global default every surface understands; `cardLayouts` maps a
  // surface id to a layout that overrides it ({ shopping: 'inStore' }) — an absent key
  // means "follow the global default", which is what the picker's reset writes.
  //
  // Both are validated on read through lib/cardLayout.ts (sanitizeDetailLevel /
  // sanitizeCardLayouts) rather than trusted, so a stale id from an older build or an
  // edited backup degrades to 'normal' instead of resolving to an undefined spec.
  //
  // Presentation ONLY. No reminder, automation, widget, or sync path reads either field —
  // a layout changes how existing data is drawn, never what the app does with it. In
  // particular, a row that the active layout doesn't draw keeps its own reminders; see
  // lib/cardLayout.ts's header and lib/__tests__/cardLayout.test.ts.
  layoutDetail: DetailLevel;
  cardLayouts: Record<string, string>;
  // ---- Card states (2026-07-30, notepad pass) ----
  // How BIG each list-bearing surface is drawn, as opposed to how much detail its rows
  // carry (that's `cardLayouts` above — the two are independent axes). Maps a surface id
  // to 'closed' | 'preview' | 'open'; an absent key means 'preview'.
  //
  // Validated on read through lib/padState.ts's sanitizeCardStates, same defence as
  // cardLayouts: a value from an edited backup can't blank a card.
  //
  // Presentation ONLY, and this matters more here than for layouts: a CLOSED card draws no
  // rows at all, and every one of those rows is still live — it keeps its reminders and
  // still counts in the card's own "8/10 left" summary. Nothing in the reminder, widget,
  // sync or automation paths may read this field.
  cardStates: Record<string, string>;
  /** Guided-tour progress: comma-separated step ids from lib/tourSteps.ts. Device-local. */
  tourProgress: string;
  /** Habits' Today/Week/Month selector, persisted so it survives a remount. */
  habitViewTab: HabitViewTab;
};

type SettingsStore = Settings & {
  // Session-only (not persisted)
  loaded: boolean;
  workModeSessionOverride: boolean;
  load: () => void;
  update: (patch: Partial<Settings>) => void;
  setWorkModeSessionOverride: (v: boolean) => void;
  /** Record that a screen's first-run ⓘ hint has auto-expanded, so it won't again. */
  markScreenHintSeen: (key: string) => void;
};

/** Map the single settings row to the persisted Settings (defaults mirror the old load()). */
function rowToSettings(row: Row): Settings {
  return {
    userName: readStr(row, 'user_name'),
    weeklyResetDay: readInt(row, 'weekly_reset_day', 0),
    monthlyResetDate: readInt(row, 'monthly_reset_date', 1),
    remindersEnabled: readBool(row, 'reminders_enabled'),
    reminderTime: readStr(row, 'reminder_time', '08:00'),
    taskNotificationsEnabled: readBool(row, 'task_notifications_enabled'),
    setupComplete: readBool(row, 'setup_complete'),
    firstRunComplete: readBool(row, 'first_run_complete'),
    startScreen: readEnum<StartScreen>(row, 'start_screen', ['home', 'plans', 'shopping'], 'home'),
    workModeEnabled: readBool(row, 'work_mode_enabled'),
    workHoursStart: readStr(row, 'work_hours_start', '07:00'),
    workHoursEnd: readStr(row, 'work_hours_end', '17:00'),
    enforceWorkHours: readBool(row, 'enforce_work_hours'),
    workDays: readJson<number[]>(row, 'work_days', [0, 1, 2, 3, 4]),
    showGrowth: readBool(row, 'show_points'),
    showHints: readInt(row, 'show_hints', 1) !== 0,
    language: readEnum<Language>(row, 'language', ['en', 'no'], 'no'),
    holidaysEnabled: readInt(row, 'holidays_enabled', 1) !== 0,
    darkMode: readEnum<DarkMode>(row, 'dark_mode', ['system', 'on', 'off'], 'off'),
    childProfiles: readJson<string[]>(row, 'child_profiles', []),
    reducedMotion: readBool(row, 'reduced_motion'),
    particlesEnabled: readInt(row, 'particles_enabled', 1) !== 0,
    glassSurfaces: readInt(row, 'glass_surfaces', 1) !== 0,
    fontSize: readEnum<FontSizePref>(row, 'font_size', ['small', 'default', 'large'], 'default'),
    leftHanded: readBool(row, 'left_handed'),
    persistentNotifEnabled: readBool(row, 'persistent_notif_enabled'),
    quietHoursEnabled: readBool(row, 'quiet_hours_enabled'),
    quietHoursStart: readStr(row, 'quiet_hours_start', '21:00'),
    quietHoursEnd: readStr(row, 'quiet_hours_end', '08:00'),
    monthlyBudgetNok: readReal(row, 'monthly_budget_nok'),
    debugModeEnabled: readBool(row, 'debug_mode_enabled'),
    lastMonthlyReset: readStr(row, 'last_monthly_reset'),
    habitNotificationsEnabled: readBool(row, 'habit_notifications_enabled'),
    locationEnabled: readBool(row, 'location_enabled'),
    backgroundLocationEnabled: readBool(row, 'background_location_enabled'),
    calendarSyncEnabled: readBool(row, 'calendar_sync_enabled'),
    voiceNotesEnabled: readBool(row, 'voice_notes_enabled'),
    contactsEnabled: readBool(row, 'contacts_enabled'),
    deviceCalendarId: readStr(row, 'device_calendar_id'),
    accountName: readStr(row, 'account_name'),
    accountCreated: readStr(row, 'account_created'),
    childMode: readBool(row, 'child_mode'),
    childModePasswordSet: readBool(row, 'child_mode_password_set'),
    deviceId: readStr(row, 'device_id'),
    lanSyncEnabled: readBool(row, 'lan_sync_enabled'),
    autoBackupEnabled: readBool(row, 'auto_backup_enabled'),
    autoBackupUri: readStr(row, 'auto_backup_uri'),
    autoBackupLabel: readStr(row, 'auto_backup_label'),
    autoBackupLastAt: readStr(row, 'auto_backup_last_at'),
    schoolModeEnabled: readBool(row, 'school_mode_enabled'),
    peopleModeEnabled: readBool(row, 'people_mode_enabled'),
    freyrModeEnabled: readBool(row, 'freyr_mode_enabled'),
    freyrSeedIds: readStr(row, 'freyr_seed_ids'),
    planTimelineHorizontal: readBool(row, 'plan_timeline_horizontal'),
    seenScreenHints: readJson<string[]>(row, 'seen_screen_hints', []),
    homeCardOrder: readJson<string[]>(row, 'home_card_order', ['plans', 'habits', 'notes', 'shopping']),
    energySystemEnabled: readBool(row, 'energy_system_enabled'),
    energyDailyCapacity: readInt(row, 'energy_daily_capacity', 10),
    energyWeeklyCapacity: readInt(row, 'energy_weekly_capacity', 50),
    energyMode: readEnum<EnergyMode>(row, 'energy_mode', ['daily', 'weekly', 'custom'], 'daily'),
    energyCustomCapacities: readJson<number[]>(row, 'energy_custom_capacities', [10, 10, 10, 10, 10, 10, 10]),
    lifetimeCompletedTasks: readInt(row, 'lifetime_completed_tasks', 0),
    lifetimeGrowth: readInt(row, 'lifetime_bonsai_points', 0),
    photoAspectRatio: readEnum<AspectRatioKey>(
      row,
      'photo_aspect_ratio',
      ['fit', 'square', 'classic', 'widescreen', 'golden'],
      'fit'
    ),
    featureGoals: readBool(row, 'feature_goals'),
    featureSharing: readBool(row, 'feature_sharing'),
    featureScan: readBool(row, 'feature_scan'),
    featureFood: readBool(row, 'feature_food'),
    featureAutomations: readBool(row, 'feature_automations'),
    featureMedicine: readBool(row, 'feature_medicine'),
    featureDayLog: readBool(row, 'feature_day_log'),
    medicineTrayTimes: normalizeTrayTimes(readJson<unknown>(row, 'medicine_tray_times', DEFAULT_TRAY_TIMES)),
    medicineRemindersEnabled: readBool(row, 'medicine_reminders_enabled'),
    layoutDetail: sanitizeDetailLevel(readStr(row, 'layout_detail', 'normal')),
    cardLayouts: sanitizeCardLayouts(readJson<unknown>(row, 'card_layouts', {})),
    cardStates: sanitizeCardStates(readJson<unknown>(row, 'card_states', {})),
    tourProgress: readStr(row, 'tour_progress', ''),
    habitViewTab: readEnum<HabitViewTab>(row, 'habit_view_tab', ['today', 'week', 'month'], 'today'),
  };
}

/** Settings field → column mapping; booleans/arrays serialised, so update() writes only changed columns. */
const bool = (v: boolean) => (v ? 1 : 0);
const SETTINGS_COLUMNS: FieldMap<Settings> = {
  userName: { col: 'user_name' },
  weeklyResetDay: { col: 'weekly_reset_day' },
  monthlyResetDate: { col: 'monthly_reset_date' },
  remindersEnabled: { col: 'reminders_enabled', to: bool },
  reminderTime: { col: 'reminder_time' },
  taskNotificationsEnabled: { col: 'task_notifications_enabled', to: bool },
  setupComplete: { col: 'setup_complete', to: bool },
  firstRunComplete: { col: 'first_run_complete', to: bool },
  startScreen: { col: 'start_screen' },
  workModeEnabled: { col: 'work_mode_enabled', to: bool },
  workHoursStart: { col: 'work_hours_start' },
  workHoursEnd: { col: 'work_hours_end' },
  enforceWorkHours: { col: 'enforce_work_hours', to: bool },
  workDays: { col: 'work_days', to: (v) => JSON.stringify(v) },
  showGrowth: { col: 'show_points', to: bool },
  showHints: { col: 'show_hints', to: bool },
  language: { col: 'language' },
  holidaysEnabled: { col: 'holidays_enabled', to: bool },
  darkMode: { col: 'dark_mode' },
  childProfiles: { col: 'child_profiles', to: (v) => JSON.stringify(v) },
  reducedMotion: { col: 'reduced_motion', to: bool },
  particlesEnabled: { col: 'particles_enabled', to: bool },
  glassSurfaces: { col: 'glass_surfaces', to: bool },
  fontSize: { col: 'font_size' },
  leftHanded: { col: 'left_handed', to: bool },
  persistentNotifEnabled: { col: 'persistent_notif_enabled', to: bool },
  quietHoursEnabled: { col: 'quiet_hours_enabled', to: bool },
  quietHoursStart: { col: 'quiet_hours_start' },
  quietHoursEnd: { col: 'quiet_hours_end' },
  monthlyBudgetNok: { col: 'monthly_budget_nok' },
  debugModeEnabled: { col: 'debug_mode_enabled', to: bool },
  lastMonthlyReset: { col: 'last_monthly_reset' },
  habitNotificationsEnabled: { col: 'habit_notifications_enabled', to: bool },
  locationEnabled: { col: 'location_enabled', to: bool },
  backgroundLocationEnabled: { col: 'background_location_enabled', to: bool },
  calendarSyncEnabled: { col: 'calendar_sync_enabled', to: bool },
  voiceNotesEnabled: { col: 'voice_notes_enabled', to: bool },
  contactsEnabled: { col: 'contacts_enabled', to: bool },
  deviceCalendarId: { col: 'device_calendar_id' },
  accountName: { col: 'account_name' },
  accountCreated: { col: 'account_created' },
  childMode: { col: 'child_mode', to: bool },
  childModePasswordSet: { col: 'child_mode_password_set', to: bool },
  deviceId: { col: 'device_id' },
  lanSyncEnabled: { col: 'lan_sync_enabled', to: bool },
  autoBackupEnabled: { col: 'auto_backup_enabled', to: bool },
  autoBackupUri: { col: 'auto_backup_uri' },
  autoBackupLabel: { col: 'auto_backup_label' },
  autoBackupLastAt: { col: 'auto_backup_last_at' },
  schoolModeEnabled: { col: 'school_mode_enabled', to: bool },
  peopleModeEnabled: { col: 'people_mode_enabled', to: bool },
  freyrModeEnabled: { col: 'freyr_mode_enabled', to: bool },
  freyrSeedIds: { col: 'freyr_seed_ids' },
  planTimelineHorizontal: { col: 'plan_timeline_horizontal', to: bool },
  seenScreenHints: { col: 'seen_screen_hints', to: (v) => JSON.stringify(v) },
  homeCardOrder: { col: 'home_card_order', to: (v) => JSON.stringify(v) },
  energySystemEnabled: { col: 'energy_system_enabled', to: bool },
  energyDailyCapacity: { col: 'energy_daily_capacity' },
  energyWeeklyCapacity: { col: 'energy_weekly_capacity' },
  energyMode: { col: 'energy_mode' },
  energyCustomCapacities: { col: 'energy_custom_capacities', to: (v) => JSON.stringify(v) },
  lifetimeCompletedTasks: { col: 'lifetime_completed_tasks' },
  lifetimeGrowth: { col: 'lifetime_bonsai_points' },
  photoAspectRatio: { col: 'photo_aspect_ratio' },
  featureGoals: { col: 'feature_goals', to: bool },
  featureSharing: { col: 'feature_sharing', to: bool },
  featureScan: { col: 'feature_scan', to: bool },
  featureFood: { col: 'feature_food', to: bool },
  featureAutomations: { col: 'feature_automations', to: bool },
  featureMedicine: { col: 'feature_medicine', to: bool },
  featureDayLog: { col: 'feature_day_log', to: bool },
  medicineTrayTimes: { col: 'medicine_tray_times', to: (v) => JSON.stringify(v) },
  medicineRemindersEnabled: { col: 'medicine_reminders_enabled', to: bool },
  layoutDetail: { col: 'layout_detail' },
  cardLayouts: { col: 'card_layouts', to: (v) => JSON.stringify(v) },
  cardStates: { col: 'card_states', to: (v) => JSON.stringify(v) },
  tourProgress: { col: 'tour_progress' },
  habitViewTab: { col: 'habit_view_tab' },
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  userName: '',
  weeklyResetDay: 0,
  monthlyResetDate: 1,
  remindersEnabled: false,
  reminderTime: '08:00',
  taskNotificationsEnabled: false,
  setupComplete: false,
  firstRunComplete: false,
  // Safe, working default applied BEFORE the first-run flow ever renders — the flow reads
  // it back as its starting selection rather than establishing it (handoff invariant 1).
  startScreen: 'home' as StartScreen,
  workModeEnabled: false,
  workHoursStart: '07:00',
  workHoursEnd: '17:00',
  enforceWorkHours: false,
  workDays: [0, 1, 2, 3, 4],
  showGrowth: false,
  showHints: true,
  language: 'no' as Language,
  holidaysEnabled: true,
  // Decision 035: fresh-install default is light ('off'); 'system'/'on' are opt-in.
  // Stored user choices are preserved — load() reads dark_mode with an 'off' fallback,
  // so this default only applies when there's no settings row yet.
  darkMode: 'off' as DarkMode,
  childProfiles: [],
  reducedMotion: false,
  particlesEnabled: true,
  glassSurfaces: true,
  fontSize: 'default' as FontSizePref,
  leftHanded: false,
  persistentNotifEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
  monthlyBudgetNok: 0,
  debugModeEnabled: false,
  lastMonthlyReset: '',
  habitNotificationsEnabled: true,
  locationEnabled: false,
  backgroundLocationEnabled: false,
  calendarSyncEnabled: false,
  voiceNotesEnabled: true,
  contactsEnabled: false,
  deviceCalendarId: '',
  accountName: '',
  accountCreated: '',
  childMode: false,
  childModePasswordSet: false,
  deviceId: '',
  lanSyncEnabled: false,
  autoBackupEnabled: false,
  autoBackupUri: '',
  autoBackupLabel: '',
  autoBackupLastAt: '',
  schoolModeEnabled: false,
  peopleModeEnabled: false,
  freyrModeEnabled: false,
  freyrSeedIds: '',
  planTimelineHorizontal: false,
  seenScreenHints: [],
  homeCardOrder: ['plans', 'habits', 'notes', 'shopping'],
  energySystemEnabled: true,
  energyDailyCapacity: 10,
  energyWeeklyCapacity: 50,
  energyMode: 'daily' as EnergyMode,
  energyCustomCapacities: [10, 10, 10, 10, 10, 10, 10],
  lifetimeCompletedTasks: 0,
  lifetimeGrowth: 0,
  photoAspectRatio: 'fit' as AspectRatioKey,
  // Feature flag defaults. These only apply before load() resolves the real row, and
  // the app doesn't render past the `loaded` gate until it has — so a user whose
  // flags differ from these never sees a flash of the wrong state. featureGoals
  // matches energySystemEnabled's on-by-default (both stay real toggles); Sharing and
  // Automations stay off-by-default opt-ins; Scan/Food are true because they're
  // permanently on and unread by any gate (see the Settings type's per-field docs).
  featureGoals: true,
  featureSharing: false,
  featureScan: true,
  featureFood: true,
  featureAutomations: false,
  featureMedicine: true,
  featureDayLog: true,
  medicineTrayTimes: DEFAULT_TRAY_TIMES,
  medicineRemindersEnabled: true,
  // 'normal' reproduces the pre-2026-07-27 rendering of every surface exactly, so an
  // upgrading user sees no change until they pick one.
  layoutDetail: 'normal' as DetailLevel,
  cardLayouts: {},
  // Empty = every surface follows 'preview' (lib/padState's DEFAULT_PAD_STATE), which is
  // roughly the card an upgrading user already has.
  cardStates: {},
  tourProgress: '',
  habitViewTab: 'today' as HabitViewTab,
  loaded: false,
  workModeSessionOverride: false,

  load() {
    const settings = loadFirst('settings', rowToSettings, { where: 'id = 1' });
    set(settings ? { ...settings, loaded: true } : { loaded: true });
    // Self-heal: a fresh install (or one that predates Decision 038 wiring) has no
    // device_id yet. Generate one once and persist it immediately so it's stable
    // across relaunches — every peer that pairs with this install remembers THIS id.
    if (settings && !settings.deviceId) {
      const deviceId = generateId();
      set({ deviceId });
      try {
        updateRow('settings', rowValues({ deviceId }, SETTINGS_COLUMNS), 'id = 1');
      } catch {
        // DB write failed — deviceId still set in memory for this session
      }
    }
  },

  update(patch) {
    set((s) => {
      const next = { ...s, ...patch };
      try {
        // Writes only the columns present in `patch` (was a 43-column rewrite per call).
        updateRow('settings', rowValues(patch, SETTINGS_COLUMNS), 'id = 1');
      } catch (e) {
        // DB write failed (e.g. column not yet migrated) — state still updates in memory,
        // but log so a setting silently lost on restart is visible instead of invisible.
        logDbError(`useSettingsStore.update(${Object.keys(patch).join(',')})`, e);
      }
      return next;
    });
  },

  setWorkModeSessionOverride(v) {
    set({ workModeSessionOverride: v });
  },

  markScreenHintSeen(key) {
    set((s) => {
      if (s.seenScreenHints.includes(key)) return s;
      const seenScreenHints = [...s.seenScreenHints, key];
      try {
        updateRow('settings', rowValues({ seenScreenHints }, SETTINGS_COLUMNS), 'id = 1');
      } catch (e) {
        logDbError(`useSettingsStore.markScreenHintSeen(${key})`, e);
      }
      return { ...s, seenScreenHints };
    });
  },
}));
