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
 *             components/PressableScale, components/Collapsible,
 *             components/CardHintNote (the empty-state explainer, `placement="head"` — the
 *             shared explainer line every other empty card uses; was a compact+embedded
 *             components/StarterCard until 2026-08-12), components/ReminderBell,
 *             components/FormControls (Input), constants/theme, lib/date (todayStr), lib/haptics, lib/i18n,
 *             lib/screenColor, lib/medicineSchedule (all tray/dose math), lib/useAppTheme,
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
 *   - **The bell IS the reminders switch (2026-08-10)** — components/ReminderBell.tsx, shared
 *     with app/habit-form.tsx. Read that file's header for the full story; the part specific to
 *     this card is that the bell used to open/close the times panel (`remindersOpen`) while
 *     drawing `settings.medicineRemindersEnabled`, a DIFFERENT value flipped by a `Switch`
 *     inside that panel. Pressing it changed nothing about it — reported as "Reminder bell
 *     button looks the same in both states". Now: bell toggles the setting, `Collapsible` opens
 *     on that same boolean, the duplicate `Switch` is deleted, and `remindersOpen` is gone. One
 *     setting, one control. (Before 2026-08-09 it was an `IconButton`; it is one again, via
 *     ReminderBell — the 2026-08-09 "plain bell, no chip background" pass is what removed the
 *     plate that made "on" legible, so this restores it deliberately rather than by accident.)
 *   - **There is no "nothing scheduled" status line (2026-08-10)**: `statusLine()` returns null
 *     for that case and the `<Text>` is skipped. It sat immediately above the starter card
 *     saying less than the card did, and read as unrelated to it. Note the second case it also
 *     covered: medicines that are ALL as-needed leave `hasScheduled` false while
 *     `medicines.length !== 0`, so no starter card renders either — the as-needed section
 *     speaks for itself there. Don't reintroduce the line to "fill" that gap.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import { CardAccentBadge } from '@/components/CardAccent';
import AddRow from '@/components/AddRow';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import CardCollapseToggle from '@/components/CardCollapseToggle';
import CardHintNote from '@/components/CardHintNote';
import ReminderBell from '@/components/ReminderBell';
import { Input } from '@/components/FormControls';
import { useMedicineStore, Medicine } from '@/store/useMedicineStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip from '@/components/PersonChip';
import { personColor } from '@/lib/personColor';
import { useT } from '@/lib/i18n';
import { todayStr, parseTimeToMinutes } from '@/lib/date';
import { success, tap } from '@/lib/haptics';
import { useScreenColor } from '@/lib/screenColor';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useCollapsedCard } from '@/lib/useCollapsedCard';
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
  // This screen's own hue (the card edge's source) — badge and buttons now match it instead
  // of lib/domainColor's 'health' identity (a different wine-red vs this screen's teal).
  const screenHue = useScreenColor() ?? theme.border;

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
  // Folded away, remembered across launches (2026-08-14). Presentation only: a collapsed card
  // still arms every tray reminder — nothing in lib/medicineNotifications.ts reads this.
  const [collapsed, toggleCollapsed] = useCollapsedCard('healthMedicine');
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

  /**
   * "Still due: Morning" → "Next: Midday at 12:00" → "Everything taken today", or NOTHING.
   *
   * Returns null when there is nothing scheduled (2026-08-10, user report: the line
   * "Ingenting satt opp i dag" "is placed weirdly in relation to the box under, and it is not
   * needed"). It was a caption with no relationship to the bordered box directly beneath it,
   * saying less than that box already said — the starter card when there are no medicines at
   * all, and the as-needed section when every medicine is PRN. A status line about a schedule
   * that doesn't exist is an absence dressed up as a status; showing nothing is the honest
   * shape. `t.medicine.nothingScheduled` was deleted from both languages with it.
   */
  function statusLine(): { text: string; color: string } | null {
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
    if (!hasScheduled) return null;
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
  // screen's one hue. The badge inside matches it too (`accentOverride`, 2026-08-06) — see
  // app/(tabs)/health.tsx's matching note.
  return (
    <Surface style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          {/* `medkit`, not the domain default heart (2026-07-28 design review) — Health's three
              cards (Medicine, Quick log, This week) all fell back to DOMAIN_ICON.health and read
              as the same badge repeated three times. See app/(tabs)/health.tsx's matching note.
              Size 32 (2026-08-09, was 22) — this is the Health tab's lead card, so it takes the
              same badge size Home's preview cards use, not the smaller sub-card size health.tsx's
              Quick log/This week headers use. */}
          <CardAccentBadge domain="health" icon="medkit" size={32} accentOverride={screenHue} />
          <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.medicine.title}</Text>
          {/* The bell IS the switch (2026-08-10, user report: "Reminder bell button looks the
              same in both states"). It used to open/close the times panel while its icon showed
              `medicineRemindersEnabled` — a different value, flipped by a Switch inside that
              panel — so pressing it genuinely changed nothing about it. Now it toggles reminders
              directly, the panel below follows that same boolean (so opening/closing IS the
              confirmation, and the duplicate Switch is gone), and the shared
              components/ReminderBell.tsx carries the four-channel on/off the report was
              missing. */}
          <ReminderBell
            enabled={remindersEnabled}
            onToggle={() => {
              tap();
              updateSettings({ medicineRemindersEnabled: !remindersEnabled });
              syncReminders();
            }}
            label={t.medicine.remindersToggle}
          />
          {/* Fold-away chevron (2026-08-14) — LAST in the header cluster, after the bell. The
              bell is about the card's SUBJECT (do these trays remind you) and the chevron is
              about the card itself, so the one that changes app behaviour keeps the position it
              has had, and the one that only changes what is drawn sits outermost. */}
          <CardCollapseToggle
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            cardLabel={t.medicine.title}
          />
        </View>

        <Collapsible open={!collapsed}>
        {status && <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>}

        {/* The empty-state explainer, under the header row (2026-08-12). It was a StarterCard
            (`compact embedded`) — a near-identical bulb + italic line — and is the shared
            components/CardHintNote now, so all five empty-state explainers are ONE component
            in ONE position: under the header while the card is empty. It was already in the
            right place before this pass (`statusLine()` returns null with nothing scheduled),
            so only the component changed; the visible diff is CardHintNote's own ink
            (`textMuted`) and lineHeight, which is the explainer line's tier.
            The local `marginTop` is this card's alone: `cardContent` has no `gap` and its
            children each carry their own, whereas the four Home cards' headers own a
            `marginBottom` that already supplies this gap. `placement="head"` only ever
            contributes the margin BELOW. */}
        {medicines.length === 0 && (
          <CardHintNote text={t.starters.medicine.text} placement="head" style={styles.hintNote} />
        )}

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

        {/* Reminder times — one per tray, shared by its medicines. Open state IS
            `remindersEnabled` (2026-08-10): the bell in the header owns the boolean, so the
            panel appearing is what confirms the press, and there is no second control in here
            saying the same thing. The old `remindersOpen` state and the duplicate `Switch` are
            both gone — one setting, one control. */}
        <Collapsible open={remindersEnabled}>
          <View style={[styles.reminderPanel, { borderColor: theme.border }]}>
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
          </View>
        </Collapsible>
        {/* The "reminders are off" line lives outside the panel — the panel only exists while
            they're on, so this is the one thing that has to say so when they aren't. */}
        {!remindersEnabled && (
          <Text style={[styles.reminderHint, { color: theme.textMuted }]}>
            {t.medicine.remindersOffHint}
          </Text>
        )}

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
                        { borderColor: state.canTake ? screenHue : theme.border },
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
          accent={screenHue}
          showDivider={medicines.length > 0}
          accessibilityLabel={t.medicine.addPlaceholder}
        />
        </Collapsible>
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  // No vertical margin (2026-08-08): the screen's content container owns the gap between
  // stacked cards (`SCREEN_GAP`, constants/theme.ts). Was `marginTop: Spacing.xl`.
  card: { borderRadius: Radius.md },
  cardContent: { flex: 1, padding: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionLabel: { flex: 1, fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
  status: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginTop: Spacing.xs },
  // `cardContent` has no `gap` — every child here carries its own top margin (see `status`
  // above). CardHintNote's `placement="head"` supplies only the margin BELOW it, so without
  // this the note would sit flush against the header row. The four Home cards need no
  // equivalent: their headers already carry a `marginBottom`.
  hintNote: { marginTop: Spacing.xs },
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
