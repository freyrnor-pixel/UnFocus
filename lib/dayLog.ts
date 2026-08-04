/**
 * dayLog.ts — what already happened today, as one chronological stream.
 *
 * The half of the day-view that sits BEHIND the now-line. Ahead of now, the day is a
 * proportionally spaced timeline (lib/dayGrid.ts) where gaps read as room. Behind now,
 * the same day collapses into a flush list with no spacing, no durations and no gaps —
 * because a gap ahead of you is runway, and the identical gap behind you is an accusation.
 * The collapse at the now-line is the entire feature.
 *
 * It exists as evidence, not as a productivity surface: something to check when your head
 * says you did nothing. That is why the invariants below are absolute rather than stylistic.
 *
 * Connections:
 *   Imports → none (deliberately — see below)
 *   Used by → lib/useDayLog.ts (the ONLY place that reads stores for this),
 *             components/PlanTaskCard.tsx (renders the entries), app/day-log.tsx
 *   Data    → none — pure functions over plain arrays
 *
 * Edit notes:
 *   - **Dependency-free, and a test enforces it.** Same discipline as lib/cardLayout.ts and
 *     lib/growth.ts: no store imports, no lib/notifications, no lib/reminders, no React.
 *     lib/__tests__/dayLog.test.ts source-scans this file and asserts zero hits. If you need
 *     store state here, pass it in — lib/useDayLog.ts is where that belongs.
 *   - **No counting, ever** (invariant 1). No totals, no "3 of 9", no percentage, no
 *     progress bar, no completion rate. A chaotic day yields a low number and a low number
 *     is a verdict. `DayEntry` deliberately carries no count field and this module exports
 *     no aggregate; the same test asserts nothing here returns a length-derived number.
 *   - **No durations** (invariant 2). Nothing here subtracts two times. The app computes a
 *     duration in exactly one place — lib/episodes.ts's `describeDuration`, rendered on
 *     health-detail rows — and that stays the only one. An entry has an instant, not a span.
 *   - **No notifications** (invariant 4). Nothing on this surface interrupts anyone, at any
 *     horizon. The same source-scan covers this, copied from lib/__tests__/episodes.test.ts,
 *     which is what keeps the equivalent promise true for episodes.
 *   - **Absence beats invention.** An entry with no honest time is dropped, not floated to
 *     the top of the day and not given a synthesised one. Tasks completed before
 *     `tasks.done_at` existed, and tasks a paired device ticked (done_at is not synced),
 *     therefore never appear. A log that guesses is worth less than a log with a hole in it.
 *   - **Habits are in, and on the FIRST log of the day, not on "met".** A habit is a
 *     standing commitment the user set up, so doing it is exactly the evidence this log is
 *     for. Gating on met-ness would import a pass/fail threshold into a surface that has
 *     none — 5 of 7 glasses of water would leave no trace, which reads as "you did nothing"
 *     on precisely the kind of day this exists for. Don't "unify" this with `habitMetOn`.
 *   - Times are LOCAL minutes since midnight — the currency lib/useNowMinutes.ts and
 *     lib/dayGrid.ts already speak. Not epoch ms: the schema has exactly one epoch-ms
 *     column (ifttt_rules.created_at) and lib/db.ts flags it as a legacy outlier.
 */

/**
 * Where an entry came from. Drives the row's icon and accent only — every kind renders in
 * the same flush row shape, because the log answers "what happened", not "what kind of
 * thing happened".
 */
export type DayEntryKind = 'task' | 'habit' | 'medicine' | 'health' | 'moment' | 'calendar';

export type DayEntry = {
  id: string;
  kind: DayEntryKind;
  /** Local minutes since midnight. */
  atMinutes: number;
  label: string;
  /** The origin row's id, for navigating back to it. Absent when there's nowhere to go. */
  sourceId?: string;
};

/**
 * The already-happened rows, in the shapes their stores hand them over in. Each field is
 * pre-narrowed by lib/useDayLog.ts so this module never has to know a store's full type.
 */
export type DayLogSources = {
  /** Completed tasks. `doneAt` is local 'HH:MM'; '' means no honest time and is dropped. */
  tasks: { id: string; title: string; doneAt: string }[];
  /**
   * Habits done at least once on the day. `firstAt` is local 'HH:MM' of the FIRST log.
   *
   * The caller has already excluded rest days and zero counts — see lib/useDayLog.ts.
   * Note what this is NOT: it is not a "was the habit MET" test. The codebase already has
   * several of those (`habitMetOn`, `habitProgress().isDone`, the widget variants) and this
   * deliberately competes with none of them; the log asks the strictly simpler question
   * "did this happen at all today", so a partly-done habit still leaves a trace.
   */
  habits: { id: string; name: string; firstAt: string }[];
  /** Doses taken. `takenAt` is local 'HH:MM', auto-stamped, so it is effectively always set. */
  doses: { id: string; label: string; takenAt: string }[];
  /**
   * Health entries for the day. `startTime` is hand-typed and usually '', so
   * `atMinutes` is resolved by the caller (lib/useDayLog.ts) — which is the one place
   * allowed to convert `createdAt` out of UTC.
   */
  health: { id: string; label: string; atMinutes: number | null }[];
  /** Manually captured lines. */
  moments: { id: string; text: string; atTime: string }[];
};

/** 'H:MM'/'HH:MM' → minutes since midnight, or null if malformed or out of range. */
function timeToMinutes(hhmm: string): number | null {
  const match = hhmm?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Union every source into one chronological stream, oldest first.
 *
 * `cutoffMinutes` is the now-line: entries AFTER it are omitted, because they have not
 * happened yet and belong to the timeline ahead. Pass `1440` to get the whole day (what
 * app/day-log.tsx does for a past date, where every minute is behind you).
 *
 * **The cutoff is inclusive, and that is load-bearing.** Both this and `useNowMinutes` are
 * minute-granular, so the thing a user just did is stamped at exactly the current minute. A
 * strict `<` dropped it for up to 60 seconds — which in practice meant the log looked empty
 * every single time you ticked something, i.e. exactly when you'd look at it. An entry
 * stamped at the current minute has already happened; that is what a timestamp means.
 *
 * Entries with no resolvable time are dropped — see the header's "absence beats invention".
 */
export function buildDayLog(sources: DayLogSources, cutoffMinutes: number): DayEntry[] {
  const entries: DayEntry[] = [];

  for (const t of sources.tasks) {
    const at = timeToMinutes(t.doneAt);
    if (at === null) continue;
    entries.push({ id: `task:${t.id}`, kind: 'task', atMinutes: at, label: t.title, sourceId: t.id });
  }
  for (const h of sources.habits) {
    const at = timeToMinutes(h.firstAt);
    if (at === null) continue;
    entries.push({ id: `habit:${h.id}`, kind: 'habit', atMinutes: at, label: h.name, sourceId: h.id });
  }
  for (const d of sources.doses) {
    const at = timeToMinutes(d.takenAt);
    if (at === null) continue;
    entries.push({ id: `dose:${d.id}`, kind: 'medicine', atMinutes: at, label: d.label, sourceId: d.id });
  }
  for (const h of sources.health) {
    if (h.atMinutes === null) continue;
    entries.push({ id: `health:${h.id}`, kind: 'health', atMinutes: h.atMinutes, label: h.label, sourceId: h.id });
  }
  for (const m of sources.moments) {
    const at = timeToMinutes(m.atTime);
    if (at === null) continue;
    // A moment has no origin record to navigate to — it IS the record. No sourceId.
    entries.push({ id: `moment:${m.id}`, kind: 'moment', atMinutes: at, label: m.text });
  }

  return entries
    .filter((e) => e.atMinutes <= cutoffMinutes)
    // Oldest → newest, so the list reads as the day unfolding. Ties break on the composite
    // id, which is stable and kind-prefixed, so two things logged in the same minute keep
    // a fixed order across renders instead of shuffling (DESIGN_RULES rule 9).
    .sort((a, b) => a.atMinutes - b.atMinutes || a.id.localeCompare(b.id));
}

/** Local minutes since midnight → 'HH:MM', the row's one right-hand value. */
export function formatEntryTime(atMinutes: number): string {
  const h = Math.floor(atMinutes / 60);
  const m = atMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
