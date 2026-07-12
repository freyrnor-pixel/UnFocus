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
 * lib/i18n. Localisation comes from a tiny local EN/NO string table keyed off settings.language,
 * mirroring the handful of `widgets`/`notif` keys sync.ts bakes. Approximations are deliberate
 * (today's non-recurring tasks; status='inWeeklyList' shopping regardless of list_id) — this only
 * runs in the no-snapshot edge case and is corrected on the next foreground sync.
 *
 * Connections:
 *   Imports → lib/db (shared SQLite handle), lib/date (todayStr)
 *   Used by → lib/widgets/handler.tsx (render fallback before placeholder())
 *   Data    → reads tasks / shopping_items / notes / habits / habit_logs / health_logs / settings
 *
 * Edit notes:
 *   - Keep this store-free and i18n-free so it stays safe in a bare headless JS context.
 *   - Every query is wrapped: any failure degrades the whole builder to null (→ placeholder()).
 *   - Accents MUST match lib/widgets/sync.ts's ACCENT map so a headless render is visually
 *     identical to an app-pushed one. New display strings go in WIDGET_STRINGS (both en + no).
 */
import db from '@/lib/db';
import { todayStr } from '@/lib/date';
import type { WidgetSnapshot } from './snapshot';

const PREVIEW = 20;
const ACCENT = {
  shop: '#0891B2',
  task: '#2563EB',
  overview: '#F4A261',
  notes: '#8B5CF6',
  habits: '#16A34A',
  health: '#E11D48',
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
};

// Mirror of the strings sync.ts pulls from lib/i18n (widgets + notif.overview*). Keep in sync.
const WIDGET_STRINGS: Record<'en' | 'no', Strings> = {
  en: {
    shoppingTitle: 'Shopping',
    tasksTitle: "Today's tasks",
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
    noHealth: 'Nothing logged',
    voiceNote: 'Voice note',
    overviewEmpty: 'No tasks left today',
  },
  no: {
    shoppingTitle: 'Handleliste',
    tasksTitle: 'Dagens oppgaver',
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
    noHealth: 'Ingenting logget',
    voiceNote: 'Taleopptak',
    overviewEmpty: 'Ingen oppgaver igjen i dag',
  },
};

function currentLang(): 'en' | 'no' {
  try {
    const row = db.getFirstSync<{ language: string }>('SELECT language FROM settings WHERE id = 1');
    return row?.language === 'en' ? 'en' : 'no'; // Norwegian-first default (matches lib/db migration)
  } catch {
    return 'no';
  }
}

/** First non-empty line of a note's header/body, trimmed to one widget line (mirrors sync.ts). */
function noteText(header: string, body: string): string {
  const src = (header || '').trim() || (body || '').trim();
  return src.split('\n')[0].slice(0, 60);
}

/** Whether a habit is scheduled today — mirrors sync.ts dueToday / health.tsx shouldShowHabitOnDate. */
function dueToday(recurrence: string, days: number[], today: string): boolean {
  if (recurrence === 'daily' || recurrence === 'one-time') return true;
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
      const rows = db.getAllSync<{ id: string; title: string; done: number }>(
        'SELECT id, title, done FROM tasks WHERE task_date = ? ORDER BY sort_order, task_time, created_at',
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
      const rows = db.getAllSync<{ id: string; ailment: string; severity: number; end_date: string }>(
        'SELECT id, ailment, severity, end_date FROM health_logs WHERE end_date = ? OR log_date = ? ORDER BY log_date DESC, created_at DESC',
        ['', today]
      );
      healthTotal = rows.length;
      ongoingCount = rows.filter((r) => r.end_date === '').length;
      healthItems = rows.slice(0, PREVIEW).map((r) => ({
        id: r.id,
        label: r.ailment,
        severity: r.severity,
        ongoing: r.end_date === '',
      }));
    } catch {
      /* leave health empty */
    }

    // ── Overview lines (backward-compat for installs still running the Overview receiver) ──
    const overviewLines: string[] = [];
    if (tasksRemaining > 0) overviewLines.push(s.tasksLeft(tasksRemaining));
    if (shopRemaining > 0) overviewLines.push(s.itemsLeft(shopRemaining));

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
        empty: s.noHabits,
        accent: ACCENT.habits,
        hasContent: habitTotal > 0,
      },
      health: {
        title: s.healthTitle,
        subtitle: ongoingCount > 0 ? s.healthOngoing(ongoingCount) : '',
        items: healthItems,
        more: healthTotal > PREVIEW ? s.more(healthTotal - PREVIEW) : '',
        empty: s.noHealth,
        accent: ACCENT.health,
        hasContent: healthItems.length > 0,
      },
    };
  } catch {
    return null;
  }
}
