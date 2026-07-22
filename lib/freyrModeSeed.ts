/**
 * freyrModeSeed.ts — seed/unseed the "Freyr-mode" starter data set.
 *
 * "Freyr-mode" is a settings toggle (Additional modes tab) that one-shot creates a
 * fixed starter set of rows across four stores (monthly shopping catalog, tasks,
 * one habit, notes) and, when turned back off, removes exactly those rows — never
 * anything the user added themselves. The ids created by seedFreyrMode() must be
 * persisted (useSettingsStore's freyrSeedIds) and passed back into unseedFreyrMode()
 * on disable; app/settings.tsx owns that read/write.
 *
 * Connections:
 *   Imports → lib/date, store/useHabitStore, store/useNotesStore, store/useShoppingStore, store/useMonthlyListStore, store/useTaskStore
 *   Used by → app/settings.tsx
 *   Data    → writes shopping_items (status='catalog', list_type='monthly'), tasks, habits, notes
 *     via each store's own add()/update()/remove() — no direct SQL here.
 *
 * Edit notes:
 *   - Item/task/note text is Norwegian and NOT translated, matching lib/catalogSeed.ts's
 *     precedent (only UI chrome follows the user's language; seeded content doesn't).
 *   - useHabitStore.add() doesn't return the created row, unlike the other three
 *     stores' add(). addHabitAndCaptureId() diffs the habit list before/after to
 *     recover the new id — don't call this seed function concurrently with anything
 *     else that adds a habit, or the diff could pick up the wrong row.
 *   - **Shopping — Monthly redesign (2026-07-22)**: seeded catalog items are tagged onto
 *     the first Monthly list (`useMonthlyListStore`'s `lists[0]`) so they actually show up
 *     on a card — without a monthlyListId they'd be silently orphaned (invisible in every
 *     list). Falls back to no tag (matching pre-redesign, unlikely-but-possible) only if
 *     the user has deleted every Monthly list before enabling Freyr-mode.
 */
import { todayStr } from '@/lib/date';
import { useHabitStore, Habit } from '@/store/useHabitStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { useTaskStore } from '@/store/useTaskStore';

export type FreyrSeedIds = {
  shoppingItemIds: string[];
  taskIds: string[];
  habitId: string | null;
  noteIds: string[];
};

export const EMPTY_FREYR_SEED_IDS: FreyrSeedIds = {
  shoppingItemIds: [],
  taskIds: [],
  habitId: null,
  noteIds: [],
};

export function parseFreyrSeedIds(json: string): FreyrSeedIds {
  if (!json) return EMPTY_FREYR_SEED_IDS;
  try {
    return { ...EMPTY_FREYR_SEED_IDS, ...JSON.parse(json) };
  } catch {
    return EMPTY_FREYR_SEED_IDS;
  }
}

/** Every-2-hours reminder times from 08:00 through 22:00 inclusive. */
function waterReminderTimes(): string[] {
  const times: string[] = [];
  for (let h = 8; h <= 22; h += 2) times.push(`${String(h).padStart(2, '0')}:00`);
  return times;
}

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

/** Creates the Freyr-mode starter set and returns exactly the ids it created. */
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
    taskStore.add({ title: 'Kattekasse', date: today, time: '21:00', taskType: 'start-at', done: false, recurring: 'daily', recurringDays: [], sortOrder: 0 }).id,
    taskStore.add({ title: 'Puss tenner', date: today, time: '07:30', taskType: 'start-at', done: false, recurring: 'daily', recurringDays: [], sortOrder: 0 }).id,
    taskStore.add({ title: 'Puss tenner', date: today, time: '21:45', taskType: 'start-at', done: false, recurring: 'daily', recurringDays: [], sortOrder: 0 }).id,
  ];

  const waterTimes = waterReminderTimes();
  const habitId = addHabitAndCaptureId({
    title: 'Drikk vann',
    icon: '💧',
    kind: 'neutral',
    category: 'health',
    cue: '',
    craving: '',
    response: '',
    reward: '',
    dailyGoal: waterTimes.length,
    recurrence: 'daily',
    recurrenceDays: [],
    notificationEnabled: true,
    notificationTimes: waterTimes,
    reminderMode: 'interval',
    reminderCount: null,
    reminderIntervalMin: 120,
    reminderStart: '08:00',
    reminderEnd: '22:00',
    routineOrder: 0,
    childName: '',
    // Drinking water restores energy (+1) — the canonical positive-energy example.
    energyEnabled: true,
    energyValue: 1,
  });

  const noteIds = [
    addNote('Oppdater appen'),
    addNote('Se på det visuelle'),
    addNote('Lag en liste'),
  ];

  return { shoppingItemIds, taskIds, habitId: habitId || null, noteIds };
}

/** Removes exactly the rows a prior seedFreyrMode() call created. */
export function unseedFreyrMode(ids: FreyrSeedIds): void {
  ids.shoppingItemIds.forEach((id) => useShoppingStore.getState().remove(id));
  ids.taskIds.forEach((id) => useTaskStore.getState().remove(id));
  if (ids.habitId) useHabitStore.getState().remove(ids.habitId);
  ids.noteIds.forEach((id) => useNotesStore.getState().remove(id));
}
