/**
 * i18n.ts — translation dictionaries (en/no) and the useT() / getTranslations() accessors.
 *
 * Holds the full English and Norwegian string tables (typed off `en`) plus
 * helper functions to read the active language. useT() is the React hook for
 * components; getTranslations() is the non-hook accessor for stores/schedulers.
 * Language is sourced from the settings store.
 *
 * Connections:
 *   Imports → store/useSettingsStore
 *   Used by → app/_layout.tsx, app/budget.tsx, app/habit-form.tsx, app/(tabs)/health.tsx, app/index.tsx, app/meals.tsx, app/notes.tsx, app/onboarding/guided.tsx, app/onboarding/index.tsx, app/onboarding/intro.tsx, app/onboarding/language.tsx, app/onboarding/privacy.tsx, app/pair-device.tsx, app/plans.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, app/shopping.tsx, app/task-form.tsx, components/DebugOverlay.tsx, components/SharedRequestsSection.tsx, components/cover/*, lib/reminders.ts, store/useHabitStore.ts, store/useTaskStore.ts
 *   Data    → reads `language` from the settings Zustand store
 *
 * Edit notes:
 *   - `no` is typed as `typeof en`, so every key added to `en` MUST be added to
 *     `no` (and vice versa) or it won't compile.
 *   - All user-facing strings go through here; no hardcoded UI text in screens.
 *   - In components use the useT() hook (reactive); in stores/schedulers use
 *     getTranslations(lang) — useT cannot run outside React.
 *   - Added keys: nav.settingsLabel, home.todaysPlans, home.seeAllPlans,
 *     health.habits, health.seeAllHabits, health.noHabits, health.addHabit,
 *     shopping.scan, shopping.budget, notes.*, hints.notes.
 *   - Added keys: peers.* (Decision 038 LAN live-sync wiring — app/pair-device.tsx,
 *     app/settings.tsx's sync toggle card).
 *   - Added keys: firstRun.* (2026-07-30 first-run personalization, app/first-run.tsx).
 *     Note what is NOT there: the text-size and starting-screen options carry no labels
 *     of their own — the flow reuses settings.accessibility.fontSize* and nav.* so it
 *     and Settings can't drift apart. Only appearance names its own three, because
 *     Settings' Off/System/On read as nothing on a standalone card.
 *   - Added keys: webPreview.notAvailable (web preview placeholder screens —
 *     app/scan.web.tsx).
 */
import { useSettingsStore } from '@/store/useSettingsStore';

export type Lang = 'en' | 'no';

const en = {
  // Greeting
  greeting: { night: 'Good night', morning: 'Good morning', day: 'Good day', evening: 'Good evening' },
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  // Short month names for date-range labels (lib/date.ts's formatDateRange)
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  // Navigation / common
  back: '← Home',
  cancel: 'Cancel',
  yes: 'Yes',
  no: 'No',
  save: 'Save',
  undoBtn: 'Undo',
  next: 'Next →',
  previous: '← Back',
  done: "Let's go! 🌿",
  ok: 'OK',
  // Small badge next to a field's label marking it as not required to save — see
  // components/OptionalTag.tsx. Kept as a single short word/abbreviation in both
  // languages so it reads as a tag, not a sentence fragment.
  optionalTag: 'Opt',
  webPreview: { notAvailable: 'Not available in the web preview.' },
  // Home screen
  addNew: '+ New',
  backlog: 'Not started',
  // Plans widget (home preview + full /plans screen)
  noPlansToday: 'Nothing to do today — enjoy your day',
  notesCollapse: 'Show less',
  timelineEmptyAdd: 'Add a plan',
  timelineNow: 'Now',
  // Day-view rail (components/PlanTaskCard.tsx — full /plans screen + read-only Home preview)
  dayViewGapUntil: (time: string) => `Nothing until ${time}`,
  dayViewDoneZone: (n: number) => `Done today (${n})`,
  dayViewAllDone: 'All done for today',
  dayViewFollowerBadge: 'Then',
  dayViewAnytimeBadge: 'Anytime',
  /** Length of a compressed empty stretch on the timeline, e.g. "2 h 30 min". */
  dayViewGapLength: (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  },
  /** Deleted-tasks zone in the day-view — delete is undoable, never silent. */
  dayViewDeletedZone: (n: number) => `Recently deleted (${n})`,
  dayViewRestore: 'Restore',
  dayViewDeleteTask: 'Delete',
  // To-do list screen (app/(tabs)/plans.tsx + components/TaskCard.tsx) — the route
  // key stays `plans` for history; the user-facing label is "To-do list" (short
  // form "To-do" in the bottom nav, see nav.plans).
  tasksTitle: 'To-do list',
  tasksTabAll: 'All tasks',
  tasksTabToday: 'Today',
  tasksTabWeek: 'This week',
  tasksSectionShared: 'Shared',
  tasksSectionWhenever: 'Whenever',
  tasksSectionRecurring: 'Recurring',
  tasksSectionSharedEmpty: 'Nothing shared yet',
  tasksSectionRecurringEmpty: 'No recurring tasks yet',
  tasksSectionWheneverEmpty: 'Nothing here yet',
  tasksSharedSent: 'Sent',
  tasksSharedReceived: 'Received',
  tasksDayEmpty: 'Nothing to do',
  tasksDoneLabel: 'Done',
  taskSave: 'Save',
  taskDiscard: 'Discard',
  taskRecurringToggle: 'Repeat',
  taskStartSpecificDate: 'Set time',
  // "When" block (2026-07-26 clarity pass) — replaces the mislabelled taskStartSpecificDate
  // switch + the unlabelled calendar icon-button. `hasStartDate` is really "does this task
  // sit in the Whenever bucket or on a day", so the control names both sides of that.
  taskNameLabel: 'Name',
  taskWhenLabel: 'When',
  taskWhenWhenever: 'Whenever',
  taskWhenOnDay: 'On a day',
  taskWhenPickDay: 'Pick a day',
  taskHowOftenLabel: 'How often',
  taskTimeOfDayLabel: 'Time of day',
  taskStartFromLabel: 'Start from',
  taskStartFromNone: 'No start date',
  taskStartLabel: 'Start',
  taskFinishLabel: 'Finish',
  taskRecurDay: 'Day',
  taskRecurWeek: 'Week',
  taskRecurMonth: 'Month',
  // The quick-add's Repeat row said `t.off` ("off"/"av") for no recurrence — the app's
  // generic toggle word, which named neither this control nor this choice. It reads as one
  // of four options in the picker now, so it needs a word of its own (2026-08-05).
  taskRecurNever: 'Never',
  taskWeekInterval1: 'Every week',
  taskWeekInterval2: 'Every 2 wks',
  taskWeekInterval3: 'Every 3rd',
  taskMonthlyByDay: 'Day of month',
  taskMonthlyByWeekday: 'Weekday',
  taskMonthDayLabel: 'Day',
  taskOrdFirst: '1st',
  taskOrdSecond: '2nd',
  taskOrdThird: '3rd',
  taskOrdFourth: '4th',
  taskOrdLast: 'Last',
  taskSharedOut: 'Shared out',
  // Per-item card types (2026-08-01) — how ONE item draws itself. Named for the situation
  // you'd want them in, the same rule the layout names follow ("In the store", not
  // "Compact"). Deliberately NOT reusing "One thing at a time" — that is already the name
  // of a Plans LAYOUT (lib/cardLayout.ts's focusFirst), and two different things sharing a
  // name is how a setting gets changed by mistake.
  cardTypes: {
    // "Card style", not "Card" + a "Just for this one." sub-label (2026-08-09). The old pair
    // was a bare noun explaining its own SCOPE, which the control's placement inside one
    // item's own editor already says — every other setting on that screen is per-item too, and
    // none of them announces it. `label` now names what the control changes, per
    // DESIGN_RULES.md rule 22.
    label: 'Card style',
    // ONE word each. Four options share a single row, and a four-word row truncates at
    // 430px in English before Norwegian is even considered (measured with `npm run wraps`
    // — the repo's own audit for exactly this). The situational meaning that names would
    // normally carry lives in the description line below the picker instead, which is
    // always showing the selected option's own sentence.
    standard: 'Full',
    simple: 'Simple',
    note: 'Note',
    stepped: 'Steps',
    standardDesc: 'Everything this one has — time, energy, tags.',
    simpleDesc: 'Only the name and a tick. Nothing else shows.',
    noteDesc: 'Something to keep in the list. Nothing to finish.',
    steppedDesc: 'Shows one step at a time.',
    // Partial progress is progress — this is a count, never a shortfall.
    progress: (done: number, total: number) => `Step ${done} of ${total}`,
    allDone: 'All steps done',
    back: 'Back a step',
    // Shown on a stepped card that has no steps yet. It still behaves like an ordinary
    // card until there are some, so this points at the fix rather than reporting a fault.
    noSteps: 'Add a step in this card to take it one at a time.',
  },
  shoppingPreview: 'Shop soon',
  seeAll: 'See all →',
  /** Tail row of Shopping's Catalogue drawer (components/CatalogueTab.tsx in `embedded`
   *  mode) — the drawer shows a capped run of rows, this says how many it didn't and
   *  opens the full screen. Distinct from `home.andMore`, which is about TODAY
   *  specifically and can't be reused for a library screen. (Was SubScreenPreviewList's
   *  last row until that component was deleted, 2026-08-10.) */
  andMoreItems: (n: number) => `and ${n} more`,
  emptyMonthlyList: 'Nothing here yet — add your first staple item.',
  smallThingsCount: (n: number) => `You've done ${n} thing${n !== 1 ? 's' : ''} — small things add up!`,
  // "One thing at a time" layout (lib/cardLayout.ts's focusFirst, design-system v6's
  // `Focus First (1c)`). The done line is deliberately TODAY's count, not the all-time
  // `smallThingsCount` above — this layout is about the day in front of you.
  focusFirst: {
    nextUp: 'Next up',
    then: 'Then',
    doneToday: (n: number) => `${n} done — small things add up`,
    andMore: (n: number) => `and ${n} more today`,
    allClear: 'Nothing left today. That counts.',
    markDone: 'Done',
  },
  // Home Energy meter (components/EnergyMeter.tsx)
  energyMeter: {
    title: 'Energy',
    /* These two name the meter, not just the period (2026-08-03). They were 'Today' /
       'This week' and were passed ONLY in `energyMode: 'custom'`, where two meters are on
       screen and something has to tell them apart — the far commoner single-meter case
       drew no label at all, on the reasoning that a lone row makes its period obvious. It
       does; what it did not make obvious was what the row WAS. A first-time-user walkthrough
       read the ten pips plus "10 / 10" at the top of Home as a score or a level, which is
       precisely what this system must not read as. The label is now always drawn, and it
       carries the word "Energy" so the strip names itself. */
    today: 'Energy today',
    thisWeek: 'Energy this week',
    remaining: (n: number) => `${n} left`,
    usedOf: (used: number, cap: number) => `${used} / ${cap} used`,
    /** Title of components/EnergyConfigSheet.tsx, and the ✏️'s accessibility label. */
    editTitle: 'Adjust energy',
    todayCapacity: "Today's energy",
    weekCapacity: "This week's energy",
    /* One line per stepper in the config sheet, saying what that stepper CHANGES (2026-08-03).
       This is the copy half of the fix for "it is not obvious to a user what is what": a ± beside
       a `7 / 10` readout cannot say whether it moves the capacity or the spend, and on the strip
       there was no room to tell them. Neither line names a good number or suggests one. */
    todayCapacityHint: 'How much today holds. Every other day keeps its own number.',
    weekCapacityHint: 'How much the whole week holds.',
    done: 'Done',
    /** Permanent one-liner under the meter (components/EnergyMeter.tsx). Keep it to one
     *  sentence with no examples — see that file's "Permanent inline hint" note. */
    hint: 'Plan the day around the energy you actually have.',
    // The "+ today only" boost, in the ✏️ editor beside the capacity stepper (2026-08-02).
    // It is extra energy for ONE day, never a reward and never a target — the hint says
    // where it goes and that tomorrow is unaffected, and stops there. `overCommittedDay/Week`
    // and `depletedDay/Week` used to sit here; they were deleted with the two warning rows
    // they fed (t.energyPause replaces both).
    boostToday: 'Extra for today',
    boostHint: 'Some days hold more than usual. This is added to today alone, and tomorrow starts from my normal amount again.',
    /**
     * The temporary-extra chip on the day row (2026-08-03) — a neutral components/Badge beside
     * "Energy today" whenever a boost is set.
     *
     * A boost used to disappear into the total: `+3` on a 10-energy day simply printed
     * `13 / 13`, identical to somebody whose usual day is 13. "today only" is the whole
     * payload — it says the number is borrowed against one day, not that the day is bigger.
     * Keep it short enough to sit on a line that already carries a label and two glyphs.
     */
    boostChip: (n: number) => `+${n} today only`,
    /** Accessibility label for the extra pips drawn past a full bar (lib/energy.ts's `surplus`). */
    surplusLabel: (n: number) => `${n} beyond today's energy`,
  },
  /**
   * The daily energy pause (2026-08-02) — components/EnergyPauseSheet.tsx plus the meter's
   * overspend control. This copy REPLACES the amber "⚠️ Today is planned to use 3 more
   * Energy than you have available" line, which was the loudest piece of guilt copy left in
   * the app.
   *
   * Narrator voice: first person, no questions, no imperatives, no exclamation marks. The
   * sheet's two options carry equal weight in the words as well as in the layout — neither
   * `decide` nor `imGood` is phrased as the sensible one, and both after-lines are settled
   * rather than approving. Nothing here counts, compares or refers back to a previous day.
   */
  energyPause: {
    sheetLine: "That's more than a day's worth. Mine usually is too.",
    decide: "I'll decide",
    imGood: "I'm good",
    afterDecide: 'The rest keeps. This is the one.',
    afterGood: 'Fair. Some days you just go.',
    /** Accessibility label on the calm overspend control that opens the sheet. */
    overspendLabel: "Over today's energy — options",
    /** On the pinned card's badge — the tap target that removes the pin. */
    pinnedLabel: 'Pinned — tap to unpin',
  },
  a11yAdd: 'Add',
  a11yDiscardRow: 'Discard new row',
  showHint: 'How this works',
  hideHint: 'Hide instructions',
  /**
   * The pad (notepad) language, 2026-07-30 — shared by every list-bearing card so the four
   * Home cards stop wording the same control four different ways. `summary` is the closed
   * state's one line; `more`/`all`/`less` label the single chevron that cycles closed →
   * preview → open. `type.*` are the always-open first line's prompts, worded per card.
   */
  pad: {
    summary: (left: number, total: number) => `${left}/${total} left`,
    more: (n: number) => `${n} more`,
    all: 'Show all',
    less: 'Less',
    type: {
      note: 'Type note',
      task: 'Type task',
      habit: 'Type habit',
      item: 'Type item',
    },
    // Quick-add's second button, beside the confirm check (2026-08-05). It was a bare "…"
    // glyph labelled "Continue editing" — a name that only made sense while the button
    // required a typed draft. It is a worded, always-live button now: it opens the fuller
    // editor for what you are adding, carrying whatever you had typed, so it needs a name
    // that is true on an empty line too.
    moreOptions: 'More options',
    // Repeat picker (2026-08-05) — replaced a row that cycled none → daily → weekly →
    // monthly on tap, forward-only, with no way back and no cue that it cycled.
    recurrencePicker: 'How often?',
    // The type-line's options panel (2026-08-04) — the "Add as" row that toggles a task vs.
    // a day-log moment (components/PlanTaskCard.tsx's onCaptureMoment).
    captureTarget: {
      label: 'Add as',
      task: 'Task',
      moment: 'Moment',
    },
  },
  padRow: { actionLabel: 'More for this row' },
  /**
   * The day log — what already happened, behind the now-line (lib/dayLog.ts).
   *
   * Copy rules that are stricter here than anywhere else in the app, and are the feature:
   *   - No count, total or percentage in any string. Not even a friendly one.
   *   - No evaluation. No praise, no "productive day", no summary judgement. The entries
   *     speak; nothing here comments on them.
   *   - The past section has NO header. Do not add `Completed`/`Gjennomført` or similar —
   *     labelling the section turns a record into a scorecard.
   *   - Never `Summary`, `Progress`, `Statistics` or any translation of those.
   */
  dayLog: {
    title: 'Today',
    /**
     * The one first-person line in the entire app, and deliberately so — see VOICE.md.
     * It explains why the feature exists instead of instructing the user, which is the
     * only job an empty day has. Do NOT "correct" it into the app's usual second person,
     * and do not add a second line in this voice anywhere in this feature.
     */
    empty:
      "I remember the big things. It's everything in between that disappears — especially what happened in the middle of the chaos.",
    /** Placeholder on the capture field. Present tense, no prompt to categorise. */
    capturePrompt: 'What just happened?',
    /** The now-line's own label. Lowercase on purpose — it is a marker, not a heading. */
    now: 'now',
    /** Nothing scheduled ahead. A neutral statement of fact, not an invitation. */
    nothingAhead: 'Nothing fixed left today.',
    /** Entry point to the earlier-days screen. */
    earlierDays: 'Earlier days',
    /** Deleting a captured moment — the only entry the user can remove. */
    deleteMoment: 'Delete this note',
    /** Fallbacks for rows whose source row no longer has a name of its own. */
    kinds: {
      medicine: 'Medicine',
    },
    /** Which device calendars the timeline may READ. Never mentions granting access —
     *  declining is a supported permanent state and the picker just doesn't appear. */
    calendars: {
      title: 'Calendars on the timeline',
      hint: 'Events from these show up ahead of the now line. Nothing is written back.',
    },
  },
  /** The ⋯ router on a note row (components/SendToSheet.tsx). */
  sendTo: {
    title: 'Send it to…',
    todo: 'To-do',
    shopping: 'Shopping list',
    habits: 'Habits',
    goals: 'Goals',
  },
  // Task form
  newTask: 'New task',
  add: 'Add',
  taskTitlePlaceholder: 'What needs to be done?',
  dateLabel: 'Date',
  calendar: {
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    jumpToToday: 'Today',
    jumpToTodayHint: 'Jump to today',
    selectedSuffix: 'selected',
    todaySuffix: 'today',
  },
  pickOtherDate: (date: string) => `Pick another date (${date})`,
  hideCalendar: 'Hide calendar',
  timeLabel: 'Time',
  wheneverHint: "No fixed time — it'll show up as something to do that day.",
  lightDarkModeLabel: 'Light/Dark mode',
  darkModeSystem: 'System',
  darkModeOn: 'On',
  darkModeOff: 'Off',
  durationLabel: 'Duration (minutes)',
  durationPlaceholder: 'min',
  // Energy system (task-form + habit-form)
  energyConsumeLabel: 'Affects energy',
  // 2026-07-26 clarity pass: the separate "Affects energy" switch + "Energy value" stepper
  // collapsed into ONE labelled stepper where 0 = no effect (energyEnabled is derived on
  // save). Same maths, half the controls.
  energyGiveTakeLabel: 'Energy give / take',
  energyGiveTakeHint: 'Minus costs you energy, plus gives it back. 0 = no effect.',
  stepPlaceholder: 'Add a step',
  deleteTask: 'Delete plan',
  // Task form — "next-time hint" note field (Decision 019, freeform, display-only)
  taskHintLabel: 'Next time…',
  taskHintPlaceholder: 'e.g. Keep the charger in the top drawer',
  // Task form — "then" follow-up link (Decision 020, one-to-one, surfacing-only)
  thenTaskLabel: 'Then',
  thenTaskNone: 'No follow-up task set',
  thenTaskPick: '+ Pick a task',
  thenTaskRemove: 'Remove link',
  thenTaskEmptyList: 'No eligible tasks to link',
  // TaskCard's collapsed-by-default reveal for Energy/Hint/Contact/Location/Goal/Then
  // (UX audit B1/F3 — ported from the retired app/task-form.tsx, 2026-07-23)
  taskAdvancedOptions: 'Advanced options',
  // Task form — voice dictation (reserve-only, lib/useVoiceCapture.ts), gated on settings.voiceNotesEnabled
  taskVoiceTitleLabel: 'Dictate title',
  taskVoiceTitleStop: 'Stop dictating title',
  // Task form — attach a contact (reserve-only, expo-contacts), gated on settings.contactsEnabled
  taskContactLabel: 'Contact',
  taskContactNone: 'No contact attached',
  taskContactPick: 'Attach a contact',
  taskContactRemove: 'Remove contact',
  // Task form — tag with current location (reserve-only, expo-location), gated on settings.locationEnabled
  taskLocationLabel: 'Location',
  taskLocationNone: 'No location tagged',
  taskLocationAdd: 'Tag my current location',
  taskLocationRemove: 'Remove location',
  taskLocationTagged: 'Location tagged',
  taskLocationPermissionBody: 'Location access is required to tag this task.',
  taskLocationErrorBody: "Couldn't get your location — try again.",
  // Task form — save confirmation (W-B). `day` is a localized reference (Today / Tomorrow / Monday…).
  taskSavedSimple: 'Saved ✓',
  // Scan
  scanReceipt: 'Scan receipt',
  scanHintBanner: 'Point your camera at a receipt. Make sure text is clear and well-lit.',
  // --- W-C Grocery additions (scan) ---
  // --- end W-C additions ---
  store: 'Store',
  otherStore: 'Other store…',
  customStoreLabel: 'Store name',
  customStorePlaceholder: 'e.g. Local shop',
  selectStoreFirstTitle: 'Pick a store',
  selectStoreFirstBody: 'Please select which store this receipt is from before adding items.',
  takePhoto: 'Take photo',
  chooseFromLibrary: 'Choose from library',
  addManually: 'Add manually',
  analysingReceipt: 'Analysing receipt…',
  recognisedItems: 'Recognised items – select which to add',
  addToList: (n: number) => `Add ${n} item${n !== 1 ? 's' : ''} to shopping list`,
  scanningSubtitle: 'Finding items and prices',
  foundOnReceipt: 'Found on receipt',
  itemsSelectedCount: (n: number, total: number) => `${n} of ${total} items selected. Deselect items you don't want to add.`,
  addToListButton: (n: number) => `Add to shopping list (${n})`,
  totalAmount: (formattedSum: string) => `Total: ${formattedSum}`,
  manualEntryTitle: 'Type in manually',
  manualEntryHint: "Type item names, one per line. We'll add them to your shopping list.",
  manualEntryPlaceholder: 'Milk\nBread\nEggs\n...',
  addedTitle: 'Added!',
  addedBody: (n: number) => `${n} item${n !== 1 ? 's' : ''} added to your shopping list.`,
  addItemBtn: 'Add item',
  // Settings
  settingsTitle: 'Settings',
  version: {
    title: 'Version & updates',
    appVersion: 'App version',
    runtime: 'Runtime',
    channel: 'Channel',
    source: 'Running',
    sourceEmbedded: 'Built-in bundle',
    sourceOta: 'OTA update',
    updateId: 'Update ID',
    published: 'Published',
    embedded: 'built-in',
    checkButton: 'Check for updates',
    checking: 'Checking…',
    upToDate: 'You’re on the latest update.',
    downloaded: 'Update downloaded — restarting…',
    failed: 'Could not check for updates. Check your connection and try again.',
    disabled: 'This build has over-the-air updates turned off (it’s a debug build). Install a release build to receive OTA updates.',
    updateAvailable: 'Update available — tap to install and restart',
    experimental: 'Experimental build — UnFocus is a work in progress, so things may change, move or break.',
  },
  sectionProfile: 'Profile',
  yourName: 'Your name',
  namePlaceholder: 'First name (optional)',
  sectionShopping: 'Shopping list',
  weeklyResetDay: 'Reset weekly list on (weekday)',
  monthlyResetDate: 'Reset monthly list on date',
  weeklyReminders: 'Weekly reminders',
  reminderTimeLabel: 'Reminder time (HH:MM)',
  timeInputPlaceholder: 'HH:MM',
  taskNotifications: 'Plan notifications',
  taskNotificationsHint: 'Reminder when a plan starts',
  persistentNotifLabel: "Today's overview notification",
  persistentNotifHint: "Keeps one notification up to date with today's remaining tasks and shopping items",
  habitNotifications: 'Habit reminders',
  habitNotificationsHint: "Reminder when it's time for a habit",
  // From/To are the generic time-range labels — the only remaining consumer is the
  // quiet-hours range in Settings → Personal. (The rest of the Work-mode strings were
  // deleted with that card in the 2026-07-25 settings reorganization: every one of its
  // switches wrote a column no code ever read.)
  workHoursFrom: 'From',
  workHoursTo: 'To',
  sectionLanguage: 'Language',
  sectionReset: 'Reset data',
  resetMonthly: 'Reset monthly list',
  resetTasks: 'Reset all to-dos',
  resetOnboarding: 'Reset onboarding',
  resetConfirmTitle: (label: string) => `Reset ${label}?`,
  resetConfirmBody: 'This cannot be undone.',
  resetConfirmBtn: 'Reset',
  deleteConfirmTitle: (label: string) => `Delete ${label}?`,
  deleteConfirmBody: 'Are you sure?',
  deleteConfirmBtn: 'Delete',
  // Onboarding
  features: [
    { icon: 'home-outline', text: 'Home — quick actions and a simple overview of your day' },
    { icon: 'checkbox-outline', text: "A to-do list that holds what today needs, so you don't have to remember it" },
    { icon: 'cart-outline', text: "Shopping lists that reset themselves, what's already in your cupboards, and recipes you can push straight to the list" },
    { icon: 'repeat-outline', text: 'Habits that give your days structure, one day at a time — no streak to lose' },
    { icon: 'heart-outline', text: 'Health — log symptoms and occurrences, and see the trends over time' },
    { icon: 'battery-half-outline', text: 'An energy system that balances to-dos, habits and health against the energy you actually have' },
  ],
  monthlyResetDateQuestion: 'Which date does the monthly list reset?',
  weeklyRemindersOnboarding: 'Weekly reminders',
  /* The AI setup guide. It was one of three peer cards on the deleted branch screen; since
     2026-08-03 it is a secondary link on app/onboarding/privacy.tsx, plus Settings and the
     guided tour's closing card. `aiSetupDesc` went with the card — a link does not carry a
     two-line description — but the round trip it described still needs saying somewhere
     before the tap, which is `aiSetup.*`'s job on the Settings screen. */
  aiSetupBtn: 'Set it up with an AI',
  aiSetupPickAnother: 'You can pick another way to start.',
  /* `introPrinciples`, `introExperimental` and the whole `energyIntro` block were deleted on
     2026-08-03 with the screens that rendered them (app/onboarding/{intro,energy}.tsx —
     intro went on 2026-07-31, energy in the two-screen cut). The Energy-vs-Rewards wording
     lives on as `config.features.energy.modes` in Settings, which is now the only place the
     choice is offered; the "experimental build" note lives on as `tour.finale.experimental`. */
  // First-run personalization. Was app/first-run.tsx's four-step wizard, then
  // app/onboarding/basics.tsx's six rows on one screen; since 2026-08-03 onboarding shows
  // only the language row and the full six are behind Settings' "Run setup again".
  // Labels that already exist elsewhere are REUSED rather than restated — text sizes come
  // from settings.accessibility.fontSize*, starting screens from nav.* — so the flow and
  // Settings say the same words for the same value. The one exception is appearance: the
  // Settings control is a segmented "Light/Dark mode" row whose options are Off/System/On,
  // which read as nothing at all on a standalone card, so this step names them outright.
  firstRun: {
    // Quiet step position. Deliberately a count, never a filling progress bar.
    step: (n: number, total: number) => `${n} of ${total}`,
    skip: 'Skip for now',
    continue: 'Continue',
    finish: 'Done',
    settingsNote: 'You can change any of this later in Settings.',
    reRun: 'Run setup again',
    reRunHint: 'Step through motion, text size, appearance and starting screen again. It starts from what you have now.',
    motion: {
      title: 'How much movement do you want?',
      sub: 'Animation can help things feel connected, or it can get in the way.',
      osReduced: 'Your phone asks for reduced motion, so the app already keeps movement down.',
      full: { label: 'Full', desc: 'Smooth transitions and moving background.' },
      reduced: { label: 'Reduced', desc: 'Transitions stay, moving background goes.' },
      none: { label: 'None', desc: 'No animation anywhere.' },
    },
    textSize: {
      title: 'How large should text be?',
      sub: 'This screen changes as you tap, so you can see the size you are picking.',
      small: 'A little smaller than standard.',
      default: 'The standard size.',
      large: 'Larger text everywhere in the app.',
    },
    appearance: {
      title: 'Pick how the app looks.',
      sub: 'This screen changes as you tap.',
      off: { label: 'Light', desc: 'Dark text on a light background.' },
      system: { label: 'System', desc: "Follows your phone's light or dark setting." },
      on: { label: 'Dark', desc: 'Light text on a dark background.' },
    },
    startScreen: {
      title: 'Where should the app open?',
      // Short form for the permanent control in Settings → Personal → Layout, where a
      // question would read oddly next to the other field labels.
      settingsLabel: 'Starting screen',
      sub: 'Every other tab stays one tap away.',
      home: 'The day at a glance.',
      plans: "The day's to-do list.",
      shopping: 'Your shopping lists.',
    },
  },
  // The guided tour (components/TourSpotlight.tsx + lib/tourSteps.ts) — one step per feature,
  // running on the real app. It replaced an 8-page slideshow that described features on cards
  // the user could not touch. Every step is skippable on its own AND the whole tour can be
  // dismissed from any step, so nothing here should read as a requirement or a checklist.
  tour: {
    step: (n: number, total: number) => `${n} of ${total}`,
    next: 'Got it',
    /* `skipStep` ("Skip this") was deleted 2026-08-03. It sat beside `next` and did exactly
       what `next` did — both recorded the step — so the card offered three buttons for two
       outcomes and asked the reader to tell "Skip this" from "Skip the tour". */
    skipAll: 'Skip the tour',
    steps: {
      home: {
        title: 'Home is the day at a glance',
        body: 'Whatever is happening today gathers here — to-dos, shopping, habits. Hold a card to move it, so the thing you look at most sits at the top.',
      },
      plans: {
        title: 'To-do holds what today needs',
        body: 'Add one thing you want to get done. Small is good — a task you can finish beats a task you keep rewriting.',
      },
      shopping: {
        title: 'Shopping resets itself',
        body: 'A weekly list for groceries and a monthly one for what the house needs. Tick things off as you go; the weekly list starts fresh on the day you choose.',
      },
      habits: {
        title: 'Habits, one day at a time',
        body: 'Pick one to start with. There is no streak to lose here — a quiet day is just a quiet day.',
      },
      health: {
        title: 'Health notices patterns',
        body: 'Log a symptom or how you slept, and the trends build up over time. Medicine sits here too, in morning, midday, evening and night trays.',
      },
    },
    finale: {
      title: 'That is the tour',
      body: 'Everything else is reachable from these five tabs, and each screen has an ⓘ button with tips and settings for that screen.',
      experimental: 'UnFocus is a work in progress. Things may change, move or arrive half-finished — that is expected. Everything stays on your phone, and all feedback shapes what comes next.',
      done: 'Start using the app',
    },
  },
  // The Basics screen (app/onboarding/basics.tsx) — the six setup rows on one screen. Most of
  // its copy is REUSED from firstRun.* above, so a value described here and the same value in
  // Settings say the same words. Only the row labels and the two rows that had no wizard step
  // of their own (language, handedness) live here.
  basics: {
    /* `title`/`sub` are the SETTINGS re-run wording ("Run setup again"), where all six rows
       show and "what am I picking" is the only question left. The pair below is what a brand
       new user sees, where it is not (2026-08-03). */
    title: 'A few basics',
    sub: 'This screen changes as you tap, so you can see what you are picking. All of it has a working default already.',
    /* Screen ONE of a fresh install. Its job is to answer "what is this?" — the old first
       screen was a six-row settings form that never said, and a first-time-user walkthrough
       got all the way through onboarding and the guided tour without finding out. Name the
       four things the app holds, in the order the tabs sit in, and say the one thing that
       makes it different from every other list app. The privacy screen says the local-only
       part, so this one must not spend a line on it. */
    welcomeTitle: 'Your day, in one place',
    welcomeSub: 'UnFocus keeps to-dos, shopping, habits and health together, so there is one place to look. Nothing here keeps score.',
    appearance: 'Appearance',
    textSize: 'Text size',
    motion: 'Movement',
    language: {
      label: 'Language',
      // Language names are deliberately NOT translated — you have to be able to find your own
      // language without already reading the current one.
      en: { label: 'English', desc: 'The app speaks English.' },
      no: { label: 'Norsk', desc: 'The app speaks Norwegian.' },
    },
    handedness: {
      label: 'Menu side',
      right: { label: 'Right', desc: 'Menu button on the right, for a right hand.' },
      left: { label: 'Left', desc: 'Menu button on the left, for a left hand.' },
    },
  },
  chooseLanguage: 'Choose language',
  chooseLanguageSub: 'You can change this in Settings at any time.',
  english: 'English',
  norwegian: 'Norwegian',
  dayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  dayFull: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  today: 'Today',
  addTime: '+ Add time',
  permissionTitle: 'Permission needed',
  permissionBody: 'Camera access is required to scan receipts.',
  // Shopping screen
  shoppingTitle: 'Shopping list',
  shoppingRemaining: (r: number, c: number) => `${r} remaining · ${c} in cart`,
  shoppingItemPlaceholder: 'Item',
  shoppingUnitPlaceholder: 'Unit (pcs, kg, l…)',
  inCart: 'In cart',
  // --- W-C Grocery additions (shopping) ---
  itemAddedToList: (name: string) => `${name} added ✓`,
  itemAddedToNamedList: (name: string, listName: string) => `${name} added to ${listName} ✓`,
  itemAddedToInventory: (name: string) => `${name} added to inventory ✓`,
  itemsAddedToList: (n: number) => `${n} items added ✓`,
  // Decision 022 drag-to-merge — transient toast after a same-name merge / dish-join drop
  mergedIntoDish: (dish: string) => `Combined into ${dish} ✓`,
  movedToDish: (dish: string) => `Moved into ${dish} ✓`,
  itemPutBackToInventory: (name: string) => `${name} put back in inventory`,
  // --- end W-C additions ---
  weeklyTabLabel: 'Week lists',
  monthlyTabLabel: 'Monthly list',
  // --- Katalog/Ukeliste redesign ---
  inWeeklyListSection: 'Shopping list',
  purchasedThisMonthSection: 'Purchased this month',
  tripLabel: (date: string) => `Shopped ${date}`,
  temporaryBadge: 'Temporary',
  updateSheetTitle: 'Update item',
  varenavnLabel: 'Item name',
  estimertPrisLabel: 'Estimated price',
  onsketAntallLabel: 'Target quantity at reset',
  onsketAntallWeeklyLabel: 'Desired quantity',
  midlertidigToggleLabel: 'Temporary',
  saveBtn: 'Save',
  cancelBtn: 'Cancel',
  deleteFromCatalogBtn: 'Delete from catalog',
  deleteConfirmText: 'Are you sure?',
  inKurvenSection: (n: number) => `In cart (${n})`,
  doneShoppingBtn: 'Shopping complete 🛍️',
  doneShoppingReceiptTitle: 'Got a receipt?',
  doneShoppingReceiptBody: 'Scan or upload it to log your spending, or skip and just finish up.',
  scanReceiptBtn: 'Scan receipt',
  uploadPhotoBtn: 'Upload photo',
  skipBtn: 'Skip',
  doneShoppingSuccessText: 'Nice work!',
  weeklyEmptyTitle: 'Nothing on the list yet',
  weeklyEmptySubtitle: 'Add items below.',
  unsavedShoppingBanner: (n: number) => `Unsaved: ${n} list${n === 1 ? '' : 's'} still unlocked`,
  // Empty containers in shopping screen
  newWeeklyListTitle: 'Create a new list',
  startEmptyList: 'Start empty',
  deleteList: 'Delete list',
  deleteListConfirmTitle: 'Delete this list?',
  deleteListConfirmBody: 'This will permanently remove the list and all its items.',
  // Inventory edit screen
  inventoryEditTitle: 'Edit inventory',
  manageInventoryAction: 'Manage inventory',
  // Monthly reset summary
  monthlyResetSummaryTitle: 'Monthly list reset',
  monthlyResetSummaryInventorySection: 'Inventory',
  monthlyResetSummarySpentLabel: (formattedAmount: string) => `${formattedAmount} spent`,
  monthlyResetSummaryOfTotalLabel: (formattedAmount: string) => `of ${formattedAmount} total value`,
  monthlyResetSummaryAdHocSection: 'Other purchases',
  monthlyResetSummaryEmpty: 'Nothing was purchased this period.',
  monthlyResetSummaryCloseBtn: 'Got it',
  // Monthly reset review (pre-reset: keep/discard lists, update inventory)
  monthlyResetReviewTitle: 'Before we reset…',
  monthlyResetReviewIntro: 'Review your lists and inventory, or skip and use the defaults.',
  monthlyResetReviewListsSection: 'Your lists',
  monthlyResetReviewKeepListLabel: 'Keep this list',
  monthlyResetReviewListItemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  monthlyResetReviewEmptyLists: 'No lists yet.',
  monthlyResetReviewInventorySection: 'How much do you have left?',
  monthlyResetReviewInventoryHint: 'Adjust the count for items you still have in stock.',
  monthlyResetReviewEmptyInventory: 'Your inventory is empty.',
  monthlyResetReviewSkipBtn: 'Skip',
  monthlyResetReviewConfirmBtn: 'Looks good, reset',
  // --- Multiple, named, recurring shopping lists ---
  listSettingsTitle: 'List settings',
  listRecurringToggleLabel: 'Repeat this list',
  listActiveWeeksLabel: 'Active weeks of the month',
  weekNumberChip: (n: number) => `Week ${n}`,
  // Shopping redesign — monthly two-section + weekly inline/preview + grouping screen
  monthlyListSection: 'Monthly list',
  // Shopping — Monthly redesign (2026-07-22): multiple named, budgeted Monthly lists
  newMonthlyListBtn: 'New list',
  newMonthlyListNamePlaceholder: 'List name',
  createMonthlyListBtn: 'Create',
  monthlyListsEmpty: 'No monthly lists yet — create one to get started.',
  deleteMonthlyListAction: 'Delete this list',
  weekEmptyTitle: 'No lists this week yet',
  weekEmptyBody: 'Make a new list below to get started.',
  catalogueSearchPlaceholder: 'Search the catalogue…',
  monthlyListTotal: (kr: string) => `Total: ${kr}`,
  monthlyListEmpty: 'Nothing added yet — pick from the catalogue below.',
  monthlyPreviewSearchPlaceholder: 'Search monthly list…',
  monthlyPreviewEmpty: 'Your monthly list is empty.',
  weekListTotal: (kr: string) => `Total: ${kr}`,
  savedListsTitle: 'Saved lists',
  saveListAsTemplateBtn: 'Save as template',
  savedListsEmpty: 'No saved lists yet.',
  templateAppliedToast: 'Template added to your list',
  listSavedAsTemplateToast: 'List saved as template',
  savedListsSectionHint: 'Drag into a week below, or tap to choose one',
  savedListsChooseWeekBody: 'Add this saved list to:',
  savedListInUseLabel: 'In use',
  templateAlreadyInWeek: (n: number) => `Already in Week ${n}`,
  listSyncedToast: 'Saved list updated',
  syncListButtonLabel: 'Sync to saved list',
  decreaseQty: 'Decrease quantity',
  increaseQty: 'Increase quantity',
  removeItemLabel: 'Remove item',
  putBackItemLabel: 'Put back in stock',
  categoryPickerLabel: 'Category (optional)',
  categoryLabels: {
    produce: 'Produce',
    dairy: 'Dairy',
    meatFish: 'Meat & fish',
    bakery: 'Bakery',
    pantry: 'Pantry',
    frozen: 'Frozen',
    household: 'Household',
    other: 'Other',
  },
  // --- Session A2·2: WeekListCard chrome + sticky-header overflow (Decision 011) ---
  toBuySection: (n: number) => `To buy (${n})`,
  inCartSection: (n: number) => `In cart (${n})`,
  purchasedSection: (n: number) => `Purchased (${n})`,
  fromMonthlySection: 'From monthly list',
  addSelectedItemsBtn: (n: number) => `Add (${n})`,
  categoryFilterAllLabel: 'All categories',
  categoryFilterAccessibilityLabel: 'Filter by category',
  weeklyListSearchPlaceholder: 'Search this list…',
  addItemInputPlaceholder: 'Search for items…',
  savedListsButtonLabel: 'Saved lists',
  deleteListButtonLabel: 'Delete list',
  listSettingsButtonLabel: 'List settings',
  lockListButtonLabel: 'Lock list',
  unlockListButtonLabel: 'Unlock list',
  shoppingListPlaceholder: 'Shopping list',
  listSaveButtonLabel: 'Save changes',
  listDiscardButtonLabel: 'Discard changes',
  unsavedListChangesTitle: 'Unsaved changes',
  unsavedListChangesBody: 'Save your changes to this list before locking it?',
  saveAndLockBtn: 'Save & lock',
  discardAndLockBtn: 'Discard & lock',
  weekSectionEmpty: 'No lists yet.',
  listMovedToWeek: (n: number) => `Moved to Week ${n}`,
  expandListLabel: 'Expand list',
  collapseListLabel: 'Collapse list',
  listOptionsButtonLabel: 'List options',
  addFromMonthlyOption: 'From monthly',
  addFromDishOption: 'From a dish',
  resetMonthlyListAction: 'Reset this list now',
  resetMonthlyListConfirmTitle: 'Reset this list?',
  resetMonthlyListConfirmBody: 'This clears temporary items and starts a fresh reset period for this list only.',
  resetAllMonthlyListsAction: 'Reset all monthly lists now',
  resetAllMonthlyListsConfirmTitle: 'Reset all monthly lists?',
  resetAllMonthlyListsConfirmBody: 'This clears temporary items across every monthly list and logs a fresh reset period. It normally happens automatically on your reset date.',
  // --- Shopping/Food redesign: in-place Food + Catalogue tabs, Unallocated section ---
  foodTabLabel: 'Food',
  catalogueTabLabel: 'Catalogue',
  foodEmptyHint: 'No dishes yet — tap + to add one.',
  addDishToMealBtn: 'Add dish',
  // Dish "+" popup
  addDishPopupTitle: (dish: string) => `Add ${dish}`,
  addToWeekListBtn: 'Add to week list',
  addToMonthlyListBtn: 'Add to monthly list',
  addToListNoIngredients: 'This dish has no ingredients yet.',
  closePopupLabel: 'Close',
  dishAddedToWeek: (dish: string) => `${dish} added to Unallocated ✓`,
  dishAddedToMonthly: (dish: string) => `${dish} added to monthly list ✓`,
  // Weekly "Unallocated" section (dishes added to the week but not yet a specific list)
  unallocatedSection: 'Unallocated',
  unallocatedHint: 'Dishes you added to the week — move each into a list.',
  allocateToListTitle: 'Add to which list?',
  allocateItemLabel: 'Move to a week list',
  noWeekListsYet: 'Create a week list first.',
  // Catalogue tab
  catalogueAddNewBtn: 'Add new item',
  catalogueItemNamePlaceholder: 'Item name',
  catalogueItemPricePlaceholder: 'Price (kr)',
  catalogueDeleteItemLabel: 'Delete item',
  catalogueEmpty: 'No items yet — add one above.',
  catalogueItemAdded: (name: string) => `${name} added ✓`,
  catalogueSearchClearLabel: 'Clear search',
  catalogueNoMatches: 'No items match your search.',
  catalogueIndexScrubLabel: 'Jump to letter',
  errorBoundaryTitle: 'Something went wrong',
  errorBoundaryRetry: 'Try again',
  category: 'Category',
  shoppingCategories: {
    produce: 'Fruit & veg',
    dairy: 'Dairy',
    meat: 'Meat',
    fish: 'Fish',
    bread: 'Bread',
    frozen: 'Frozen',
    canned: 'Canned',
    dry: 'Dry goods',
    snacks: 'Snacks',
    drinks: 'Drinks',
    cleaning: 'Cleaning',
    personal: 'Personal care',
    other: 'Other',
  },
  monthlyDateInputHint: 'Any day 1–31. Short months use the last day.',
  invalidMonthlyDateMsg: 'Enter a day between 1 and 31 — reverted to the previous value.',
  // Habits
  habitsTitle: 'Habits',
  habitToday: 'Today',
  habitWeekView: 'Week',
  habitMonthView: 'Month',
  reminders: 'Reminders',
  habitFormTitle: 'New habit',
  habitFormEdit: 'Edit habit',
  habitDailyGoal: 'Times per day',
  habitWeeklyGoal: 'Times per week',
  habitRecurrence: 'Interval',
  habitRecurrenceDaily: 'Daily',
  habitRecurrenceWeekly: 'Weekly',
  habitRecurrenceMonthly: 'Monthly',
  habitRecurrenceWeeklyFlexible: 'Flexible',
  habitRecurrenceWeeklyFlexibleHint: 'Any day counts — shows up daily until you’ve logged it enough times this week.',
  // "Every N days/weeks" (2026-08-11) — the interval multiplier on daily/weekly recurrence,
  // shown as the sentence-as-label for the quick-add's Stepper cell (components/
  // HabitRecurrenceCells.tsx) and repeated on app/habit-form.tsx's own "How often" section.
  habitEveryNDaysLabel: (n: number) => `Every ${n} days`,
  habitEveryNWeeksLabel: (n: number) => `Every ${n} weeks`,
  habitRepeatDaysLabel: 'Which days',
  habitTitleLabel: 'Name',
  habitTitlePlaceholder: 'E.g. Drink water',
  habitIconLabel: 'Icon',
  habitDeleteLabel: 'Delete habit',
  habitNotification: 'Daily reminder',
  // 2026-07-26 clarity pass. A habit is recurring by definition, so there is no repeat
  // switch — habitHowOften replaces the vague "Interval" label and asks the only real
  // question (which days). habitReminderLabel drops "Daily" (a habit can be weekly/monthly),
  // and habitReminderTimeLabel stops habitNotification doubling as the time field's label.
  habitHowOften: 'How often',
  habitReminderLabel: 'Reminder',
  habitReminderTimeLabel: 'Time',
  habitReminderOffHint: 'No reminder — the habit still shows up on its days.',
  habitMoreOptionsHint: 'tap to change the schedule, icon or category.',
  habitReminderModeSingle: 'Once',
  habitReminderModeCount: 'Several times',
  habitReminderModeInterval: 'Every…',
  habitReminderCountLabel: 'How many times a day',
  habitReminderIntervalLabel: 'Gap between reminders',
  habitReminderStartLabel: 'First reminder',
  habitReminderEndLabel: 'Last reminder',
  habitReminderEveryHours: (h: number) => `Every ${h} h`,
  habitReminderEveryMinutes: (m: number) => `Every ${m} min`,
  habitReminderTimesPreview: (n: number) => `${n} reminder${n !== 1 ? 's' : ''} a day`,
  noHabitsYet: 'No habits yet — add one below.',
  habitForLabel: 'For',
  habitForMe: 'Me',
  // People / family mode (2026-07-12 redesign) — one settings toggle that shows the
  // person selector in Tasks + Habits. People are managed in Settings.
  // 2026-07-28: backed by the People registry (store/usePeopleStore.ts) instead of a list
  // of names, so everyone has a colour and keeps their tasks through a rename.
  peopleMode: {
    label: 'People / family',
    hint: 'Assign tasks and habits to the people in your household.',
    profilesHint: 'Add the people you want to assign tasks and habits to. Tap a colour to change it.',
    addPlaceholder: 'Name',
    addButton: 'Add person',
    removeTitle: (name: string) => `Remove ${name}?`,
    removeBody: "Their tasks and habits won't be deleted — they move back to you.",
    filterAll: 'Everyone',
    /** Row label for the person representing this device's owner. */
    you: 'You',
    /** Shown under someone whose phone is paired — their side updates by itself. */
    linkedDevice: 'Synced with their phone',
    /** Shown under someone with no paired phone — you keep their side up to date yourself. */
    onThisPhone: 'Kept on this phone',
  },
  tags: {
    /** Row label in the task editor, beside the "For" person row. */
    label: 'Tags',
    /** The "coin a new tag" chip. */
    new: 'New',
    newPlaceholder: 'Tag name',
    /** Settings card. */
    settingsTitle: 'Tags',
    settingsHint:
      'Tags are shared with everyone you are paired with, so a tag means the same thing on both phones. Renaming one updates every task that carries it.',
    empty: 'No tags yet. Add one from a task.',
    removeTitle: (name: string) => `Remove ${name}?`,
    removeBody: 'The tasks keep everything else — they just lose this tag.',
    /** Plans filter row: clears the tag filter. */
    filterAll: 'All tags',
    /** Count cue when a row has more tags than it can draw. */
    more: (n: number) => `+${n}`,
  },
  energyBalance: {
    title: 'Shared load',
    day: 'Today',
    week: 'This week',
    /** Energy left if everything booked happens, against their own capacity. */
    projected: (left: number, capacity: number) => `${left} / ${capacity}`,
    /** Their habits live on their own phone and habits don't sync — the bar is a floor. */
    tasksOnly: 'Tasks only — their habits stay on their phone',
    /** Deliberately never says anyone is doing too little. See the card's header. */
    lopsided: (name: string) => `${name} is carrying most of this. Moving one thing would even it out.`,
    shared: 'This looks evenly shared.',
  },
  rotation: {
    label: 'Take turns',
    off: 'Off',
    daily: 'Each day',
    weekly: 'Each week',
    monthly: 'Each month',
    /** Who is in the rotation, in order. */
    rosterLabel: 'In this order',
    /** Whose turn it is on the day being viewed. */
    turn: (name: string) => `${name}'s turn`,
    /** Same line when the turn is YOURS — "Me's turn" is not a sentence. */
    turnYou: 'Your turn',
    /** A rotation with fewer than two people can never change hands. */
    needsTwo: 'Pick at least two people for this to take turns.',
    /** Section header for tasks nobody is assigned. */
    unassigned: 'Anyone',
  },
  habitCategories: {
    physical: 'Physical',
    mental: 'Mental',
    health: 'Health',
    nutrition: 'Nutrition',
    sleep: 'Sleep',
    work: 'Work',
    wellbeing: 'Wellbeing',
    other: 'Other',
  },
  // Sharing
  sharedTitle: 'Shared',
  sharedTasks: 'Shared to-dos',
  sharedShopping: 'Shared shopping',
  shareSelected: 'Share selected',
  shareSendText: 'Send as text',
  shareTitle: 'Share list',
  shareInstructions: 'Ask the other person to open UnFocus, tap Scan, then tap "Scan QR code".',
  // Plain-language "what does sharing do here" copy (HintCard on each share surface).
  // Note: this is a one-time copy today, either way — no live phone-to-phone sync yet.
  shareExplainShopping: 'Share a QR code the other person scans into their own UnFocus shopping list, or send the list as text — no UnFocus needed on their end.',
  shareExplainTasks: 'Share a QR code the other person scans into their own UnFocus, or send the list as text — no UnFocus needed on their end.',
  shareExplainLaterBuild: 'For now it\'s a one-time copy — live sync between phones comes in a later build.',
  // Child mode (Decision 038c) — locked variant gated by a parent password.
  scanQrCode: 'Scan QR code',
  qrScanMode: 'Scan shared list',
  qrScanInstructions: 'Point your camera at a QR code from another UnFocus user.',
  qrScanSuccess: 'List received!',
  qrScanSuccessBody: (n: number, kind: 'tasks' | 'shopping') =>
    `${n} ${kind === 'tasks' ? `plan${n !== 1 ? 's' : ''}` : `item${n !== 1 ? 's' : ''}`} added to your shared list.`,
  qrInvalid: 'This does not look like an UnFocus QR code.',
  sharedDone: 'Done',
  sharedFromLabel: (name: string) => `From ${name}`,
  sharedBySelf: 'Shared by you',
  noSharedItems: 'Nothing shared yet. Share a list or scan someone\'s QR code.',
  selectAll: 'Select all',
  deselectAll: 'Deselect all',
  sharedTasksTab: 'To-do',
  sharedShoppingTab: 'Shopping',
  // LAN live-sync (Decision 038 app integration) — pairing + sync toggle
  peers: {
    title: 'Paired devices',
    settingsCardDesc: 'Keep tasks and the shopping list in sync automatically with a paired phone on the same Wi-Fi.',
    syncToggleLabel: 'Sync over Wi-Fi',
    syncUnavailable: 'Live sync needs a build with the network modules installed — not available in this app version yet.',
    manageLink: 'Paired devices →',
    noPeers: 'No paired devices yet.',
    pairedAt: (date: string) => `Paired ${date}`,
    addDevice: 'Pair a device',
    removeDevice: 'Remove',
    removeConfirmTitle: 'Remove this device?',
    removeConfirmBody: 'It will stop syncing with this phone. You can pair it again later.',
    chooseRoleTitle: 'Pairing a device',
    chooseRoleExplain: 'Both phones need to be in the same room. On ONE phone, tap "Show my code" — on the OTHER, tap "Scan a code".',
    showMyCode: 'Show my code',
    scanACode: 'Scan a code',
    showCodeInstructions: 'Have the other phone scan this code.',
    showCodeNext: 'Next: scan their code',
    showCodeDone: 'Done',
    scanInstructions: "Point your camera at the other phone's code.",
    pairInvalid: 'That does not look like an UnFocus pairing code.',
    pairedSuccessTitle: 'Paired!',
    pairedSuccessBody: (name: string) => `You're now paired with ${name}.`,
  },
  // Notifications (shown to the user in their chosen language)
  notif: {
    // W-F: friendlier, non-urgent weekly nudge ("want to?" energy, no pressure)
    weeklyTitle: 'Want to plan your week?',
    weeklyBody: "Whenever you're ready, take a peek at what's coming up. No rush — you've got this.",
    // W-F: monthly title + body now explain the effect (the list will reset)
    monthlyTitle: 'Heads up: monthly list resets soon',
    monthlyBody: 'Your monthly shopping list will clear tomorrow, so check what you still need at home first.',
    taskStartTitle: (title: string) => `Reminder: ${title}`,
    taskStartBody: 'Time to get started!',
    taskBoxTitle: (title: string) => `Start: ${title}`,
    taskBoxBody: (min: number) => `You have ${min} minutes for this. Good luck!`,
    taskEndTitle: (title: string) => `Done: ${title}`,
    taskEndBody: (min: number) => `${min} minutes are up. Well done — you can stop now.`,
    habitReminderTitle: (title: string) => `Habit: ${title}`,
    habitReminderBody: 'A gentle nudge for today.',
    overviewTitle: "Today's overview",
    overviewBodyNoTasks: 'No tasks left today',
    overviewNothingElse: 'Nothing else queued today',
    overviewUpcomingCount: (count: number) => `+${count} more today`,
    // AP-05 — interactive notification action buttons + snooze follow-up
    actionDone: 'Done',
    actionRemindLater: 'Remind me later',
    renudgeTitle: (title: string) => `Still there: ${title}`,
    renudgeBody: "No rush — just a gentle nudge whenever you're ready.",
    // Medicine tray reminders (2026-07-27) — one per tray, listing what's in it. The
    // 'medicine-reminder' category's Taken button logs the whole tray from the shade.
    actionTaken: 'Taken',
    medicineTrayTitle: (tray: string) => `${tray} medicine`,
    medicineTrayMore: (n: number) => `+${n} more`,
    medicineSnoozeBody: 'Still here whenever you get to it.',
  },
  // Home-screen widget labels (Android). All already-localised; baked into the
  // widget snapshot (lib/widgets/sync.ts) so the headless renderer needs no i18n.
  widgets: {
    shoppingTitle: 'Shopping',
    tasksTitle: "Today's to-do",
    itemsLeft: (n: number) => (n === 1 ? '1 item left' : `${n} items left`),
    tasksLeft: (n: number) => (n === 1 ? '1 task left' : `${n} tasks left`),
    allDone: 'All done 🎉',
    noItems: 'List is empty',
    noTasks: 'Nothing planned today',
    more: (n: number) => `+${n} more`,
    notesTitle: 'Notes',
    noNotes: 'No notes yet',
    voiceNote: 'Voice note',
    habitsTitle: 'Habits',
    habitsLeft: (n: number) => (n === 1 ? '1 habit left' : `${n} habits left`),
    noHabits: 'No habits today',
    healthTitle: 'Health',
    noHealth: 'Nothing logged',
    healthOngoing: (n: number) => (n === 1 ? '1 ongoing' : `${n} ongoing`),
  },
  // Radial menu labels
  nav: {
    newTask: 'New task', plans: 'To-do', shop: 'Shop', habits: 'Habits',
    meals: 'Food', health: 'Health', scan: 'Scan', settings: 'Settings',
    capture: 'Quick note', home: 'Home', budget: 'Budget', automations: 'Automations',
    shared: 'Shared', settingsLabel: 'Settings',
  },
  home: {
    todaysPlans: "Today's to-do",
    seeAllPlans: 'See all to-dos',
    more: 'More',
    quantityLabel: 'Quantity',
    weeklyListChip: 'This week',
    // Names the quick-add's destination-list row, and titles its picker (2026-08-05). The
    // control was an unlabelled chip that cycled forward through the lists on tap.
    addToListLabel: 'Add to',
    extraInfoPlaceholder: 'Details…',
    // The row label the Details field sits on since it moved into the notes quick-add's
    // labelled panel (2026-08-05) — the placeholder alone was the only thing naming it.
    extraInfoLabel: 'Details',
    manageCards: {
      edit: 'Edit cards',
      done: 'Done',
      add: 'Add a card',
      remove: (label: string) => `Remove ${label}`,
      kinds: { notes: 'Notes', plans: 'To-do list', shopping: 'Shopping', habits: 'Habits', goals: 'Goals' },
    },
    // Per-card "⋮" menu (components/CardMenuSheet.tsx). Scoped to one card, so every line
    // says "this card" rather than naming a screen — the sheet's title already names it.
    cardMenu: {
      open: (card: string) => `Card settings for ${card}`,
      subtitle: 'Settings for this card',
      close: 'Done',
      hide: 'Hide this card',
      hideHint: 'It stays on its own screen — nothing is removed',
      hideLastHint: 'Home keeps at least one card',
      arrangeHint: 'Hold a card to drag it up or down',
    },
  },
  health: {
    habits: 'Habits',
    seeAllHabits: 'See all habits',
    noHabits: 'No habits yet',
    addHabit: 'Add habit',
  },
  shopping: {
    scan: 'Scan',
    budget: 'Budget',
  },
  // Home shopping card's week arrows (2026-07-30) — accessibility labels only; the visible
  // label is the week number plus its date range.
  shoppingWeekPrev: 'Previous week',
  shoppingWeekNext: 'Next week',
  inStockLabel: 'In stock',
  priceTotal: (total: string) => `${total} total`,
  // Shopping item detail sheet (components/ShoppingItemSheet.tsx). Quantity moved out of the
  // row and into here (row rule, 2026-07-28): a row shows a quantity, a sheet edits one.
  shoppingItemSheet: {
    quantity: 'How many',
    quantityPlaceholder: 'e.g. 2, or "a bunch"',
    name: 'Name',
    unit: 'Unit',
    unitPlaceholder: 'kg, L, pack…',
    price: 'Price each',
    category: 'Where in the shop',
    done: 'Done',
  },
  suggestions: 'Suggestions',
  // Meals screen
  mealTypes: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks', kveldsmat: 'Evening snack' },
  mealDifficulty: { easy: 'Easy', normal: 'Normal' },
  dishDifficultyPickerLabel: 'Difficulty',
  newDishTrigger: '+ New dish',
  dishNamePlaceholder: 'Dish name',
  ingredientsCount: (n: number) => n === 1 ? '1 item' : `${n} items`,
  ingredientPlaceholder: 'Ingredient',
  ingredientQuantityLabel: 'Quantity',
  editIngredientLabel: (name: string) => `Edit ${name}`,
  addDishSheetTitle: 'Add dish to monthly list',
  noDishesAvailable: 'No saved dishes yet — add one on the Meals screen first.',
  addDishBtn: 'Add dish',
  deleteDish: 'Delete dish',
  duplicateDishBtn: 'Duplicate dish',
  dishCopySuffix: ' (copy)',
  // --- W-C Grocery additions (meals) ---
  // --- end W-C additions ---
  // Health screen
  healthTitle: 'Health',
  thisWeekLabel: 'This week',
  quickLogLabel: 'Quick log',
  healthLogTitle: 'Health log',
  logSymptomTrigger: "What's bothering you?",
  ailmentLabel: 'Issue',
  severityLabel: 'Severity',
  notesLabel: 'Note',
  notesPlaceholder: 'Any notes…',
  severityLabels: ['Mild', 'Slight', 'Moderate', 'Strong', 'Severe'],
  whenStartedLabel: 'When started',
  whenFinishedLabel: 'When finished',
  // Ongoing symptom episodes (2026-08-01). An episode is a STATE, not a stopwatch — nothing
  // here counts, and `duration.*` is a retrospective bucket for something already finished,
  // rendered only on a history row. `stillGoingPrompt` is a question about the world, not
  // about the user's diligence: never "you left this open" / "you forgot to close this".
  // Replaced `ongoingLabel` ('Ongoing' / 'Pågår fortsatt'), the old health-form switch label.
  episodes: {
    ongoing: 'Ongoing',
    stillGoing: 'Still going',
    itsOver: "It's over",
    stillGoingPrompt: (symptom: string) => `${symptom} — still going?`,
    whenDidItStop: 'When did it stop?',
    didAnythingHelp: 'Did anything help?',
    seeAllOpen: 'See all',
    when: {
      justNow: 'Just now',
      thisMorning: 'This morning',
      lastNight: 'Last night',
      pickTime: 'Pick a time',
    },
    duration: {
      underHour: 'Under an hour',
      aboutAnHour: 'About an hour',
      hours: (n: number) => `About ${n} hours`,
      mostOfADay: 'Most of a day',
      aboutADay: 'About a day',
      days: (n: number) => `About ${n} days`,
    },
  },
  newHealthEntryTitle: 'New entry',
  editHealthEntryTitle: 'Edit entry',
  unnamedIssue: 'Untitled issue',
  noLogsThisWeek: 'Nothing logged this week.',
  /**
   * Health issues (2026-08-11) — the standing list at the foot of the Health tab, drawn by the
   * same components/CollapsedSection.tsx drawer + popup pair that Goals uses on Habits and
   * To-do (see AGENTS.md's "One card for every sub-screen link").
   *
   * Wording rule for this whole group, and it is `goals.*`'s rule pointed the other way. A goal
   * is never failing; an issue is never a failure either, and — the trap specific to this
   * domain — a quiet week is never a WIN to be congratulated, because the user does not control
   * whether they got a migraine. So: no "still open", no "unresolved", no streak of good days,
   * and no count framed as anything but a size. `untrackLabel` is "Stop tracking", never
   * "Delete", because it deletes nothing (see store/useHealthStore.ts's `tracked` doc).
   */
  healthIssues: {
    /** The drawer's label and the popup's title. A bare noun, like `goals.editLink`. */
    title: 'Health issues',
    /** a11y for the drawer's naming cluster — the half of the header that opens the popup. */
    openLabel: 'Open health issues',
    /** One line inside the popup, shown only once there is a list for it to describe. */
    subtitle: 'The things you keep an eye on.',
    emptyList: 'Nothing here yet — whatever you log turns up in this list.',
    newPlaceholder: 'Something to keep an eye on',
    entryCount: (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`,
    lastLogged: (days: number) =>
      days === 0 ? 'Logged today' : days === 1 ? 'Last logged yesterday' : `Last logged ${days} days ago`,
    neverLogged: 'Nothing logged yet',
    untrackLabel: 'Stop tracking',
    untrackConfirmTitle: (name: string) => `Stop tracking "${name}"?`,
    untrackConfirmBody: 'It leaves this list. Everything you have logged stays in the health log.',
    close: 'Done',
    /**
     * Sub-header of the Health tab's main card — the counterpart of `habits.cardSubtitle`, and
     * it carries the same promise for the same reason: this card counts entries, so it has to
     * say out loud that the count is a size and not a score. A quiet week is not a win here.
     */
    cardSubtitle: 'A record of how you have been — no scores, no streaks.',
    /** The card's composer prompt (the pad type line at the foot of the list). */
    typePrompt: 'Log something',
    /** a11y for a card row's "+", where a habit row has its −/+ pair. */
    logAgain: (name: string) => `Log ${name} again`,
    /** Right-hand value on a card row: how many entries this week. A size, not a score. */
    timesThisWeek: (n: number) => `${n}×`,
  },
  // --- W-D additions (health) ---
  noLogsGentle: 'No entries yet — log how you’re feeling when you’re ready.',
  deleteLogBtn: 'Delete entry',
  // --- Symptom catalog + trend drill-down (Health redesign) ---
  symptomSearchPlaceholder: 'Search or add a symptom…',
  addSymptomOption: (name: string) => `Add “${name}”`,
  symptomHistoryTitle: (name: string) => `${name} — history`,
  symptomEntriesCount: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  last90Days: 'Last 90 days',
  symptomCategories: {
    physical: 'Physical',
    mental: 'Mental',
    sleep: 'Sleep',
    digestive: 'Digestive',
    nutrition: 'Nutrition',
    other: 'Other',
  } as Record<string, string>,
  // --- end W-D additions ---
  // Habits — shame-free labels (Proposal 5)
  habits: {
    notYetToday: 'Not yet today',
    /** Sub-header shown at the top of the Habits card (2026-08-06) — distinct wording
     *  from hints.habits.text (the collapsible ⓘ hint just above it) on purpose, so the
     *  two don't say the same sentence twice on screen at once. */
    cardSubtitle: 'Simple check-ins — no streaks, no scores.',
    // --- W-D additions ---
    moreOptions: 'More options',
    fewerOptions: 'Fewer options',
    // --- end W-D additions ---
    editButtonLabel: 'Edit habit',
    restDay: 'Rest day',
    restingToday: 'Resting today',
    restDayHint: "Resting today — this habit's energy just sits still, no reward or penalty.",
    weeklyProgress: (count: number, goal: number) => `${count}/${goal} this week`,
  },
  // Goals — connect tasks & habits to a goal; managed only from the form pickers.
  goals: {
    pickerLabel: 'Goal',
    none: 'Not linked to a goal',
    pick: '+ Connect a goal',
    remove: 'Unlink goal',
    emptyList: 'No goals yet — create your first one below.',
    newPlaceholder: 'New goal name',
    add: 'Add goal',
    deleteLabel: 'Delete goal',
    deleteConfirmTitle: (name: string) => `Delete "${name}"?`,
    deleteConfirmBody: 'Tasks and habits linked to it will be unlinked. This cannot be undone.',
    strengthLabel: 'Goal momentum — grows as you work on it, gently fades when you don’t.',
    // ── The Goals screen (app/goals.tsx) + its Home card, 2026-07-28 ──
    // Wording rule for this whole group: a goal is NEVER failing, weak or neglected. One
    // that hasn't been worked in a while has simply cooled back to neutral — lib/
    // goalStrength.ts floors at 0 and is never driven below it — so the copy has to say
    // that too, or the mechanic and the words disagree.
    title: 'Goals',
    // Bottom-of-screen link on Habits/Plans that opens the GoalsSheet popup (2026-07-31 —
    // moved off the top of those screens; see those files' Edit notes). Deliberately
    // "Edit Goals" not "Goals": it opens straight into add/delete, not a browse view.
    /* A bare noun, like Shopping's "Food" and "Catalogue" links, which it now shares a
       component with (components/CollapsedSection.tsx). It read
       "Edit Goals" until 2026-08-03 — a verb that overstates what the tap does (it opens
       a sheet you can look at as well as edit) and that reads as a list row rather than a
       way out of the screen, which is how the 2026-08-03 walkthrough took it on both the
       To-do and Habits tabs. AGENTS.md had already recorded the label as "Goals". */
    editLink: 'Goals',
    close: 'Done',
    strengthStrong: 'Going strong',
    strengthWarm: 'Warming up',
    strengthNeutral: 'Ready when you are',
    linkedCount: (tasks: number, habits: number) =>
      `${tasks} to-do${tasks !== 1 ? 's' : ''} · ${habits} habit${habits !== 1 ? 's' : ''}`,
    lastWorked: (days: number) =>
      days === 0 ? 'Worked on today' : days === 1 ? 'Last worked on yesterday' : `Last worked on ${days} days ago`,
    neverWorked: 'Nothing linked yet',
    seeAll: 'See all →',
  },
  // IFTTT-style automations
  automations: {
    title: 'Automations',
    navLabel: 'Automations',
    navHint: 'Simple if-this-then-that rules',
    emptyState: 'No automations yet — tap + to create one.',
    addNew: '+ New automation',
    whenLabel: 'When…',
    thenLabel: 'Then…',
    triggerTaskCompleted: 'A task is completed',
    triggerShoppingOpened: 'Shopping list is opened',
    actionShowMessage: 'Show a message',
    actionAddShoppingItem: 'Add a shopping item',
    messagePlaceholder: 'Message to show…',
    itemNamePlaceholder: 'Item name…',
    alertTitle: 'Automation',
    saveBtn: 'Save automation',
    deleteTitle: 'Delete this automation?',
    deleteBody: 'This cannot be undone.',
    deleteBtn: 'Delete',
    ruleSummary: (when: string, then: string) => `${when} → ${then}`,
  },
  // Onboarding privacy screen (Proposal 3)
  onboarding: {
    privacy: {
      headline: 'Your data stays with you',
      local: 'Everything is stored only on this device — nothing is sent anywhere.',
      free: 'UnFocus is free — and stays free.',
      /* This is now the LAST screen of onboarding, so its button finishes setup rather
         than advancing (2026-08-03). "Got it →" described acknowledging a notice; "Start"
         describes what the tap does, per rule 22. */
      cta: 'Start',
      /* Two secondary ways off this screen, both deliberately below the primary and both
         plain links rather than cards. The restore path used to be a whole screen of its
         own, asked of every new user before they had seen anything; it is a returning
         user's question, so it waits here for the person who needs it. */
      restoreLink: 'Restoring from a backup?',
    },
    // First-run "have you used UnFocus before?" step — offers to restore a backup
    // file before the user starts a fresh setup (restore replaces all data).
    restore: {
      headline: 'Have you used UnFocus before?',
      body: 'If you saved a backup on your old phone, you can bring all your data back now. Otherwise, start fresh.',
      restoreCta: 'Yes — restore my data',
      newCta: "No, I'm new here",
    },
  },
  // Accessibility settings (Proposal 4)
  settings: {
    // Energy system (Generelt tab) — optional per-task energy budget.
    energy: {
      label: 'Energy system',
      hint: 'Track a daily and weekly energy budget — tasks and habits can restore or drain it.',
      dailyCapacity: 'Daily energy',
      weeklyCapacity: 'Weekly energy',
      modeLabel: 'Budget type',
      modeDaily: 'Daily',
      modeWeekly: 'Weekly',
      modeCustom: 'Custom',
      customHint: 'Set how much energy you have on each day of the week.',
    },
    accessibility: {
      title: 'Accessibility',
      reducedMotion: 'Reduced motion',
      reducedMotionHint: 'Turns off animations throughout the app',
      particles: 'Particle effects',
      particlesHint: 'Animated particles on the home screen background',
      glassSurfaces: 'Glass surfaces',
      glassSurfacesHint: 'Frosted glass finish on cards, buttons and the add button. Turn off for plain, solid surfaces',
      fontSize: 'Font size',
      fontSizeSmall: 'Small',
      fontSizeDefault: 'Default',
      fontSizeLarge: 'Large',
      leftHanded: 'Left-handed mode',
      leftHandedHint: 'Moves the menu button to the left side',
      timelineHorizontal: 'Horizontal to-do timeline',
      timelineHorizontalHint: "Shows today's to-dos as a left-to-right timeline instead of top-to-bottom",
    },
    photoFormat: {
      title: 'Photo format',
      hint: 'Default crop for photo tiles (e.g. receipt photos). Fit shows the whole photo; the others crop to a fixed shape.',
      fit: 'Fit',
      square: '1:1',
      classic: '4:3',
      widescreen: '16:9',
      golden: 'Golden',
    },
    // Privacy hint card shown in settings (Proposal 3)
    privacy: {
      headline: 'Your data stays with you',
      local: 'Everything is stored only on this device — nothing is sent anywhere.',
      free: 'UnFocus is free — and stays free.',
    },
    // AP-05 — notification quiet hours
    quietHours: {
      label: 'Quiet hours',
      hint: 'Task reminders wait until quiet hours end instead of firing — they\'re never lost. Habit reminders inside quiet hours are skipped instead.',
    },
    // AP-06B — monthly grocery budget, compared against receipts in app/budget.tsx
    monthlyBudget: {
      label: 'Monthly budget',
      hint: "Optional — see how this month's grocery spend compares on the Budget screen.",
      placeholder: 'e.g. 3000',
    },
  },
  // --- W-E Config additions (grouped settings + onboarding) ---
  config: {
    // Top-level skip affordance for non-essential onboarding steps
    skipForNow: "I'll set this later",
    // Section headers for the grouped settings screen
    sections: {
      appearance: 'Appearance',
      notifications: 'Notifications',
      /* The General tab's FIRST group (Profile / Appearance / Accessibility). Added
         2026-08-03: every other group on every Settings tab is introduced by a bare
         `groupHeader` above its cards, and this one alone had none — so the tab opened with
         an unheaded panel and then started using headings from "Data" down, which reads as
         two different hierarchies on one screen. */
      you: 'You',
      data: 'Data',
      layout: 'Layout',
      features: 'Features',
      advanced: 'Advanced',
    },
    // Card layouts (2026-07-27). Names describe the SITUATION you'd want the layout in,
    // not the typography ("Just the basics", not "Compact"; "In the store", not "Grid").
    // A user should be able to pick correctly without reading the hint underneath.
    layouts: {
      title: 'How lists look',
      hint: 'How much detail your lists show. Each list can differ.',
      /** Per-surface picker: falls back to the global choice above. */
      followsDefault: 'Same as my usual',
      useDefault: 'Use my usual layout',
      /** Shown on a card whose layout differs from the global default. */
      customBadge: 'Custom layout',
      markAllSeen: 'Mark all as seen',
      /** Dismisses the picker. Not the top-level `done`, which is onboarding's "Let's go!". */
      close: 'Done',
      /** Collapsed remainder under "Now and next". */
      moreLabel: 'The rest',
      newCount: (n: number) => (n === 1 ? '1 new' : `${n} new`),
      basic: {
        label: 'Just the basics',
        hint: 'One line each — name and a tick, nothing else.',
      },
      normal: {
        label: 'Normal',
        hint: 'The usual amount of detail.',
      },
      everything: {
        label: 'Show everything',
        hint: 'Every field on screen at once.',
      },
      inStore: {
        label: 'In the store',
        hint: 'Big rows by aisle. Names only, no prices.',
      },
      timeline: {
        label: 'On a timeline',
        hint: 'The day by the clock. Quiet stretches shrink, so what you have on stands out.',
      },
      nowNext: {
        label: 'Now and next',
        hint: 'Only what you are doing and what follows it. The rest stays tucked away.',
      },
      focusFirst: {
        label: 'One thing at a time',
        hint: 'One task front and centre, a short list under it, and a count of the rest.',
      },
      byPerson: {
        label: 'By person',
        hint: "Split Today into one section per person — whose turn it is included. This week and All tasks keep their own grouping.",
      },
    },
    // Settings screen top-level tab labels — kept short on purpose: TabSlider has no
    // scroll mode at all, so all tabs must fit one row. Three since the 2026-07-25
    // reorganization: General (what any app has), Personal (your preferences),
    // Advanced (modes + the feature opt-ins).
    tabs: {
      general: 'General',
      personal: 'Personal',
      advanced: 'Advanced',
    },
    // Feature flags (Advanced → Features). Each hides a purely additive surface when
    // off. Goals defaults on (still a toggle); Sharing & QR and Automations default off
    // so a new user meets the basics first. (Scan & receipts and Food & recipes were
    // here too until the 2026-07-25 defaults revision — both are permanently on now,
    // so they no longer have copy or a switch anywhere.)
    features: {
      intro: 'Turn on only what you need. You can change this at any time.',
      goals: {
        label: 'Goals',
        hint: 'Link to-dos and habits to a goal, and see how strong it is.',
      },
      sharing: {
        label: 'Sharing & QR',
        hint: 'Send to-dos and shopping items to someone else, and receive theirs.',
      },
      automations: {
        label: 'Automations',
        hint: 'Rules that run by themselves, like adding an item when you open the list.',
      },
      medicine: {
        label: 'Medicine',
        hint: 'A dose card on the Health tab, with a reminder for each part of the day.',
      },
      dayLog: {
        label: 'The day as it happened',
        hint: 'Keeps what you have already done above the now line, and what is left below it.',
      },
      /**
       * Energy is TWO NAMED PEER MODES now (2026-08-02), not a feature switched on and off.
       * `label`/`hint` stay for anything still rendering it as a plain FEATURE_ROWS row;
       * `modes.*` is what app/settings.tsx's SegmentedControl draws. Both write the same
       * `settings.energySystemEnabled` — Rewards mode is the false side, and it is genuinely
       * disabled rather than hidden, which is why it gets a name of its own instead of
       * reading as an absence.
       */
      energy: {
        label: 'Energy',
        hint: 'Give tasks and habits an energy value, and see what a day or week adds up to.',
        modes: {
          label: 'How finishing something lands',
          energy: {
            label: 'Energy mode',
            hint: 'Tasks and habits carry an energy cost, and the meter shows what today has left.',
          },
          rewards: {
            label: 'Rewards mode',
            hint: 'No meter and no costs. Finishing something fills its check, and that is the whole of it.',
          },
        },
      },
      growth: {
        label: 'Quiet growth',
        hint: 'Branches slowly grow in around the edges of the screen, and the colour warms, as the days you keep up add together.',
      },
    },
    // Sample data (Advanced tab; key/column still named freyrMode) — one-tap
    // seed/unseed of a starter set of shopping/task/habit/note rows
    // (lib/freyrModeSeed.ts). Turning it off removes only the rows it added.
    freyrMode: {
      label: 'Sample data',
      hint: 'Adds a starter set of shopping items, tasks, a habit, and notes. Turning this off removes only what it added.',
    },
    // Auto-backup to a persistent, user-chosen location that survives uninstall
    autoBackup: {
      label: 'Auto-backup',
      hint: 'Keeps one backup file up to date automatically. This is the file you restore from on a new phone. Nothing is uploaded — you choose where it lives.',
      pathLabel: 'Backup location:',
      locationUnknown: 'not set yet',
      lastBackedUp: (when: string) => `Last backed up: ${when}`,
      never: 'Not backed up yet — it will update when you make a change.',
      backUpNow: 'Back up now',
      backedUpNow: 'Backup updated.',
      locationCanceled: 'Auto-backup stays off until you pick where to save it.',
      shareNote: 'Sharing a copy does not include your name.',
    },
    // One-sentence descriptions under each setting
    desc: {
      language: 'Choose the language for everything in the app.',
      name: 'Only used to greet you — never leaves your phone.',
      weeklyReminders: 'A gentle weekly nudge on your shopping day.',
      holidays: 'Show public holidays on your calendar.',
      shoppingDefault: 'Which list opens first when you go shopping.',
      weeklyResetDay: 'The weekday your weekly list clears itself.',
      monthlyResetDate: 'If a month has fewer days, it resets on the last day.',
      hints: 'Short explanations on each screen.',
      dataNote: 'These reset things. They cannot be undone.',
    },
  },
  // --- end W-E Config additions ---
  // Local backup & restore (Decision 036) — device-only data portability
  backup: {
    title: 'Backup & restore',
    desc: 'Save all your data to a file you keep, or restore it from one. Nothing is uploaded — the file goes wherever you choose.',
    exportButton: 'Export backup',
    importButton: 'Restore from backup',
    exportError: "Couldn't create the backup file.",
    sharingUnavailable: 'Sharing is not available on this device.',
    invalidFile: "That doesn't look like an UnFocus backup file.",
    tooNew: 'This backup was made by a newer version of UnFocus. Update the app first, then restore.',
    importConfirmTitle: 'Restore this backup?',
    importConfirmBody: (items: number) =>
      `This replaces ALL your current data with the backup (${items} items). This cannot be undone.`,
    importConfirmBtn: 'Restore',
    restoreError: "Couldn't restore the backup — your current data is unchanged.",
    restoreDone: 'Restore complete. The app will reload now.',
    saveToDevice: 'Save to device',
    shareCopy: 'Share a copy',
    savedToDevice: (location: string) => `Backup saved to ${location}.`,
    saveUnavailable: 'Saving to device is not available on this device.',
  },
  // Local account (Decision 039) — device-only, user-held profile. No server, no
  // credentials, no cloud; the account is backed up via the local backup file above.
  account: {
    title: 'Local account',
    descNone: 'Create a local account to keep your data under one profile on this device. No sign-up, no password, no server — it lives only here, and you back it up yourself.',
    descActive: 'Your local account lives only on this device. Back it up to a file you keep, or restore from one — nothing is ever uploaded.',
    nameLabel: 'Account name',
    namePlaceholder: 'Name your local account',
    createButton: 'Create local account',
    createdOn: (date: string) => `Local account · created ${date}`,
    restoreButton: 'Restore local account',
    deviceOnlyNote: 'Device-only. No sign-in, no password, no server — ever.',
  },
  // AI setup guide (download/upload) — lib/aiSetupGuide.ts + lib/aiSetupApply.ts. The
  // guide's own text content is deliberately English-only (see that file's header);
  // only the UI strings around the feature go through i18n.
  aiSetup: {
    title: 'AI setup guide',
    downloadButton: 'Download AI setup guide',
    shareButton: 'Share a copy',
    uploadButton: 'Upload AI setup file',
    savedToDevice: (location: string) => `Guide saved to ${location}.`,
    saveUnavailable: 'Saving to device is not available on this device.',
    sharingUnavailable: 'Sharing is not available on this device.',
    exportError: "Couldn't create the guide file.",
    invalidFile: "That doesn't look like a filled-in UnFocus AI setup file. Make sure you upload the file the AI gave you, not the original guide.",
    staleWarning: 'This file was made from an older version of the setup guide — some newer options may be missing. You can still import what it has, or download a fresh guide first.',
    previewTitle: "Here's what will be set up",
    confirmImport: 'Set it up',
    nothingToImport: "Nothing to import — this file didn't contain anything the app recognized.",
    importDone: (n: number) => (n === 1 ? '1 change applied.' : `${n} changes applied.`),
    deviceOnlyNote: 'Nothing is uploaded anywhere — the file goes wherever you choose, and an import only writes to this device.',
    itemsWillBeAdded: (n: number) => (n === 1 ? '1 item will be added' : `${n} items will be added`),
    skippedCount: (n: number) => (n === 1 ? '1 item skipped' : `${n} items skipped`),
    settingsWillChange: (n: number) => (n === 1 ? '1 setting will change' : `${n} settings will change`),
    skippedField: (field: string, reason: string) => `${field}: ${reason}`,
    domains: {
      tasks: 'Tasks',
      habits: 'Habits',
      goals: 'Goals',
      notes: 'Notes',
      shoppingLists: 'Shopping lists',
      shoppingItems: 'Shopping list items',
      inventoryItems: 'Household inventory',
      catalogueItems: 'Catalogue items',
      meals: 'Meals',
      monthlyLists: 'Monthly lists',
      settings: 'Settings',
    },
    skippedReason: {
      'invalid-date': 'invalid date',
      'invalid-time': 'invalid time',
      'invalid-enum': 'unrecognized value',
      'invalid-type': 'missing or invalid',
      'too-long': 'too long',
      'weekly-recurrence-needs-days': 'weekly habit needs at least one day',
      'unknown-version': 'unsupported version',
    } as Record<string, string>,
  },
  // Toggle on/off labels
  on: 'on',
  off: 'off',
  // Hints (one per screen)
  // Cover screen (Galaxy Z Flip outer display)
  cover: {
    tasksToday: 'Today',
    taskCount: (n: number) => `${n} task${n !== 1 ? 's' : ''}`,
    noTasks: 'All done!',
    quickAdd: '+ Add',
    habitsToday: 'Habits',
    habitsSummary: (done: number, total: number) => `${done}/${total} done`,
    moreTasksHint: (n: number) => `+${n} more`,
  },
  // Per-screen incoming shared-item prompts (components/SharedRequestsSection.tsx)
  sharedRequests: {
    sectionTitle: 'Shared with you',
    fromLabel: (name: string) => (name ? `${name}:` : ''),
    accept: 'Add',
    dismiss: 'Dismiss',
  },
  // AP-06B — receipts + monthly grocery budget (app/budget.tsx)
  budget: {
    title: 'Budget',
    // Shopping — Monthly redesign (2026-07-22): budget is per Monthly list now; the
    // screen title names which list is being viewed.
    titleForList: (listName: string) => `${listName} — Budget`,
    spentOfBudget: (spent: string, budget: string) => `${spent} kr of ${budget} kr this month`,
    overBudgetHint: "A bit over this month — here's where it went.",
    onTrackHint: 'Right on track this month.',
    noBudgetSet: 'Set a monthly budget in Settings to see how this month compares.',
    receiptsTitle: 'Receipts this month',
    noReceipts: 'No receipts yet this month.',
    olderMonth: '← Older',
    newerMonth: 'Newer →',
    editBudget: 'Edit budget',
    setBudget: 'Set budget',
    perStore: 'Per store',
    editorTitle: 'Set budget',
    monthlyBudgetLabel: 'Monthly budget (NOK)',
    perDaySpend: (actual: string, budget: string) => `${actual} kr/day so far · ${budget} kr/day budgeted`,
    overPaceHint: 'A little above your daily pace — no worries, just a heads-up.',
    onPaceHint: 'Nicely within your daily pace.',
  },
  // Notater — free-form notes with shopping/plans quick-action buttons (app/notes.tsx)
  notes: {
    title: 'Notes',
    navLabel: 'Notes',
    emptyState: 'Nothing yet. Write on the first line, or tap the mic.',
    addNote: 'Add a note',
    headerPlaceholder: 'Note title',
    bodyPlaceholder: 'Add more detail…',
    addToShoppingLabel: 'Add to shopping list',
    addToPlansLabel: 'Create task',
    deleteNote: 'Delete note',
    shoppingQuickAddTitle: 'Add to shopping list',
    activeLabel: 'Active',
    checkedLabel: 'Checked off',
    recordVoiceNote: 'Record voice note',
    stopRecording: 'Stop recording',
    micPermissionBody: 'Microphone access is required to add a voice note.',
    micErrorBody: "Couldn't catch that — try again.",
  },
  hints: {
    home: {
      text: 'Today at a glance. Hold a card to move it.',
      example: 'Draining tasks get a minus, restoring ones a plus.',
    },
    taskForm: {
      text: 'Add a task with a title, date, and optional details.',
      example: '',
    },
    habitForm: {
      // Rewritten 2026-07-26: used to say "a habit you're building or breaking", describing
      // the build/break `kind` split that store/useHabitStore.ts dropped on 2026-07-20.
      text: 'How often it repeats, how many times a day it counts, and optionally a goal, reminders and an energy value.',
      example: 'e.g. "Drink 4 glasses of water" — daily, 4 a day.',
    },
    medicineForm: {
      text: 'Pick its trays, or set it as needed with a minimum gap between doses.',
      example: 'e.g. painkillers as needed, at least 6 hours apart.',
    },
    shopping: {
      text: 'Add things as you run out. Resets weekly. Hold a row to move it.',
      example: 'e.g. milk weekly, washing powder monthly.',
    },
    meals: {
      text: 'Browse dishes and add their ingredients to your shopping list.',
      example: '',
    },
    health: {
      text: 'Log and track health issues over time.',
      example: 'e.g. "Headache" at 3 of 5 — a couple of weeks shows a pattern.',
    },
    scan: {
      text: 'Photo a receipt to add items, or scan a shared QR code.',
      example: '',
    },
    settings: {
      text: 'Changes apply immediately.',
      example: '',
    },
    shared: {
      text: 'Items shared with you — mark your part done.',
      example: '',
    },
    habits: {
      // Rewritten 2026-07-26: the old "build habits you want more of, or break ones you want
      // less of" described the build/break `kind` split removed from the store on 2026-07-20.
      text: 'Small things you want to repeat. Tap to count it, gear to set it up. Hold a row to move it.',
      example: 'e.g. "Drink 4 glasses of water" — daily, 4 a day.',
    },
    plans: {
      text: 'Everything to do, by day and week. Under Whenever, hold a row to move it.',
      example: 'e.g. "Book the dentist" under Whenever.',
    },
    automations: {
      text: 'Simple rules: when X happens, do Y automatically.',
      example: '',
    },
    notes: {
      text: 'Write it down. Send it anywhere. Hold a note to move it.',
      example: '',
    },
    goals: {
      text: 'The bigger thing your to-dos and habits are for. Link them and it gets stronger.',
      example: 'It can be something you want less of too.',
    },
  },
  /**
   * Empty-state explainers (components/StarterCard.tsx, 2026-07-26). Shown inline where the
   * content would be while a surface has nothing on it yet, and gone as soon as the user has
   * their own — so a new user gets the *idea* behind a feature without having to find the ⓘ.
   * Each one's core message also lives in the matching `hints.*.example` above, which is where
   * it stays reachable once the starter card disappears.
   *
   * `example*` fields (2026-07-27) are short item/label fragments, NOT sentences — each screen
   * feeds them into one or more components/StarterExampleRow so the "example" renders as an
   * actual row (icon + title + meta pill) instead of a sentence describing one. Meta text that's
   * identical in both languages (durations, signed numbers, counts) is hardcoded at the call
   * site rather than duplicated here.
   *
   * Every example row (except Habits — see below) carries a real "+" add button
   * (StarterExampleRow's `onAdd`, 2026-07-27) that writes the example into the real store, so
   * it's an actual opt-in try-it, not just an illustration. Habits' row stays read-only because
   * its four *real* one-tap add chips (`tapToAdd`/`suggestions` below, rendered separately in
   * StarterCard's `children`) already cover that job for the exact same item — a second "+" on
   * the preview row would just be a redundant second way to do the same thing.
   */
  starters: {
    exampleLabel: 'Example',
    /** Accessibility-label prefix for an example row's "+" add button, e.g. "Add Milk". */
    addExample: 'Add',
    /** Accessibility label for a StarterCard's dismiss "X" (2026-08-06). */
    dismiss: 'Dismiss',
    /** Generic collapse/expand a11y labels for StarterCard's `collapsible` trigger row
     *  (2026-08-06 v3) — shared across every caller, replacing the per-screen pairs a
     *  first pass (Habits) hand-rolled. */
    expandExamples: 'Show suggestions',
    collapseExamples: 'Hide suggestions',
    habits: {
      text: 'All wins matter, big and small.',
      tapToAdd: 'Tap one to start:',
      suggestions: {
        water: 'Drink 4 glasses of water',
        stretch: 'Morning stretch',
        posture: 'Posture check',
        breakfast: 'Eat breakfast',
      },
    },
    plans: {
      text: 'Break it into smaller pieces.',
      /** Trigger-row label for StarterCard's `collapsible` mode (2026-08-06 v3). */
      tapToAdd: 'See an example:',
      exampleTitle: 'Tidy up',
      exampleSteps: {
        trash: 'Take out the trash',
        tidy: 'Tidy up',
        table: 'Wipe down the table',
        dishwasher: 'Run the dishwasher',
        laundry: 'Start the washing machine',
      },
    },
    shopping: {
      // ONE short line (2026-07-30). This was a two-item bullet list on both surfaces, which
      // on Home's card was the largest block of teaching anywhere on the screen — see
      // components/CardHintNote.tsx's header. The weekly/monthly split is taught by the two
      // tabs' own labels; this only has to say what the list is for.
      text: 'Add things as you run out.',
      // The /shopping screen keeps the weekly-vs-monthly distinction: that screen IS the
      // place the two lists live side by side, so it's the one surface where the split is
      // the point rather than a detail.
      textWeekly: 'Weekly list for groceries.',
      textMonthly: 'Monthly list for what the house needs.',
    },
    health: {
      text: 'Log what bothers you. And what helps.',
      /** Trigger-row label for StarterCard's `collapsible` mode (2026-08-06 v3). */
      tapToAdd: 'See an example:',
      exampleTitle: 'Headache',
    },
    // Medicine card's empty state — compact (no example row): the card's own add field
    // is right underneath it, and seeding a fake medicine would be a bad idea.
    medicine: {
      text: 'Add what you take. Tap it off when you do — a tray is a window, not a deadline.',
    },
    // Home preview card's empty state (2026-07-28) — Notes had no explainer at all (just the
    // "Nothing" label), unlike its sibling Home cards. See HomeNotesCard.tsx.
    notes: {
      text: 'Note thoughts for later.',
    },
    /**
     * The Energy strip's tutorial state (2026-08-03) — what stands at the top of Home while
     * nothing carries an energy value and no capacity has been set. See
     * components/EnergyMeter.tsx's "Tutorial state" note.
     *
     * Two sentences, in this order for a reason: what energy IS, then the two things that make
     * the meter mean anything. It must not read as setup the user owes the app — every number
     * already has a working default, so this only ever adjusts one. `action` opens the same
     * pop-up the ✏️ opens, so the first available move here is the deliberate one.
     * Energy had a StarterCard until 2026-07-27 (two "+" example rows, retired in favour of the
     * permanent hint); this is not that card back — it replaces the METER rather than sitting
     * under it, and the permanent hint stays exactly where it is.
     */
    energy: {
      text: 'Energy is how much a day holds. Give a to-do or a habit a cost, and the meter here shows what the day has left.',
      action: "Set the day's energy",
    },
    goals: {
      text: 'What your to-dos and habits add up to.',
      tapToAdd: 'Tap one to start:',
      suggestions: {
        rested: 'Be better rested',
        moving: 'Move every day',
        // The "less of" example. Deliberately phrased as the thing you're aiming at, not as
        // a failure to avoid — see lib/goalStarters.ts.
        cutBack: 'Less time on my phone',
        together: 'More time with the people I love',
      },
    },
  },
  // Medicine trays (2026-07-27) — the Health tab's dose card + app/medicine-form.tsx.
  // Wording rule for this whole block: a tray is never "missed" and a dose is never
  // "skipped". Untaken reads "still due"; that's the no-shame framing habits already use
  // for rest days, and it's the reason the tray model was chosen over exact clock times.
  medicine: {
    title: 'Medicine',
    trays: {
      morning: 'Morning',
      midday: 'Midday',
      evening: 'Evening',
      night: 'Night',
    },
    addPlaceholder: 'Add a medicine',
    stillDue: (tray: string) => `Still due: ${tray}`,
    nextUp: (tray: string, time: string) => `Next: ${tray} at ${time}`,
    allTaken: 'Everything taken today',
    takenAt: (time: string) => `Taken ${time}`,
    markTaken: (name: string) => `Mark ${name} as taken`,
    undoTaken: (name: string) => `Undo ${name}`,
    trayProgress: (taken: number, total: number) => `${taken}/${total}`,
    asNeededLabel: 'As needed',
    asNeededReady: 'Can take now',
    asNeededWait: (time: string) => `Earliest again ${time}`,
    asNeededLimit: 'Daily max reached',
    asNeededTakenToday: (n: number) => (n === 1 ? '1 today' : `${n} today`),
    logDose: (name: string) => `Log a dose of ${name}`,
    remindersTitle: 'Reminder times',
    remindersToggle: 'Remind me for each tray',
    remindersOffHint: 'The card still works — you just won’t be nudged.',
    remindersQuietHint: 'A tray inside quiet hours is skipped, not moved.',
    forMe: 'Me',
    // ── app/medicine-form.tsx ──
    formTitleNew: 'New medicine',
    formTitleEdit: 'Medicine',
    nameLabel: 'Name',
    namePlaceholder: 'e.g. Elvanse',
    doseLabel: 'Dose',
    dosePlaceholder: 'e.g. 30 mg',
    traysLabel: 'When to take it',
    traysHint: 'Pick one or more. A tray is a window, not a deadline.',
    asNeededSwitch: 'Take as needed instead',
    asNeededHint: 'No tray and no reminder — just a guard against taking it again too soon.',
    minIntervalLabel: 'Minimum gap between doses',
    minIntervalPlaceholder: 'minutes',
    minIntervalNone: 'No minimum gap',
    gapHours: (n: number) => `${n} h`,
    traysRequired: 'Pick at least one tray, or set it as needed.',
    maxPerDayLabel: 'Most per day',
    maxPerDayPlaceholder: '0 = no limit',
    personLabel: 'For',
    notesLabel: 'Note',
    notesPlaceholder: 'Anything worth remembering',
    activeLabel: 'Currently taking this',
    inactiveHint: 'Turned off: it stays in your history but leaves the card.',
    takenRecently: (days: number) => `Taken on ${days} of the last 7 days`,
    takenNeverRecently: 'No doses logged in the last 7 days',
    deleteConfirm: 'Delete this medicine and its dose history?',
    // Symptom↔medicine correlation
    sideEffectsLabel: 'Noted alongside this',
    sideEffectsEmpty: 'Nothing logged against this one yet.',
    logSideEffect: 'Note something it caused',
    attributionLabel: 'Possibly from',
    attributionNone: 'Not sure',
  },
  // Debug mode — long-press-to-annotate feedback notes
  debug: {
    toggleLabel: 'Debug mode',
    toggleHint: 'Lets you leave notes on cards and headers for the developer.',
    howToUse: 'It’s on now — every card shows a small "Add debug note" tag, and tapping anywhere on the card (or the screen title) opens the same note composer. A small bubble marks a card that already has a note; tap the bubble to edit or clear it. (Buttons won’t do their normal thing while it’s on — that’s expected; you’re annotating them, not using them.) Use the "Add general note" button at the bottom of the screen for anything not tied to a specific card. In the header: the bug icon turns note-taking back off, the green checkmark emails all your notes, and the red circle deletes them all.',
    editNote: 'Edit note',
    noteForLabel: (label: string) => `Note — ${label}`,
    addNote: 'Add debug note',
    generalNote: 'Add general note',
    composerPlaceholder: "What's on your mind?",
    exportNotes: 'Export',
    emailNotes: 'Email notes',
    deleteAllNotes: 'Delete all notes',
    mailSubject: 'UnFocus debug notes',
    exportHeading: (date: string) => `UnFocus debug notes — ${date}`,
    resetNotes: 'Reset all notes',
    saveAndSend: 'Save and send',
  },
  // Design lab (2026-08-06) — lib/designLab.ts. A workbench for deciding what the app
  // should look like, exported as a document rather than kept as a setting. Off by
  // default, Settings -> Advanced only, and deliberately not taught anywhere else.
  designLab: {
    title: 'Design lab',
    linkLabel: 'Design lab',
    toggleHint: 'A workbench for changing how the app looks, and sending the result to the developer.',
    intro: 'Change how the app looks, then send the result on. Nothing here is saved as a preference \u2014 it is a note about what you want.',
    applyLabel: 'Use these everywhere',
    applyHint: 'Off, only this screen changes. On, the whole app does \u2014 until you turn it back off.',
    reset: 'Put everything back',
    resetConfirm: 'put everything back',
    exportLabel: 'Send this',
    saveLabel: 'Save to device',
    exportEmpty: 'Nothing has been changed yet.',
    exportShared: 'Sent.',
    exportUnavailable: 'Sharing is not available on this device.',
    exportFailed: 'That could not be shared.',
    savedTo: (where: string) => `Saved to ${where}.`,
    noteLabel: 'What were you after?',
    notePlaceholder: 'In your own words \u2014 what looked wrong, and what you were trying to get to.',
    changeCount: (n: number) => (n === 1 ? '1 change' : `${n} changes`),
    modeNote: 'Light and dark keep separate colours. Switch appearance to edit the other one.',
    // Only `slots` is still a section heading — the tab bar names the other three now.
    groups: {
      slots: 'What goes where',
    },
    colorGroups: {
      surfaces: 'Pages and cards',
      text: 'Text',
      borders: 'Edges',
      accent: 'The main colour',
      semantic: 'Good, bad, careful',
      hint: 'Explanation cards',
      screens: 'One colour per screen',
      identity: 'Card badges',
    },
    shape: {
      radiusScale: 'How round',
      spacingScale: 'How much room',
      borderScale: 'How thick the edges are',
      borderCardWidth: 'Card edge',
      borderFieldWidth: 'Field and row edge',
      borderButtonWidth: 'Button edge',
      borderRampStrength: 'How much an edge fades',
      rowHeight: 'Row height',
      minTapTarget: 'Smallest tap target',
      fontScale: 'Text size',
      cardElevation: 'How far cards lift',
    },
    controls: {
      boolean: 'Yes or no',
      choice: 'Pick one',
      number: 'A number',
      time: 'A time',
      rowShape: 'How rows are separated',
      check: 'The tick',
      button: 'Buttons',
    },
    controlHints: {
      boolean: 'Every on/off row in settings and in every editor.',
      choice: 'Appearance, text size, layout — every pick-one row.',
      number: 'Energy, quantity, daily goal, capacity.',
      time: 'Reminder times, medicine trays, task start and finish.',
      rowShape: 'How one row is separated from the next.',
      check: "A row's completion control.",
      button: 'The main action on every screen.',
    },
    slots: {
      'row.leading': 'Before the title',
      'row.meta': 'The line under the title',
      'row.right': 'The right-hand value',
      'row.action': "The row's button",
    },
    slotsNote: 'On the real screens these can only hide a position. Filling one in is live here on the bench, and the note you send says which.',
    idNote: 'The short words on the buttons below are the names used in the file you send, so they stay as they are.',
    /** Marks a colour row that carries an override, so 34 tokens can be scanned at a glance. */
    changedTag: 'Changed',
    // The card editor (2026-08-07). Everything below names a card, a part, or a place a part
    // can sit — the vocabulary the exported report describes a composition in.
    tabs: { card: 'Card', color: 'Colour', shape: 'Shape', controls: 'Controls' },
    whichCard: 'Which card',
    preview: {
      collapse: 'Show less of the card',
      light: 'Show it light',
      dark: 'Show it dark',
      edit: 'Change the card',
    },
    /** The inline panel's heading, so it is obvious which part the controls belong to. */
    editingPart: (name: string) => `Changing: ${name}`,
    selectHint: 'Tap something on the card to change it. Hold and drag to move it, or drag one in from above.',
    /** The palette chip's spoken name. The chip SHOWS the kind; a screen reader needs the verb,
     *  and without it the chip, the card's part and the list row are three identical names. */
    addNamed: (name: string) => `Add ${name.toLowerCase()}`,
    cardEmpty: 'This card has nothing in it. Add a part below.',
    cardNoteLabel: 'What do you want from this card?',
    cardNotePlaceholder: 'In your own words.',
    addPart: 'Add something',
    partsTitle: 'What it is made of',
    partsHint: 'Hold and drag to reorder. Tap one to change it.',
    removePart: 'Take it out',
    restoreCard: 'Put this card back',
    /** Marks a part that is not in the card as the app ships it. */
    addedTag: 'Added',
    cards: {
      generic: 'A plain list card',
      todo: 'A to-do',
      habit: 'A habit',
      shopping: 'A shopping row',
      medicine: 'A medicine tray',
      note: 'A note',
      dish: 'A dish',
      homeToDo: "Home's to-do card",
      homeHabits: "Home's habits card",
      homeShopping: "Home's shopping card",
      homeNotes: "Home's notes card",
    },
    parts: {
      text: 'Text',
      value: 'A value',
      count: 'A count',
      price: 'A price',
      time: 'A time',
      button: 'A button',
      slider: 'A slider',
      toggle: 'An on/off switch',
      checkbox: 'A tick',
      stepper: 'A − / + pair',
      segmented: 'A pick-one row',
      chips: 'Small chips',
      field: 'Something to type in',
      timeField: 'A time to type in',
      icon: 'An icon',
      badge: 'A little mark',
      chip: 'A chip',
      personChip: 'Whose it is',
      dot: 'A dot',
      progress: 'A progress bar',
      divider: 'A dividing line',
    },
    /** The sample words a part shows until the maintainer types their own. */
    partSample: {
      text: 'Some words',
      value: '2 kg',
      count: '3/6',
      price: '49',
      time: '09:30',
      button: 'Do it',
      slider: 'How much',
      toggle: 'On or off',
      checkbox: 'Done',
      stepper: 'How many',
      segmented: 'Pick one',
      chips: 'Chips',
      field: 'Type here',
      timeField: '08:00',
      icon: 'Icon',
      badge: 'Mark',
      chip: 'Chip',
      personChip: 'Alex',
      dot: 'Dot',
      progress: 'How far',
      divider: 'Line',
    },
    // The shelf's three groups. Named by what the things DO, not by the code's families —
    // "controls" is what you use, "marks" is what marks or measures something.
    partGroups: { words: 'Words', controls: 'Controls', marks: 'Marks' },
    partSlots: {
      header: "The card's heading",
      leading: 'Before the title',
      title: 'The title',
      meta: 'The line under the title',
      right: 'The right-hand value',
      action: "The row's button",
      check: 'The tick',
      trailing: 'Instead of the tick',
      body: 'In the card',
      footer: 'At the bottom',
    },
    partEditor: {
      whatItSays: 'What it says',
      whatItSaysPlaceholder: 'Leave empty for the example',
      colour: 'Colour',
      inherited: 'However it comes',
      moreColours: 'More…',
      size: 'How big',
      weight: 'How heavy',
      where: 'Where it sits',
      // The tap route to a grid cell, for a part in the card's own space. `spans` are the
      // four widths of the four-column grid, named by what they look like rather than by a
      // column count — "half" is what you see, "2 of 4" is what the file says.
      row: 'Which line',
      width: 'How wide',
      spans: ['A quarter', 'Half', 'Three quarters', 'The whole line'],
      sizes: { xs: 'Tiny', sm: 'Small', md: 'Normal', lg: 'Big' },
      weights: { regular: 'Normal', semibold: 'Bolder', bold: 'Boldest' },
    },
    // The colour picker (components/ColorPickerSheet.tsx, 2026-08-07). Replaced a hex field
    // and a lighten/darken pair, which could only answer "a bit darker".
    color: {
      pick: 'Pick a colour',
      tune: 'Adjust it',
      hue: 'Colour',
      saturation: 'How strong',
      lightness: 'How light',
      hex: 'Colour code',
      putBack: 'Put this one back',
      close: 'Done',
      was: (hex: string) => `Was ${hex}`,
    },
    sample: {
      primary: 'Main action',
      secondary: 'Second action',
      fieldLabel: 'A text field',
      fieldPlaceholder: 'Type here',
      toggleLabel: 'A yes-or-no setting',
      choiceLabel: 'A pick-one setting',
      numberLabel: 'A number',
    },
    // The token knobs, now their own pushed screen (app/design-lab/tokens.tsx, 2026-08-07).
    tokensTitle: 'Colours and shapes',
    tokensHint: 'The values every card is made of. Change one here and it changes everywhere.',
    // The playground (app/design-lab/index.tsx, 2026-08-07) — empty screens you build on.
    playground: {
      build: 'Build',
      use: 'Try it',
      addCard: 'Add a card',
      emptyScreen: 'Nothing on this screen yet. Add a card below, then put things on it.',
      cardName: 'What is this card',
      cardNamePlaceholder: 'Leave empty and it has no name',
      duplicateCard: 'Make a copy',
      removeCard: 'Take this card out',
      startFromReal: "Or start from one of the app's own cards",
      starters: {
        blank: 'A blank card',
        row: 'A row with a tick',
        heading: 'A card with a heading',
      },
      starterHints: {
        blank: 'Nothing on it. Put whatever you like where you like.',
        row: 'One line with a title and something to tick off.',
        heading: 'A heading to put things under.',
      },
      screenCap: 'That is as many screens as this holds.',
      cardCap: 'That is as many cards as this screen holds.',
      partCap: 'That is as much as one card holds.',
    },
  },
  // Device features (2026-07-17) — Settings toggles for the reserve-only native
  // surface (voice/contacts/location/calendar); gates components/TaskCard.tsx's mic
  // button and contact/location blocks (was app/task-form.tsx's, retired 2026-07-23),
  // and store/useTaskStore.ts's calendar sync.
  permissions: {
    sectionTitle: 'Device features',
    voiceNotes: { label: 'Voice dictation', hint: 'Dictate the task title by voice.' },
    contacts: { label: 'Contacts', hint: 'Attach a contact to a task.' },
    location: { label: 'Location', hint: 'Tag a task with your current location.' },
    calendar: { label: 'Calendar sync', hint: 'Mirror timed tasks to your device calendar.' },
  },
  // Send Feedback (2026-07-13) — general-audience mailto card, separate from
  // debug mode's anchor-note export above.
  feedback: {
    cardTitle: 'Send feedback',
    cardDesc: 'Found a bug, or have an idea? Type it below — it opens your mail app, addressed to the developer.',
    placeholder: "What's on your mind?",
    sendButton: 'Send feedback',
    subject: 'UnFocus feedback',
    mailUnavailable: "Couldn't open a mail app on this device. Try again from a device with mail set up.",
  },
};

const no: typeof en = {
  greeting: { night: 'God natt', morning: 'God morgen', day: 'God dag', evening: 'God kveld' },
  days: ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'],
  months: ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'],
  monthsShort: ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'],
  back: '← Hjem',
  cancel: 'Avbryt',
  yes: 'Ja',
  no: 'Nei',
  save: 'Lagre',
  undoBtn: 'Angre',
  next: 'Neste →',
  previous: '← Tilbake',
  done: 'Kom i gang! 🌿',
  ok: 'OK',
  optionalTag: 'Valgfri',
  webPreview: { notAvailable: 'Ikke tilgjengelig i nettleserforhåndsvisningen.' },
  addNew: '+ Ny',
  backlog: 'Ikke startet',
  // Plans widget (home preview + full /plans screen)
  noPlansToday: 'Ingen gjøremål i dag! Nyt dagen',
  notesCollapse: 'Vis mindre',
  timelineEmptyAdd: 'Legg til en plan',
  timelineNow: 'Nå',
  // Day-view rail (components/PlanTaskCard.tsx — full /plans screen + read-only Home preview)
  dayViewGapUntil: (time: string) => `Ingenting før ${time}`,
  dayViewDoneZone: (n: number) => `Ferdig i dag (${n})`,
  dayViewAllDone: 'Alt gjort for i dag',
  dayViewFollowerBadge: 'Så',
  dayViewAnytimeBadge: 'Når som helst',
  dayViewGapLength: (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} t` : `${h} t ${m} min`;
  },
  dayViewDeletedZone: (n: number) => `Nylig slettet (${n})`,
  dayViewRestore: 'Gjenopprett',
  dayViewDeleteTask: 'Slett',
  // Gjøremålsliste-skjerm (app/(tabs)/plans.tsx + components/TaskCard.tsx)
  tasksTitle: 'Gjøremålsliste',
  tasksTabAll: 'Alle',
  tasksTabToday: 'I dag',
  tasksTabWeek: 'Denne uka',
  tasksSectionShared: 'Delt',
  tasksSectionWhenever: 'Når som helst',
  tasksSectionRecurring: 'Gjentakende',
  tasksSectionSharedEmpty: 'Ingenting delt ennå',
  tasksSectionRecurringEmpty: 'Ingen gjentakende oppgaver ennå',
  tasksSectionWheneverEmpty: 'Ingenting her ennå',
  tasksSharedSent: 'Sendt',
  tasksSharedReceived: 'Mottatt',
  tasksDayEmpty: 'Ingen gjøremål',
  tasksDoneLabel: 'Ferdig',
  taskSave: 'Lagre',
  taskDiscard: 'Forkast',
  taskRecurringToggle: 'Gjenta',
  taskStartSpecificDate: 'Tidspunkt',
  taskNameLabel: 'Navn',
  taskWhenLabel: 'Når',
  taskWhenWhenever: 'Når som helst',
  taskWhenOnDay: 'På en dag',
  taskWhenPickDay: 'Velg dag',
  taskHowOftenLabel: 'Hvor ofte',
  taskTimeOfDayLabel: 'Klokkeslett',
  taskStartFromLabel: 'Starter fra',
  taskStartFromNone: 'Ingen startdato',
  taskStartLabel: 'Start',
  taskFinishLabel: 'Slutt',
  taskRecurDay: 'Dag',
  taskRecurWeek: 'Uke',
  taskRecurMonth: 'Måned',
  taskRecurNever: 'Aldri',
  taskWeekInterval1: 'Hver uke',
  taskWeekInterval2: 'Hver 2. uke',
  taskWeekInterval3: 'Hver 3.',
  taskMonthlyByDay: 'Dag i måned',
  taskMonthlyByWeekday: 'Ukedag',
  taskMonthDayLabel: 'Dag',
  taskOrdFirst: '1.',
  taskOrdSecond: '2.',
  taskOrdThird: '3.',
  taskOrdFourth: '4.',
  taskOrdLast: 'Siste',
  taskSharedOut: 'Delt ut',
  cardTypes: {
    label: 'Kortstil',
    standard: 'Fullt',
    simple: 'Enkelt',
    note: 'Notat',
    stepped: 'Steg',
    standardDesc: 'Alt denne har — tid, energi, merkelapper.',
    simpleDesc: 'Bare navnet og en hake. Ingenting annet vises.',
    noteDesc: 'Noe å ha i lista. Ingenting å bli ferdig med.',
    steppedDesc: 'Viser ett steg om gangen.',
    progress: (done: number, total: number) => `Steg ${done} av ${total}`,
    allDone: 'Alle steg er gjort',
    back: 'Ett steg tilbake',
    noSteps: 'Legg til et steg i dette kortet for å ta det ett om gangen.',
  },
  shoppingPreview: 'Handle snart',
  seeAll: 'Se alt →',
  andMoreItems: (n: number) => `og ${n} til`,
  emptyMonthlyList: 'Ingenting her ennå — legg til din første faste vare.',
  smallThingsCount: (n: number) => `Du har fullført ${n} ting — småting teller!`,
  focusFirst: {
    nextUp: 'Nå',
    then: 'Så',
    doneToday: (n: number) => `${n} gjort — småting teller`,
    andMore: (n: number) => `og ${n} til i dag`,
    allClear: 'Ingenting igjen i dag. Det teller.',
    markDone: 'Ferdig',
  },
  // Home Energy-måler (components/EnergyMeter.tsx)
  energyMeter: {
    title: 'Energi',
    /* Se den engelske tvillingen: disse navngir måleren, ikke bare perioden (2026-08-03). */
    today: 'Energi i dag',
    thisWeek: 'Energi denne uken',
    remaining: (n: number) => `${n} igjen`,
    usedOf: (used: number, cap: number) => `${used} / ${cap} brukt`,
    editTitle: 'Juster energi',
    todayCapacity: 'Energi i dag',
    weekCapacity: 'Energi denne uken',
    /* Se de engelske tvillingene: én linje per teller, som sier hva telleren endrer (2026-08-03). */
    todayCapacityHint: 'Hvor mye dagen i dag rommer. Alle andre dager beholder sitt eget tall.',
    weekCapacityHint: 'Hvor mye hele uken rommer.',
    done: 'Ferdig',
    hint: 'Planlegg dagen ut fra energien du faktisk har.',
    boostToday: 'Ekstra i dag',
    boostHint: 'Noen dager rommer mer enn vanlig. Dette legges bare til i dag, og i morgen starter på det vanlige igjen.',
    /* "bare i dag" er hele poenget — tallet er lånt av én dag, ikke en større dag. */
    boostChip: (n: number) => `+${n} bare i dag`,
    surplusLabel: (n: number) => `${n} utover dagens energi`,
  },
  energyPause: {
    // "Mine er som regel det også" keeps the narrator alongside the user rather than above
    // them — the same move as the English line, not a literal rendering of it.
    sheetLine: 'Det er mer enn en dag rommer. Mine er som regel det også.',
    decide: 'Jeg velger',
    imGood: 'Det går fint',
    afterDecide: 'Resten venter. Denne er den.',
    // "bare kjører man på" is the everyday Norwegian for pressing on without a plan; it
    // carries the shrug the English "you just go" has, which a literal translation loses.
    afterGood: 'Greit nok. Noen dager bare kjører man på.',
    overspendLabel: 'Over dagens energi — valg',
    pinnedLabel: 'Festet — trykk for å løsne',
  },
  a11yAdd: 'Legg til',
  a11yDiscardRow: 'Forkast ny rad',
  showHint: 'Slik fungerer det',
  hideHint: 'Skjul instruksjoner',
  pad: {
    summary: (left: number, total: number) => `${left}/${total} igjen`,
    more: (n: number) => `${n} flere`,
    all: 'Vis alle',
    less: 'Mindre',
    type: {
      note: 'Skriv notat',
      task: 'Skriv oppgave',
      habit: 'Skriv vane',
      item: 'Skriv vare',
    },
    moreOptions: 'Flere valg',
    recurrencePicker: 'Hvor ofte?',
    captureTarget: {
      label: 'Legg til som',
      task: 'Oppgave',
      moment: 'Øyeblikk',
    },
  },
  padRow: { actionLabel: 'Mer for denne raden' },
  dayLog: {
    title: 'I dag',
    // The one first-person line in the app — see VOICE.md and the English side's note.
    empty:
      'Jeg husker de store tingene. Det er alt imellom som forsvinner — særlig det som skjedde midt i kaoset.',
    capturePrompt: 'Hva skjedde nå?',
    now: 'nå',
    nothingAhead: 'Ingenting fast igjen i dag.',
    earlierDays: 'Tidligere dager',
    deleteMoment: 'Slett dette notatet',
    kinds: {
      medicine: 'Medisin',
    },
    calendars: {
      title: 'Kalendere på tidslinjen',
      hint: 'Hendelser herfra vises foran nå-linjen. Ingenting skrives tilbake.',
    },
  },
  sendTo: {
    title: 'Send den til…',
    todo: 'Gjøremål',
    shopping: 'Handleliste',
    habits: 'Vaner',
    goals: 'Mål',
  },
  newTask: 'Ny oppgave',
  add: 'Legg til',
  taskTitlePlaceholder: 'Hva må gjøres?',
  dateLabel: 'Dato',
  calendar: {
    prevMonth: 'Forrige måned',
    nextMonth: 'Neste måned',
    jumpToToday: 'I dag',
    jumpToTodayHint: 'Hopp til i dag',
    selectedSuffix: 'valgt',
    todaySuffix: 'i dag',
  },
  pickOtherDate: (date: string) => `Velg en annen dato (${date})`,
  hideCalendar: 'Skjul kalender',
  timeLabel: 'Tidspunkt',
  wheneverHint: 'Ingen fast tid – dukker opp som noe å gjøre den dagen.',
  lightDarkModeLabel: 'Lys/Mørk modus',
  darkModeSystem: 'System',
  darkModeOn: 'På',
  darkModeOff: 'Av',
  durationLabel: 'Varighet (minutter)',
  durationPlaceholder: 'min',
  // Energy system (task-form + habit-form)
  energyConsumeLabel: 'Påvirker energi',
  energyGiveTakeLabel: 'Energi gir / tar',
  energyGiveTakeHint: 'Minus koster energi, pluss gir tilbake. 0 = ingen effekt.',
  stepPlaceholder: 'Legg til et steg',
  deleteTask: 'Slett plan',
  // Task form — "neste gang"-notat (Decision 019, fritekst, kun visning)
  taskHintLabel: 'Neste gang…',
  taskHintPlaceholder: 'f.eks. Legg laderen i den øverste skuffen',
  // Task form — "så"-oppfølgingslenke (Decision 020, én-til-én, kun visning)
  thenTaskLabel: 'Så',
  thenTaskNone: 'Ingen oppfølgingsoppgave satt',
  thenTaskPick: '+ Velg en oppgave',
  thenTaskRemove: 'Fjern lenke',
  thenTaskEmptyList: 'Ingen aktuelle oppgaver å lenke',
  taskAdvancedOptions: 'Avanserte valg',
  // Task form — talediktering (reserve-only, lib/useVoiceCapture.ts), styrt av settings.voiceNotesEnabled
  taskVoiceTitleLabel: 'Diktér tittel',
  taskVoiceTitleStop: 'Stopp diktering',
  // Task form — legg til kontakt (reserve-only, expo-contacts), styrt av settings.contactsEnabled
  taskContactLabel: 'Kontakt',
  taskContactNone: 'Ingen kontakt lagt til',
  taskContactPick: 'Legg til kontakt',
  taskContactRemove: 'Fjern kontakt',
  // Task form — merk med gjeldende sted (reserve-only, expo-location), styrt av settings.locationEnabled
  taskLocationLabel: 'Sted',
  taskLocationNone: 'Ingen sted lagt til',
  taskLocationAdd: 'Merk med stedet mitt',
  taskLocationRemove: 'Fjern sted',
  taskLocationTagged: 'Sted lagt til',
  taskLocationPermissionBody: 'Stedstilgang er nødvendig for å merke denne oppgaven.',
  taskLocationErrorBody: 'Fikk ikke stedet ditt — prøv igjen.',
  // Task form — lagringsbekreftelse (W-B). `day` er en lokalisert referanse (I dag / Imorgen / Mandag…).
  taskSavedSimple: 'Lagret ✓',
  scanReceipt: 'Skann kvittering',
  scanHintBanner: 'Hold kameraet mot kvitteringen. Pass på at teksten er tydelig og godt belyst.',
  // --- W-C Grocery additions (scan) ---
  // --- end W-C additions ---
  store: 'Butikk',
  otherStore: 'Annen butikk…',
  customStoreLabel: 'Butikknavn',
  customStorePlaceholder: 'F.eks. Lokalt utsalg',
  selectStoreFirstTitle: 'Velg butikk',
  selectStoreFirstBody: 'Velg hvilken butikk denne kvitteringen er fra før du legger til varer.',
  takePhoto: 'Ta bilde',
  chooseFromLibrary: 'Velg fra bibliotek',
  addManually: 'Legg til manuelt',
  analysingReceipt: 'Analyserer kvittering…',
  recognisedItems: 'Gjenkjente varer – velg hvilke som skal legges til',
  addToList: (n: number) => `Legg til ${n} varer i handlelisten`,
  scanningSubtitle: 'Finner varer og priser',
  foundOnReceipt: 'Funnet på kvittering',
  itemsSelectedCount: (n: number, total: number) => `${n} av ${total} varer valgt. Fjern merket fra varer du ikke vil legge til.`,
  addToListButton: (n: number) => `Legg til i handleliste (${n})`,
  totalAmount: (formattedSum: string) => `Totalt: ${formattedSum}`,
  manualEntryTitle: 'Skriv inn manuelt',
  manualEntryHint: 'Skriv inn varenavn, én per linje. Vi legger dem til i handlelisten din.',
  manualEntryPlaceholder: 'Melk\nBrød\nEgg\n...',
  addedTitle: 'Lagt til!',
  addedBody: (n: number) => `${n} varer ble lagt til i handlelisten.`,
  addItemBtn: 'Legg til vare',
  settingsTitle: 'Innstillinger',
  version: {
    title: 'Versjon og oppdateringer',
    appVersion: 'App-versjon',
    runtime: 'Kjøretid',
    channel: 'Kanal',
    source: 'Kjører',
    sourceEmbedded: 'Innebygd pakke',
    sourceOta: 'OTA-oppdatering',
    updateId: 'Oppdaterings-ID',
    published: 'Publisert',
    embedded: 'innebygd',
    checkButton: 'Se etter oppdateringer',
    checking: 'Sjekker…',
    upToDate: 'Du har den nyeste oppdateringen.',
    downloaded: 'Oppdatering lastet ned — starter på nytt…',
    failed: 'Kunne ikke se etter oppdateringer. Sjekk tilkoblingen og prøv igjen.',
    disabled: 'Denne bygget har trådløse oppdateringer avslått (det er et debug-bygg). Installer et release-bygg for å motta OTA-oppdateringer.',
    updateAvailable: 'Oppdatering tilgjengelig — trykk for å installere og starte på nytt',
    experimental: 'Eksperimentell versjon — UnFocus er under arbeid, så ting kan endre seg, flytte på seg eller ryke.',
  },
  sectionProfile: 'Profil',
  yourName: 'Ditt navn',
  namePlaceholder: 'Fornavn (valgfritt)',
  sectionShopping: 'Handleliste',
  weeklyResetDay: 'Nullstill ukesliste på (ukedag)',
  monthlyResetDate: 'Nullstill månedsliste på dato',
  weeklyReminders: 'Ukentlige påminnelser',
  reminderTimeLabel: 'Påminnelsestidspunkt (HH:MM)',
  timeInputPlaceholder: 'TT:MM',
  taskNotifications: 'Planvarsler',
  taskNotificationsHint: 'Påminnelse når en plan begynner',
  persistentNotifLabel: 'Dagens oversikt-varsel',
  persistentNotifHint: 'Holder ett varsel oppdatert med dagens gjenstående oppgaver og varer på handlelisten',
  habitNotifications: 'Varslinger for vaner',
  habitNotificationsHint: 'Påminnelse når det er tid for en vane',
  workHoursFrom: 'Fra',
  workHoursTo: 'Til',
  sectionLanguage: 'Språk',
  sectionReset: 'Nullstill data',
  resetMonthly: 'Nullstill månedsliste',
  resetTasks: 'Nullstill alle gjøremål',
  resetOnboarding: 'Nullstill introduksjon',
  resetConfirmTitle: (label: string) => `Nullstill ${label}?`,
  resetConfirmBody: 'Dette kan ikke angres.',
  resetConfirmBtn: 'Nullstill',
  deleteConfirmTitle: (label: string) => `Slette ${label}?`,
  deleteConfirmBody: 'Er du sikker?',
  deleteConfirmBtn: 'Slett',
  features: [
    { icon: 'home-outline', text: 'Hjem — hurtigvalg og en enkel oversikt over dagen' },
    { icon: 'checkbox-outline', text: 'En gjøremålsliste som holder på det dagen krever, så du slipper å huske det' },
    { icon: 'cart-outline', text: 'Handlelister som setter seg selv opp, oversikt over hva du har hjemme, og matretter du kan skyve rett til lista' },
    { icon: 'repeat-outline', text: 'Vaner som gir dagene struktur, én dag av gangen — uten en rekke å miste' },
    { icon: 'heart-outline', text: 'Helse — logg symptomer og hendelser, og se trendene over tid' },
    { icon: 'battery-half-outline', text: 'Et energisystem som balanserer gjøremål, vaner og helse mot energien du faktisk har' },
  ],
  monthlyResetDateQuestion: 'Hvilken dato nullstilles månedslisten?',
  weeklyRemindersOnboarding: 'Ukentlige påminnelser',
  aiSetupBtn: 'Sett opp med AI',
  aiSetupPickAnother: 'Du kan velge en annen måte å starte på.',
  firstRun: {
    step: (n: number, total: number) => `${n} av ${total}`,
    skip: 'Hopp over',
    continue: 'Fortsett',
    finish: 'Ferdig',
    settingsNote: 'Du kan endre alt dette senere i innstillingene.',
    reRun: 'Kjør oppsettet på nytt',
    reRunHint: 'Gå gjennom bevegelse, skriftstørrelse, utseende og startskjerm en gang til. Det starter med det du har nå.',
    motion: {
      title: 'Hvor mye bevegelse vil du ha?',
      sub: 'Animasjon kan gjøre at ting henger sammen, eller den kan komme i veien.',
      osReduced: 'Telefonen din ber om redusert bevegelse, så appen holder bevegelsen nede allerede.',
      full: { label: 'Full', desc: 'Myke overganger og bevegelig bakgrunn.' },
      reduced: { label: 'Redusert', desc: 'Overgangene blir, bakgrunnen står stille.' },
      none: { label: 'Ingen', desc: 'Ingen animasjon noe sted.' },
    },
    textSize: {
      title: 'Hvor stor skal teksten være?',
      sub: 'Denne skjermen endrer seg mens du trykker, så du ser størrelsen du velger.',
      small: 'Litt mindre enn standard.',
      default: 'Standardstørrelsen.',
      large: 'Større tekst i hele appen.',
    },
    appearance: {
      title: 'Velg hvordan appen ser ut.',
      sub: 'Skjermen endrer seg mens du trykker.',
      off: { label: 'Lys', desc: 'Mørk tekst på lys bakgrunn.' },
      system: { label: 'System', desc: 'Følger telefonens lys- eller mørkinnstilling.' },
      on: { label: 'Mørk', desc: 'Lys tekst på mørk bakgrunn.' },
    },
    startScreen: {
      title: 'Hvor skal appen åpne?',
      settingsLabel: 'Startskjerm',
      sub: 'De andre fanene er ett trykk unna.',
      home: 'Dagen i et overblikk.',
      plans: 'Dagens gjøremålsliste.',
      shopping: 'Handlelistene dine.',
    },
  },
  tour: {
    step: (n: number, total: number) => `${n} av ${total}`,
    next: 'Skjønner',
    /* `skipStep` fjernet 2026-08-03 — se den engelske tvillingen. */
    skipAll: 'Hopp over omvisningen',
    steps: {
      home: {
        title: 'Hjem er dagen i et overblikk',
        body: 'Det som skjer i dag samles her — gjøremål, handling, vaner. Hold på et kort for å flytte det, så det du ser mest på ligger øverst.',
      },
      plans: {
        title: 'Gjøremål holder på det dagen trenger',
        body: 'Legg inn én ting du vil få gjort. Lite er bra — et gjøremål du blir ferdig med slår et du stadig skriver om.',
      },
      shopping: {
        title: 'Handlelisten nullstiller seg selv',
        body: 'En ukeliste til dagligvarer og en månedsliste til det huset trenger. Kryss av mens du går; ukelisten starter på nytt på dagen du velger.',
      },
      habits: {
        title: 'Vaner, én dag om gangen',
        body: 'Velg én å begynne med. Det finnes ingen rekke å miste her — en rolig dag er bare en rolig dag.',
      },
      health: {
        title: 'Helse legger merke til mønstre',
        body: 'Loggfør et symptom eller hvordan du sov, så bygger trendene seg opp over tid. Medisiner ligger her også, i morgen-, midt på dagen-, kvelds- og nattbrett.',
      },
    },
    finale: {
      title: 'Det var omvisningen',
      body: 'Alt annet er tilgjengelig fra disse fem fanene, og hver skjerm har en ⓘ-knapp med tips og innstillinger for den skjermen.',
      experimental: 'UnFocus er under arbeid. Ting kan endre seg, flytte på seg eller komme halvferdig — det er forventet. Alt blir på telefonen din, og alle tilbakemeldinger former det som kommer.',
      done: 'Begynn å bruke appen',
    },
  },
  basics: {
    title: 'Litt grunnleggende',
    sub: 'Denne skjermen endrer seg mens du trykker, så du ser hva du velger. Alt har allerede en standard som fungerer.',
    /* Se den engelske tvillingen: dette er det en helt ny bruker møter først. */
    welcomeTitle: 'Dagen din, på ett sted',
    welcomeSub: 'UnFocus samler gjøremål, handling, vaner og helse, så du har ett sted å se. Ingenting her fører regnskap.',
    appearance: 'Utseende',
    textSize: 'Tekststørrelse',
    motion: 'Bevegelse',
    language: {
      label: 'Språk',
      en: { label: 'English', desc: 'Appen snakker engelsk.' },
      no: { label: 'Norsk', desc: 'Appen snakker norsk.' },
    },
    handedness: {
      label: 'Menyside',
      right: { label: 'Høyre', desc: 'Menyknappen til høyre, for høyre hånd.' },
      left: { label: 'Venstre', desc: 'Menyknappen til venstre, for venstre hånd.' },
    },
  },
  chooseLanguage: 'Velg språk',
  chooseLanguageSub: 'Du kan endre dette i innstillingene når som helst.',
  english: 'English',
  norwegian: 'Norsk',
  dayLabels: ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'],
  dayFull: ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'],
  today: 'I dag',
  addTime: '+ Legg til tidspunkt',
  permissionTitle: 'Tilgang nødvendig',
  permissionBody: 'Kameraet trenger tilgang for å skanne kvitteringer.',
  shoppingTitle: 'Handleliste',
  shoppingRemaining: (r: number, c: number) => `${r} gjenstår · ${c} i kurven`,
  shoppingItemPlaceholder: 'Vare',
  shoppingUnitPlaceholder: 'Enhet (stk, kg, l…)',
  inCart: 'I kurven',
  // --- W-C Grocery additions (shopping) ---
  itemAddedToList: (name: string) => `${name} lagt til ✓`,
  itemAddedToNamedList: (name: string, listName: string) => `${name} lagt til i ${listName} ✓`,
  itemAddedToInventory: (name: string) => `${name} lagt til inventar ✓`,
  itemsAddedToList: (n: number) => `${n} varer lagt til ✓`,
  // Decision 022 drag-to-merge — transient toast after a same-name merge / dish-join drop
  mergedIntoDish: (dish: string) => `Slått sammen i ${dish} ✓`,
  movedToDish: (dish: string) => `Flyttet til ${dish} ✓`,
  itemPutBackToInventory: (name: string) => `${name} lagt tilbake i inventar`,
  // --- end W-C additions ---
  weeklyTabLabel: 'Ukelister',
  monthlyTabLabel: 'Måned',
  // --- Katalog/Ukeliste redesign ---
  inWeeklyListSection: 'Handleliste',
  purchasedThisMonthSection: 'Kjøpt denne måneden',
  tripLabel: (date: string) => `Handlet ${date}`,
  temporaryBadge: 'Midlertidig',
  updateSheetTitle: 'Oppdater vare',
  varenavnLabel: 'Varenavn',
  estimertPrisLabel: 'Estimert pris',
  onsketAntallLabel: 'Ønsket antall ved reset',
  onsketAntallWeeklyLabel: 'Ønsket antall',
  midlertidigToggleLabel: 'Midlertidig',
  saveBtn: 'Lagre',
  cancelBtn: 'Avbryt',
  deleteFromCatalogBtn: 'Slett fra katalog',
  deleteConfirmText: 'Er du sikker?',
  inKurvenSection: (n: number) => `I kurven (${n})`,
  doneShoppingBtn: 'Handlingen fullført 🛍️',
  doneShoppingReceiptTitle: 'Har du en kvittering?',
  doneShoppingReceiptBody: 'Skann eller last opp for å loggføre kjøpet, eller hopp over og bare fullfør.',
  scanReceiptBtn: 'Skann kvittering',
  uploadPhotoBtn: 'Last opp bilde',
  skipBtn: 'Hopp over',
  doneShoppingSuccessText: 'Bra jobbet!',
  weeklyEmptyTitle: 'Ingenting på listen ennå',
  weeklyEmptySubtitle: 'Legg til varer nedenfor.',
  unsavedShoppingBanner: (n: number) => `Ulagret: ${n} liste${n === 1 ? '' : 'r'} fortsatt ulåst`,
  // Tomme beholdere i handlelisten
  newWeeklyListTitle: 'Lag en ny liste',
  startEmptyList: 'Start tom',
  deleteList: 'Slett liste',
  deleteListConfirmTitle: 'Slette denne listen?',
  deleteListConfirmBody: 'Dette sletter listen og alle varene permanent.',
  // Rediger-inventar-skjerm
  inventoryEditTitle: 'Rediger inventar',
  manageInventoryAction: 'Administrer inventar',
  // Månedlig nullstilling-sammendrag
  monthlyResetSummaryTitle: 'Månedslisten er nullstilt',
  monthlyResetSummaryInventorySection: 'Inventar',
  monthlyResetSummarySpentLabel: (formattedAmount: string) => `${formattedAmount} brukt`,
  monthlyResetSummaryOfTotalLabel: (formattedAmount: string) => `av ${formattedAmount} totalverdi`,
  monthlyResetSummaryAdHocSection: 'Andre kjøp',
  monthlyResetSummaryEmpty: 'Ingenting ble kjøpt denne perioden.',
  monthlyResetSummaryCloseBtn: 'Skjønner',
  // Gjennomgang før månedlig nullstilling (behold/fjern lister, oppdater inventar)
  monthlyResetReviewTitle: 'Før vi nullstiller…',
  monthlyResetReviewIntro: 'Se gjennom listene og inventaret ditt, eller hopp over og bruk standardvalgene.',
  monthlyResetReviewListsSection: 'Listene dine',
  monthlyResetReviewKeepListLabel: 'Behold denne listen',
  monthlyResetReviewListItemCount: (n: number) => (n === 1 ? '1 vare' : `${n} varer`),
  monthlyResetReviewEmptyLists: 'Ingen lister ennå.',
  monthlyResetReviewInventorySection: 'Hvor mye har du igjen?',
  monthlyResetReviewInventoryHint: 'Juster antallet for varer du fortsatt har på lager.',
  monthlyResetReviewEmptyInventory: 'Inventaret ditt er tomt.',
  monthlyResetReviewSkipBtn: 'Hopp over',
  monthlyResetReviewConfirmBtn: 'Ser bra ut, nullstill',
  listSettingsTitle: 'Listeinnstillinger',
  listRecurringToggleLabel: 'Gjenta denne listen',
  listActiveWeeksLabel: 'Aktive uker i måneden',
  weekNumberChip: (n: number) => `Uke ${n}`,
  monthlyListSection: 'Månedsliste',
  newMonthlyListBtn: 'Ny liste',
  newMonthlyListNamePlaceholder: 'Listenavn',
  createMonthlyListBtn: 'Opprett',
  monthlyListsEmpty: 'Ingen månedslister ennå — opprett en for å komme i gang.',
  deleteMonthlyListAction: 'Slett denne listen',
  weekEmptyTitle: 'Ingen lister denne uken ennå',
  weekEmptyBody: 'Lag en ny liste under for å komme i gang.',
  catalogueSearchPlaceholder: 'Søk i katalogen…',
  monthlyListTotal: (kr: string) => `Totalt: ${kr}`,
  monthlyListEmpty: 'Ingenting lagt til ennå — velg fra katalogen under.',
  monthlyPreviewSearchPlaceholder: 'Søk i månedslisten…',
  monthlyPreviewEmpty: 'Månedslisten din er tom.',
  weekListTotal: (kr: string) => `Totalt: ${kr}`,
  savedListsTitle: 'Lagrede lister',
  saveListAsTemplateBtn: 'Lagre som mal',
  savedListsEmpty: 'Ingen lagrede lister ennå.',
  templateAppliedToast: 'Malen ble lagt til listen din',
  listSavedAsTemplateToast: 'Listen ble lagret som mal',
  savedListsSectionHint: 'Dra inn i en uke under, eller trykk for å velge',
  savedListsChooseWeekBody: 'Legg denne lagrede listen til:',
  savedListInUseLabel: 'I bruk',
  templateAlreadyInWeek: (n: number) => `Allerede i uke ${n}`,
  listSyncedToast: 'Lagret liste oppdatert',
  syncListButtonLabel: 'Synkroniser til lagret liste',
  decreaseQty: 'Reduser antall',
  increaseQty: 'Øk antall',
  removeItemLabel: 'Fjern vare',
  putBackItemLabel: 'Legg tilbake på lager',
  categoryPickerLabel: 'Kategori (valgfritt)',
  categoryLabels: {
    produce: 'Frukt & grønt',
    dairy: 'Meieri',
    meatFish: 'Kjøtt & fisk',
    bakery: 'Bakevarer',
    pantry: 'Tørrvarer',
    frozen: 'Frossenmat',
    household: 'Husholdning',
    other: 'Annet',
  },
  // --- Session A2·2: WeekListCard chrome + sticky-header overflow (Decision 011) ---
  toBuySection: (n: number) => `Å kjøpe (${n})`,
  inCartSection: (n: number) => `I kurven (${n})`,
  purchasedSection: (n: number) => `Kjøpt (${n})`,
  fromMonthlySection: 'Fra månedsliste',
  addSelectedItemsBtn: (n: number) => `Legg til (${n})`,
  categoryFilterAllLabel: 'Alle kategorier',
  categoryFilterAccessibilityLabel: 'Filtrer etter kategori',
  weeklyListSearchPlaceholder: 'Søk i denne listen…',
  addItemInputPlaceholder: 'Søk etter varer…',
  savedListsButtonLabel: 'Lagrede lister',
  deleteListButtonLabel: 'Slett liste',
  listSettingsButtonLabel: 'Listeinnstillinger',
  lockListButtonLabel: 'Lås liste',
  unlockListButtonLabel: 'Lås opp liste',
  shoppingListPlaceholder: 'Handleliste',
  listSaveButtonLabel: 'Lagre endringer',
  listDiscardButtonLabel: 'Forkast endringer',
  unsavedListChangesTitle: 'Ulagrede endringer',
  unsavedListChangesBody: 'Lagre endringene på denne listen før du låser den?',
  saveAndLockBtn: 'Lagre og lås',
  discardAndLockBtn: 'Forkast og lås',
  weekSectionEmpty: 'Ingen lister ennå.',
  listMovedToWeek: (n: number) => `Flyttet til uke ${n}`,
  expandListLabel: 'Vis liste',
  collapseListLabel: 'Skjul liste',
  listOptionsButtonLabel: 'Listevalg',
  addFromMonthlyOption: 'Fra månedsliste',
  addFromDishOption: 'Fra en rett',
  resetMonthlyListAction: 'Nullstill denne listen nå',
  resetMonthlyListConfirmTitle: 'Nullstille denne listen?',
  resetMonthlyListConfirmBody: 'Dette fjerner midlertidige varer og starter en ny nullstillingsperiode for denne listen.',
  resetAllMonthlyListsAction: 'Nullstill alle månedslister nå',
  resetAllMonthlyListsConfirmTitle: 'Nullstille alle månedslister?',
  resetAllMonthlyListsConfirmBody: 'Dette fjerner midlertidige varer på tvers av alle månedslister og logger en ny nullstillingsperiode. Dette skjer vanligvis automatisk på nullstillingsdatoen din.',
  // --- Shopping/Food redesign: in-place Food + Catalogue tabs, Unallocated section ---
  foodTabLabel: 'Mat',
  catalogueTabLabel: 'Katalog',
  foodEmptyHint: 'Ingen retter ennå — trykk + for å legge til.',
  addDishToMealBtn: 'Legg til rett',
  // Dish "+" popup
  addDishPopupTitle: (dish: string) => `Legg til ${dish}`,
  addToWeekListBtn: 'Legg til i ukeliste',
  addToMonthlyListBtn: 'Legg til i månedsliste',
  addToListNoIngredients: 'Denne retten har ingen ingredienser ennå.',
  closePopupLabel: 'Lukk',
  dishAddedToWeek: (dish: string) => `${dish} lagt til i Ikke tildelt ✓`,
  dishAddedToMonthly: (dish: string) => `${dish} lagt til i månedsliste ✓`,
  // Weekly "Unallocated" section (dishes added to the week but not yet a specific list)
  unallocatedSection: 'Ikke tildelt',
  unallocatedHint: 'Retter du la til i uka — flytt hver til en liste.',
  allocateToListTitle: 'Legg til i hvilken liste?',
  allocateItemLabel: 'Flytt til en ukeliste',
  noWeekListsYet: 'Lag en ukeliste først.',
  // Catalogue tab
  catalogueAddNewBtn: 'Legg til vare',
  catalogueItemNamePlaceholder: 'Varenavn',
  catalogueItemPricePlaceholder: 'Pris (kr)',
  catalogueDeleteItemLabel: 'Slett vare',
  catalogueEmpty: 'Ingen varer ennå — legg til en over.',
  catalogueItemAdded: (name: string) => `${name} lagt til ✓`,
  catalogueSearchClearLabel: 'Tøm søk',
  catalogueNoMatches: 'Ingen varer samsvarer med søket.',
  catalogueIndexScrubLabel: 'Hopp til bokstav',
  errorBoundaryTitle: 'Noe gikk galt',
  errorBoundaryRetry: 'Prøv igjen',
  category: 'Kategori',
  shoppingCategories: {
    produce: 'Frukt og grønt',
    dairy: 'Meieri',
    meat: 'Kjøtt',
    fish: 'Fisk',
    bread: 'Brød og bakst',
    frozen: 'Frysevarer',
    canned: 'Hermetikk',
    dry: 'Tørrmat',
    snacks: 'Snacks',
    drinks: 'Drikke',
    cleaning: 'Rengjøring',
    personal: 'Personlig pleie',
    other: 'Annet',
  },
  monthlyDateInputHint: 'Valgfri dato 1–31. I korte måneder nullstilles listen siste dag.',
  invalidMonthlyDateMsg: 'Skriv inn en dag mellom 1 og 31 — tilbakestilt til forrige verdi.',
  // Habits
  habits: {
    notYetToday: 'Ikke ennå i dag',
    cardSubtitle: 'Enkle avkrysninger — ingen rekker, ingen poeng.',
    // --- W-D additions ---
    moreOptions: 'Flere valg',
    fewerOptions: 'Færre valg',
    // --- end W-D additions ---
    editButtonLabel: 'Rediger vane',
    restDay: 'Hviledag',
    restingToday: 'Hviler i dag',
    restDayHint: 'Du hviler i dag — energien for denne vanen står stille, verken belønning eller straff.',
    weeklyProgress: (count: number, goal: number) => `${count}/${goal} denne uken`,
  },
  goals: {
    pickerLabel: 'Mål',
    none: 'Ikke koblet til et mål',
    pick: '+ Koble til et mål',
    remove: 'Fjern kobling',
    emptyList: 'Ingen mål ennå — lag ditt første nedenfor.',
    newPlaceholder: 'Navn på nytt mål',
    add: 'Legg til mål',
    deleteLabel: 'Slett mål',
    deleteConfirmTitle: (name: string) => `Slette «${name}»?`,
    deleteConfirmBody: 'Oppgaver og vaner som er koblet til, blir frakoblet. Dette kan ikke angres.',
    strengthLabel: 'Måldriv — vokser når du jobber med det, avtar rolig når du ikke gjør det.',
    title: 'Mål',
    editLink: 'Mål',
    close: 'Ferdig',
    strengthStrong: 'Går sterkt',
    strengthWarm: 'Er i gang',
    strengthNeutral: 'Klart når du er det',
    linkedCount: (tasks: number, habits: number) =>
      `${tasks} gjøremål · ${habits} vane${habits !== 1 ? 'r' : ''}`,
    lastWorked: (days: number) =>
      days === 0 ? 'Jobbet med i dag' : days === 1 ? 'Sist jobbet med i går' : `Sist jobbet med for ${days} dager siden`,
    neverWorked: 'Ingenting koblet ennå',
    seeAll: 'Se alle →',
  },
  automations: {
    title: 'Automatiseringer',
    navLabel: 'Automatiseringer',
    navHint: 'Enkle hvis-dette-så-det-regler',
    emptyState: 'Ingen automatiseringer ennå — trykk + for å opprette.',
    addNew: '+ Ny automatisering',
    whenLabel: 'Når…',
    thenLabel: 'Så…',
    triggerTaskCompleted: 'En oppgave fullføres',
    triggerShoppingOpened: 'Handlelisten åpnes',
    actionShowMessage: 'Vis en melding',
    actionAddShoppingItem: 'Legg til en handlevare',
    messagePlaceholder: 'Melding som skal vises…',
    itemNamePlaceholder: 'Navn på vare…',
    alertTitle: 'Automatisering',
    saveBtn: 'Lagre automatisering',
    deleteTitle: 'Slette denne automatiseringen?',
    deleteBody: 'Dette kan ikke angres.',
    deleteBtn: 'Slett',
    ruleSummary: (when: string, then: string) => `${when} → ${then}`,
  },
  onboarding: {
    privacy: {
      headline: 'Dataene dine er hos deg',
      local: 'Alt lagres kun på denne enheten — ingenting sendes noe sted.',
      free: 'UnFocus er gratis — og forblir det.',
      /* Se den engelske tvillingen: dette er siste skjerm i oppstarten nå. */
      cta: 'Start',
      restoreLink: 'Gjenoppretter du fra en sikkerhetskopi?',
    },
    restore: {
      headline: 'Har du brukt UnFocus før?',
      body: 'Hvis du lagret en sikkerhetskopi på den gamle telefonen, kan du hente alle dataene tilbake nå. Ellers kan du starte på nytt.',
      restoreCta: 'Ja — gjenopprett dataene mine',
      newCta: 'Nei, jeg er ny her',
    },
  },
  settings: {
    // Energisystem (Generelt-fanen) — valgfritt energibudsjett per oppgave.
    energy: {
      label: 'Energisystem',
      hint: 'Følg et dags- og ukebudsjett for energi — oppgaver og vaner kan gi eller tappe energi.',
      dailyCapacity: 'Energi per dag',
      weeklyCapacity: 'Energi per uke',
      modeLabel: 'Budsjettype',
      modeDaily: 'Daglig',
      modeWeekly: 'Ukentlig',
      modeCustom: 'Egendefinert',
      customHint: 'Still inn hvor mye energi du har på hver ukedag.',
    },
    accessibility: {
      title: 'Tilgjengelighet',
      reducedMotion: 'Redusert bevegelse',
      reducedMotionHint: 'Slår av animasjoner i hele appen',
      particles: 'Partikkeleffekter',
      particlesHint: 'Animerte partikler på startskjermens bakgrunn',
      glassSurfaces: 'Glassflater',
      glassSurfacesHint: 'Frostet glass-finish på kort, knapper og legg-til-knappen. Slå av for enkle, heldekkende flater',
      fontSize: 'Skriftstørrelse',
      fontSizeSmall: 'Liten',
      fontSizeDefault: 'Standard',
      fontSizeLarge: 'Stor',
      leftHanded: 'Venstrehendt modus',
      leftHandedHint: 'Flytter menyknappen til venstre side',
      timelineHorizontal: 'Horisontal gjøremålstidslinje',
      timelineHorizontalHint: 'Viser dagens gjøremål som en tidslinje fra venstre til høyre i stedet for ovenfra og ned',
    },
    photoFormat: {
      title: 'Bildeformat',
      hint: 'Standard beskjæring for bilde-fliser (f.eks. kvitteringsbilder). Tilpass viser hele bildet; de andre beskjærer til en fast form.',
      fit: 'Tilpass',
      square: '1:1',
      classic: '4:3',
      widescreen: '16:9',
      golden: 'Gyllent',
    },
    privacy: {
      headline: 'Dataene dine er hos deg',
      local: 'Alt lagres kun på denne enheten — ingenting sendes noe sted.',
      free: 'UnFocus er gratis — og forblir det.',
    },
    // AP-05 — varslingsfri (stille) periode
    quietHours: {
      label: 'Stille periode',
      hint: 'Oppgavepåminnelser venter til den stille perioden er over i stedet for å avbryte — de går ikke tapt. Vane-påminnelser i den stille perioden blir droppet i stedet.',
    },
    // AP-06B — månedlig handlebudsjett, sammenlignet med kvitteringer i app/budget.tsx
    monthlyBudget: {
      label: 'Månedlig budsjett',
      hint: 'Valgfritt — se hvordan handlebeløpet denne måneden ligger an på Budsjett-skjermen.',
      placeholder: 'f.eks. 3000',
    },
  },
  // --- W-E Config additions (grouped settings + onboarding) ---
  config: {
    skipForNow: 'Jeg ordner dette senere',
    sections: {
      appearance: 'Utseende',
      /* Se den engelske tvillingen (2026-08-03). */
      you: 'Deg',
      notifications: 'Varsler',
      data: 'Data',
      layout: 'Oppsett',
      features: 'Funksjoner',
      advanced: 'Avansert',
    },
    layouts: {
      title: 'Hvordan lister ser ut',
      hint: 'Hvor mye detaljer listene viser. Hver liste kan ha sitt eget.',
      followsDefault: 'Som jeg pleier',
      useDefault: 'Bruk oppsettet jeg pleier å ha',
      customBadge: 'Eget oppsett',
      markAllSeen: 'Marker alt som sett',
      close: 'Ferdig',
      moreLabel: 'Resten',
      newCount: (n: number) => (n === 1 ? '1 ny' : `${n} nye`),
      basic: {
        label: 'Bare det viktigste',
        hint: 'Én linje hver — navn og en hake, ikke noe mer.',
      },
      normal: {
        label: 'Vanlig',
        hint: 'Den vanlige mengden detaljer.',
      },
      everything: {
        label: 'Vis alt',
        hint: 'Alle felt synlige samtidig.',
      },
      inStore: {
        label: 'I butikken',
        hint: 'Store rader etter avdeling. Bare navn, ingen priser.',
      },
      timeline: {
        label: 'På en tidslinje',
        hint: 'Dagen etter klokka. Stille perioder krymper, så det du har på, kommer fram.',
      },
      nowNext: {
        label: 'Nå og neste',
        hint: 'Bare det du holder på med og det som kommer etter. Resten ligger skjult.',
      },
      focusFirst: {
        label: 'Én ting om gangen',
        hint: 'Én oppgave forrest, en kort liste under, og et tall på resten.',
      },
      byPerson: {
        label: 'Per person',
        hint: 'Del I dag i én seksjon per person — med hvem sin tur det er. Denne uka og Alle oppgaver beholder sin egen gruppering.',
      },
    },
    tabs: {
      general: 'Generelt',
      personal: 'Personlig',
      advanced: 'Avansert',
    },
    features: {
      intro: 'Skru på bare det du trenger. Du kan endre dette når som helst.',
      goals: {
        label: 'Mål',
        hint: 'Knytt gjøremål og vaner til et mål, og se hvor sterkt det står.',
      },
      sharing: {
        label: 'Deling og QR',
        hint: 'Send gjøremål og varer til noen andre, og ta imot deres.',
      },
      automations: {
        label: 'Automatisering',
        hint: 'Regler som kjører av seg selv, som å legge til en vare når du åpner listen.',
      },
      medicine: {
        label: 'Medisin',
        hint: 'Et dosekort på Helse-fanen, med påminnelse for hver del av dagen.',
      },
      dayLog: {
        label: 'Dagen slik den skjedde',
        hint: 'Holder det du allerede har gjort over nå-linjen, og det som er igjen under.',
      },
      energy: {
        label: 'Energi',
        hint: 'Gi oppgaver og vaner en energiverdi, og se hva en dag eller uke summerer seg til.',
        modes: {
          label: 'Hvordan det kjennes å bli ferdig',
          energy: {
            label: 'Energimodus',
            hint: 'Oppgaver og vaner har en energikostnad, og måleren viser hva dagen har igjen.',
          },
          rewards: {
            label: 'Belønningsmodus',
            hint: 'Ingen måler og ingen kostnader. Blir noe ferdig, fylles avkryssingen, og mer er det ikke.',
          },
        },
      },
      growth: {
        label: 'Stille vekst',
        hint: 'Grener vokser sakte fram langs kantene av skjermen, og fargen blir varmere, etter hvert som dagene du holder følge legger seg sammen.',
      },
    },
    freyrMode: {
      label: 'Eksempeldata',
      hint: 'Legger til en startpakke med handleliste-varer, oppgaver, en vane og notater. Slår du den av igjen, fjernes kun det den la til.',
    },
    autoBackup: {
      label: 'Automatisk sikkerhetskopiering',
      hint: 'Holder én sikkerhetskopifil automatisk oppdatert. Det er denne filen du gjenoppretter fra på en ny telefon. Ingenting lastes opp — du velger hvor den lagres.',
      pathLabel: 'Lagres til:',
      locationUnknown: 'ikke valgt ennå',
      lastBackedUp: (when: string) => `Sist sikkerhetskopiert: ${when}`,
      never: 'Ikke sikkerhetskopiert ennå — den oppdateres når du gjør en endring.',
      backUpNow: 'Sikkerhetskopiér nå',
      backedUpNow: 'Sikkerhetskopi oppdatert.',
      locationCanceled: 'Automatisk sikkerhetskopiering forblir av til du velger hvor den skal lagres.',
      shareNote: 'Deling av en kopi inkluderer ikke ditt navn.',
    },
    desc: {
      language: 'Velg språk for alt i appen.',
      name: 'Brukes kun til å hilse på deg — forlater aldri telefonen.',
      weeklyReminders: 'En vennlig ukentlig påminnelse på handledagen din.',
      holidays: 'Vis helligdager i kalenderen din.',
      shoppingDefault: 'Hvilken liste som åpnes først når du handler.',
      weeklyResetDay: 'Ukedagen ukeslisten din nullstiller seg selv.',
      monthlyResetDate: 'Hvis en måned har færre dager, nullstilles den på den siste dagen.',
      hints: 'Korte forklaringer på hvert skjermbilde.',
      dataNote: 'Disse nullstiller ting. Det kan ikke angres.',
    },
  },
  // --- end W-E Config additions ---
  // Local backup & restore (Decision 036) — device-only data portability
  backup: {
    title: 'Sikkerhetskopi',
    desc: 'Lagre alle dataene dine til en fil du beholder, eller gjenopprett fra en. Ingenting lastes opp — filen havner der du velger.',
    exportButton: 'Eksporter sikkerhetskopi',
    importButton: 'Gjenopprett fra sikkerhetskopi',
    exportError: 'Klarte ikke å lage sikkerhetskopifilen.',
    sharingUnavailable: 'Deling er ikke tilgjengelig på denne enheten.',
    invalidFile: 'Dette ser ikke ut som en UnFocus-sikkerhetskopi.',
    tooNew: 'Denne sikkerhetskopien ble laget av en nyere versjon av UnFocus. Oppdater appen først, og gjenopprett deretter.',
    importConfirmTitle: 'Gjenopprette denne sikkerhetskopien?',
    importConfirmBody: (items: number) =>
      `Dette erstatter ALLE dine nåværende data med sikkerhetskopien (${items} elementer). Dette kan ikke angres.`,
    importConfirmBtn: 'Gjenopprett',
    restoreError: 'Klarte ikke å gjenopprette sikkerhetskopien — dataene dine er uendret.',
    restoreDone: 'Gjenoppretting fullført. Appen starter på nytt nå.',
    saveToDevice: 'Lagre på enheten',
    shareCopy: 'Del en kopi',
    savedToDevice: (location: string) => `Sikkerhetskopi lagret til ${location}.`,
    saveUnavailable: 'Lagring til enheten er ikke tilgjengelig på denne enheten.',
  },
  // Lokal konto (Decision 039) — kun på enheten, brukereid profil. Ingen server,
  // ingen pålogging, ingen sky; kontoen sikkerhetskopieres via backup-filen over.
  account: {
    title: 'Lokal konto',
    descNone: 'Opprett en lokal konto for å samle dataene dine i én profil på denne enheten. Ingen registrering, ingen passord, ingen server — den finnes bare her, og du sikkerhetskopierer den selv.',
    descActive: 'Den lokale kontoen din finnes bare på denne enheten. Sikkerhetskopier den til en fil du beholder, eller gjenopprett fra en — ingenting lastes opp.',
    nameLabel: 'Kontonavn',
    namePlaceholder: 'Gi den lokale kontoen et navn',
    createButton: 'Opprett lokal konto',
    createdOn: (date: string) => `Lokal konto · opprettet ${date}`,
    restoreButton: 'Gjenopprett lokal konto',
    deviceOnlyNote: 'Kun på enheten. Ingen innlogging, ingen passord, ingen server — aldri.',
  },
  // AI-oppsettsguide (last ned/last opp) — lib/aiSetupGuide.ts + lib/aiSetupApply.ts.
  // Selve guideteksten er bevisst kun på engelsk (se den filens header) — bare
  // brukergrensesnittet rundt funksjonen går gjennom i18n.
  aiSetup: {
    title: 'AI-oppsettsguide',
    downloadButton: 'Last ned AI-oppsettsguide',
    shareButton: 'Del en kopi',
    uploadButton: 'Last opp AI-oppsettsfil',
    savedToDevice: (location: string) => `Guiden ble lagret til ${location}.`,
    saveUnavailable: 'Lagring til enheten er ikke tilgjengelig på denne enheten.',
    sharingUnavailable: 'Deling er ikke tilgjengelig på denne enheten.',
    exportError: 'Klarte ikke å lage guidefilen.',
    invalidFile: 'Dette ser ikke ut som en utfylt UnFocus AI-oppsettsfil. Sørg for at du laster opp filen AI-en ga deg, ikke selve guiden.',
    staleWarning: 'Denne filen ble laget fra en eldre versjon av oppsettsguiden — noen nyere valg kan mangle. Du kan fortsatt importere det den inneholder, eller laste ned en fersk guide først.',
    previewTitle: 'Dette vil bli satt opp',
    confirmImport: 'Sett det opp',
    nothingToImport: 'Ingenting å importere — denne filen inneholdt ingenting appen kjente igjen.',
    importDone: (n: number) => (n === 1 ? '1 endring utført.' : `${n} endringer utført.`),
    deviceOnlyNote: 'Ingenting lastes opp noe sted — filen havner der du velger, og en import skriver bare til denne enheten.',
    itemsWillBeAdded: (n: number) => (n === 1 ? '1 element blir lagt til' : `${n} elementer blir lagt til`),
    skippedCount: (n: number) => (n === 1 ? '1 element hoppet over' : `${n} elementer hoppet over`),
    settingsWillChange: (n: number) => (n === 1 ? '1 innstilling endres' : `${n} innstillinger endres`),
    skippedField: (field: string, reason: string) => `${field}: ${reason}`,
    domains: {
      tasks: 'Oppgaver',
      habits: 'Vaner',
      goals: 'Mål',
      notes: 'Notater',
      shoppingLists: 'Handlelister',
      shoppingItems: 'Varer på handleliste',
      inventoryItems: 'Husholdningens lager',
      catalogueItems: 'Katalog-elementer',
      meals: 'Måltider',
      monthlyLists: 'Månedslister',
      settings: 'Innstillinger',
    },
    skippedReason: {
      'invalid-date': 'ugyldig dato',
      'invalid-time': 'ugyldig klokkeslett',
      'invalid-enum': 'ukjent verdi',
      'invalid-type': 'mangler eller ugyldig',
      'too-long': 'for langt',
      'weekly-recurrence-needs-days': 'ukentlig vane trenger minst én dag',
      'unknown-version': 'ustøttet versjon',
    } as Record<string, string>,
  },
  // Toggle on/off labels
  on: 'på',
  off: 'av',
  habitsTitle: 'Vaner',
  habitToday: 'I dag',
  habitWeekView: 'Uke',
  habitMonthView: 'Måned',
  reminders: 'Påminnelser',
  habitFormTitle: 'Ny vane',
  habitFormEdit: 'Rediger vane',
  habitDailyGoal: 'Ganger per dag',
  habitWeeklyGoal: 'Ganger per uke',
  habitRecurrence: 'Intervall',
  habitRecurrenceDaily: 'Daglig',
  habitRecurrenceWeekly: 'Ukentlig',
  habitRecurrenceMonthly: 'Månedlig',
  habitRecurrenceWeeklyFlexible: 'Fleksibel',
  habitRecurrenceWeeklyFlexibleHint: 'Hvilken som helst dag teller — vises daglig helt til du har logget den nok ganger denne uken.',
  habitEveryNDaysLabel: (n: number) => `Hver ${n}. dag`,
  habitEveryNWeeksLabel: (n: number) => `Hver ${n}. uke`,
  habitRepeatDaysLabel: 'Hvilke dager',
  habitTitleLabel: 'Navn',
  habitTitlePlaceholder: 'F.eks. Drikk vann',
  habitIconLabel: 'Ikon',
  habitDeleteLabel: 'Slett vane',
  habitNotification: 'Daglig påminnelse',
  habitHowOften: 'Hvor ofte',
  habitReminderLabel: 'Påminnelse',
  habitReminderTimeLabel: 'Tidspunkt',
  habitReminderOffHint: 'Ingen påminnelse — vanen dukker fortsatt opp på dagene sine.',
  habitMoreOptionsHint: 'trykk for å endre plan, ikon eller kategori.',
  habitReminderModeSingle: 'Én gang',
  habitReminderModeCount: 'Flere ganger',
  habitReminderModeInterval: 'Hver…',
  habitReminderCountLabel: 'Hvor mange ganger om dagen',
  habitReminderIntervalLabel: 'Mellomrom mellom påminnelser',
  habitReminderStartLabel: 'Første påminnelse',
  habitReminderEndLabel: 'Siste påminnelse',
  habitReminderEveryHours: (h: number) => `Hver ${h}. time`,
  habitReminderEveryMinutes: (m: number) => `Hvert ${m}. min`,
  habitReminderTimesPreview: (n: number) => `${n} påminnelse${n !== 1 ? 'r' : ''} om dagen`,
  noHabitsYet: 'Ingen vaner ennå — legg til én nedenfor.',
  habitForLabel: 'For',
  habitForMe: 'Meg',
  peopleMode: {
    label: 'Personer / familie',
    hint: 'Tildel oppgaver og vaner til personene i husstanden.',
    profilesHint: 'Legg til personene du vil tildele oppgaver og vaner til. Trykk på en farge for å endre den.',
    addPlaceholder: 'Navn',
    addButton: 'Legg til person',
    removeTitle: (name: string) => `Fjerne ${name}?`,
    removeBody: 'Oppgavene og vanene deres slettes ikke — de flyttes tilbake til deg.',
    filterAll: 'Alle',
    you: 'Deg',
    linkedDevice: 'Synkronisert med telefonen deres',
    onThisPhone: 'Holdes oppdatert på denne telefonen',
  },
  tags: {
    label: 'Merkelapper',
    new: 'Ny',
    newPlaceholder: 'Navn på merkelapp',
    settingsTitle: 'Merkelapper',
    settingsHint:
      'Merkelapper deles med alle du er koblet til, så en merkelapp betyr det samme på begge telefonene. Endrer du navnet, følger det med på alle oppgavene.',
    empty: 'Ingen merkelapper ennå. Legg til en fra en oppgave.',
    removeTitle: (name: string) => `Fjerne ${name}?`,
    removeBody: 'Oppgavene beholder alt annet — de mister bare denne merkelappen.',
    filterAll: 'Alle merkelapper',
    more: (n: number) => `+${n}`,
  },
  energyBalance: {
    title: 'Delt belastning',
    day: 'I dag',
    week: 'Denne uka',
    projected: (left: number, capacity: number) => `${left} / ${capacity}`,
    tasksOnly: 'Kun oppgaver — vanene deres ligger på deres egen telefon',
    lopsided: (name: string) => `${name} bærer mesteparten av dette. Å flytte én ting ville jevnet det ut.`,
    shared: 'Dette ser jevnt fordelt ut.',
  },
  rotation: {
    label: 'Bytt på',
    off: 'Av',
    daily: 'Hver dag',
    weekly: 'Hver uke',
    monthly: 'Hver måned',
    rosterLabel: 'I denne rekkefølgen',
    turn: (name: string) => `${name} sin tur`,
    turnYou: 'Din tur',
    needsTwo: 'Velg minst to personer for at dette skal gå på omgang.',
    unassigned: 'Hvem som helst',
  },
  habitCategories: {
    physical: 'Fysisk',
    mental: 'Mental',
    health: 'Helse',
    nutrition: 'Ernæring',
    sleep: 'Søvn',
    work: 'Jobb',
    wellbeing: 'Velvære',
    other: 'Annet',
  },
  // Sharing
  sharedTitle: 'Delt',
  sharedTasks: 'Delte gjøremål',
  sharedShopping: 'Delt handleliste',
  shareSelected: 'Del valgte',
  shareSendText: 'Send som tekst',
  shareTitle: 'Del liste',
  shareInstructions: 'Be den andre om å åpne UnFocus, trykke Skann, deretter trykke «Skann QR-kode».',
  // Forklaring på hva deling gjør her (HintCard på hver deleflate).
  // Merk: dette er en engangskopi i dag, uansett metode — ingen sanntidssynk telefon-til-telefon ennå.
  shareExplainShopping: 'Del en QR-kode den andre skanner inn i sin egen UnFocus-handleliste, eller send listen som tekst — ingen UnFocus nødvendig hos mottakeren.',
  shareExplainTasks: 'Del en QR-kode den andre skanner inn i sin egen UnFocus, eller send listen som tekst — ingen UnFocus nødvendig hos mottakeren.',
  shareExplainLaterBuild: 'Akkurat nå er det en engangskopi — sanntidssynk mellom telefoner kommer i en senere versjon.',
  // Barnemodus (Decision 038c) — låst variant styrt av et foreldrepassord.
  scanQrCode: 'Skann QR-kode',
  qrScanMode: 'Skann delt liste',
  qrScanInstructions: 'Pek kameraet mot en QR-kode fra en annen UnFocus-bruker.',
  qrScanSuccess: 'Liste mottatt!',
  qrScanSuccessBody: (n: number, kind: 'tasks' | 'shopping') =>
    `${n} ${kind === 'tasks' ? `plan${n !== 1 ? 'er' : ''}` : `vare${n !== 1 ? 'r' : ''}`} lagt til i delt liste.`,
  qrInvalid: 'Dette ser ikke ut som en UnFocus QR-kode.',
  sharedDone: 'Utført',
  sharedFromLabel: (name: string) => `Fra ${name}`,
  sharedBySelf: 'Delt av deg',
  noSharedItems: 'Ingenting delt ennå. Del en liste eller skann en annens QR-kode.',
  selectAll: 'Velg alle',
  deselectAll: 'Fjern alle',
  sharedTasksTab: 'Gjøremål',
  sharedShoppingTab: 'Handlelist',
  peers: {
    title: 'Sammenkoblede enheter',
    settingsCardDesc: 'Hold gjøremål og handleliste automatisk synkronisert med en sammenkoblet telefon på samme Wi-Fi.',
    syncToggleLabel: 'Synkroniser over Wi-Fi',
    syncUnavailable: 'Sanntidssynk krever en versjon med nettverksmodulene installert — ikke tilgjengelig i denne appversjonen ennå.',
    manageLink: 'Sammenkoblede enheter →',
    noPeers: 'Ingen sammenkoblede enheter ennå.',
    pairedAt: (date: string) => `Sammenkoblet ${date}`,
    addDevice: 'Koble sammen en enhet',
    removeDevice: 'Fjern',
    removeConfirmTitle: 'Fjerne denne enheten?',
    removeConfirmBody: 'Den slutter å synkronisere med denne telefonen. Du kan koble den sammen igjen senere.',
    chooseRoleTitle: 'Sammenkobling av enhet',
    chooseRoleExplain: 'Begge telefonene må være i samme rom. Trykk «Vis min kode» på DEN ENE telefonen — trykk «Skann en kode» på DEN ANDRE.',
    showMyCode: 'Vis min kode',
    scanACode: 'Skann en kode',
    showCodeInstructions: 'La den andre telefonen skanne denne koden.',
    showCodeNext: 'Neste: skann deres kode',
    showCodeDone: 'Ferdig',
    scanInstructions: 'Pek kameraet mot den andre telefonens kode.',
    pairInvalid: 'Dette ser ikke ut som en UnFocus-sammenkoblingskode.',
    pairedSuccessTitle: 'Sammenkoblet!',
    pairedSuccessBody: (name: string) => `Du er nå sammenkoblet med ${name}.`,
  },
  notif: {
    // W-F: vennligere, ikke-stressende ukentlig påminnelse ("har du lyst?"-tone)
    weeklyTitle: 'Lyst til å planlegge uken?',
    weeklyBody: 'Når det passer deg, ta en titt på hva som er på gang. Ingen hast — du klarer det.',
    // W-F: månedlig tittel + tekst forklarer nå effekten (listen nullstilles)
    monthlyTitle: 'Obs: månedslisten nullstilles snart',
    monthlyBody: 'Den månedlige handlelisten din tømmes i morgen, så sjekk hva du fortsatt mangler hjemme først.',
    taskStartTitle: (title: string) => `Påminnelse: ${title}`,
    taskStartBody: 'Tid for å komme i gang!',
    taskBoxTitle: (title: string) => `Start: ${title}`,
    taskBoxBody: (min: number) => `Du har ${min} minutter til dette. Lykke til!`,
    taskEndTitle: (title: string) => `Ferdig: ${title}`,
    taskEndBody: (min: number) => `${min} minutter er over. Bra jobbet — du kan stoppe nå.`,
    habitReminderTitle: (title: string) => `Vane: ${title}`,
    habitReminderBody: 'En liten påminnelse for i dag.',
    overviewTitle: 'Dagens oversikt',
    overviewBodyNoTasks: 'Ingen oppgaver igjen i dag',
    overviewNothingElse: 'Ingenting mer i kø i dag',
    overviewUpcomingCount: (count: number) => `+${count} flere i dag`,
    // AP-05 — interaktive varselknapper + utsettelse-påminnelse
    actionDone: 'Ferdig',
    actionRemindLater: 'Påminn meg senere',
    renudgeTitle: (title: string) => `Fortsatt der: ${title}`,
    renudgeBody: 'Ingen hast — bare en mild påminnelse når du er klar.',
    actionTaken: 'Tatt',
    medicineTrayTitle: (tray: string) => `Medisin — ${tray.toLowerCase()}`,
    medicineTrayMore: (n: number) => `+${n} flere`,
    medicineSnoozeBody: 'Den ligger her når du kommer til den.',
  },
  // Widget-etiketter for startskjermen (Android).
  widgets: {
    shoppingTitle: 'Handleliste',
    tasksTitle: 'Dagens gjøremål',
    itemsLeft: (n: number) => (n === 1 ? '1 vare igjen' : `${n} varer igjen`),
    tasksLeft: (n: number) => (n === 1 ? '1 oppgave igjen' : `${n} oppgaver igjen`),
    allDone: 'Alt ferdig 🎉',
    noItems: 'Listen er tom',
    noTasks: 'Ingenting planlagt i dag',
    more: (n: number) => `+${n} flere`,
    notesTitle: 'Notater',
    noNotes: 'Ingen notater ennå',
    voiceNote: 'Taleopptak',
    habitsTitle: 'Vaner',
    habitsLeft: (n: number) => (n === 1 ? '1 vane igjen' : `${n} vaner igjen`),
    noHabits: 'Ingen vaner i dag',
    healthTitle: 'Helse',
    noHealth: 'Ingenting logget',
    healthOngoing: (n: number) => (n === 1 ? '1 pågående' : `${n} pågående`),
  },
  nav: {
    newTask: 'Ny oppgave', plans: 'Gjøremål', shop: 'Handle', habits: 'Vaner',
    meals: 'Mat', health: 'Helse', scan: 'Skann', settings: 'Innst.',
    capture: 'Notér', home: 'Hjem', budget: 'Budsjett', automations: 'Automatisering',
    shared: 'Delt', settingsLabel: 'Innstillinger',
  },
  home: {
    todaysPlans: 'Dagens gjøremål',
    seeAllPlans: 'Se alle gjøremål',
    more: 'Mer',
    quantityLabel: 'Antall',
    weeklyListChip: 'Denne uken',
    addToListLabel: 'Legg i',
    extraInfoPlaceholder: 'Detaljer…',
    extraInfoLabel: 'Detaljer',
    manageCards: {
      edit: 'Rediger kort',
      done: 'Ferdig',
      add: 'Legg til kort',
      remove: (label: string) => `Fjern ${label}`,
      kinds: { notes: 'Notater', plans: 'Gjøremål', shopping: 'Handleliste', habits: 'Vaner', goals: 'Mål' },
    },
    cardMenu: {
      open: (card: string) => `Kortinnstillinger for ${card}`,
      subtitle: 'Innstillinger for dette kortet',
      close: 'Ferdig',
      hide: 'Skjul dette kortet',
      hideHint: 'Det ligger fortsatt på sin egen skjerm — ingenting fjernes',
      hideLastHint: 'Hjem beholder minst ett kort',
      arrangeHint: 'Hold på et kort for å dra det opp eller ned',
    },
  },
  health: {
    habits: 'Vaner',
    seeAllHabits: 'Se alle vaner',
    noHabits: 'Ingen vaner ennå',
    addHabit: 'Legg til vane',
  },
  shopping: {
    scan: 'Skann',
    budget: 'Budsjett',
  },
  shoppingWeekPrev: 'Forrige uke',
  shoppingWeekNext: 'Neste uke',
  inStockLabel: 'På lager',
  priceTotal: (total: string) => `${total} totalt`,
  shoppingItemSheet: {
    quantity: 'Hvor mange',
    quantityPlaceholder: 'f.eks. 2, eller «en bunt»',
    name: 'Navn',
    unit: 'Enhet',
    unitPlaceholder: 'kg, L, pk…',
    price: 'Pris per stk',
    category: 'Hvor i butikken',
    done: 'Ferdig',
  },
  suggestions: 'Forslag',
  mealTypes: { breakfast: 'Frokost', lunch: 'Lunsj', dinner: 'Middag', snack: 'Snacks', kveldsmat: 'Kveldsmat' },
  mealDifficulty: { easy: 'Enkel', normal: 'Vanlig' },
  dishDifficultyPickerLabel: 'Vanskelighetsgrad',
  newDishTrigger: '+ Ny rett',
  dishNamePlaceholder: 'Navn på rett',
  ingredientsCount: (n: number) => `${n} stk`,
  ingredientPlaceholder: 'Ingrediens',
  ingredientQuantityLabel: 'Antall',
  editIngredientLabel: (name: string) => `Rediger ${name}`,
  addDishSheetTitle: 'Legg rett til i månedslisten',
  noDishesAvailable: 'Ingen lagrede retter ennå — legg til en på Måltider-siden først.',
  addDishBtn: 'Legg til rett',
  deleteDish: 'Slett rett',
  duplicateDishBtn: 'Dupliser rett',
  dishCopySuffix: ' (kopi)',
  // --- W-C Grocery additions (meals) ---
  // --- end W-C additions ---
  healthTitle: 'Helse',
  thisWeekLabel: 'Denne uken',
  quickLogLabel: 'Hurtiglogg',
  healthLogTitle: 'Helse-logg',
  logSymptomTrigger: 'Hva plager deg?',
  ailmentLabel: 'Plage',
  severityLabel: 'Alvorlighet',
  notesLabel: 'Notat',
  notesPlaceholder: 'Eventuelle notater…',
  severityLabels: ['Mild', 'Litt', 'Moderat', 'Kraftig', 'Alvorlig'],
  whenStartedLabel: 'Når startet',
  whenFinishedLabel: 'Når avsluttet',
  // `Pågår` (verb, stands alone in a row's value column) deliberately coexists with
  // widgets.healthOngoing's `pågående` (adjective agreeing with a count — "2 pågående" is
  // correct Norwegian, "2 Pågår" is not). Not a collision; both spellings stay.
  episodes: {
    ongoing: 'Pågår',
    stillGoing: 'Holder på',
    itsOver: 'Det er over',
    stillGoingPrompt: (symptom: string) => `${symptom} — holder det på?`,
    whenDidItStop: 'Når ga det seg?',
    didAnythingHelp: 'Var det noe som hjalp?',
    seeAllOpen: 'Se alle',
    when: {
      justNow: 'Akkurat nå',
      thisMorning: 'I morges',
      lastNight: 'I går kveld',
      pickTime: 'Velg tidspunkt',
    },
    duration: {
      underHour: 'Under en time',
      aboutAnHour: 'Omtrent en time',
      hours: (n: number) => `Omtrent ${n} timer`,
      mostOfADay: 'Mesteparten av en dag',
      aboutADay: 'Omtrent et døgn',
      days: (n: number) => `Omtrent ${n} døgn`,
    },
  },
  newHealthEntryTitle: 'Ny oppføring',
  editHealthEntryTitle: 'Rediger oppføring',
  unnamedIssue: 'Uten navn',
  noLogsThisWeek: 'Ingenting logget denne uken.',
  healthIssues: {
    title: 'Helseplager',
    openLabel: 'Åpne helseplager',
    subtitle: 'Tingene du holder et øye med.',
    emptyList: 'Ingenting her ennå — det du logger dukker opp i denne listen.',
    newPlaceholder: 'Noe å holde et øye med',
    entryCount: (n: number) => `${n} ${n === 1 ? 'oppføring' : 'oppføringer'}`,
    lastLogged: (days: number) =>
      days === 0 ? 'Logget i dag' : days === 1 ? 'Sist logget i går' : `Sist logget for ${days} dager siden`,
    neverLogged: 'Ingenting logget ennå',
    untrackLabel: 'Slutt å følge',
    untrackConfirmTitle: (name: string) => `Slutte å følge «${name}»?`,
    untrackConfirmBody: 'Den forsvinner fra denne listen. Alt du har logget blir liggende i helse-loggen.',
    close: 'Ferdig',
    cardSubtitle: 'En oversikt over hvordan du har hatt det — ingen poeng, ingen rekker.',
    typePrompt: 'Logg noe',
    logAgain: (name: string) => `Logg ${name} på nytt`,
    timesThisWeek: (n: number) => `${n}×`,
  },
  // --- W-D additions (health) ---
  noLogsGentle: 'Ingen oppføringer enda — logg hvordan du føler deg når du er klar.',
  deleteLogBtn: 'Slett oppføring',
  // --- Symptom catalog + trend drill-down (Health redesign) ---
  symptomSearchPlaceholder: 'Søk eller legg til et symptom…',
  addSymptomOption: (name: string) => `Legg til «${name}»`,
  symptomHistoryTitle: (name: string) => `${name} — historikk`,
  symptomEntriesCount: (n: number) => (n === 1 ? '1 oppføring' : `${n} oppføringer`),
  last90Days: 'Siste 90 dager',
  symptomCategories: {
    physical: 'Fysisk',
    mental: 'Psykisk',
    sleep: 'Søvn',
    digestive: 'Fordøyelse',
    nutrition: 'Ernæring',
    other: 'Annet',
  } as Record<string, string>,
  // --- end W-D additions ---
  cover: {
    tasksToday: 'I dag',
    taskCount: (n: number) => `${n} oppgave${n !== 1 ? 'r' : ''}`,
    noTasks: 'Alt klart!',
    quickAdd: '+ Legg til',
    habitsToday: 'Vaner',
    habitsSummary: (done: number, total: number) => `${done}/${total} ferdig`,
    moreTasksHint: (n: number) => `+${n} til`,
  },
  // Per-skjerm "delt med deg"-forslag (components/SharedRequestsSection.tsx)
  sharedRequests: {
    sectionTitle: 'Delt med deg',
    fromLabel: (name: string) => (name ? `${name}:` : ''),
    accept: 'Legg til',
    dismiss: 'Avvis',
  },
  // AP-06B — kvitteringer + månedlig handlebudsjett (app/budget.tsx)
  budget: {
    title: 'Budsjett',
    titleForList: (listName: string) => `${listName} — Budsjett`,
    spentOfBudget: (spent: string, budget: string) => `${spent} kr av ${budget} kr denne måneden`,
    overBudgetHint: 'Litt over denne måneden — her er hvor pengene gikk.',
    onTrackHint: 'Helt i rute denne måneden.',
    noBudgetSet: 'Sett et månedlig budsjett i Innstillinger for å se hvordan denne måneden ligger an.',
    receiptsTitle: 'Kvitteringer denne måneden',
    noReceipts: 'Ingen kvitteringer denne måneden ennå.',
    olderMonth: '← Eldre',
    newerMonth: 'Nyere →',
    editBudget: 'Endre budsjett',
    setBudget: 'Sett budsjett',
    perStore: 'Per butikk',
    editorTitle: 'Sett budsjett',
    monthlyBudgetLabel: 'Månedlig budsjett (NOK)',
    perDaySpend: (actual: string, budget: string) => `${actual} kr/dag så langt · ${budget} kr/dag i budsjett`,
    overPaceHint: 'Litt over dagstakten din — ingen fare, bare en påminnelse.',
    onPaceHint: 'Fint innenfor dagstakten din.',
  },
  // Notater — frittstående notater med hurtigknapper for handleliste/planer (app/notes.tsx)
  notes: {
    title: 'Notater',
    navLabel: 'Notater',
    emptyState: 'Ingenting ennå. Skriv på første linje, eller trykk på mikrofonen.',
    addNote: 'Legg til et notat',
    headerPlaceholder: 'Notattittel',
    bodyPlaceholder: 'Legg til mer detaljer…',
    addToShoppingLabel: 'Legg til i handleliste',
    addToPlansLabel: 'Lag oppgave',
    deleteNote: 'Slett notat',
    shoppingQuickAddTitle: 'Legg til i handleliste',
    activeLabel: 'Aktive',
    checkedLabel: 'Avkrysset',
    recordVoiceNote: 'Ta opp talenotat',
    stopRecording: 'Stopp opptak',
    micPermissionBody: 'Mikrofontilgang er nødvendig for å legge til et talenotat.',
    micErrorBody: 'Fikk ikke med det — prøv igjen.',
  },
  hints: {
    home: {
      text: 'Dagen på ett blikk. Hold et kort for å flytte.',
      example: 'Krevende oppgaver får minus, de som gir påfyll pluss.',
    },
    taskForm: {
      text: 'Legg til en oppgave med tittel, dato og valgfrie detaljer.',
      example: '',
    },
    habitForm: {
      text: 'Hvor ofte den gjentas, hvor mange ganger om dagen den teller, og eventuelt mål, påminnelser og energiverdi.',
      example: 'F.eks. «Drikk 4 glass vann» — daglig, 4 om dagen.',
    },
    medicineForm: {
      text: 'Velg runder, eller sett den til ved behov med minste pause mellom doser.',
      example: 'F.eks. smertestillende ved behov, minst 6 timer mellom.',
    },
    shopping: {
      text: 'Legg til når du går tom. Nullstilles ukentlig. Hold en rad for å flytte.',
      example: 'F.eks. melk ukentlig, vaskepulver månedlig.',
    },
    meals: {
      text: 'Bla gjennom retter og legg ingrediensene til handlelisten.',
      example: '',
    },
    health: {
      text: 'Logg og følg opp helseplager over tid.',
      example: 'F.eks. «Hodepine» på 3 av 5 — et par uker viser et mønster.',
    },
    scan: {
      text: 'Bilde av kvittering for å legge til varer, eller skann en delt QR-kode.',
      example: '',
    },
    settings: {
      text: 'Endringer trer i kraft umiddelbart.',
      example: '',
    },
    shared: {
      text: 'Delt med deg — merk din del som utført.',
      example: '',
    },
    habits: {
      text: 'Små ting du vil gjenta. Trykk for å telle, tannhjul for å sette opp. Hold en rad for å flytte.',
      example: 'F.eks. «Drikk 4 glass vann» — daglig, 4 om dagen.',
    },
    plans: {
      text: 'Alt som skal gjøres, etter dag og uke. Under «Når som helst», hold en rad for å flytte.',
      example: 'F.eks. «Bestill tannlegetime» under «Når som helst».',
    },
    automations: {
      text: 'Enkle regler: når X skjer, gjør Y automatisk.',
      example: '',
    },
    notes: {
      text: 'Skriv det ned. Send det videre. Hold et notat for å flytte.',
      example: '',
    },
    goals: {
      text: 'Det større gjøremålene og vanene dine er til for. Koble dem, så blir det sterkere.',
      example: 'Det kan også være noe du vil ha mindre av.',
    },
  },
  starters: {
    exampleLabel: 'Eksempel',
    addExample: 'Legg til',
    dismiss: 'Lukk',
    expandExamples: 'Vis forslag',
    collapseExamples: 'Skjul forslag',
    habits: {
      text: 'Alle seire teller, små som store.',
      tapToAdd: 'Trykk på én for å komme i gang:',
      suggestions: {
        water: 'Drikk 4 glass vann',
        stretch: 'Morgenstrekk',
        posture: 'Sjekk holdningen',
        breakfast: 'Spis frokost',
      },
    },
    plans: {
      text: 'Del opp i mindre biter.',
      tapToAdd: 'Se et eksempel:',
      exampleTitle: 'Rydde',
      exampleSteps: {
        trash: 'Kaste søppel',
        tidy: 'Rydde',
        table: 'Tørke av bord',
        dishwasher: 'Oppvaskmaskin',
        laundry: 'Vaskemaskin',
      },
    },
    shopping: {
      text: 'Legg til varer når du går tom.',
      textWeekly: 'Ukentlig liste for dagligvarer.',
      textMonthly: 'Månedlig liste for det huset trenger.',
    },
    health: {
      text: 'Logg plagene dine. Og hva som hjelper.',
      tapToAdd: 'Se et eksempel:',
      exampleTitle: 'Hodepine',
    },
    medicine: {
      text: 'Legg inn det du tar. Trykk det av når du tar det — en runde er et tidsrom, ikke en frist.',
    },
    notes: {
      text: 'Noter tanker til senere.',
    },
    /* Se den engelske tvillingen: energistripens opplæringstilstand (2026-08-03). */
    energy: {
      text: 'Energi er hvor mye en dag rommer. Gi et gjøremål eller en vane en kostnad, så viser måleren her hva dagen har igjen.',
      action: 'Sett dagens energi',
    },
    goals: {
      text: 'Det gjøremålene og vanene dine går til sammen om.',
      tapToAdd: 'Trykk på en for å starte:',
      suggestions: {
        rested: 'Bli mer uthvilt',
        moving: 'Være i bevegelse hver dag',
        cutBack: 'Mindre tid på telefonen',
        together: 'Mer tid med dem jeg er glad i',
      },
    },
  },
  medicine: {
    title: 'Medisin',
    trays: {
      morning: 'Morgen',
      midday: 'Midt på dagen',
      evening: 'Kveld',
      night: 'Natt',
    },
    addPlaceholder: 'Legg til medisin',
    stillDue: (tray: string) => `Gjenstår: ${tray}`,
    nextUp: (tray: string, time: string) => `Neste: ${tray} kl. ${time}`,
    allTaken: 'Alt tatt i dag',
    takenAt: (time: string) => `Tatt ${time}`,
    markTaken: (name: string) => `Merk ${name} som tatt`,
    undoTaken: (name: string) => `Angre ${name}`,
    trayProgress: (taken: number, total: number) => `${taken}/${total}`,
    asNeededLabel: 'Ved behov',
    asNeededReady: 'Kan tas nå',
    asNeededWait: (time: string) => `Tidligst igjen ${time}`,
    asNeededLimit: 'Maks for dagen nådd',
    asNeededTakenToday: (n: number) => (n === 1 ? '1 i dag' : `${n} i dag`),
    logDose: (name: string) => `Logg en dose ${name}`,
    remindersTitle: 'Påminnelsestider',
    remindersToggle: 'Påminn meg for hver runde',
    remindersOffHint: 'Kortet virker fortsatt — du blir bare ikke minnet på det.',
    remindersQuietHint: 'En runde inne i stilletiden hoppes over, den flyttes ikke.',
    forMe: 'Meg',
    formTitleNew: 'Ny medisin',
    formTitleEdit: 'Medisin',
    nameLabel: 'Navn',
    namePlaceholder: 'F.eks. Elvanse',
    doseLabel: 'Dose',
    dosePlaceholder: 'F.eks. 30 mg',
    traysLabel: 'Når skal den tas',
    traysHint: 'Velg én eller flere. En runde er et tidsrom, ikke en frist.',
    asNeededSwitch: 'Ta ved behov i stedet',
    asNeededHint: 'Ingen runde og ingen påminnelse — bare en sperre mot å ta den igjen for tidlig.',
    minIntervalLabel: 'Minste pause mellom doser',
    minIntervalPlaceholder: 'minutter',
    minIntervalNone: 'Ingen minste pause',
    gapHours: (n: number) => `${n} t`,
    traysRequired: 'Velg minst én runde, eller sett den til ved behov.',
    maxPerDayLabel: 'Maks per dag',
    maxPerDayPlaceholder: '0 = ingen grense',
    personLabel: 'Til',
    notesLabel: 'Notat',
    notesPlaceholder: 'Noe som er verdt å huske',
    activeLabel: 'Tar denne nå',
    inactiveHint: 'Slått av: den blir liggende i historikken, men forsvinner fra kortet.',
    takenRecently: (days: number) => `Tatt ${days} av de siste 7 dagene`,
    takenNeverRecently: 'Ingen doser logget de siste 7 dagene',
    deleteConfirm: 'Slette denne medisinen og dosehistorikken?',
    sideEffectsLabel: 'Notert sammen med denne',
    sideEffectsEmpty: 'Ingenting logget på denne ennå.',
    logSideEffect: 'Noter noe den ga',
    attributionLabel: 'Kan komme fra',
    attributionNone: 'Usikker',
  },
  debug: {
    toggleLabel: 'Feilsøkingsmodus',
    toggleHint: 'Lar deg legge igjen notater på kort og topptekster til utvikleren.',
    howToUse: 'Den er på nå — hvert kort viser en liten «Legg til feilsøkingsnotat»-merkelapp, og du kan trykke hvor som helst på kortet (eller skjermtittelen) for å åpne den samme notatboksen. En liten boble markerer et kort som allerede har et notat; trykk på boblen for å redigere eller slette. (Knapper gjør ikke sin vanlige handling mens den er på — det er meningen, du kommenterer dem, ikke bruker dem.) Bruk «Legg til generelt notat»-knappen nederst på skjermen for ting som ikke hører til et bestemt kort. I toppmenyen: feil-ikonet (bug) slår notatmodus av igjen, den grønne haken sender alle notatene på e-post, og den røde sirkelen sletter dem alle.',
    editNote: 'Rediger notat',
    noteForLabel: (label: string) => `Notat — ${label}`,
    addNote: 'Legg til feilsøkingsnotat',
    generalNote: 'Legg til generelt notat',
    composerPlaceholder: 'Hva tenker du på?',
    exportNotes: 'Eksporter',
    emailNotes: 'Send notater',
    deleteAllNotes: 'Slett alle notater',
    mailSubject: 'UnFocus feilsøkingsnotater',
    exportHeading: (date: string) => `UnFocus feilsøkingsnotater — ${date}`,
    resetNotes: 'Nullstill alle notater',
    saveAndSend: 'Lagre og send',
  },
  designLab: {
    title: 'Designlab',
    linkLabel: 'Designlab',
    toggleHint: 'En arbeidsbenk for \u00e5 endre hvordan appen ser ut, og sende resultatet til utvikleren.',
    intro: 'Endre hvordan appen ser ut, og send resultatet videre. Ingenting her lagres som en innstilling \u2014 det er en beskjed om hva du vil ha.',
    applyLabel: 'Bruk dette overalt',
    applyHint: 'Av: bare denne skjermen endrer seg. P\u00e5: hele appen \u2014 til du sl\u00e5r det av igjen.',
    reset: 'Sett alt tilbake',
    resetConfirm: 'sette alt tilbake',
    exportLabel: 'Send dette',
    saveLabel: 'Lagre p\u00e5 enheten',
    exportEmpty: 'Ingenting er endret enn\u00e5.',
    exportShared: 'Sendt.',
    exportUnavailable: 'Deling er ikke tilgjengelig p\u00e5 denne enheten.',
    exportFailed: 'Det kunne ikke deles.',
    savedTo: (where: string) => `Lagret til ${where}.`,
    noteLabel: 'Hva var du ute etter?',
    notePlaceholder: 'Med dine egne ord \u2014 hva s\u00e5 feil ut, og hva pr\u00f8vde du \u00e5 f\u00e5 til.',
    changeCount: (n: number) => (n === 1 ? '1 endring' : `${n} endringer`),
    modeNote: 'Lyst og m\u00f8rkt har hver sine farger. Bytt utseende for \u00e5 endre det andre.',
    groups: {
      slots: 'Hva som st\u00e5r hvor',
    },
    colorGroups: {
      surfaces: 'Sider og kort',
      text: 'Tekst',
      borders: 'Kanter',
      accent: 'Hovedfargen',
      semantic: 'Bra, d\u00e5rlig, forsiktig',
      hint: 'Forklaringskort',
      screens: '\u00c9n farge per skjerm',
      identity: 'Kortmerker',
    },
    shape: {
      radiusScale: 'Hvor runde',
      spacingScale: 'Hvor mye plass',
      borderScale: 'Hvor tykke kantene er',
      borderCardWidth: 'Kortkant',
      borderFieldWidth: 'Felt- og radkant',
      borderButtonWidth: 'Knappekant',
      borderRampStrength: 'Hvor mye en kant toner ut',
      rowHeight: 'Radh\u00f8yde',
      minTapTarget: 'Minste trykkfelt',
      fontScale: 'Tekststørrelse',
      cardElevation: 'Hvor h\u00f8yt kort l\u00f8fter seg',
    },
    controls: {
      boolean: 'Ja eller nei',
      choice: 'Velg \u00e9n',
      number: 'Et tall',
      time: 'Et klokkeslett',
      rowShape: 'Hvordan rader skilles',
      check: 'Haken',
      button: 'Knapper',
    },
    controlHints: {
      boolean: 'Hver av/p\u00e5-rad i innstillingene og i alle redigeringsskjermer.',
      choice: 'Utseende, tekstst\u00f8rrelse, oppsett \u2014 hver velg-\u00e9n-rad.',
      number: 'Energi, antall, dagsm\u00e5l, kapasitet.',
      time: 'P\u00e5minnelser, medisinbrett, start og slutt p\u00e5 oppgaver.',
      rowShape: 'Hvordan \u00e9n rad skilles fra den neste.',
      check: 'Radens fullf\u00f8rt-kontroll.',
      button: 'Hovedhandlingen p\u00e5 hver skjerm.',
    },
    slots: {
      'row.leading': 'F\u00f8r tittelen',
      'row.meta': 'Linjen under tittelen',
      'row.right': 'Verdien til h\u00f8yre',
      'row.action': 'Radens knapp',
    },
    slotsNote: 'P\u00e5 de ekte skjermene kan disse bare skjule en plass. \u00c5 fylle en er levende her p\u00e5 benken, og beskjeden du sender sier hvilken.',
    idNote: 'De korte ordene p\u00e5 knappene under er navnene som brukes i filen du sender, s\u00e5 de st\u00e5r som de er.',
    changedTag: 'Endret',
    tabs: { card: 'Kort', color: 'Farge', shape: 'Form', controls: 'Kontroller' },
    whichCard: 'Hvilket kort',
    preview: {
      collapse: 'Vis mindre av kortet',
      light: 'Vis det lyst',
      dark: 'Vis det mørkt',
      edit: 'Endre kortet',
    },
    editingPart: (name: string) => `Endrer: ${name}`,
    selectHint: 'Trykk på noe på kortet for å endre det. Hold og dra for å flytte det, eller dra inn en ny ovenfra.',
    addNamed: (name: string) => `Legg til ${name.toLowerCase()}`,
    cardEmpty: 'Dette kortet er tomt. Legg til en del under.',
    cardNoteLabel: 'Hva vil du ha ut av dette kortet?',
    cardNotePlaceholder: 'Med dine egne ord.',
    addPart: 'Legg til noe',
    partsTitle: 'Hva det består av',
    partsHint: 'Hold og dra for å endre rekkefølge. Trykk på én for å endre den.',
    removePart: 'Ta den bort',
    restoreCard: 'Sett dette kortet tilbake',
    addedTag: 'Lagt til',
    cards: {
      generic: 'Et vanlig listekort',
      todo: 'En oppgave',
      habit: 'En vane',
      shopping: 'En handlerad',
      medicine: 'En medisinbolk',
      note: 'Et notat',
      dish: 'En rett',
      homeToDo: 'Gjøremålskortet på Hjem',
      homeHabits: 'Vanekortet på Hjem',
      homeShopping: 'Handlekortet på Hjem',
      homeNotes: 'Notatkortet på Hjem',
    },
    parts: {
      text: 'Tekst',
      value: 'En verdi',
      count: 'En telling',
      price: 'En pris',
      time: 'Et klokkeslett',
      button: 'En knapp',
      slider: 'En skyvebryter',
      toggle: 'En av/på-bryter',
      checkbox: 'En hake',
      stepper: 'Et − / + -par',
      segmented: 'En velg-én-rad',
      chips: 'Små brikker',
      field: 'Noe å skrive i',
      timeField: 'Et klokkeslett å skrive inn',
      icon: 'Et ikon',
      badge: 'Et lite merke',
      chip: 'En brikke',
      personChip: 'Hvem sin den er',
      dot: 'En prikk',
      progress: 'En framdriftslinje',
      divider: 'En skillelinje',
    },
    partSample: {
      text: 'Noen ord',
      value: '2 kg',
      count: '3/6',
      price: '49',
      time: '09:30',
      button: 'Gjør det',
      slider: 'Hvor mye',
      toggle: 'Av eller på',
      checkbox: 'Ferdig',
      stepper: 'Hvor mange',
      segmented: 'Velg én',
      chips: 'Brikker',
      field: 'Skriv her',
      timeField: '08:00',
      icon: 'Ikon',
      badge: 'Merke',
      chip: 'Brikke',
      personChip: 'Alex',
      dot: 'Prikk',
      progress: 'Hvor langt',
      divider: 'Linje',
    },
    partGroups: { words: 'Ord', controls: 'Kontroller', marks: 'Merker' },
    partSlots: {
      header: 'Overskriften på kortet',
      leading: 'Før tittelen',
      title: 'Tittelen',
      meta: 'Linjen under tittelen',
      right: 'Verdien til høyre',
      action: 'Knappen på raden',
      check: 'Haken',
      trailing: 'I stedet for haken',
      body: 'Inne i kortet',
      footer: 'Nederst',
    },
    partEditor: {
      whatItSays: 'Hva det står',
      whatItSaysPlaceholder: 'La stå tomt for eksempelet',
      colour: 'Farge',
      inherited: 'Slik den kommer',
      moreColours: 'Flere…',
      size: 'Hvor stor',
      weight: 'Hvor tung',
      where: 'Hvor den sitter',
      row: 'Hvilken linje',
      width: 'Hvor bred',
      spans: ['En firedel', 'Halve', 'Tre firedeler', 'Hele linja'],
      sizes: { xs: 'Bitteliten', sm: 'Liten', md: 'Vanlig', lg: 'Stor' },
      weights: { regular: 'Vanlig', semibold: 'Tyngre', bold: 'Tyngst' },
    },
    color: {
      pick: 'Velg en farge',
      tune: 'Juster den',
      hue: 'Farge',
      saturation: 'Hvor sterk',
      lightness: 'Hvor lys',
      hex: 'Fargekode',
      putBack: 'Sett denne tilbake',
      close: 'Ferdig',
      was: (hex: string) => `Var ${hex}`,
    },
    sample: {
      primary: 'Hovedhandling',
      secondary: 'Andre handling',
      fieldLabel: 'Et tekstfelt',
      fieldPlaceholder: 'Skriv her',
      toggleLabel: 'En ja-eller-nei-innstilling',
      choiceLabel: 'En velg-\u00e9n-innstilling',
      numberLabel: 'Et tall',
    },
    tokensTitle: 'Farger og former',
    tokensHint: 'Verdiene alle kort er laget av. Endrer du \u00e9n her, endres den overalt.',
    playground: {
      build: 'Bygg',
      use: 'Pr\u00f8v den',
      addCard: 'Legg til et kort',
      emptyScreen: 'Ingenting p\u00e5 denne skjermen enn\u00e5. Legg til et kort under, og sett ting p\u00e5 det.',
      cardName: 'Hva er dette kortet',
      cardNamePlaceholder: 'La st\u00e5 tomt, s\u00e5 har det ikke noe navn',
      duplicateCard: 'Lag en kopi',
      removeCard: 'Ta bort dette kortet',
      startFromReal: 'Eller start fra et av appens egne kort',
      starters: {
        blank: 'Et tomt kort',
        row: 'En rad med avkryssing',
        heading: 'Et kort med overskrift',
      },
      starterHints: {
        blank: 'Ingenting p\u00e5 det. Sett hva du vil der du vil.',
        row: '\u00c9n linje med tittel og noe \u00e5 krysse av.',
        heading: 'En overskrift \u00e5 sette ting under.',
      },
      screenCap: 'S\u00e5 mange skjermer er det plass til.',
      cardCap: 'S\u00e5 mange kort er det plass til p\u00e5 denne skjermen.',
      partCap: 'S\u00e5 mye er det plass til p\u00e5 ett kort.',
    },
  },
  permissions: {
    sectionTitle: 'Enhetsfunksjoner',
    voiceNotes: { label: 'Talediktering', hint: 'Diktér oppgavetittelen med stemmen.' },
    contacts: { label: 'Kontakter', hint: 'Legg til en kontakt på en oppgave.' },
    location: { label: 'Sted', hint: 'Merk en oppgave med stedet ditt.' },
    calendar: { label: 'Kalendersynkronisering', hint: 'Speil tidsfestede oppgaver til enhetens kalender.' },
  },
  feedback: {
    cardTitle: 'Send tilbakemelding',
    cardDesc: 'Funnet en feil, eller har en idé? Skriv den under — det åpner e-postappen din, adressert til utvikleren.',
    placeholder: 'Hva tenker du på?',
    sendButton: 'Send tilbakemelding',
    subject: 'UnFocus tilbakemelding',
    mailUnavailable: 'Fant ingen e-postapp på denne enheten. Prøv igjen fra en enhet med e-post satt opp.',
  },
};

export type Translations = typeof en;

/**
 * Non-hook accessor for the translation dictionary. Use this outside of React
 * components (stores, schedulers) where `useT` cannot run. Pass an explicit
 * language, or omit it to read the current one from the settings store.
 */
export function getTranslations(lang?: Lang): Translations {
  const resolved = lang ?? useSettingsStore.getState().language;
  return (resolved === 'en' ? en : no) as Translations;
}

export function useT(): Translations {
  const lang = useSettingsStore((s) => s.language);
  return getTranslations(lang);
}
