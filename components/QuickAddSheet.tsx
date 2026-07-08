/**
 * QuickAddSheet.tsx — bottom-sheet for quickly adding a task from the home screen.
 *
 * Modal with a title input, a horizontal day picker (today + next 6 days), and
 * a time field defaulted to the next hour — tap "Whenever" to clear it and mean
 * "sometime that day" instead of a fixed time. On save it creates a default
 * 'start-at' task via the task store. State resets each time the sheet becomes visible.
 *
 * Connections:
 *   Imports → components/ConfirmationBanner, components/Surface, constants/theme,
 *             lib/date, lib/i18n, lib/useAppTheme, store/useTaskStore,
 *             react-native-safe-area-context
 *   Used by → (not yet mounted — Phase 5 screen: app/index.tsx)
 *   Data    → calls useTaskStore.add() (real store since 2026-07-02, was a Decision 015 stub) to insert a
 *             task; scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Time defaults to shown + next-hour-prefilled (showTime starts true); "Whenever" clears it to undefined.
 *   - dayOptions is memoized on t.today/t.tomorrow; a language change remounts the sheet so dayShort stays in sync.
 *   - save() builds a task with fixed defaults (taskType 'start-at', recurring 'none', importance 'regular') — extend here for richer quick-add.
 *   - All visible strings via useT(); placeholders like "HH:MM" are format hints, not user copy.
 *   - save() shows a ConfirmationBanner and delays onClose() by 300ms (mirrors task-form.tsx) so there's
 *     always positive proof the task was saved, even if it sorts past the home screen's visible cap.
 *   - Decision 008: the sheet is a glass Surface in `overlay` context (it sits over live
 *     screen content). Blur comes from Surface's BlurView; this file never imports
 *     expo-blur directly.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore } from '@/store/useTaskStore';
import { useT } from '@/lib/i18n';
import { todayStr, dateStr } from '@/lib/date';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';

type DayOption = { label: string; date: string };

function nextHourStr(): string {
  const h = (new Date().getHours() + 1) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function QuickAddSheet({ visible, onClose }: Props) {
  const addTask = useTaskStore((s) => s.add);
  const theme = useAppTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showTime, setShowTime] = useState(true);
  const [time, setTime] = useState(nextHourStr);
  const [confirm, setConfirm] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const dayOptions = useMemo((): DayOption[] => {
    const today = new Date();
    const opts: DayOption[] = [{ label: t.today, date: dateStr(today) }];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      opts.push({
        label: i === 1 ? t.tomorrow : t.dayShort[d.getDay()],
        date: dateStr(d),
      });
    }
    return opts;
    // dayShort/today/tomorrow only change when language changes, which remounts this sheet anyway
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.today, t.tomorrow]);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setSelectedDate(todayStr());
      setShowTime(true);
      setTime(nextHourStr());
      setConfirm(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [visible]);

  function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    addTask({
      title: trimmed,
      date: selectedDate,
      time: time.trim() || undefined,
      taskType: 'start-at',
      durationMinutes: undefined,
      done: false,
      recurring: 'none',
      recurringDays: [],
      importance: 'regular',
      sortOrder: 0,
    });
    setConfirm(t.taskSavedSimple);
    // Let the confirmation land before the sheet closes — mirrors task-form.tsx.
    setTimeout(onClose, 300);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kvWrapper}
      >
        <Surface
          surfaceContext="overlay"
          style={[styles.sheet, { paddingBottom: Math.max(Spacing.xl, bottomInset + Spacing.md) }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <TextInput
            ref={inputRef}
            style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.border }]}
            placeholder={t.whatToDo}
            placeholderTextColor={theme.textMuted}
            value={title}
            onChangeText={setTitle}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayScroll}
            contentContainerStyle={styles.dayRow}
          >
            {dayOptions.map((opt) => {
              const active = selectedDate === opt.date;
              return (
                <PressableScale
                  key={opt.date}
                  style={[
                    styles.dayChip,
                    { backgroundColor: active ? theme.accent : theme.surfaceMuted },
                  ]}
                  onPress={() => setSelectedDate(opt.date)}
                >
                  <Text style={[styles.dayChipText, { color: active ? theme.accentInk : theme.text }]}>
                    {opt.label}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          {!showTime ? (
            <Pressable style={styles.timeToggle} onPress={() => setShowTime(true)}>
              <Text style={[styles.timeToggleText, { color: theme.textMuted }]}>
                {t.addTime}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.timeInput, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                placeholder={t.timeInputPlaceholder}
                placeholderTextColor={theme.textMuted}
                value={time}
                onChangeText={setTime}
                keyboardType="numbers-and-punctuation"
              />
              <Pressable
                style={styles.timeToggle}
                onPress={() => {
                  setShowTime(false);
                  setTime('');
                }}
              >
                <Text style={[styles.timeToggleText, { color: theme.textMuted }]}>
                  {t.timeModeWhenever}
                </Text>
              </Pressable>
            </View>
          )}

          <PressableScale
            style={[
              styles.saveBtn,
              { backgroundColor: theme.accent },
              (!title.trim() || !!confirm) && styles.saveBtnDisabled,
            ]}
            onPress={save}
            disabled={!title.trim() || !!confirm}
          >
            <Text style={[styles.saveBtnText, { color: theme.accentInk }]}>{t.save}</Text>
          </PressableScale>
        </Surface>
      </KeyboardAvoidingView>

      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  kvWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  titleInput: {
    fontSize: FontSize.xl,
    fontWeight: '500',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  dayScroll: { flexGrow: 0 },
  dayRow: { flexDirection: 'row', gap: Spacing.xs },
  dayChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  dayChipText: { fontSize: FontSize.sm, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  timeToggle: { paddingVertical: Spacing.xs },
  timeToggleText: { fontSize: FontSize.sm, fontWeight: '600' },
  timeInput: {
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    textAlign: 'center',
    width: 90,
  },
  saveBtn: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontWeight: '700', fontSize: FontSize.md },
});
