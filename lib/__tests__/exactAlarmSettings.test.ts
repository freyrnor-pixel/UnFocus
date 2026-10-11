/**
 * exactAlarmSettings.test.ts — when Settings offers the "Alarms & reminders" hint, and that its
 * button always lands somewhere (2026-10-11).
 *
 * Connections:
 *   Imports → lib/exactAlarmSettings
 *   Used by → jest
 *   Data    → none
 */
import { Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { exactAlarmHintApplies, openExactAlarmSettings } from '@/lib/exactAlarmSettings';

jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'com.freyrnorpixel.unfocus' } } }));

describe('exactAlarmHintApplies — the truth table', () => {
  test.each([
    ['android', 31, true],
    ['android', 34, true],
    ['android', '35', true],
    ['android', 30, false],
    ['android', 24, false],
    ['ios', 31, false],
    ['ios', '18.0', false],
    ['web', 99, false],
  ])('%s %s → %s', (os, version, expected) => {
    expect(exactAlarmHintApplies(os, version)).toBe(expected);
  });
});

describe('openExactAlarmSettings', () => {
  const start = IntentLauncher.startActivityAsync as jest.Mock;
  beforeEach(() => start.mockReset());

  test("opens this app's own Alarms & reminders page", async () => {
    start.mockResolvedValue({});
    await openExactAlarmSettings();
    expect(start).toHaveBeenCalledWith('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', {
      data: 'package:com.freyrnorpixel.unfocus',
    });
  });

  test('falls back to the app-info page when the intent is refused', async () => {
    start.mockRejectedValue(new Error('No Activity found'));
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await openExactAlarmSettings();
    expect(open).toHaveBeenCalled();
  });
});
