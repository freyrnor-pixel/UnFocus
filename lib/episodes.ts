/**
 * episodes.ts — ongoing symptom episodes: state, backdating, duration-on-read
 *
 * A symptom entry that is STILL HAPPENING, as opposed to one logged after the fact.
 * `episode_state` on `health_logs` is the single source of truth for that; nothing
 * anywhere may re-derive open/closed from `end_date` (see EPISODES.md §1.5 — `end_date = ''`
 * already means three different things and reading it as "open" would reclassify years of
 * history as open episodes).
 *
 * **It is not a stopwatch.** No live elapsed-time counter, anywhere, at any point. An episode
 * is a STATE, not a stretch of elapsed time. Duration is computed here on read, rounded into
 * plain language, and shown in exactly one place (a history row's value column). It is never
 * stored, never totalled, never averaged.
 *
 * **The hard limit on relief data** (`relief_note` / `relief_medicine_id`, written by the
 * close sheet): recorded relief is **displayed plainly and never interpreted**. No causal
 * claim, no correlation, no strength, no percentage, no trend arrow, no "works / doesn't
 * work", no ranking of what helps most, no "you usually take X for this". A list of what was
 * logged, nothing inferred. This is a diary, not a clinical tool: the sample size is always
 * one, the confounders are unbounded, and a user acting on an app's inference about their
 * medication is a harm this feature must not be able to cause.
 *
 * Connections:
 *   Imports → lib/date (dateStr, parseDateStr, parseTimeToMinutes — pure helpers only)
 *   Used by → store/useHealthStore.ts (toEpisodeState on read), app/(tabs)/health.tsx
 *             (openEpisodes), components/OpenEpisodeCard.tsx, components/EpisodeCloseSheet.tsx
 *             (backdatedStart, reliefCandidates, closePatch), app/health-detail.tsx
 *             (episodeDurationMinutes + describeDuration), app/health-form.tsx (backdatedStart)
 *   Data    → none. Plain values in, plain values out — this module reaches no store, no DB,
 *             no notification layer. lib/__tests__/episodes.test.ts asserts that structurally.
 *
 * Edit notes:
 *   - **Nothing in this feature ever produces a notification.** No scheduled reminder, no
 *     auto-close at any horizon, no escalation of the prompt. A push about an open illness
 *     episode is a nag about being unwell. episodes.test.ts source-scans this file and both
 *     episode components for notification APIs and asserts zero hits — that test is what keeps
 *     the promise true, so don't relax it.
 *   - `toEpisodeState` degrades UNRECOGNISED input to 'point', never to 'ongoing'. A legacy
 *     NULL, a typo or a value from a newer build must not silently open an episode.
 *   - `backdatedStart` takes `now` as an argument and never reads the clock itself, so it is
 *     testable without fake timers. 'lastNight' is 21:00 on the PREVIOUS day — the only reason
 *     this needs a helper rather than inline code.
 *   - `describeDuration` returns a bucket KEY, never minutes. Nothing may render `3h 47m`:
 *     the underlying data is a wall-clock pair the user typed from memory, and rendering it to
 *     the minute implies a precision it does not have.
 *   - An uncomputable duration (a legacy row, or an unparseable/missing time) returns null and
 *     the caller renders NOTHING — not "unknown", not "—".
 */
import { dateStr, parseDateStr, parseTimeToMinutes } from '@/lib/date';

/**
 * The single source of truth for whether an entry is still happening.
 *   'point'   — a moment logged after it was over (every legacy row, and the default for a
 *               new entry, because most logging happens afterwards)
 *   'ongoing' — still happening right now
 *   'closed'  — was ongoing, then ended; end_date/end_time carry when
 */
export type EpisodeState = 'point' | 'ongoing' | 'closed';

const EPISODE_STATES: readonly EpisodeState[] = ['point', 'ongoing', 'closed'];

/** Anything unrecognised (legacy NULL, '', a typo, a value from a newer build) degrades to
 *  'point'. The direction matters: never 'ongoing'. */
export function toEpisodeState(raw: string): EpisodeState {
  return (EPISODE_STATES as readonly string[]).includes(raw) ? (raw as EpisodeState) : 'point';
}

/** State only — never `endDate`. This replaces the scattered `endDate === ''` checks. */
export function isOpen(log: { episodeState: EpisodeState }): boolean {
  return log.episodeState === 'ongoing';
}

/** Every still-happening entry, in input order. */
export function openEpisodes<T extends { episodeState: EpisodeState }>(logs: T[]): T[] {
  return logs.filter(isOpen);
}

/** The three one-tap shortcuts offered wherever a time is asked for. 'pickTime' is the
 *  fourth option in the UI but resolves to nothing on its own — it reveals the date/time
 *  fields instead, so it is deliberately not part of this type. */
export type BackdatePreset = 'now' | 'thisMorning' | 'lastNight';

/**
 * Resolves a preset against a supplied `now` (injected, never read from the clock inside).
 * The presets always produce a concrete `HH:MM` and never write '' — that is what makes
 * duration computable for every episode created through this feature.
 */
export function backdatedStart(preset: BackdatePreset, now: Date): { date: string; time: string } {
  if (preset === 'thisMorning') return { date: dateStr(now), time: '08:00' };
  if (preset === 'lastNight') {
    const prev = new Date(now);
    prev.setDate(prev.getDate() - 1);
    return { date: dateStr(prev), time: '21:00' };
  }
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return { date: dateStr(now), time };
}

/** Absolute minute index for a `YYYY-MM-DD` + `HH:MM` pair, or null if either is missing
 *  or unparseable. Local wall-clock throughout, matching the columns it reads. */
function absoluteMinutes(date: string, time: string): number | null {
  if (!date || !time) return null;
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return null;
  const d = parseDateStr(date);
  if (Number.isNaN(d.getTime())) return null;
  // Day index from the epoch in LOCAL days — parseDateStr returns local midnight, so this
  // stays correct across DST because both ends are rounded to the same local-midnight grid.
  const dayIndex = Math.round(
    (d.getTime() - new Date(1970, 0, 1).getTime()) / 86400000
  );
  return dayIndex * 1440 + minutes;
}

/**
 * null unless all four of log_date / start_time / end_date / end_time are present and
 * parseable, and the end is not before the start. A negative span (an end typed before the
 * start) returns null rather than a bogus value — there is no error state and no correction
 * prompt; the row simply carries no value.
 */
export function episodeDurationMinutes(log: {
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
}): number | null {
  const start = absoluteMinutes(log.date, log.startTime);
  const end = absoluteMinutes(log.endDate, log.endTime);
  if (start === null || end === null) return null;
  const span = end - start;
  return span < 0 ? null : span;
}

/** Bucket key (+ a count where the bucket carries one) for the history value column.
 *  null → render nothing. Never returns a minutes value: see the header. */
export type DurationDescription =
  | { kind: 'underHour' | 'aboutAnHour' | 'mostOfADay' | 'aboutADay' }
  | { kind: 'hours' | 'days'; n: number };

export function describeDuration(minutes: number | null): DurationDescription | null {
  if (minutes === null || minutes < 0) return null;
  if (minutes < 60) return { kind: 'underHour' };
  if (minutes < 90) return { kind: 'aboutAnHour' };
  if (minutes < 600) return { kind: 'hours', n: Math.round(minutes / 60) };
  if (minutes < 1080) return { kind: 'mostOfADay' };
  if (minutes < 2160) return { kind: 'aboutADay' };
  return { kind: 'days', n: Math.round(minutes / 1440) };
}

/**
 * Medicines with a dose logged between the episode's start and its stop, inclusive at both
 * bounds — the one-tap chips on the close sheet. Doses and medicines are passed in; this
 * module never reads a store.
 *
 * This is a FILTER, not a claim. A medicine appearing here means only "you took this while
 * it was happening" — see the header's hard limit.
 */
export function reliefCandidates<M extends { id: string; name: string }>(
  medicines: M[],
  doses: { medicineId: string; date: string; takenAt: string }[],
  episode: { date: string; startTime: string },
  stop: { date: string; time: string },
): M[] {
  const from = absoluteMinutes(episode.date, episode.startTime);
  const to = absoluteMinutes(stop.date, stop.time);
  if (from === null || to === null) return [];
  const hit = new Set<string>();
  for (const dose of doses) {
    const at = absoluteMinutes(dose.date, dose.takenAt);
    if (at === null || at < from || at > to) continue;
    hit.add(dose.medicineId);
  }
  return medicines.filter((m) => hit.has(m.id));
}

/**
 * The one atomic patch that closes an episode. It can never produce a patch that sets the
 * state without an end, or an end without the state — that intermediate row would be exactly
 * the ambiguity `episode_state` exists to remove.
 *
 * Omitted relief fields become '' rather than undefined: `rowValues` skips undefined keys, so
 * an undefined here would silently leave a previous value in place on a re-close.
 */
export function closePatch(input: {
  stop: { date: string; time: string };
  reliefNote?: string;
  reliefMedicineId?: string;
}): {
  episodeState: 'closed';
  endDate: string;
  endTime: string;
  reliefNote: string;
  reliefMedicineId: string;
} {
  return {
    episodeState: 'closed',
    endDate: input.stop.date,
    endTime: input.stop.time,
    reliefNote: input.reliefNote?.trim() ?? '',
    reliefMedicineId: input.reliefMedicineId ?? '',
  };
}
