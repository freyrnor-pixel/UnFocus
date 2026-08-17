/**
 * i18n.ts — translation dictionaries (en/no/is) and the useT() / getTranslations() accessors.
 *
 * Holds the full English, Norwegian and Icelandic string tables (all typed off `en`) plus
 * helper functions to read the active language. useT() is the React hook for
 * components; getTranslations() is the non-hook accessor for stores/schedulers;
 * **useLang() (2026-08-19) returns the language CODE** for the one consumer whose strings
 * live outside the dictionaries — see its own doc, and don't treat it as a general escape
 * hatch. Language is sourced from the settings store.
 *
 * Connections:
 *   Imports → store/useSettingsStore
 *   Used by → lib/narratorQuotes.ts (the `Lang` TYPE only — it keys its own per-language table
 *             off it; no dictionary, no hook), components/NarratorQuote.tsx (`useLang`),
 *             app/_layout.tsx, app/budget.tsx, app/habit-form.tsx, app/(tabs)/health.tsx, app/index.tsx, app/meals.tsx, app/notes.tsx, app/onboarding/guided.tsx, app/onboarding/index.tsx, app/onboarding/intro.tsx, app/onboarding/language.tsx, app/onboarding/privacy.tsx, app/pair-device.tsx, app/plans.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, app/shopping.tsx, app/task-form.tsx, components/DebugOverlay.tsx, components/SharedRequestsSection.tsx, components/cover/*, lib/reminders.ts, store/useHabitStore.ts, store/useTaskStore.ts
 *   Data    → reads `language` from the settings Zustand store
 *
 * Edit notes:
 *   - `no` and `is` are both typed as `typeof en`, so every key added to `en` MUST be
 *     added to BOTH (and vice versa) or it won't compile. That is the whole parity
 *     mechanism — there is no runtime key check and none is needed.
 *   - **Icelandic (2026-08-15) is the one dictionary with a grammar helper.** `isCount`
 *     exists because Icelandic takes the singular for a count ending in 1 except 11
 *     ("21 vara", but "11 vörur"), which the bare `n === 1` the other two use gets wrong.
 *     Route every counted noun in `is` through it, and pass two WHOLE forms where the verb
 *     or adjective agrees too ("vara fór" / "vörur fóru"), not a stem plus a suffix.
 *   - Icelandic also cannot inflect interpolated user text (a task title, a person's name)
 *     into the case a verb or preposition wants. Where `no`/`en` write "Slett «X»?" /
 *     "Delete X?", `is` either QUOTES it — „X“, a citation, which takes the nominative —
 *     or routes around the preposition entirely ("A → B ✓"). Don't "tidy" those into the
 *     shape the other two use; see lib/__tests__/icelandic.test.ts.
 *   - Adding a fourth language means: a dictionary typed `typeof en`, an entry in
 *     `DICTIONARIES`, the `Lang` union here, `Language` in store/useSettingsStore,
 *     `LANGUAGE_CHOICES` in lib/firstRunOptions, `basics.language.<code>` in every
 *     dictionary, the Settings picker, WIDGET_STRINGS in lib/widgets/headlessSnapshot,
 *     the enum in lib/aiSetupGuide + lib/aiSetupApply (with a schema-version bump), a
 *     collation locale in lib/collate, and a row in scripts/measure-wraps.mjs's table.
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

export type Lang = 'en' | 'no' | 'is';

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
  discard: 'Discard',
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
  tasksSharedSent: 'Sent',
  tasksSharedReceived: 'Received',
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
  // A worded shortcut in the Today/This week steps card (2026-08-11, Wave B) — moves a task
  // between the dated and Whenever sections without opening the full editor. Same hasStartDate
  // meaning as the "When" block above, just a one-tap version of it for the steps-only variant.
  taskMoveToWhenever: 'Move to Whenever',
  taskMoveToToday: 'Move to today',
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
    noSteps: 'Add a step to take it one at a time',
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
  /** Closes components/HintSheet.tsx — the ⓘ explanation as a bottom sheet (Shopping). */
  hintSheetDone: 'Done',
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
      hint: 'Shown ahead of the now line — nothing is written back',
    },
  },
  /** The ⋯ router on a note row (components/SendToSheet.tsx). */
  sendTo: {
    title: 'Send it to…',
    todo: 'To-do',
    shopping: 'Shopping list',
    habits: 'Habits',
    // Names the drawer this actually lands in: lib/prefill.ts's `goals` slot opens the HABITS
    // tab's drawer, which is the personal one (2026-08-13, when the two drawers split names).
    // Counterintuitive but correct — see components/SendToSheet.tsx's note.
    goals: 'Personal goals',
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
  wheneverHint: 'No fixed time — just something to do that day',
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
  energyGiveTakeHint: 'Minus costs energy, plus gives it back, 0 = no effect',
  stepPlaceholder: 'Add a step',
  deleteTask: 'Delete plan',
  // Task form — "next-time hint" note field (Decision 019, freeform, display-only)
  taskHintLabel: 'Next time…',
  taskHintPlaceholder: 'Keep the charger in the top drawer',
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
  scanHintBanner: 'Point at a receipt — clear, well-lit text works best',
  // --- W-C Grocery additions (scan) ---
  // --- end W-C additions ---
  store: 'Store',
  otherStore: 'Other store…',
  customStoreLabel: 'Store name',
  customStorePlaceholder: 'Local shop',
  selectStoreFirstTitle: 'Pick a store',
  selectStoreFirstBody: 'Pick which store this receipt is from first.',
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
  manualEntryHint: 'One item name per line',
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
    failed: "Couldn't check for updates. Check your connection.",
    disabled: 'Debug build — install a release build to receive updates',
    updateAvailable: 'Update available — tap to install and restart',
    experimental: 'Experimental build — things may change, move or break',
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
  // Was "today's remaining tasks and shopping items" until 2026-08-15, when the overview grew
  // habits, medicine and open episodes — and became readable on the lock screen, which is the
  // part a user needs told before they switch it on.
  persistentNotifHint: 'One notification with the rest of your day, readable on the lock screen',
  habitNotifications: 'Habit reminders',
  medicineNotifications: 'Medicine reminders',
  medicineNotificationsHint: 'One reminder per tray, with a Taken button',
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
    reRunHint: 'Motion, text size, appearance and starting screen again',
    motion: {
      title: 'How much movement do you want?',
      sub: 'Animation can connect things, or get in the way',
      osReduced: 'Your phone asks for reduced motion, so movement is already down',
      full: { label: 'Full', desc: 'Smooth transitions and moving background.' },
      reduced: { label: 'Reduced', desc: 'Transitions stay, moving background goes.' },
      none: { label: 'None', desc: 'No animation anywhere.' },
    },
    textSize: {
      title: 'How large should text be?',
      sub: 'The screen changes as you tap, so you see the size',
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
  //
  // Every `body` is ONE lead line + `\n• ` bullets (2026-08-17 copy pass). The bodies were
  // prose paragraphs that each packed two unrelated facts into one flowing sentence, which is
  // the shape the "no manual" pass (2026-08-17) had already cut everywhere else — the tour was
  // missed because teaching IS its job, and that made it look exempt. It is not: a bullet is
  // the shortest way to say "these are two separate things", and a spotlight card is read once,
  // fast, with the real screen behind it. Both render sites are plain left-aligned `<Text>`
  // with no line clamp (components/TourSpotlight.tsx `cardBody`/`cardNote`), so `\n` is all
  // this needs — don't reach for a list component. Keep the lead line a fragment-length
  // statement of what the screen IS, and put every instruction in a bullet.
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
        body: 'To-dos, shopping and habits, all on one screen.\n• Hold a card to move it to the top.',
      },
      plans: {
        title: 'To-do holds what today needs',
        body: 'Add one thing you want to get done.\n• Small beats perfect — a task you can finish.',
      },
      shopping: {
        title: 'Shopping resets itself',
        body: 'Two lists, both clearing on their own.\n• Weekly, for groceries.\n• Monthly, for what the house needs.',
      },
      habits: {
        title: 'Habits, one day at a time',
        body: 'Pick one to start with.\n• No streak to lose — a quiet day is just a quiet day.',
      },
      health: {
        title: 'Health notices patterns',
        body: 'Log a symptom or how you slept.\n• Medicine sits here too, in morning, midday, evening and night trays.',
      },
    },
    finale: {
      title: 'That is the tour',
      body: 'Everything else lives behind these five tabs.\n• Each screen has an ⓘ button with its own tips and settings.',
      experimental: 'UnFocus is a work in progress.\n• Things may change, move or arrive half-finished.\n• Everything stays on your phone.\n• Feedback shapes what comes next.',
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
    sub: 'Tap to see each change — every row already has a working default',
    /* Screen ONE of a fresh install. Its job is to answer "what is this?" — the old first
       screen was a six-row settings form that never said, and a first-time-user walkthrough
       got all the way through onboarding and the guided tour without finding out. Name the
       four things the app holds, in the order the tabs sit in, and say the one thing that
       makes it different from every other list app. The privacy screen says the local-only
       part, so this one must not spend a line on it. */
    welcomeTitle: 'Your day, in one place',
    welcomeSub: 'To-dos, shopping, habits and health, together. Nothing here keeps score.',
    appearance: 'Appearance',
    textSize: 'Text size',
    motion: 'Movement',
    language: {
      label: 'Language',
      // Language names are deliberately NOT translated — you have to be able to find your own
      // language without already reading the current one.
      en: { label: 'English', desc: 'The app speaks English.' },
      no: { label: 'Norsk', desc: 'The app speaks Norwegian.' },
      is: { label: 'Íslenska', desc: 'The app speaks Icelandic.' },
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
  icelandic: 'Icelandic',
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
  weeklyTabLabel: 'Shopping lists',
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
  doneShoppingReceiptBody: 'Scan or upload it to log the spending, or skip.',
  scanReceiptBtn: 'Scan receipt',
  uploadPhotoBtn: 'Upload photo',
  skipBtn: 'Skip',
  doneShoppingSuccessText: 'Nice work!',
  weeklyEmptyTitle: 'Nothing on the list yet',
  weeklyEmptySubtitle: 'Tap to unlock and add items.',
  unsavedShoppingBanner: (n: number) => `Unsaved: ${n} list${n === 1 ? '' : 's'} still unlocked`,
  // Empty containers in shopping screen
  newWeeklyListTitle: 'Create a new list',
  startEmptyList: 'Start empty',
  deleteList: 'Delete list',
  deleteListConfirmTitle: 'Delete this list?',
  deleteListConfirmBody: 'The list and all its items go for good.',
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
  monthlyResetReviewIntro: 'Review your lists and inventory, or skip.',
  monthlyResetReviewListsSection: 'Your lists',
  monthlyResetReviewKeepListLabel: 'Keep this list',
  monthlyResetReviewListItemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  monthlyResetReviewEmptyLists: 'No lists yet.',
  monthlyResetReviewInventorySection: 'How much do you have left?',
  monthlyResetReviewInventoryHint: 'Adjust the count for what you still have',
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
  /**
   * Display name for the ONE monthly list lib/db.ts seeds on install (id `default-monthly`),
   * which that migration wrote as the untranslated literal `'Monthly'` — the only name in the
   * app the user never chose and never saw translated. Resolved at render time by
   * `monthlyListLabel()` (store/useMonthlyListStore.ts) so it follows the language setting;
   * the moment the user renames the list, their own name wins and this is never shown again.
   */
  defaultMonthlyListName: 'Monthly list',
  newMonthlyListNamePlaceholder: 'List name',
  createMonthlyListBtn: 'Create',
  monthlyListsEmpty: 'No monthly lists yet — create one to get started.',
  deleteMonthlyListAction: 'Delete this list',
  weekEmptyTitle: 'No lists this week yet',
  weekEmptyBody: 'Start one here whenever you need it.',
  catalogueSearchPlaceholder: 'Search the catalogue…',
  monthlyListTotal: (kr: string) => `Total: ${kr}`,
  monthlyListEmpty: 'Nothing added yet — pick from the catalogue below.',
  /** Shown instead of `monthlyListEmpty` when the list is also locked, which hides the add
   *  composer this text would otherwise be describing — see shopping.tsx's usage. Tapping the
   *  row unlocks the list, so the copy names that action instead of pointing at "below". */
  monthlyListEmptyLocked: 'Nothing added yet — tap to unlock and add items.',
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
  // In shop-walk order, matching CATEGORY_VALUES in lib/shoppingCategories.ts — these are the
  // "In the store" layout's aisle headers, so the order is the order you walk. Grown from 8 to
  // 13 on 2026-08-13 when the catalogue's vocabulary and the app's were merged; see that file.
  // Catalogue sort toggle (2026-08-13) — "always" visible, per the maintainer, not only while
  // a query is active. "Type" rather than "category" because the aisle is what it means to a
  // person standing in a shop.
  // Link from Shopping's intro card to Settings → Personal, where the weekly/monthly reset
  // cadence controls moved on 2026-08-13.
  // Per-card scan entries (2026-08-13) — the camera moved off the header, where it had no
  // idea which list you meant. On a list it MATCHES against that list; in the Catalogue it
  // adds unknown names and updates prices. See lib/scanTarget.ts.
  scanReceiptForListAction: 'Scan a receipt',
  scanForCatalogueLabel: 'Scan prices',
  scanTargetWeekly: 'Matching against this shopping list',
  scanTargetMonthly: 'Matching against this monthly list',
  scanTargetCatalogue: 'Adding and updating catalogue prices',
  shoppingCadenceLink: 'Reset days',
  // Settings → General: brings back every intro card the user has closed.
  restoreHintsLabel: 'Show tips again',
  restoreHintsDone: 'Tips are back',
  sortByType: 'By type',
  sortByName: 'By name',
  sortLabel: 'Sort',
  categoryLabels: {
    produce: 'Produce',
    bakery: 'Bakery',
    dairy: 'Dairy',
    meat: 'Meat',
    fish: 'Fish',
    frozen: 'Frozen',
    pantry: 'Pantry',
    canned: 'Tinned',
    snacks: 'Snacks',
    drinks: 'Drinks',
    cleaning: 'Cleaning',
    personal: 'Personal care',
    other: 'Other',
  },
  // --- Session A2·2: WeekListCard chrome + sticky-header overflow (Decision 011) ---
  toBuySection: (n: number) => `To buy (${n})`,
  inCartSection: (n: number) => `In cart (${n})`,
  purchasedSection: (n: number) => `Purchased (${n})`,
  fromMonthlySection: 'From monthly list',
  // --- Store mode (2026-08-11) ---
  storeModeBtn: 'Store mode',
  storeModeTitle: 'In the store',
  storeModeAwakeNote: 'The screen stays on while this is open.',
  storeModeExitBtn: 'Leave store mode',
  storeModeEmpty: 'Nothing on this list yet.',
  moveToCartBtn: 'Put in cart',
  moveToListBtn: 'Back to list',
  markBoughtBtn: 'Bought',
  undoBoughtBtn: 'Back to cart',
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
  resetMonthlyListConfirmBody: 'Clears temporary items on this list and starts a fresh period.',
  resetAllMonthlyListsAction: 'Reset all monthly lists now',
  resetAllMonthlyListsConfirmTitle: 'Reset all monthly lists?',
  resetAllMonthlyListsConfirmBody: 'Clears temporary items on every monthly list and starts a fresh period.',
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
  catalogueAddSheetTitle: 'New item',
  catalogueAddSheetName: 'Name',
  catalogueAddSheetPrice: 'Price',
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
  invalidMonthlyDateMsg: 'Needs a day between 1 and 31 — reverted.',
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
  habitRecurrenceWeeklyFlexibleHint: "Any day counts — daily until the week's count is met",
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
  habitReminderOffHint: 'No reminder — it still shows up on its days',
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
  habitForLabel: 'For',
  habitForMe: 'Me',
  // People / family mode (2026-07-12 redesign) — one settings toggle that shows the
  // person selector in Tasks + Habits. People are managed in Settings.
  // 2026-07-28: backed by the People registry (store/usePeopleStore.ts) instead of a list
  // of names, so everyone has a colour and keeps their tasks through a rename.
  peopleMode: {
    label: 'People / family',
    hint: 'Assign tasks and habits to people in the household',
    profilesHint: 'Tap a colour to change it.',
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
      'Shared with everyone you are paired with; renaming one updates every task',
    empty: 'No tags yet. Add one from a task.',
    removeTitle: (name: string) => `Remove ${name}?`,
    removeBody: 'The tasks keep everything else.',
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
  shareInstructions: 'They open UnFocus → Scan → "Scan QR code"',
  // Plain-language "what does sharing do here" copy (HintCard on each share surface).
  // Note: this is a one-time copy today, either way — no live phone-to-phone sync yet.
  shareExplainShopping: 'A QR code they scan into their own shopping list, or plain text for anyone',
  shareExplainTasks: 'A QR code they scan into their own UnFocus, or plain text for anyone',
  shareExplainLaterBuild: 'A one-time copy for now — live sync comes later',
  // Child mode (Decision 038c) — locked variant gated by a parent password.
  scanQrCode: 'Scan QR code',
  qrScanMode: 'Scan shared list',
  qrScanInstructions: 'Point at a QR code from another UnFocus user',
  qrScanSuccess: 'List received!',
  qrScanSuccessBody: (n: number, kind: 'tasks' | 'shopping') =>
    `${n} ${kind === 'tasks' ? `plan${n !== 1 ? 's' : ''}` : `item${n !== 1 ? 's' : ''}`} added to your shared list.`,
  qrInvalid: 'This does not look like an UnFocus QR code.',
  sharedDone: 'Done',
  sharedFromLabel: (name: string) => `From ${name}`,
  sharedBySelf: 'Shared by you',
  noSharedItems: 'Nothing shared yet — share a list or scan a code',
  selectAll: 'Select all',
  deselectAll: 'Deselect all',
  sharedTasksTab: 'To-do',
  sharedShoppingTab: 'Shopping',
  // LAN live-sync (Decision 038 app integration) — pairing + sync toggle
  peers: {
    title: 'Paired devices',
    settingsCardDesc: 'Tasks and shopping, in sync with a paired phone on the same Wi-Fi',
    syncToggleLabel: 'Sync over Wi-Fi',
    syncUnavailable: 'Not available in this app version yet',
    manageLink: 'Paired devices →',
    noPeers: 'No paired devices yet.',
    pairedAt: (date: string) => `Paired ${date}`,
    addDevice: 'Pair a device',
    removeDevice: 'Remove',
    removeConfirmTitle: 'Remove this device?',
    removeConfirmBody: 'Syncing stops. You can pair it again later.',
    chooseRoleTitle: 'Pairing a device',
    chooseRoleExplain: 'Same room, both phones. One taps "Show my code", the other taps "Scan a code".',
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
    healthTitle: 'Health',
    healthOngoing: (n: number) => (n === 1 ? '1 ongoing' : `${n} ongoing`),
    // Medicine folded into the Health widget + the pinned overview (2026-08-15). Counts
    // MEDICINES, not trays: it doubles as the lock-screen-safe line, where naming a tray
    // would say more about someone's day than a locked phone should. "Still due" is the
    // tray vocabulary — a window that has passed with something in it is never "missed".
    medicineDue: (n: number) => (n === 1 ? '1 medicine still due' : `${n} medicines still due`),
    /** A tray's progress on the widget row, e.g. "2 of 3". */
    trayProgress: (taken: number, total: number) => `${taken} of ${total}`,
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
    quantityPlaceholder: '2, or "a bunch"',
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
    emptyList: 'Nothing here yet — what you log turns up here',
    newPlaceholder: 'Something to keep an eye on',
    entryCount: (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`,
    lastLogged: (days: number) =>
      days === 0 ? 'Logged today' : days === 1 ? 'Last logged yesterday' : `Last logged ${days} days ago`,
    untrackLabel: 'Stop tracking',
    untrackConfirmTitle: (name: string) => `Stop tracking "${name}"?`,
    untrackConfirmBody: 'Leaves this list. Everything logged stays in the health log.',
    close: 'Done',
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
    restDayHint: 'Resting today — its energy just sits still',
    weeklyProgress: (count: number, goal: number) => `${count}/${goal} this week`,
  },
  // Goals — connect tasks & habits to a goal; managed only from the form pickers.
  goals: {
    pickerLabel: 'Goal',
    none: 'Not linked to a goal',
    pick: '+ Connect a goal',
    remove: 'Unlink goal',
    emptyList: 'No goals yet — tap here to add your first one.',
    newPlaceholder: 'New goal name',
    add: 'Add goal',
    deleteLabel: 'Delete goal',
    deleteConfirmTitle: (name: string) => `Delete "${name}"?`,
    deleteConfirmBody: 'Linked to-dos and habits are unlinked. This cannot be undone.',
    strengthLabel: 'Momentum — grows as you work on it, fades gently',
    // ── The Goals screen (app/goals.tsx) + its Home card, 2026-07-28 ──
    // Wording rule for this whole group: a goal is NEVER failing, weak or neglected. One
    // that hasn't been worked in a while has simply cooled back to neutral — lib/
    // goalStrength.ts floors at 0 and is never driven below it — so the copy has to say
    // that too, or the mechanic and the words disagree.
    /**
     * Labels for the "Goals" drawer, which is mounted TWICE — once on Habits and once on To-do
     * (components/CollapsedSection.tsx, both bodies components/GoalsEditor.tsx).
     *
     * **They were ONE key (`editLink`) until 2026-08-13**, so one destination wore one word on
     * two screens. Maintainer: "Habit Goals should be renamed to Personal Goals, and to-do
     * Goals renamed to practical Goals." The split is the point — a goal reached through habits
     * is something you want to BE, one reached through to-dos is something you want DONE — so
     * the two drawers are no longer interchangeable and must not be re-merged into one key.
     *
     * Still bare noun phrases, like Shopping's "Food" and "Catalogue" links, which they share a
     * component with. `editLink` read "Edit Goals" until 2026-08-03 — a verb that overstates
     * what the tap does and reads as a list row rather than a way out of the screen. Keep both
     * of these on the noun side of that line.
     *
     * (The `title` key that sat here is deleted: it named the Goals SHEET, and both the sheet
     * — components/GoalsSheet.tsx — and app/goals.tsx were deleted on 2026-08-12, leaving it
     * with no consumer at all.)
     */
    editLinkPersonal: 'Personal goals',
    editLinkPractical: 'Practical goals',
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
      local: 'Stored on this device only — nothing is sent anywhere',
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
      body: 'Bring everything back from a backup file, or start fresh.',
      restoreCta: 'Yes — restore my data',
      newCta: "No, I'm new here",
    },
  },
  // Accessibility settings (Proposal 4)
  settings: {
    // Energy system (Generelt tab) — optional per-task energy budget.
    energy: {
      label: 'Energy system',
      hint: 'A daily and weekly budget that tasks and habits draw on',
      dailyCapacity: 'Daily energy',
      weeklyCapacity: 'Weekly energy',
      modeLabel: 'Budget type',
      modeDaily: 'Daily',
      modeWeekly: 'Weekly',
      modeCustom: 'Custom',
      customHint: 'Energy per weekday',
    },
    accessibility: {
      title: 'Accessibility',
      reducedMotion: 'Reduced motion',
      particles: 'Particle effects',
      particlesHint: 'Animated particles on the home screen background',
      glassSurfaces: 'Glass surfaces',
      glassSurfacesHint: 'Frosted glass on cards and buttons — off for solid surfaces',
      fontSize: 'Font size',
      fontSizeSmall: 'Small',
      fontSizeDefault: 'Default',
      fontSizeLarge: 'Large',
      leftHanded: 'Left-handed mode',
      leftHandedHint: 'Menu button on the left',
      timelineHorizontal: 'Horizontal to-do timeline',
      timelineHorizontalHint: "Today's to-dos left to right instead of top to bottom",
    },
    // Privacy hint card shown in settings (Proposal 3)
    privacy: {
      headline: 'Your data stays with you',
      local: 'Stored on this device only — nothing is sent anywhere',
      free: 'UnFocus is free — and stays free.',
    },
    // AP-05 — notification quiet hours
    quietHours: {
      label: 'Quiet hours',
      hint: 'Task reminders wait until they are over; habit reminders are skipped',
    },
    // AP-06B — monthly grocery budget, compared against receipts in app/budget.tsx
    monthlyBudget: {
      label: 'Monthly budget',
      hint: 'Optional — compared against your spending on the Budget screen',
      placeholder: '3000',
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
        hint: 'Big rows by aisle, names only',
      },
      timeline: {
        label: 'On a timeline',
        hint: 'The day by the clock, with quiet stretches shrunk',
      },
      nowNext: {
        label: 'Now and next',
        hint: 'What you are doing and what follows — the rest stays tucked away',
      },
      focusFirst: {
        label: 'One thing at a time',
        hint: 'One task front and centre, a short list under it',
      },
      byPerson: {
        label: 'By person',
        hint: 'Today split by person, turns included',
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
      goals: {
        label: 'Goals',
        hint: 'To-dos and habits linked to a bigger aim',
      },
      sharing: {
        label: 'Sharing & QR',
        hint: 'Send and receive to-dos and shopping items',
      },
      automations: {
        label: 'Automations',
        hint: 'Rules that run by themselves',
      },
      medicine: {
        label: 'Medicine',
        hint: 'A dose card on Health, one reminder per tray',
      },
      dayLog: {
        label: 'The day as it happened',
        hint: 'Done above the now line, still to come below',
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
        hint: 'An energy value per task and habit, totalled by day and week',
        modes: {
          label: 'How finishing something lands',
          energy: {
            label: 'Energy mode',
            hint: 'A cost on each thing, and a meter for what is left',
          },
          rewards: {
            label: 'Rewards mode',
            hint: 'No meter, no costs — just the check filling in',
          },
        },
      },
      growth: {
        label: 'Quiet growth',
        hint: 'The backdrop grows and warms as the days add up',
      },
    },
    // Auto-backup to a persistent, user-chosen location that survives uninstall
    autoBackup: {
      label: 'Auto-backup',
      hint: 'One file, kept up to date where you choose — nothing is uploaded',
      pathLabel: 'Backup location:',
      locationUnknown: 'not set yet',
      lastBackedUp: (when: string) => `Last backed up: ${when}`,
      never: 'Not backed up yet',
      backUpNow: 'Back up now',
      backedUpNow: 'Backup updated.',
      locationCanceled: 'Off until you pick a location',
      shareNote: 'A shared copy leaves out your name',
    },
    // The line under each setting row. A FRAGMENT, not a sentence, and no full stop: the row's
    // own label already names the thing, so a sentence here mostly restates it (2026-08-17 copy
    // pass — "sentences where simple words would be enough"). Same shape as `features.*.hint`
    // and `layouts.*.hint`. A full sentence is only correct where the line says something the
    // label cannot, which on this screen is nowhere.
    desc: {
      name: 'Only a greeting — never leaves your phone',
      weeklyReminders: 'A nudge on your shopping day',
      holidays: 'Public holidays on your calendar',
      shoppingDefault: 'Which list opens first',
      weeklyResetDay: 'When the weekly list clears itself',
      monthlyResetDate: 'A short month resets on its last day',
      hints: 'Short explanations on each screen',
      dataNote: 'These cannot be undone',
    },
  },
  // --- end W-E Config additions ---
  // Local backup & restore (Decision 036) — device-only data portability
  backup: {
    title: 'Backup & restore',
    desc: 'All your data in one file you keep — nothing is uploaded',
    exportButton: 'Export backup',
    importButton: 'Restore from backup',
    exportError: "Couldn't create the backup file.",
    sharingUnavailable: 'Sharing is not available on this device.',
    invalidFile: "That doesn't look like an UnFocus backup file.",
    tooNew: 'Made by a newer version of UnFocus. Update the app first.',
    importConfirmTitle: 'Restore this backup?',
    importConfirmBody: (items: number) =>
      `This replaces ALL your current data with the backup (${items} items). This cannot be undone.`,
    importConfirmBtn: 'Restore',
    restoreError: "Couldn't restore the backup — your current data is unchanged.",
    restoreDone: 'Restore complete. The app will reload now.',
    saveToDevice: 'Save to device',
    shareCopy: 'Share a copy',
    savedToDevice: (location: string) => `Backup saved to ${location}.`,
    saveUnavailable: "Saving to device isn't available here.",
  },
  // Local account (Decision 039) — device-only, user-held profile. No server, no
  // credentials, no cloud; the account is backed up via the local backup file above.
  // Backup & restore (Settings → Advanced → Data). Named `account` from Decision 039, when
  // this card also carried a device-only "local account" — a name plus a creation date that
  // nothing in the app ever read. Those rows went on 2026-08-17 and the two strings left are
  // the ones that describe the FILE, which is what the card was always for. The key keeps its
  // old name so the diff stays readable; don't re-add an account here.
  account: {
    title: 'Backup & restore',
    restoreButton: 'Restore from a backup',
    deviceOnlyNote: 'No sign-in, no password, no server — ever',
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
    saveUnavailable: "Saving to device isn't available here.",
    sharingUnavailable: 'Sharing is not available on this device.',
    exportError: "Couldn't create the guide file.",
    invalidFile: 'Not a filled-in setup file. Upload the file the AI gave you, not the guide.',
    staleWarning: 'Made from an older guide, so newer options may be missing. Import anyway, or get a fresh guide first.',
    previewTitle: "Here's what will be set up",
    confirmImport: 'Set it up',
    nothingToImport: 'Nothing in this file the app recognized.',
    importDone: (n: number) => (n === 1 ? '1 change applied.' : `${n} changes applied.`),
    deviceOnlyNote: 'Nothing is uploaded — an import only writes to this device',
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
    noBudgetSet: 'Set a monthly budget in Settings to compare',
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
    overPaceHint: 'A little above your daily pace',
    onPaceHint: 'Nicely within your daily pace.',
  },
  // Notater — free-form notes with shopping/plans quick-action buttons (app/notes.tsx)
  notes: {
    title: 'Notes',
    navLabel: 'Notes',
    emptyState: 'Write on the first line, or tap the mic',
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
    micPermissionBody: 'A voice note needs microphone access.',
    micErrorBody: "Couldn't catch that — try again.",
  },
  /**
   * The ⓘ banner copy — ONE short instruction per screen, and nothing else (2026-08-17).
   *
   * **`example` is deleted.** Every entry used to carry a second, italic, muted line —
   * "Draining tasks get a minus, restoring ones a plus.", "e.g. milk weekly, washing powder
   * monthly.", "e.g. 'Headache' at 3 of 5 — a couple of weeks shows a pattern." Maintainer:
   * *"Remove all italicized explanatory examples from the top info banners. Keep only the
   * absolute shortest, primary instruction."* The prop went from components/HintCard.tsx in the
   * same pass; the keys are deleted here rather than emptied so nothing can wire them back.
   *
   * **The `text` lines were trimmed with them**, to the one thing a first-time reader needs and
   * cannot get from the screen itself — usually a gesture ("Hold a card to move it") or what the
   * surface is for. What came off was every clause the UI already says out loud: a tab bar that
   * shows the day/week split, a row that shows its own gear, a heading that already says
   * "Whenever". `components/HintCard.tsx` clamps these to two lines, so a hint that grows past a
   * short sentence in Norwegian will be truncated rather than pushing the card's controls down.
   */
  hints: {
    home: { text: 'Hold a card to move it.' },
    taskForm: { text: 'Add a task with a title, date, and optional details.' },
    habitForm: { text: 'How often it repeats and how many times a day it counts.' },
    medicineForm: { text: 'Pick its trays, or set it as needed.' },
    shopping: { text: 'Add things as you run out — resets weekly.' },
    meals: { text: 'Browse dishes and add their ingredients to your shopping list.' },
    health: { text: 'Log and track health issues over time.' },
    scan: { text: 'Photo a receipt to add items, or scan a shared QR code.' },
    settings: { text: 'Changes apply immediately.' },
    shared: { text: 'Items shared with you — mark your part done.' },
    habits: { text: 'Tap to count it, gear to set it up.' },
    plans: { text: 'Everything to do, by day and week.' },
    automations: { text: 'Simple rules: when X happens, do Y automatically.' },
    notes: { text: 'Write it down, then send it anywhere.' },
    goals: { text: 'The bigger thing your to-dos and habits are for.' },
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
   * its four *real* one-tap add chips (`suggestions` below, rendered separately in
   * StarterCard's `children`) already cover that job for the exact same item — a second "+" on
   * the preview row would just be a redundant second way to do the same thing.
   */
  /**
   * The empty-state narrator (2026-08-19) — see components/NarratorQuote.tsx and
   * lib/narratorQuotes.ts. The LINES are not here on purpose: they are a per-language list
   * the user cycles through, and a numbered key family in three dictionaries cannot grow
   * without three edits in lockstep. Only the control's accessibility label lives here.
   */
  narrator: {
    /** The refresh glyph beside the quote. Named for what it does, not for what it shows. */
    nextQuote: 'Show another line',
  },
  starters: {
    /** Accessibility-label prefix for an example row's "+" add button, e.g. "Add Milk". */
    addExample: 'Add',
    /** Accessibility label for a StarterCard's dismiss "X" (2026-08-06). */
    dismiss: 'Dismiss',
    /** Generic collapse/expand a11y labels for StarterCard's `collapsible` trigger row
     *  (2026-08-06 v3) — shared across every caller, replacing the per-screen pairs a
     *  first pass (Habits) hand-rolled. */
    expandExamples: 'Show suggestions',
    collapseExamples: 'Hide suggestions',
    /**
     * The `collapsible` trigger row's own label — ONE word, the same on every surface
     * (2026-08-19, "Clean Reveal"). It replaced four per-caller sentences
     * (`starters.{habits,goals}.tapToAdd` "Tap one to start:" and
     * `starters.{plans,health}.tapToAdd` "Examples:"), which were instructions for content
     * that was not on screen while the drop-down was shut. A noun naming what is behind the
     * chevron is not an instruction, so it reads correctly in both states.
     */
    suggestionsLabel: 'Suggestions',
    habits: {
      suggestions: {
        water: 'Drink 4 glasses of water',
        stretch: 'Morning stretch',
        posture: 'Posture check',
        breakfast: 'Eat breakfast',
      },
    },
    plans: {
      text: 'Break it into smaller pieces.',
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
      // the shared explainer line's header. The weekly/monthly split is taught by the two
      // tabs' own labels; this only has to say what the list is for.
      text: 'Add things as you run out.',
      // The /shopping screen keeps the weekly-vs-monthly distinction: that screen IS the
      // place the two lists live side by side, so it's the one surface where the split is
      // the point rather than a detail.
      textWeekly: 'Weekly list for groceries.',
      textMonthly: 'Monthly list for what the house needs.',
    },
    health: {
      exampleTitle: 'Headache',
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
      action: "Set the day's energy",
    },
    goals: {
      text: 'What your to-dos and habits add up to.',
      suggestions: {
        rested: 'Be better rested',
        moving: 'Move every day',
        // The "less of" example. Deliberately phrased as the thing you're aiming at, not as
        // a failure to avoid — see lib/goalStarters.ts.
        cutBack: 'Less time on my phone',
        // Kept short on purpose: these draw as one-line rows, so a sentence-length starter
        // ellipsizes at the large-text sizes — "More time with loved ones" was still 5px over
        // at 327px. See components/GoalsEditor.tsx's example note. The "More …"/"Less …" pair
        // with cutBack is what makes a goal read as a direction rather than a rule.
        together: 'More time together',
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
    namePlaceholder: 'Elvanse',
    doseLabel: 'Dose',
    dosePlaceholder: '30 mg',
    traysLabel: 'When to take it',
    traysHint: 'Pick one or more — a tray is a window, not a deadline',
    asNeededSwitch: 'Take as needed instead',
    asNeededHint: 'No tray and no reminder, only a minimum gap',
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
    inactiveHint: 'Off: stays in your history, leaves the card',
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
    toggleHint: 'Leave notes on cards and headers for the developer',
    howToUse: 'Tap any card or screen title to write a note there.\n• A bubble marks a card that already has one — tap it to edit.\n• "Add general note" at the foot of the screen for anything else.\n• Buttons stop doing their normal thing while this is on.\n• In the header: bug turns it off, checkmark emails the notes, red circle deletes them.',
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
    toggleHint: "A workbench for the app's look",
    intro: 'Not a setting — a note about what you want',
    applyLabel: 'Use these everywhere',
    applyHint: 'Off: this screen only. On: the whole app',
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
    notePlaceholder: 'What looked wrong, and what you wanted instead',
    changeCount: (n: number) => (n === 1 ? '1 change' : `${n} changes`),
    modeNote: 'Light and dark keep separate colours',
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
    slotsNote: 'On real screens these can only hide a position',
    idNote: 'The short words below are the names used in the file you send',
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
    selectHint: 'Tap to change, hold and drag to move',
    /** The palette chip's spoken name. The chip SHOWS the kind; a screen reader needs the verb,
     *  and without it the chip, the card's part and the list row are three identical names. */
    addNamed: (name: string) => `Add ${name.toLowerCase()}`,
    cardEmpty: 'This card has nothing in it. Add a part below.',
    cardNoteLabel: 'What do you want from this card?',
    cardNotePlaceholder: 'In your own words.',
    addPart: 'Add something',
    partsTitle: 'What it is made of',
    partsHint: 'Hold and drag to reorder, tap to change',
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
    tokensHint: 'Change one here and it changes everywhere',
    // The playground (app/design-lab/index.tsx, 2026-08-07) — empty screens you build on.
    playground: {
      build: 'Build',
      use: 'Try it',
      addCard: 'Add a card',
      emptyScreen: 'Nothing here yet — add a card below',
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
        blank: 'Empty — put whatever you like on it',
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
    cardDesc: 'Type it below — it opens your mail app, addressed to the developer',
    placeholder: "What's on your mind?",
    sendButton: 'Send feedback',
    subject: 'UnFocus feedback',
    mailUnavailable: 'No mail app on this device.',
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
  discard: 'Forkast',
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
  tasksSharedSent: 'Sendt',
  tasksSharedReceived: 'Mottatt',
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
  taskMoveToWhenever: 'Flytt til Når som helst',
  taskMoveToToday: 'Flytt til i dag',
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
    noSteps: 'Legg til et steg for å ta det ett om gangen',
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
  hintSheetDone: 'Ferdig',
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
      hint: 'Vises foran nå-linjen — ingenting skrives tilbake',
    },
  },
  sendTo: {
    title: 'Send den til…',
    todo: 'Gjøremål',
    shopping: 'Handleliste',
    habits: 'Vaner',
    goals: 'Personlige mål',
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
  wheneverHint: 'Ingen fast tid – bare noe å gjøre den dagen',
  lightDarkModeLabel: 'Lys/Mørk modus',
  darkModeSystem: 'System',
  darkModeOn: 'På',
  darkModeOff: 'Av',
  durationLabel: 'Varighet (minutter)',
  durationPlaceholder: 'min',
  // Energy system (task-form + habit-form)
  energyConsumeLabel: 'Påvirker energi',
  energyGiveTakeLabel: 'Energi gir / tar',
  energyGiveTakeHint: 'Minus koster energi, pluss gir tilbake, 0 = ingen effekt',
  stepPlaceholder: 'Legg til et steg',
  deleteTask: 'Slett plan',
  // Task form — "neste gang"-notat (Decision 019, fritekst, kun visning)
  taskHintLabel: 'Neste gang…',
  taskHintPlaceholder: 'Legg laderen i den øverste skuffen',
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
  scanHintBanner: 'Hold kameraet mot kvitteringen — tydelig, godt belyst tekst funker best',
  // --- W-C Grocery additions (scan) ---
  // --- end W-C additions ---
  store: 'Butikk',
  otherStore: 'Annen butikk…',
  customStoreLabel: 'Butikknavn',
  customStorePlaceholder: 'Lokalt utsalg',
  selectStoreFirstTitle: 'Velg butikk',
  selectStoreFirstBody: 'Velg hvilken butikk kvitteringen er fra først.',
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
  manualEntryHint: 'Ett varenavn per linje',
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
    failed: 'Kunne ikke se etter oppdateringer. Sjekk tilkoblingen.',
    disabled: 'Debug-bygg — installer et release-bygg for å motta oppdateringer',
    updateAvailable: 'Oppdatering tilgjengelig — trykk for å installere og starte på nytt',
    experimental: 'Eksperimentell versjon — ting kan endre seg, flytte på seg eller ryke',
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
  persistentNotifHint: 'Ett varsel med resten av dagen, lesbart på låseskjermen',
  habitNotifications: 'Varslinger for vaner',
  medicineNotifications: 'Medisinvarsler',
  medicineNotificationsHint: 'Én påminnelse per runde, med en Tatt-knapp',
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
    reRunHint: 'Bevegelse, skriftstørrelse, utseende og startskjerm en gang til',
    motion: {
      title: 'Hvor mye bevegelse vil du ha?',
      sub: 'Animasjon kan binde ting sammen, eller komme i veien',
      osReduced: 'Telefonen ber om redusert bevegelse, så bevegelsen er allerede nede',
      full: { label: 'Full', desc: 'Myke overganger og bevegelig bakgrunn.' },
      reduced: { label: 'Redusert', desc: 'Overgangene blir, bakgrunnen står stille.' },
      none: { label: 'Ingen', desc: 'Ingen animasjon noe sted.' },
    },
    textSize: {
      title: 'Hvor stor skal teksten være?',
      sub: 'Skjermen endrer seg mens du trykker, så du ser størrelsen',
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
        body: 'Gjøremål, handling og vaner, alt på én skjerm.\n• Hold på et kort for å flytte det øverst.',
      },
      plans: {
        title: 'Gjøremål holder på det dagen trenger',
        body: 'Legg inn én ting du vil få gjort.\n• Lite slår perfekt — et gjøremål du blir ferdig med.',
      },
      shopping: {
        title: 'Handlelisten nullstiller seg selv',
        body: 'To lister, begge nullstiller seg selv.\n• Ukentlig, til dagligvarer.\n• Månedlig, til det huset trenger.',
      },
      habits: {
        title: 'Vaner, én dag om gangen',
        body: 'Velg én å begynne med.\n• Ingen rekke å miste — en rolig dag er bare en rolig dag.',
      },
      health: {
        title: 'Helse legger merke til mønstre',
        body: 'Loggfør et symptom eller hvordan du sov.\n• Medisiner ligger her også, i morgen-, midt på dagen-, kvelds- og nattrunder.',
      },
    },
    finale: {
      title: 'Det var omvisningen',
      body: 'Alt annet ligger bak disse fem fanene.\n• Hver skjerm har en ⓘ-knapp med egne tips og innstillinger.',
      experimental: 'UnFocus er under arbeid.\n• Ting kan endre seg, flytte på seg eller komme halvferdig.\n• Alt blir på telefonen din.\n• Tilbakemeldinger former det som kommer.',
      done: 'Begynn å bruke appen',
    },
  },
  basics: {
    title: 'Litt grunnleggende',
    sub: 'Trykk for å se endringen — hver rad har allerede en standard som fungerer',
    /* Se den engelske tvillingen: dette er det en helt ny bruker møter først. */
    welcomeTitle: 'Dagen din, på ett sted',
    welcomeSub: 'Gjøremål, handling, vaner og helse, samlet. Ingenting her fører regnskap.',
    appearance: 'Utseende',
    textSize: 'Tekststørrelse',
    motion: 'Bevegelse',
    language: {
      label: 'Språk',
      en: { label: 'English', desc: 'Appen snakker engelsk.' },
      no: { label: 'Norsk', desc: 'Appen snakker norsk.' },
      is: { label: 'Íslenska', desc: 'Appen snakker islandsk.' },
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
  icelandic: 'Íslenska',
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
  weeklyTabLabel: 'Handlelister',
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
  doneShoppingReceiptBody: 'Skann eller last opp for å loggføre kjøpet, eller hopp over.',
  scanReceiptBtn: 'Skann kvittering',
  uploadPhotoBtn: 'Last opp bilde',
  skipBtn: 'Hopp over',
  doneShoppingSuccessText: 'Bra jobbet!',
  weeklyEmptyTitle: 'Ingenting på listen ennå',
  weeklyEmptySubtitle: 'Trykk for å låse opp og legge til varer.',
  unsavedShoppingBanner: (n: number) => `Ulagret: ${n} liste${n === 1 ? '' : 'r'} fortsatt ulåst`,
  // Tomme beholdere i handlelisten
  newWeeklyListTitle: 'Lag en ny liste',
  startEmptyList: 'Start tom',
  deleteList: 'Slett liste',
  deleteListConfirmTitle: 'Slette denne listen?',
  deleteListConfirmBody: 'Listen og alle varene forsvinner for godt.',
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
  monthlyResetReviewIntro: 'Se gjennom listene og inventaret, eller hopp over.',
  monthlyResetReviewListsSection: 'Listene dine',
  monthlyResetReviewKeepListLabel: 'Behold denne listen',
  monthlyResetReviewListItemCount: (n: number) => (n === 1 ? '1 vare' : `${n} varer`),
  monthlyResetReviewEmptyLists: 'Ingen lister ennå.',
  monthlyResetReviewInventorySection: 'Hvor mye har du igjen?',
  monthlyResetReviewInventoryHint: 'Juster antallet for det du fortsatt har',
  monthlyResetReviewEmptyInventory: 'Inventaret ditt er tomt.',
  monthlyResetReviewSkipBtn: 'Hopp over',
  monthlyResetReviewConfirmBtn: 'Ser bra ut, nullstill',
  listSettingsTitle: 'Listeinnstillinger',
  listRecurringToggleLabel: 'Gjenta denne listen',
  listActiveWeeksLabel: 'Aktive uker i måneden',
  weekNumberChip: (n: number) => `Uke ${n}`,
  monthlyListSection: 'Månedsliste',
  newMonthlyListBtn: 'Ny liste',
  defaultMonthlyListName: 'Månedsliste',
  newMonthlyListNamePlaceholder: 'Listenavn',
  createMonthlyListBtn: 'Opprett',
  monthlyListsEmpty: 'Ingen månedslister ennå — opprett en for å komme i gang.',
  deleteMonthlyListAction: 'Slett denne listen',
  weekEmptyTitle: 'Ingen lister denne uken ennå',
  weekEmptyBody: 'Start en her når du trenger det.',
  catalogueSearchPlaceholder: 'Søk i katalogen…',
  monthlyListTotal: (kr: string) => `Totalt: ${kr}`,
  monthlyListEmpty: 'Ingenting lagt til ennå — velg fra katalogen under.',
  monthlyListEmptyLocked: 'Ingenting lagt til ennå — trykk for å låse opp og legge til varer.',
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
  scanReceiptForListAction: 'Skann en kvittering',
  scanForCatalogueLabel: 'Skann priser',
  scanTargetWeekly: 'Sammenlignes med denne handlelisten',
  scanTargetMonthly: 'Sammenlignes med denne månedslisten',
  scanTargetCatalogue: 'Legger til og oppdaterer katalogpriser',
  shoppingCadenceLink: 'Nullstillingsdager',
  restoreHintsLabel: 'Vis tipsene igjen',
  restoreHintsDone: 'Tipsene er tilbake',
  sortByType: 'Etter type',
  sortByName: 'Etter navn',
  sortLabel: 'Sorter',
  categoryLabels: {
    produce: 'Frukt & grønt',
    bakery: 'Bakevarer',
    dairy: 'Meieri',
    meat: 'Kjøtt',
    fish: 'Fisk',
    frozen: 'Frossenmat',
    pantry: 'Tørrvarer',
    canned: 'Hermetikk',
    snacks: 'Snacks',
    drinks: 'Drikke',
    cleaning: 'Rengjøring',
    personal: 'Personlig pleie',
    other: 'Annet',
  },
  // --- Session A2·2: WeekListCard chrome + sticky-header overflow (Decision 011) ---
  toBuySection: (n: number) => `Å kjøpe (${n})`,
  inCartSection: (n: number) => `I kurven (${n})`,
  purchasedSection: (n: number) => `Kjøpt (${n})`,
  fromMonthlySection: 'Fra månedsliste',
  // --- Store mode (2026-08-11) ---
  storeModeBtn: 'Butikkmodus',
  storeModeTitle: 'I butikken',
  storeModeAwakeNote: 'Skjermen står på så lenge denne er åpen.',
  storeModeExitBtn: 'Avslutt butikkmodus',
  storeModeEmpty: 'Ingenting på denne lista ennå.',
  moveToCartBtn: 'Legg i handlekurv',
  moveToListBtn: 'Tilbake i lista',
  markBoughtBtn: 'Kjøpt',
  undoBoughtBtn: 'Tilbake i kurven',
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
  resetMonthlyListConfirmBody: 'Fjerner midlertidige varer på denne listen og starter en ny periode.',
  resetAllMonthlyListsAction: 'Nullstill alle månedslister nå',
  resetAllMonthlyListsConfirmTitle: 'Nullstille alle månedslister?',
  resetAllMonthlyListsConfirmBody: 'Fjerner midlertidige varer på alle månedslister og starter en ny periode.',
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
  catalogueAddSheetTitle: 'Ny vare',
  catalogueAddSheetName: 'Navn',
  catalogueAddSheetPrice: 'Pris',
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
  invalidMonthlyDateMsg: 'Trenger en dag mellom 1 og 31 — tilbakestilt.',
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
    restDayHint: 'Hviledag — energien for denne vanen står stille',
    weeklyProgress: (count: number, goal: number) => `${count}/${goal} denne uken`,
  },
  goals: {
    pickerLabel: 'Mål',
    none: 'Ikke koblet til et mål',
    pick: '+ Koble til et mål',
    remove: 'Fjern kobling',
    emptyList: 'Ingen mål ennå — trykk her for å legge til det første.',
    newPlaceholder: 'Navn på nytt mål',
    add: 'Legg til mål',
    deleteLabel: 'Slett mål',
    deleteConfirmTitle: (name: string) => `Slette «${name}»?`,
    deleteConfirmBody: 'Koblede gjøremål og vaner blir frakoblet. Dette kan ikke angres.',
    strengthLabel: 'Driv — vokser når du jobber med det, avtar rolig ellers',
    editLinkPersonal: 'Personlige mål',
    editLinkPractical: 'Praktiske mål',
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
      local: 'Lagres kun på denne enheten — ingenting sendes noe sted',
      free: 'UnFocus er gratis — og forblir det.',
      /* Se den engelske tvillingen: dette er siste skjerm i oppstarten nå. */
      cta: 'Start',
      restoreLink: 'Gjenoppretter du fra en sikkerhetskopi?',
    },
    restore: {
      headline: 'Har du brukt UnFocus før?',
      body: 'Hent alt tilbake fra en sikkerhetskopi, eller start på nytt.',
      restoreCta: 'Ja — gjenopprett dataene mine',
      newCta: 'Nei, jeg er ny her',
    },
  },
  settings: {
    // Energisystem (Generelt-fanen) — valgfritt energibudsjett per oppgave.
    energy: {
      label: 'Energisystem',
      hint: 'Et dags- og ukebudsjett som gjøremål og vaner tærer på',
      dailyCapacity: 'Energi per dag',
      weeklyCapacity: 'Energi per uke',
      modeLabel: 'Budsjettype',
      modeDaily: 'Daglig',
      modeWeekly: 'Ukentlig',
      modeCustom: 'Egendefinert',
      customHint: 'Energi per ukedag',
    },
    accessibility: {
      title: 'Tilgjengelighet',
      reducedMotion: 'Redusert bevegelse',
      particles: 'Partikkeleffekter',
      particlesHint: 'Animerte partikler på startskjermens bakgrunn',
      glassSurfaces: 'Glassflater',
      glassSurfacesHint: 'Frostet glass på kort og knapper — av for heldekkende flater',
      fontSize: 'Skriftstørrelse',
      fontSizeSmall: 'Liten',
      fontSizeDefault: 'Standard',
      fontSizeLarge: 'Stor',
      leftHanded: 'Venstrehendt modus',
      leftHandedHint: 'Menyknappen til venstre',
      timelineHorizontal: 'Horisontal gjøremålstidslinje',
      timelineHorizontalHint: 'Dagens gjøremål fra venstre til høyre i stedet for ovenfra og ned',
    },
    privacy: {
      headline: 'Dataene dine er hos deg',
      local: 'Lagres kun på denne enheten — ingenting sendes noe sted',
      free: 'UnFocus er gratis — og forblir det.',
    },
    // AP-05 — varslingsfri (stille) periode
    quietHours: {
      label: 'Stille periode',
      hint: 'Oppgavepåminnelser venter til den er over; vane-påminnelser droppes',
    },
    // AP-06B — månedlig handlebudsjett, sammenlignet med kvitteringer i app/budget.tsx
    monthlyBudget: {
      label: 'Månedlig budsjett',
      hint: 'Valgfritt — sammenlignes med forbruket på Budsjett-skjermen',
      placeholder: '3000',
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
        hint: 'Store rader etter avdeling, bare navn',
      },
      timeline: {
        label: 'På en tidslinje',
        hint: 'Dagen etter klokka, med stille perioder krympet',
      },
      nowNext: {
        label: 'Nå og neste',
        hint: 'Det du holder på med og det som kommer etter — resten ligger skjult',
      },
      focusFirst: {
        label: 'Én ting om gangen',
        hint: 'Én oppgave forrest, en kort liste under',
      },
      byPerson: {
        label: 'Per person',
        hint: 'I dag delt etter person, med hvem sin tur det er',
      },
    },
    tabs: {
      general: 'Generelt',
      personal: 'Personlig',
      advanced: 'Avansert',
    },
    features: {
      goals: {
        label: 'Mål',
        hint: 'Gjøremål og vaner knyttet til noe større',
      },
      sharing: {
        label: 'Deling og QR',
        hint: 'Send og ta imot gjøremål og varer',
      },
      automations: {
        label: 'Automatisering',
        hint: 'Regler som kjører av seg selv',
      },
      medicine: {
        label: 'Medisin',
        hint: 'Et dosekort på Helse, én påminnelse per runde',
      },
      dayLog: {
        label: 'Dagen slik den skjedde',
        hint: 'Gjort over nå-linjen, resten under',
      },
      energy: {
        label: 'Energi',
        hint: 'Energiverdi per gjøremål og vane, summert per dag og uke',
        modes: {
          label: 'Hvordan det kjennes å bli ferdig',
          energy: {
            label: 'Energimodus',
            hint: 'En kostnad på hver ting, og en måler for det som er igjen',
          },
          rewards: {
            label: 'Belønningsmodus',
            hint: 'Ingen måler, ingen kostnader — bare avkryssingen som fylles',
          },
        },
      },
      growth: {
        label: 'Stille vekst',
        hint: 'Bakgrunnen vokser og blir varmere etter hvert som dagene legger seg sammen',
      },
    },
    autoBackup: {
      label: 'Automatisk sikkerhetskopiering',
      hint: 'Én fil, holdt oppdatert der du velger — ingenting lastes opp',
      pathLabel: 'Lagres til:',
      locationUnknown: 'ikke valgt ennå',
      lastBackedUp: (when: string) => `Sist sikkerhetskopiert: ${when}`,
      never: 'Ikke sikkerhetskopiert ennå',
      backUpNow: 'Sikkerhetskopiér nå',
      backedUpNow: 'Sikkerhetskopi oppdatert.',
      locationCanceled: 'Av til du velger et sted',
      shareNote: 'En delt kopi utelater navnet ditt',
    },
    desc: {
      name: 'Bare en hilsen — forlater aldri telefonen',
      weeklyReminders: 'En påminnelse på handledagen din',
      holidays: 'Helligdager i kalenderen',
      shoppingDefault: 'Hvilken liste som åpnes først',
      weeklyResetDay: 'Når ukeslisten nullstiller seg',
      monthlyResetDate: 'En kort måned nullstilles på siste dag',
      hints: 'Korte forklaringer på hvert skjermbilde',
      dataNote: 'Dette kan ikke angres',
    },
  },
  // --- end W-E Config additions ---
  // Local backup & restore (Decision 036) — device-only data portability
  backup: {
    title: 'Sikkerhetskopi',
    desc: 'Alle dataene dine i én fil du beholder — ingenting lastes opp',
    exportButton: 'Eksporter sikkerhetskopi',
    importButton: 'Gjenopprett fra sikkerhetskopi',
    exportError: 'Klarte ikke å lage sikkerhetskopifilen.',
    sharingUnavailable: 'Deling er ikke tilgjengelig på denne enheten.',
    invalidFile: 'Dette ser ikke ut som en UnFocus-sikkerhetskopi.',
    tooNew: 'Laget av en nyere versjon av UnFocus. Oppdater appen først.',
    importConfirmTitle: 'Gjenopprette denne sikkerhetskopien?',
    importConfirmBody: (items: number) =>
      `Dette erstatter ALLE dine nåværende data med sikkerhetskopien (${items} elementer). Dette kan ikke angres.`,
    importConfirmBtn: 'Gjenopprett',
    restoreError: 'Klarte ikke å gjenopprette sikkerhetskopien — dataene dine er uendret.',
    restoreDone: 'Gjenoppretting fullført. Appen starter på nytt nå.',
    saveToDevice: 'Lagre på enheten',
    shareCopy: 'Del en kopi',
    savedToDevice: (location: string) => `Sikkerhetskopi lagret til ${location}.`,
    saveUnavailable: 'Lagring til enheten er ikke tilgjengelig her.',
  },
  // Lokal konto (Decision 039) — kun på enheten, brukereid profil. Ingen server,
  // ingen pålogging, ingen sky; kontoen sikkerhetskopieres via backup-filen over.
  account: {
    title: 'Sikkerhetskopi',
    restoreButton: 'Gjenopprett fra sikkerhetskopi',
    deviceOnlyNote: 'Ingen innlogging, ingen passord, ingen server — aldri',
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
    saveUnavailable: 'Lagring til enheten er ikke tilgjengelig her.',
    sharingUnavailable: 'Deling er ikke tilgjengelig på denne enheten.',
    exportError: 'Klarte ikke å lage guidefilen.',
    invalidFile: 'Ikke en utfylt oppsettsfil. Last opp filen AI-en ga deg, ikke selve guiden.',
    staleWarning: 'Laget fra en eldre guide, så nyere valg kan mangle. Importer likevel, eller hent en fersk guide først.',
    previewTitle: 'Dette vil bli satt opp',
    confirmImport: 'Sett det opp',
    nothingToImport: 'Ingenting i denne filen appen kjente igjen.',
    importDone: (n: number) => (n === 1 ? '1 endring utført.' : `${n} endringer utført.`),
    deviceOnlyNote: 'Ingenting lastes opp — en import skriver bare til denne enheten',
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
  habitRecurrenceWeeklyFlexibleHint: 'Hvilken som helst dag teller — daglig til ukas antall er nådd',
  habitEveryNDaysLabel: (n: number) => `Hver ${n}. dag`,
  habitEveryNWeeksLabel: (n: number) => `Hver ${n}. uke`,
  habitRepeatDaysLabel: 'Hvilke dager',
  habitTitleLabel: 'Navn',
  habitTitlePlaceholder: 'Drikk vann',
  habitIconLabel: 'Ikon',
  habitDeleteLabel: 'Slett vane',
  habitNotification: 'Daglig påminnelse',
  habitHowOften: 'Hvor ofte',
  habitReminderLabel: 'Påminnelse',
  habitReminderTimeLabel: 'Tidspunkt',
  habitReminderOffHint: 'Ingen påminnelse — den dukker fortsatt opp på dagene sine',
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
  habitForLabel: 'For',
  habitForMe: 'Meg',
  peopleMode: {
    label: 'Personer / familie',
    hint: 'Tildel gjøremål og vaner til folk i husstanden',
    profilesHint: 'Trykk på en farge for å endre den.',
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
      'Deles med alle du er koblet til; endrer du navnet, følger det med på alle oppgavene',
    empty: 'Ingen merkelapper ennå. Legg til en fra en oppgave.',
    removeTitle: (name: string) => `Fjerne ${name}?`,
    removeBody: 'Oppgavene beholder alt annet.',
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
  shareInstructions: 'De åpner UnFocus → Skann → «Skann QR-kode»',
  // Forklaring på hva deling gjør her (HintCard på hver deleflate).
  // Merk: dette er en engangskopi i dag, uansett metode — ingen sanntidssynk telefon-til-telefon ennå.
  shareExplainShopping: 'En QR-kode de skanner inn i sin egen handleliste, eller ren tekst til hvem som helst',
  shareExplainTasks: 'En QR-kode de skanner inn i sin egen UnFocus, eller ren tekst til hvem som helst',
  shareExplainLaterBuild: 'En engangskopi foreløpig — sanntidssynk kommer senere',
  // Barnemodus (Decision 038c) — låst variant styrt av et foreldrepassord.
  scanQrCode: 'Skann QR-kode',
  qrScanMode: 'Skann delt liste',
  qrScanInstructions: 'Pek mot en QR-kode fra en annen UnFocus-bruker',
  qrScanSuccess: 'Liste mottatt!',
  qrScanSuccessBody: (n: number, kind: 'tasks' | 'shopping') =>
    `${n} ${kind === 'tasks' ? `plan${n !== 1 ? 'er' : ''}` : `vare${n !== 1 ? 'r' : ''}`} lagt til i delt liste.`,
  qrInvalid: 'Dette ser ikke ut som en UnFocus QR-kode.',
  sharedDone: 'Utført',
  sharedFromLabel: (name: string) => `Fra ${name}`,
  sharedBySelf: 'Delt av deg',
  noSharedItems: 'Ingenting delt ennå — del en liste eller skann en kode',
  selectAll: 'Velg alle',
  deselectAll: 'Fjern alle',
  sharedTasksTab: 'Gjøremål',
  sharedShoppingTab: 'Handlelist',
  peers: {
    title: 'Sammenkoblede enheter',
    settingsCardDesc: 'Gjøremål og handleliste, i takt med en sammenkoblet telefon på samme Wi-Fi',
    syncToggleLabel: 'Synkroniser over Wi-Fi',
    syncUnavailable: 'Ikke tilgjengelig i denne appversjonen ennå',
    manageLink: 'Sammenkoblede enheter →',
    noPeers: 'Ingen sammenkoblede enheter ennå.',
    pairedAt: (date: string) => `Sammenkoblet ${date}`,
    addDevice: 'Koble sammen en enhet',
    removeDevice: 'Fjern',
    removeConfirmTitle: 'Fjerne denne enheten?',
    removeConfirmBody: 'Synkroniseringen stopper. Du kan koble den sammen igjen senere.',
    chooseRoleTitle: 'Sammenkobling av enhet',
    chooseRoleExplain: 'Samme rom, begge telefonene. Én trykker «Vis min kode», den andre «Skann en kode».',
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
    healthTitle: 'Helse',
    healthOngoing: (n: number) => (n === 1 ? '1 pågående' : `${n} pågående`),
    medicineDue: (n: number) => (n === 1 ? '1 medisin gjenstår' : `${n} medisiner gjenstår`),
    trayProgress: (taken: number, total: number) => `${taken} av ${total}`,
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
    quantityPlaceholder: '2, eller «en bunt»',
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
  healthIssues: {
    title: 'Helseplager',
    openLabel: 'Åpne helseplager',
    subtitle: 'Tingene du holder et øye med.',
    emptyList: 'Ingenting her ennå — det du logger dukker opp her',
    newPlaceholder: 'Noe å holde et øye med',
    entryCount: (n: number) => `${n} ${n === 1 ? 'oppføring' : 'oppføringer'}`,
    lastLogged: (days: number) =>
      days === 0 ? 'Logget i dag' : days === 1 ? 'Sist logget i går' : `Sist logget for ${days} dager siden`,
    untrackLabel: 'Slutt å følge',
    untrackConfirmTitle: (name: string) => `Slutte å følge «${name}»?`,
    untrackConfirmBody: 'Forsvinner fra denne listen. Alt du har logget blir liggende i helse-loggen.',
    close: 'Ferdig',
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
    noBudgetSet: 'Sett et månedsbudsjett i Innstillinger for å sammenligne',
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
    overPaceHint: 'Litt over dagstakten din',
    onPaceHint: 'Fint innenfor dagstakten din.',
  },
  // Notater — frittstående notater med hurtigknapper for handleliste/planer (app/notes.tsx)
  notes: {
    title: 'Notater',
    navLabel: 'Notater',
    emptyState: 'Skriv på første linje, eller trykk på mikrofonen',
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
    micPermissionBody: 'Et talenotat trenger mikrofontilgang.',
    micErrorBody: 'Fikk ikke med det — prøv igjen.',
  },
  hints: {
    home: { text: 'Hold et kort for å flytte.' },
    taskForm: { text: 'Legg til en oppgave med tittel, dato og valgfrie detaljer.' },
    habitForm: { text: 'Hvor ofte den gjentas og hvor mange ganger om dagen den teller.' },
    medicineForm: { text: 'Velg runder, eller sett den til ved behov.' },
    shopping: { text: 'Legg til når du går tom — nullstilles ukentlig.' },
    meals: { text: 'Bla gjennom retter og legg ingrediensene til handlelisten.' },
    health: { text: 'Logg og følg opp helseplager over tid.' },
    scan: { text: 'Bilde av kvittering for å legge til varer, eller skann en delt QR-kode.' },
    settings: { text: 'Endringer trer i kraft umiddelbart.' },
    shared: { text: 'Delt med deg — merk din del som utført.' },
    habits: { text: 'Trykk for å telle, tannhjul for å sette opp.' },
    plans: { text: 'Alt som skal gjøres, etter dag og uke.' },
    automations: { text: 'Enkle regler: når X skjer, gjør Y automatisk.' },
    notes: { text: 'Skriv det ned, og send det videre.' },
    goals: { text: 'Det større gjøremålene og vanene dine er til for.' },
  },
  /* Se den engelske tvillingen. Selve linjene ligger i lib/narratorQuotes.ts. */
  narrator: {
    nextQuote: 'Vis en annen linje',
  },
  starters: {
    addExample: 'Legg til',
    dismiss: 'Lukk',
    expandExamples: 'Vis forslag',
    collapseExamples: 'Skjul forslag',
    /* Se den engelske tvillingen: ett ord, likt på hver flate (2026-08-19). */
    suggestionsLabel: 'Forslag',
    habits: {
      suggestions: {
        water: 'Drikk 4 glass vann',
        stretch: 'Morgenstrekk',
        posture: 'Sjekk holdningen',
        breakfast: 'Spis frokost',
      },
    },
    plans: {
      text: 'Del opp i mindre biter.',
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
      exampleTitle: 'Hodepine',
    },
    /* Se den engelske tvillingen: energistripens opplæringstilstand (2026-08-03). */
    energy: {
      action: 'Sett dagens energi',
    },
    goals: {
      text: 'Det gjøremålene og vanene dine går til sammen om.',
      suggestions: {
        rested: 'Bli mer uthvilt',
        // Norwegian is the long side of every pair here, and these draw as one-line rows —
        // see the note on the English twins.
        moving: 'Bevege meg hver dag',
        cutBack: 'Mindre tid på telefonen',
        together: 'Mer tid sammen',
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
    namePlaceholder: 'Elvanse',
    doseLabel: 'Dose',
    dosePlaceholder: '30 mg',
    traysLabel: 'Når skal den tas',
    traysHint: 'Velg én eller flere — en runde er et tidsrom, ikke en frist',
    asNeededSwitch: 'Ta ved behov i stedet',
    asNeededHint: 'Ingen runde og ingen påminnelse, bare en minste avstand',
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
    inactiveHint: 'Av: blir i historikken, forsvinner fra kortet',
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
    toggleHint: 'Legg igjen notater på kort og topptekster til utvikleren',
    howToUse: 'Trykk på et kort eller en skjermtittel for å skrive et notat der.\n• En boble markerer et kort som allerede har ett — trykk for å endre.\n• «Legg til generelt notat» nederst på skjermen for alt annet.\n• Knapper gjør ikke sin vanlige handling mens dette er på.\n• I toppmenyen: bug slår av, haken sender notatene på e-post, rød sirkel sletter dem.',
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
    toggleHint: 'En arbeidsbenk for utseendet',
    intro: 'Ikke en innstilling — en beskjed om hva du vil ha',
    applyLabel: 'Bruk dette overalt',
    applyHint: 'Av: bare denne skjermen. På: hele appen',
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
    notePlaceholder: 'Hva så feil ut, og hva ville du ha i stedet',
    changeCount: (n: number) => (n === 1 ? '1 endring' : `${n} endringer`),
    modeNote: 'Lyst og mørkt har hver sine farger',
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
    slotsNote: 'På ekte skjermer kan disse bare skjule en plass',
    idNote: 'De korte ordene under er navnene som brukes i filen du sender',
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
    selectHint: 'Trykk for å endre, hold og dra for å flytte',
    addNamed: (name: string) => `Legg til ${name.toLowerCase()}`,
    cardEmpty: 'Dette kortet er tomt. Legg til en del under.',
    cardNoteLabel: 'Hva vil du ha ut av dette kortet?',
    cardNotePlaceholder: 'Med dine egne ord.',
    addPart: 'Legg til noe',
    partsTitle: 'Hva det består av',
    partsHint: 'Hold og dra for å endre rekkefølge, trykk for å endre',
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
    tokensHint: 'Endrer du én her, endres den overalt',
    playground: {
      build: 'Bygg',
      use: 'Pr\u00f8v den',
      addCard: 'Legg til et kort',
      emptyScreen: 'Ingenting her ennå — legg til et kort under',
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
        blank: 'Tomt — sett hva du vil på det',
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
    cardDesc: 'Skriv det under — det åpner e-postappen din, adressert til utvikleren',
    placeholder: 'Hva tenker du på?',
    sendButton: 'Send tilbakemelding',
    subject: 'UnFocus tilbakemelding',
    mailUnavailable: 'Ingen e-postapp på denne enheten.',
  },
};


/**
 * Icelandic count agreement. A number ending in 1 takes the SINGULAR — except 11, which
 * does not ("21 vara", but "11 vörur"). English and Norwegian get this right with a bare
 * `n === 1`, so neither dictionary needs a helper; Icelandic does, and every counted noun
 * in `is` below routes through here.
 *
 * Several entries switch a whole PHRASE rather than a noun ("vara fór" / "vörur fóru"),
 * because the verb or adjective agrees with the count too. That is deliberate — pass the
 * two forms you actually need, not a stem plus a suffix.
 */
const isCount = (n: number, one: string, many: string): string =>
  Math.abs(n) % 10 === 1 && Math.abs(n) % 100 !== 11 ? one : many;

const is: typeof en = {
  greeting: { night: 'Góða nótt', morning: 'Góðan morgun', day: 'Góðan daginn', evening: 'Gott kvöld' },
  days: ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'],
  months: ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'],
  monthsShort: ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'],
  back: '← Heim',
  cancel: 'Hætta við',
  yes: 'Já',
  no: 'Nei',
  save: 'Vista',
  discard: 'Henda',
  undoBtn: 'Afturkalla',
  next: 'Áfram →',
  previous: '← Til baka',
  done: 'Byrjum! 🌿',
  ok: 'Í lagi',
  // Short enough to read as a tag rather than a sentence — "valfrjálst" in full is far too
  // long for the slot, so it is abbreviated the way Icelandic abbreviates it in print.
  optionalTag: 'Valfr.',
  webPreview: { notAvailable: 'Ekki í boði í vafraútgáfunni.' },
  addNew: '+ Nýtt',
  backlog: 'Ekki byrjað',
  notesCollapse: 'Sýna minna',
  timelineEmptyAdd: 'Bæta við plani',
  timelineNow: 'Núna',
  dayViewGapUntil: (time: string) => `Ekkert fyrr en ${time}`,
  dayViewDoneZone: (n: number) => `Búið í dag (${n})`,
  dayViewAllDone: 'Allt búið fyrir daginn',
  dayViewFollowerBadge: 'Svo',
  dayViewAnytimeBadge: 'Hvenær sem er',
  dayViewGapLength: (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m} mín`;
    return m === 0 ? `${h} klst` : `${h} klst ${m} mín`;
  },
  dayViewDeletedZone: (n: number) => `Nýlega eytt (${n})`,
  dayViewRestore: 'Endurheimta',
  dayViewDeleteTask: 'Eyða',
  // Verkefnalistaskjár (app/(tabs)/plans.tsx + components/TaskCard.tsx)
  tasksTitle: 'Verkefnalisti',
  tasksTabAll: 'Allt',
  tasksTabToday: 'Í dag',
  tasksTabWeek: 'Þessi vika',
  tasksSectionShared: 'Deilt',
  tasksSectionWhenever: 'Hvenær sem er',
  tasksSectionRecurring: 'Endurtekið',
  tasksSectionSharedEmpty: 'Ekkert deilt enn',
  tasksSharedSent: 'Sent',
  tasksSharedReceived: 'Móttekið',
  tasksDoneLabel: 'Búið',
  taskSave: 'Vista',
  taskDiscard: 'Henda',
  taskRecurringToggle: 'Endurtaka',
  taskStartSpecificDate: 'Tími',
  taskNameLabel: 'Heiti',
  taskWhenLabel: 'Hvenær',
  taskWhenWhenever: 'Hvenær sem er',
  taskWhenOnDay: 'Á völdum degi',
  taskWhenPickDay: 'Velja dag',
  taskMoveToWhenever: 'Færa í Hvenær sem er',
  taskMoveToToday: 'Færa á í dag',
  taskHowOftenLabel: 'Hversu oft',
  taskTimeOfDayLabel: 'Klukkan',
  taskStartFromLabel: 'Byrjar',
  taskStartFromNone: 'Engin byrjunardagsetning',
  taskStartLabel: 'Byrjun',
  taskFinishLabel: 'Lok',
  taskRecurDay: 'Dagur',
  taskRecurWeek: 'Vika',
  taskRecurMonth: 'Mánuður',
  taskRecurNever: 'Aldrei',
  taskWeekInterval1: 'Vikulega',
  taskWeekInterval2: 'Aðra hverja viku',
  taskWeekInterval3: '3. hverja',
  taskMonthlyByDay: 'Dagur mánaðar',
  taskMonthlyByWeekday: 'Vikudagur',
  taskMonthDayLabel: 'Dagur',
  taskOrdFirst: '1.',
  taskOrdSecond: '2.',
  taskOrdThird: '3.',
  taskOrdFourth: '4.',
  taskOrdLast: 'Síðasti',
  taskSharedOut: 'Deilt út',
  cardTypes: {
    label: 'Kortstíll',
    standard: 'Fullt',
    simple: 'Einfalt',
    /* One quarter of a four-segment control — 54px at 360, 46px at 327. "Minnispunktur"
       overran by 44px and the shorter "Punktur" still overran by 8px at 327, so this names
       what the card IS (free text, nothing to tick) rather than shortening the noun further:
       "nóta" was rejected because in Icelandic it reads first as a receipt, in an app that
       has receipts. steppedDesc/noteDesc carry the meaning either way. */
    note: 'Texti',
    stepped: 'Skref',
    standardDesc: 'Allt sem þetta hefur — tími, orka, merki.',
    simpleDesc: 'Bara heitið og hak. Ekkert annað sést.',
    noteDesc: 'Eitthvað til að hafa á listanum. Ekkert til að klára.',
    steppedDesc: 'Sýnir eitt skref í einu.',
    progress: (done: number, total: number) => `Skref ${done} af ${total}`,
    allDone: 'Öll skref eru búin',
    back: 'Eitt skref til baka',
    noSteps: 'Bættu skrefi við til að taka það eitt í einu',
  },
  shoppingPreview: 'Kaupa fljótlega',
  seeAll: 'Sjá allt →',
  andMoreItems: (n: number) => `og ${n} í viðbót`,
  emptyMonthlyList: 'Ekkert hér enn — bættu við fyrstu föstu vörunni.',
  smallThingsCount: (n: number) => `Þú hefur klárað ${n} ${isCount(n, 'hlut', 'hluti')} — smáatriðin telja!`,
  focusFirst: {
    nextUp: 'Núna',
    then: 'Svo',
    /* A tally, not a sentence: "búin/búið" would have to agree with the count. */
    doneToday: (n: number) => `Búið í dag: ${n} — smáatriðin telja`,
    andMore: (n: number) => `og ${n} í viðbót í dag`,
    allClear: 'Ekkert eftir í dag. Það telur.',
    markDone: 'Búið',
  },
  // Orkumælir á heimaskjá (components/EnergyMeter.tsx)
  energyMeter: {
    title: 'Orka',
    /* Sjá enska tvíburann: þetta nefnir mælinn, ekki bara tímabilið (2026-08-03). */
    today: 'Orka í dag',
    thisWeek: 'Orka þessa viku',
    remaining: (n: number) => `${n} eftir`,
    usedOf: (used: number, cap: number) => `${used} / ${cap} notuð`,
    editTitle: 'Stilla orku',
    todayCapacity: 'Orka í dag',
    weekCapacity: 'Orka þessa viku',
    /* Sjá ensku tvíburana: ein lína á hvern teljara, sem segir hverju hann breytir. */
    todayCapacityHint: 'Hversu mikið dagurinn í dag rúmar. Aðrir dagar halda sinni eigin tölu.',
    weekCapacityHint: 'Hversu mikið öll vikan rúmar.',
    done: 'Búið',
    boostToday: 'Aukalega í dag',
    boostHint: 'Sumir dagar rúma meira en venjulega. Þetta bætist aðeins við í dag, og á morgun byrjar allt á venjulegu aftur.',
    /* "bara í dag" er allt atriðið — talan er fengin að láni fyrir einn dag. */
    boostChip: (n: number) => `+${n} bara í dag`,
    surplusLabel: (n: number) => `${n} umfram orku dagsins`,
  },
  energyPause: {
    // "Mínir dagar eru yfirleitt þannig líka" keeps the narrator beside the user rather than
    // above them — the same move as the English and Norwegian lines, not a literal rendering.
    sheetLine: 'Það er meira en einn dagur rúmar. Mínir dagar eru yfirleitt þannig líka.',
    decide: 'Ég vel',
    imGood: 'Þetta er í lagi',
    afterDecide: 'Hitt bíður. Þetta er málið.',
    // "keyrir maður bara á því" is the everyday Icelandic for pressing on without a plan; it
    // carries the shrug the English "you just go" has, which a literal translation loses.
    afterGood: 'Allt í lagi. Suma daga keyrir maður bara á því.',
    overspendLabel: 'Umfram orku dagsins — val',
    pinnedLabel: 'Fest — ýttu til að losa',
  },
  a11yAdd: 'Bæta við',
  a11yDiscardRow: 'Henda nýrri línu',
  showHint: 'Svona virkar þetta',
  hideHint: 'Fela leiðbeiningar',
  hintSheetDone: 'Búið',
  pad: {
    summary: (left: number, total: number) => `${left}/${total} eftir`,
    more: (n: number) => `${n} í viðbót`,
    all: 'Sýna allt',
    less: 'Minna',
    type: {
      note: 'Skrifa minnispunkt',
      task: 'Skrifa verkefni',
      habit: 'Skrifa venju',
      item: 'Skrifa vöru',
    },
    moreOptions: 'Fleiri valkostir',
    recurrencePicker: 'Hversu oft?',
    captureTarget: {
      label: 'Bæta við sem',
      task: 'Verkefni',
      moment: 'Augnablik',
    },
  },
  padRow: { actionLabel: 'Meira fyrir þessa línu' },
  dayLog: {
    title: 'Í dag',
    // The one first-person line in the app — see VOICE.md and the English side's note.
    empty:
      'Ég man stóru hlutina. Það er allt hitt sem hverfur — sérstaklega það sem gerðist í miðju öngþveitinu.',
    capturePrompt: 'Hvað gerðist núna?',
    now: 'núna',
    nothingAhead: 'Ekkert fast eftir í dag.',
    earlierDays: 'Fyrri dagar',
    deleteMoment: 'Eyða þessum minnispunkti',
    kinds: {
      medicine: 'Lyf',
    },
    calendars: {
      title: 'Dagatöl á tímalínunni',
      hint: 'Sést framan við núlínuna — ekkert er skrifað til baka',
    },
  },
  sendTo: {
    title: 'Senda það í…',
    todo: 'Verkefni',
    shopping: 'Innkaupalisti',
    habits: 'Venjur',
    goals: 'Persónuleg markmið',
  },
  newTask: 'Nýtt verkefni',
  add: 'Bæta við',
  taskTitlePlaceholder: 'Hvað þarf að gera?',
  dateLabel: 'Dagsetning',
  calendar: {
    prevMonth: 'Fyrri mánuður',
    nextMonth: 'Næsti mánuður',
    jumpToToday: 'Í dag',
    jumpToTodayHint: 'Fara á daginn í dag',
    selectedSuffix: 'valið',
    todaySuffix: 'í dag',
  },
  pickOtherDate: (date: string) => `Velja aðra dagsetningu (${date})`,
  hideCalendar: 'Fela dagatal',
  timeLabel: 'Tími',
  wheneverHint: 'Enginn fastur tími – bara eitthvað til að gera þann dag',
  lightDarkModeLabel: 'Ljóst/dökkt',
  darkModeSystem: 'Kerfi',
  darkModeOn: 'Kveikt',
  darkModeOff: 'Slökkt',
  durationLabel: 'Lengd (mínútur)',
  durationPlaceholder: 'mín',
  // Orkukerfi (task-form + habit-form)
  energyConsumeLabel: 'Hefur áhrif á orku',
  energyGiveTakeLabel: 'Orkugildi',
  energyGiveTakeHint: 'Mínus kostar orku, plús gefur til baka, 0 = engin áhrif',
  stepPlaceholder: 'Bæta við skrefi',
  deleteTask: 'Eyða plani',
  // Verkefnaform — "næst þegar"-minnispunktur (Decision 019, frjáls texti, aðeins birting)
  taskHintLabel: 'Næst þegar…',
  taskHintPlaceholder: 't.d. Settu hleðslutækið í efstu skúffuna',
  // Verkefnaform — "svo"-framhaldstenging (Decision 020, einn á einn, aðeins birting)
  thenTaskLabel: 'Svo',
  thenTaskNone: 'Ekkert framhaldsverkefni valið',
  thenTaskPick: '+ Velja verkefni',
  thenTaskRemove: 'Fjarlægja tengingu',
  thenTaskEmptyList: 'Engin verkefni til að tengja',
  taskAdvancedOptions: 'Ítarlegir valkostir',
  // Verkefnaform — talgreining (aðeins í varasjóði, lib/useVoiceCapture.ts)
  taskVoiceTitleLabel: 'Lesa inn heiti',
  taskVoiceTitleStop: 'Stöðva upptöku',
  // Verkefnaform — bæta við tengilið (aðeins í varasjóði, expo-contacts)
  taskContactLabel: 'Tengiliður',
  taskContactNone: 'Enginn tengiliður skráður',
  taskContactPick: 'Bæta við tengilið',
  taskContactRemove: 'Fjarlægja tengilið',
  // Verkefnaform — merkja við núverandi staðsetningu (aðeins í varasjóði, expo-location)
  taskLocationLabel: 'Staðsetning',
  taskLocationNone: 'Engin staðsetning skráð',
  taskLocationAdd: 'Merkja við staðsetninguna mína',
  taskLocationRemove: 'Fjarlægja staðsetningu',
  taskLocationTagged: 'Staðsetning skráð',
  taskLocationPermissionBody: 'Það þarf aðgang að staðsetningu til að merkja þetta verkefni.',
  taskLocationErrorBody: 'Náði ekki staðsetningunni — reyndu aftur.',
  taskSavedSimple: 'Vistað ✓',
  scanReceipt: 'Skanna kvittun',
  scanHintBanner: 'Beindu að kvittuninni — skýr, vel lýstur texti virkar best',
  store: 'Verslun',
  otherStore: 'Önnur verslun…',
  customStoreLabel: 'Nafn verslunar',
  customStorePlaceholder: 'T.d. Búðin á horninu',
  selectStoreFirstTitle: 'Veldu verslun',
  selectStoreFirstBody: 'Veldu fyrst úr hvaða verslun kvittunin er.',
  takePhoto: 'Taka mynd',
  chooseFromLibrary: 'Velja úr myndasafni',
  addManually: 'Skrá handvirkt',
  analysingReceipt: 'Les kvittunina…',
  recognisedItems: 'Vörur sem fundust – veldu hverjar eiga að fara á listann',
  addToList: (n: number) => `Bæta ${n} ${isCount(n, 'vöru', 'vörum')} á innkaupalistann`,
  scanningSubtitle: 'Finn vörur og verð',
  foundOnReceipt: 'Fannst á kvittun',
  /* Fronting the count avoids having the participle agree with an interpolated number —
     "3 af 10 vörum valdar" is grammatical but reads as a half-finished sentence. */
  itemsSelectedCount: (n: number, total: number) => `Valdar vörur: ${n} af ${total}. Taktu hakið af því sem á ekki að fara með.`,
  addToListButton: (n: number) => `Bæta á innkaupalista (${n})`,
  totalAmount: (formattedSum: string) => `Samtals: ${formattedSum}`,
  manualEntryTitle: 'Skrá handvirkt',
  manualEntryHint: 'Eitt vöruheiti í hverja línu',
  manualEntryPlaceholder: 'Mjólk\nBrauð\nEgg\n...',
  addedTitle: 'Bætt við!',
  addedBody: (n: number) => `${n} ${isCount(n, 'vara fór', 'vörur fóru')} á innkaupalistann.`,
  addItemBtn: 'Bæta við vöru',
  settingsTitle: 'Stillingar',
  version: {
    title: 'Útgáfa og uppfærslur',
    appVersion: 'Útgáfa forrits',
    runtime: 'Keyrsluútgáfa',
    channel: 'Rás',
    source: 'Keyrir',
    sourceEmbedded: 'Innbyggður pakki',
    sourceOta: 'OTA-uppfærsla',
    updateId: 'Auðkenni uppfærslu',
    published: 'Birt',
    embedded: 'innbyggt',
    checkButton: 'Leita að uppfærslum',
    checking: 'Leita…',
    upToDate: 'Þú ert með nýjustu uppfærsluna.',
    downloaded: 'Uppfærsla sótt — endurræsi…',
    failed: 'Náði ekki að leita að uppfærslum. Athugaðu tenginguna.',
    disabled: 'Debug-útgáfa — settu upp release-útgáfu til að fá uppfærslur',
    updateAvailable: 'Uppfærsla tilbúin — ýttu til að setja upp og endurræsa',
    experimental: 'Tilraunaútgáfa — hlutir geta breyst, færst til eða bilað',
  },
  sectionProfile: 'Prófíll',
  yourName: 'Nafnið þitt',
  namePlaceholder: 'Fornafn (valfrjálst)',
  sectionShopping: 'Innkaupalisti',
  weeklyResetDay: 'Núllstilla vikulistann á',
  monthlyResetDate: 'Núllstilla mánaðarlistann þann',
  weeklyReminders: 'Vikulegar áminningar',
  reminderTimeLabel: 'Tími áminningar (KK:MM)',
  timeInputPlaceholder: 'KK:MM',
  taskNotifications: 'Tilkynningar um plön',
  taskNotificationsHint: 'Áminning þegar plan byrjar',
  persistentNotifLabel: 'Tilkynning með yfirliti dagsins',
  persistentNotifHint: 'Ein tilkynning með því sem eftir er af deginum, læsileg á lásskjánum',
  habitNotifications: 'Tilkynningar um venjur',
  medicineNotifications: 'Lyfjaáminningar',
  medicineNotificationsHint: 'Ein áminning á hvert hólf, með Tekið-hnappi',
  workHoursFrom: 'Frá',
  workHoursTo: 'Til',
  sectionLanguage: 'Tungumál',
  sectionReset: 'Núllstilla gögn',
  resetMonthly: 'Núllstilla mánaðarlista',
  resetTasks: 'Núllstilla öll verkefni',
  resetOnboarding: 'Núllstilla kynninguna',
  /* The label is arbitrary text (a task title, a symptom name), and Icelandic would need it
     in the accusative after the verb. Quoting it makes it a citation, which takes the
     nominative — the one form we actually have. Same for the delete twin below. */
  resetConfirmTitle: (label: string) => `Núllstilla „${label}“?`,
  resetConfirmBody: 'Þetta er ekki hægt að afturkalla.',
  resetConfirmBtn: 'Núllstilla',
  deleteConfirmTitle: (label: string) => `Eyða „${label}“?`,
  deleteConfirmBody: 'Ertu viss?',
  deleteConfirmBtn: 'Eyða',
  features: [
    { icon: 'home-outline', text: 'Heim — flýtileiðir og einfalt yfirlit yfir daginn' },
    { icon: 'checkbox-outline', text: 'Verkefnalisti sem heldur utan um það sem dagurinn krefst, svo þú þurfir ekki að muna það' },
    { icon: 'cart-outline', text: 'Innkaupalistar sem setja sig upp sjálfir, yfirlit yfir það sem til er heima, og réttir sem þú ýtir beint á listann' },
    { icon: 'repeat-outline', text: 'Venjur sem gefa dögunum umgjörð, einn dag í einu — engin röð til að missa' },
    { icon: 'heart-outline', text: 'Heilsa — skráðu einkenni og atvik, og sjáðu þróunina yfir tíma' },
    { icon: 'battery-half-outline', text: 'Orkukerfi sem vegur verkefni, venjur og heilsu á móti orkunni sem þú átt í raun' },
  ],
  monthlyResetDateQuestion: 'Hvaða dag núllstillist mánaðarlistinn?',
  weeklyRemindersOnboarding: 'Vikulegar áminningar',
  aiSetupBtn: 'Setja upp með gervigreind',
  aiSetupPickAnother: 'Þú getur valið aðra leið til að byrja.',
  firstRun: {
    step: (n: number, total: number) => `${n} af ${total}`,
    skip: 'Sleppa',
    continue: 'Áfram',
    finish: 'Búið',
    settingsNote: 'Þú getur breytt öllu þessu síðar í stillingunum.',
    reRun: 'Keyra uppsetninguna aftur',
    reRunHint: 'Hreyfing, leturstærð, útlit og upphafsskjár aftur',
    motion: {
      title: 'Hversu mikla hreyfingu viltu?',
      sub: 'Hreyfing getur tengt hlutina, eða þvælst fyrir',
      osReduced: 'Síminn biður um minni hreyfingu, svo hún er þegar niðri',
      full: { label: 'Full', desc: 'Mjúkar umbreytingar og bakgrunnur á hreyfingu.' },
      reduced: { label: 'Minni', desc: 'Umbreytingarnar haldast, bakgrunnurinn stendur kyrr.' },
      none: { label: 'Engin', desc: 'Engar hreyfimyndir neins staðar.' },
    },
    textSize: {
      title: 'Hversu stór á textinn að vera?',
      sub: 'Skjárinn breytist meðan þú ýtir, svo þú sérð stærðina',
      small: 'Aðeins minna en venjulega.',
      default: 'Venjuleg stærð.',
      large: 'Stærri texti í öllu appinu.',
    },
    appearance: {
      title: 'Veldu hvernig appið lítur út.',
      sub: 'Skjárinn breytist meðan þú ýtir.',
      off: { label: 'Ljóst', desc: 'Dökkur texti á ljósum bakgrunni.' },
      system: { label: 'Kerfi', desc: 'Fylgir ljósri eða dökkri stillingu símans.' },
      on: { label: 'Dökkt', desc: 'Ljós texti á dökkum bakgrunni.' },
    },
    startScreen: {
      title: 'Hvar á appið að opnast?',
      settingsLabel: 'Upphafsskjár',
      sub: 'Hinir fliparnir eru einn smellur í burtu.',
      home: 'Dagurinn í hnotskurn.',
      plans: 'Verkefnalisti dagsins.',
      shopping: 'Innkaupalistarnir þínir.',
    },
  },
  tour: {
    step: (n: number, total: number) => `${n} af ${total}`,
    next: 'Ég skil',
    /* `skipStep` fjarlægt 2026-08-03 — sjá enska tvíburann. */
    skipAll: 'Sleppa kynningunni',
    steps: {
      home: {
        title: 'Heim er dagurinn í hnotskurn',
        body: 'Verkefni, innkaup og venjur, allt á einum skjá.\n• Haltu á korti til að færa það efst.',
      },
      plans: {
        title: 'Verkefni halda utan um það sem dagurinn þarf',
        body: 'Skráðu eitt sem þú vilt koma í verk.\n• Lítið slær fullkomið — verkefni sem þú klárar.',
      },
      shopping: {
        title: 'Innkaupalistinn núllstillir sig sjálfur',
        body: 'Tveir listar, báðir núllstilla sig sjálfir.\n• Vikulega, fyrir matvöru.\n• Mánaðarlega, fyrir það sem heimilið þarf.',
      },
      habits: {
        title: 'Venjur, einn dag í einu',
        body: 'Veldu eina til að byrja á.\n• Engin röð til að missa — rólegur dagur er bara rólegur dagur.',
      },
      health: {
        title: 'Heilsa tekur eftir mynstrum',
        body: 'Skráðu einkenni eða hvernig þú svafst.\n• Lyfin eru hér líka, í morgun-, hádegis-, kvöld- og næturhólfum.',
      },
    },
    finale: {
      title: 'Þetta var kynningin',
      body: 'Allt annað liggur á bak við þessa fimm flipa.\n• Hver skjár er með ⓘ-hnapp með eigin ábendingum og stillingum.',
      experimental: 'UnFocus er í vinnslu.\n• Hlutir geta breyst, færst til eða komið hálfkláraðir.\n• Allt situr eftir í símanum þínum.\n• Viðbrögð móta það sem kemur næst.',
      done: 'Byrja að nota appið',
    },
  },
  basics: {
    title: 'Nokkur grunnatriði',
    sub: 'Ýttu til að sjá breytinguna — hver röð er þegar með stillingu sem virkar',
    /* Sjá enska tvíburann: þetta er það fyrsta sem glænýr notandi sér. */
    welcomeTitle: 'Dagurinn þinn, á einum stað',
    welcomeSub: 'Verkefni, innkaup, venjur og heilsa, saman. Ekkert hér heldur stigatölu.',
    appearance: 'Útlit',
    textSize: 'Leturstærð',
    motion: 'Hreyfing',
    language: {
      label: 'Tungumál',
      en: { label: 'English', desc: 'Appið talar ensku.' },
      no: { label: 'Norsk', desc: 'Appið talar norsku.' },
      is: { label: 'Íslenska', desc: 'Appið talar íslensku.' },
    },
    handedness: {
      label: 'Hlið valmyndar',
      right: { label: 'Hægri', desc: 'Valmyndarhnappur hægra megin, fyrir hægri hönd.' },
      left: { label: 'Vinstri', desc: 'Valmyndarhnappur vinstra megin, fyrir vinstri hönd.' },
    },
  },
  chooseLanguage: 'Veldu tungumál',
  chooseLanguageSub: 'Þú getur breytt þessu í stillingunum hvenær sem er.',
  english: 'English',
  norwegian: 'Norsk',
  icelandic: 'Íslenska',
  dayLabels: ['Mán', 'Þri', 'Mið', 'Fim', 'Fös', 'Lau', 'Sun'],
  dayFull: ['Mánudagur', 'Þriðjudagur', 'Miðvikudagur', 'Fimmtudagur', 'Föstudagur', 'Laugardagur', 'Sunnudagur'],
  today: 'Í dag',
  addTime: '+ Bæta við tíma',
  permissionTitle: 'Aðgangs er þörf',
  permissionBody: 'Myndavélin þarf aðgang til að skanna kvittanir.',
  shoppingTitle: 'Innkaupalisti',
  shoppingRemaining: (r: number, c: number) => `${r} eftir · ${c} í körfu`,
  shoppingItemPlaceholder: 'Vara',
  shoppingUnitPlaceholder: 'Eining (stk, kg, l…)',
  inCart: 'Í körfu',
  itemAddedToList: (name: string) => `${name} fór á listann ✓`,
  itemAddedToNamedList: (name: string, listName: string) => `${name} → ${listName} ✓`,
  itemAddedToInventory: (name: string) => `${name} fór í birgðir ✓`,
  itemsAddedToList: (n: number) => `${n} ${isCount(n, 'vara fór', 'vörur fóru')} á listann ✓`,
  /* The arrow keeps a user-supplied dish name out of a case slot Icelandic would otherwise
     demand ("sameinað við X" wants the accusative, which an arbitrary name cannot supply).
     Same reason itemAddedToNamedList above uses it. */
  mergedIntoDish: (dish: string) => `Sameinað → ${dish} ✓`,
  movedToDish: (dish: string) => `Fært → ${dish} ✓`,
  itemPutBackToInventory: (name: string) => `${name} fór aftur í birgðir`,
  weeklyTabLabel: 'Innkaupalistar',
  monthlyTabLabel: 'Mánuður',
  inWeeklyListSection: 'Innkaupalisti',
  purchasedThisMonthSection: 'Keypt í þessum mánuði',
  tripLabel: (date: string) => `Verslað ${date}`,
  temporaryBadge: 'Tímabundið',
  updateSheetTitle: 'Uppfæra vöru',
  varenavnLabel: 'Heiti vöru',
  estimertPrisLabel: 'Áætlað verð',
  onsketAntallLabel: 'Æskilegt magn við núllstillingu',
  onsketAntallWeeklyLabel: 'Æskilegt magn',
  midlertidigToggleLabel: 'Tímabundið',
  saveBtn: 'Vista',
  cancelBtn: 'Hætta við',
  deleteFromCatalogBtn: 'Eyða úr vöruskrá',
  deleteConfirmText: 'Ertu viss?',
  inKurvenSection: (n: number) => `Í körfu (${n})`,
  /* Impersonal, so the button does not have to guess the reader's gender the way
     "búinn/búin að versla" would. */
  doneShoppingBtn: 'Innkaupum lokið 🛍️',
  doneShoppingReceiptTitle: 'Ertu með kvittun?',
  doneShoppingReceiptBody: 'Skannaðu eða settu inn mynd til að skrá kaupin, eða slepptu því.',
  scanReceiptBtn: 'Skanna kvittun',
  uploadPhotoBtn: 'Setja inn mynd',
  skipBtn: 'Sleppa',
  doneShoppingSuccessText: 'Vel gert!',
  weeklyEmptyTitle: 'Ekkert á listanum enn',
  weeklyEmptySubtitle: 'Ýttu til að opna og bæta við vörum.',
  /* Both the noun and the adjective inflect, so the whole phrase switches, not a suffix. */
  unsavedShoppingBanner: (n: number) => `Óvistað: ${n} ${isCount(n, 'listi enn ólæstur', 'listar enn ólæstir')}`,
  newWeeklyListTitle: 'Búa til nýjan lista',
  startEmptyList: 'Byrja tóman',
  deleteList: 'Eyða lista',
  deleteListConfirmTitle: 'Eyða þessum lista?',
  deleteListConfirmBody: 'Listinn og allar vörur hverfa fyrir fullt og allt.',
  inventoryEditTitle: 'Breyta birgðum',
  manageInventoryAction: 'Sýsla með birgðir',
  monthlyResetSummaryTitle: 'Mánaðarlistinn er núllstilltur',
  monthlyResetSummaryInventorySection: 'Birgðir',
  monthlyResetSummarySpentLabel: (formattedAmount: string) => `${formattedAmount} varið`,
  monthlyResetSummaryOfTotalLabel: (formattedAmount: string) => `af ${formattedAmount} heildarverðmæti`,
  monthlyResetSummaryAdHocSection: 'Önnur kaup',
  monthlyResetSummaryEmpty: 'Ekkert var keypt á þessu tímabili.',
  monthlyResetSummaryCloseBtn: 'Ég skil',
  monthlyResetReviewTitle: 'Áður en við núllstillum…',
  monthlyResetReviewIntro: 'Farðu yfir listana og birgðirnar, eða slepptu því.',
  monthlyResetReviewListsSection: 'Listarnir þínir',
  monthlyResetReviewKeepListLabel: 'Halda þessum lista',
  monthlyResetReviewListItemCount: (n: number) => `${n} ${isCount(n, 'vara', 'vörur')}`,
  monthlyResetReviewEmptyLists: 'Engir listar enn.',
  monthlyResetReviewInventorySection: 'Hversu mikið áttu eftir?',
  monthlyResetReviewInventoryHint: 'Stilltu magnið fyrir það sem þú átt enn',
  monthlyResetReviewEmptyInventory: 'Birgðirnar þínar eru tómar.',
  monthlyResetReviewSkipBtn: 'Sleppa',
  monthlyResetReviewConfirmBtn: 'Lítur vel út, núllstilla',
  listSettingsTitle: 'Stillingar lista',
  listRecurringToggleLabel: 'Endurtaka þennan lista',
  listActiveWeeksLabel: 'Virkar vikur í mánuðinum',
  weekNumberChip: (n: number) => `Vika ${n}`,
  monthlyListSection: 'Mánaðarlisti',
  newMonthlyListBtn: 'Nýr listi',
  defaultMonthlyListName: 'Mánaðarlisti',
  newMonthlyListNamePlaceholder: 'Heiti lista',
  createMonthlyListBtn: 'Búa til',
  monthlyListsEmpty: 'Engir mánaðarlistar enn — búðu til einn til að byrja.',
  deleteMonthlyListAction: 'Eyða þessum lista',
  weekEmptyTitle: 'Engir listar í þessari viku enn',
  weekEmptyBody: 'Byrjaðu einn hér þegar þú þarft.',
  catalogueSearchPlaceholder: 'Leita í vöruskrá…',
  monthlyListTotal: (kr: string) => `Samtals: ${kr}`,
  monthlyListEmpty: 'Ekkert komið enn — veldu úr vöruskránni hér að neðan.',
  monthlyListEmptyLocked: 'Ekkert komið enn — ýttu til að opna og bæta við vörum.',
  monthlyPreviewSearchPlaceholder: 'Leita í mánaðarlistanum…',
  monthlyPreviewEmpty: 'Mánaðarlistinn þinn er tómur.',
  weekListTotal: (kr: string) => `Samtals: ${kr}`,
  savedListsTitle: 'Vistaðir listar',
  saveListAsTemplateBtn: 'Vista sem sniðmát',
  savedListsEmpty: 'Engir vistaðir listar enn.',
  templateAppliedToast: 'Sniðmátið bættist við listann þinn',
  listSavedAsTemplateToast: 'Listinn var vistaður sem sniðmát',
  savedListsSectionHint: 'Dragðu inn í viku hér að neðan, eða ýttu til að velja',
  savedListsChooseWeekBody: 'Bæta þessum vistaða lista við:',
  savedListInUseLabel: 'Í notkun',
  templateAlreadyInWeek: (n: number) => `Þegar í viku ${n}`,
  listSyncedToast: 'Vistaði listinn uppfærður',
  syncListButtonLabel: 'Samstilla við vistaðan lista',
  decreaseQty: 'Fækka',
  increaseQty: 'Fjölga',
  removeItemLabel: 'Fjarlægja vöru',
  putBackItemLabel: 'Setja aftur í birgðir',
  categoryPickerLabel: 'Flokkur (valfrjálst)',
  scanReceiptForListAction: 'Skanna kvittun',
  scanForCatalogueLabel: 'Skanna verð',
  scanTargetWeekly: 'Borið saman við þennan innkaupalista',
  scanTargetMonthly: 'Borið saman við þennan mánaðarlista',
  scanTargetCatalogue: 'Bætir við og uppfærir verð í vöruskrá',
  shoppingCadenceLink: 'Núllstillingardagar',
  restoreHintsLabel: 'Sýna ábendingarnar aftur',
  restoreHintsDone: 'Ábendingarnar eru komnar aftur',
  /* The segment draws no "Raða" label of its own, so the two options carry the question.
     "Eftir tegund" overran its segment by 12px; the bare nouns fit and read the same. */
  sortByType: 'Tegund',
  sortByName: 'Heiti',
  sortLabel: 'Raða',
  categoryLabels: {
    produce: 'Ávextir og grænmeti',
    bakery: 'Brauð og bakkelsi',
    dairy: 'Mjólkurvörur',
    meat: 'Kjöt',
    fish: 'Fiskur',
    frozen: 'Frystivörur',
    pantry: 'Þurrvara',
    canned: 'Niðursuðuvörur',
    snacks: 'Snakk',
    drinks: 'Drykkir',
    cleaning: 'Hreinlætisvörur',
    personal: 'Snyrtivörur',
    other: 'Annað',
  },
  toBuySection: (n: number) => `Að kaupa (${n})`,
  inCartSection: (n: number) => `Í körfu (${n})`,
  purchasedSection: (n: number) => `Keypt (${n})`,
  fromMonthlySection: 'Úr mánaðarlista',
  storeModeBtn: 'Búðarhamur',
  storeModeTitle: 'Í búðinni',
  storeModeAwakeNote: 'Skjárinn helst kveiktur meðan þetta er opið.',
  storeModeExitBtn: 'Loka búðarham',
  storeModeEmpty: 'Ekkert á þessum lista enn.',
  moveToCartBtn: 'Setja í körfu',
  moveToListBtn: 'Aftur á listann',
  markBoughtBtn: 'Keypt',
  undoBoughtBtn: 'Aftur í körfu',
  addSelectedItemsBtn: (n: number) => `Bæta við (${n})`,
  categoryFilterAllLabel: 'Allir flokkar',
  categoryFilterAccessibilityLabel: 'Sía eftir flokki',
  weeklyListSearchPlaceholder: 'Leita í þessum lista…',
  addItemInputPlaceholder: 'Leita að vörum…',
  savedListsButtonLabel: 'Vistaðir listar',
  deleteListButtonLabel: 'Eyða lista',
  listSettingsButtonLabel: 'Stillingar lista',
  lockListButtonLabel: 'Læsa lista',
  unlockListButtonLabel: 'Opna lista',
  shoppingListPlaceholder: 'Innkaupalisti',
  listSaveButtonLabel: 'Vista breytingar',
  listDiscardButtonLabel: 'Henda breytingum',
  unsavedListChangesTitle: 'Óvistaðar breytingar',
  unsavedListChangesBody: 'Viltu vista breytingarnar á þessum lista áður en þú læsir honum?',
  saveAndLockBtn: 'Vista og læsa',
  discardAndLockBtn: 'Henda og læsa',
  weekSectionEmpty: 'Engir listar enn.',
  listMovedToWeek: (n: number) => `Fært í viku ${n}`,
  expandListLabel: 'Sýna lista',
  collapseListLabel: 'Fela lista',
  listOptionsButtonLabel: 'Valkostir lista',
  addFromMonthlyOption: 'Úr mánaðarlista',
  addFromDishOption: 'Úr rétti',
  resetMonthlyListAction: 'Núllstilla þennan lista núna',
  resetMonthlyListConfirmTitle: 'Núllstilla þennan lista?',
  resetMonthlyListConfirmBody: 'Fjarlægir tímabundnar vörur á þessum lista og byrjar nýtt tímabil.',
  resetAllMonthlyListsAction: 'Núllstilla alla mánaðarlista núna',
  resetAllMonthlyListsConfirmTitle: 'Núllstilla alla mánaðarlista?',
  resetAllMonthlyListsConfirmBody: 'Fjarlægir tímabundnar vörur á öllum mánaðarlistum og byrjar nýtt tímabil.',
  foodTabLabel: 'Matur',
  catalogueTabLabel: 'Vöruskrá',
  foodEmptyHint: 'Engir réttir enn — ýttu á + til að bæta við.',
  addDishToMealBtn: 'Bæta við rétti',
  /* Colon rather than a preposition: a dish name is user text and cannot be inflected. */
  addDishPopupTitle: (dish: string) => `Bæta við: ${dish}`,
  addToWeekListBtn: 'Setja á vikulista',
  addToMonthlyListBtn: 'Setja á mánaðarlista',
  addToListNoIngredients: 'Þessi réttur er ekki með nein hráefni enn.',
  closePopupLabel: 'Loka',
  dishAddedToWeek: (dish: string) => `${dish} → Óráðstafað ✓`,
  dishAddedToMonthly: (dish: string) => `${dish} → mánaðarlisti ✓`,
  unallocatedSection: 'Óráðstafað',
  unallocatedHint: 'Réttir sem þú settir á vikuna — færðu hvern á lista.',
  allocateToListTitle: 'Á hvaða lista?',
  allocateItemLabel: 'Færa á vikulista',
  noWeekListsYet: 'Búðu fyrst til vikulista.',
  catalogueAddNewBtn: 'Bæta við vöru',
  catalogueAddSheetTitle: 'Ný vara',
  catalogueAddSheetName: 'Heiti',
  catalogueAddSheetPrice: 'Verð',
  catalogueItemNamePlaceholder: 'Heiti vöru',
  catalogueItemPricePlaceholder: 'Verð (kr)',
  catalogueDeleteItemLabel: 'Eyða vöru',
  catalogueEmpty: 'Engar vörur enn — bættu einni við hér fyrir ofan.',
  catalogueItemAdded: (name: string) => `${name} bættist við ✓`,
  catalogueSearchClearLabel: 'Hreinsa leit',
  catalogueNoMatches: 'Engar vörur passa við leitina.',
  catalogueIndexScrubLabel: 'Fara á bókstaf',
  errorBoundaryTitle: 'Eitthvað fór úrskeiðis',
  errorBoundaryRetry: 'Reyna aftur',
  category: 'Flokkur',
  shoppingCategories: {
    produce: 'Ávextir og grænmeti',
    dairy: 'Mjólkurvörur',
    meat: 'Kjöt',
    fish: 'Fiskur',
    bread: 'Brauð og bakkelsi',
    frozen: 'Frystivörur',
    canned: 'Niðursuðuvörur',
    dry: 'Þurrvara',
    snacks: 'Snakk',
    drinks: 'Drykkir',
    cleaning: 'Hreinlætisvörur',
    personal: 'Snyrtivörur',
    other: 'Annað',
  },
  monthlyDateInputHint: 'Valfrjáls dagsetning 1–31. Í stuttum mánuðum núllstillist listinn síðasta dag.',
  invalidMonthlyDateMsg: 'Þarf dag á milli 1 og 31 — fyrra gildi sett aftur.',
  habits: {
    notYetToday: 'Ekki enn í dag',
    cardSubtitle: 'Einföld hök — engar raðir, engin stig.',
    moreOptions: 'Fleiri valkostir',
    fewerOptions: 'Færri valkostir',
    editButtonLabel: 'Breyta venju',
    restDay: 'Hvíldardagur',
    restingToday: 'Hvíli í dag',
    restDayHint: 'Hvíldardagur — orkan fyrir þessa venju stendur kyrr',
    weeklyProgress: (count: number, goal: number) => `${count}/${goal} þessa viku`,
  },
  goals: {
    pickerLabel: 'Markmið',
    none: 'Ekki tengt neinu markmiði',
    pick: '+ Tengja við markmið',
    remove: 'Fjarlægja tengingu',
    emptyList: 'Engin markmið enn — ýttu hér til að bæta því fyrsta við.',
    newPlaceholder: 'Heiti á nýju markmiði',
    add: 'Bæta við markmiði',
    deleteLabel: 'Eyða markmiði',
    deleteConfirmTitle: (name: string) => `Eyða „${name}“?`,
    deleteConfirmBody: 'Tengd verkefni og venjur verða aftengd. Þetta er ekki hægt að afturkalla.',
    strengthLabel: 'Kraftur — vex þegar þú vinnur í því, dvínar rólega annars',
    editLinkPersonal: 'Persónuleg markmið',
    editLinkPractical: 'Hagnýt markmið',
    strengthStrong: 'Gengur vel',
    strengthWarm: 'Komið af stað',
    strengthNeutral: 'Tilbúið þegar þú ert það',
    linkedCount: (tasks: number, habits: number) =>
      `${tasks} verkefni · ${habits} ${isCount(habits, 'venja', 'venjur')}`,
    lastWorked: (days: number) =>
      days === 0 ? 'Unnið í því í dag' : days === 1 ? 'Síðast unnið í gær' : `Síðast unnið fyrir ${days} dögum`,
    neverWorked: 'Ekkert tengt enn',
    seeAll: 'Sjá allt →',
  },
  automations: {
    title: 'Sjálfvirkni',
    navLabel: 'Sjálfvirkni',
    navHint: 'Einfaldar ef-þetta-þá-hitt reglur',
    emptyState: 'Engin sjálfvirkni enn — ýttu á + til að búa til reglu.',
    addNew: '+ Ný regla',
    whenLabel: 'Þegar…',
    thenLabel: 'Þá…',
    triggerTaskCompleted: 'Verkefni klárast',
    triggerShoppingOpened: 'Innkaupalistinn opnast',
    actionShowMessage: 'Sýna skilaboð',
    actionAddShoppingItem: 'Bæta vöru á listann',
    messagePlaceholder: 'Skilaboð sem á að sýna…',
    itemNamePlaceholder: 'Heiti vöru…',
    alertTitle: 'Sjálfvirkni',
    saveBtn: 'Vista reglu',
    deleteTitle: 'Eyða þessari reglu?',
    deleteBody: 'Þetta er ekki hægt að afturkalla.',
    deleteBtn: 'Eyða',
    ruleSummary: (when: string, then: string) => `${when} → ${then}`,
  },
  onboarding: {
    privacy: {
      headline: 'Gögnin þín eru hjá þér',
      local: 'Geymt eingöngu í þessu tæki — ekkert er sent neitt',
      free: 'UnFocus er ókeypis — og verður það áfram.',
      /* Sjá enska tvíburann: þetta er síðasti skjárinn í uppsetningunni núna. */
      cta: 'Byrja',
      restoreLink: 'Ertu að endurheimta úr afriti?',
    },
    restore: {
      headline: 'Hefurðu notað UnFocus áður?',
      body: 'Sæktu allt úr afriti, eða byrjaðu upp á nýtt.',
      restoreCta: 'Já — endurheimta gögnin mín',
      /* "ný/nýr" would have to agree with the reader's gender; "að byrja" does not. */
      newCta: 'Nei, ég er að byrja núna',
    },
  },
  settings: {
    // Orkukerfi (Almennt-flipinn) — valfrjáls orkuáætlun á hvert verkefni.
    energy: {
      label: 'Orkukerfi',
      hint: 'Dags- og vikuáætlun sem verkefni og venjur ganga á',
      dailyCapacity: 'Orka á dag',
      weeklyCapacity: 'Orka á viku',
      modeLabel: 'Tegund áætlunar',
      modeDaily: 'Daglegt',
      modeWeekly: 'Vikulegt',
      modeCustom: 'Sérsniðið',
      customHint: 'Orka á hvern vikudag',
    },
    accessibility: {
      title: 'Aðgengi',
      reducedMotion: 'Minni hreyfing',
      particles: 'Agnaáhrif',
      particlesHint: 'Hreyfðar agnir í bakgrunni heimaskjásins',
      glassSurfaces: 'Glerfletir',
      glassSurfacesHint: 'Frostað gler á kortum og hnöppum — slökkt fyrir gegnheila fleti',
      fontSize: 'Leturstærð',
      fontSizeSmall: 'Lítil',
      fontSizeDefault: 'Venjuleg',
      fontSizeLarge: 'Stór',
      leftHanded: 'Örvhent stilling',
      leftHandedHint: 'Valmyndarhnappurinn vinstra megin',
      timelineHorizontal: 'Lárétt tímalína verkefna',
      timelineHorizontalHint: 'Verkefni dagsins frá vinstri til hægri í stað ofan frá og niður',
    },
    privacy: {
      headline: 'Gögnin þín eru hjá þér',
      local: 'Geymt eingöngu í þessu tæki — ekkert er sent neitt',
      free: 'UnFocus er ókeypis — og verður það áfram.',
    },
    // AP-05 — hljóðlátur tími
    quietHours: {
      label: 'Hljóðlátur tími',
      hint: 'Áminningar um verkefni bíða þar til honum lýkur; áminningum um venjur er sleppt',
    },
    // AP-06B — mánaðarleg innkaupaáætlun, borin saman við kvittanir í app/budget.tsx
    monthlyBudget: {
      label: 'Mánaðarleg fjárhagsáætlun',
      hint: 'Valfrjálst — borið saman við eyðsluna á Fjárhagsskjánum',
      placeholder: 't.d. 3000',
    },
  },
  config: {
    skipForNow: 'Ég geri þetta seinna',
    sections: {
      appearance: 'Útlit',
      /* Sjá enska tvíburann (2026-08-03). */
      you: 'Þú',
      notifications: 'Tilkynningar',
      data: 'Gögn',
      layout: 'Uppsetning',
      features: 'Eiginleikar',
      advanced: 'Ítarlegt',
    },
    layouts: {
      title: 'Hvernig listar líta út',
      followsDefault: 'Eins og venjulega',
      /* "sem ég er vanur/vön að hafa" would have to agree with the reader's gender. */
      useDefault: 'Nota venjulegu uppsetninguna mína',
      customBadge: 'Eigin uppsetning',
      markAllSeen: 'Merkja allt sem séð',
      close: 'Búið',
      moreLabel: 'Restin',
      newCount: (n: number) => `${n} ${isCount(n, 'nýtt', 'ný')}`,
      basic: {
        label: 'Bara það helsta',
        hint: 'Ein lína hver — heiti og hak, ekkert meira.',
      },
      normal: {
        label: 'Venjulegt',
        hint: 'Venjulegt magn af smáatriðum.',
      },
      everything: {
        label: 'Sýna allt',
        hint: 'Öll svæði sýnileg í einu.',
      },
      inStore: {
        label: 'Í búðinni',
        hint: 'Stórar línur eftir deildum, bara heiti',
      },
      timeline: {
        label: 'Á tímalínu',
        hint: 'Dagurinn eftir klukkunni, með rólegu köflunum dregnum saman',
      },
      nowNext: {
        label: 'Núna og næst',
        hint: 'Það sem þú ert í og það sem kemur næst — hitt liggur falið',
      },
      focusFirst: {
        label: 'Eitt í einu',
        hint: 'Eitt verkefni fremst, stuttur listi undir',
      },
      byPerson: {
        label: 'Eftir manneskju',
        hint: 'Í dag skipt eftir fólki, með því hver á að gera hvað',
      },
    },
    tabs: {
      general: 'Almennt',
      personal: 'Persónulegt',
      advanced: 'Ítarlegt',
    },
    features: {
      goals: {
        label: 'Markmið',
        hint: 'Verkefni og venjur tengd við eitthvað stærra',
      },
      sharing: {
        label: 'Deiling og QR',
        hint: 'Sendu og taktu við verkefnum og vörum',
      },
      automations: {
        label: 'Sjálfvirkni',
        hint: 'Reglur sem keyra sjálfar',
      },
      medicine: {
        label: 'Lyf',
        hint: 'Skammtakort á Heilsu, ein áminning fyrir hvert hólf',
      },
      dayLog: {
        label: 'Dagurinn eins og hann gerðist',
        /* Impersonal "þegar er búið" — the personal form would have to agree with gender. */
        hint: 'Búið fyrir ofan núlínuna, restin fyrir neðan',
      },
      energy: {
        label: 'Orka',
        hint: 'Orkugildi á hvert verkefni og venju, lagt saman á dag og viku',
        modes: {
          label: 'Hvernig það er að klára',
          energy: {
            label: 'Orkuhamur',
            hint: 'Kostnaður á hvern hlut, og mælir fyrir það sem eftir er',
          },
          rewards: {
            label: 'Umbunarhamur',
            hint: 'Enginn mælir, enginn kostnaður — bara hakið sem fyllist',
          },
        },
      },
      growth: {
        label: 'Hljóðlátur vöxtur',
        hint: 'Bakgrunnurinn vex og hlýnar eftir því sem dagarnir leggjast saman',
      },
    },
    autoBackup: {
      label: 'Sjálfvirkt öryggisafrit',
      hint: 'Ein skrá, haldið uppfærðri þar sem þú velur — ekkert er sent upp',
      pathLabel: 'Geymt í:',
      locationUnknown: 'ekki valið enn',
      lastBackedUp: (when: string) => `Síðasta afrit: ${when}`,
      never: 'Ekkert afrit enn',
      backUpNow: 'Taka afrit núna',
      backedUpNow: 'Afritið er uppfært.',
      locationCanceled: 'Slökkt þar til þú velur staðsetningu',
      shareNote: 'Deilt afrit sleppir nafninu þínu',
    },
    desc: {
      name: 'Bara kveðja — fer aldrei úr símanum',
      weeklyReminders: 'Áminning á innkaupadeginum þínum',
      holidays: 'Frídagar í dagatalinu',
      shoppingDefault: 'Hvaða listi opnast fyrst',
      weeklyResetDay: 'Hvenær vikulistinn núllstillir sig',
      monthlyResetDate: 'Stuttur mánuður núllstillist á síðasta degi',
      hints: 'Stuttar skýringar á hverjum skjá',
      dataNote: 'Þetta er ekki hægt að afturkalla',
    },
  },
  backup: {
    title: 'Öryggisafrit',
    desc: 'Öll gögnin þín í einni skrá sem þú heldur — ekkert er sent upp',
    exportButton: 'Flytja út öryggisafrit',
    importButton: 'Endurheimta úr öryggisafriti',
    exportError: 'Tókst ekki að búa til afritsskrána.',
    sharingUnavailable: 'Deiling er ekki í boði í þessu tæki.',
    invalidFile: 'Þetta lítur ekki út eins og UnFocus-öryggisafrit.',
    tooNew: 'Búið til í nýrri útgáfu af UnFocus. Uppfærðu appið fyrst.',
    importConfirmTitle: 'Endurheimta þetta afrit?',
    importConfirmBody: (items: number) =>
      `Þetta skiptir ÖLLUM núverandi gögnum þínum út fyrir afritið (${items} atriði). Það er ekki hægt að afturkalla.`,
    importConfirmBtn: 'Endurheimta',
    restoreError: 'Tókst ekki að endurheimta afritið — gögnin þín eru óbreytt.',
    restoreDone: 'Endurheimt lokið. Appið endurræsir sig núna.',
    saveToDevice: 'Vista í tækinu',
    shareCopy: 'Deila afriti',
    /* Colon: the location is a raw path, and "vistað í X" would want the dative. */
    savedToDevice: (location: string) => `Öryggisafrit vistað: ${location}`,
    saveUnavailable: 'Ekki hægt að vista í tækið hér.',
  },
  // Staðbundinn aðgangur (Decision 039) — aðeins í tækinu, í eigu notandans. Enginn
  // netþjónn, engin innskráning, ekkert ský.
  account: {
    title: 'Afrit og endurheimt',
    restoreButton: 'Endurheimta úr afriti',
    deviceOnlyNote: 'Engin innskráning, engin lykilorð, enginn netþjónn — aldrei',
  },
  // Uppsetningarleiðbeiningar fyrir gervigreind — lib/aiSetupGuide.ts + lib/aiSetupApply.ts.
  // Leiðbeiningatextinn sjálfur er vísvitandi aðeins á ensku (sjá haus þeirrar skrár);
  // aðeins viðmótið í kringum eiginleikann fer í gegnum i18n.
  aiSetup: {
    title: 'Uppsetning með gervigreind',
    downloadButton: 'Sækja leiðbeiningarnar',
    shareButton: 'Deila afriti',
    uploadButton: 'Senda inn uppsetningarskrá',
    savedToDevice: (location: string) => `Leiðbeiningarnar vistaðar: ${location}`,
    saveUnavailable: 'Ekki hægt að vista í tækið hér.',
    sharingUnavailable: 'Deiling er ekki í boði í þessu tæki.',
    exportError: 'Tókst ekki að búa til leiðbeiningaskrána.',
    invalidFile: 'Ekki útfyllt uppsetningarskrá. Sendu inn skrána sem gervigreindin skilaði, ekki leiðbeiningarnar.',
    staleWarning: 'Búið til úr eldri leiðbeiningum, svo nýrri valkosti gæti vantað. Fluttu samt inn, eða sæktu nýjar leiðbeiningar fyrst.',
    previewTitle: 'Þetta verður sett upp',
    confirmImport: 'Setja það upp',
    nothingToImport: 'Ekkert í þessari skrá sem appið þekkti.',
    importDone: (n: number) => `${n} ${isCount(n, 'breyting framkvæmd', 'breytingar framkvæmdar')}.`,
    deviceOnlyNote: 'Ekkert er sent upp — innflutningur skrifar aðeins í þetta tæki',
    itemsWillBeAdded: (n: number) => `${n} ${isCount(n, 'atriði bætist við', 'atriði bætast við')}`,
    /* "sleppt" governs the dative, and the noun's dative plural differs from its singular. */
    skippedCount: (n: number) => `${n} ${isCount(n, 'atriði', 'atriðum')} sleppt`,
    settingsWillChange: (n: number) => `${n} ${isCount(n, 'stilling breytist', 'stillingar breytast')}`,
    skippedField: (field: string, reason: string) => `${field}: ${reason}`,
    domains: {
      tasks: 'Verkefni',
      habits: 'Venjur',
      goals: 'Markmið',
      notes: 'Minnispunktar',
      shoppingLists: 'Innkaupalistar',
      shoppingItems: 'Vörur á innkaupalista',
      inventoryItems: 'Birgðir heimilisins',
      catalogueItems: 'Vörur í vöruskrá',
      meals: 'Máltíðir',
      monthlyLists: 'Mánaðarlistar',
      settings: 'Stillingar',
    },
    skippedReason: {
      'invalid-date': 'ógild dagsetning',
      'invalid-time': 'ógildur tími',
      'invalid-enum': 'óþekkt gildi',
      'invalid-type': 'vantar eða er ógilt',
      'too-long': 'of langt',
      'weekly-recurrence-needs-days': 'vikuleg venja þarf að minnsta kosti einn dag',
      'unknown-version': 'óstudd útgáfa',
    } as Record<string, string>,
  },
  on: 'kveikt',
  off: 'slökkt',
  habitsTitle: 'Venjur',
  habitToday: 'Í dag',
  habitWeekView: 'Vika',
  habitMonthView: 'Mánuður',
  reminders: 'Áminningar',
  habitFormTitle: 'Ný venja',
  habitFormEdit: 'Breyta venju',
  habitDailyGoal: 'Skipti á dag',
  habitWeeklyGoal: 'Skipti á viku',
  habitRecurrence: 'Tíðni',
  habitRecurrenceDaily: 'Daglega',
  habitRecurrenceWeekly: 'Vikulega',
  habitRecurrenceMonthly: 'Mánaðarlega',
  habitRecurrenceWeeklyFlexible: 'Sveigjanlegt',
  habitRecurrenceWeeklyFlexibleHint: 'Hvaða dagur sem er telur — daglega þar til vikunni er náð',
  /* "Á N daga fresti" is how Icelandic says an interval; a literal "hver N. dagur" is
     grammatical but reads like a schedule table rather than a setting. */
  habitEveryNDaysLabel: (n: number) => `Á ${n} daga fresti`,
  habitEveryNWeeksLabel: (n: number) => `Á ${n} vikna fresti`,
  habitRepeatDaysLabel: 'Hvaða dagar',
  habitTitleLabel: 'Heiti',
  habitTitlePlaceholder: 'T.d. Drekka vatn',
  habitIconLabel: 'Tákn',
  habitDeleteLabel: 'Eyða venju',
  habitNotification: 'Dagleg áminning',
  habitHowOften: 'Hversu oft',
  habitReminderLabel: 'Áminning',
  habitReminderTimeLabel: 'Tími',
  habitReminderOffHint: 'Engin áminning — hún birtist samt á sínum dögum',
  habitMoreOptionsHint: 'ýttu til að breyta áætlun, tákni eða flokki.',
  habitReminderModeSingle: 'Einu sinni',
  habitReminderModeCount: 'Oftar',
  habitReminderModeInterval: 'Á fresti…',
  habitReminderCountLabel: 'Hversu oft á dag',
  habitReminderIntervalLabel: 'Bil milli áminninga',
  habitReminderStartLabel: 'Fyrsta áminning',
  habitReminderEndLabel: 'Síðasta áminning',
  habitReminderEveryHours: (h: number) => `Á ${h} klst fresti`,
  habitReminderEveryMinutes: (m: number) => `Á ${m} mín fresti`,
  habitReminderTimesPreview: (n: number) => `${n} ${isCount(n, 'áminning', 'áminningar')} á dag`,
  habitForLabel: 'Fyrir',
  habitForMe: 'Mig',
  peopleMode: {
    label: 'Fólk / fjölskylda',
    hint: 'Úthlutaðu verkefnum og venjum á fólkið á heimilinu',
    profilesHint: 'Ýttu á lit til að breyta honum.',
    addPlaceholder: 'Nafn',
    addButton: 'Bæta við manneskju',
    /* A person's name would need the accusative here; quoting keeps it in the form we have. */
    removeTitle: (name: string) => `Fjarlægja „${name}“?`,
    removeBody: 'Verkefnunum og venjunum þeirra er ekki eytt — þau færast aftur til þín.',
    filterAll: 'Öll',
    you: 'Þú',
    linkedDevice: 'Samstillt við símann þeirra',
    onThisPhone: 'Haldið uppfærðu í þessum síma',
  },
  tags: {
    label: 'Merki',
    new: 'Nýtt',
    newPlaceholder: 'Heiti á merki',
    settingsTitle: 'Merki',
    settingsHint:
      'Sameiginleg með öllum sem þú ert tengd(ur) við; breytt heiti fylgir öllum verkefnunum',
    empty: 'Engin merki enn. Bættu einu við frá verkefni.',
    removeTitle: (name: string) => `Fjarlægja „${name}“?`,
    removeBody: 'Verkefnin halda öllu öðru.',
    filterAll: 'Öll merki',
    more: (n: number) => `+${n}`,
  },
  energyBalance: {
    title: 'Sameiginlegt álag',
    day: 'Í dag',
    week: 'Þessa viku',
    projected: (left: number, capacity: number) => `${left} / ${capacity}`,
    tasksOnly: 'Aðeins verkefni — venjurnar þeirra eru í þeirra eigin síma',
    lopsided: (name: string) => `${name} ber mest af þessu. Að færa eitt atriði myndi jafna það.`,
    shared: 'Þetta lítur út fyrir að skiptast jafnt.',
  },
  rotation: {
    label: 'Skiptast á',
    off: 'Slökkt',
    daily: 'Daglega',
    weekly: 'Vikulega',
    monthly: 'Mánaðarlega',
    rosterLabel: 'Í þessari röð',
    /* Colon rather than a possessive: "röðin er komin að X" wants the dative. */
    turn: (name: string) => `Röðin: ${name}`,
    turnYou: 'Komið að þér',
    needsTwo: 'Veldu að minnsta kosti tvær manneskjur til að hægt sé að skiptast á.',
    unassigned: 'Hver sem er',
  },
  habitCategories: {
    physical: 'Líkamlegt',
    mental: 'Andlegt',
    health: 'Heilsa',
    nutrition: 'Næring',
    sleep: 'Svefn',
    work: 'Vinna',
    wellbeing: 'Vellíðan',
    other: 'Annað',
  },
  sharedTitle: 'Deilt',
  sharedTasks: 'Deild verkefni',
  sharedShopping: 'Deildur innkaupalisti',
  shareSelected: 'Deila völdu',
  shareSendText: 'Senda sem texta',
  shareTitle: 'Deila lista',
  shareInstructions: 'Þeir opna UnFocus → Skanna → „Skanna QR-kóða“',
  shareExplainShopping: 'QR-kóði sem þeir skanna inn á sinn eigin innkaupalista, eða venjulegur texti fyrir hvern sem er',
  shareExplainTasks: 'QR-kóði sem þeir skanna inn í sinn eigin UnFocus, eða venjulegur texti fyrir hvern sem er',
  shareExplainLaterBuild: 'Eitt afrit í bili — rauntímasamstilling kemur síðar',
  scanQrCode: 'Skanna QR-kóða',
  qrScanMode: 'Skanna deildan lista',
  qrScanInstructions: 'Beindu að QR-kóða frá öðrum UnFocus-notanda',
  qrScanSuccess: 'Listi móttekinn!',
  qrScanSuccessBody: (n: number, kind: 'tasks' | 'shopping') =>
    kind === 'tasks'
      ? `${n} ${isCount(n, 'verkefni bættist', 'verkefni bættust')} við deilda listann.`
      : `${n} ${isCount(n, 'vara bættist', 'vörur bættust')} við deilda listann.`,
  qrInvalid: 'Þetta lítur ekki út eins og UnFocus QR-kóði.',
  sharedDone: 'Lokið',
  sharedFromLabel: (name: string) => `Frá: ${name}`,
  sharedBySelf: 'Deilt af þér',
  noSharedItems: 'Ekkert deilt enn — deildu lista eða skannaðu kóða',
  selectAll: 'Velja allt',
  deselectAll: 'Hreinsa val',
  sharedTasksTab: 'Verkefni',
  sharedShoppingTab: 'Innkaup',
  peers: {
    title: 'Pöruð tæki',
    settingsCardDesc: 'Verkefni og innkaup, í takt við paraðan síma á sama Wi-Fi',
    syncToggleLabel: 'Samstilla um Wi-Fi',
    syncUnavailable: 'Ekki í boði í þessari útgáfu enn',
    manageLink: 'Pöruð tæki →',
    noPeers: 'Engin pöruð tæki enn.',
    pairedAt: (date: string) => `Parað ${date}`,
    addDevice: 'Para tæki',
    removeDevice: 'Fjarlægja',
    removeConfirmTitle: 'Fjarlægja þetta tæki?',
    removeConfirmBody: 'Samstillingin hættir. Þú getur parað það aftur síðar.',
    chooseRoleTitle: 'Pörun tækja',
    chooseRoleExplain: 'Sama herbergi, báðir símar. Annar ýtir á „Sýna kóðann minn“, hinn á „Skanna kóða“.',
    showMyCode: 'Sýna kóðann minn',
    scanACode: 'Skanna kóða',
    showCodeInstructions: 'Láttu hinn símann skanna þennan kóða.',
    showCodeNext: 'Næst: skannaðu þeirra kóða',
    showCodeDone: 'Búið',
    scanInstructions: 'Beindu myndavélinni að kóðanum í hinum símanum.',
    pairInvalid: 'Þetta lítur ekki út eins og UnFocus-pörunarkóði.',
    pairedSuccessTitle: 'Parað!',
    /* Colon: "tengd/tengdur við X" would have to agree with the reader's gender. */
    pairedSuccessBody: (name: string) => `Tengingin er komin á: ${name}.`,
  },
  notif: {
    // W-F: vinalegri, streitulaus vikuleg áminning
    weeklyTitle: 'Langar þig að skipuleggja vikuna?',
    weeklyBody: 'Þegar þér hentar, kíktu á hvað er framundan. Enginn asi — þú hefur þetta.',
    monthlyTitle: 'Athugið: mánaðarlistinn núllstillist brátt',
    monthlyBody: 'Mánaðarlistinn þinn tæmist á morgun, svo athugaðu fyrst hvað vantar enn heima.',
    taskStartTitle: (title: string) => `Áminning: ${title}`,
    taskStartBody: 'Kominn tími til að byrja!',
    taskBoxTitle: (title: string) => `Byrjun: ${title}`,
    taskBoxBody: (min: number) => `Þú hefur ${min} ${isCount(min, 'mínútu', 'mínútur')} í þetta. Gangi þér vel!`,
    taskEndTitle: (title: string) => `Búið: ${title}`,
    taskEndBody: (min: number) => `${min} ${isCount(min, 'mínúta liðin', 'mínútur liðnar')}. Vel gert — þú mátt hætta núna.`,
    habitReminderTitle: (title: string) => `Venja: ${title}`,
    habitReminderBody: 'Lítil áminning fyrir daginn í dag.',
    overviewTitle: 'Yfirlit dagsins',
    overviewBodyNoTasks: 'Engin verkefni eftir í dag',
    overviewNothingElse: 'Ekkert fleira á dagskrá í dag',
    overviewUpcomingCount: (count: number) => `+${count} í viðbót í dag`,
    actionDone: 'Búið',
    actionRemindLater: 'Minna mig á seinna',
    renudgeTitle: (title: string) => `Enn þarna: ${title}`,
    renudgeBody: 'Enginn asi — bara mild áminning þegar þú ert til.',
    actionTaken: 'Tekið',
    medicineTrayTitle: (tray: string) => `Lyf — ${tray.toLowerCase()}`,
    medicineTrayMore: (n: number) => `+${n} í viðbót`,
    medicineSnoozeBody: 'Það bíður hérna þangað til þú kemst í það.',
  },
  // Merkingar á græjum á heimaskjá símans (Android).
  widgets: {
    shoppingTitle: 'Innkaup',
    tasksTitle: 'Verkefni dagsins',
    itemsLeft: (n: number) => `${n} ${isCount(n, 'vara', 'vörur')} eftir`,
    tasksLeft: (n: number) => `${n} verkefni eftir`,
    allDone: 'Allt búið 🎉',
    noItems: 'Listinn er tómur',
    noTasks: 'Ekkert á dagskrá í dag',
    more: (n: number) => `+${n} í viðbót`,
    notesTitle: 'Minnispunktar',
    noNotes: 'Engir minnispunktar enn',
    voiceNote: 'Talupptaka',
    habitsTitle: 'Venjur',
    habitsLeft: (n: number) => `${n} ${isCount(n, 'venja', 'venjur')} eftir`,
    healthTitle: 'Heilsa',
    healthOngoing: (n: number) => `${n} í gangi`,
    // "lyf" is neuter with one form for both numbers, so it needs no isCount.
    medicineDue: (n: number) => `${n} lyf eftir`,
    trayProgress: (taken: number, total: number) => `${taken} af ${total}`,
  },
  nav: {
    newTask: 'Nýtt', plans: 'Verkefni', shop: 'Innkaup', habits: 'Venjur',
    meals: 'Matur', health: 'Heilsa', scan: 'Skanna', settings: 'Still.',
    capture: 'Skrá', home: 'Heim', budget: 'Fjárhagur', automations: 'Sjálfvirkni',
    shared: 'Deilt', settingsLabel: 'Stillingar',
  },
  home: {
    todaysPlans: 'Verkefni dagsins',
    seeAllPlans: 'Sjá öll verkefni',
    more: 'Meira',
    quantityLabel: 'Fjöldi',
    weeklyListChip: 'Þessa viku',
    addToListLabel: 'Setja í',
    extraInfoPlaceholder: 'Nánar…',
    extraInfoLabel: 'Nánar',
    manageCards: {
      edit: 'Breyta kortum',
      done: 'Búið',
      add: 'Bæta við korti',
      remove: (label: string) => `Fjarlægja: ${label}`,
      kinds: { notes: 'Minnispunktar', plans: 'Verkefni', shopping: 'Innkaupalisti', habits: 'Venjur', goals: 'Markmið' },
    },
    cardMenu: {
      open: (card: string) => `Stillingar korts: ${card}`,
      subtitle: 'Stillingar fyrir þetta kort',
      close: 'Búið',
      hide: 'Fela þetta kort',
      hideHint: 'Það er áfram á sínum eigin skjá — ekkert er fjarlægt',
      hideLastHint: 'Heim heldur að minnsta kosti einu korti',
      arrangeHint: 'Haltu á korti til að draga það upp eða niður',
    },
  },
  health: {
    habits: 'Venjur',
    seeAllHabits: 'Sjá allar venjur',
    noHabits: 'Engar venjur enn',
    addHabit: 'Bæta við venju',
  },
  shopping: {
    scan: 'Skanna',
    budget: 'Fjárhagur',
  },
  shoppingWeekPrev: 'Fyrri vika',
  shoppingWeekNext: 'Næsta vika',
  inStockLabel: 'Til á lager',
  priceTotal: (total: string) => `${total} samtals`,
  shoppingItemSheet: {
    quantity: 'Hversu mikið',
    quantityPlaceholder: 't.d. 2, eða „eitt búnt“',
    name: 'Heiti',
    unit: 'Eining',
    unitPlaceholder: 'kg, L, pk…',
    price: 'Verð á stk',
    category: 'Hvar í búðinni',
    done: 'Búið',
  },
  suggestions: 'Tillögur',
  mealTypes: { breakfast: 'Morgunmatur', lunch: 'Hádegismatur', dinner: 'Kvöldmatur', snack: 'Snarl', kveldsmat: 'Kvöldhressing' },
  mealDifficulty: { easy: 'Einfalt', normal: 'Venjulegt' },
  dishDifficultyPickerLabel: 'Hversu flókið',
  newDishTrigger: '+ Nýr réttur',
  dishNamePlaceholder: 'Heiti réttar',
  ingredientsCount: (n: number) => `${n} stk`,
  ingredientPlaceholder: 'Hráefni',
  ingredientQuantityLabel: 'Magn',
  editIngredientLabel: (name: string) => `Breyta: ${name}`,
  addDishSheetTitle: 'Setja rétt á mánaðarlistann',
  noDishesAvailable: 'Engir vistaðir réttir enn — bættu einum við á Matar-síðunni fyrst.',
  addDishBtn: 'Bæta við rétti',
  deleteDish: 'Eyða rétti',
  duplicateDishBtn: 'Afrita rétt',
  dishCopySuffix: ' (afrit)',
  healthTitle: 'Heilsa',
  thisWeekLabel: 'Þessa viku',
  quickLogLabel: 'Fljótskráning',
  healthLogTitle: 'Heilsuskrá',
  logSymptomTrigger: 'Hvað er að angra þig?',
  ailmentLabel: 'Einkenni',
  severityLabel: 'Hversu slæmt',
  notesLabel: 'Athugasemd',
  notesPlaceholder: 'Einhverjar athugasemdir…',
  severityLabels: ['Vægt', 'Lítið', 'Miðlungs', 'Mikið', 'Alvarlegt'],
  whenStartedLabel: 'Hvenær byrjaði',
  whenFinishedLabel: 'Hvenær hætti',
  episodes: {
    ongoing: 'Í gangi',
    stillGoing: 'Enn í gangi',
    itsOver: 'Það er búið',
    stillGoingPrompt: (symptom: string) => `${symptom} — er þetta enn í gangi?`,
    whenDidItStop: 'Hvenær hætti það?',
    didAnythingHelp: 'Hjálpaði eitthvað?',
    seeAllOpen: 'Sjá allt',
    when: {
      justNow: 'Rétt í þessu',
      thisMorning: 'Í morgun',
      lastNight: 'Í gærkvöldi',
      pickTime: 'Velja tíma',
    },
    duration: {
      underHour: 'Innan við klukkustund',
      aboutAnHour: 'Um klukkustund',
      hours: (n: number) => `Um ${n} ${isCount(n, 'klukkustund', 'klukkustundir')}`,
      mostOfADay: 'Mestallan daginn',
      aboutADay: 'Um sólarhring',
      days: (n: number) => `Um ${n} ${isCount(n, 'sólarhring', 'sólarhringa')}`,
    },
  },
  newHealthEntryTitle: 'Ný færsla',
  editHealthEntryTitle: 'Breyta færslu',
  unnamedIssue: 'Án heitis',
  healthIssues: {
    title: 'Heilsuvandi',
    openLabel: 'Opna heilsuvanda',
    subtitle: 'Það sem þú fylgist með.',
    emptyList: 'Ekkert hér enn — það sem þú skráir birtist hér',
    newPlaceholder: 'Eitthvað til að fylgjast með',
    entryCount: (n: number) => `${n} ${isCount(n, 'færsla', 'færslur')}`,
    lastLogged: (days: number) =>
      days === 0 ? 'Skráð í dag' : days === 1 ? 'Síðast skráð í gær' : `Síðast skráð fyrir ${days} dögum`,
    untrackLabel: 'Hætta að fylgjast með',
    untrackConfirmTitle: (name: string) => `Hætta að fylgjast með „${name}“?`,
    untrackConfirmBody: 'Hverfur af þessum lista. Allt sem þú hefur skráð verður áfram í heilsuskránni.',
    close: 'Búið',
    typePrompt: 'Skrá eitthvað',
    logAgain: (name: string) => `Skrá aftur: ${name}`,
    timesThisWeek: (n: number) => `${n}×`,
  },
  noLogsGentle: 'Engar færslur enn — skráðu hvernig þér líður þegar þú ert til.',
  deleteLogBtn: 'Eyða færslu',
  symptomSearchPlaceholder: 'Leitaðu að eða bættu við einkenni…',
  addSymptomOption: (name: string) => `Bæta við „${name}“`,
  symptomHistoryTitle: (name: string) => `${name} — saga`,
  symptomEntriesCount: (n: number) => `${n} ${isCount(n, 'færsla', 'færslur')}`,
  last90Days: 'Síðustu 90 dagar',
  symptomCategories: {
    physical: 'Líkamlegt',
    mental: 'Andlegt',
    sleep: 'Svefn',
    digestive: 'Melting',
    nutrition: 'Næring',
    other: 'Annað',
  } as Record<string, string>,
  cover: {
    tasksToday: 'Í dag',
    taskCount: (n: number) => `${n} verkefni`,
    noTasks: 'Allt klárt!',
    quickAdd: '+ Bæta við',
    habitsToday: 'Venjur',
    habitsSummary: (done: number, total: number) => `${done}/${total} búið`,
    moreTasksHint: (n: number) => `+${n} í viðbót`,
  },
  // Tillögur um það sem aðrir hafa deilt (components/SharedRequestsSection.tsx)
  sharedRequests: {
    sectionTitle: 'Deilt með þér',
    fromLabel: (name: string) => (name ? `${name}:` : ''),
    accept: 'Bæta við',
    dismiss: 'Hafna',
  },
  // AP-06B — kvittanir + mánaðarleg innkaupaáætlun (app/budget.tsx)
  budget: {
    title: 'Fjárhagur',
    titleForList: (listName: string) => `${listName} — Fjárhagur`,
    spentOfBudget: (spent: string, budget: string) => `${spent} kr af ${budget} kr í þessum mánuði`,
    overBudgetHint: 'Aðeins yfir í þessum mánuði — hér fóru peningarnir.',
    onTrackHint: 'Alveg á áætlun í þessum mánuði.',
    noBudgetSet: 'Settu mánaðaráætlun í stillingum til að bera saman',
    receiptsTitle: 'Kvittanir í þessum mánuði',
    noReceipts: 'Engar kvittanir í þessum mánuði enn.',
    olderMonth: '← Eldra',
    newerMonth: 'Nýrra →',
    editBudget: 'Breyta áætlun',
    setBudget: 'Setja áætlun',
    perStore: 'Eftir verslunum',
    editorTitle: 'Setja áætlun',
    monthlyBudgetLabel: 'Mánaðarleg áætlun (NOK)',
    perDaySpend: (actual: string, budget: string) => `${actual} kr/dag hingað til · ${budget} kr/dag í áætlun`,
    overPaceHint: 'Aðeins yfir daghraðanum þínum',
    onPaceHint: 'Vel innan daghraðans þíns.',
  },
  // Minnispunktar — sjálfstæðir punktar með flýtihnöppum á innkaupalista/verkefni (app/notes.tsx)
  notes: {
    title: 'Minnispunktar',
    navLabel: 'Minnispunktar',
    emptyState: 'Skrifaðu á fyrstu línuna, eða ýttu á hljóðnemann',
    addNote: 'Bæta við minnispunkti',
    headerPlaceholder: 'Heiti minnispunkts',
    bodyPlaceholder: 'Bættu við nánari lýsingu…',
    addToShoppingLabel: 'Setja á innkaupalista',
    addToPlansLabel: 'Búa til verkefni',
    deleteNote: 'Eyða minnispunkti',
    shoppingQuickAddTitle: 'Setja á innkaupalista',
    activeLabel: 'Virkir',
    checkedLabel: 'Afgreiddir',
    recordVoiceNote: 'Taka upp talpunkt',
    stopRecording: 'Stöðva upptöku',
    micPermissionBody: 'Talpunktur þarf aðgang að hljóðnema.',
    micErrorBody: 'Náði þessu ekki — reyndu aftur.',
  },
  hints: {
    home: { text: 'Haltu á korti til að færa það.' },
    taskForm: { text: 'Bættu við verkefni með heiti, dagsetningu og valfrjálsum atriðum.' },
    habitForm: { text: 'Hversu oft hún endurtekst og hversu oft á dag hún telur.' },
    medicineForm: { text: 'Veldu hólf, eða settu lyfið á „eftir þörfum“.' },
    shopping: { text: 'Bættu við þegar eitthvað klárast. Núllstillist vikulega.' },
    meals: { text: 'Flettu í gegnum rétti og settu hráefnin á innkaupalistann.' },
    health: { text: 'Skráðu heilsuvanda og fylgdu honum eftir yfir tíma.' },
    scan: { text: 'Mynd af kvittun til að bæta við vörum, eða skannaðu deildan QR-kóða.' },
    settings: { text: 'Breytingar taka gildi strax.' },
    shared: { text: 'Deilt með þér — merktu þinn hluta sem búinn.' },
    habits: { text: 'Ýttu til að telja, tannhjólið til að stilla.' },
    plans: { text: 'Allt sem á að gera, eftir degi og viku.' },
    automations: { text: 'Einfaldar reglur: þegar X gerist, gerðu Y sjálfkrafa.' },
    notes: { text: 'Skrifaðu það niður. Sendu það áfram.' },
    goals: { text: 'Það stærra sem verkefnin og venjurnar þínar eru fyrir.' },
  },
  /* Sjá enska tvíburann. Línurnar sjálfar eru í lib/narratorQuotes.ts. */
  narrator: {
    nextQuote: 'Sýna aðra línu',
  },
  starters: {
    addExample: 'Bæta við',
    dismiss: 'Loka',
    expandExamples: 'Sýna tillögur',
    collapseExamples: 'Fela tillögur',
    /* Sjá enska tvíburann: eitt orð, það sama á öllum flötum (2026-08-19). */
    suggestionsLabel: 'Tillögur',
    habits: {
      suggestions: {
        water: 'Drekka 4 glös af vatni',
        stretch: 'Morgunteygjur',
        posture: 'Athuga stöðuna',
        breakfast: 'Borða morgunmat',
      },
    },
    plans: {
      text: 'Skiptu því í minni bita.',
      exampleTitle: 'Taka til',
      exampleSteps: {
        trash: 'Henda rusli',
        tidy: 'Taka til',
        table: 'Þurrka af borðum',
        dishwasher: 'Uppþvottavél',
        laundry: 'Þvottavél',
      },
    },
    shopping: {
      text: 'Bættu við vörum þegar þær klárast.',
      textWeekly: 'Vikulegur listi fyrir matvöru.',
      textMonthly: 'Mánaðarlisti fyrir það sem heimilið þarf.',
    },
    health: {
      exampleTitle: 'Höfuðverkur',
    },
    /* Sjá enska tvíburann: kennsluástand orkuræmunnar (2026-08-03). */
    energy: {
      action: 'Stilla orku dagsins',
    },
    goals: {
      text: 'Það sem verkefnin og venjurnar þínar stefna öll að.',
      suggestions: {
        rested: 'Verða úthvíldari',
        /* These draw as one-line rows — keep them short, like the English twins. */
        moving: 'Hreyfa mig daglega',
        cutBack: 'Minni tími í símanum',
        together: 'Meiri tími saman',
      },
    },
  },
  medicine: {
    title: 'Lyf',
    trays: {
      morning: 'Morgunn',
      midday: 'Miðdegi',
      evening: 'Kvöld',
      night: 'Nótt',
    },
    addPlaceholder: 'Bæta við lyfi',
    stillDue: (tray: string) => `Eftir: ${tray}`,
    nextUp: (tray: string, time: string) => `Næst: ${tray} kl. ${time}`,
    allTaken: 'Allt tekið í dag',
    takenAt: (time: string) => `Tekið ${time}`,
    markTaken: (name: string) => `Merkja sem tekið: ${name}`,
    undoTaken: (name: string) => `Afturkalla: ${name}`,
    trayProgress: (taken: number, total: number) => `${taken}/${total}`,
    asNeededLabel: 'Eftir þörfum',
    asNeededReady: 'Má taka núna',
    asNeededWait: (time: string) => `Í fyrsta lagi aftur ${time}`,
    asNeededLimit: 'Hámarki dagsins náð',
    asNeededTakenToday: (n: number) => `${n} í dag`,
    logDose: (name: string) => `Skrá skammt: ${name}`,
    remindersTitle: 'Tímar áminninga',
    remindersToggle: 'Minna mig á fyrir hvert hólf',
    remindersOffHint: 'Kortið virkar áfram — þú færð bara ekki áminningu.',
    remindersQuietHint: 'Hólfi sem lendir á hljóðláta tímanum er sleppt, því er ekki flýtt eða frestað.',
    forMe: 'Mig',
    formTitleNew: 'Nýtt lyf',
    formTitleEdit: 'Lyf',
    nameLabel: 'Heiti',
    namePlaceholder: 'T.d. Elvanse',
    doseLabel: 'Skammtur',
    dosePlaceholder: 'T.d. 30 mg',
    traysLabel: 'Hvenær á að taka það',
    traysHint: 'Veldu eitt eða fleiri — hólf er tímabil, ekki frestur',
    asNeededSwitch: 'Taka eftir þörfum í staðinn',
    asNeededHint: 'Ekkert hólf og engin áminning, bara lágmarksbil',
    minIntervalLabel: 'Minnsta hlé milli skammta',
    minIntervalPlaceholder: 'mínútur',
    minIntervalNone: 'Ekkert lágmarkshlé',
    gapHours: (n: number) => `${n} klst`,
    traysRequired: 'Veldu að minnsta kosti eitt hólf, eða settu lyfið á „eftir þörfum“.',
    maxPerDayLabel: 'Hámark á dag',
    maxPerDayPlaceholder: '0 = engin mörk',
    personLabel: 'Fyrir',
    notesLabel: 'Athugasemd',
    notesPlaceholder: 'Eitthvað sem er þess virði að muna',
    activeLabel: 'Tek þetta núna',
    inactiveHint: 'Slökkt: helst í sögunni, hverfur af kortinu',
    takenRecently: (days: number) => `Tekið ${days} af síðustu 7 dögum`,
    takenNeverRecently: 'Engir skammtar skráðir síðustu 7 daga',
    deleteConfirm: 'Eyða þessu lyfi og skammtasögunni?',
    sideEffectsLabel: 'Skráð samhliða þessu',
    sideEffectsEmpty: 'Ekkert skráð á þetta enn.',
    logSideEffect: 'Skrá eitthvað sem það olli',
    attributionLabel: 'Gæti komið frá',
    attributionNone: 'Óvíst',
  },
  debug: {
    toggleLabel: 'Villuleitarhamur',
    toggleHint: 'Skildu eftir athugasemdir á kortum og fyrirsögnum handa forritaranum',
    howToUse: 'Ýttu á kort eða titil skjásins til að skrifa athugasemd þar.\n• Bóla merkir kort sem er þegar með eina — ýttu á hana til að breyta.\n• „Bæta við almennum punkti“ neðst á skjánum fyrir allt annað.\n• Hnappar gera ekki sitt venjulega verk meðan kveikt er á þessu.\n• Í efstu valmyndinni: paddan slekkur, hakið sendir punktana í tölvupósti, rauði hringurinn eyðir þeim.',
    editNote: 'Breyta athugasemd',
    noteForLabel: (label: string) => `Athugasemd — ${label}`,
    addNote: 'Bæta við villuleitarpunkti',
    generalNote: 'Bæta við almennum punkti',
    composerPlaceholder: 'Hvað ertu að hugsa?',
    exportNotes: 'Flytja út',
    emailNotes: 'Senda punkta',
    deleteAllNotes: 'Eyða öllum punktum',
    mailSubject: 'UnFocus villuleitarpunktar',
    exportHeading: (date: string) => `UnFocus villuleitarpunktar — ${date}`,
    resetNotes: 'Núllstilla alla punkta',
    saveAndSend: 'Vista og senda',
  },
  designLab: {
    title: 'Hönnunarstofa',
    linkLabel: 'Hönnunarstofa',
    toggleHint: 'Vinnubekkur fyrir útlit appsins',
    intro: 'Ekki stilling — skilaboð um hvað þú vilt',
    applyLabel: 'Nota þetta alls staðar',
    applyHint: 'Slökkt: aðeins þessi skjár. Kveikt: allt appið',
    reset: 'Setja allt til baka',
    resetConfirm: 'setja allt til baka',
    exportLabel: 'Senda þetta',
    saveLabel: 'Vista í tækinu',
    exportEmpty: 'Engu hefur verið breytt enn.',
    exportShared: 'Sent.',
    exportUnavailable: 'Deiling er ekki í boði í þessu tæki.',
    exportFailed: 'Ekki tókst að deila þessu.',
    savedTo: (where: string) => `Vistað: ${where}`,
    noteLabel: 'Hverju varstu að leita að?',
    notePlaceholder: 'Hvað leit rangt út, og hvað vildirðu í staðinn',
    changeCount: (n: number) => `${n} ${isCount(n, 'breyting', 'breytingar')}`,
    modeNote: 'Ljóst og dökkt hafa hvort sína liti',
    groups: {
      slots: 'Hvað stendur hvar',
    },
    colorGroups: {
      surfaces: 'Síður og kort',
      text: 'Texti',
      borders: 'Kantar',
      accent: 'Aðalliturinn',
      semantic: 'Gott, slæmt, varúð',
      hint: 'Skýringarkort',
      screens: 'Einn litur á hvern skjá',
      identity: 'Kortmerki',
    },
    shape: {
      radiusScale: 'Hversu ávalt',
      spacingScale: 'Hversu mikið pláss',
      borderScale: 'Hversu þykkir kantarnir eru',
      borderCardWidth: 'Kantur korts',
      borderFieldWidth: 'Kantur reits og línu',
      borderButtonWidth: 'Kantur hnapps',
      borderRampStrength: 'Hversu mikið kantur dofnar',
      rowHeight: 'Hæð línu',
      minTapTarget: 'Minnsta snertisvæði',
      fontScale: 'Leturstærð',
      cardElevation: 'Hversu hátt kort lyftist',
    },
    controls: {
      boolean: 'Já eða nei',
      choice: 'Veldu eitt',
      number: 'Tala',
      time: 'Klukkan hvað',
      rowShape: 'Hvernig línur skiljast að',
      check: 'Hakið',
      button: 'Hnappar',
    },
    controlHints: {
      boolean: 'Hver af/á-lína í stillingunum og í öllum breytingaskjám.',
      choice: 'Útlit, leturstærð, uppsetning — hver veldu-eitt-lína.',
      number: 'Orka, fjöldi, dagsmarkmið, rými.',
      time: 'Áminningar, lyfjahólf, byrjun og lok verkefna.',
      rowShape: 'Hvernig ein lína skilst frá þeirri næstu.',
      check: 'Lokið-stýringin á línunni.',
      button: 'Aðalaðgerðin á hverjum skjá.',
    },
    slots: {
      'row.leading': 'Á undan heitinu',
      'row.meta': 'Línan undir heitinu',
      'row.right': 'Gildið til hægri',
      'row.action': 'Hnappur línunnar',
    },
    slotsNote: 'Á raunverulegum skjám geta þessi aðeins falið stað',
    idNote: 'Stuttu orðin hér að neðan eru heitin sem notuð eru í skránni sem þú sendir',
    changedTag: 'Breytt',
    tabs: { card: 'Kort', color: 'Litur', shape: 'Form', controls: 'Stýringar' },
    whichCard: 'Hvaða kort',
    preview: {
      collapse: 'Sýna minna af kortinu',
      light: 'Sýna það ljóst',
      dark: 'Sýna það dökkt',
      edit: 'Breyta kortinu',
    },
    editingPart: (name: string) => `Breyti: ${name}`,
    selectHint: 'Ýttu til að breyta, haltu og dragðu til að færa',
    addNamed: (name: string) => `Bæta við: ${name.toLowerCase()}`,
    cardEmpty: 'Þetta kort er tómt. Bættu hluta við hér að neðan.',
    cardNoteLabel: 'Hvað viltu fá út úr þessu korti?',
    cardNotePlaceholder: 'Með þínum eigin orðum.',
    addPart: 'Bæta einhverju við',
    partsTitle: 'Úr hverju það er',
    partsHint: 'Haltu og dragðu til að raða, ýttu til að breyta',
    removePart: 'Taka hann burt',
    restoreCard: 'Setja þetta kort til baka',
    addedTag: 'Bætt við',
    cards: {
      generic: 'Venjulegt listakort',
      todo: 'Verkefni',
      habit: 'Venja',
      shopping: 'Innkaupalína',
      medicine: 'Lyfjahólf',
      note: 'Minnispunktur',
      dish: 'Réttur',
      homeToDo: 'Verkefnakortið á Heim',
      homeHabits: 'Venjukortið á Heim',
      homeShopping: 'Innkaupakortið á Heim',
      homeNotes: 'Minnispunktakortið á Heim',
    },
    parts: {
      text: 'Texti',
      value: 'Gildi',
      count: 'Talning',
      price: 'Verð',
      time: 'Klukkan hvað',
      button: 'Hnappur',
      slider: 'Sleði',
      toggle: 'Af/á-rofi',
      checkbox: 'Hak',
      stepper: '− / + -par',
      segmented: 'Veldu-eitt-lína',
      chips: 'Litlar flísar',
      field: 'Eitthvað til að skrifa í',
      timeField: 'Klukkan hvað, innslegið',
      icon: 'Tákn',
      badge: 'Lítið merki',
      chip: 'Flís',
      personChip: 'Hver á það',
      dot: 'Punktur',
      progress: 'Framvindulína',
      divider: 'Skilalína',
    },
    partSample: {
      text: 'Nokkur orð',
      value: '2 kg',
      count: '3/6',
      price: '49',
      time: '09:30',
      button: 'Gerðu það',
      slider: 'Hversu mikið',
      toggle: 'Af eða á',
      checkbox: 'Búið',
      stepper: 'Hversu mörg',
      segmented: 'Veldu eitt',
      chips: 'Flísar',
      field: 'Skrifaðu hér',
      timeField: '08:00',
      icon: 'Tákn',
      badge: 'Merki',
      chip: 'Flís',
      personChip: 'Alex',
      dot: 'Punktur',
      progress: 'Hversu langt',
      divider: 'Lína',
    },
    partGroups: { words: 'Orð', controls: 'Stýringar', marks: 'Merki' },
    partSlots: {
      header: 'Fyrirsögn kortsins',
      leading: 'Á undan heitinu',
      title: 'Heitið',
      meta: 'Línan undir heitinu',
      right: 'Gildið til hægri',
      action: 'Hnappurinn á línunni',
      check: 'Hakið',
      trailing: 'Í stað haksins',
      body: 'Inni í kortinu',
      footer: 'Neðst',
    },
    partEditor: {
      whatItSays: 'Hvað stendur þar',
      whatItSaysPlaceholder: 'Skildu eftir autt fyrir dæmið',
      colour: 'Litur',
      inherited: 'Eins og hann kemur',
      moreColours: 'Fleiri…',
      size: 'Hversu stórt',
      weight: 'Hversu þungt',
      where: 'Hvar það situr',
      row: 'Hvaða lína',
      width: 'Hversu breitt',
      spans: ['Fjórðungur', 'Hálf', 'Þrír fjórðu', 'Öll línan'],
      sizes: { xs: 'Örsmátt', sm: 'Lítið', md: 'Venjulegt', lg: 'Stórt' },
      weights: { regular: 'Venjulegt', semibold: 'Þyngra', bold: 'Þyngst' },
    },
    color: {
      pick: 'Veldu lit',
      tune: 'Stilltu hann',
      hue: 'Litur',
      saturation: 'Hversu sterkur',
      lightness: 'Hversu ljós',
      hex: 'Litkóði',
      putBack: 'Setja þennan til baka',
      close: 'Búið',
      was: (hex: string) => `Var ${hex}`,
    },
    sample: {
      primary: 'Aðalaðgerð',
      secondary: 'Önnur aðgerð',
      fieldLabel: 'Textareitur',
      fieldPlaceholder: 'Skrifaðu hér',
      toggleLabel: 'Já-eða-nei-stilling',
      choiceLabel: 'Veldu-eitt-stilling',
      numberLabel: 'Tala',
    },
    tokensTitle: 'Litir og form',
    tokensHint: 'Ef þú breytir einu hér breytist það alls staðar',
    playground: {
      build: 'Byggja',
      use: 'Prófa það',
      addCard: 'Bæta við korti',
      emptyScreen: 'Ekkert hér enn — bættu korti við hér að neðan',
      cardName: 'Hvað er þetta kort',
      cardNamePlaceholder: 'Skildu eftir autt, þá hefur það ekkert nafn',
      duplicateCard: 'Búa til afrit',
      removeCard: 'Taka þetta kort burt',
      startFromReal: 'Eða byrjaðu á einu af kortum appsins sjálfs',
      starters: {
        blank: 'Tómt kort',
        row: 'Lína með haki',
        heading: 'Kort með fyrirsögn',
      },
      starterHints: {
        blank: 'Tómt — settu hvað sem er á það',
        row: 'Ein lína með heiti og einhverju til að haka við.',
        heading: 'Fyrirsögn til að setja hluti undir.',
      },
      screenCap: 'Svona mörgum skjáum er pláss fyrir.',
      cardCap: 'Svona mörgum kortum er pláss fyrir á þessum skjá.',
      partCap: 'Svona miklu er pláss fyrir á einu korti.',
    },
  },
  permissions: {
    sectionTitle: 'Eiginleikar tækis',
    voiceNotes: { label: 'Talinnsláttur', hint: 'Lestu heiti verkefnis inn með röddinni.' },
    contacts: { label: 'Tengiliðir', hint: 'Bættu tengilið við verkefni.' },
    location: { label: 'Staðsetning', hint: 'Merktu verkefni með staðsetningunni þinni.' },
    calendar: { label: 'Samstilling við dagatal', hint: 'Speglaðu tímasett verkefni í dagatal tækisins.' },
  },
  feedback: {
    cardTitle: 'Senda ábendingu',
    cardDesc: 'Skrifaðu það hér að neðan — það opnar tölvupóstforritið þitt, stílað á forritarann',
    placeholder: 'Hvað ertu að hugsa?',
    sendButton: 'Senda ábendingu',
    subject: 'UnFocus ábending',
    mailUnavailable: 'Ekkert tölvupóstforrit í þessu tæki.',
  },
};

export type Translations = typeof en;

/**
 * Non-hook accessor for the translation dictionary. Use this outside of React
 * components (stores, schedulers) where `useT` cannot run. Pass an explicit
 * language, or omit it to read the current one from the settings store.
 */
const DICTIONARIES: Record<Lang, Translations> = {
  en,
  no: no as Translations,
  is: is as Translations,
};

export function getTranslations(lang?: Lang): Translations {
  const resolved = lang ?? useSettingsStore.getState().language;
  // Norwegian-first fallback for a stored value this build doesn't know (matches the
  // settings store's readEnum default and lib/db's migration).
  return DICTIONARIES[resolved] ?? DICTIONARIES.no;
}

export function useT(): Translations {
  const lang = useSettingsStore((s) => s.language);
  return getTranslations(lang);
}

/**
 * The active language CODE, for a consumer whose strings live outside the dictionaries
 * (2026-08-19). There is exactly one: components/NarratorQuote.tsx, whose lines are a
 * per-language data table in lib/narratorQuotes.ts rather than i18n keys — because they are a
 * *list* the user cycles through, and a numbered `quote1`/`quote2`/`quote3` family in three
 * dictionaries is a shape that cannot grow without editing three places in lockstep.
 *
 * Subscribes the same way useT() does, so a language change re-renders the caller. **Not a
 * general-purpose escape hatch**: if you are reaching for this to pick a string, the string
 * belongs in the dictionaries.
 */
export function useLang(): Lang {
  return useSettingsStore((s) => s.language);
}
