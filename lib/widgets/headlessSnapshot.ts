/**
 * headlessSnapshot.ts — build a widget snapshot straight from SQLite, in the headless task.
 *
 * The widget task handler (lib/widgets/handler.tsx) runs headless — often in a fresh JS
 * context while the app process is dead. Its normal data source is the app-written
 * widget_snapshot row (lib/widgets/sync.ts). But when a widget is planted on a cold install
 * the app may never have synced yet, so that row is missing and the widget renders blank
 * until the app is next opened — the "invisible until I open the app" bug. This module is the
 * fallback: it reads the live tables directly and returns a fully-localised WidgetSnapshot so
 * a freshly-planted widget shows real content right away. The app's next in-app sync overwrites
 * it with the exact (recurring-task / list-scoped) computation.
 *
 * It talks ONLY to SQLite (like snapshot.ts / widgetActions.ts): no Zustand stores, no
 * lib/i18n. Localisation comes from a tiny local EN/NO/IS string table keyed off settings.language,
 * mirroring the handful of `widgets`/`notif` keys sync.ts bakes. Approximations are deliberate
 * (today's non-recurring tasks; status='inWeeklyList' shopping regardless of list_id) — this only
 * runs in the no-snapshot edge case and is corrected on the next foreground sync.
 *
 * Connections:
 *   Imports → lib/db (shared SQLite handle), lib/date (todayStr, localMinutesOf),
 *             lib/widgets/snapshot (types + the shared WIDGET_ACCENT map)
 *   Used by → lib/widgets/handler.tsx (render fallback before placeholder())
 *   Data    → reads tasks / shopping_items / notes / habits / habit_logs / health_logs /
 *             medicines / medicine_doses / settings
 *
 * Edit notes:
 *   - Keep this store-free and i18n-free so it stays safe in a bare headless JS context.
 *   - Every query is wrapped: any failure degrades the whole builder to null (→ placeholder()).
 *   - Accents come from lib/widgets/snapshot.ts's WIDGET_ACCENT, shared with lib/widgets/sync.ts
 *     so a headless render can't drift from an app-pushed one. This file kept its own byte-equal
 *     copy of that map until 2026-08-15, with a comment telling the next session to keep the two
 *     in step by hand — which is not a mechanism. New display strings still go in WIDGET_STRINGS
 *     (all three of en + no + is); that duplication is real and unavoidable, since lib/i18n.ts
 *     is a store. The local `isCount` below is duplicated from lib/i18n.ts for the same reason.
 */
import db from '@/lib/db';
import { localMinutesOf, todayStr } from '@/lib/date';
import { WIDGET_ACCENT as ACCENT, type WidgetSnapshot, type WidgetTrayLine } from './snapshot';

const PREVIEW = 20;

/** Tray ids in the order the day runs, mirroring lib/medicineSchedule.ts's TRAY_IDS. */
const TRAYS = ['morning', 'midday', 'evening', 'night'] as const;
const DEFAULT_TRAY_TIMES: Record<string, string> = {
  morning: '08:00',
  midday: '12:00',
  evening: '18:00',
  night: '21:00',
};

type Strings = {
  shoppingTitle: string;
  tasksTitle: string;
  notesTitle: string;
  habitsTitle: string;
  healthTitle: string;
  overviewTitle: string;
  itemsLeft: (n: number) => string;
  tasksLeft: (n: number) => string;
  habitsLeft: (n: number) => string;
  healthOngoing: (n: number) => string;
  more: (n: number) => string;
  allDone: string;
  noItems: string;
  noTasks: string;
  noNotes: string;
  noHabits: string;
  noHealth: string;
  voiceNote: string;
  overviewEmpty: string;
  medicineDue: (n: number) => string;
  trayProgress: (taken: number, total: number) => string;
  stillDue: (trays: string) => string;
  trayNames: Record<string, string>;
};

/**
 * Icelandic count agreement — a number ending in 1 takes the singular, except 11
 * ("21 vara", but "11 vörur"). Mirrors `isCount` in lib/i18n.ts; duplicated rather than
 * imported because this module is deliberately i18n-free (see the header).
 */
const isCount = (n: number, one: string, many: string): string =>
  Math.abs(n) % 10 === 1 && Math.abs(n) % 100 !== 11 ? one : many;

// Mirror of the strings sync.ts pulls from lib/i18n (widgets + notif.overview*). Keep in sync.
const WIDGET_STRINGS: Record<'en' | 'no' | 'is', Strings> = {
  en: {
    shoppingTitle: 'Shopping',
    tasksTitle: "Today's to-do",
    notesTitle: 'Notes',
    habitsTitle: 'Habits',
    healthTitle: 'Health',
    overviewTitle: "Today's overview",
    itemsLeft: (n) => (n === 1 ? '1 item left' : `${n} items left`),
    tasksLeft: (n) => (n === 1 ? '1 task left' : `${n} tasks left`),
    habitsLeft: (n) => (n === 1 ? '1 habit left' : `${n} habits left`),
    healthOngoing: (n) => (n === 1 ? '1 ongoing' : `${n} ongoing`),
    more: (n) => `+${n} more`,
    allDone: 'All done 🎉',
    noItems: 'List is empty',
    noTasks: 'Nothing planned today',
    noNotes: 'No notes yet',
    noHabits: 'No habits today',
    noHealth: 'Nothing logged today',
    voiceNote: 'Voice note',
    overviewEmpty: 'No tasks left today',
    medicineDue: (n) => (n === 1 ? '1 medicine still due' : `${n} medicines still due`),
    trayProgress: (taken, total) => `${taken} of ${total}`,
    stillDue: (trays) => `Still due: ${trays}`,
    trayNames: { morning: 'Morning', midday: 'Midday', evening: 'Evening', night: 'Night' },
  },
  no: {
    shoppingTitle: 'Handleliste',
    tasksTitle: 'Dagens gjøremål',
    notesTitle: 'Notater',
    habitsTitle: 'Vaner',
    healthTitle: 'Helse',
    overviewTitle: 'Dagens oversikt',
    itemsLeft: (n) => (n === 1 ? '1 vare igjen' : `${n} varer igjen`),
    tasksLeft: (n) => (n === 1 ? '1 oppgave igjen' : `${n} oppgaver igjen`),
    habitsLeft: (n) => (n === 1 ? '1 vane igjen' : `${n} vaner igjen`),
    healthOngoing: (n) => (n === 1 ? '1 pågående' : `${n} pågående`),
    more: (n) => `+${n} flere`,
    allDone: 'Alt ferdig 🎉',
    noItems: 'Listen er tom',
    noTasks: 'Ingenting planlagt i dag',
    noNotes: 'Ingen notater ennå',
    noHabits: 'Ingen vaner i dag',
    noHealth: 'Ingenting logget i dag',
    voiceNote: 'Taleopptak',
    overviewEmpty: 'Ingen oppgaver igjen i dag',
    medicineDue: (n) => (n === 1 ? '1 medisin gjenstår' : `${n} medisiner gjenstår`),
    trayProgress: (taken, total) => `${taken} av ${total}`,
    stillDue: (trays) => `Gjenstår: ${trays}`,
    trayNames: { morning: 'Morgen', midday: 'Midt på dagen', evening: 'Kveld', night: 'Natt' },
  },
  is: {
    shoppingTitle: 'Innkaup',
    tasksTitle: 'Verkefni dagsins',
    notesTitle: 'Minnispunktar',
    habitsTitle: 'Venjur',
    healthTitle: 'Heilsa',
    overviewTitle: 'Yfirlit dagsins',
    itemsLeft: (n) => `${n} ${isCount(n, 'vara', 'vörur')} eftir`,
    tasksLeft: (n) => `${n} verkefni eftir`,
    habitsLeft: (n) => `${n} ${isCount(n, 'venja', 'venjur')} eftir`,
    healthOngoing: (n) => `${n} í gangi`,
    more: (n) => `+${n} í viðbót`,
    allDone: 'Allt búið 🎉',
    noItems: 'Listinn er tómur',
    noTasks: 'Ekkert á dagskrá í dag',
    noNotes: 'Engir minnispunktar enn',
    noHabits: 'Engar venjur í dag',
    noHealth: 'Ekkert skráð í dag',
    voiceNote: 'Talupptaka',
    overviewEmpty: 'Engin verkefni eftir í dag',
    // "lyf" is neuter with one form for both numbers, so it needs no isCount.
    medicineDue: (n) => `${n} lyf eftir`,
    trayProgress: (taken, total) => `${taken} af ${total}`,
    stillDue: (trays) => `Eftir: ${trays}`,
    trayNames: { morning: 'Morgunn', midday: 'Miðdegi', evening: 'Kvöld', night: 'Nótt' },
  },
};

function currentLang(): 'en' | 'no' | 'is' {
  try {
    const row = db.getFirstSync<{ language: string }>('SELECT language FROM settings WHERE id = 1');
    // Norwegian-first default (matches lib/db migration) — anything unrecognised falls to 'no'.
    if (row?.language === 'en') return 'en';
    if (row?.language === 'is') return 'is';
    return 'no';
  } catch {
    return 'no';
  }
}

/** First non-empty line of a note's header/body, trimmed to one widget line (mirrors sync.ts). */
function noteText(header: string, body: string): string {
  const src = (header || '').trim() || (body || '').trim();
  return src.split('\n')[0].slice(0, 60);
}

/** Whether a habit is scheduled today — mirrors lib/habitRecurrence.ts's habitOccursOn
 *  (kept as a free-standing primitive-args version here since this runs off raw SQL
 *  rows, not hydrated Habit objects). */
function dueToday(recurrence: string, days: number[], today: string): boolean {
  if (recurrence === 'daily' || recurrence === 'one-time' || recurrence === 'weekly-flexible') return true;
  const date = new Date(today + 'T12:00:00');
  if (recurrence === 'weekly') {
    if (days.length === 0) return true;
    return days.includes((date.getDay() + 6) % 7); // 0 = Mon
  }
  if (recurrence === 'monthly') {
    if (days.length === 0) return true;
    return date.getDate() === days[0];
  }
  return true;
}

/**
 * Build a snapshot from the current DB state, or null if the DB can't be read at all.
 * Each section is defensively wrapped so a partial failure still yields a usable snapshot.
 */
export function buildHeadlessSnapshot(): WidgetSnapshot | null {
  try {
    const s = WIDGET_STRINGS[currentLang()];
    const today = todayStr();

    // ── Tasks (today; recurring expansion is the app's job, approximated by date here) ──
    let taskItems: { id: string; title: string; done: boolean }[] = [];
    let tasksRemaining = 0;
    let taskTotal = 0;
    try {
      // card_type <> 'note' mirrors lib/widgets/sync.ts: every listed row is tappable and a
      // tap flips `done`, which a note has no business having. `IS NULL` keeps a row written
      // before the column existed (see lib/db.ts's migration) — failing safe means listing it.
      const rows = db.getAllSync<{ id: string; title: string; done: number }>(
        "SELECT id, title, done FROM tasks WHERE task_date = ? AND (card_type IS NULL OR card_type <> 'note') ORDER BY sort_order, task_time, created_at",
        [today]
      );
      taskTotal = rows.length;
      tasksRemaining = rows.filter((r) => !r.done).length;
      taskItems = rows.slice(0, PREVIEW).map((r) => ({ id: r.id, title: r.title, done: !!r.done }));
    } catch {
      /* leave tasks empty */
    }

    // ── Shopping (weekly working list; list_id scoping is the app's job) ──
    let shopItems: { id: string; name: string; state: 'list' | 'cart' }[] = [];
    let shopRemaining = 0;
    let shopTotal = 0;
    try {
      const rows = db.getAllSync<{ id: string; name: string; checked: number }>(
        "SELECT id, name, checked FROM shopping_items WHERE status = 'inWeeklyList' ORDER BY checked, order_index, created_at"
      );
      shopTotal = rows.length;
      shopRemaining = rows.filter((r) => !r.checked).length;
      shopItems = rows.slice(0, PREVIEW).map((r) => ({
        id: r.id,
        name: r.name,
        state: (r.checked ? 'cart' : 'list') as 'list' | 'cart',
      }));
    } catch {
      /* leave shopping empty */
    }

    // ── Notes (active/unchecked) ──
    let noteItems: { id: string; header: string; checked: boolean }[] = [];
    let noteTotal = 0;
    try {
      const rows = db.getAllSync<{ id: string; header: string; body: string }>(
        'SELECT id, header, body FROM notes WHERE checked = 0 ORDER BY sort_order, created_at DESC'
      );
      noteTotal = rows.length;
      noteItems = rows.slice(0, PREVIEW).map((r) => ({ id: r.id, header: noteText(r.header, r.body), checked: false }));
    } catch {
      /* leave notes empty */
    }

    // ── Habits (active + scheduled today; done = today's log met the goal / rest day) ──
    let habitItems: { id: string; title: string; done: boolean }[] = [];
    let habitsRemaining = 0;
    let habitTotal = 0;
    try {
      const habits = db.getAllSync<{ id: string; title: string; daily_goal: number; recurrence: string; recurrence_days: string }>(
        'SELECT id, title, daily_goal, recurrence, recurrence_days FROM habits WHERE active = 1 ORDER BY routine_order, created_at'
      );
      const logs = db.getAllSync<{ habit_id: string; count: number; rest_day: number }>(
        'SELECT habit_id, count, rest_day FROM habit_logs WHERE log_date = ?',
        [today]
      );
      const logByHabit = new Map(logs.map((l) => [l.habit_id, l]));
      const due = habits.filter((h) => {
        let days: number[] = [];
        try { days = JSON.parse(h.recurrence_days || '[]'); } catch { days = []; }
        return dueToday(h.recurrence, Array.isArray(days) ? days : [], today);
      });
      // Same-day-only approximation: for a 'weekly-flexible' habit this checks only
      // today's count against the (per-week) goal, not the week's cumulative total —
      // a widget-preview simplification, same spirit as the tasks note above. The
      // in-app Habits screen (lib/habitRecurrence.ts) is the accurate source.
      const isDone = (h: { id: string; daily_goal: number }) => {
        const log = logByHabit.get(h.id);
        return !!log && (!!log.rest_day || log.count >= Math.max(1, h.daily_goal || 1));
      };
      habitTotal = due.length;
      habitsRemaining = due.filter((h) => !isDone(h)).length;
      habitItems = due.slice(0, PREVIEW).map((h) => ({ id: h.id, title: h.title, done: isDone(h) }));
    } catch {
      /* leave habits empty */
    }

    // ── Health (ongoing issues + anything logged today), newest-first ──
    let healthItems: { id: string; label: string; severity: number; ongoing: boolean }[] = [];
    let ongoingCount = 0;
    let healthTotal = 0;
    try {
      // Openness is `episode_state`, never `end_date = ''` (2026-08-01) — that sentinel only
      // means "no end recorded". This is the only raw SQL against health_logs outside the
      // store, so it has to be kept in step with lib/episodes.ts's isOpen() by hand.
      const rows = db.getAllSync<{ id: string; ailment: string; severity: number; episode_state: string }>(
        'SELECT id, ailment, severity, episode_state FROM health_logs WHERE episode_state = ? OR log_date = ? ORDER BY log_date DESC, created_at DESC',
        ['ongoing', today]
      );
      healthTotal = rows.length;
      ongoingCount = rows.filter((r) => r.episode_state === 'ongoing').length;
      healthItems = rows.slice(0, PREVIEW).map((r) => ({
        id: r.id,
        label: r.ailment,
        severity: r.severity,
        ongoing: r.episode_state === 'ongoing',
      }));
    } catch {
      /* leave health empty */
    }

    // ── Medicine trays (folded into the Health widget, 2026-08-15) ──
    // Gated on feature_medicine like every other read of this domain. `trays` is a JSON array
    // column, so membership is matched in JS — a LIKE would match a substring of another id.
    let trays: WidgetTrayLine[] = [];
    let dueMedicines = 0;
    const dueTrayNames: string[] = [];
    try {
      const cfg = db.getFirstSync<{ feature_medicine: number; medicine_tray_times: string }>(
        'SELECT feature_medicine, medicine_tray_times FROM settings WHERE id = 1'
      );
      if (cfg?.feature_medicine) {
        let times: Record<string, string> = DEFAULT_TRAY_TIMES;
        try {
          const parsed = JSON.parse(cfg.medicine_tray_times || '{}');
          if (parsed && typeof parsed === 'object') times = { ...DEFAULT_TRAY_TIMES, ...parsed };
        } catch {
          /* malformed column — the defaults are the same ones lib/db.ts seeds */
        }
        const meds = db.getAllSync<{ id: string; trays: string }>(
          'SELECT id, trays FROM medicines WHERE active = 1 AND as_needed = 0'
        );
        const taken = new Set(
          db
            .getAllSync<{ medicine_id: string; tray: string }>(
              'SELECT medicine_id, tray FROM medicine_doses WHERE log_date = ?',
              [today]
            )
            .map((d) => `${d.medicine_id}|${d.tray}`)
        );
        const nowMinutes = localMinutesOf(new Date());
        for (const tray of TRAYS) {
          const inTray = meds.filter((m) => {
            try {
              const list = JSON.parse(m.trays || '[]');
              return Array.isArray(list) && list.includes(tray);
            } catch {
              return false;
            }
          });
          if (inTray.length === 0) continue;
          const takenCount = inTray.filter((m) => taken.has(`${m.id}|${tray}`)).length;
          const allTaken = takenCount >= inTray.length;
          const [th, tm] = (times[tray] || DEFAULT_TRAY_TIMES[tray]).split(':').map((n) => parseInt(n, 10));
          const trayMin = (Number.isFinite(th) ? th : 0) * 60 + (Number.isFinite(tm) ? tm : 0);
          const due = !allTaken && trayMin <= nowMinutes;
          if (due) {
            dueMedicines += inTray.length - takenCount;
            dueTrayNames.push(s.trayNames[tray] ?? tray);
          }
          trays.push({
            id: tray,
            label: s.trayNames[tray] ?? tray,
            detail: s.trayProgress(takenCount, inTray.length),
            taken: allTaken,
            due,
          });
        }
      }
    } catch {
      trays = [];
    }

    // ── Overview lines ──
    // Mirrors lib/widgets/sync.ts's single rendering. Still used by the retired Overview
    // receiver on installs that predate the Habits/Health widgets.
    const overviewLines: string[] = [];
    if (tasksRemaining > 0) overviewLines.push(s.tasksLeft(tasksRemaining));
    if (shopRemaining > 0) overviewLines.push(s.itemsLeft(shopRemaining));
    if (habitsRemaining > 0) overviewLines.push(s.habitsLeft(habitsRemaining));
    if (dueTrayNames.length > 0) overviewLines.push(s.stillDue(dueTrayNames.join(', ')));
    if (ongoingCount > 0) overviewLines.push(s.healthOngoing(ongoingCount));

    const healthSubtitle = [
      dueMedicines > 0 ? s.medicineDue(dueMedicines) : '',
      ongoingCount > 0 ? s.healthOngoing(ongoingCount) : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      updatedAt: Date.now(),
      shopping: {
        title: s.shoppingTitle,
        subtitle: shopRemaining > 0 ? s.itemsLeft(shopRemaining) : '',
        items: shopItems,
        more: shopTotal > PREVIEW ? s.more(shopTotal - PREVIEW) : '',
        empty: shopTotal === 0 ? s.noItems : s.allDone,
        accent: ACCENT.shop,
        hasContent: shopItems.length > 0,
      },
      tasks: {
        title: s.tasksTitle,
        subtitle: tasksRemaining > 0 ? s.tasksLeft(tasksRemaining) : '',
        items: taskItems,
        more: taskTotal > PREVIEW ? s.more(taskTotal - PREVIEW) : '',
        empty: s.noTasks,
        accent: ACCENT.task,
        hasContent: taskTotal > 0,
      },
      overview: {
        title: s.overviewTitle,
        lines: overviewLines,
        empty: s.overviewEmpty,
        accent: ACCENT.overview,
        hasContent: overviewLines.length > 0,
      },
      notes: {
        title: s.notesTitle,
        items: noteItems,
        more: noteTotal > PREVIEW ? s.more(noteTotal - PREVIEW) : '',
        empty: s.noNotes,
        voiceLabel: s.voiceNote,
        accent: ACCENT.notes,
        hasContent: noteItems.length > 0,
      },
      habits: {
        title: s.habitsTitle,
        subtitle: habitsRemaining > 0 ? s.habitsLeft(habitsRemaining) : '',
        items: habitItems,
        more: habitTotal > PREVIEW ? s.more(habitTotal - PREVIEW) : '',
        // No empty-state text (2026-08-12 — matches sync.ts's mirrored removal).
        empty: s.noHabits,
        accent: ACCENT.habits,
        hasContent: habitTotal > 0,
      },
      health: {
        title: s.healthTitle,
        subtitle: healthSubtitle,
        items: healthItems,
        trays,
        more: healthTotal > PREVIEW ? s.more(healthTotal - PREVIEW) : '',
        empty: s.noHealth,
        accent: ACCENT.health,
        hasContent: healthItems.length > 0 || trays.length > 0,
      },
    };
  } catch {
    return null;
  }
}
