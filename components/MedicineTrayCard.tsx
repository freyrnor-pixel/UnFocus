/**
 * MedicineTrayCard.tsx — the Health tab's medicine card: "when to take what", plus logging.
 *
 * Four **trays** (morning/midday/evening/night) instead of exact per-medicine clock times:
 * a tray is a window, not a deadline, so a dose taken at 11:40 is still a morning dose and
 * an untaken one reads "still due", never "missed". That framing is the whole point of the
 * design — see lib/medicineSchedule.ts's header for the reasoning, and keep any new copy
 * here on the same side of it (no "missed", no "skipped", no streak).
 *
 * Anatomy, top to bottom: a status line ("Still due: Morning" / "Next: Midday at 12:00" /
 * "Everything taken today"), an optional person filter (People/family mode), a collapsible
 * reminder-times panel, one section per tray in use with a tap-to-take row per medicine,
 * an "As needed" section governed by each medicine's minimum-gap guard, and a trailing
 * AddRow that quick-creates a medicine into the current tray. Tapping a medicine's NAME
 * opens app/medicine-form.tsx; tapping its CIRCLE logs/unlogs the dose — the same
 * split-target convention as Shopping rows and Home's Plans preview.
 *
 * Connections:
 *   Imports → components/Surface, components/CardAccent (CardAccentBadge), components/AddRow,
 *             components/PressableScale, components/IconButton, components/Collapsible,
 *             components/StarterCard (compact first-run explainer), components/FormControls
 *             (Input/Switch), constants/theme, lib/date (todayStr), lib/haptics, lib/i18n,
 *             lib/domainColor, lib/medicineSchedule (all tray/dose math), lib/useAppTheme,
 *             lib/useNowMinutes (60s tick, shared with components/PlanTaskCard.tsx),
 *             lib/useKeyboardLift (per tray-time field), store/useMedicineStore,
 *             store/useSettingsStore
 *   Used by → app/(tabs)/health.tsx (rendered above Quick log, gated on settings.featureMedicine)
 *   Data    → useMedicineStore (medicines + medicine_doses) via add/takeDose/untakeDose;
 *             useSettingsStore for the tray times + reminder switch (written straight back)
 *             and People-mode profiles
 *
 * Edit notes:
 *   - Quick-add puts the new medicine in the tray whose window contains NOW (falling back
 *     to the first tray of the day when it's before the earliest one), because that's what
 *     someone adding a medicine mid-dose is almost always doing. Everything else about it
 *     is editable in the form.
 *   - Tray times are edited here rather than in Settings: they're only meaningful next to
 *     the trays themselves. Drafts are committed on BLUR (not per keystroke) so a
 *     half-typed "1" never gets persisted as a reminder time, and only when
 *     parseTimeToMinutes accepts them.
 *   - Every write goes through the store, which re-syncs the tray reminders itself — this
 *     component never schedules a notification directly.
 *   - `person` is `null` (not '') when People mode is off, so the helpers don't filter at
 *     all; passing '' would hide every profile's medicine. See lib/medicineSchedule.ts.
 *   - **Keyboard-avoidance (2026-08-01)**: each of the 4 tray-time fields gets its own
 *     `useKeyboardLift`, same pattern as TaskCard's fields — the reminder panel can sit well
 *     down the card, and `Input` doesn't forward a ref, so each field's wrapping View is what
 *     gets measured/lifted (see lib/useKeyboardLift.ts's doc on wrapping vs. direct refs).
 *     The trailing AddRow already lifts itself internally — nothing to add there.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import { CardAccentBadge } from '@/components/CardAccent';
import AddRow from '@/components/AddRow';
import PressableScale from '@/components/PressableScale';
import IconButton from '@/components/IconButton';
import Collapsible from '@/components/Collapsible';
import StarterCard from '@/components/StarterCard';
import { Input, Switch } from '@/components/FormControls';
import { useMedicineStore, Medicine } from '@/store/useMedicineStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip from '@/components/PersonChip';
import { personColor } from '@/lib/personColor';
import { useT } from '@/lib/i18n';
import { todayStr, parseTimeToMinutes } from '@/lib/date';
import { success, tap } from '@/lib/haptics';
import { getDomainColor } from '@/lib/domainColor';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { useKeyboardLift } from '@/lib/useKeyboardLift';
import {
  asNeededMedicines,
  asNeededState,
  currentTray,
  formatMinutes,
  isDoseTaken,
  medicinesForTray,
  nextTray,
  pendingTrays,
  sortedTrays,
  TRAY_IDS,
  TrayId,
  trayMinutes,
  trayProgress,
  traysInUse,
} from '@/lib/medicineSchedule';
import { FontSize, Fonts, Radius, Spacing, Type, HitSlop } from '@/constants/theme';

/** Time-of-day glyph per tray — the pill-organiser row, read left to right. */
const TRAY_ICONS: Record<TrayId, React.ComponentProps<typeof Ionicons>['name']> = {
  morning: 'sunny-outline',
  midday: 'partly-sunny-outline',
  evening: 'cloudy-night-outline',
  night: 'moon-outline',
};

export default function MedicineTrayCard() {
  const router = useRouter();
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const healthColor = getDomainColor(theme, 'health');

  const medicines = useMedicineStore((s) => s.medicines);
  const doses = useMedicineStore((s) => s.doses);
  const takeDose = useMedicineStore((s) => s.takeDose);
  const untakeDose = useMedicineStore((s) => s.untakeDose);
  const addMedicine = useMedicineStore((s) => s.add);
  const syncReminders = useMedicineStore((s) => s.syncTrayReminders);

  const trayTimes = useSettingsStore((s) => s.medicineTrayTimes);
  const remindersEnabled = useSettingsStore((s) => s.medicineRemindersEnabled);
  const quietHoursEnabled = useSettingsStore((s) => s.quietHoursEnabled);
  // People/family is part of the sharing surface that's hidden while the single-user basics
  // are reworked (2026-08-05) — see lib/sharingVisibility.ts. The setting keeps its stored
  // value and every person row stays in the DB, so an existing multi-person setup returns
  // intact when the switch flips back; only the UI stands down.
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled) && SHARING_VISIBLE;
  const people = usePeopleStore((s) => s.people);
  const updateSettings = useSettingsStore((s) => s.update);

  const [draft, setDraft] = useState('');
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [timeDrafts, setTimeDrafts] = useState<Partial<Record<TrayId, string>>>({});
  const [selectedPerson, setSelectedPerson] = useState('');

  // One lift per tray field (hooks can't be called from inside TRAY_IDS.map) — see the
  // keyboard-avoidance edit note above.
  const morningLift = useKeyboardLift<View>();
  const middayLift = useKeyboardLift<View>();
  const eveningLift = useKeyboardLift<View>();
  const nightLift = useKeyboardLift<View>();
  const trayLifts: Record<TrayId, ReturnType<typeof useKeyboardLift<View>>> = {
    morning: morningLift,
    midday: middayLift,
    evening: eveningLift,
    night: nightLift,
  };

  const now = useNowMinutes();
  const today = todayStr();
  const showProfiles = peopleModeEnabled && people.length > 1;
  const person = showProfiles ? selectedPerson : null;

  const activeTrays = useMemo(
    () => traysInUse(medicines, trayTimes, person),
    [medicines, trayTimes, person]
  );
  const asNeeded = useMemo(() => asNeededMedicines(medicines, person), [medicines, person]);
  const due = useMemo(
    () => pendingTrays(medicines, doses, trayTimes, today, now, person),
    [medicines, doses, trayTimes, today, now, person]
  );
  const upcoming = nextTray(trayTimes, now);
  const hasScheduled = activeTrays.length > 0;

  /** "Still due: Morning" → "Next: Midday at 12:00" → "Everything taken today". */
  function statusLine(): { text: string; color: string } {
    if (due.length > 0) {
      return { text: t.medicine.stillDue(t.medicine.trays[due[0]]), color: theme.warn };
    }
    if (upcoming && activeTrays.includes(upcoming)) {
      return {
        text: t.medicine.nextUp(
          t.medicine.trays[upcoming],
          formatMinutes(trayMinutes(trayTimes, upcoming))
        ),
        color: theme.textMuted,
      };
    }
    if (!hasScheduled) return { text: t.medicine.nothingScheduled, color: theme.textMuted };
    return { text: t.medicine.allTaken, color: theme.good };
  }

  function toggleDose(med: Medicine, tray: TrayId) {
    if (isDoseTaken(doses, med.id, tray, today)) {
      tap();
      untakeDose(med.id, tray, today);
      return;
    }
    success();
    takeDose(med.id, tray, today);
  }

  function commitAdd() {
    const name = draft.trim();
    if (!name) return;
    // Default to the tray we're standing in — before the day's first tray, use that one.
    const tray = currentTray(trayTimes, now) ?? sortedTrays(trayTimes)[0];
    addMedicine({ name, trays: [tray], childName: person ?? '' });
    setDraft('');
    success();
  }

  function commitTrayTime(tray: TrayId) {
    const raw = timeDrafts[tray];
    setTimeDrafts((prev) => ({ ...prev, [tray]: undefined }));
    if (raw === undefined || parseTimeToMinutes(raw) === null) return; // keep the stored time
    updateSettings({ medicineTrayTimes: { ...trayTimes, [tray]: raw } });
    syncReminders();
  }

  const status = statusLine();

  // No `borderColor` (card design reset, 2026-08-05): a card on its own screen inherits that
  // screen's one hue. The domain colour it used to pass is the BADGE palette
  // (lib/domainColor.ts), which still drives the badge inside — the edge is the screen's, the
  // badge is the domain's, and they no longer compete.
  return (
    <Surface style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          {/* `medkit`, not the domain default heart (2026-07-28 design review) — Health's three
              cards (Medicine, Quick log, This week) all fell back to DOMAIN_ICON.health and read
              as the same badge repeated three times. See app/(tabs)/health.tsx's matching note. */}
          <CardAccentBadge domain="health" icon="medkit" size={22} />
          <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.medicine.title}</Text>
          <IconButton
            icon={remindersEnabled ? 'alarm-outline' : 'notifications-off-outline'}
            label={t.medicine.editReminders}
            onPress={() => {
              tap();
              setRemindersOpen((v) => !v);
            }}
            active={remindersOpen}
            size={30}
          />
        </View>

        <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>

        {medicines.length === 0 && <StarterCard text={t.starters.medicine.text} compact />}

        {/* Person filter (People/family mode) — one chip per person, same as Habits. */}
        <Collapsible open={showProfiles}>
          <View style={styles.profileRow}>
            {people.map((person, index) => {
              const value = person.isSelf ? '' : person.name;
              return (
                <PersonChip
                  key={person.id}
                  label={person.isSelf ? person.name || t.medicine.forMe : person.name}
                  name={person.name}
                  color={personColor(person.color, index)}
                  selected={selectedPerson === value}
                  onPress={() => {
                    tap();
                    setSelectedPerson(value);
                  }}
                />
              );
            })}
          </View>
        </Collapsible>

        {/* Reminder times — one per tray, shared by its medicines. */}
        <Collapsible open={remindersOpen}>
          <View style={[styles.reminderPanel, { borderColor: theme.border }]}>
            <View style={styles.reminderToggleRow}>
              <Text style={[styles.reminderLabel, { color: theme.text }]}>
                {t.medicine.remindersToggle}
              </Text>
              <Switch
                checked={remindersEnabled}
                onChange={(v) => {
                  updateSettings({ medicineRemindersEnabled: v });
                  syncReminders();
                }}
              />
            </View>
            {!remindersEnabled && (
              <Text style={[styles.reminderHint, { color: theme.textMuted }]}>
                {t.medicine.remindersOffHint}
              </Text>
            )}
            {remindersEnabled && (
              <>
                <View style={styles.timeGrid}>
                  {TRAY_IDS.map((tray) => (
                    <View key={tray} style={styles.timeField}>
                      <Text style={[styles.timeFieldLabel, { color: theme.textMuted }]}>
                        {t.medicine.trays[tray]}
                      </Text>
                      <View ref={trayLifts[tray].ref}>
                        <Input
                          value={timeDrafts[tray] ?? trayTimes[tray]}
                          onChangeText={(v) => setTimeDrafts((prev) => ({ ...prev, [tray]: v }))}
                          onFocus={trayLifts[tray].onFocus}
                          onBlur={() => {
                            commitTrayTime(tray);
                            trayLifts[tray].onBlur();
                          }}
                          placeholder={t.timeInputPlaceholder}
                          keyboardType="numbers-and-punctuation"
                          style={styles.timeInput}
                        />
                      </View>
                    </View>
                  ))}
                </View>
                {quietHoursEnabled && (
                  <Text style={[styles.reminderHint, { color: theme.textMuted }]}>
                    {t.medicine.remindersQuietHint}
                  </Text>
                )}
              </>
            )}
          </View>
        </Collapsible>

        {/* One section per tray in use, in time order. */}
        {activeTrays.map((tray) => {
          const inTray = medicinesForTray(medicines, tray, person);
          const { total, taken } = trayProgress(medicines, doses, tray, today, person);
          const isDue = due.includes(tray);
          return (
            <View key={tray} style={styles.traySection}>
              <View style={styles.trayHeader}>
                <Ionicons
                  name={TRAY_ICONS[tray]}
                  size={15}
                  color={isDue ? theme.warn : theme.textMuted}
                />
                <Text style={[styles.trayLabel, { color: theme.text }]}>
                  {t.medicine.trays[tray]}
                </Text>
                <Text style={[styles.trayTime, { color: theme.textMuted }]}>
                  {formatMinutes(trayMinutes(trayTimes, tray))}
                </Text>
                <Text
                  style={[
                    styles.trayCount,
                    { color: taken === total ? theme.good : theme.textMuted },
                  ]}
                >
                  {t.medicine.trayProgress(taken, total)}
                </Text>
              </View>
              {inTray.map((med) => {
                const isTaken = isDoseTaken(doses, med.id, tray, today);
                const dose = doses.find(
                  (d) => d.medicineId === med.id && d.date === today && d.tray === tray
                );
                return (
                  <View key={med.id} style={styles.medRow}>
                    <PressableScale
                      style={styles.medNameWrap}
                      onPress={() =>
                        router.push({ pathname: '/medicine-form', params: { id: med.id } })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={med.name}
                      scaleTo={0.98}
                    >
                      <Text
                        style={[styles.medName, { color: isTaken ? theme.textMuted : theme.text }]}
                        numberOfLines={1}
                      >
                        {med.name}
                        {med.dose ? (
                          <Text style={{ color: theme.textMuted }}>{`  ${med.dose}`}</Text>
                        ) : null}
                      </Text>
                      {showProfiles && med.childName ? (
                        <Text style={[styles.medMeta, { color: theme.textMuted }]}>
                          {med.childName}
                        </Text>
                      ) : null}
                    </PressableScale>
                    {isTaken && dose?.takenAt ? (
                      <Text style={[styles.medMeta, { color: theme.good }]}>
                        {t.medicine.takenAt(dose.takenAt)}
                      </Text>
                    ) : null}
                    {/* Dose circle in the right margin (2026-07-30 row rule — see AGENTS.md and
                        components/PadRow.tsx). It used to lead this row. */}
                    <PressableScale
                      onPress={() => toggleDose(med, tray)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isTaken }}
                      accessibilityLabel={
                        isTaken ? t.medicine.undoTaken(med.name) : t.medicine.markTaken(med.name)
                      }
                      hitSlop={HitSlop.check}
                      scaleTo={0.9}
                    >
                      <View
                        style={[
                          styles.doseCircle,
                          { borderColor: isTaken ? theme.good : theme.border },
                          isTaken && { backgroundColor: theme.good },
                        ]}
                      >
                        {isTaken && <Ionicons name="checkmark" size={13} color={theme.accentInk} />}
                      </View>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* As-needed — no tray, no reminder, just the interval/limit guard. */}
        {asNeeded.length > 0 && (
          <View style={styles.traySection}>
            <View style={styles.trayHeader}>
              <Ionicons name="flash-outline" size={15} color={theme.textMuted} />
              <Text style={[styles.trayLabel, { color: theme.text }]}>
                {t.medicine.asNeededLabel}
              </Text>
            </View>
            {asNeeded.map((med) => {
              const state = asNeededState(med, doses, today, now);
              const stateText = state.atDailyLimit
                ? t.medicine.asNeededLimit
                : state.nextAllowedMinutes !== null
                  ? t.medicine.asNeededWait(formatMinutes(state.nextAllowedMinutes))
                  : t.medicine.asNeededReady;
              return (
                <View key={med.id} style={styles.medRow}>
                  <PressableScale
                    onPress={() => {
                      if (!state.canTake) {
                        tap();
                        return;
                      }
                      success();
                      takeDose(med.id, '', today);
                    }}
                    disabled={!state.canTake}
                    accessibilityRole="button"
                    accessibilityLabel={t.medicine.logDose(med.name)}
                    accessibilityState={{ disabled: !state.canTake }}
                    hitSlop={HitSlop.base}
                    scaleTo={0.9}
                  >
                    <View
                      style={[
                        styles.doseCircle,
                        { borderColor: state.canTake ? healthColor.accent : theme.border },
                        !state.canTake && { opacity: 0.5 },
                      ]}
                    >
                      {/* A.4 rule 1: the health hue stays on the circle's edge; the "+" glyph
                          takes the app's one action colour. */}
                      <Ionicons
                        name="add"
                        size={14}
                        color={state.canTake ? theme.accent : theme.textMuted}
                      />
                    </View>
                  </PressableScale>
                  <PressableScale
                    style={styles.medNameWrap}
                    onPress={() =>
                      router.push({ pathname: '/medicine-form', params: { id: med.id } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={med.name}
                    scaleTo={0.98}
                  >
                    <Text style={[styles.medName, { color: theme.text }]} numberOfLines={1}>
                      {med.name}
                      {med.dose ? (
                        <Text style={{ color: theme.textMuted }}>{`  ${med.dose}`}</Text>
                      ) : null}
                    </Text>
                    <Text style={[styles.medMeta, { color: theme.textMuted }]}>{stateText}</Text>
                  </PressableScale>
                  {state.takenToday > 0 && (
                    <PressableScale
                      onPress={() => {
                        tap();
                        untakeDose(med.id, '', today);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t.medicine.undoTaken(med.name)}
                      hitSlop={HitSlop.base}
                      scaleTo={0.92}
                    >
                      <Text style={[styles.medMeta, { color: theme.good }]}>
                        {t.medicine.asNeededTakenToday(state.takenToday)}
                      </Text>
                    </PressableScale>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <AddRow
          placeholder={t.medicine.addPlaceholder}
          value={draft}
          onChangeText={setDraft}
          onSubmit={commitAdd}
          accent={healthColor.accent}
          showDivider={medicines.length > 0}
          accessibilityLabel={t.medicine.addPlaceholder}
        />
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  // Decision 043 rule 2: Spacing.xl above every section (matches health.tsx's cards).
  card: { borderRadius: Radius.md, marginTop: Spacing.xl },
  cardContent: { flex: 1, padding: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionLabel: { flex: 1, fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
  status: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginTop: Spacing.xs },
  profileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  reminderPanel: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  reminderToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderLabel: { flex: 1, fontSize: FontSize.sm },
  reminderHint: { fontSize: FontSize.xs },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  timeField: { flexGrow: 1, flexBasis: '45%', gap: 2 },
  timeFieldLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  timeInput: { paddingVertical: Spacing.xs },
  traySection: { marginTop: Spacing.md },
  trayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  trayLabel: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  trayTime: { fontSize: FontSize.xs },
  trayCount: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    minWidth: 28,
    textAlign: 'right',
  },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  doseCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // minWidth:0 so a long medicine name shrinks instead of pushing the trailing dose circle
  // off the card — the same guard components/PadRow.tsx carries.
  medNameWrap: { flex: 1, minWidth: 0 },
  medName: { fontSize: FontSize.sm },
  medMeta: { fontSize: FontSize.xs },
});
