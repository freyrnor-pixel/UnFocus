/**
 * bonsai.test.ts — unit tests for lib/bonsai.ts (the Bonsai/points reward system).
 *
 * Pure functions, no mocks. Verifies: stage thresholds pick the right stage and never
 * regress the tree below a lower one; stage progress ratios; health decays linearly to 0
 * and floors there (no punishment, no reset); and daysSinceLastTended finds the most
 * recent met habit within the decay window, honouring rest days and weekly-flexible habits.
 */
import {
  BONSAI_STAGES,
  BONSAI_POINTS_PER_HABIT,
  BONSAI_HEALTH_DECAY_DAYS,
  bonsaiStageIndex,
  bonsaiStageProgress,
  bonsaiHealth,
  daysSinceLastTended,
  bonsaiState,
} from '@/lib/bonsai';
import type { Habit, HabitLog } from '@/store/useHabitStore';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    title: 'Drink water',
    icon: 'ellipse-outline',
    kind: 'neutral',
    category: 'health',
    cue: '',
    craving: '',
    response: '',
    reward: '',
    dailyGoal: 1,
    recurrence: 'daily',
    recurrenceDays: [],
    notificationEnabled: false,
    notificationTimes: [],
    reminderMode: null,
    reminderCount: null,
    reminderIntervalMin: null,
    reminderStart: null,
    reminderEnd: null,
    routineOrder: 0,
    active: true,
    createdAt: '',
    childName: '',
    energyEnabled: false,
    energyValue: 1,
    goalId: null,
    ...overrides,
  };
}

function makeLog(overrides: Partial<HabitLog> = {}): HabitLog {
  return { id: 'l1', habitId: 'h1', logDate: '2026-07-31', count: 1, restDay: false, ...overrides };
}

describe('BONSAI_POINTS_PER_HABIT', () => {
  it('is a positive constant', () => {
    expect(BONSAI_POINTS_PER_HABIT).toBeGreaterThan(0);
  });
});

describe('bonsaiStageIndex', () => {
  it('starts at seed (index 0) with no points', () => {
    expect(bonsaiStageIndex(0)).toBe(0);
  });

  it('picks the highest stage whose threshold has been reached', () => {
    const last = BONSAI_STAGES[BONSAI_STAGES.length - 1];
    expect(bonsaiStageIndex(last.threshold)).toBe(BONSAI_STAGES.length - 1);
    expect(bonsaiStageIndex(last.threshold - 1)).toBeLessThan(BONSAI_STAGES.length - 1);
  });

  it('never exceeds the final stage past its threshold', () => {
    const last = BONSAI_STAGES[BONSAI_STAGES.length - 1];
    expect(bonsaiStageIndex(last.threshold + 100000)).toBe(BONSAI_STAGES.length - 1);
  });

  it('thresholds are strictly increasing (monotonic growth, no stage overlap)', () => {
    for (let i = 1; i < BONSAI_STAGES.length; i++) {
      expect(BONSAI_STAGES[i].threshold).toBeGreaterThan(BONSAI_STAGES[i - 1].threshold);
    }
  });
});

describe('bonsaiStageProgress', () => {
  it('ratio is 0 right at a stage threshold', () => {
    const { ratio } = bonsaiStageProgress(BONSAI_STAGES[1].threshold);
    expect(ratio).toBeCloseTo(0, 5);
  });

  it('ratio approaches 1 just before the next stage', () => {
    const next = BONSAI_STAGES[2].threshold;
    const { ratio } = bonsaiStageProgress(next - 1);
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1);
  });

  it('ratio is null at the final stage — nothing left to reach', () => {
    const last = BONSAI_STAGES[BONSAI_STAGES.length - 1];
    const { ratio, index } = bonsaiStageProgress(last.threshold + 500);
    expect(ratio).toBeNull();
    expect(index).toBe(BONSAI_STAGES.length - 1);
  });
});

describe('bonsaiHealth', () => {
  it('is full (1) when tended today', () => {
    expect(bonsaiHealth(0)).toBe(1);
  });

  it('decays linearly toward 0 across the decay window', () => {
    expect(bonsaiHealth(BONSAI_HEALTH_DECAY_DAYS / 2)).toBeCloseTo(0.5, 5);
  });

  it('floors at 0 at and past the decay window — grey, never negative', () => {
    expect(bonsaiHealth(BONSAI_HEALTH_DECAY_DAYS)).toBe(0);
    expect(bonsaiHealth(BONSAI_HEALTH_DECAY_DAYS + 50)).toBe(0);
  });

  it('treats "never tended" (null) as fully decayed', () => {
    expect(bonsaiHealth(null)).toBe(0);
  });
});

describe('daysSinceLastTended', () => {
  const today = '2026-07-31';

  it('returns 0 when a habit was met today', () => {
    const habit = makeHabit();
    const logs = [makeLog({ logDate: today, count: 1 })];
    expect(daysSinceLastTended([habit], logs, today)).toBe(0);
  });

  it('returns the offset of the most recent met day', () => {
    const habit = makeHabit();
    const logs = [makeLog({ logDate: '2026-07-28', count: 1 })]; // 3 days ago
    expect(daysSinceLastTended([habit], logs, today)).toBe(3);
  });

  it('returns null when nothing was met within the decay window', () => {
    const habit = makeHabit();
    const logs = [makeLog({ logDate: '2026-07-01', count: 1 })]; // well outside the window
    expect(daysSinceLastTended([habit], logs, today)).toBeNull();
  });

  it('a rest day does not count as tended', () => {
    const habit = makeHabit();
    const logs = [makeLog({ logDate: today, count: 0, restDay: true })];
    expect(daysSinceLastTended([habit], logs, today)).toBeNull();
  });

  it('an unmet log (count below goal) does not count as tended', () => {
    const habit = makeHabit({ dailyGoal: 3 });
    const logs = [makeLog({ logDate: today, count: 1 })];
    expect(daysSinceLastTended([habit], logs, today)).toBeNull();
  });
});

describe('bonsaiState', () => {
  it('bundles points, stage and health for a never-tended, no-points state', () => {
    const state = bonsaiState([], [], 0, '2026-07-31');
    expect(state).toEqual({ points: 0, stageIndex: 0, stageKey: 'seed', stageRatio: 0, health: 0 });
  });

  it('reflects a grown, currently-tended tree', () => {
    const habit = makeHabit();
    const logs = [makeLog({ logDate: '2026-07-31', count: 1 })];
    const state = bonsaiState([habit], logs, BONSAI_STAGES[2].threshold, '2026-07-31');
    expect(state.stageKey).toBe('sapling');
    expect(state.health).toBe(1);
  });
});
