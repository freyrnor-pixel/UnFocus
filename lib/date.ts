/**
 * date.ts — local-date string helpers (YYYY-MM-DD).
 *
 * Tiny utilities for formatting a Date as a local `YYYY-MM-DD` string, the
 * canonical date format used across the app's SQLite date columns and UI.
 * Uses local time (getFullYear/getMonth/getDate), never UTC.
 * Currency formatting lives separately in lib/money.ts (formatKr).
 *
 * Connections:
 *   Imports → —
 *   Used by → components/SharedRequestsSection.tsx, app/shopping.tsx, app/budget.tsx,
 *             app/shared.tsx, store/useShoppingListStore.ts
 *             (formatDisplayDate — Norwegian date display, code-only, no ledger number;
 *             see Decision 028's numbering note — renders stored ISO keys as DD.MM.YYYY in NO)
 *   Data    → none
 *
 * Edit notes:
 *   - These are LOCAL-time formatters; do not switch to toISOString() (UTC) or
 *     off-by-one-day bugs appear around midnight / timezone boundaries.
 *   - `parseTimeToMinutes`/`addDurationToTime` back app/(tabs)/health.tsx's Quick log
 *     start-time + duration fields — duration is quick-log-only UI, converted to
 *     endDate/endTime here so the store's existing HealthLog shape is unchanged.
 *   - `nowHHMM`/`utcStampToLocalMinutes` (2026-08-02) back the day log (lib/dayLog.ts).
 *     `nowHHMM` lived privately in store/useMedicineStore.ts for months — that file's
 *     header already claimed it imported "current HH:MM" from here, so this is the
 *     stale claim being made true, not a new convention.
 *   - `utcStampToLocalMinutes` is the ONE place that crosses the UTC/local line. The
 *     schema has three timestamp shapes: local `YYYY-MM-DD` (todayStr/dateStr), ISO-8601
 *     UTC (`toISOString()`, the sync/created_at family), and SQLite `datetime('now')`
 *     (`YYYY-MM-DD HH:MM:SS`, ALSO UTC — the CREATE TABLE defaults). Reading the third
 *     as if it were local shifts an entry 1–2h in Norway, which is exactly the kind of
 *     quiet lie a day log must not tell. Convert here, nowhere else.
 */
/**
 * The language codes the two display formatters below branch on. Declared here rather
 * than imported from lib/i18n so this module stays dependency-free (see the header) —
 * it is structurally the same union as `Lang`, and tsc catches a drift at every call
 * site, all of which pass the store's `language` straight through.
 */
export type DateLang = 'en' | 'no' | 'is';

export function todayStr(): string {
  const d = new Date();
  return dateStr(d);
}

export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse a `YYYY-MM-DD` string into a local Date (midnight). Inverse of dateStr(). */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Current local month as `YYYY-MM` (e.g. receipts/budget tracking). */
export function currentMonthStr(): string {
  return todayStr().slice(0, 7);
}

/** Convert Date.getDay() (0 = Sun, 6 = Sat) to app convention (0 = Mon, 6 = Sun). */
export function dayOfWeekMon0(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** App weekday (0 = Mon … 6 = Sun) → Expo weekday (1 = Sun … 7 = Sat). */
export function toExpoWeekday(mon0: number): number {
  return ((mon0 + 1) % 7) + 1;
}

/** The seven `YYYY-MM-DD` dates of the Mon–Sun week containing `today`. */
export function getWeekDates(today: string): string[] {
  const d = new Date(today + 'T12:00:00');
  const mon = new Date(d);
  mon.setDate(d.getDate() - dayOfWeekMon0(d));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    return dateStr(day);
  });
}

/** Every `YYYY-MM-DD` date in the given month (`month` is 1-based: 1 = January). */
export function getMonthDates(year: number, month: number): string[] {
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });
}

/**
 * The Mon–Sun calendar week of the currently-active weekly shopping list period.
 * `weeklyResetDay` (0 = Mon … 6 = Sun) is the weekday the list rolls over on — until
 * that weekday arrives, the active period is still last week's, even though `today`
 * has already crossed into a new Mon–Sun week. E.g. resetDay = Tuesday: on a Monday
 * the active period is still the previous Mon–Sun week; from Tuesday on, it's the
 * current one — named by its own Mon–Sun span regardless of which day resets it
 * (a Tuesday-the-20th reset still names the list "19–25").
 */
export function getWeekRangeContaining(today: string, weeklyResetDay: number): { startDate: string; endDate: string } {
  const d = new Date(today + 'T12:00:00');
  const daysSinceReset = (dayOfWeekMon0(d) - weeklyResetDay + 7) % 7;
  d.setDate(d.getDate() - daysSinceReset);
  const week = getWeekDates(dateStr(d));
  return { startDate: week[0], endDate: week[6] };
}

/**
 * Which week (1–4) of the current monthly cycle `today` falls in, where a cycle
 * runs from one monthly-reset boundary to the next. `monthlyResetDate` is a
 * day-of-month (1–28ish); the most recent boundary is that day in the current
 * month, or in the previous month if today is earlier than it. Week 1 is the
 * reset day through day 6, week 2 is days 7–13, etc.; clamped to 1–4 so a long
 * (5-week) cycle still maps its tail into week 4. Used to decide whether a weekly
 * list scheduled for specific weeks-of-the-month is active this week.
 */
export function weekOfMonthlyCycle(today: string, monthlyResetDate: number): number {
  const d = new Date(today + 'T12:00:00');
  const boundary = new Date(d);
  boundary.setDate(monthlyResetDate);
  if (d.getDate() < monthlyResetDate) boundary.setMonth(boundary.getMonth() - 1);
  const daysSince = Math.floor((d.getTime() - boundary.getTime()) / 86400000);
  return Math.min(4, Math.max(1, Math.floor(daysSince / 7) + 1));
}

/**
 * Inverse of weekOfMonthlyCycle: the Mon–Sun shopping-week range for week `week`
 * (1–4) of the monthly cycle that `today` currently sits in. Finds the same cycle
 * boundary weekOfMonthlyCycle() anchors to, steps forward `(week-1)*7` days, then
 * hands that date to getWeekRangeContaining() so the result is a real shopping
 * week (respecting `weeklyResetDay`), not just a raw 7-day slice from the
 * boundary. Used to reassign a dragged weekly list to a different week-of-cycle
 * section.
 */
export function dateRangeForCycleWeek(
  today: string,
  monthlyResetDate: number,
  week: number,
  weeklyResetDay: number
): { startDate: string; endDate: string } {
  const d = new Date(today + 'T12:00:00');
  const boundary = new Date(d);
  boundary.setDate(monthlyResetDate);
  if (d.getDate() < monthlyResetDate) boundary.setMonth(boundary.getMonth() - 1);
  const target = new Date(boundary);
  target.setDate(boundary.getDate() + (week - 1) * 7);
  return getWeekRangeContaining(dateStr(target), weeklyResetDay);
}

/**
 * Render a stored `YYYY-MM-DD` key as a user-facing date string (Norwegian date
 * display — code-only, no ledger number; see Decision 028's numbering note).
 * Norwegian convention is DD.MM.YYYY; English keeps the ISO `YYYY-MM-DD` form.
 * Icelandic writes dates the same way Norwegian does (DD.MM.YYYY), so it shares
 * that branch rather than getting one of its own.
 * DISPLAY ONLY — never feed the result back into a store/DB key or a comparison;
 * the ISO string stays the canonical key everywhere else. Malformed input is
 * returned unchanged so a bad value never crashes a render.
 */
export function formatDisplayDate(iso: string, lang: DateLang): string {
  const parts = iso.split('-');
  if (parts.length !== 3 || parts.some((p) => p === '')) return iso;
  const [y, m, d] = parts;
  return lang === 'en' ? iso : `${d}.${m}.${y}`;
}

/** Current local wall-clock time as `HH:MM`. Minute resolution — nothing in the app needs seconds. */
export function nowHHMM(): string {
  return formatMinutesAsTime(localMinutesOf(new Date()));
}

/**
 * Converts a SQLite `datetime('now')` stamp (`'YYYY-MM-DD HH:MM:SS'`, **UTC** — the
 * shape every CREATE TABLE `created_at` default writes) to local minutes since midnight,
 * but ONLY when it lands on `localDate`. Returns null otherwise, and on anything that
 * doesn't parse.
 *
 * The null-on-different-day rule is the point: a row created at 23:30 UTC is 01:30 the
 * NEXT local day in Norway. Silently folding that into the wrong day's log would make
 * the log assert something that didn't happen, so the caller drops it instead. ISO-8601
 * stamps (`toISOString()`, with the `T`/`Z`) parse here too — same instant, same rule.
 */
export function utcStampToLocalMinutes(stamp: string, localDate: string): number | null {
  const trimmed = stamp?.trim();
  if (!trimmed) return null;
  // `YYYY-MM-DD HH:MM:SS` has no timezone designator, so Date would read it as LOCAL.
  // Normalise to an explicit UTC instant before parsing; an already-ISO stamp is left alone.
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  if (dateStr(d) !== localDate) return null;
  return localMinutesOf(d);
}

/**
 * Parses a strict `H:MM`/`HH:MM` 24h time string into minutes since midnight, or null if
 * malformed/out of range.
 *
 * Accepts null/undefined (returning null) because several callers pass an optional column
 * straight through. lib/dayLog.ts and lib/useDayLog.ts each held a byte-identical private
 * copy of this — with exactly that optional-chain as the only difference — until 2026-08-12;
 * widening the parameter is what let both drop theirs.
 */
export function parseTimeToMinutes(hhmm: string | null | undefined): number | null {
  const match = hhmm?.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Minutes-since-midnight → `'HH:MM'`, wrapping past midnight (1500 → `'01:00'`) and
 * rounding a fractional input.
 *
 * The inverse of `parseTimeToMinutes`, and the single implementation of a `padStart(2,'0')`
 * pair that used to be written out in three places (lib/medicineSchedule's `formatMinutes`,
 * lib/dayLog's `formatEntryTime`, and inline in `addDurationToTime` below). The wrap is a
 * no-op for an in-range value, so it is safe for the callers that never cross midnight.
 */
export function formatMinutesAsTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * Minutes since midnight for a Date, in LOCAL time — the scale lib/dayGrid.ts,
 * lib/medicineSchedule.ts and the timeline all work in. Was re-inlined in three places.
 */
export function localMinutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Adds `durationMin` minutes to `startTime` (`HH:MM`, on the local date `dateKey`,
 * `YYYY-MM-DD`), rolling the date forward if the duration crosses midnight. Returns
 * null when `startTime` doesn't parse or `durationMin` isn't a positive number — the
 * caller's UI passes free-text/optional fields through, so a bad or absent duration
 * should just skip the end date/time rather than throw.
 */
export function addDurationToTime(
  dateKey: string,
  startTime: string,
  durationMin: number
): { endDate: string; endTime: string } | null {
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes === null || !Number.isFinite(durationMin) || durationMin <= 0) return null;
  const endTotal = startMinutes + durationMin;
  const endTime = formatMinutesAsTime(endTotal);
  const endDateObj = parseDateStr(dateKey);
  endDateObj.setDate(endDateObj.getDate() + Math.floor(endTotal / 1440));
  return { endDate: dateStr(endDateObj), endTime };
}

/**
 * Formats a `[startDate, endDate]` pair as a short, locale-aware range label,
 * e.g. "May 1 – 7" / "1.–7. mai" (same month) or "Apr 29 – May 5" / "29. apr–5. mai"
 * (crossing a month boundary). `monthsShort` is the caller's `t.monthsShort` array.
 * Icelandic follows the Norwegian day-then-month order ("1.–7. maí"), so the two
 * share a branch — only English puts the month first.
 */
export function formatDateRange(startDate: string, endDate: string, monthsShort: string[], lang: DateLang): string {
  const s = new Date(startDate + 'T12:00:00');
  const e = new Date(endDate + 'T12:00:00');
  const sDay = s.getDate();
  const eDay = e.getDate();
  const sMonth = monthsShort[s.getMonth()];
  const eMonth = monthsShort[e.getMonth()];
  const sameMonth = s.getMonth() === e.getMonth();
  if (lang !== 'en') {
    return sameMonth ? `${sDay}.–${eDay}. ${sMonth}` : `${sDay}. ${sMonth}–${eDay}. ${eMonth}`;
  }
  return sameMonth ? `${sMonth} ${sDay} – ${eDay}` : `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
}
