/**
 * timer.tsx — a plain countdown for one task (2026-10-26).
 *
 * Borrowed from Super Productivity's focus mode, cut to its Countdown strategy (see
 * lib/focusTimer.ts for why there is no Pomodoro cycle and no auto-started next round). Pick a
 * length, it counts down, it says it's done. That is the whole feature:
 *   - **No score.** Nothing counts sessions, totals focus time or compares days.
 *   - **Stopping early is not failing.** Stop just closes; nothing is recorded either way.
 *   - **Works backgrounded.** The end is an OS notification scheduled at start/resume
 *     (lib/notifications.ts `scheduleTimerEnd`), and state is timestamps, so returning to the
 *     app reads the right time. The screen is kept awake only while it is counting.
 *
 * Params: `taskId` (optional) — offers that task's own duration as the first length and, when
 * the countdown ends, a one-tap "mark it done".
 *
 * Connections:
 *   Imports → components/CenterModalScreen, components/Button, components/PressableScale,
 *             constants/theme, lib/focusTimer, lib/notifications (scheduleTimerEnd /
 *             cancelTimerEnd), lib/haptics, lib/i18n, lib/useAppTheme, store/useTaskStore,
 *             expo-keep-awake, expo-router
 *   Used by → Expo Router route "/timer" (CENTRE_MODAL_ROUTES in app/_layout.tsx), pushed from
 *             components/TaskCard.tsx's "Start timer" button
 *   Data    → reads useTaskStore.tasks; writes only useTaskStore.toggle (the "mark done" tap).
 *             Schedules/cancels one notification ('focus-timer-end').
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import CenterModalScreen from '@/components/CenterModalScreen';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing, TabularNums } from '@/constants/theme';
import {
  formatClock,
  IDLE,
  pause,
  presetsFor,
  progress,
  remainingMs,
  resume,
  settle,
  start,
  type TimerState,
} from '@/lib/focusTimer';
import { cancelTimerEnd, scheduleTimerEnd } from '@/lib/notifications';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useTaskStore } from '@/store/useTaskStore';

const KEEP_AWAKE_TAG = 'focus-timer';
const TICK_MS = 250;

export default function TimerScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const task = useTaskStore((s) => (taskId ? s.tasks.find((x) => x.id === taskId) : undefined));
  const toggle = useTaskStore((s) => s.toggle);

  const [state, setState] = useState<TimerState>(IDLE);
  const [now, setNow] = useState(() => Date.now());
  const presets = useMemo(() => presetsFor(task?.durationMinutes), [task?.durationMinutes]);

  // Tick only while counting; settle into `done` the moment the end passes.
  useEffect(() => {
    if (state.phase !== 'running') return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      setState((s) => {
        const next = settle(s, n);
        if (next.phase === 'done' && s.phase !== 'done') success();
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [state.phase]);

  // Keep the screen on while counting, and never leave the flag behind.
  useEffect(() => {
    if (state.phase === 'running') activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    else deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, [state.phase]);
  useEffect(() => () => {
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, []);

  function armEnd(ms: number) {
    void scheduleTimerEnd(ms, { title: t.timer.endNotifTitle, body: task ? task.title : t.timer.endNotifBody });
  }

  function handleStart(minutes: number) {
    tap();
    const n = Date.now();
    const next = start(minutes, n);
    setNow(n);
    setState(next);
    armEnd(remainingMs(next, n));
  }

  function handlePause() {
    tap();
    void cancelTimerEnd();
    setState((s) => pause(s, Date.now()));
  }

  function handleResume() {
    tap();
    const n = Date.now();
    const next = resume(state, n);
    setState(next);
    setNow(n);
    armEnd(remainingMs(next, n));
  }

  function handleClose() {
    // Closing mid-count is a stop: nothing would be left on screen to explain a later ping.
    if (state.phase === 'running' || state.phase === 'paused') void cancelTimerEnd();
    router.back();
  }

  function handleMarkDone() {
    if (task && !task.done) toggle(task.id);
    success();
    router.back();
  }

  const left = remainingMs(state, now);
  const frac = progress(state, now);

  return (
    <CenterModalScreen title={t.timer.title} screenKey="plans" onClose={handleClose}>
      <View style={styles.content}>
        {task ? (
          <Text style={[styles.taskTitle, { color: theme.textMuted }]} numberOfLines={2}>
            {task.title}
          </Text>
        ) : null}

        {state.phase === 'idle' ? (
          <>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.timer.pickLength}</Text>
            <View style={styles.presetRow}>
              {presets.map((m) => (
                <PressableScale
                  key={m}
                  style={[styles.preset, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                  onPress={() => handleStart(m)}
                  accessibilityRole="button"
                  accessibilityLabel={t.timer.minutes(m)}
                  scaleTo={0.96}
                >
                  <Text style={[styles.presetText, { color: theme.text }]}>{t.timer.minutes(m)}</Text>
                </PressableScale>
              ))}
            </View>
          </>
        ) : state.phase === 'done' ? (
          <>
            <Text style={[styles.clock, TabularNums, { color: theme.good }]}>{t.timer.doneTitle}</Text>
            <Text style={[styles.body, { color: theme.textMuted }]}>{t.timer.doneBody}</Text>
            <View style={styles.actions}>
              {task && !task.done ? <Button label={t.timer.markDone} onPress={handleMarkDone} /> : null}
              <Button label={t.timer.again} variant="secondary" onPress={() => setState(IDLE)} />
            </View>
          </>
        ) : (
          <>
            <Text
              style={[styles.clock, TabularNums, { color: theme.text }]}
              accessibilityRole="timer"
              accessibilityLiveRegion="polite"
            >
              {formatClock(left)}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
              <View style={[styles.fill, { width: `${Math.round(frac * 100)}%`, backgroundColor: theme.accent }]} />
            </View>
            <View style={styles.actions}>
              {state.phase === 'running' ? (
                <Button label={t.timer.pause} variant="secondary" onPress={handlePause} />
              ) : (
                <Button label={t.timer.resume} onPress={handleResume} />
              )}
              <Button label={t.timer.stop} variant="ghost" onPress={handleClose} />
            </View>
          </>
        )}
      </View>
    </CenterModalScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.md, alignItems: 'stretch' },
  taskTitle: { fontSize: FontSize.md, fontFamily: Fonts.medium, textAlign: 'center' },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
  preset: {
    minHeight: MIN_TAP_TARGET,
    minWidth: MIN_TAP_TARGET * 1.6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  clock: { fontSize: FontSize.hero * 1.6, fontFamily: Fonts.bold, textAlign: 'center' },
  body: { fontSize: FontSize.md, fontFamily: Fonts.regular, textAlign: 'center' },
  track: { height: 6, borderRadius: Radius.sm, overflow: 'hidden' },
  fill: { height: '100%' },
  actions: { gap: Spacing.sm },
});
