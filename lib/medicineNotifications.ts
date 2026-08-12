/**
 * medicineNotifications.ts — build & (re)schedule the four medicine tray reminders.
 *
 * One daily notification per TRAY (morning/midday/evening/night), not one per medicine:
 * a tray reminder names what's in it ("Morning — Elvanse 30 mg, Omega-3") and carries a
 * **Taken** action button, so the whole tray can be logged from the notification shade
 * without opening the app. Trays with no active medicine are simply not scheduled.
 *
 * Same shape and division of labour as lib/habitNotifications.ts: the store passes the
 * settings in (this file never reads a store), content is localised here, scheduling
 * goes through lib/notifications. A tray whose time falls inside quiet hours is SKIPPED
 * for that day rather than shifted — matching habits (Decision 016 Q4), and correct here
 * too: a night-tray reminder pushed to 08:00 would nag about a dose whose window closed.
 * The dose itself is never gated by quiet hours; only the nudge about it is.
 *
 * Connections:
 *   Imports → lib/notifications (scheduleDailyReminder/cancelDailyReminder/shouldSkipForQuietHours/
 *             syncMedicineCategories/scheduleTrayReNudge), lib/i18n (getTranslations),
 *             lib/medicineSchedule (TRAY_IDS/TrayTimes + tray membership helpers),
 *             store/useSettingsStore (Language type only)
 *   Used by → store/useMedicineStore.ts (syncTrayReminders on every medicine/settings change),
 *             app/_layout.tsx (registerMedicineCategory at boot + language change),
 *             __tests__/medicineNotifications.test.ts
 *   Data    → schedules OS notifications (no SQLite/store access)
 *
 * Edit notes:
 *   - **Decide first, then cancel only what isn't being rescheduled.** syncTrayReminders
 *     computes the whole plan up front; a blanket cancel-every-tray-then-schedule races,
 *     because the cancel promises can resolve AFTER a schedule call for the same identifier
 *     has landed and silently un-schedule it. scheduleDailyReminder already cancels its own
 *     key first, so a tray that IS being scheduled needs no separate cancel — only the ones
 *     dropping out (tray emptied, reminders switched off, feature turned off) do.
 *   - Identifiers are `medtray-<tray>` (via scheduleDailyReminder's `daily-` prefix) and
 *     `medtray-<tray>-renudge` for a snooze follow-up — keep both in sync with
 *     lib/notifications.ts's cancel helpers or cancellation silently misses.
 *   - The body lists at most MAX_LISTED names and then "+N more", so a long tray doesn't
 *     produce an unreadable notification.
 *   - As-needed medicines are deliberately NEVER scheduled here: their whole point is that
 *     nothing should nudge you to take one. Their interval guard lives in
 *     lib/medicineSchedule.ts's asNeededState and is enforced in the UI.
 */
import type { Language } from '@/store/useSettingsStore';
import { getTranslations } from '@/lib/i18n';
import {
  cancelDailyReminder,
  shouldSkipForQuietHours,
  type QuietHoursSettings,
  scheduleDailyReminder,
  scheduleTrayReNudge,
  syncMedicineCategories,
} from '@/lib/notifications';
import {
  medicinesForTray,
  parseTrayTime,
  TRAY_IDS,
  TrayId,
  TrayTimes,
  type SchedulableMedicine,
} from '@/lib/medicineSchedule';

/** How many medicine names a tray reminder spells out before collapsing to "+N more". */
const MAX_LISTED = 3;

/** How long "Remind me later" defers a tray reminder. Matches the task snooze. */
export const TRAY_SNOOZE_MS = 15 * 60 * 1000;

/** The settings a tray reminder depends on (a structural subset of the settings store). */
export type MedicineNotifSettings = {
  featureMedicine: boolean;
  medicineRemindersEnabled: boolean;
  medicineTrayTimes: TrayTimes;
} & QuietHoursSettings;

/** A medicine as this file needs it: schedulable fields plus the names to show. */
export type NotifiableMedicine = SchedulableMedicine & { name: string; dose: string };

/** Register the Taken / Remind-me-later buttons. Call again after a language change. */
export function registerMedicineCategory(language?: Language): void {
  const t = getTranslations(language);
  void syncMedicineCategories(t.notif.actionTaken, t.notif.actionRemindLater);
}

/** Cancel every tray reminder outright (nothing is being rescheduled). */
export async function cancelTrayReminders(): Promise<void> {
  await Promise.all(TRAY_IDS.map((tray) => cancelDailyReminder(`medtray-${tray}`)));
}

/** "Elvanse 30 mg, Omega-3 +2 more" — the tray reminder's body list. */
function describeTray(meds: NotifiableMedicine[], moreLabel: (n: number) => string): string {
  const names = meds.map((m) => (m.dose ? `${m.name} ${m.dose}` : m.name));
  if (names.length <= MAX_LISTED) return names.join(', ');
  return `${names.slice(0, MAX_LISTED).join(', ')} ${moreLabel(names.length - MAX_LISTED)}`;
}

/**
 * (Re)schedule the tray reminders from the current medicines + settings — the single
 * idempotent entry point. Call it after any medicine add/update/remove, any tray-time
 * change, a language change, or the feature/reminder switches flipping. Trays that
 * shouldn't fire are cancelled; see the "decide first" edit note for why not all of them.
 */
export function syncTrayReminders(meds: NotifiableMedicine[], s: MedicineNotifSettings): void {
  const t = getTranslations(s.language);
  const on = s.featureMedicine && s.medicineRemindersEnabled;

  // Decide everything BEFORE touching the scheduler, then cancel only the trays that aren't
  // being rescheduled. A blanket cancel-then-schedule would race: the cancel loop's later
  // awaits can resolve after a schedule call for the same key has already landed, silently
  // un-scheduling the reminder it was supposed to replace. scheduleDailyReminder already
  // cancels its own identifier first, so a tray that IS being scheduled needs no cancel here.
  const plan = new Map<TrayId, { hour: number; minute: number; body: string }>();
  if (on) {
    for (const tray of TRAY_IDS) {
      // No person filter: a tray reminder covers everyone's medicine in that window
      // (People/family mode), which is exactly what a shared morning tray should do.
      const inTray = medicinesForTray(meds, tray);
      if (inTray.length === 0) continue;
      const [hour, minute] = parseTrayTime(s.medicineTrayTimes, tray);
      if (shouldSkipForQuietHours(hour, minute, s)) continue;
      plan.set(tray, { hour, minute, body: describeTray(inTray, t.notif.medicineTrayMore) });
    }
  }

  for (const tray of TRAY_IDS) {
    if (!plan.has(tray)) void cancelDailyReminder(`medtray-${tray}`);
  }
  for (const [tray, { hour, minute, body }] of plan) {
    void scheduleDailyReminder(
      `medtray-${tray}`,
      hour,
      minute,
      { title: t.notif.medicineTrayTitle(t.medicine.trays[tray]), body },
      { data: { medicineTray: tray }, categoryIdentifier: 'medicine-reminder' }
    );
  }
}

/** Arm the "Remind me later" follow-up for a tray, 15 minutes out. */
export function snoozeTrayReminder(tray: TrayId, language?: Language): void {
  const t = getTranslations(language);
  void scheduleTrayReNudge(tray, TRAY_SNOOZE_MS, {
    title: t.notif.medicineTrayTitle(t.medicine.trays[tray]),
    body: t.notif.medicineSnoozeBody,
  });
}
