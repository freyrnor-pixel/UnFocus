/**
 * EpisodeCloseSheet.tsx — "it's over": the one sheet that closes an ongoing symptom episode
 *
 * Two optional fields and a Skip. When did it stop (four backdate options, `Just now`
 * pre-selected) and — never required — did anything help. Writing goes through
 * useHealthStore.closeEpisode(), which sets the state and the end pair in ONE patch.
 *
 * **The second field never blocks the close.** No validation, no "are you sure", no return
 * trip: the primary action is live from the moment the sheet opens, and Skip closes with
 * neither field filled. Someone reaching this sheet has just stopped being unwell; the app's
 * job is to get out of the way.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Surface, components/Button,
 *             components/PressableScale, components/DateChipRow, components/FormControls (Input),
 *             constants/theme, lib/date (todayStr), lib/episodes (backdatedStart,
 *             reliefCandidates), lib/haptics (tap), lib/i18n, lib/useAppTheme,
 *             store/useHealthStore (closeEpisode), store/useMedicineStore (medicines + doses,
 *             read-only — the relief chips)
 *   Used by → app/(tabs)/health.tsx (via components/OpenEpisodeCard.tsx's "It's over"),
 *             app/health-detail.tsx (an ongoing entry's row action)
 *   Data    → health_logs via useHealthStore.closeEpisode (episode_state + end_date/end_time
 *             + relief_note/relief_medicine_id); reads medicines/medicine_doses
 *
 * Edit notes:
 *   - **Relief chips are a filter, not a claim.** They list medicines with a dose logged
 *     between the episode's start and the chosen stop — "you took this while it was
 *     happening", nothing more. Never rank them, never pre-select one, never say a medicine
 *     helped. See lib/episodes.ts's header for the full limit.
 *   - When there are no candidates the chip row is ABSENT — not empty, not a placeholder.
 *   - Chips copy app/health-form.tsx's "Possibly from" chip styling on purpose: the two
 *     medicine-pickers on this domain should read as the same control.
 *   - `Skip` reuses `t.skipBtn` (not `t.onboarding.skip`, which is "Skip for now" and a
 *     different control).
 *   - No notification is scheduled here, ever — lib/__tests__/episodes.test.ts source-scans
 *     this file to keep that true.
 *   - **Wrapped in a KeyboardAvoidingView** (same fix as components/UpdateSheet.tsx /
 *     components/ShoppingItemSheet.tsx) because RN's `<Modal>` — which AnimatedBottomSheet
 *     renders into — sits outside the screen's own KeyboardAvoidingView subtree. Without this
 *     the keyboard covered the "did anything help" note field and the action buttons below it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import DateChipRow from '@/components/DateChipRow';
import { Input } from '@/components/FormControls';
import { todayStr } from '@/lib/date';
import { backdatedStart, reliefCandidates, type BackdatePreset } from '@/lib/episodes';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useHealthStore, type HealthLog } from '@/store/useHealthStore';
import { useMedicineStore } from '@/store/useMedicineStore';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

/** The four options offered wherever a time is asked for. 'pick' is the only one that
 *  reveals fields; the other three resolve straight to a concrete date + HH:MM. */
type StopChoice = BackdatePreset | 'pick';

type Props = {
  /** The episode being closed, or null when the sheet is closed. */
  log: HealthLog | null;
  onClose: () => void;
};

export default function EpisodeCloseSheet({ log, onClose }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const closeEpisode = useHealthStore((s) => s.closeEpisode);
  const medicines = useMedicineStore((s) => s.medicines);
  const doses = useMedicineStore((s) => s.doses);

  const [choice, setChoice] = useState<StopChoice>('now');
  const [pickDate, setPickDate] = useState(todayStr());
  const [pickTime, setPickTime] = useState('');
  const [calExpanded, setCalExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [medicineId, setMedicineId] = useState('');

  /**
   * Re-seed the "Pick a time" date each time the sheet OPENS (2026-08-13).
   *
   * `pickDate`'s initial value is read when this component mounts, which is when the Health
   * tab mounts — i.e. app launch — and `reset()` only runs on dismiss. So the first open in a
   * session that has been alive since yesterday defaulted the date to yesterday. Same family as
   * the Habits tab's stale `today`, and far milder (this one is on screen, in a date field the
   * user can see and change), but the honest default for "when did it stop" is today, and this
   * is the one line that keeps it that way. Keyed on `log?.id` so re-renders while the sheet is
   * already open don't stamp over a date the user has just picked.
   */
  const openId = log?.id ?? null;
  useEffect(() => {
    if (openId) setPickDate(todayStr());
  }, [openId]);

  /** Resolved on every render rather than at open, so `Just now` means the moment the
   *  user confirms — not the moment the sheet appeared. */
  function resolveStop(): { date: string; time: string } {
    if (choice === 'pick') return { date: pickDate, time: pickTime.trim() };
    return backdatedStart(choice, new Date());
  }

  const stop = resolveStop();

  const candidates = useMemo(
    () =>
      log
        ? reliefCandidates(
            medicines.filter((m) => m.active),
            doses,
            log,
            stop
          )
        : [],
    [log, medicines, doses, stop.date, stop.time] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function reset() {
    setChoice('now');
    setPickDate(todayStr());
    setPickTime('');
    setCalExpanded(false);
    setNote('');
    setMedicineId('');
  }

  function dismiss() {
    reset();
    onClose();
  }

  /** `skip` closes with neither optional field — same write, nothing filled in. */
  function confirm(skip = false) {
    if (!log) return;
    closeEpisode(log.id, {
      stop: resolveStop(),
      reliefNote: skip ? '' : note,
      reliefMedicineId: skip ? '' : medicineId,
    });
    dismiss();
  }

  const STOP_OPTIONS: { id: StopChoice; label: string }[] = [
    { id: 'now', label: t.episodes.when.justNow },
    { id: 'thisMorning', label: t.episodes.when.thisMorning },
    { id: 'lastNight', label: t.episodes.when.lastNight },
    { id: 'pick', label: t.episodes.when.pickTime },
  ];

  return (
    <AnimatedBottomSheet visible={log !== null} onClose={dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexFill}
      >
        <Surface surfaceContext="overlay" style={styles.sheet}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollBody}>
            <Text style={[styles.title, { color: theme.text }]}>{log?.ailment ?? ''}</Text>

            {/* When did it stop? */}
            <Text style={[styles.label, { color: theme.textMuted }]}>
              {t.episodes.whenDidItStop}
            </Text>
            <View style={styles.chipRow}>
              {STOP_OPTIONS.map((option) => {
                const active = choice === option.id;
                return (
                  <PressableScale
                    key={option.id}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      active && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      tap();
                      setChoice(option.id);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    scaleTo={0.97}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: theme.text },
                        active && { color: theme.accentInk },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            {choice === 'pick' && (
              <View style={styles.pickBlock}>
                <DateChipRow
                  value={pickDate}
                  onChange={setPickDate}
                  expanded={calExpanded}
                  setExpanded={setCalExpanded}
                />
                <Input
                  value={pickTime}
                  onChangeText={setPickTime}
                  placeholder={t.timeInputPlaceholder}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}

            {/* Did anything help? — optional, and it never blocks the close. */}
            <Text style={[styles.label, { color: theme.textMuted }]}>
              {t.episodes.didAnythingHelp}
            </Text>
            <Input
              optional
              value={note}
              onChangeText={setNote}
              placeholder={t.notesPlaceholder}
              multiline
              style={styles.noteInput}
            />

            {/* Medicines taken while it was happening. Absent — not empty — when there are
              none. A chip is "you took this then", never "this helped". */}
            {candidates.length > 0 && (
              <View style={styles.chipRow}>
                {candidates.map((m) => {
                  const active = medicineId === m.id;
                  return (
                    <PressableScale
                      key={m.id}
                      style={[
                        styles.chip,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                        active && { backgroundColor: theme.accent, borderColor: theme.accent },
                      ]}
                      onPress={() => {
                        tap();
                        setMedicineId(active ? '' : m.id);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      scaleTo={0.97}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: theme.text },
                          active && { color: theme.accentInk },
                        ]}
                      >
                        {m.name}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            )}

            <View style={styles.actions}>
              <Button
                label={t.skipBtn}
                variant="ghost"
                onPress={() => confirm(true)}
                style={styles.action}
              />
              <Button label={t.episodes.itsOver} onPress={() => confirm()} style={styles.action} />
            </View>
          </ScrollView>
        </Surface>
      </KeyboardAvoidingView>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  flexFill: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  scrollBody: { gap: Spacing.sm, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginTop: Spacing.xs },
  // Same pill sizing as app/health-form.tsx's "Possibly from" row — one control, not two.
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  pickBlock: { gap: Spacing.xs },
  noteInput: { minHeight: 64, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  action: { flex: 1 },
});
