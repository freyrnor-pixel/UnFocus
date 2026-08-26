/**
 * settings.tsx — app settings
 *
 * Tabbed settings screen (Decision 001 tier='sub') — a non-scrolling 3-tab bar
 * (General | Personal | Advanced) sits directly under the header as ScreenScaffold's
 * `stickyBelowHeader`; each tab is its own scroll of cards (local `tab` state, no
 * router routes).
 *
 * - General — what people actually open Settings to change: You group ([Profile (name +
 *   language) / Appearance (dark mode, text size)] one merged panel) → Notifications (one
 *   flat card: plan, habit, medicine, weekly + time, persistent overview, quiet hours +
 *   times) → Layout (detail level, horizontal plans timeline, starting screen, re-run
 *   setup) → Send Feedback.
 * - Personal — configured once, rarely revisited: Accessibility (reduced motion, particles,
 *   glass surfaces, left-handed, show tips again) → Shopping (weekly reset weekday, monthly
 *   reset date — the `?section=shopping` deep-link target) → Device features
 *   (voice/contacts/location/calendar + which calendars the timeline may read).
 * - Advanced — Features card (the Energy/Rewards mode SegmentedControl, then Energy's own
 *   mode + capacities when Energy mode is on, then the FEATURE_ROWS flags, then the
 *   Automations link when that flag is on) → [People/family + Paired devices] one merged
 *   panel, rendered only while SHARING_VISIBLE → Tags → Data group ([Backup & restore /
 *   Version & updates] one merged panel) → the destructive Reset data card → Debug mode
 *   (which also carries the Design Lab link while debug is on).
 *
 * **Declutter + reorganization (2026-08-17)**, on three instructions: remove settings that
 * are not useful, move the most useful to the first page, and never wrap a container around a
 * single setting without it being obvious what that setting relates to.
 *   1. **Five things removed.** Each is recorded at its old call site, in full, with the
 *      evidence — read those before restoring one.
 *      - **Photo format** (a five-option picker): its only consumer, components/PhotoFrame.tsx,
 *        has exactly one caller, app/budget.tsx, which hard-codes `square` and documents that
 *        it ignores the global default. The control had never changed anything on screen.
 *      - **Solid cards** (`opaqueCards`): a second, narrower switch over the same idea as
 *        Accessibility's `glassSurfaces`, in a different card, silently overridden by it.
 *      - **Local account** (`accountName`/`accountCreated`): "Create local account" stamped a
 *        name and a date that nothing in the app ever read. The card is named for the backup
 *        file it actually manages now.
 *      - **Sample data** (`freyrMode*`): demo seeding from before real users were on the app.
 *      - **The Design Lab's own switch** (`featureDesignLab`): folded into Debug mode, which
 *        is the same kind of thing — tooling for reporting back, not a feature to choose.
 *      Every column, Settings field and AI-setup whitelist entry survives untouched (this repo
 *      never drops columns, and pulling a key from the whitelist would be a schema bump) — see
 *      store/useSettingsStore.ts's "Inert columns" note.
 *   2. **Notifications and Layout moved to General**, Accessibility moved to Personal, and
 *      Data (backup, version, resets) moved to Advanced. Send Feedback stayed on General.
 *   3. **Three single-setting containers flattened.** The weekly reminder was its own
 *      DisclosureRow holding one switch beside a second card holding the other five, so
 *      Notifications is one flat card now; Tags was the middle card of a panel whose other two
 *      cards are hidden with SHARING_VISIBLE, so it is its own card; and Energy's capacity
 *      steppers were a separate group from the picker that governs them, so they are inside it.
 *
 * ⚠️ **scripts/preview.mjs, scripts/measure-wraps.mjs and scripts/screenshot-states.mjs all
 * reach /design-lab through this screen** and flip DEBUG MODE to do it since that pass.
 *
 * **Reorganization (2026-07-25)**: was four tabs (Generelt | Handle | Varsler | Modi) where
 * Generelt alone carried eight unrelated groups and Handle carried exactly two settings.
 * Three things changed beyond the regrouping:
 *   1. **Dead settings removed.** Work mode (active/auto-activate/hours/work days/Norwegian
 *      holidays), School mode and Parent (child) mode all had switches writing settings
 *      columns that NOTHING in the app read. Their UI is gone; the columns stay (this repo
 *      never drops columns) — see store/useSettingsStore.ts's "Inert columns" note.
 *   2. **Feature flags added, then their defaults revised the same day.** Goals, Sharing &
 *      QR, Scan & receipts, Food & recipes and Automations first shipped as flags all off
 *      on a fresh install. Maintainer feedback flipped this same-day: Energy and Goals now
 *      default ON but stay real toggles (Goals in FEATURE_ROWS below; Energy is a two-mode
 *      SegmentedControl since 2026-08-02 — see the "Energy is two peer modes" note below);
 *      Scan & receipts and Food & recipes are permanently on and no longer toggles at all
 *      (removed from FEATURE_ROWS — see store/useSettingsStore.ts's "Inert columns" note);
 *      Sharing & QR and Automations are the only two still off-by-default opt-ins.
 *   3. Only purely ADDITIVE things ever got a toggle in the first place — anything whose
 *      absence would break app logic (data pruning, widget/overview sync, catalog seeding,
 *      the automation store's boot load) is deliberately still unconditional.
 *
 * Every setting applies immediately via applyAndSync() — no buffered/dirty save step (matches
 * hints.settings.text: "Changes apply immediately.").
 *
 * **Layering pass (2026-07-13)**: related setting groups that used to each float in their own
 * bordered/shadowed Surface card are now merged into ONE shared Surface holding several
 * `DisclosureRow` rows (Profil+Utseende+Tilgjengelighet; Local account+Version & updates;
 * Personer/familie+Paired devices; Ukentlig+Generelle) — fewer separate
 * floating "islands" reads as one cohesive panel instead of a stack of unrelated boxes. This
 * is exactly the grouping pattern DisclosureRow's own header already documents (Decision 043
 * rule 1 / WeekListCard's dish-group rows) — multiple DisclosureRows as siblings inside one
 * caller-owned Surface, each getting its own hairline top divider for separation. Destructive
 * (Reset data) and single-toggle cards with no accordion body (Debug mode, Sample data, the
 * Layout row) stay their own standalone card — folding a warning-red destructive card into a
 * neutral panel would bury its visual distinctiveness, and a plain toggle has nothing to
 * collapse.
 *
 * **Visual-audit pass (2026-07-23)**: the top-level merged-panel `DisclosureRow`s above now
 * pass `rounded` — each row gets its own rounded, sunken (theme.surfaceMuted) tile with a small
 * gap instead of the flush hairline divider, reading as a stack of rows rather than one flat
 * slab (screenshot feedback: "setting rows not rounded"). Also: the tab bar (`tabBar`/`tabsGlass`)
 * now floats with the same side margins + Radius.lg rounding as the header's own floated card
 * (was edge-to-edge/square, mismatched once the header started floating — read as a glitchy seam);
 * `stickyGapColor` switched from an opaque `theme.surface` to `"transparent"` to match the
 * header's own transparent float gaps; the lone `SectionDivider` before the Data group zeroed
 * its own margin (content's `gap` was double-stacking with the divider's default margin, reading
 * as a huge blank band — that component was deleted app-wide on 2026-08-19, see below); and the
 * tab labels pass `radius={Radius.md}` to TabSlider for a squarer
 * segmented-control shape instead of a full pill (Plans/Shopping keep the default pill).
 *
 * Connections:
 *   Imports → components/AppModal (showAppModal + confirmDestructive), components/SettingRow
 *             (ToggleRow + SettingLinkRow — every switch row and every "go to this screen" row
 *             on this screen; they were written out by hand 23 times, ~160 lines, until
 *             2026-08-12), components/ConfirmationBanner, components/FormControls,
 *             components/ScreenScaffold, components/Surface,
 *             components/DisclosureRow, components/PressableScale, components/TabSlider,
 *             components/AiSetupPreviewModal, constants/theme, lib/domainColor, lib/backup
 *             (exportBackup/exportBackupToDevice/pickAndParseBackup/restoreBackup/reloadApp/
 *             saveAutoBackup/chooseAutoBackupLocation), lib/aiSetupGuide
 *             (exportAiSetupGuide/exportAiSetupGuideToDevice/pickAndParseAiSetupFile),
 *             lib/aiSetupApply (previewAiSetupConfig/applyAiSetupConfig), lib/feedbackMail, lib/freyrModeSeed,
 *             lib/haptics, lib/i18n, lib/notifications, lib/reminders, lib/syncService,
 *             lib/updateHealth (updateHealth — is this install still being reached by OTA at
 *             all; see the Version & updates card), lib/widgets/sync
 *             (syncWidgetsAndOverview — the persistent-overview toggle refreshes/cancels it, and
 *             the Freyr-mode toggle re-syncs after seeding/unseeding today's tasks + shopping),
 *             lib/medicineNotifications (registerMedicineCategory — relabels the medicine
 *             notification's Taken button on a language change),
 *             lib/useAppTheme, store/useFeedbackStore, store/useHabitStore, store/useMedicineStore
 *             (syncTrayReminders), store/useSettingsStore,
 *             store/useShoppingStore, store/useTagStore (the Tags card — rename/remove the
 *             household's shared tag vocabulary), store/useTaskStore
 *   Used by → Expo Router route "/settings" (linked from ScreenHeader's gear icon, tier='site')
 *   Data    → useSettingsStore (settings table; incl. energyMode/energy*Capacity, quietHours*,
 *             monthlyResetDate, taskNotificationsEnabled, habitNotificationsEnabled,
 *             persistentNotifEnabled, voiceNotesEnabled/contactsEnabled/locationEnabled/
 *             calendarSyncEnabled — the "Device features" card — and the featureGoals/
 *             featureSharing/featureAutomations/featureMedicine toggles); reset actions touch
 *             useTaskStore (tasks) and useShoppingStore (shopping_items via monthlyReset);
 *             re-syncs notifications via syncReminders / syncAllTaskNotifications /
 *             syncAllTaskCalendarEvents / syncAllHabitReminders / syncNotificationCategories;
 *             confirming an uploaded AI setup file (applyAiSetupConfig, lib/aiSetupApply.ts)
 *             can additionally write to useTaskStore, useHabitStore, useGoalStore,
 *             useNotesStore, useShoppingListStore, useShoppingStore, useCatalogStore,
 *             useMealStore, useMonthlyListStore
 *
 * Edit notes:
 *   - **This screen can be linked INTO, at a card (2026-08-14): `/settings?tab=…&section=…`.**
 *     `?tab=` had been passed by app/(tabs)/shopping.tsx's "Nullstillingsdager" link since that
 *     link was written and read by nobody — there was no `useLocalSearchParams` here at all, so
 *     every caller silently landed on General. Two things are worth knowing before adding a
 *     second target. (1) A tab is not enough: every group here is a collapsed `DisclosureRow`,
 *     so the right tab still leaves the control shut and usually off screen — a `section` opens
 *     its card AND scrolls to it, via `ScrollToNodeContext` (components/ScreenScaffold.tsx), and
 *     `?tab=` without `?section=` is a half-answer. (2) `tab` is seeded in the `useState`
 *     INITIALIZER, not synced by an effect, because the target card measures itself on layout
 *     and an effect would let General mount and lay out first. `SettingsSection` is a short
 *     hand-maintained union on purpose: each target costs a ref, an `onLayout` and a controlled
 *     `open` at its call site, so add one when a screen needs it rather than back-filling.
 *   - **Monthly budget moved out (2026-07-22)**: the "handle" tab used to have a Monthly
 *     budget Input here, writing the single global `monthlyBudgetNok` setting. Budget is per
 *     Monthly list now (store/useMonthlyListStore.ts) — edited from that list's own Budget
 *     pill on the Shopping screen's Monthly tab (→ app/budget.tsx), not from Settings. The
 *     `monthlyResetDate` field just above it is unaffected (still one global payday-boundary
 *     date, shared by every list).
 *   - **Tab bar (updated 2026-07-25, never scrollable)**: the 3-tab bar is
 *     `components/TabSlider.tsx` — a single accent pill SLIDES to sit behind whichever
 *     category tab is active, replacing the old per-tab `TabBoxHighlight` boxes. TabSlider has no scroll mode at all (by design
 *     — see its own header), so all three tabs must fit in one row: keep `config.tabs.*`
 *     labels to single short words in BOTH languages ("Personal"/"Personlig",
 *     "Advanced"/"Avansert") so they never need to scroll. Each segment always sizes to its own label
 *     (TabSlider no longer has a fixed-equal-width mode — see its "No `sizing` prop" edit
 *     note), so a translation coming out longer than expected (Norwegian's "Generelt" vs.
 *     English's "General") no longer truncates one tab while the others sit with unused
 *     space. Same shared component as app/(tabs)/shopping.tsx and app/plans.tsx.
 *   - **Personal → Layout also owns first-run's permanent controls (2026-07-30)**: the
 *     "Starting screen" segmented row (settings.startScreen, applied at the next launch
 *     by app/(tabs)/_layout.tsx's initialRouteName) and a "Run setup again" link into
 *     app/onboarding/basics.tsx. The re-run link is deliberately NOT in the red Reset card — it
 *     re-enters the flow seeded from current settings, so walking it and pressing Done
 *     changes nothing. Its option values come from lib/firstRunOptions.ts, shared with
 *     the flow. Motion and text size are reversible via the existing General →
 *     Accessibility switches (reducedMotion + particlesEnabled) and font-size row.
 *   - applyAndSync() is the single write path: updates settings AND fires the right notification
 *     re-sync based on which keys changed — route every settings change through it, never
 *     settings.update() directly. Quiet-hours keys re-sync task notifications; language or
 *     habitNotificationsEnabled changes re-sync habit reminders; a language change also
 *     re-registers the interactive notification action button labels via syncNotificationCategories
 *     (+ registerMedicineCategory). Language/quiet-hours/featureMedicine changes re-sync the
 *     four medicine tray reminders via useMedicineStore.syncTrayReminders — turning the flag
 *     off has to actually cancel them, not just hide the card.
 *   - Plan notifications (taskNotificationsEnabled) and Habit reminders
 *     (habitNotificationsEnabled) are now INDEPENDENT toggles — turning one off no longer
 *     silences the other. (Superseded the Decision 029b merge, which drove both flags from a
 *     single switch and left no way to keep task reminders while muting habit ones.)
 *   - Quiet-hours hint copy (Decision 016 Q4): habit occurrences inside quiet hours are SKIPPED,
 *     not deferred — task reminders still shift past the window. See lib/i18n.ts's
 *     settings.quietHours.hint.
 *   - TimePickerWheel was never ported into this repo — all HH:MM entry uses FormControls.Input
 *     (free-text, matching the precedent set by task-form.tsx / habit-form.tsx).
 *   - Energy's configuration (energyMode + energyDailyCapacity/energyWeeklyCapacity) leads
 *     the Advanced tab's Features card; when on it reveals a Daily/Weekly/Custom
 *     energyMode SegmentedControl. Daily/Weekly reveal their one flat capacity stepper;
 *     Custom reveals a Mon..Sun stepper row (energyCustomCapacities) instead, with the
 *     week capacity derived as their sum. Per-period overrides live on the Home Energy
 *     meter (components/EnergyMeter.tsx), which also hides whichever meter energyMode
 *     doesn't apply to.
 *   - Send Feedback card (2026-07-13): always visible (not gated on debugModeEnabled) — a
 *     free-text composer that builds a mailto: URL (lib/feedbackMail's buildFeedbackMailUrl,
 *     addressed to Unfocus@hlynsson.no, footer includes app/runtime version + platform) and
 *     opens it via Linking.openURL, falling back to RN's Share.share if no mail client is
 *     configured. Separate from the debug-notes export directly below — that's the testers'
 *     anchor-note tool, this is the general "type a message and email it" feature.
 *   - Debug section (2026-07-13 redesign): the toggle, plus — only while it's on — a how-to-use
 *     explainer and a "Reset all notes" button (useFeedbackStore.clearAll(), disabled when there
 *     are none). The actual notes are created elsewhere via components/DebugNoteAnchor.tsx
 *     (long-press any annotated card/header), not from this screen. permissionTests.ts does not
 *     exist in this repo yet — its buttons are NOT wired here; see the commented placeholder below.
 *   - "Reset weekly list" and the Test-data load/clear actions from the pre-rebuild app are NOT
 *     ported: this repo's shopping architecture replaced the single global weekly list with
 *     per-week ShoppingList rows (store/useShoppingListStore.ts, auto-rolling by date), so there
 *     is no equivalent "reset the current weekly list" store action to bind to; lib/seedTestData.ts
 *     also does not exist in this repo. Flagged in PROGRESS_LOG rather than inventing either.
 *   - LAN live sync (Decision 038 app integration): this screen only owns the entry-point card
 *     (description + link) on the Advanced tab — the sync toggle, QR pairing wizard, and paired-
 *     devices list all live on app/pair-device.tsx. syncAvailable (lib/syncService's
 *     isSyncAvailable()) gates whether the card shows the link or an "unavailable" note, since
 *     the native transport modules aren't linked outside a real build.
 *   - **Device features card (2026-07-17)**: four toggles (voice/contacts/location/calendar)
 *     for the reserve-only native surface — all default off, so components/TaskCard.tsx's
 *     mic/contact/location blocks (was app/task-form.tsx's, retired 2026-07-23) stay hidden
 *     and calendar mirroring stays inert until a user opts in here. The other three toggles
 *     were previously unreachable (fully wired in
 *     useSettingsStore but no UI anywhere) — this card is what makes them reachable.
 *   - **Card spacing (2026-07-21)**: `baseStyles.content`'s gap dropped from `Spacing.xl` (32,
 *     Decision 043 rule 2) to `Spacing.lg` (24) — it read as too much dead air between cards
 *     vs. every other screen's `Spacing.md`/`lg` content gap, per direct feedback.
 *   - ~~**Contrast fixes inside `rounded` panels (2026-07-25)**~~ — **moot as of 2026-08-10:
 *     both chips are gone.** `langChip` (the Profil language picker) and `dayChip` (the
 *     weekly-reset-day picker) are `SegmentedControl`s now, so the problem that note described
 *     — an inactive chip filled `theme.surfaceMuted` with no border, invisible inside a
 *     `rounded` `DisclosureRow` that is also `surfaceMuted` — cannot recur: the track draws
 *     its own bordered surface. Kept in the log because it is the reason `peopleChip`/
 *     `peopleAddBtn` carry the borders they do, and those are still hand-rolled.
 *     Both were also exclusive pickers wearing the multi-select chip shape, and the day row
 *     wrapped to two lines on every phone (7 × `minWidth: MIN_TAP_TARGET` + gaps > any card's
 *     inner width) — see the call-site notes.
 *   - **Energy is two peer modes, not a flag (2026-08-02)**: `energySystemEnabled` left
 *     `FEATURE_ROWS` and is drawn at the TOP of the Features card as its own two-option
 *     `SegmentedControl` — **Energy mode** (true) and **Rewards mode** (false), copy under
 *     `t.config.features.energy.modes.*`. The storage is unchanged: still the one boolean,
 *     still the single guard at every energy call site, still in the DB / sync / AI-setup
 *     whitelist. Only the framing changed — Rewards mode is a real choice ("finishing
 *     something fills its check, and that is the whole of it"), NOT "Energy turned off", so
 *     it must never be drawn as the un-set side of a switch. `SegmentedControl` from
 *     components/FormControls.tsx is the right tier here. **The tier rule is now TWO rungs,
 *     not three (2026-08-09)**: anything inside a card/form/editor → `SegmentedControl`
 *     (raised pill); a screen-level view switcher → `TabSlider` (accent pill). The third
 *     rung, `SlideSelector`, is deleted — it was a second form-tier control wearing the
 *     screen tier's accent fill. (This bullet also used to claim app/onboarding/energy.tsx
 *     rendered the same two modes as a SlideSelector "one tier down". It never did, and that
 *     screen stopped offering the choice at all in B1-2 — see app/onboarding/energy.tsx.)
 *   - **Feature toggles live in ONE place (2026-07-25)**: `FEATURE_ROWS` below is the whole
 *     list of plain on/off switches — currently Goals, Sharing & QR, Automations, Medicine,
 *     and Growth (showGrowth over the `show_points` column — see lib/growth.ts).
 *     To add
 *     one: add the flag to store/useSettingsStore.ts, append its `ALTER TABLE` (+ a
 *     back-fill UPDATE if it needs to default differently for existing vs. fresh installs)
 *     to lib/db.ts's migrations array, add a `config.features.*` entry in BOTH languages,
 *     add a line to `FEATURE_ROWS`, and gate the surface it owns at its call site. There
 *     is no longer an onboarding picker to also list it in — app/onboarding/features.tsx
 *     was deleted (2026-07-31, B1-1), so THIS card is the only place a flag is offered
 *     and an off-by-default flag must be one a fresh install is fine without. Only add a flag for
 *     something ADDITIVE — if the app misbehaves with it off, it does not get a toggle. Not
 *     every flag needs to stay a toggle forever: Scan & receipts and Food & recipes were
 *     removed from this list the same day they were added, once the maintainer decided both
 *     should just always be on — see store/useSettingsStore.ts's "Inert columns" note for
 *     how to retire one the same way (unconditional migration UPDATE, un-gate every call
 *     site, drop the FEATURE_ROWS/onboarding-picker row, keep the DB column).
 *   - **A control that names itself gets no line under it (2026-08-15)**, the same "no manual"
 *     rule the 💡 explainer pass applied to the cards (AGENTS.md, 2026-08-17). Maintainer:
 *     the language row telling you what changing the language means is redundant. Seven lines
 *     went, and the STRINGS went with them rather than the call sites alone, so nothing can be
 *     quietly rewired: `config.desc.language`, `settings.photoFormat.hint`,
 *     `settings.accessibility.reducedMotionHint`, `habitNotificationsHint`,
 *     `restoreHintsBody`, `config.layouts.hint` and `config.features.intro`.
 *     `peopleMode.profilesHint` was cut to its second half ("Tap a colour to change it") —
 *     its first sentence repeated the `peopleMode.hint` two rows above it verbatim, and the
 *     surviving half is also the colour dot's accessibility label.
 *     **The test is whether the line carries a FACT the label cannot**, not whether it is
 *     short: `config.desc.name` (never leaves your phone), `medicineNotificationsHint` (one
 *     per tray, with a Taken button), `glassSurfacesHint`, `quietHours.hint`,
 *     `config.desc.monthlyResetDate` (short months) and every `config.desc.dataNote`-style
 *     warning stay, as do the per-option hints that CHANGE with the selection
 *     (`config.layouts[level].hint`, `features.energy.modes.*.hint`) — those describe the
 *     option you picked, which no label can. `components/SettingRow.tsx`'s `hint` is already
 *     optional and documented as "omit where the name says everything"; dropping the prop is
 *     the sanctioned shape, not a special case.
 */
import React, { useState, useMemo, useEffect, useContext, useRef, useCallback } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { updateHealth } from '@/lib/updateHealth';
import ScreenScaffold, { ScrollToNodeContext } from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import DisclosureRow from '@/components/DisclosureRow';
import { Input, SegmentedControl } from '@/components/FormControls';
import { SettingLinkRow, ToggleRow } from '@/components/SettingRow';
import { confirmDestructive, showAppModal } from '@/components/AppModal';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import PressableScale from '@/components/PressableScale';
import Stepper from '@/components/Stepper';
import {
  useSettingsStore,
  Settings,
  FontSizePref,
  DarkMode,
  EnergyMode,
  Language,
} from '@/store/useSettingsStore';
import { DeviceCalendarInfo, listDeviceCalendars } from '@/lib/deviceCalendar';
import { DETAIL_LEVELS, type DetailLevel } from '@/lib/cardLayout';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useMedicineStore } from '@/store/useMedicineStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { usePeopleStore } from '@/store/usePeopleStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { useTagStore } from '@/store/useTagStore';
import { PersonDot } from '@/components/PersonChip';
import { PERSON_PALETTE, paletteColorAt, personColor } from '@/lib/personColor';
import { syncReminders } from '@/lib/reminders';
import { registerMedicineCategory } from '@/lib/medicineNotifications';
import { registerHabitCategory } from '@/lib/habitNotifications';
import { requestPermissions, syncNotificationCategories } from '@/lib/notifications';
import { syncWidgetsAndOverview } from '@/lib/widgets/sync';
import { exportBackup, exportBackupToDevice, pickAndParseBackup, restoreBackup, reloadApp, saveAutoBackup, chooseAutoBackupLocation } from '@/lib/backup';
import { exportAiSetupGuide, exportAiSetupGuideToDevice, pickAndParseAiSetupFile, AiSetupConfig } from '@/lib/aiSetupGuide';
import { previewAiSetupConfig, applyAiSetupConfig } from '@/lib/aiSetupApply';
import AiSetupPreviewModal from '@/components/AiSetupPreviewModal';
import { isSyncAvailable } from '@/lib/syncService';
import { buildFeedbackMailUrl } from '@/lib/feedbackMail';
import { useT, getTranslations } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { selection, heavy } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing, Type, MIN_TAP_TARGET, HitSlop } from '@/constants/theme';
import TabSlider, { TAB_SLIDER_HEIGHT } from '@/components/TabSlider';

/**
 * Every switch on this screen that turns a notification ON, and therefore needs the OS
 * permission to exist before its scheduler runs (see applyAndSync). Kept as one list because
 * the failure it prevents is silent on all five: `scheduleNotificationAsync` rejects without
 * POST_NOTIFICATIONS and lib/notifications.ts swallows the rejection by design, so a missing
 * entry here reads as "the toggle is on and nothing happens" rather than as an error.
 *
 * ⚠️ Add a new notification toggle to this list in the same edit that adds the row.
 */
const NOTIF_SWITCHES = [
  'remindersEnabled',
  'taskNotificationsEnabled',
  'habitNotificationsEnabled',
  'medicineRemindersEnabled',
  'persistentNotifEnabled',
] as const satisfies readonly (keyof Settings)[];

type SettingsTab = 'general' | 'personal' | 'advanced';
/** Runtime companion to `SettingsTab`, so a `?tab=` param can be validated rather than cast. */
const SETTINGS_TABS: readonly SettingsTab[] = ['general', 'personal', 'advanced'] as const;

/**
 * A card on this screen that something else can link straight to, via `?section=`.
 *
 * Deliberately a short, hand-maintained list rather than "any card": a section has to open its
 * `DisclosureRow` AND hand a ref to `scrollToNode`, so each one is a couple of lines at the
 * call site. Add an entry when a screen genuinely needs to point at a setting; don't back-fill
 * the whole screen.
 */
type SettingsSection = 'shopping';
// From TabSlider itself since 2026-08-10 — this was 48 against a real 46, a 2px surplus that
// `tabsGlass`'s justifyContent:'center' split around the pill. See TAB_SLIDER_HEIGHT's doc.
const TAB_BAR_HEIGHT = TAB_SLIDER_HEIGHT;

/**
 * The plain on/off feature toggles rendered by Advanced → Features. Each `key` is a
 * boolean on Settings that gates a purely ADDITIVE surface — see the per-field docs in
 * store/useSettingsStore.ts for what each one hides.
 *
 * `copy` takes the translations object rather than a resolved string because this array
 * is module-level (evaluated once) while `useT()` re-runs on every language change —
 * resolving here would freeze the labels in whatever language loaded first.
 *
 * The Energy system IS in this list again (2026-07-31, reversing the 2026-07-26 removal) —
 * only its master switch. Its own configuration (mode + capacities) is a separate,
 * hand-rendered section ABOVE these rows, since a plain on/off row can't hold steppers.
 *
 * **Scan & receipts and Food & recipes are NOT here (2026-07-25 defaults revision)** —
 * both used to be toggles in this list but are now permanently on, like Habits/Health,
 * so there's nothing left to switch. Only list a flag here if it's still a REAL,
 * off-by-default (or at least switchable) choice — see store/useSettingsStore.ts's
 * "Inert columns" note for why their fields still exist.
 *
 * **There is no onboarding picker any more (2026-07-31, B1-1)** —
 * app/onboarding/features.tsx used to offer Sharing and Automations during onboarding and
 * was deleted, so this list is the sole surface for every flag. That makes each default a
 * standalone decision: a new user meets whatever the migrations in lib/db.ts leave them on
 * and is never asked. Don't add an off-by-default flag whose surface a first-time user
 * would look for and not find.
 */
type FeatureFlagKey =
  | 'featureGoals'
  | 'featureSharing'
  | 'featureAutomations'
  | 'featureMedicine'
  | 'featureDayLog'
  | 'featureTaskDecay'
  | 'showGrowth';
const FEATURE_ROWS: { key: FeatureFlagKey; copy: (t: ReturnType<typeof useT>) => { label: string; hint: string } }[] = [
  { key: 'featureGoals', copy: (t) => t.config.features.goals },
  // Sharing & QR — omitted while the single-user basics are reworked (2026-08-05, see
  // lib/sharingVisibility.ts). The flag itself is untouched and still defaults off; this is
  // the row that would let it be turned back ON, so it goes with the surfaces it reveals.
  ...(SHARING_VISIBLE
    ? [{ key: 'featureSharing' as const, copy: (t: ReturnType<typeof useT>) => t.config.features.sharing }]
    : []),
  { key: 'featureAutomations', copy: (t) => t.config.features.automations },
  { key: 'featureMedicine', copy: (t) => t.config.features.medicine },
  { key: 'featureDayLog', copy: (t) => t.config.features.dayLog },
  { key: 'featureTaskDecay', copy: (t) => t.config.features.taskDecay },
  // NOTE: `energySystemEnabled` deliberately does NOT live here (2026-08-02). It is a
  // two-mode SegmentedControl at the top of the same card — Energy mode / Rewards mode —
  // because the false side is a named peer, not an absence. Re-adding it as a switch would
  // re-frame Rewards mode as "Energy off". See this file's header note.
  { key: 'showGrowth', copy: (t) => t.config.features.growth },
];

/** The two peer modes over the one `settings.energySystemEnabled` boolean. */
type EnergyModeChoice = 'energy' | 'rewards';

/** Format an ISO auto-backup timestamp as "YYYY-MM-DD HH:MM" (local time). */
function formatBackupTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const featureDayLog = settings.featureDayLog;
  // The device's calendars, for the read-visibility picker below. Loaded once on mount and
  // ONLY if access is already held — listDeviceCalendars() never prompts. Settings is not
  // where a permission gets asked for; that happens contextually when the timeline is first
  // opened (lib/useCalendarEvents.ts). An empty list simply hides the picker.
  const [deviceCalendars, setDeviceCalendars] = useState<DeviceCalendarInfo[]>([]);
  useEffect(() => {
    let cancelled = false;
    listDeviceCalendars().then((cals) => {
      if (!cancelled) setDeviceCalendars(cals);
    });
    return () => { cancelled = true; };
  }, []);
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const syncTaskNotifs = useTaskStore((s) => s.syncAllTaskNotifications);
  const syncTaskCalendarEvents = useTaskStore((s) => s.syncAllTaskCalendarEvents);
  const syncHabitNotifs = useHabitStore((s) => s.syncAllHabitReminders);
  const syncMedicineNotifs = useMedicineStore((s) => s.syncTrayReminders);
  const clearTasks = useTaskStore((s) => s.clearAll);
  const people = usePeopleStore((s) => s.people);
  const addPerson = usePeopleStore((s) => s.add);
  const updatePerson = usePeopleStore((s) => s.update);
  const removePerson = usePeopleStore((s) => s.remove);
  // Tags (2026-07-28) — the shared vocabulary. Created from a task, but renamed and
  // removed here, since neither belongs in the middle of editing a to-do.
  const tags = useTagStore((s) => s.tags);
  const renameTag = useTagStore((s) => s.rename);
  const removeTag = useTagStore((s) => s.remove);
  const feedbackNoteCount = useFeedbackStore((s) => s.notes.length);
  const clearFeedbackNotes = useFeedbackStore((s) => s.clearAll);
  const monthlyReset = useShoppingStore((s) => s.monthlyReset);
  const syncAvailable = isSyncAvailable();

  /**
   * Deep link into a particular setting (2026-08-14).
   *
   * `?tab=` was being PASSED by Shopping's "Nullstillingsdager" link since that link was
   * written, and read by nobody — this screen had no `useLocalSearchParams` at all, so the
   * param was silently dropped and every caller landed on General. Maintainer, on device:
   * *"Nullstillingsdager in shopping takes you to settings, but not the actual setting you're
   * looking for."*
   *
   * `?section=` is the second half of the answer, because the right tab is not the same thing
   * as the right control: every group on this screen is a collapsed `DisclosureRow`, so a
   * correct tab still left the two shopping-cadence fields shut and off screen. A section both
   * opens its card and scrolls to it.
   *
   * Shape copied from app/plans.tsx's `tab` + `expandTaskId` pair, the repo's existing
   * precedent for arriving at one row of a screen.
   */
  const { tab: tabParam, section: sectionParam } = useLocalSearchParams<{
    tab?: SettingsTab;
    section?: SettingsSection;
  }>();
  const [tab, setTab] = useState<SettingsTab>(
    // Seeded in the initializer rather than synced by an effect: setting it after the first
    // render would mount General's whole tab and throw it away, and the target card's
    // `onLayout` would fire against a screen the user never sees.
    () => (tabParam && SETTINGS_TABS.includes(tabParam) ? tabParam : 'general'),
  );
  /**
   * The linked-to card is open while `openSection` names it, and hands control straight back:
   * `onToggle` clears it, so the FIRST tap on that header closes the card exactly as it would
   * on any other visit. A `?section=` that stayed latched would make its card the one on this
   * screen the user could not shut.
   */
  const [openSection, setOpenSection] = useState<SettingsSection | null>(
    () => (sectionParam === 'shopping' ? 'shopping' : null),
  );
  const scrollToNode = useContext(ScrollToNodeContext);
  const sectionNode = useRef<View | null>(null);
  // Fires once the linked-to card has laid out. `onLayout` rather than an effect on mount,
  // because the card's y is only meaningful after its tab's content has been measured — and on
  // the deep-link path this screen mounts straight onto that tab (see the `tab` initializer).
  const onSectionLayout = useCallback(() => {
    if (!openSection) return;
    scrollToNode?.(sectionNode.current);
  }, [openSection, scrollToNode]);

  const [name, setName] = useState(settings.userName);
  const [monthlyDateInput, setMonthlyDateInput] = useState(String(settings.monthlyResetDate));
  // Send Feedback (2026-07-13) — free-text composer, mailed via mailto:.
  const [feedbackText, setFeedbackText] = useState('');
  const [newChildName, setNewChildName] = useState('');
  // In-flight tag renames, keyed by tag id. Only holds a tag while its field is focused —
  // the entry is dropped on blur so the row falls back to the store's own name.
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [inputWarning, setInputWarning] = useState<string | null>(null);

  // AI setup guide (download/upload) — lib/aiSetupGuide.ts + lib/aiSetupApply.ts.
  // aiSetupConfig is the parsed-but-not-yet-applied config; non-null shows the
  // preview sheet. aiSetupPreview is derived (dry-run) from it so the preview can
  // never disagree with what applyAiSetupConfig() actually writes on confirm.
  const [aiSetupConfig, setAiSetupConfig] = useState<AiSetupConfig | null>(null);
  const [aiSetupStale, setAiSetupStale] = useState(false);
  const aiSetupPreview = useMemo(() => (aiSetupConfig ? previewAiSetupConfig(aiSetupConfig) : null), [aiSetupConfig]);

  // People / family mode — person management (moved here from the Health screen so
  // Tasks + Habits share one list). Backed by the People registry (store/usePeopleStore.ts)
  // since 2026-07-28: rows with stable ids and colours, not `settings.childProfiles` names.
  function addProfile() {
    const nm = newChildName.trim();
    if (!nm || people.some((p) => p.name === nm)) { setNewChildName(''); return; }
    selection();
    addPerson(nm);
    setNewChildName('');
  }
  function removeProfile(id: string, name: string) {
    confirmDestructive({
      title: t.peopleMode.removeTitle(name),
      message: t.peopleMode.removeBody,
      confirmLabel: t.resetConfirmBtn,
      onConfirm: () => removePerson(id),
    });
  }
  /** Remove a tag. Its tasks keep everything else — useTagStore.remove() rewrites their
   *  `tag_ids` in the same transaction as the tombstone. */
  function removeTagWithConfirm(id: string, name: string) {
    confirmDestructive({
      title: t.tags.removeTitle(name),
      message: t.tags.removeBody,
      confirmLabel: t.resetConfirmBtn,
      onConfirm: () => removeTag(id),
    });
  }
  /** Advance a person to the next palette hue. The colour is auto-assigned at creation, so
   *  this is the only way to resolve two people who happened to land on the same one. */
  function cycleColor(id: string, current: string) {
    const at = PERSON_PALETTE.indexOf(current as (typeof PERSON_PALETTE)[number]);
    selection();
    updatePerson(id, { color: paletteColorAt(at + 1) });
  }

  // Manually check the EAS preview channel for a newer OTA, fetch it, and reload.
  // In debug builds Updates.isEnabled is false (expo-updates is off), so this
  // reports that OTA is unavailable rather than silently doing nothing.
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // isUpdatePending: an update already finished downloading (expo-updates auto-downloads on
  // launch but applies only on the next cold start) and is waiting for a reload. Without this
  // branch, checkForUpdateAsync returns isAvailable:false for it and we'd wrongly report
  // "up to date" while the app is still running the old bundle.
  const { isUpdatePending } = Updates.useUpdates();
  async function handleCheckUpdates() {
    if (!Updates.isEnabled) {
      showAppModal(t.version.title, t.version.disabled);
      return;
    }
    setCheckingUpdate(true);
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();
        showAppModal(t.version.title, t.version.downloaded);
        await Updates.reloadAsync();
      } else if (isUpdatePending) {
        // Newest update already downloaded on a prior launch — just apply it.
        showAppModal(t.version.title, t.version.downloaded);
        await Updates.reloadAsync();
      } else if (health.kind === 'stale' && health.ageDays !== null) {
        // "Up to date" is true here and useless: the server has nothing for THIS runtime, which
        // is the same answer a stranded install gets. Say which runtime was asked about, and
        // that a new runtime needs installing rather than updating.
        showAppModal(t.version.title, t.version.upToDateStale(health.ageDays, runtimeVersion));
      } else {
        showAppModal(t.version.title, t.version.upToDate);
      }
    } catch {
      showAppModal(t.version.title, t.version.failed);
    } finally {
      setCheckingUpdate(false);
    }
  }

  const TABS: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: t.config.tabs.general },
    { key: 'personal', label: t.config.tabs.personal },
    { key: 'advanced', label: t.config.tabs.advanced },
  ];

  const DAY_LABELS = t.dayFull;

  // Version / update diagnostics (expo-updates + expo-constants). All are plain
  // module constants for the running JS, so reading them at render is cheap.
  const appVersion = Constants.expoConfig?.version ?? '—';
  const runtimeVersion = String(Updates.runtimeVersion ?? '—');
  const updateChannel = Updates.channel ?? '—';
  const runningEmbedded = Updates.isEmbeddedLaunch;
  const updateSource = runningEmbedded ? t.version.sourceEmbedded : t.version.sourceOta;
  const updateIdShort = Updates.updateId ? Updates.updateId.slice(0, 8) : t.version.embedded;
  const updatePublished = Updates.createdAt ? Updates.createdAt.toLocaleString() : '—';
  // Is this install still being reached by OTA at all? An update only crosses to installs on
  // the matching runtime, so a native bump silently strands every older one — and the app
  // cannot be TOLD that by an update, because the update is what stopped arriving. The age of
  // the running bundle is the only signal left; see lib/updateHealth.ts for why it is a
  // heuristic and why the copy says "probably".
  const health = updateHealth({
    publishedAt: Updates.createdAt,
    updatesEnabled: Updates.isEnabled,
    now: new Date(),
  });

  function applyAndSync(patch: Partial<Settings>) {
    settings.update(patch);
    const keys = Object.keys(patch);

    // Everything a scheduler needs to run AFTER the OS permission exists. Wrapped rather than
    // inline because switching a notification ON without POST_NOTIFICATIONS granted leaves the
    // switch reading as on while nothing ever fires — the schedule calls fail and
    // lib/notifications.ts swallows them by design. This screen never asked: permission was
    // requested at onboarding (app/onboarding/privacy.tsx) and from Home's ⓘ toggles, so
    // anyone who declined then, or who turned notifications off in Android settings later, hit
    // exactly that dead switch here. See NOTIF_SWITCHES below.
    const run = () => {
      if (keys.some((k) => ['remindersEnabled', 'reminderTime', 'weeklyResetDay', 'monthlyResetDate', 'language'].includes(k))) {
        void syncReminders();
      }
      if (keys.some((k) => ['taskNotificationsEnabled', 'language', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd'].includes(k))) {
        syncTaskNotifs();
      }
      if (keys.includes('language') || keys.includes('habitNotificationsEnabled')) {
        syncHabitNotifs();
        if (keys.includes('language')) {
          const tNew = getTranslations(useSettingsStore.getState().language);
          void syncNotificationCategories(tNew.notif.actionDone, tNew.notif.actionRemindLater);
          // Same relabel for the other two categories' buttons — all three are OS-level
          // registrations that keep whatever labels they were last given.
          registerMedicineCategory(useSettingsStore.getState().language);
          registerHabitCategory(useSettingsStore.getState().language);
        }
      }
      // Medicine tray reminders: their content and times are localised/scheduled from the
      // medicine store, so re-sync on a language change, a quiet-hours change, the reminder
      // switch itself, or the feature flag flipping (turning either off must actually cancel
      // the four daily reminders, not just hide the card).
      if (keys.some((k) => ['language', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd', 'featureMedicine', 'medicineRemindersEnabled'].includes(k))) {
        syncMedicineNotifs();
      }
      // The pinned overview is re-posted in place rather than scheduled, so it has no
      // scheduler of its own — `persistentOnly` skips the widget writes, which nothing here
      // changed.
      if (keys.includes('persistentNotifEnabled')) {
        void syncWidgetsAndOverview({ persistentOnly: true });
      }
    };

    if (keys.includes('calendarSyncEnabled')) {
      syncTaskCalendarEvents();
    }

    // Ask once, on the way ON only — never on the way off, and never for a time/format edit.
    const turningOn = NOTIF_SWITCHES.some((k) => patch[k] === true);
    if (turningOn) void requestPermissions().finally(run);
    else run();
    // Energy capacity is ALSO a fact about a person, not just a device setting: the
    // household balance card (components/EnergyBalanceCard.tsx) measures everyone against
    // their own capacity, so without this the self row would sit at usePeopleStore's 10/50
    // default forever and every comparison against it would be wrong.
    if (keys.some((k) => ['energyMode', 'energyDailyCapacity', 'energyWeeklyCapacity', 'energyCustomCapacities'].includes(k))) {
      publishSelfCapacity();
    }
  }

  /**
   * Push this device's RESOLVED Energy capacity onto the self person row. 'custom' mode
   * has no single daily number — it's seven per-weekday amounts — so the day figure is
   * their mean, which is the only value that stays consistent with the week's sum.
   * Reads the store after `update()` so it always publishes the new value, not the old.
   */
  function publishSelfCapacity() {
    const s = useSettingsStore.getState();
    const customTotal = s.energyCustomCapacities.reduce((sum, n) => sum + n, 0);
    const daily = s.energyMode === 'custom' ? Math.round(customTotal / 7) : s.energyDailyCapacity;
    const weekly = s.energyMode === 'custom' ? customTotal : s.energyWeeklyCapacity;
    usePeopleStore.getState().publishSelfCapacity(daily, weekly);
  }

  /** The reset flavour of confirmDestructive: one label in, the title/body/button triple every
   *  "Reset X" row on this screen shares. This function is where confirmDestructive itself was
   *  invented, privately, before the other 15 sites got it (2026-08-12). */
  function confirmReset(label: string, action: () => void) {
    confirmDestructive({
      title: t.resetConfirmTitle(label),
      message: t.resetConfirmBody,
      confirmLabel: t.resetConfirmBtn,
      onConfirm: action,
    });
  }

  // Send Feedback (2026-07-13) — mailto: via Linking, falling back to the OS
  // share sheet if no mail client is configured on this device.
  async function handleSendFeedback() {
    selection();
    const url = buildFeedbackMailUrl(
      feedbackText,
      { appVersion, runtimeVersion, platform: Platform.OS, osVersion: Platform.Version },
      'Unfocus@hlynsson.no',
      t.feedback.subject,
    );
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      setFeedbackText('');
      return;
    }
    try {
      await Share.share({ message: feedbackText.trim() });
      setFeedbackText('');
    } catch {
      showAppModal(t.feedback.cardTitle, t.feedback.mailUnavailable);
    }
  }

  // Local backup & restore (Decision 036) — device-only, no upload.
  async function handleSaveToDevice() {
    selection();
    try {
      const result = await exportBackupToDevice();
      if (result.status === 'saved') {
        showAppModal(t.backup.title, t.backup.savedToDevice(result.location));
      } else if (result.status === 'unavailable') {
        showAppModal(t.backup.title, t.backup.saveUnavailable);
      }
      // 'canceled' → no modal
    } catch {
      showAppModal(t.backup.title, t.backup.exportError);
    }
  }

  async function handleExport() {
    selection();
    try {
      const result = await exportBackup();
      if (result === 'unavailable') {
        showAppModal(t.backup.title, t.backup.sharingUnavailable);
      }
    } catch {
      showAppModal(t.backup.title, t.backup.exportError);
    }
  }

  // Auto-backup: enabling it first asks the user WHERE the single self-updating
  // backup file should live (Android SAF folder pick; iOS uses a fixed Files
  // location). Backing out of the picker leaves auto-backup off, so the toggle
  // never claims to protect data it can't actually reach.
  async function handleAutoBackupToggle(v: boolean) {
    selection();
    if (!v) {
      applyAndSync({ autoBackupEnabled: false });
      return;
    }
    try {
      const loc = await chooseAutoBackupLocation();
      if (!loc) {
        showAppModal(t.backup.title, t.config.autoBackup.locationCanceled);
        return;
      }
      applyAndSync({ autoBackupEnabled: true, autoBackupUri: loc.uri, autoBackupLabel: loc.label });
      void saveAutoBackup();
    } catch {
      showAppModal(t.backup.title, t.backup.exportError);
    }
  }

  // Force an immediate auto-backup write. saveAutoBackup() is best-effort/silent,
  // so confirm success by checking whether it stamped a fresh autoBackupLastAt.
  async function handleBackupNow() {
    selection();
    // Android installs that had auto-backup on before the persistent-location
    // change have no folder yet — pick one first (a no-op write otherwise).
    if (Platform.OS === 'android' && !settings.autoBackupUri) {
      await handleAutoBackupToggle(true);
      return;
    }
    const before = useSettingsStore.getState().autoBackupLastAt;
    await saveAutoBackup();
    const after = useSettingsStore.getState().autoBackupLastAt;
    showAppModal(t.backup.title, after !== before ? t.config.autoBackup.backedUpNow : t.backup.exportError);
  }

  async function handleImport() {
    selection();
    const parsed = await pickAndParseBackup();
    if (parsed.status === 'canceled') return;
    if (parsed.status === 'invalid') {
      showAppModal(t.backup.title, t.backup.invalidFile);
      return;
    }
    if (parsed.status === 'tooNew') {
      showAppModal(t.backup.title, t.backup.tooNew);
      return;
    }
    // Destructive because a restore REPLACES what's on the device, not because it deletes a
    // row — hence the same red-button confirm a delete gets.
    confirmDestructive({
      title: t.backup.importConfirmTitle,
      message: t.backup.importConfirmBody(parsed.rowCount),
      confirmLabel: t.backup.importConfirmBtn,
      onConfirm: () => {
        try {
          restoreBackup(parsed.data);
        } catch {
          showAppModal(t.backup.title, t.backup.restoreError);
          return;
        }
        showAppModal(t.backup.title, t.backup.restoreDone, [
          { text: t.ok, onPress: () => { void reloadApp(); } },
        ]);
      },
    });
  }

  // AI setup guide — download (share sheet + local save, mirroring the backup card's
  // pair) and upload/preview/confirm. See lib/aiSetupGuide.ts + lib/aiSetupApply.ts.
  async function handleDownloadAiGuideToDevice() {
    selection();
    try {
      const result = await exportAiSetupGuideToDevice();
      if (result.status === 'saved') {
        showAppModal(t.aiSetup.title, t.aiSetup.savedToDevice(result.location));
      } else if (result.status === 'unavailable') {
        showAppModal(t.aiSetup.title, t.aiSetup.saveUnavailable);
      }
      // 'canceled' → no modal
    } catch {
      showAppModal(t.aiSetup.title, t.aiSetup.exportError);
    }
  }

  async function handleDownloadAiGuide() {
    selection();
    try {
      const result = await exportAiSetupGuide();
      if (result === 'unavailable') showAppModal(t.aiSetup.title, t.aiSetup.sharingUnavailable);
    } catch {
      showAppModal(t.aiSetup.title, t.aiSetup.exportError);
    }
  }

  async function handleUploadAiSetup() {
    selection();
    const parsed = await pickAndParseAiSetupFile();
    if (parsed.status === 'canceled') return;
    if (parsed.status === 'invalid') {
      showAppModal(t.aiSetup.title, t.aiSetup.invalidFile);
      return;
    }
    setAiSetupStale(parsed.status === 'stale');
    setAiSetupConfig(parsed.data);
  }

  function handleConfirmAiSetupImport() {
    if (!aiSetupConfig) return;
    heavy();
    const result = applyAiSetupConfig(aiSetupConfig);
    setAiSetupConfig(null);
    const total =
      result.settings.applied.length +
      result.tasks.created + result.habits.created + result.goals.created + result.notes.created +
      result.shoppingLists.created + result.shoppingItems.created + result.inventoryItems.created +
      result.catalogueItems.created + result.meals.created + result.monthlyLists.created;
    showAppModal(t.aiSetup.title, t.aiSetup.importDone(total));
  }

  const tabBar = (
    // No outer glass card (removed 2026-07-24): TabSlider already draws its own bordered/
    // filled track, so wrapping it in a second Surface card stacked a third layer (outer
    // card + TabSlider's own box + the sliding pill) that read as nested boxes. TabSlider
    // now floats directly, styled with the same side margins as ScreenHeader's own card.
    <TabSlider
      attachedTop
      value={tab}
      onChange={setTab}
      options={TABS.map((tb) => ({ value: tb.key, label: tb.label }))}
      radius={Radius.md}
      style={styles.tabsGlass}
    />
  );

  return (
    <>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
    <ScreenScaffold
      title={t.settingsTitle}
      tier="sub"
      onBack={() => router.back()}
      // Transparent, not theme.surface: the header now floats with transparent gaps around
      // its rounded card (2026-07-23 pass) showing ScreenBackground through — an opaque
      // filler here read as a mismatched solid box sitting under a floating card. Matching
      // the header's own treatment removes that artifact.
      stickyGapColor="transparent"
      stickyBelowHeader={tabBar}
      stickyBelowHeaderHeight={TAB_BAR_HEIGHT}
    >
      <View style={styles.content}>
        {tab === 'general' && (
          <>
            {/* ===== YOU ===== */}
            {/* Profile + Appearance — one panel of DisclosureRows (2026-07-13 layering pass;
                the grouping pattern DisclosureRow's own header documents). Accessibility used
                to be the panel's third card and moved to Personal in the 2026-08-17 pass: it is
                a set of aids you configure once, and it was crowding out the rows this tab
                exists for. Text size came the other way, out of Accessibility and into
                Appearance — it is the single most looked-for control on this screen and it is a
                look preference before it is an aid. */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.config.sections.you}</Text>
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border, gap: Spacing.sm }]}>
                <DisclosureRow title={t.sectionProfile} accentColor={theme.accent} first rounded>
                  <Input
                    label={t.yourName}
                    value={name}
                    onChangeText={(v) => setName(v)}
                    onBlur={() => { applyAndSync({ userName: name }); usePeopleStore.getState().publishSelfName(name); }}
                    placeholder={t.namePlaceholder}
                    returnKeyType="done"
                  />
                  <Text style={[styles.descText, { color: theme.textMuted }]}>{t.config.desc.name}</Text>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.sectionLanguage}</Text>
                  {/* 2026-08-10: was a hand-rolled two-pill `langChip` row — an exclusive
                      picker sitting three lines above the darkMode SegmentedControl in this
                      same card, drawn as accent-filled pills instead of a sliding track. That
                      pass moved a flag into each label rather than dropping it, on the
                      reasoning that a flag is how a language row is recognised before you can
                      read either option.

                      **The flags came back off on 2026-08-15, when Icelandic made it three.**
                      SegmentedControl splits its track into n equal segments, so a third
                      option takes each one to ~71px at 327px wide (and 82px at 360) while
                      "🇮🇸 Íslenska" measures 77px — it shipped as "Ísle…" / "Eng…" on every
                      common phone width. Measured, not estimated: the bare words need 53px
                      (Íslenska), 49px (English) and 40px (Norsk), which clear every width with
                      room to spare. A truncated language name is strictly worse at being
                      recognised-before-read than an untruncated one, which is the flags' own
                      argument turned around. Don't re-add flags without re-measuring.

                      Note these are `t.*` strings, so they follow the CURRENT language — in an
                      English UI the row reads "Norwegian / English / Icelandic". That differs
                      from onboarding's Basics row, which names each language in ITSELF on
                      purpose (see t.basics.language's note: you have to find your own language
                      without already reading the current one). Settings can afford the
                      difference because you are already in a language you can read; if that is
                      ever unified, unify it toward the endonyms, not away from them. */}
                  <SegmentedControl
                    value={settings.language}
                    onChange={(v) => applyAndSync({ language: v as Language })}
                    options={[
                      { value: 'no', label: t.norwegian },
                      { value: 'en', label: t.english },
                      { value: 'is', label: t.icelandic },
                    ]}
                  />
                </DisclosureRow>

                {/* UTSEENDE — same panel. Two controls, both about what the app LOOKS like:
                    light/dark and how big the text is.
                    ⚠️ **The photo-format picker is gone (2026-08-17)** and is not an oversight.
                    Its only consumer is components/PhotoFrame.tsx, whose only caller is
                    app/budget.tsx — which hard-codes `square` and documents that it ignores the
                    global default on purpose. So the row was a five-option control over a value
                    nothing on screen has ever read. The `photoAspectRatio` column, its Settings
                    field and its AI-setup whitelist entry all survive untouched (this repo never
                    drops columns, and pulling a key out of the whitelist would be a schema bump
                    for a setting that still resolves correctly) — only the UI is gone. Don't
                    re-add the row without giving PhotoFrame a caller that honours it.
                    ⚠️ **"Solid cards" (`opaqueCards`) is gone too.** It was the card-only half of
                    Accessibility's reduce-transparency switch, so the app carried two switches
                    over one idea, in two different cards, one of which silently overrode the
                    other. `glassSurfaces` is the survivor (Personal → Accessibility) because it
                    is the broader control and the one sheets and the nav bar obey. Column and
                    Settings field survive; see components/Surface.tsx's `opaqueCards` note. */}
                <DisclosureRow title={t.config.sections.appearance} accentColor={theme.accent} rounded>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.lightDarkModeLabel}</Text>
                  <SegmentedControl
                    value={settings.darkMode}
                    onChange={(v) => settings.update({ darkMode: v as DarkMode })}
                    options={[
                      { value: 'off', label: t.darkModeOff },
                      { value: 'system', label: t.darkModeSystem },
                      { value: 'on', label: t.darkModeOn },
                    ]}
                  />
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.accessibility.fontSize}</Text>
                  <SegmentedControl
                    value={settings.fontSize}
                    onChange={(v) => settings.update({ fontSize: v as FontSizePref })}
                    options={[
                      { value: 'small', label: t.settings.accessibility.fontSizeSmall },
                      { value: 'default', label: t.settings.accessibility.fontSizeDefault },
                      { value: 'large', label: t.settings.accessibility.fontSizeLarge },
                    ]}
                  />
                </DisclosureRow>
              </Surface>
            </View>

            {/* ===== NOTIFICATIONS ===== */}
            {/* Moved up from the Personal tab (2026-08-17). This is what a user opens Settings
                to change, and it was two tabs and one closed accordion away.
                It is a FLAT card under its own group header, not an DisclosureRow: the weekly
                reminder used to be a separate accordion holding one switch and its time field,
                sitting beside a second accordion holding the other five switches — a container
                per notification rather than a card per subject. One card, one header, every
                switch visible without opening anything. */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.config.sections.notifications}</Text>
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ToggleRow
                  label={t.taskNotifications}
                  hint={t.taskNotificationsHint}
                  checked={settings.taskNotificationsEnabled}
                  onChange={(v) => applyAndSync({ taskNotificationsEnabled: v })}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.habitNotifications}
                  checked={settings.habitNotificationsEnabled}
                  onChange={(v) => applyAndSync({ habitNotificationsEnabled: v })}
                />
                {/* Medicine tray reminders. Until 2026-08-15 this switch existed ONLY as the
                    bell on the Health tab's medicine card — so the one place a user goes to
                    turn notifications on or off did not list the app's most time-critical
                    one. Both write the same `medicineRemindersEnabled`; the bell stays the
                    in-context control, this is the inventory. Hidden with its feature flag,
                    like every other medicine surface. */}
                {settings.featureMedicine && (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <ToggleRow
                      label={t.medicineNotifications}
                      hint={t.medicineNotificationsHint}
                      checked={settings.medicineRemindersEnabled}
                      onChange={(v) => applyAndSync({ medicineRemindersEnabled: v })}
                    />
                  </>
                )}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.weeklyReminders}
                  hint={t.config.desc.weeklyReminders}
                  checked={settings.remindersEnabled}
                  onChange={(v) => applyAndSync({ remindersEnabled: v })}
                />
                {settings.remindersEnabled && (
                  <Input
                    label={t.reminderTimeLabel}
                    value={settings.reminderTime}
                    onChangeText={(v) => applyAndSync({ reminderTime: v })}
                    placeholder="08:00"
                    keyboardType="numbers-and-punctuation"
                  />
                )}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.persistentNotifLabel}
                  hint={t.persistentNotifHint}
                  checked={settings.persistentNotifEnabled}
                  onChange={(v) => applyAndSync({ persistentNotifEnabled: v })}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.settings.quietHours.label}
                  hint={t.settings.quietHours.hint}
                  checked={settings.quietHoursEnabled}
                  onChange={(v) => applyAndSync({ quietHoursEnabled: v })}
                />
                {settings.quietHoursEnabled && (
                  <View style={styles.workHoursRow}>
                    <View style={styles.workHoursCol}>
                      <Input
                        label={t.workHoursFrom}
                        value={settings.quietHoursStart}
                        onChangeText={(v) => applyAndSync({ quietHoursStart: v })}
                        placeholder="21:00"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                    <View style={styles.workHoursCol}>
                      <Input
                        label={t.workHoursTo}
                        value={settings.quietHoursEnd}
                        onChangeText={(v) => applyAndSync({ quietHoursEnd: v })}
                        placeholder="08:00"
                        keyboardType="numbers-and-punctuation"
                      />
                    </View>
                  </View>
                )}
              </Surface>
            </View>

            {/* ===== LAYOUT ===== */}
            {/* Moved up from Personal with Notifications (2026-08-17) — how lists are drawn and
                which tab the app opens on are decisions a user makes early and looks for again,
                not power-user territory. */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.config.sections.layout}</Text>
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                {/* Global default for every list-bearing surface (2026-07-27). A surface can
                    still override this from its own header — components/LayoutPickerSheet.tsx.
                    Presentation only: it changes how rows are DRAWN, never what the app does
                    with them, so nothing here goes through applyAndSync the way
                    calendarSyncEnabled/featureMedicine do. A row the chosen layout doesn't
                    draw keeps its own reminders. */}
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.config.layouts.title}</Text>
                <SegmentedControl
                  value={settings.layoutDetail}
                  onChange={(v) => settings.update({ layoutDetail: v as DetailLevel })}
                  options={DETAIL_LEVELS.map((level) => ({
                    value: level,
                    label: t.config.layouts[level].label,
                  }))}
                />
                <Text style={[styles.switchHint, { color: theme.textMuted }]}>
                  {t.config.layouts[settings.layoutDetail].hint}
                </Text>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.settings.accessibility.timelineHorizontal}
                  hint={t.settings.accessibility.timelineHorizontalHint}
                  checked={settings.planTimelineHorizontal}
                  onChange={(v) => settings.update({ planTimelineHorizontal: v })}
                />
                {/* ⚠️ **The starting-screen picker is GONE (consistency audit, 2026-08-21).**
                    Maintainer: *"Middle screen is to be the Main one where app always starts
                    when opening it fresh."* The app opens on the centre (To-do) tab now,
                    unconditionally — `START_TAB_ROUTE` in lib/siteNav.ts. `settings.startScreen`
                    and its column survive as inert; see store/useSettingsStore.ts's "Inert
                    columns" note. Don't wire a new control to it. */}
                {/* Re-run the first-run flow. Non-destructive, so it lives here rather than
                    in the red Reset card: it re-enters app/onboarding/basics.tsx seeded from the
                    settings the user has right now, which means walking through it and
                    pressing Done without touching anything changes nothing at all.
                    `?rows=all` is what makes this the SIX-row screen (2026-08-03). Onboarding
                    itself now draws only the language row — the other five moved to Settings,
                    where every one of them already had a home — so this link is the remaining
                    place the full set is shown in one go. Without the param it would open the
                    new-user welcome screen instead, which would be a strange thing to reach
                    from a settings row. */}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <SettingLinkRow
                  label={t.firstRun.reRun}
                  hint={t.firstRun.reRunHint}
                  onPress={() => router.push('/onboarding/basics?rows=all')}
                />
              </Surface>
            </View>

            {/* Send Feedback (2026-07-13) — always visible, not gated on debug mode.
                Free-text composer → mailto: via Linking, falling back to the OS share
                sheet if no mail client is configured. It stays on this tab while backup,
                version and the resets moved to Advanced (2026-08-17): sending a note is
                something any tester does, not a data-management chore. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <Text style={[styles.switchLabel, { color: theme.text }]}>{t.feedback.cardTitle}</Text>
                <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs }]}>{t.feedback.cardDesc}</Text>
                <View style={{ marginTop: Spacing.sm }}>
                  <Input
                    value={feedbackText}
                    onChangeText={setFeedbackText}
                    placeholder={t.feedback.placeholder}
                    multiline
                    numberOfLines={4}
                  />
                </View>
                <PressableScale
                  style={[styles.dangerBtn, feedbackText.trim() === '' && { opacity: 0.4 }]}
                  onPress={handleSendFeedback}
                  disabled={feedbackText.trim() === ''}
                  scaleTo={0.97}
                >
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.feedback.sendButton}</Text>
                </PressableScale>
              </Surface>
            </View>
          </>
        )}

        {tab === 'personal' && (
          <>
            {/* PERSONAL — the settings you configure once and rarely revisit: the aids, the
                shopping cadence, and which device capabilities the app may use.
                Notifications and Layout led this tab until 2026-08-17 and are on General now
                (they are the reason people open Settings); Accessibility came the other way,
                out of General's opening panel. */}
            {/* ===== ACCESSIBILITY ===== */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.settings.accessibility.title}</Text>
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ToggleRow
                  label={t.settings.accessibility.reducedMotion}
                  checked={settings.reducedMotion}
                  onChange={(v) => settings.update({ reducedMotion: v })}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.settings.accessibility.particles}
                  hint={t.settings.accessibility.particlesHint}
                  checked={settings.particlesEnabled}
                  onChange={(v) => settings.update({ particlesEnabled: v })}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                {/* The app's ONE reduce-transparency control since 2026-08-17. Appearance's
                    "Solid cards" (`opaqueCards`) was a second, narrower switch over the same
                    idea in a different card, and this one already overrode it — see
                    components/Surface.tsx. Don't re-add the narrower one. */}
                <ToggleRow
                  label={t.settings.accessibility.glassSurfaces}
                  hint={t.settings.accessibility.glassSurfacesHint}
                  checked={settings.glassSurfaces}
                  onChange={(v) => settings.update({ glassSurfaces: v })}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.settings.accessibility.leftHanded}
                  hint={t.settings.accessibility.leftHandedHint}
                  checked={settings.leftHanded}
                  onChange={(v) => settings.update({ leftHanded: v })}
                />
                {/* Text size moved to General → Appearance (2026-08-17): it is the control
                    people come looking for, and it is a look preference before it is an aid.
                    The horizontal-plans-timeline switch left in the 2026-07-25 reorganization
                    and now sits in General → Layout with the other drawing preferences. */}
                {/* ⚠️ **"Show tips again" is gone (2026-08-20).** It was the only way back once a
                    screen's ⓘ intro card had been closed — and there are no ⓘ cards any more
                    (components/HintCard.tsx is deleted app-wide; a screen's explanation lives in
                    its empty-state card now, which comes back whenever the surface is empty and
                    needs no restoring). `settings.dismissedHints` and `restoreHints()` survive
                    as inert, so an existing row's stored keys are simply never read again. */}
              </Surface>
            </View>

            {/* SHOPPING — the whole of the old Handle tab, which only ever held these two
                settings and did not justify a tab of its own.

                This is the one `?section=` target today (see SettingsSection): Shopping's ⓘ has
                a "Nullstillingsdager" link that used to land on this screen's General tab with
                this card shut. `ref` + `onLayout` are what let it be scrolled to; `open` is
                controlled only while the deep link is live, and the first toggle hands the card
                back to its own default-closed behaviour. It stays an DisclosureRow for exactly
                that reason — the deep link needs something to open. */}
          <View style={styles.section} ref={sectionNode} onLayout={onSectionLayout}>
            <Surface style={[styles.card, { borderColor: theme.border }]}>
              <DisclosureRow
                title={t.sectionShopping}
                accentColor={theme.accent}
                first
                open={openSection === 'shopping' ? true : undefined}
                onToggle={() => setOpenSection(null)}
              >
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.weeklyResetDay}</Text>
                {/* 2026-08-10: was a `flexWrap` row of seven `dayChip`s. Two things were wrong
                    with it and the conversion fixes both. It is an EXCLUSIVE picker (one reset
                    day) drawn in the multi-select chip shape, which is the thing 19a's
                    exemption is not for — and it carried `minWidth: MIN_TAP_TARGET`, so seven
                    chips needed 7×48 + 6×4 = 360px inside a card whose inner width is ~329px
                    even on a 393px screen, i.e. it wrapped to a second line on every phone.
                    That last part is ARITHMETIC, not a measurement: `npm run wraps` never
                    reached this row, because its Settings scan does not expand the Shopping
                    card it lives in — worth knowing before trusting a clean audit here.
                    `SegmentedControl` divides its track into seven equal flex segments with no
                    minWidth and shrinks the label to fit, which is precisely the shape
                    AGENTS.md's wrap-audit note prescribes for a weekday row. */}
                <SegmentedControl
                  value={settings.weeklyResetDay}
                  onChange={(v) => applyAndSync({ weeklyResetDay: v as number })}
                  options={DAY_LABELS.map((label, i) => ({ value: i, label: label.slice(0, 3) }))}
                />

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <Input
                  label={t.monthlyResetDate}
                  value={monthlyDateInput}
                  onChangeText={setMonthlyDateInput}
                  onBlur={() => {
                    const n = parseInt(monthlyDateInput, 10);
                    if (!isNaN(n) && n >= 1 && n <= 31) {
                      applyAndSync({ monthlyResetDate: n });
                    } else {
                      setMonthlyDateInput(String(settings.monthlyResetDate));
                      setInputWarning(t.invalidMonthlyDateMsg);
                    }
                  }}
                  keyboardType="number-pad"
                  placeholder="1–31"
                  maxLength={2}
                />
                <Text style={[styles.paydayHint, { color: theme.textMuted }]}>{t.monthlyDateInputHint}</Text>
              </DisclosureRow>
            </Surface>
          </View>

            {/* Device features (2026-07-17, moved here from the General tab 2026-07-25) —
                toggles for the reserve-only native surface: voice dictation (title mic),
                contacts (attach-to-task), location (tag-with-my-location), calendar (mirror
                timed tasks). All four default off; each gates its own editor/store wiring —
                see components/TaskCard.tsx and store/useTaskStore.ts. Calendar goes through
                applyAndSync so toggling it immediately re-syncs every eligible task; the
                other three are read directly by TaskCard at render time, no background job
                to kick.
                The group header sits OUTSIDE the card now (2026-08-17), like every other
                group on the three tabs — it was the one heading drawn inside its own Surface. */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.permissions.sectionTitle}</Text>
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ToggleRow
                  label={t.permissions.voiceNotes.label}
                  hint={t.permissions.voiceNotes.hint}
                  checked={settings.voiceNotesEnabled}
                  onChange={(v) => { selection(); settings.update({ voiceNotesEnabled: v }); }}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.permissions.contacts.label}
                  hint={t.permissions.contacts.hint}
                  checked={settings.contactsEnabled}
                  onChange={(v) => { selection(); settings.update({ contactsEnabled: v }); }}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.permissions.location.label}
                  hint={t.permissions.location.hint}
                  checked={settings.locationEnabled}
                  onChange={(v) => { selection(); settings.update({ locationEnabled: v }); }}
                />
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <ToggleRow
                  label={t.permissions.calendar.label}
                  hint={t.permissions.calendar.hint}
                  checked={settings.calendarSyncEnabled}
                  onChange={(v) => { selection(); applyAndSync({ calendarSyncEnabled: v }); }}
                />

                {/* Which device calendars the timeline may READ (2026-08-02,
                    lib/deviceCalendar.ts). Distinct from the toggle above it, which is about
                    WRITING a mirrored event out — that is a separate feature with its own
                    switch, and the two are deliberately not merged.
                    Nothing selected means ALL of them, which is the default: a picker that
                    started empty would show nothing and read as broken. The list is empty
                    until calendar access is granted, and stays empty if the user declines —
                    a supported permanent state, so there is no prompt and no call to action
                    here. */}
                {featureDayLog && deviceCalendars.length > 0 ? (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.dayLog.calendars.title}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.dayLog.calendars.hint}</Text>
                    {deviceCalendars.map((cal) => {
                      // Empty selection = all visible, so an untouched picker shows every
                      // row as on rather than as an unexplained blank slate.
                      const all = settings.dayLogCalendarIds.length === 0;
                      const checked = all || settings.dayLogCalendarIds.includes(cal.id);
                      return (
                        <ToggleRow
                          key={cal.id}
                          label={cal.title}
                          checked={checked}
                          onChange={(v) => {
                            selection();
                            // Turning one OFF while "all" is implicit has to materialise
                            // the full list first, or the patch would read as "only this
                            // one" and hide every other calendar in one tap.
                            const current = all ? deviceCalendars.map((c) => c.id) : settings.dayLogCalendarIds;
                            const next = v
                              ? [...new Set([...current, cal.id])]
                              : current.filter((id) => id !== cal.id);
                            settings.update({ dayLogCalendarIds: next });
                          }}
                        />
                      );
                    })}
                  </>
                ) : null}
              </Surface>
            </View>
          </>
        )}

        {tab === 'advanced' && (
          <>
            {/* ===== FEATURES ===== */}
            {/* Every flag here hides a purely ADDITIVE surface: turning one off never breaks
                app logic, which is exactly why these got a toggle and things like data pruning,
                widget/overview sync or catalog seeding deliberately did not. **This card is the
                ONLY place any of them are offered** — app/onboarding/features.tsx was deleted
                (2026-07-31, B1-1), so a fresh install takes the defaults untouched and comes
                here to change one.

                **Energy's configuration moved INTO this card (2026-08-17).** It was its own
                section, with its own group header, directly above — so the question "do I want
                Energy at all" was asked here and "how big is my budget" was asked in a separate
                container a scroll away, with nothing naming the relationship. The capacity
                steppers are now revealed by the Energy/Rewards picker that governs them.
                ⚠️ This narrows the old "left mounted in Rewards mode rather than hidden"
                behaviour: the steppers are hidden in Rewards mode, where they configured a
                budget nothing could spend. The VALUES are untouched by hiding them — they live
                in the settings row exactly as before — so a capacity set months ago is still
                there, unchanged, the moment the picker goes back to Energy mode. */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.config.sections.features}</Text>
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                {/* ENERGY / REWARDS — two peer modes over the one `energySystemEnabled`
                    boolean (2026-08-02). Same row idiom as Layout's detail-level and
                    starting-screen pickers — fieldLabel, the control, then the SELECTED
                    option's hint — so the two read as the same kind of choice.
                    Written with a plain settings.update(): nothing here needs re-syncing
                    (energy schedules nothing), and SegmentedControl fires its own
                    selection() haptic, so the FEATURE_ROWS switches' explicit one would
                    double up. Gates energy SURFACES only — every per-task/habit
                    energyEnabled/energyValue stays in the DB, so switching back to Energy
                    mode restores every number untouched. */}
                <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 0 }]}>
                  {t.config.features.energy.modes.label}
                </Text>
                <SegmentedControl
                  value={settings.energySystemEnabled ? 'energy' : 'rewards'}
                  onChange={(v) => settings.update({ energySystemEnabled: (v as EnergyModeChoice) === 'energy' })}
                  options={[
                    { value: 'energy', label: t.config.features.energy.modes.energy.label },
                    { value: 'rewards', label: t.config.features.energy.modes.rewards.label },
                  ]}
                />
                <Text style={[styles.switchHint, { color: theme.textMuted }]}>
                  {settings.energySystemEnabled
                    ? t.config.features.energy.modes.energy.hint
                    : t.config.features.energy.modes.rewards.hint}
                </Text>

                {/* How big the budget is, and how it is counted — only meaningful in Energy
                    mode, so only drawn there. Per-period overrides live on the Home Energy
                    meter (components/EnergyMeter.tsx). */}
                {settings.energySystemEnabled && (
                  <View style={styles.energyCapacityRows}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.energy.modeLabel}</Text>
                    <SegmentedControl
                      value={settings.energyMode}
                      onChange={(v) => applyAndSync({ energyMode: v as EnergyMode })}
                      options={[
                        { value: 'daily', label: t.settings.energy.modeDaily },
                        { value: 'weekly', label: t.settings.energy.modeWeekly },
                        { value: 'custom', label: t.settings.energy.modeCustom },
                      ]}
                    />
                    {settings.energyMode === 'daily' && (
                      <View style={styles.energyCapacityRow}>
                        <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.energy.dailyCapacity}</Text>
                        <Stepper
                          value={settings.energyDailyCapacity}
                          onChange={(n) => applyAndSync({ energyDailyCapacity: n })}
                          min={0}
                        />
                      </View>
                    )}
                    {settings.energyMode === 'weekly' && (
                      <View style={styles.energyCapacityRow}>
                        <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.energy.weeklyCapacity}</Text>
                        <Stepper
                          value={settings.energyWeeklyCapacity}
                          onChange={(n) => applyAndSync({ energyWeeklyCapacity: n })}
                          min={0}
                        />
                      </View>
                    )}
                    {settings.energyMode === 'custom' && (
                      <>
                        <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.energy.customHint}</Text>
                        {DAY_LABELS.map((label, i) => (
                          <View key={i} style={styles.energyCapacityRow}>
                            <Text style={[styles.switchLabel, { color: theme.text }]}>{label}</Text>
                            <Stepper
                              value={settings.energyCustomCapacities[i]}
                              onChange={(n) => {
                                const next = [...settings.energyCustomCapacities];
                                next[i] = n;
                                applyAndSync({ energyCustomCapacities: next });
                              }}
                              min={0}
                            />
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}

                {/* The plain on/off features. Driven off one list so the rows stay identical —
                    each is a bare boolean with no configuration of its own. Adding one = add
                    the flag (store + lib/db.ts migration), add a config.features entry in all
                    three languages, add a line to FEATURE_ROWS, and gate the surface it owns at
                    its call site. */}
                {FEATURE_ROWS.map(({ key, copy }) => (
                  <React.Fragment key={key}>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <ToggleRow
                      label={copy(t).label}
                      hint={copy(t).hint}
                      checked={settings[key]}
                      onChange={(v) => { selection(); settings.update({ [key]: v } as Partial<Settings>); }}
                    />
                  </React.Fragment>
                ))}

                {/* Automations' own screen — revealed right under its switch so the
                    feature and its entry point stay together. This is still the only way
                    into app/automations.tsx. Rules the user already made keep running when
                    the flag is off; only the door is hidden. */}
                {settings.featureAutomations && (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <SettingLinkRow
                      label={t.nav.automations}
                      hint={t.hints.automations.text}
                      onPress={() => router.push('/automations')}
                    />
                  </>
                )}
              </Surface>
            </View>

            {/* PEOPLE/FAMILY + PAIRED DEVICES — one panel, and it renders nothing at all while
                SHARING_VISIBLE is false (2026-08-05, lib/sharingVisibility.ts). Tags used to be
                the panel's middle card, which meant that with sharing hidden the app drew a
                wrapper panel around one lone accordion; it is its own card below now, and this
                panel comes back whole when sharing does.
                Work mode, School mode and Parent (child) mode used to live on this tab and were
                REMOVED (2026-07-25): every switch in all three wrote a settings column that
                nothing in the app ever read. The columns survive — see store/useSettingsStore.ts's
                "Inert columns" note. Do not re-add UI for any of them without the behaviour. */}
            {SHARING_VISIBLE && (
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border, gap: Spacing.sm }]}>
                <DisclosureRow title={t.peopleMode.label} accentColor={theme.accent} first rounded>
                  <ToggleRow
                    label={t.peopleMode.label}
                    hint={t.peopleMode.hint}
                    checked={settings.peopleModeEnabled}
                    onChange={(v) => { selection(); settings.update({ peopleModeEnabled: v }); }}
                  />

                  {settings.peopleModeEnabled && (
                    <>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>{t.peopleMode.profilesHint}</Text>
                      {/* One row per person, not a chip row: each carries a colour to tap,
                          a name, and whether their side is live or hand-kept — more than
                          fits in a pill. The self row has no remove button (it is this
                          device's own identity; removing it would strand every task). */}
                      {people.map((person, index) => {
                        const color = personColor(person.color, index);
                        return (
                          <View key={person.id} style={styles.personRow}>
                            <PressableScale
                              onPress={() => cycleColor(person.id, color)}
                              hitSlop={HitSlop.base}
                              accessibilityRole="button"
                              accessibilityLabel={t.peopleMode.profilesHint}
                              scaleTo={0.9}
                            >
                              <PersonDot color={color} name={person.name} size={28} />
                            </PressableScale>
                            <View style={styles.personRowText}>
                              <Text style={[styles.switchLabel, { color: theme.text }]} numberOfLines={1}>
                                {person.isSelf
                                  // "You" alone when there's no name yet — "Me · You" said
                                  // the same thing twice.
                                  ? person.name
                                    ? `${person.name} · ${t.peopleMode.you}`
                                    : t.peopleMode.you
                                  : person.name}
                              </Text>
                              {/* Live-vs-hand-kept is a statement about someone ELSE's phone.
                                  On your own row it read "Synced with their phone", which is
                                  nonsense, so the self row simply doesn't carry the line. */}
                              {!person.isSelf && (
                                <Text style={[styles.switchHint, { color: theme.textMuted }]} numberOfLines={1}>
                                  {person.deviceId ? t.peopleMode.linkedDevice : t.peopleMode.onThisPhone}
                                </Text>
                              )}
                            </View>
                            {!person.isSelf && (
                              <PressableScale
                                onPress={() => removeProfile(person.id, person.name)}
                                hitSlop={HitSlop.base}
                                accessibilityRole="button"
                                accessibilityLabel={t.peopleMode.removeTitle(person.name)}
                                scaleTo={0.9}
                              >
                                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                              </PressableScale>
                            )}
                          </View>
                        );
                      })}
                      <View style={styles.peopleAddRow}>
                        <View style={styles.peopleAddInput}>
                          <Input
                            value={newChildName}
                            onChangeText={setNewChildName}
                            placeholder={t.peopleMode.addPlaceholder}
                            onSubmitEditing={addProfile}
                            returnKeyType="done"
                          />
                        </View>
                        <PressableScale
                          style={[styles.peopleAddBtn, { backgroundColor: newChildName.trim() ? theme.accent : theme.surfaceMuted, borderColor: theme.border }]}
                          onPress={addProfile}
                          disabled={!newChildName.trim()}
                          accessibilityRole="button"
                          accessibilityLabel={t.peopleMode.addButton}
                          scaleTo={0.96}
                        >
                          <Ionicons name="add" size={22} color={newChildName.trim() ? theme.accentInk : theme.textMuted} />
                        </PressableScale>
                      </View>
                    </>
                  )}
                </DisclosureRow>

                {/* LAN live sync (Decision 038) — the toggle, QR pairing wizard and
                    paired-device list all live on app/pair-device.tsx; this is just the entry
                    point. syncAvailable (lib/syncService's isSyncAvailable()) only changes the
                    copy — the link always shows, since the native transport isn't linked
                    outside a build. Live sync itself is NOT disabled while sharing is hidden:
                    an already-paired device keeps syncing, it just has no management screen. */}
                <DisclosureRow title={t.peers.title} accentColor={theme.accent} rounded>
                  <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>
                    {syncAvailable ? t.peers.settingsCardDesc : t.peers.syncUnavailable}
                  </Text>
                  <PressableScale style={styles.dangerBtn} onPress={() => router.push('/pair-device')} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.peers.manageLink}</Text>
                  </PressableScale>
                </DisclosureRow>
              </Surface>
            </View>
            )}

            {/* TAGS — the household's shared vocabulary. Its own card since 2026-08-17: it was
                the middle DisclosureRow of the People/devices panel, whose other two cards are
                hidden while sharing is, so the screen drew a panel wrapper around a single
                accordion. Tags are COINED from a task (components/TagPickerRow.tsx), because
                that's where you discover you want one; this card is for the two things that
                don't belong mid-edit: renaming (which follows every task, since tasks carry the
                id) and removing. No add field here on purpose — a tag with no task on it is
                just a word. */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.tags.settingsTitle}</Text>
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>
                  {t.tags.settingsHint}
                </Text>
                {tags.length === 0 ? (
                  <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.tags.empty}</Text>
                ) : (
                  tags.map((tag) => (
                    <View key={tag.id} style={styles.personRow}>
                      <View style={styles.personRowText}>
                        {/* Committed on blur, like the profile name field: a rename per
                            keystroke would broadcast a row to every peer per letter. */}
                        <Input
                          value={tagDrafts[tag.id] ?? tag.name}
                          onChangeText={(v) => setTagDrafts((d) => ({ ...d, [tag.id]: v }))}
                          onBlur={() => {
                            renameTag(tag.id, tagDrafts[tag.id] ?? tag.name);
                            setTagDrafts((d) => {
                              const next = { ...d };
                              delete next[tag.id];
                              return next;
                            });
                          }}
                          returnKeyType="done"
                        />
                      </View>
                      <PressableScale
                        onPress={() => removeTagWithConfirm(tag.id, tag.name)}
                        hitSlop={HitSlop.base}
                        accessibilityRole="button"
                        accessibilityLabel={t.tags.removeTitle(tag.name)}
                        scaleTo={0.9}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.textMuted} />
                      </PressableScale>
                    </View>
                  ))
                )}
              </Surface>
            </View>

            {/* ===== DATA ===== */}
            {/* Moved here from General (2026-08-17). Backup, build diagnostics and the resets
                are things you do once or in a crisis, and they were sitting on the tab a user
                opens to change a reminder. Send Feedback stayed behind on General.

                ⚠️ **The "local account" is gone (2026-08-17)** and this card is named for what
                it actually does. Decision 039's account was a name plus a creation date stamped
                into the settings row; nothing in the app ever read either field, so "Create
                local account" was a button whose whole effect was to make itself disappear. The
                `account_name`/`account_created` columns and their Settings fields survive
                untouched (this repo never drops columns) — see store/useSettingsStore.ts's
                "Inert columns" note. What the card was actually FOR — the backup file, the
                auto-backup location, and the AI setup guide — is all still here, unchanged. */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.config.sections.data}</Text>
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border, gap: Spacing.sm }]}>
                <DisclosureRow title={t.account.title} accentColor={theme.accent} first rounded>
                  {/* Auto-backup toggle */}
                  <ToggleRow
                    label={t.config.autoBackup.label}
                    hint={t.config.autoBackup.hint}
                    checked={settings.autoBackupEnabled}
                    onChange={(v) => { void handleAutoBackupToggle(v); }}
                  />
                  {settings.autoBackupEnabled && (
                    <>
                      <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs, marginBottom: 0 }]}>
                        {t.config.autoBackup.pathLabel} {settings.autoBackupLabel || t.config.autoBackup.locationUnknown}
                      </Text>
                      <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs, marginBottom: 0 }]}>
                        {settings.autoBackupLastAt
                          ? t.config.autoBackup.lastBackedUp(formatBackupTime(settings.autoBackupLastAt))
                          : t.config.autoBackup.never}
                      </Text>
                      <PressableScale style={[styles.dangerBtn, { marginTop: Spacing.xs }]} onPress={handleBackupNow} scaleTo={0.97}>
                        <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.config.autoBackup.backUpNow}</Text>
                      </PressableScale>
                    </>
                  )}
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleSaveToDevice} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.backup.saveToDevice}</Text>
                  </PressableScale>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleExport} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.backup.shareCopy}</Text>
                  </PressableScale>
                  <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs, marginBottom: 0 }]}>
                    {t.config.autoBackup.shareNote}
                  </Text>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleImport} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.account.restoreButton}</Text>
                  </PressableScale>
                  <Text style={[styles.descText, { color: theme.textMuted, marginBottom: 0 }]}>{t.account.deviceOnlyNote}</Text>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  {/* AI setup guide — a technical .txt an external AI can read to help
                      configure the app; see lib/aiSetupGuide.ts's header. */}
                  <PressableScale style={styles.dangerBtn} onPress={handleDownloadAiGuideToDevice} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.aiSetup.downloadButton}</Text>
                  </PressableScale>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleDownloadAiGuide} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.aiSetup.shareButton}</Text>
                  </PressableScale>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleUploadAiSetup} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.aiSetup.uploadButton}</Text>
                  </PressableScale>
                  <Text style={[styles.descText, { color: theme.textMuted, marginBottom: 0 }]}>{t.aiSetup.deviceOnlyNote}</Text>
                </DisclosureRow>

                {/* Version & updates — lets the user see exactly which build/OTA is
                    running and force an OTA check. Runtime + updateId here are the
                    fastest way to diagnose "I haven't received the update". */}
                <DisclosureRow title={t.version.title} accentColor={theme.accent} rounded>
                  {[
                    [t.version.appVersion, appVersion],
                    [t.version.runtime, runtimeVersion],
                    [t.version.channel, updateChannel],
                    [t.version.source, updateSource],
                    [t.version.updateId, updateIdShort],
                    [t.version.published, updatePublished],
                  ].map(([label, value], i) => (
                    <View key={label} style={[styles.switchRow, i > 0 && { marginTop: Spacing.sm }]}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{label}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]} selectable>{value}</Text>
                    </View>
                  ))}
                  {/* Standing "this is a work in progress" note — the onboarding tour says
                      the same thing once, this keeps it findable afterwards. */}
                  <View style={styles.experimentalRow}>
                    <Ionicons name="flask-outline" size={16} color={theme.textMuted} />
                    <Text style={[styles.descText, { color: theme.textMuted, flex: 1, marginTop: 0 }]}>
                      {t.version.experimental}
                    </Text>
                  </View>
                  {!Updates.isEnabled && (
                    <Text style={[styles.descText, { color: theme.warn, marginBottom: Spacing.sm }]}>
                      {t.version.disabled}
                    </Text>
                  )}
                  {/* Passive twin of the check-for-updates result above, so the explanation is
                      findable without pressing anything. `warn`, not `bad`: nothing is broken
                      and no data is at risk — there is just a newer build to install. */}
                  {health.kind === 'stale' && health.ageDays !== null && (
                    <Text style={[styles.descText, { color: theme.warn, marginBottom: Spacing.sm }]}>
                      {t.version.staleNote(health.ageDays, runtimeVersion)}
                    </Text>
                  )}
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleCheckUpdates} disabled={checkingUpdate} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>
                      {checkingUpdate ? t.version.checking : t.version.checkButton}
                    </Text>
                  </PressableScale>
                </DisclosureRow>
              </Surface>
            </View>

            {/* Reset data — its own red-bordered card (not folded into the panel above) so the
                destructive action stays visually distinct, and last on the tab as a "danger
                zone at the bottom". */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderWidth: 1, borderColor: theme.badSoft }]}>
                <DisclosureRow title={t.sectionReset} accentColor={theme.bad} first>
                  <Text style={[styles.descText, { color: theme.bad, marginBottom: Spacing.sm, marginTop: 0 }]}>{t.config.desc.dataNote}</Text>
                  <PressableScale style={styles.dangerBtn} onPress={() => confirmReset(t.resetMonthly.toLowerCase(), monthlyReset)} scaleTo={0.93}>
                    <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetMonthly}</Text>
                  </PressableScale>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={() => confirmReset(t.resetTasks.toLowerCase(), clearTasks)} scaleTo={0.93}>
                    <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetTasks}</Text>
                  </PressableScale>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale
                    style={styles.dangerBtn}
                    onPress={() =>
                      confirmReset(t.resetOnboarding.toLowerCase(), () => {
                        settings.update({ setupComplete: false });
                        router.replace('/onboarding/basics');
                      })
                    }
                    scaleTo={0.93}
                  >
                    <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetOnboarding}</Text>
                  </PressableScale>
                </DisclosureRow>
              </Surface>
            </View>

            {/* DEBUG MODE — the tester tooling, and the one card on this screen that is not a
                feature. This is the ONLY way to turn debug on: components/ScreenHeader.tsx's
                bug icon renders only while debug is already on, as the way back out.

                **It absorbed the Design Lab entry point (2026-08-17)**, which had its own
                `featureDesignLab` card beside this one. Two switches for "developer tooling"
                was one too many, and the lab is not something a user chooses between — it is a
                workbench for reporting design changes back. `featureDesignLab` is no longer
                read anywhere; the column and Settings field survive (see
                store/useSettingsStore.ts's "Inert columns" note) and the lab is reached from
                the link below whenever debug mode is on.
                ⚠️ scripts/preview.mjs, scripts/measure-wraps.mjs and
                scripts/screenshot-states.mjs walk to /design-lab through this card — they flip
                DEBUG mode now, not a design-lab switch.

                **Sample data (the `freyrMode*` keys) is gone (2026-08-17).** It seeded and
                unseeded a starter set of tasks and shopping rows — demo scaffolding from before
                real users were on the app, and the most side-effect-heavy switch on the screen.
                Columns and lib/freyrModeSeed.ts survive; nothing calls the seeder now. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ToggleRow
                  label={t.debug.toggleLabel}
                  hint={t.debug.toggleHint}
                  checked={settings.debugModeEnabled}
                  onChange={(v) => { selection(); settings.update({ debugModeEnabled: v }); }}
                />
                {settings.debugModeEnabled && (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0 }]}>{t.debug.howToUse}</Text>
                    <PressableScale
                      style={[styles.dangerBtn, feedbackNoteCount === 0 && { opacity: 0.4 }]}
                      onPress={() => confirmReset(t.debug.resetNotes.toLowerCase(), clearFeedbackNotes)}
                      disabled={feedbackNoteCount === 0}
                      scaleTo={0.93}
                    >
                      <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.debug.resetNotes}</Text>
                    </PressableScale>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <SettingLinkRow
                      label={t.designLab.linkLabel}
                      hint={t.designLab.intro}
                      onPress={() => router.push('/design-lab')}
                    />
                  </>
                )}
                {/*
                  Placeholder — permission test buttons (lib/permissionTests.ts) mount here once
                  that utility exists. It does not exist anywhere in this repo yet (native
                  permission-testing is blocked on a dev/APK build), so nothing is wired below.
                  Do not wire this until permissionTests.ts lands.
                */}
              </Surface>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScreenScaffold>
    </KeyboardAvoidingView>
    <ConfirmationBanner message={inputWarning} onDismiss={() => setInputWarning(null)} variant="warn" />
    <AiSetupPreviewModal
      visible={!!aiSetupConfig}
      preview={aiSetupPreview}
      staleWarning={aiSetupStale}
      onConfirm={handleConfirmAiSetupImport}
      onCancel={() => setAiSetupConfig(null)}
    />
    </>
  );
}

const baseStyles = StyleSheet.create({
  flex: { flex: 1 },
  // Was Spacing.xl (32) per Decision 043 rule 2 — read as too much dead air between cards
  // vs. every other screen's content gap (Spacing.md/lg); brought down to match (2026-07-21).
  // No paddingTop (2026-08-19): the first card meets the header's glass flush, the way
  // components/ScreenScaffold.tsx now clips every screen. The BOTTOM keeps its margin —
  // this screen reserves no nav, so that edge is the safe area, not chrome.
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  // Decision 043 rule 2 fixed anatomy: Fonts.semibold/FontSize.lg; below-spacing comes
  // from `section`'s own gap:Spacing.sm, so neither header style carries its own margin.
  // (Most former sectionTitle/tabSectionLabel headers are now DisclosureRow's own title —
  // tabSectionLabel survives for the few single-toggle cards that stayed plain, uncollapsed.)
  // ⚠️ **No `marginTop` (consistency audit, 2026-08-21).** It carried `Spacing.sm`, and ALL
  // EIGHT call sites overrode it to 0 inline — so the value never reached a pixel, and what it
  // actually was is a trap: a ninth group header that forgot the override would silently gain
  // 8px under the tab bar, which is the screen's top gap and so exactly the seam the 2026-08-19
  // pass deleted everywhere else. The gap between groups is the content container's own
  // `gap: Spacing.lg`, per DESIGN_RULES rule 3 — the screen owns it, not the child.
  groupHeader: { fontFamily: Type.heading.fontFamily, fontSize: Type.heading.size, lineHeight: Math.round(Type.heading.size * Type.heading.line) },
  descText: { fontSize: FontSize.xs, marginTop: Spacing.sm, lineHeight: 18 },
  // Version card's "experimental build" note — icon + wrapped text on one row.
  experimentalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.md },
  energyCapacityRows: { marginTop: Spacing.md, gap: Spacing.sm },
  energyCapacityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  // Each settings group reads as one rounded, bordered block — the whole lined-up set of
  // rows shares 4 rounded corners + a crisp 1px edge, matching Plans' "New task" card
  // (debug-note 2026-07-21). borderColor is applied inline (theme-dependent).
  card: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  fieldLabel: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size, marginBottom: Spacing.xs },
  divider: { height: 1, marginVertical: Spacing.md },
  workHoursRow: { flexDirection: 'row', gap: Spacing.md },
  workHoursCol: { flex: 1 },
  // `dayRow`/`dayChip`/`dayText` deleted 2026-08-10 — the weekly-reset-day picker is a
  // `SegmentedControl` now. See the note at its call site for why the old `minWidth`-based
  // chip row could not fit seven options on any phone.
  paydayHint: { fontSize: FontSize.xs, marginTop: Spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: FontSize.md, fontFamily: Fonts.medium },
  switchHint: { fontSize: FontSize.xs, marginTop: Spacing.xs },
  dangerBtn: { paddingVertical: Spacing.sm },
  dangerBtnText: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
  // One person per row (2026-07-28) — replaced the flat name-chip row, which had nowhere
  // to put a colour swatch or the live/hand-kept line.
  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, marginBottom: Spacing.xs,
  },
  personRowText: { flex: 1 },
  peopleAddRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  peopleAddInput: { flex: 1 },
  peopleAddBtn: {
    width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, borderRadius: Radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  // `langRow`/`langChip`/`langFlag`/`langText` deleted 2026-08-10 — the language picker is a
  // `SegmentedControl` now, like the darkMode row three lines above it in the same card.
  // Styles TabSlider directly (no wrapping card, see the 2026-07-24 tabBar edit note) —
  // side margins match ScreenHeader's own floated card (headerFloatH, Spacing.sm as of the
  // header/bottom-nav width-alignment pass) so the two read as one consistent floating-chrome
  // language; flex:1 + justifyContent:'center' fill and vertically center it within the sticky
  // strip's reserved height (TAB_BAR_HEIGHT).
  tabsGlass: { flex: 1, marginHorizontal: Spacing.sm, justifyContent: 'center' },
});
