/**
 * energyModes.test.ts — the two peer modes over `settings.energySystemEnabled`.
 *
 * `energySystemEnabled` is not a feature flag any more (2026-08-02). It names two modes that
 * are peers: **Energy mode** (`true` — cards carry a cost, the day has a capacity, the meter
 * tracks the spend) and **Rewards mode** (`false` — no energy anywhere; finishing something
 * fills its check, and that is the whole of it). The storage did not change; the framing did.
 * Two promises came with that framing and neither had a single test anywhere until this file:
 *
 *   1. **Switching modes is lossless.** Per-task and per-habit `energyEnabled`/`energyValue`
 *      are never written, never cleared, never defaulted while in Rewards mode — the
 *      standing "gate the SURFACE, never the data" rule (store/useSettingsStore.ts). If this
 *      ever broke, a user who tried Rewards mode for an afternoon would come back to every
 *      energy value in the app silently reset, and nothing would tell them.
 *   2. **Rewards mode renders no energy UI.** Asserted structurally, by reading the source of
 *      all five energy surfaces and checking each one's call site sits inside an
 *      `energySystemEnabled` gate — the same technique lib/__tests__/episodes.test.ts uses
 *      for its no-notification promise, and for the same reason: mounting these components
 *      headlessly costs far more than it proves (they are native-heavy and reach half a dozen
 *      stores), while what actually needs guarding is one structural property.
 *
 * The scan is deliberately about the GATE, not about the component: it does not care what the
 * surface draws, only that a call site can never render while the setting is false. If a
 * future change gates a surface some other way (an early `return null`, a wrapper component),
 * this test SHOULD fail — that is a change to how the promise is kept, and it should be
 * re-stated here rather than silently allowed.
 *
 * Headless: only '@/lib/db' and the habit store's native side-effect modules are mocked, the
 * same minimal recipe as __tests__/taskStore.test.ts and __tests__/habitStore.test.ts.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import db from '@/lib/db';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import type { Task } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import type { Habit } from '@/store/useHabitStore';

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
jest.mock('@/lib/habitNotifications', () => ({
  syncHabitReminder: jest.fn(),
  cancelHabitReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/widgets/sync', () => ({ scheduleWidgetSync: jest.fn() }));

const runSync = () => db.runSync as jest.Mock;
/** Every SQL string the store layer has run since the last clear. */
const sqlRun = () => runSync().mock.calls.map(([sql]) => String(sql));

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'T',
    date: '2026-08-02',
    taskType: 'start-at',
    done: false,
    recurring: 'none',
    energyEnabled: true,
    energyValue: 3,
    sortOrder: 0,
    steps: [],
    ...overrides,
  } as Task;
}

function habit(overrides: Partial<Habit>): Habit {
  return {
    id: 'h1',
    title: 'H',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    routineOrder: 0,
    energyEnabled: true,
    energyValue: -2,
    ...overrides,
  } as Habit;
}

beforeEach(() => {
  runSync().mockClear();
  (db.getFirstSync as jest.Mock).mockReset();
  useSettingsStore.setState({ energySystemEnabled: true });
  useTaskStore.setState({
    tasks: [task({ id: 't1' }), task({ id: 't2', energyEnabled: false, energyValue: 0 })],
    deletedTasks: [],
  });
  useHabitStore.setState({
    habits: [habit({ id: 'h1' }), habit({ id: 'h2', energyEnabled: false, energyValue: 5 })],
  });
});

/** Snapshot of only the fields the mode is forbidden to touch. */
const energyOf = () => ({
  tasks: useTaskStore.getState().tasks.map((t) => ({ id: t.id, on: t.energyEnabled, v: t.energyValue })),
  habits: useHabitStore.getState().habits.map((h) => ({ id: h.id, on: h.energyEnabled, v: h.energyValue })),
});

describe('the mode is one boolean, and it is real storage', () => {
  it('Energy mode is what a fresh install lands in', () => {
    // The column's own DEFAULT is where a fresh install actually gets its answer — the
    // store's in-memory default only covers the moments before load() resolves.
    const migrations = readFileSync(join(__dirname, '..', '..', 'lib/db.ts'), 'utf8');
    expect(migrations).toContain('ADD COLUMN energy_system_enabled INTEGER DEFAULT 1');
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, energy_system_enabled: 1 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().energySystemEnabled).toBe(true);
  });

  // Rewards mode is DISABLED, not hidden: it round-trips through the same column, so an app
  // relaunched in Rewards mode comes back in Rewards mode rather than reverting to Energy.
  it('Rewards mode round-trips through energy_system_enabled', () => {
    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, energy_system_enabled: 0 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().energySystemEnabled).toBe(false);

    (db.getFirstSync as jest.Mock).mockReturnValue({ id: 1, energy_system_enabled: 1 });
    useSettingsStore.getState().load();
    expect(useSettingsStore.getState().energySystemEnabled).toBe(true);
  });

  it.each([
    ['rewards', false, 0],
    ['energy', true, 1],
  ])('picking %s mode writes only energy_system_enabled', (_mode, value, column) => {
    useSettingsStore.getState().update({ energySystemEnabled: value });
    const [sql, params] = runSync().mock.calls.at(-1)!;
    expect(String(sql)).toContain('energy_system_enabled');
    expect(params).toContain(column);
    expect(useSettingsStore.getState().energySystemEnabled).toBe(value);
  });
});

describe('switching modes is lossless', () => {
  it('leaves every per-task and per-habit energy value untouched in Rewards mode', () => {
    const before = energyOf();
    useSettingsStore.getState().update({ energySystemEnabled: false });
    expect(energyOf()).toEqual(before);
  });

  it('restores nothing on the way back, because nothing was lost', () => {
    const before = energyOf();
    useSettingsStore.getState().update({ energySystemEnabled: false });
    useSettingsStore.getState().update({ energySystemEnabled: true });
    expect(energyOf()).toEqual(before);
    // Specifically: the values are the ORIGINALS, not re-derived defaults (energyValue
    // defaults to 1 on read, so a silent reset would look plausible rather than obviously
    // wrong — that is exactly why this is pinned to literals).
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ energyEnabled: true, energyValue: 3 });
    expect(useHabitStore.getState().habits[0]).toMatchObject({ energyEnabled: true, energyValue: -2 });
    expect(useHabitStore.getState().habits[1]).toMatchObject({ energyEnabled: false, energyValue: 5 });
  });

  it('writes no SQL against tasks or habits when the mode changes', () => {
    runSync().mockClear();
    useSettingsStore.getState().update({ energySystemEnabled: false });
    useSettingsStore.getState().update({ energySystemEnabled: true });
    const statements = sqlRun();
    expect(statements.length).toBeGreaterThan(0);
    for (const sql of statements) {
      expect(sql).toContain('settings');
      expect(sql).not.toMatch(/\b(tasks|habits|task_steps|habit_logs)\b/);
      expect(sql).not.toContain('energy_enabled');
      expect(sql).not.toContain('energy_value');
    }
  });
});

/**
 * Every energy surface in the app, and the token that only renders when it draws. The list is
 * the contract: adding a sixth energy surface means adding a line here, and a surface that is
 * NOT in this list is one nothing stops from drawing in Rewards mode.
 */
const ENERGY_SURFACES: { what: string; file: string; token: string }[] = [
  { what: "Home's Energy strip", file: 'app/(tabs)/index.tsx', token: '<EnergyMeter' },
  { what: 'the shared-load card', file: 'components/TodoSurface.tsx', token: '<EnergyBalanceCard' },
  { what: "the task editor's energy stepper", file: 'components/TaskCard.tsx', token: 't.energyGiveTakeLabel' },
  { what: "the habit form's energy stepper", file: 'app/habit-form.tsx', token: 't.energyGiveTakeLabel' },
  // components/HabitsSurface.tsx since the 2026-08-20 extraction; app/habits.tsx is a wrapper.
  { what: "the Habits tab's own quick-add energy row", file: 'components/HabitsSurface.tsx', token: '<QuickAddOptionRow' },
];

describe('Rewards mode renders no energy UI', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');
  // Strip comments so prose ABOUT the gate can neither satisfy the scan nor, via the braces
  // these files quote inside JSX comments, confuse the brace walk. Line comments are only
  // stripped when `//` is not preceded by `:`, so a `https://` inside a string survives.
  const code = (rel: string) =>
    read(rel)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  /**
   * The opening text of every `{ … }` expression container enclosing `at`, innermost first.
   * Walked backwards with a depth counter, so a balanced `style={…}` sibling in between is
   * skipped rather than mistaken for an ancestor. The gate is an ANCESTOR of the token, never
   * necessarily its immediate parent — a stepper's label sits inside its own `{…}`, inside a
   * `<Text>`, inside a `<View>`, inside the gate — so all of them are collected and the token
   * counts as gated if ANY of them is the gate. An empty list means the token renders at the
   * top level of the component, gated by nothing.
   */
  function enclosingExpressions(source: string, at: number): string[] {
    const found: string[] = [];
    let depth = 0;
    for (let i = at - 1; i >= 0; i--) {
      const ch = source[i];
      if (ch === '}') depth++;
      else if (ch === '{') {
        if (depth === 0) found.push(source.slice(i + 1, at).trimStart().slice(0, 60));
        else depth--;
      }
    }
    return found;
  }

  it.each(ENERGY_SURFACES)('$what ($file) is behind an energySystemEnabled gate', ({ file, token }) => {
    const source = code(file);
    const occurrences: number[] = [];
    for (let i = source.indexOf(token); i !== -1; i = source.indexOf(token, i + 1)) occurrences.push(i);
    // A token that has vanished means the surface moved or was renamed — the gate it used to
    // sit behind is then unverified, which is a failure, not a pass.
    expect(occurrences.length).toBeGreaterThan(0);
    const GATE = /^energySystemEnabled\s*(&&|\?)/;
    for (const at of occurrences) {
      const ancestors = enclosingExpressions(source, at);
      // Reported as the ancestor chain so a failure says WHERE the token ended up, not just
      // that it isn't gated.
      expect(ancestors.filter((a) => GATE.test(a))).not.toEqual([]);
    }
  });

  // The setting is read from the store at each call site rather than passed down, so a screen
  // cannot end up rendering against a stale copy of the mode.
  it.each(ENERGY_SURFACES.map((s) => s.file))('%s reads the mode from useSettingsStore', (file) => {
    expect(code(file)).toMatch(/useSettingsStore\(\s*\(s\) => s\.energySystemEnabled\s*\)/);
  });

  // Settings must offer the two modes as PEERS. A FormSwitch row would put Rewards mode back
  // to being "Energy, off" — the exact framing the modes exist to replace — so the control
  // tier is asserted, not just the presence of the key.
  it('Settings draws the two modes as a SegmentedControl, not a feature switch', () => {
    const source = code('app/settings.tsx');
    expect(source).toMatch(/<SegmentedControl[\s\S]{0,400}energySystemEnabled/);
    expect(source).toContain('t.config.features.energy.modes.energy.label');
    expect(source).toContain('t.config.features.energy.modes.rewards.label');
    // It must NOT be one of the plain on/off rows.
    expect(source).not.toMatch(/key:\s*'energySystemEnabled'/);
  });

  // Onboarding used to offer the same two modes one tier down, on app/onboarding/energy.tsx.
  // That screen was DELETED on 2026-08-03 when onboarding was cut from six screens to two: it
  // asked a new user to choose between Energy and Rewards having seen neither, under a heading
  // whose own opening line explained why it needed explaining. Energy is the default and
  // always was; Settings → Advanced is now the only place the choice is offered, which the
  // block above pins.
  //
  // Asserted as an absence rather than deleted outright, because "put the mode choice back
  // into onboarding" is exactly the well-meaning change this pass exists to prevent, and a
  // silently-missing test would not catch it.
  it('does not ask a brand-new user to choose a mode', () => {
    expect(existsSync(join(__dirname, '..', '..', 'app', 'onboarding', 'energy.tsx'))).toBe(false);
    for (const seg of ['basics', 'privacy', 'restore']) {
      const source = code(`app/onboarding/${seg}.tsx`);
      expect({ seg, mentions: source.includes('energySystemEnabled') }).toEqual({ seg, mentions: false });
    }
  });
});
