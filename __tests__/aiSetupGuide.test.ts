/**
 * aiSetupGuide.test.ts — unit tests for the AI setup guide's parse/validate/apply logic
 * (lib/aiSetupGuide.ts + lib/aiSetupApply.ts).
 *
 * Parse tests are pure (no store involved). Apply tests exercise the REAL store
 * actions with only '@/lib/db' mocked — same minimal recipe as __tests__/backup.test.ts
 * (which already imports lib/backup.ts, itself pulling in expo-file-system/expo-sharing/
 * expo-document-picker/expo-constants same as lib/aiSetupGuide.ts, with no extra mocks
 * needed) and __tests__/taskStore.test.ts (which establishes that a store's native-module
 * side effects — notifications, calendar sync, live-sync broadcast — are safe no-ops
 * headless).
 */
import {
  AI_SETUP_BEGIN,
  AI_SETUP_END,
  AI_SETUP_SCHEMA_VERSION,
  parseAiSetupFile,
  type AiSetupConfig,
} from '@/lib/aiSetupGuide';
import { previewAiSetupConfig, applyAiSetupConfig } from '@/lib/aiSetupApply';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useGoalStore } from '@/store/useGoalStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useShoppingStore, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useMealStore } from '@/store/useMealStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { useSettingsStore } from '@/store/useSettingsStore';

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));

function wrap(json: object): string {
  return `Some AI commentary here.\n${AI_SETUP_BEGIN}\n${JSON.stringify(json)}\n${AI_SETUP_END}\nMore commentary.`;
}

beforeEach(() => {
  useTaskStore.setState({ tasks: [] });
  useHabitStore.setState({ habits: [], logs: [] });
  useGoalStore.setState({ goals: [] });
  useNotesStore.setState({ notes: [] });
  useShoppingListStore.setState({ lists: [] });
  useShoppingStore.setState({ items: [], trips: [], recentlyAddedIds: {} });
  useCatalogStore.setState({ items: [] });
  useMealStore.setState({ dishes: [] });
  useMonthlyListStore.setState({ lists: [] });
});

describe('parseAiSetupFile', () => {
  it('parses a valid config', () => {
    const parsed = parseAiSetupFile(wrap({ version: AI_SETUP_SCHEMA_VERSION, tasks: [] }));
    expect(parsed.status).toBe('ok');
  });

  it('rejects malformed JSON inside the markers', () => {
    const text = `${AI_SETUP_BEGIN}\n{ not valid json \n${AI_SETUP_END}`;
    expect(parseAiSetupFile(text)).toEqual({ status: 'invalid', reason: 'json' });
  });

  it('rejects a file with no markers at all', () => {
    expect(parseAiSetupFile('just some prose, no markers here')).toEqual({ status: 'invalid', reason: 'no-markers' });
  });

  it('tolerates a markdown code fence wrapped around the JSON', () => {
    const inner = '```json\n' + JSON.stringify({ version: AI_SETUP_SCHEMA_VERSION }) + '\n```';
    const text = `${AI_SETUP_BEGIN}\n${inner}\n${AI_SETUP_END}`;
    expect(parseAiSetupFile(text).status).toBe('ok');
  });

  it('flags a newer-than-supported version as invalid', () => {
    const parsed = parseAiSetupFile(wrap({ version: AI_SETUP_SCHEMA_VERSION + 1 }));
    expect(parsed).toEqual({ status: 'invalid', reason: 'unknown-version' });
  });

  it('flags an older version as stale but still returns the data', () => {
    const parsed = parseAiSetupFile(wrap({ version: AI_SETUP_SCHEMA_VERSION - 1, tasks: [] }));
    expect(parsed.status).toBe('stale');
    expect(parsed.status === 'stale' && parsed.data.tasks).toEqual([]);
  });

  it('parses an empty config with no domain keys as ok', () => {
    expect(parseAiSetupFile(wrap({ version: AI_SETUP_SCHEMA_VERSION })).status).toBe('ok');
  });

  it('ignores unknown top-level keys without failing', () => {
    expect(parseAiSetupFile(wrap({ version: AI_SETUP_SCHEMA_VERSION, somethingElse: 123 })).status).toBe('ok');
  });
});

describe('applyAiSetupConfig — tasks', () => {
  it('creates a valid task via the real store', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      tasks: [{ title: 'Buy milk', date: '2026-08-01' }],
    });
    expect(result.tasks).toEqual({ created: 1, skipped: [] });
    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(useTaskStore.getState().tasks[0].title).toBe('Buy milk');
  });

  it('skips an invalid item but still creates the rest of the batch', () => {
    const config: AiSetupConfig = {
      version: AI_SETUP_SCHEMA_VERSION,
      tasks: [
        { title: 'Good one', date: '2026-08-01' },
        { title: 'Bad one', date: '2026-08-01', taskType: 'bogus' as never },
      ],
    };
    const result = applyAiSetupConfig(config);
    expect(result.tasks.created).toBe(1);
    expect(result.tasks.skipped).toEqual([{ index: 1, reason: 'invalid-enum' }]);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });

  it('skips a task with an invalid date format', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      tasks: [{ title: 'X', date: '08-01-2026' }],
    });
    expect(result.tasks).toEqual({ created: 0, skipped: [{ index: 0, reason: 'invalid-date' }] });
  });
});

describe('applyAiSetupConfig — habits', () => {
  it('creates a weekly habit that includes recurrenceDays', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      habits: [{ title: 'Run', kind: 'neutral', recurrence: 'weekly', category: 'physical', dailyGoal: 1, recurrenceDays: [0, 2, 4] }],
    });
    expect(result.habits).toEqual({ created: 1, skipped: [] });
    expect(useHabitStore.getState().habits).toHaveLength(1);
  });

  it('skips a weekly habit with no recurrenceDays', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      habits: [{ title: 'Run', kind: 'neutral', recurrence: 'weekly', category: 'physical', dailyGoal: 1 }],
    });
    expect(result.habits).toEqual({ created: 0, skipped: [{ index: 0, reason: 'weekly-recurrence-needs-days' }] });
    expect(useHabitStore.getState().habits).toHaveLength(0);
  });

  // recurrenceInterval (2026-08-11) — "every N days/weeks". Clamped, never rejected: an
  // out-of-range value is still a coherent ask ("every 40 days"), so it's capped rather
  // than skipping the whole habit; omitted defaults to 1 (today's plain daily behaviour).
  it.each([
    [3, 3],
    [40, 12],
    [0, 1],
    [undefined, 1],
  ])('clamps recurrenceInterval %p to %p', (input, expected) => {
    applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      habits: [{ title: 'Stretch', kind: 'neutral', recurrence: 'daily', category: 'physical', dailyGoal: 1, recurrenceInterval: input }],
    });
    expect(useHabitStore.getState().habits[0]).toMatchObject({ recurrenceInterval: expected });
  });
});

describe('applyAiSetupConfig — goals, notes, monthly lists', () => {
  it('creates a goal', () => {
    const result = applyAiSetupConfig({ version: AI_SETUP_SCHEMA_VERSION, goals: [{ title: 'Get fit' }] });
    expect(result.goals).toEqual({ created: 1, skipped: [] });
    expect(useGoalStore.getState().goals).toHaveLength(1);
  });

  it('creates a note with header + body', () => {
    const result = applyAiSetupConfig({ version: AI_SETUP_SCHEMA_VERSION, notes: [{ header: 'Idea', body: 'Details' }] });
    expect(result.notes).toEqual({ created: 1, skipped: [] });
    expect(useNotesStore.getState().notes[0]).toMatchObject({ header: 'Idea', body: 'Details' });
  });

  it('creates a monthly list with a budget', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      monthlyLists: [{ name: 'Groceries', budgetNok: 3000 }],
    });
    expect(result.monthlyLists).toEqual({ created: 1, skipped: [] });
    expect(useMonthlyListStore.getState().lists[0]).toMatchObject({ name: 'Groceries', budgetNok: 3000 });
  });
});

describe('applyAiSetupConfig — inventory vs. Catalogue (two distinct stores)', () => {
  it('writes inventoryItems to the household stock and catalogueItems to the autocomplete list, never mixed', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      inventoryItems: [{ name: 'Flour' }],
      catalogueItems: [{ name: 'Sugar', price: 20 }],
    });
    expect(result.inventoryItems).toEqual({ created: 1, skipped: [] });
    expect(result.catalogueItems).toEqual({ created: 1, skipped: [] });
    expect(useShoppingStore.getState().items).toHaveLength(1);
    expect(useShoppingStore.getState().items[0]).toMatchObject({ name: 'Flour', status: 'catalog' });
    expect(useCatalogStore.getState().items).toHaveLength(1);
    expect(useCatalogStore.getState().items[0].name).toBe('Sugar');
  });
});

describe('applyAiSetupConfig — meals', () => {
  it('creates a dish with an ingredient sharing the dish id', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      meals: [{ name: 'Pasta', mealType: 'dinner', ingredients: [{ name: 'Tomato' }] }],
    });
    expect(result.meals).toEqual({ created: 1, skipped: [] });
    const dish = useMealStore.getState().dishes[0];
    expect(dish.ingredients).toHaveLength(1);
    expect(dish.ingredients[0].dishId).toBe(dish.id);
  });
});

describe('applyAiSetupConfig — shopping lists + items', () => {
  it('resolves a shopping item to a list created earlier in the same config', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      shoppingLists: [{ name: 'This week' }],
      shoppingItems: [{ name: 'Bread', listName: 'This week' }],
    });
    expect(result.shoppingLists.created).toBe(1);
    expect(result.shoppingItems.created).toBe(1);
    const list = useShoppingListStore.getState().lists[0];
    const item = useShoppingStore.getState().items.find((i) => i.name === 'Bread');
    expect(item?.listId).toBe(list.id);
  });

  it('falls back to the Unallocated bucket when the list name is missing or unresolved', () => {
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      shoppingItems: [{ name: 'Bread' }],
    });
    expect(result.shoppingItems.created).toBe(1);
    const item = useShoppingStore.getState().items.find((i) => i.name === 'Bread');
    expect(item?.listId).toBe(UNALLOCATED_LIST_ID);
  });
});

describe('applyAiSetupConfig — settings whitelist', () => {
  it('applies only whitelisted fields and drops the rest silently', () => {
    const before = useSettingsStore.getState().accountName;
    const result = applyAiSetupConfig({
      version: AI_SETUP_SCHEMA_VERSION,
      settings: { darkMode: 'on', accountName: 'hacked' } as never,
    });
    expect(result.settings.applied).toEqual(['darkMode']);
    expect(result.settings.skipped).toEqual([]);
    expect(useSettingsStore.getState().darkMode).toBe('on');
    expect(useSettingsStore.getState().accountName).toBe(before);
  });
});

describe('previewAiSetupConfig', () => {
  it('reports the same counts as apply, without writing anything', () => {
    const config: AiSetupConfig = {
      version: AI_SETUP_SCHEMA_VERSION,
      tasks: [{ title: 'Buy milk', date: '2026-08-01' }],
    };
    const preview = previewAiSetupConfig(config);
    expect(preview.tasks).toEqual({ created: 1, skipped: [] });
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });
});
