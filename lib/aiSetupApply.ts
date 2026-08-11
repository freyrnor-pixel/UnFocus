/**
 * aiSetupApply.ts — validates an AiSetupConfig (untrusted, AI-authored) and writes it
 * into the real stores.
 *
 * Two entry points share one validation pass so a preview can never disagree with what
 * actually gets written: previewAiSetupConfig() runs the same per-item checks as
 * applyAiSetupConfig() but skips every store call (dryRun). Every write goes through
 * the target store's OWN existing add/create action — never raw SQL — so each store's
 * own defaults/side effects (notifications, live-sync, etc.) stay the single source of
 * truth. One bad item never aborts its domain's batch; it's just skipped with a reason.
 *
 * Connections:
 *   Imports → lib/aiSetupGuide (AiSetupConfig + draft types), lib/date,
 *             store/useSettingsStore, store/useTaskStore, store/useHabitStore,
 *             store/useGoalStore, store/useNotesStore, store/useShoppingListStore,
 *             store/useShoppingStore, store/useCatalogStore, store/useMealStore,
 *             store/useMonthlyListStore
 *   Used by → app/settings.tsx (preview on upload, apply on confirm),
 *             __tests__/aiSetupGuide.test.ts
 *   Data    → writes rows via each store's own actions (tasks, habits, goals, notes,
 *             shopping_lists, shopping_items [both inWeeklyList + catalog/inventory
 *             rows], store_items [Catalogue autocomplete], dishes/ingredients,
 *             monthly_lists) and a whitelisted subset of the settings row
 *
 * Edit notes:
 *   - The settings whitelist here MUST stay in sync with lib/aiSetupGuide.ts's guide
 *     text and AiSettingsPatch type — see AGENTS.md's "Add a new setting toggle"
 *     cookbook step for the process rule.
 *   - Non-whitelisted settings keys in the AI's JSON are silently dropped, not
 *     reported as an error — the guide never documents them, so a well-behaved AI
 *     won't produce them; a stray key shouldn't alarm the user.
 *   - habits: useHabitStore's add() requires every field with no runtime defaults
 *     (cue, craving, response, reward, the reminder fields, notificationTimes, icon)
 *     — this file synthesizes safe blanks/off defaults for all of them.
 *   - shoppingItems: processed AFTER shoppingLists in the same run so a listName can
 *     resolve against a list created earlier in the same config; unresolved/omitted
 *     names fall back to UNALLOCATED_LIST_ID rather than being skipped.
 */
import type {
  AiSetupConfig,
  AiTaskDraft,
  AiHabitDraft,
  AiGoalDraft,
  AiNoteDraft,
  AiShoppingListDraft,
  AiShoppingItemDraft,
  AiInventoryItemDraft,
  AiCatalogueItemDraft,
  AiMealDraft,
  AiMonthlyListDraft,
  AiSettingsPatch,
} from '@/lib/aiSetupGuide';
import { todayStr, dateStr, parseDateStr } from '@/lib/date';
import { CARD_TYPES as CARD_TYPE_VALUES, type CardType } from '@/lib/cardType';
import { useSettingsStore, Settings } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore, HabitKind, HabitCategory, HabitRecurrence } from '@/store/useHabitStore';
import { useGoalStore } from '@/store/useGoalStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useShoppingStore, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useMealStore } from '@/store/useMealStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';

const MAX_SHORT = 150;
const MAX_LONG = 2000;

export type DomainResult = { created: number; skipped: { index: number; reason: string }[] };

export type AiSetupApplyResult = {
  settings: { applied: string[]; skipped: { field: string; reason: string }[] };
  tasks: DomainResult;
  habits: DomainResult;
  goals: DomainResult;
  notes: DomainResult;
  shoppingLists: DomainResult;
  shoppingItems: DomainResult;
  inventoryItems: DomainResult;
  catalogueItems: DomainResult;
  meals: DomainResult;
  monthlyLists: DomainResult;
};

// ── Generic validation helpers ───────────────────────────────────────────────────────

function skip(result: DomainResult, index: number, reason: string): void {
  result.skipped.push({ index, reason });
}

function str(v: unknown, max = MAX_SHORT): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function optStr(v: unknown, max = MAX_SHORT): string | undefined {
  if (v === undefined) return undefined;
  return str(v, max) ?? undefined;
}

function isDateStr(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return dateStr(parseDateStr(v)) === v;
}

function isTimeStr(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function isEnum<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v);
}

function isNumArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/**
 * A finite number from an untrusted field, or null.
 *
 * **`typeof v === 'number'` is not enough on a parsed JSON file.** `1e999` is perfectly
 * valid JSON and `JSON.parse` turns it into `Infinity` — which then satisfies every
 * open-ended bound check in this module (`>= 0`, `>= 1`), survives `Math.floor`, and
 * lands in the store as a value nothing downstream can ever satisfy. A habit imported
 * with `dailyGoal: Infinity` can never be met at any count, draws a permanently empty
 * progress bar, and renders its goal chip as the literal text "Infinityx"; the
 * confirm-before-apply preview reports it as a clean creation, because preview and apply
 * share this one validation pass. NaN is rejected here too for symmetry — JSON has no
 * literal for it, but a hand-edited or generated payload is untrusted input either way.
 *
 * Bounded checks (`>= 1 && <= 4`) already excluded Infinity by accident; routing every
 * numeric field through this makes that a property of the validator rather than of which
 * bound a given field happens to have.
 */
function finiteNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** A finite, non-negative number from an untrusted field, or 0. */
function numAtLeastZero(v: unknown): number {
  const n = finiteNum(v);
  return n !== null && n >= 0 ? n : 0;
}

/** A finite integer from an untrusted field, inside [min, max], or undefined. */
function intInRange(v: unknown, min: number, max: number): number | undefined {
  const n = finiteNum(v);
  return n !== null && n >= min && n <= max ? Math.floor(n) : undefined;
}

function addDaysStr(base: string, days: number): string {
  const d = parseDateStr(base);
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

// ── tasks ───────────────────────────────────────────────────────────────────────────

// Reuses lib/cardType.ts's own list rather than restating it, so a fifth type could never
// be accepted here without the app knowing about it (or vice versa).
const CARD_TYPES = CARD_TYPE_VALUES;
const TASK_TYPES = ['start-at', 'time-box'] as const;
const RECURRING = ['none', 'daily', 'weekly', 'monthly'] as const;
const MONTHLY_MODES = ['day', 'ordinal'] as const;
const MONTH_ORDINALS = ['first', 'second', 'third', 'fourth', 'last'] as const;

function processTasks(drafts: AiTaskDraft[] | undefined, dryRun: boolean): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const add = useTaskStore.getState().add;
  const baseSortOrder = useTaskStore.getState().tasks.length;

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const title = str(d.title);
    if (!title) return skip(result, index, 'invalid-type');
    if (!isDateStr(d.date)) return skip(result, index, 'invalid-date');
    if (d.taskType !== undefined && !isEnum(d.taskType, TASK_TYPES)) return skip(result, index, 'invalid-enum');
    if (d.recurring !== undefined && !isEnum(d.recurring, RECURRING)) return skip(result, index, 'invalid-enum');
    if (d.monthlyMode !== undefined && !isEnum(d.monthlyMode, MONTHLY_MODES)) return skip(result, index, 'invalid-enum');
    if (d.monthOrdinal !== undefined && !isEnum(d.monthOrdinal, MONTH_ORDINALS)) return skip(result, index, 'invalid-enum');
    if (d.time !== undefined && !isTimeStr(d.time)) return skip(result, index, 'invalid-time');
    if (d.finishTime !== undefined && !isTimeStr(d.finishTime)) return skip(result, index, 'invalid-time');
    const hint = optStr(d.hint, MAX_LONG);
    if (d.hint !== undefined && hint === undefined) return skip(result, index, 'too-long');
    // Rejected rather than silently coerced, so a typo is reported back in the preview
    // instead of quietly producing an ordinary card the user didn't ask for.
    if (d.cardType !== undefined && !isEnum(d.cardType, CARD_TYPES)) return skip(result, index, 'invalid-enum');

    if (!dryRun) {
      add({
        title,
        date: d.date as string,
        taskType: (d.taskType as 'start-at' | 'time-box') ?? 'start-at',
        done: false,
        recurring: (d.recurring as typeof RECURRING[number]) ?? 'none',
        recurringDays: isNumArray(d.recurringDays) ? d.recurringDays.filter((n) => n >= 0 && n <= 6) : [],
        monthlyMode: d.monthlyMode as 'day' | 'ordinal' | undefined,
        monthOrdinal: d.monthOrdinal as typeof MONTH_ORDINALS[number] | undefined,
        monthWeekday: intInRange(d.monthWeekday, 0, 6),
        time: d.time as string | undefined,
        finishTime: d.finishTime as string | undefined,
        hint,
        cardType: d.cardType as CardType | undefined,
        hasStartDate: true,
        sortOrder: baseSortOrder + index,
      });
    }
    result.created++;
  });
  return result;
}

// ── habits ──────────────────────────────────────────────────────────────────────────

const HABIT_KINDS = ['build', 'break', 'neutral'] as const;
const HABIT_RECURRENCE = ['daily', 'weekly', 'monthly', 'one-time', 'weekly-flexible'] as const;
const HABIT_CATEGORY = ['physical', 'mental', 'health', 'nutrition', 'sleep', 'work', 'wellbeing', 'other'] as const;

function processHabits(drafts: AiHabitDraft[] | undefined, dryRun: boolean): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const add = useHabitStore.getState().add;

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const title = str(d.title);
    if (!title) return skip(result, index, 'invalid-type');
    if (!isEnum(d.kind, HABIT_KINDS)) return skip(result, index, 'invalid-enum');
    if (!isEnum(d.recurrence, HABIT_RECURRENCE)) return skip(result, index, 'invalid-enum');
    if (!isEnum(d.category, HABIT_CATEGORY)) return skip(result, index, 'invalid-enum');
    const dailyGoalRaw = finiteNum(d.dailyGoal);
    const dailyGoal = dailyGoalRaw !== null && dailyGoalRaw >= 1 ? Math.floor(dailyGoalRaw) : null;
    if (dailyGoal === null) return skip(result, index, 'invalid-type');
    const recurrenceDays = isNumArray(d.recurrenceDays) ? d.recurrenceDays.filter((n) => n >= 0 && n <= 6) : [];
    if ((d.recurrence === 'weekly' || d.recurrence === 'weekly-flexible') && recurrenceDays.length === 0) {
      return skip(result, index, 'weekly-recurrence-needs-days');
    }
    // "Every N days/weeks" (2026-08-11) — a small bounded integer, safe from an untrusted
    // file. CLAMPED rather than rejected via intInRange (which treats out-of-range as
    // absent) — an out-of-range value is still a coherent ask ("every 40 days") that the
    // app can satisfy by capping it, same spirit as dailyGoal's floor. Omitted/invalid
    // (non-finite) defaults to 1 — today's plain daily/weekly.
    const rawInterval = finiteNum(d.recurrenceInterval);
    const recurrenceInterval = rawInterval !== null ? Math.min(12, Math.max(1, Math.floor(rawInterval))) : 1;

    if (!dryRun) {
      add({
        title,
        icon: 'checkmark-circle-outline',
        kind: d.kind as HabitKind,
        category: d.category as HabitCategory,
        cue: '',
        craving: '',
        response: '',
        reward: '',
        dailyGoal,
        recurrence: d.recurrence as HabitRecurrence,
        recurrenceDays,
        recurrenceInterval,
        notificationEnabled: false,
        notificationTimes: [],
        reminderMode: null,
        reminderCount: null,
        reminderIntervalMin: null,
        reminderStart: null,
        reminderEnd: null,
        routineOrder: Date.now() + index,
        childName: '',
        energyEnabled: false,
        energyValue: 1,
      });
    }
    result.created++;
  });
  return result;
}

// ── goals ───────────────────────────────────────────────────────────────────────────

function processGoals(drafts: AiGoalDraft[] | undefined, dryRun: boolean): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const add = useGoalStore.getState().add;

  drafts.forEach((raw, index) => {
    const title = str(asRecord(raw).title);
    if (!title) return skip(result, index, 'invalid-type');
    if (!dryRun) add(title);
    result.created++;
  });
  return result;
}

// ── notes ───────────────────────────────────────────────────────────────────────────

function processNotes(drafts: AiNoteDraft[] | undefined, dryRun: boolean): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const { add, update } = useNotesStore.getState();

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const header = str(d.header);
    if (!header) return skip(result, index, 'invalid-type');
    const body = optStr(d.body, MAX_LONG);
    if (d.body !== undefined && body === undefined) return skip(result, index, 'too-long');

    if (!dryRun) {
      const note = add();
      update(note.id, { header, body: body ?? '', checked: false });
    }
    result.created++;
  });
  return result;
}

// ── shopping lists (+ items, which depend on the lists just created) ────────────────

function processShoppingLists(
  drafts: AiShoppingListDraft[] | undefined,
  dryRun: boolean
): { result: DomainResult; idByName: Map<string, string> } {
  const result: DomainResult = { created: 0, skipped: [] };
  const idByName = new Map<string, string>();
  if (!Array.isArray(drafts)) return { result, idByName };
  const add = useShoppingListStore.getState().add;

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const name = optStr(d.name);
    const startDate = isDateStr(d.startDate) ? (d.startDate as string) : todayStr();
    const endDate = isDateStr(d.endDate) ? (d.endDate as string) : addDaysStr(startDate, 7);
    const isRecurring = typeof d.isRecurring === 'boolean' ? d.isRecurring : undefined;
    const recurrenceIntervalWeeks = intInRange(d.recurrenceIntervalWeeks, 1, 4);

    const id = dryRun ? `preview:${index}` : add({ name, startDate, endDate, isRecurring, recurrenceIntervalWeeks });
    if (name) idByName.set(name.trim().toLowerCase(), id);
    result.created++;
  });
  return { result, idByName };
}

function processShoppingItems(
  drafts: AiShoppingItemDraft[] | undefined,
  dryRun: boolean,
  listIdByName: Map<string, string>
): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const add = useShoppingStore.getState().add;

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const name = str(d.name);
    if (!name) return skip(result, index, 'invalid-type');
    const amount = optStr(d.amount, 20) ?? '1';
    const unit = optStr(d.unit, 20) ?? '';
    const listNameKey = typeof d.listName === 'string' ? d.listName.trim().toLowerCase() : '';
    const listId = (listNameKey && listIdByName.get(listNameKey)) || UNALLOCATED_LIST_ID;

    if (!dryRun) {
      add({ name, amount, unit, listType: 'weekly', store: '', price: 0, inventoryQty: 0, status: 'inWeeklyList', listId });
    }
    result.created++;
  });
  return result;
}

// ── household inventory ("Katalog") ──────────────────────────────────────────────────

function processInventoryItems(drafts: AiInventoryItemDraft[] | undefined, dryRun: boolean): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const add = useShoppingStore.getState().add;

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const name = str(d.name);
    if (!name) return skip(result, index, 'invalid-type');
    const amount = optStr(d.amount, 20) ?? '1';
    const unit = optStr(d.unit, 20) ?? '';
    const priceRaw = finiteNum(d.price);
    const price = priceRaw !== null && priceRaw >= 0 ? priceRaw : 0;
    const category = optStr(d.category, 40) ?? 'other';
    const targetQuantityRaw = finiteNum(d.targetQuantity);
    const targetQuantity =
      targetQuantityRaw !== null && targetQuantityRaw >= 0 ? Math.floor(targetQuantityRaw) : 1;

    if (!dryRun) {
      add({ name, amount, unit, listType: 'monthly', store: '', price, inventoryQty: 0, status: 'catalog', category, targetQuantity });
    }
    result.created++;
  });
  return result;
}

// ── Catalogue-tab autocomplete list ──────────────────────────────────────────────────

function processCatalogueItems(drafts: AiCatalogueItemDraft[] | undefined, dryRun: boolean): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const addItem = useCatalogStore.getState().addItem;

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const name = str(d.name);
    if (!name) return skip(result, index, 'invalid-type');
    const priceRaw = finiteNum(d.price);
    const price = priceRaw !== null && priceRaw >= 0 ? priceRaw : undefined;
    const category = optStr(d.category, 40);
    const store = optStr(d.store, 60);

    if (!dryRun) addItem({ name, price, category, store });
    result.created++;
  });
  return result;
}

// ── meals ───────────────────────────────────────────────────────────────────────────

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'kveldsmat'] as const;
const DIFFICULTIES = ['easy', 'normal'] as const;

function processMeals(drafts: AiMealDraft[] | undefined, dryRun: boolean): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const { addDish, addIngredient } = useMealStore.getState();

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const name = str(d.name);
    if (!name) return skip(result, index, 'invalid-type');
    if (!isEnum(d.mealType, MEAL_TYPES)) return skip(result, index, 'invalid-enum');
    if (d.difficulty !== undefined && !isEnum(d.difficulty, DIFFICULTIES)) return skip(result, index, 'invalid-enum');

    const rawIngredients = Array.isArray(d.ingredients) ? d.ingredients : [];
    const ingredients = rawIngredients
      .map((raw2) => {
        const i = asRecord(raw2);
        const iName = str(i.name);
        if (!iName) return null;
        return {
          name: iName,
          amount: optStr(i.amount, 30) ?? '',
          unit: optStr(i.unit, 20) ?? '',
          priceNok: numAtLeastZero(i.priceNok),
        };
      })
      .filter((i): i is { name: string; amount: string; unit: string; priceNok: number } => i !== null);

    if (!dryRun) {
      const dish = addDish({ name, mealType: d.mealType as typeof MEAL_TYPES[number], difficulty: d.difficulty as 'easy' | 'normal' | undefined });
      for (const ing of ingredients) addIngredient({ dishId: dish.id, ...ing });
    }
    result.created++;
  });
  return result;
}

// ── monthly lists ───────────────────────────────────────────────────────────────────

function processMonthlyLists(drafts: AiMonthlyListDraft[] | undefined, dryRun: boolean): DomainResult {
  const result: DomainResult = { created: 0, skipped: [] };
  if (!Array.isArray(drafts)) return result;
  const { add, setBudget } = useMonthlyListStore.getState();

  drafts.forEach((raw, index) => {
    const d = asRecord(raw);
    const name = optStr(d.name);
    const budgetRaw = finiteNum(d.budgetNok);
    const budgetNok = budgetRaw !== null && budgetRaw >= 0 ? budgetRaw : undefined;

    if (!dryRun) {
      const id = add({ name });
      if (budgetNok !== undefined) setBudget(id, budgetNok);
    }
    result.created++;
  });
  return result;
}

// ── settings (whitelisted patch) ─────────────────────────────────────────────────────

/** MUST stay in sync with lib/aiSetupGuide.ts's guide text — see that file's Edit notes. */
const SETTINGS_WHITELIST = [
  'language', 'darkMode', 'fontSize', 'reducedMotion', 'particlesEnabled', 'glassSurfaces',
  'leftHanded', 'remindersEnabled', 'reminderTime', 'taskNotificationsEnabled',
  'habitNotificationsEnabled', 'persistentNotifEnabled', 'quietHoursEnabled', 'quietHoursStart',
  'quietHoursEnd', 'weeklyResetDay', 'monthlyResetDate', 'energyMode', 'energyDailyCapacity',
  'energyWeeklyCapacity', 'featureGoals', 'featureSharing', 'featureAutomations',
  'energySystemEnabled', 'showGrowth',
  'photoAspectRatio', 'peopleModeEnabled',
] as const satisfies readonly (keyof AiSettingsPatch)[];

const LANGUAGES = ['en', 'no'] as const;
const DARK_MODES = ['system', 'on', 'off'] as const;
const FONT_SIZES = ['small', 'default', 'large'] as const;
const ENERGY_MODES = ['daily', 'weekly', 'custom'] as const;
const ASPECT_RATIOS = ['fit', 'square', 'classic', 'widescreen', 'golden'] as const;
const BOOLEAN_KEYS = new Set<string>([
  'reducedMotion', 'particlesEnabled', 'glassSurfaces', 'leftHanded', 'remindersEnabled',
  'taskNotificationsEnabled', 'habitNotificationsEnabled', 'persistentNotifEnabled',
  'quietHoursEnabled', 'featureGoals', 'featureSharing', 'featureAutomations',
  'energySystemEnabled', 'showGrowth',
  'peopleModeEnabled',
]);
const TIME_KEYS = new Set(['reminderTime', 'quietHoursStart', 'quietHoursEnd']);

/** Validates a single whitelisted field's value; returns undefined if invalid. */
function validateSettingValue(key: string, value: unknown): unknown {
  if (BOOLEAN_KEYS.has(key)) return typeof value === 'boolean' ? value : undefined;
  if (TIME_KEYS.has(key)) return isTimeStr(value) ? value : undefined;
  if (key === 'language') return isEnum(value, LANGUAGES) ? value : undefined;
  if (key === 'darkMode') return isEnum(value, DARK_MODES) ? value : undefined;
  if (key === 'fontSize') return isEnum(value, FONT_SIZES) ? value : undefined;
  if (key === 'energyMode') return isEnum(value, ENERGY_MODES) ? value : undefined;
  if (key === 'photoAspectRatio') return isEnum(value, ASPECT_RATIOS) ? value : undefined;
  const n = finiteNum(value);
  if (key === 'weeklyResetDay') return n !== null && n >= 0 && n <= 6 ? Math.floor(n) : undefined;
  if (key === 'monthlyResetDate') return n !== null && n >= 1 && n <= 31 ? Math.floor(n) : undefined;
  if (key === 'energyDailyCapacity' || key === 'energyWeeklyCapacity') {
    // Open-ended on purpose (a capacity is whatever the person says it is), which is
    // exactly why it needs finiteNum — see that helper's doc on `1e999`.
    return n !== null && n >= 0 ? n : undefined;
  }
  return undefined;
}

function processSettings(
  raw: Partial<AiSettingsPatch> | undefined,
  dryRun: boolean
): { applied: string[]; skipped: { field: string; reason: string }[] } {
  const applied: string[] = [];
  const skipped: { field: string; reason: string }[] = [];
  const d = asRecord(raw);
  const patch: Partial<Settings> = {};

  for (const key of Object.keys(d)) {
    if (!(SETTINGS_WHITELIST as readonly string[]).includes(key)) continue; // not documented — silently dropped
    const value = validateSettingValue(key, d[key]);
    if (value === undefined) {
      skipped.push({ field: key, reason: 'invalid-type' });
      continue;
    }
    (patch as Record<string, unknown>)[key] = value;
    applied.push(key);
  }

  if (!dryRun && applied.length > 0) useSettingsStore.getState().update(patch);
  return { applied, skipped };
}

// ── entry points ────────────────────────────────────────────────────────────────────

function runConfig(config: AiSetupConfig, dryRun: boolean): AiSetupApplyResult {
  const { result: shoppingLists, idByName } = processShoppingLists(config.shoppingLists, dryRun);
  return {
    settings: processSettings(config.settings, dryRun),
    tasks: processTasks(config.tasks, dryRun),
    habits: processHabits(config.habits, dryRun),
    goals: processGoals(config.goals, dryRun),
    notes: processNotes(config.notes, dryRun),
    shoppingLists,
    shoppingItems: processShoppingItems(config.shoppingItems, dryRun, idByName),
    inventoryItems: processInventoryItems(config.inventoryItems, dryRun),
    catalogueItems: processCatalogueItems(config.catalogueItems, dryRun),
    meals: processMeals(config.meals, dryRun),
    monthlyLists: processMonthlyLists(config.monthlyLists, dryRun),
  };
}

/** Dry-run: validates everything and reports what WOULD happen, writes nothing. */
export function previewAiSetupConfig(config: AiSetupConfig): AiSetupApplyResult {
  return runConfig(config, true);
}

/** Writes a validated AiSetupConfig into the real stores. */
export function applyAiSetupConfig(config: AiSetupConfig): AiSetupApplyResult {
  return runConfig(config, false);
}
