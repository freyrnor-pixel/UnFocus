/**
 * NextTaskCard.tsx — "Up next" single-task suggestion
 *
 * Shows the one task lib/taskSuggestion.ts picked as the best next thing to do
 * right now, with a one-tap "Mark done" action — or a gentle "caught up" empty
 * state when there's no suggestion. Mounted unconditionally by the caller.
 *
 * Connections:
 *   Imports → components/PressableScale, constants/theme, lib/haptics, lib/i18n, lib/useAppTheme, store/useTaskStore
 *   Used by → (not yet mounted — Phase 5: app/index.tsx)
 *   Data    → none directly; takes a Task via props and writes through useTaskStore's toggle() (Phase 5 stub, Decision 015)
 *
 * Edit notes:
 *   - Uses theme.hintBg/hintBorder/hintAccent (the same "soft card surface" tokens
 *     as HintCard) rather than a new colour — keeps it in tune with the active theme.
 *   - Mark-done calls useTaskStore's toggle() directly and fires success() here for
 *     feedback, but deliberately adds no completion glow/scale animation of its own —
 *     if the same task is also visible as a TaskItem row elsewhere on screen, that
 *     component already animates the rising edge of "done"; a second effect here
 *     would double it up.
 *   - Countdown badge (toMinutes/useNowMinutes, mirrored from DayTimeline.tsx rather
 *     than shared) re-renders every 60s; colour cue escalates textMuted → accent
 *     (≤15min) → bad (now/overdue) so the badge itself signals urgency, not just the
 *     text. Chip background pairs each state with its Soft token (surfaceMuted/
 *     accentSoft/badSoft) rather than the old `color + '22'` hex-alpha hack, which
 *     Decision 006 rules out (no colour derived outside the token set).
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { success } from '@/lib/haptics';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTaskStore, Task } from '@/store/useTaskStore';

type Props = {
  task: Task | null;
};

function toMinutes(time: string): number | null {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** Re-renders every 60s so the countdown badge stays current. */
function useNowMinutes(): number {
  const [now, setNow] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function NextTaskCard({ task }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const toggle = useTaskStore((s) => s.toggle);
  const nowMinutes = useNowMinutes();

  if (!task) {
    return (
      <View style={[styles.card, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}>
        <View style={[styles.accentBar, { backgroundColor: theme.hintAccent }]} />
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.nextTask.empty}</Text>
      </View>
    );
  }

  const start = task.time ? toMinutes(task.time) : null;
  const end = start !== null && task.taskType === 'time-box' ? start + (task.durationMinutes ?? 30) : start;
  const isHappeningNow = start !== null && end !== null && task.taskType === 'time-box' && nowMinutes >= start && nowMinutes < end;
  const diff = start !== null ? start - nowMinutes : null;

  let countdownLabel: string | null = null;
  let countdownColor = theme.textMuted;
  let countdownBg = theme.surfaceMuted;
  if (start !== null && diff !== null) {
    if (isHappeningNow || diff <= 0) {
      countdownLabel = t.nextTask.now;
      countdownColor = theme.bad;
      countdownBg = theme.badSoft;
    } else if (diff <= 15) {
      countdownLabel = t.nextTask.inMinutes(diff);
      countdownColor = theme.accent;
      countdownBg = theme.accentSoft;
    } else if (diff < 60) {
      countdownLabel = t.nextTask.inMinutes(diff);
    } else {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      countdownLabel = m === 0 ? t.nextTask.inHours(h) : t.nextTask.inHoursMinutes(h, m);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.hintBg, borderColor: theme.hintBorder }]}>
      <View style={[styles.accentBar, { backgroundColor: theme.hintAccent }]} />
      <View style={styles.body}>
        <Text style={[styles.label, { color: theme.hintAccent }]}>{t.nextTask.title}</Text>
        <Text style={[styles.taskTitle, { color: theme.text }]} numberOfLines={1}>{task.title}</Text>
        {task.time ? (
          <View style={styles.taskTimeRow}>
            <Text style={[styles.taskTime, { color: theme.textMuted }]}>{task.time}</Text>
            {countdownLabel ? (
              <View style={[styles.countdownChip, { backgroundColor: countdownBg }]}>
                <Ionicons name="alarm-outline" size={11} color={countdownColor} />
                <Text style={[styles.countdownText, { color: countdownColor }]}>{countdownLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <PressableScale
        style={[styles.doneBtn, { backgroundColor: theme.hintAccent }]}
        scaleTo={0.95}
        onPress={() => {
          success();
          toggle(task.id);
        }}
        hitSlop={8}
      >
        <Ionicons name="checkmark" size={16} color={theme.accentInk} />
        <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.nextTask.markDone}</Text>
      </PressableScale>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.sm,
    marginBottom: Spacing.md,
  },
  accentBar: { width: 3, alignSelf: 'stretch', marginRight: Spacing.sm },
  body: { flex: 1, gap: 2 },
  emptyText: { flex: 1, fontSize: FontSize.sm, fontStyle: 'italic', paddingHorizontal: Spacing.sm },
  label: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  taskTitle: { fontSize: FontSize.sm, fontWeight: '600' },
  taskTimeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  taskTime: { fontSize: FontSize.xs },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  countdownText: { fontSize: FontSize.xs, fontWeight: '700' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
  },
  doneBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
});
