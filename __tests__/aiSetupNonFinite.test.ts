/**
 * aiSetupNonFinite.test.ts — the AI setup import must reject non-finite numbers
 * (2026-08-10).
 *
 * `1e999` is VALID JSON. `JSON.parse` turns it into `Infinity`, and `parseAiSetupFile`
 * does no numeric validation at all — it checks the markers and the `version` field and
 * hands the object straight to lib/aiSetupApply.ts. Every open-ended bound check there
 * (`>= 0`, `>= 1`) is satisfied by Infinity, and `Math.floor(Infinity)` is Infinity, so a
 * habit could be imported with `dailyGoal: Infinity`:
 *   - `habitMetOn` is false at every count, so the habit can never be completed;
 *   - `habitProgress().ratio` is 0 forever, so the progress bar never moves;
 *   - the editor's goal chip renders the literal string "Infinityx";
 *   - and the confirm-before-apply preview reported it as a clean creation with nothing
 *     skipped, because preview and apply deliberately share one validation pass.
 * It is recoverable (the editor's Stepper clamps Infinity down to its max on the first
 * press) but nothing tells the user their file was bad.
 *
 * These tests pin the guard at the boundary that matters: a file the user could actually
 * upload, driven through the real parse → preview → apply path.
 */
import { AI_SETUP_BEGIN, AI_SETUP_END, AI_SETUP_SCHEMA_VERSION, parseAiSetupFile } from '@/lib/aiSetupGuide';
import { previewAiSetupConfig, applyAiSetupConfig } from '@/lib/aiSetupApply';
import { useHabitStore } from '@/store/useHabitStore';
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

/** A file exactly as a user would upload it, with `dailyGoal` written as a raw literal. */
function habitFile(goalLiteral: string): string {
  return (
    `Here is your UnFocus config.\n${AI_SETUP_BEGIN}\n` +
    `{"version":${AI_SETUP_SCHEMA_VERSION},"habits":[{"title":"Water","kind":"build",` +
    `"recurrence":"daily","category":"health","dailyGoal":${goalLiteral}}]}\n` +
    `${AI_SETUP_END}\n`
  );
}

function parsedConfig(text: string) {
  const p = parseAiSetupFile(text) as { status: string; data: never };
  expect(p.status).toBe('ok');
  return p.data;
}

beforeEach(() => {
  useHabitStore.setState({ habits: [], logs: [] });
});

describe('non-finite numbers from an uploaded file', () => {
  it('1e999 still parses (it is valid JSON) and becomes Infinity', () => {
    // Guards the premise of every test below: the parse layer is NOT the defence.
    const cfg = parsedConfig(habitFile('1e999')) as { habits: { dailyGoal: number }[] };
    expect(Number.isFinite(cfg.habits[0].dailyGoal)).toBe(false);
  });

  it('an Infinity dailyGoal is skipped, not silently created', () => {
    const cfg = parsedConfig(habitFile('1e999'));

    const preview = previewAiSetupConfig(cfg);
    expect(preview.habits.created).toBe(0);
    expect(preview.habits.skipped).toHaveLength(1);

    applyAiSetupConfig(cfg);
    expect(useHabitStore.getState().habits).toHaveLength(0);
  });

  it('the preview and the apply agree about it', () => {
    const cfg = parsedConfig(habitFile('1e999'));
    const preview = previewAiSetupConfig(cfg);
    const applied = applyAiSetupConfig(cfg);
    expect(applied.habits).toEqual(preview.habits);
  });

  it('a finite goal on the same file shape is still imported', () => {
    const cfg = parsedConfig(habitFile('6'));
    applyAiSetupConfig(cfg);
    const habits = useHabitStore.getState().habits;
    expect(habits).toHaveLength(1);
    expect(habits[0].dailyGoal).toBe(6);
  });

  it('an open-ended numeric SETTING rejects Infinity too', () => {
    const before = useSettingsStore.getState().energyDailyCapacity;
    const text =
      `${AI_SETUP_BEGIN}\n` +
      `{"version":${AI_SETUP_SCHEMA_VERSION},"settings":{"energyDailyCapacity":1e999}}\n` +
      `${AI_SETUP_END}\n`;
    const result = applyAiSetupConfig(parsedConfig(text));

    expect(result.settings.applied).not.toContain('energyDailyCapacity');
    expect(useSettingsStore.getState().energyDailyCapacity).toBe(before);
  });

  it('a finite capacity on the same shape is still applied', () => {
    const text =
      `${AI_SETUP_BEGIN}\n` +
      `{"version":${AI_SETUP_SCHEMA_VERSION},"settings":{"energyDailyCapacity":12}}\n` +
      `${AI_SETUP_END}\n`;
    applyAiSetupConfig(parsedConfig(text));
    expect(useSettingsStore.getState().energyDailyCapacity).toBe(12);
  });
});
