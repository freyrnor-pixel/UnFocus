/**
 * exactAlarmSettings.ts — the "Alarms & reminders" hint in Settings → Notifications (2026-10-11).
 *
 * **Why it exists.** Until 1.8.0 the app declared `USE_EXACT_ALARM`, which Android grants
 * silently. Google Play only allows that permission for alarm-clock and calendar apps, so it
 * was removed for the Play Store release (app.json `blockedPermissions`). What is left is
 * `SCHEDULE_EXACT_ALARM`, which on Android 14+ starts out DENIED for new installs.
 * expo-notifications handles that without crashing — it falls back from
 * `setExactAndAllowWhileIdle` to `setAndAllowWhileIdle` (ExpoSchedulingDelegate.kt) — but the
 * system may then hold a reminder back by several minutes while the phone dozes. One switch in
 * Android's own settings ("Alarms & reminders" for UnFocus) restores exact timing.
 *
 * **Why the hint cannot tell whether the switch is on.** No module in this app exposes
 * `AlarmManager.canScheduleExactAlarms()` to JS, and adding native code for one boolean is
 * more to maintain than the hint is worth. So the row is shown on every Android 12+ device
 * (API 31, where the permission became user-controlled) and phrased as an offer, not a
 * warning — it is correct whether or not the switch is already on.
 *
 * Connections:
 *   Imports → react-native (Platform, Linking), expo-intent-launcher, expo-constants
 *   Used by → app/settings.tsx (Notifications tab)
 *   Data    → none
 */
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';

/** Android 12 (API 31) is where exact alarms became a user-controlled special permission. */
export const EXACT_ALARM_MIN_API = 31;

/** Pure: should Settings offer the hint on this platform/version? Exported for the test. */
export function exactAlarmHintApplies(os: string, version: string | number): boolean {
  return os === 'android' && Number(version) >= EXACT_ALARM_MIN_API;
}

export function showExactAlarmHint(): boolean {
  return exactAlarmHintApplies(Platform.OS, Platform.Version);
}

const REQUEST_SCHEDULE_EXACT_ALARM = 'android.settings.REQUEST_SCHEDULE_EXACT_ALARM';

/**
 * Opens this app's own "Alarms & reminders" page. Falls back to the app-info page (which lists
 * the same switch) if the intent is refused — some OEM builds do not register the activity.
 */
export async function openExactAlarmSettings(): Promise<void> {
  const pkg = Constants.expoConfig?.android?.package;
  try {
    await IntentLauncher.startActivityAsync(REQUEST_SCHEDULE_EXACT_ALARM, pkg ? { data: `package:${pkg}` } : {});
  } catch {
    await Linking.openSettings().catch(() => {});
  }
}
