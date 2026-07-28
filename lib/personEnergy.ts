/**
 * personEnergy.ts — Energy split per person (2026-07-28, to-do sharing phase 3).
 *
 * lib/energy.ts answers "how much energy is left" for ONE budget — the phone's owner.
 * Once tasks carry an `assigneeId` (phase 1) the same question can be asked per person,
 * which is what turns a shared list into something you can actually divide fairly.
 *
 * **The comparison is against each person's OWN capacity, never against each other's raw
 * totals.** Capacities differ on purpose — that's the entire reason `people.daily_capacity`
 * is per-row and only its owner may edit it (see store/usePeopleStore.ts) — so ranking
 * people by how many energy points they're carrying would quietly punish whoever set an
 * honest, lower number. `pressure` (load ÷ their own capacity) asks the useful question
 * instead: is anyone over-committed relative to what THEY said they had? Two people can
 * both sit at 0.8 while carrying very different absolute loads, and that's correct.
 *
 * Connections:
 *   Imports → lib/energy (the single-budget helpers this reuses), store type imports
 *             (Task/Habit/HabitLog/Person)
 *   Used by → components/EnergyBalanceCard.tsx, lib/__tests__/personEnergy.test.ts
 *   Data    → none (pure functions over arrays the caller already has)
 *
 * Edit notes:
 *   - **Habits are not synced, and this file must not pretend otherwise.** Only `tasks`
 *     crosses the wire (lib/liveSync.ts's `SyncTable`). So for a person with their own
 *     paired phone, this device can see their tasks but never their habits — `tasksOnly`
 *     marks exactly that, and the UI has to say so rather than render a confidently wrong
 *     total. For a hand-kept person (`deviceId === ''`) the habits ARE local, matched by
 *     `childName`, and the figure is complete.
 *   - Habits still match by NAME, not id (phase 1 left `habits.child_name` alone because
 *     that table doesn't sync, so no second device can disagree about who it means).
 *     Renaming a person therefore re-points their habits — acceptable here, and the reason
 *     `matchHabits` is one small function rather than being inlined in three places.
 *   - An empty `assigneeId` means "me", exactly as on app/(tabs)/plans.tsx's person filter:
 *     it covers rows written before the phase-1 back-fill, rows a peer created without
 *     assigning, and rows whose person was removed. None of those should silently vanish
 *     from the household total.
 *   - Keep this pure. It's imported by a component and a test; passing stores in is what
 *     makes the test DB-free.
 */
import {
  energyDeltaForDay,
  energyDeltaForWeek,
  plannedEnergyDeltaForDay,
  plannedEnergyDeltaForWeek,
} from '@/lib/energy';
import type { Task } from '@/store/useTaskStore';
import type { Habit, HabitLog } from '@/store/useHabitStore';
import type { Person } from '@/store/usePeopleStore';

export type EnergyPeriod = 'day' | 'week';

export type PersonEnergyRow = {
  personId: string;
  /** Their own stated capacity for this period — `dailyCapacity` or `weeklyCapacity`. */
  capacity: number;
  /** Signed net of what has ALREADY happened (tasks done, habits met). */
  appliedDelta: number;
  /** Signed net of everything SCHEDULED in the period, done or not. */
  plannedDelta: number;
  /** Energy left right now: capacity + appliedDelta. */
  remaining: number;
  /** Energy left if everything on the books happens: capacity + plannedDelta. */
  projected: number;
  /**
   * How committed they are as a fraction of THEIR OWN capacity: 0 = nothing draining,
   * 1 = exactly their capacity, >1 = over-committed. This is the only number the
   * comparison view ranks by — see the header for why raw totals would be unfair.
   */
  pressure: number;
  /**
   * True when this device can only see their TASKS. Their habits live on their own
   * paired phone and never sync, so the figure is a floor, not a total.
   */
  tasksOnly: boolean;
};

/** Tasks belonging to a person. '' assignee means "me" — see the edit note. */
export function matchTasks(tasks: readonly Task[], person: Person, selfPersonId: string): Task[] {
  return tasks.filter((t) => (t.assigneeId || selfPersonId) === person.id);
}

/**
 * Habits belonging to a person, matched by name ('' = the self row's). Returns nothing
 * for someone whose habits live on their own phone — see `tasksOnly`.
 */
export function matchHabits(habits: readonly Habit[], person: Person): Habit[] {
  if (isTasksOnly(person)) return [];
  const wanted = person.isSelf ? '' : person.name;
  return habits.filter((h) => (h.childName ?? '') === wanted);
}

/**
 * Can this device see everything this person does, or only their tasks? A person with a
 * paired phone keeps their habits there, and habits don't sync.
 */
export function isTasksOnly(person: Person): boolean {
  return !person.isSelf && !!person.deviceId;
}

/**
 * How committed someone is, as a fraction of their own capacity. Only DRAIN counts:
 * a restoring day (a net-positive plan) is not "negative pressure", it's just no
 * pressure, and clamping at 0 keeps the bar from reading as a bonus.
 *
 * A capacity of 0 can't be divided by; anything booked against it is total pressure,
 * and nothing booked is none.
 */
export function energyPressure(capacity: number, plannedDelta: number): number {
  const drain = Math.max(0, -plannedDelta);
  if (drain === 0) return 0;
  if (capacity <= 0) return 1;
  return drain / capacity;
}

/** One person's Energy picture for the day or week containing `date`. */
export function personEnergy(
  date: string,
  period: EnergyPeriod,
  person: Person,
  tasks: readonly Task[],
  habits: readonly Habit[],
  habitLogs: readonly HabitLog[],
  selfPersonId: string,
): PersonEnergyRow {
  const mine = matchTasks(tasks, person, selfPersonId);
  const myHabits = matchHabits(habits, person);
  const capacity = period === 'day' ? person.dailyCapacity : person.weeklyCapacity;

  const appliedDelta =
    period === 'day'
      ? energyDeltaForDay(date, mine, myHabits, habitLogs as HabitLog[])
      : energyDeltaForWeek(date, mine, myHabits, habitLogs as HabitLog[]);
  const plannedDelta =
    period === 'day'
      ? plannedEnergyDeltaForDay(date, mine, myHabits)
      : plannedEnergyDeltaForWeek(date, mine, myHabits);

  return {
    personId: person.id,
    capacity,
    appliedDelta,
    plannedDelta,
    remaining: capacity + appliedDelta,
    projected: capacity + plannedDelta,
    pressure: energyPressure(capacity, plannedDelta),
    tasksOnly: isTasksOnly(person),
  };
}

/**
 * Every person's Energy picture, ordered most-committed first so the comparison view
 * answers "is this fair right now?" without the reader doing the sorting. Ties keep the
 * roster's own order, which is stable across both phones.
 */
export function householdEnergy(
  date: string,
  period: EnergyPeriod,
  people: readonly Person[],
  tasks: readonly Task[],
  habits: readonly Habit[],
  habitLogs: readonly HabitLog[],
): PersonEnergyRow[] {
  const selfPersonId = people.find((p) => p.isSelf)?.id ?? '';
  return people
    .map((p) => personEnergy(date, period, p, tasks, habits, habitLogs, selfPersonId))
    .sort((a, b) => b.pressure - a.pressure);
}

/**
 * The gap between the most- and least-committed person, as a fraction of capacity. This
 * is what makes "the load is lopsided" a number rather than a feeling — but it is only
 * meaningful with at least two people, so a household of one reports 0.
 */
export function energyImbalance(rows: readonly PersonEnergyRow[]): number {
  if (rows.length < 2) return 0;
  const pressures = rows.map((r) => r.pressure);
  return Math.max(...pressures) - Math.min(...pressures);
}
