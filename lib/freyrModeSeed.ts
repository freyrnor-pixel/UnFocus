/**
 * freyrModeSeed.ts — seed/unseed the "Freyr-mode" starter data set.
 *
 * "Freyr-mode" is a settings toggle (Additional modes tab) that one-shot creates a
 * fixed starter set of rows across four stores (monthly shopping catalog, tasks,
 * habits, notes) plus three Energy-system settings (energySystemEnabled,
 * energyDailyCapacity, monthlyBudgetNok), and, when turned back off, removes exactly
 * those rows and restores exactly those settings — never anything the user added or
 * changed themselves. The ids created by seedFreyrMode() (and the settings values it
 * overwrote) must be persisted (useSettingsStore's freyrSeedIds) and passed back into
 * unseedFreyrMode() on disable; app/settings.tsx owns that read/write.
 *
 * Connections:
 *   Imports → lib/date, store/useHabitStore, store/useNotesStore, store/useShoppingStore,
 *             store/useMonthlyListStore, store/useTaskStore, store/useSettingsStore
 *   Used by → app/settings.tsx
 *   Data    → writes shopping_items (status='catalog', list_type='monthly'), tasks, habits, notes
 *     via each store's own add()/update()/remove() — no direct SQL here. Also overwrites
 *     (and restores) settings.energySystemEnabled/energyDailyCapacity, and the seeded
 *     Monthly list's own budgetNok (store/useMonthlyListStore.ts — see the 2026-07-22 note
 *     below; budget is per-list now, not a settings field).
 *
 * Edit notes:
 *   - Item/task/note/habit text is Norwegian and NOT translated, matching lib/catalogSeed.ts's
 *     precedent (only UI chrome follows the user's language; seeded content doesn't).
 *   - useHabitStore.add() doesn't return the created row, unlike the other three
 *     stores' add(). addHabitAndCaptureId() diffs the habit list before/after to
 *     recover the new id — don't call this seed function concurrently with anything
 *     else that adds a habit, or the diff could pick up the wrong row.
 *   - This is Freyr's actual personal routine (2026-07-22), not placeholder content —
 *     see the "Freyr-mode" task description for the source spec. Energy values follow
 *     lib/energy.ts's signed convention (positive restores, negative drains); weekday
 *     numbers follow the app-wide 0=Mon…6=Sun convention (lib/taskRecurrence.ts).
 *   - "Gå ut med Eyja" ("at least 3x/week, any day") is a `weekly-flexible` HABIT, not
 *     a Task — that recurrence mode (lib/habitRecurrence.ts) is exactly "N times this
 *     week, no fixed days," so it doesn't need pinning to arbitrary weekdays like the
 *     Task-based items above.
 *   - **Shopping — Monthly redesign (2026-07-22, merged same day)**: seeded catalog items
 *     are tagged onto the first Monthly list (`useMonthlyListStore`'s `lists[0]`) so they
 *     actually show up on a card — without a monthlyListId they'd be silently orphaned
 *     (invisible in every list). The "10 000 NOK" demo budget is likewise set on THAT
 *     list's own budgetNok (not a global settings field any more — budget is per list) via
 *     `monthlyBudget: {listId, prevBudgetNok}`, restored on unseed. Both fall back to a
 *     no-op only if the user has deleted every Monthly list before enabling Freyr-mode.
 */
import { todayStr } from '@/lib/date';
import { useHabitStore, Habit } from '@/store/useHabitStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export type FreyrSeedIds = {
  shoppingItemIds: string[];
  taskIds: string[];
  habitIds: string[];
  noteIds: string[];
  /** Settings values overwritten by seedFreyrMode(), to restore on unseed. Null until first seeded. */
  prevSettings: { energySystemEnabled: boolean; energyDailyCapacity: number } | null;
  /** The Monthly list seedFreyrMode() set a demo budget on, and what it was before —
   *  null if there was no Monthly list to tag at seed time (nothing to restore). */
  monthlyBudget: { listId: string; prevBudgetNok: number } | null;
};

export const EMPTY_FREYR_SEED_IDS: FreyrSeedIds = {
  shoppingItemIds: [],
  taskIds: [],
  habitIds: [],
  noteIds: [],
  prevSettings: null,
  monthlyBudget: null,
};

export function parseFreyrSeedIds(json: string): FreyrSeedIds {
  if (!json) return EMPTY_FREYR_SEED_IDS;
  try {
    return { ...EMPTY_FREYR_SEED_IDS, ...JSON.parse(json) };
  } catch {
    return EMPTY_FREYR_SEED_IDS;
  }
}

/** Every-2-hours reminder times from 08:00 through 20:00 inclusive. */
function waterReminderTimes(): string[] {
  const times: string[] = [];
  for (let h = 8; h <= 20; h += 2) times.push(`${String(h).padStart(2, '0')}:00`);
  return times;
}

// Weekday numbers (0=Mon…6=Sun) — matches taskOccursOn/habit recurrenceDays app-wide.
const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;
const WEEKDAYS = [MON, TUE, WED, THU, FRI];
const WEEKEND = [SAT, SUN];

function addHabitAndCaptureId(input: Omit<Habit, 'id' | 'createdAt' | 'active'>): string {
  const before = new Set(useHabitStore.getState().habits.map((h) => h.id));
  useHabitStore.getState().add(input);
  const created = useHabitStore.getState().habits.find((h) => !before.has(h.id));
  return created?.id ?? '';
}

function addNote(header: string): string {
  const note = useNotesStore.getState().add();
  useNotesStore.getState().update(note.id, { header });
  return note.id;
}

/** Creates the Freyr-mode starter set and returns exactly the ids/settings it created/overwrote. */
export function seedFreyrMode(): FreyrSeedIds {
  const shoppingStore = useShoppingStore.getState();
  const monthlyListId = useMonthlyListStore.getState().lists[0]?.id;
  const shoppingItemIds = [
    shoppingStore.add({ name: 'Dopapir', amount: '1', unit: '', listType: 'monthly', store: '', price: 0, inventoryQty: 0, status: 'catalog', targetQuantity: 1, monthlyListId }),
    shoppingStore.add({ name: 'Melk', amount: '1', unit: '', listType: 'monthly', store: '', price: 0, inventoryQty: 0, status: 'catalog', targetQuantity: 4, monthlyListId }),
    shoppingStore.add({ name: 'Håndsåpe', amount: '1', unit: '', listType: 'monthly', store: '', price: 0, inventoryQty: 0, status: 'catalog', targetQuantity: 1, monthlyListId }),
    shoppingStore.add({ name: 'Bleier', amount: '1', unit: '', listType: 'monthly', store: '', price: 0, inventoryQty: 0, status: 'catalog', targetQuantity: 6, monthlyListId }),
  ];

  const today = todayStr();
  const taskStore = useTaskStore.getState();
  const taskIds = [
    // Cat litter box, every day at 21:00 — consumes 1 Energy.
    taskStore.add({ title: 'Kattekasse', date: today, time: '21:00', taskType: 'start-at', done: false, recurring: 'daily', recurringDays: [], energyEnabled: true, energyValue: -1, sortOrder: 0 }).id,
    // Diaper changes, every day, whenever — consumes 1 Energy.
    taskStore.add({ title: 'Bleieskift', date: today, taskType: 'start-at', done: false, recurring: 'daily', recurringDays: [], energyEnabled: true, energyValue: -1, sortOrder: 1 }).id,
    // Bathing Eyja, Tue/Thu/Sat, whenever — consumes 2 Energy.
    taskStore.add({ title: 'Bade Eyja', date: today, taskType: 'start-at', done: false, recurring: 'weekly', recurringDays: [TUE, THU, SAT], energyEnabled: true, energyValue: -2, sortOrder: 2 }).id,
    // Laundry, every day at 17:30 — consumes 1 Energy.
    taskStore.add({ title: 'Klesvask', date: today, time: '17:30', taskType: 'start-at', done: false, recurring: 'daily', recurringDays: [], energyEnabled: true, energyValue: -1, sortOrder: 3 }).id,
    // Make the bed, Sunday at 21:30 — consumes 1 Energy.
    taskStore.add({ title: 'Re opp sengen', date: today, time: '21:30', taskType: 'start-at', done: false, recurring: 'weekly', recurringDays: [SUN], energyEnabled: true, energyValue: -1, sortOrder: 4 }).id,
    // Wash bedsheets, every Sunday at 13:00 — consumes 1 Energy.
    taskStore.add({ title: 'Vaske sengetøy', date: today, time: '13:00', taskType: 'start-at', done: false, recurring: 'weekly', recurringDays: [SUN], energyEnabled: true, energyValue: -1, sortOrder: 5 }).id,
    // Shopping, Tuesday and Friday at 16:00 — consumes 2 Energy.
    taskStore.add({ title: 'Handle', date: today, time: '16:00', taskType: 'start-at', done: false, recurring: 'weekly', recurringDays: [TUE, FRI], energyEnabled: true, energyValue: -2, sortOrder: 6 }).id,
    // Plan next week's shopping, Saturday at 20:30 — consumes 1 Energy.
    taskStore.add({ title: 'Planlegg neste ukes handleliste', date: today, time: '20:30', taskType: 'start-at', done: false, recurring: 'weekly', recurringDays: [SAT], energyEnabled: true, energyValue: -1, sortOrder: 7 }).id,
    // General house chores, Sat+Sun 14:00–15:00 — consumes 2 Energy.
    taskStore.add({ title: 'Husarbeid', date: today, time: '14:00', finishTime: '15:00', taskType: 'time-box', done: false, recurring: 'weekly', recurringDays: WEEKEND, energyEnabled: true, energyValue: -2, sortOrder: 8 }).id,
    // Take Eyja to kindergarten, Mon+Fri at 07:30 — consumes 1 Energy.
    taskStore.add({ title: 'Følge Eyja i barnehagen', date: today, time: '07:30', taskType: 'start-at', done: false, recurring: 'weekly', recurringDays: [MON, FRI], energyEnabled: true, energyValue: -1, sortOrder: 9 }).id,
    // Wake up with Eyja, Sat+Sun at 08:00 — consumes 1 Energy.
    taskStore.add({ title: 'Stå opp med Eyja', date: today, time: '08:00', taskType: 'start-at', done: false, recurring: 'weekly', recurringDays: WEEKEND, energyEnabled: true, energyValue: -1, sortOrder: 10 }).id,
    // Plan date night, once a month (pinned to the 1st, no fixed day given) — consumes 1 Energy.
    taskStore.add({ title: 'Planlegg date night', date: today, taskType: 'start-at', done: false, recurring: 'monthly', recurringDays: [], monthlyMode: 'day', monthDay: 1, energyEnabled: true, energyValue: -1, sortOrder: 11 }).id,
  ];

  const waterTimes = waterReminderTimes();
  const habitIds = [
    // Drink water every 2h, 08:00–20:00, every day — no Energy.
    addHabitAndCaptureId({
      title: 'Drikk vann', icon: '💧', kind: 'neutral', category: 'health',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: waterTimes.length, recurrence: 'daily', recurrenceDays: [],
      notificationEnabled: true, notificationTimes: waterTimes,
      reminderMode: 'interval', reminderCount: null, reminderIntervalMin: 120, reminderStart: '08:00', reminderEnd: '20:00',
      routineOrder: 0, childName: '', energyEnabled: false, energyValue: 0,
    }),
    // Lunch, 12:00, every day — gives 2 Energy.
    addHabitAndCaptureId({
      title: 'Lunsj', icon: '🍽️', kind: 'neutral', category: 'nutrition',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1, recurrence: 'daily', recurrenceDays: [],
      notificationEnabled: true, notificationTimes: ['12:00'],
      reminderMode: 'single', reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 1, childName: '', energyEnabled: true, energyValue: 2,
    }),
    // Dinner, 16:00, every day — gives 2 Energy.
    addHabitAndCaptureId({
      title: 'Middag', icon: '🍲', kind: 'neutral', category: 'nutrition',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1, recurrence: 'daily', recurrenceDays: [],
      notificationEnabled: true, notificationTimes: ['16:00'],
      reminderMode: 'single', reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 2, childName: '', energyEnabled: true, energyValue: 2,
    }),
    // Remove a stress factor, every day, whenever — gives 2 Energy.
    addHabitAndCaptureId({
      title: 'Fjern en stressfaktor', icon: '🧘', kind: 'neutral', category: 'wellbeing',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1, recurrence: 'daily', recurrenceDays: [],
      notificationEnabled: false, notificationTimes: [],
      reminderMode: null, reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 3, childName: '', energyEnabled: true, energyValue: 2,
    }),
    // Notice/add a stress factor, every day, whenever — consumes 2 Energy.
    addHabitAndCaptureId({
      title: 'Merk en stressfaktor', icon: '⚠️', kind: 'neutral', category: 'wellbeing',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1, recurrence: 'daily', recurrenceDays: [],
      notificationEnabled: false, notificationTimes: [],
      reminderMode: null, reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 4, childName: '', energyEnabled: true, energyValue: -2,
    }),
    // Brush teeth, Mon–Fri 21:30 — gives 1 Energy.
    addHabitAndCaptureId({
      title: 'Puss tenner (hverdager)', icon: '🪥', kind: 'neutral', category: 'health',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1, recurrence: 'weekly', recurrenceDays: WEEKDAYS,
      notificationEnabled: true, notificationTimes: ['21:30'],
      reminderMode: 'single', reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 5, childName: '', energyEnabled: true, energyValue: 1,
    }),
    // Go to bed, Mon–Fri 22:15 — gives 1 Energy.
    addHabitAndCaptureId({
      title: 'Legg deg (hverdager)', icon: '🛌', kind: 'neutral', category: 'sleep',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1, recurrence: 'weekly', recurrenceDays: WEEKDAYS,
      notificationEnabled: true, notificationTimes: ['22:15'],
      reminderMode: 'single', reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 6, childName: '', energyEnabled: true, energyValue: 1,
    }),
    // Brush teeth, Sat–Sun 22:00 — gives 1 Energy.
    addHabitAndCaptureId({
      title: 'Puss tenner (helg)', icon: '🪥', kind: 'neutral', category: 'health',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1, recurrence: 'weekly', recurrenceDays: WEEKEND,
      notificationEnabled: true, notificationTimes: ['22:00'],
      reminderMode: 'single', reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 7, childName: '', energyEnabled: true, energyValue: 1,
    }),
    // Go to bed, Sat–Sun 22:30 — no Energy.
    addHabitAndCaptureId({
      title: 'Legg deg (helg)', icon: '🛌', kind: 'neutral', category: 'sleep',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1, recurrence: 'weekly', recurrenceDays: WEEKEND,
      notificationEnabled: true, notificationTimes: ['22:30'],
      reminderMode: 'single', reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 8, childName: '', energyEnabled: false, energyValue: 0,
    }),
    // Go outside with Eyja, at least 3x/week, any day (weekly-flexible) — consumes 1 Energy.
    addHabitAndCaptureId({
      title: 'Gå ut med Eyja', icon: '🌳', kind: 'neutral', category: 'physical',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 3, recurrence: 'weekly-flexible', recurrenceDays: [],
      notificationEnabled: false, notificationTimes: [],
      reminderMode: null, reminderCount: null, reminderIntervalMin: null, reminderStart: null, reminderEnd: null,
      routineOrder: 9, childName: '', energyEnabled: true, energyValue: -1,
    }),
  ];

  const noteIds = [
    addNote('Oppdater appen'),
    addNote('Se på det visuelle'),
    addNote('Lag en liste'),
  ];

  const settings = useSettingsStore.getState();
  const prevSettings = {
    energySystemEnabled: settings.energySystemEnabled,
    energyDailyCapacity: settings.energyDailyCapacity,
  };
  // Energy: 15/day.
  settings.update({ energySystemEnabled: true, energyDailyCapacity: 15 });

  // Budget: 10 000 NOK/month, set on the same Monthly list the catalog items above were
  // tagged onto (budget is per list now, not a global setting) — no-op if there's no list.
  let monthlyBudget: FreyrSeedIds['monthlyBudget'] = null;
  if (monthlyListId) {
    const monthlyListStore = useMonthlyListStore.getState();
    const list = monthlyListStore.lists.find((l) => l.id === monthlyListId);
    monthlyBudget = { listId: monthlyListId, prevBudgetNok: list?.budgetNok ?? 0 };
    monthlyListStore.setBudget(monthlyListId, 10000);
  }

  return { shoppingItemIds, taskIds, habitIds, noteIds, prevSettings, monthlyBudget };
}

/** Removes exactly the rows a prior seedFreyrMode() call created, and restores the settings/
 *  budget it overwrote. */
export function unseedFreyrMode(ids: FreyrSeedIds): void {
  ids.shoppingItemIds.forEach((id) => useShoppingStore.getState().remove(id));
  ids.taskIds.forEach((id) => useTaskStore.getState().remove(id));
  ids.habitIds.forEach((id) => useHabitStore.getState().remove(id));
  ids.noteIds.forEach((id) => useNotesStore.getState().remove(id));
  if (ids.prevSettings) useSettingsStore.getState().update(ids.prevSettings);
  if (ids.monthlyBudget) useMonthlyListStore.getState().setBudget(ids.monthlyBudget.listId, ids.monthlyBudget.prevBudgetNok);
}
