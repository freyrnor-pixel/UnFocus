/**
 * MedicineSurface.tsx — the medicine card's CONTENT: "when to take what", plus logging.
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
 * **This was `MedicineTrayCard.tsx` until 2026-08-21, and it drew its own card.** It was a full
 * `Surface` — badge, title, bell, fold chevron — rendered INSIDE HomeHealthCard's `Surface`,
 * which is the card-in-a-card the 2026-08-18 blueprint pass banned outright, and which
 * `CONSISTENCY_AUDIT.md` §11 measured against the report *"Each thing is its own card, like
 * medicine and Health (which they currently are not)."* Asked whether Medicine should become a
 * fourth top-level card on the Me tab, the maintainer said *"Yes."* So the card shell moved to
 * components/HomeMedicineCard.tsx and this file kept the content, the same
 * surface-plus-shell split components/HabitsSurface.tsx and components/TodoSurface.tsx already
 * follow.
 *
 * ⚠️ **It has no `embedded` prop, unlike HealthSurface/TodoSurface — deliberately, and for the
 * same reason HabitsSurface has none: both of its callers are panes.** It never draws a Surface,
 * a header or a fold of its own, so there is nothing for the flag to vary. Give it one only if a
 * third caller genuinely needs a different shell, and not before.
 *
 * Connections:
 *   Imports → components/AddRow, components/PressableScale, components/Collapsible,
 *             (no explainer line since 2026-08-17 — the bulb tier is deleted app-wide; this card
 *             had a StarterCard until 2026-08-12 and a CardHintNote until this pass, and now has
 *             neither: its add field sits directly under the header),
 *             components/FormControls (Input), components/QuickAddOptionsPanel,
 *             components/QuickAddOptionRow (the quick-add's Dose/Trays cells, phase 7 of
 *             DESIGN_COMPARISON/19-IMPLEMENTATION.md), constants/theme, lib/date (todayStr), lib/haptics, lib/i18n,
 *             lib/screenColor, lib/medicineSchedule (all tray/dose math), lib/useAppTheme,
 *             lib/useNowMinutes (60s tick, shared with components/PlanTaskCard.tsx),
 *             lib/useKeyboardLift (per tray-time field), store/useMedicineStore,
 *             store/useSettingsStore
 *   Used by → components/HomeMedicineCard.tsx (the Me tab's card shell) and
 *             components/CardExpandHost.tsx's `homeMedicine` registry entry (its full-screen
 *             pane) — both gated on settings.featureMedicine at their own call sites
 *   Data    → useMedicineStore (medicines + medicine_doses) via add/takeDose/untakeDose;
 *             useSettingsStore for the tray times + reminder switch (written straight back)
 *             and People-mode profiles
 *
 * Edit notes:
 *   - **Dose · Trays (2026-08-26, phase 7)** — the quick-add's options panel. Both fields
 *     already existed on `Medicine`, so this is composer wiring only, no migration. `traysDraft`
 *     empty keeps the pre-existing "default to the tray we're standing in" behaviour below;
 *     picking any tray in the panel overrides it. No Modal is opened by either cell (Dose is a
 *     plain field, Trays a direct multi-select toggle), so neither needs anything beyond the
 *     panel slot's own `controlsResponderProps`.
 *   - Quick-add puts the new medicine in the tray whose window contains NOW (falling back
 *     to the first tray of the day when it's before the earliest one), because that's what
 *     someone adding a medicine mid-dose is almost always doing — UNLESS the Trays option
 *     picked something else. Everything else about it is editable in the form.
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
 *   - **The bell IS the reminders switch (2026-08-10), and it lives in the HEADER — which this
 *     file no longer draws.** It is components/MedicineReminderBell.tsx now, mounted by both
 *     shells; read that file's header and components/ReminderBell.tsx's for the full story. The
 *     part that still concerns THIS file is the second half of the fix: the reminder-times panel
 *     below opens on `medicineRemindersEnabled` — the same boolean the bell writes — so the
 *     panel appearing is the confirmation that the bell landed. Don't give the panel a toggle of
 *     its own again; that duplicate `Switch` is exactly what was deleted.
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
import AddRow from '@/components/AddRow';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
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
import { FIELD_GLOW_CLEARANCE, FontSize, Fonts, Radius, Spacing, Type, HitSlop } from '@/constants/theme';

/** Time-of-day glyph per tray — the pill-organiser row, read left to right. */
const TRAY_ICONS: Record<TrayId, React.ComponentProps<typeof Ionicons>['name']> = {
  morning: 'sunny-outline',
  midday: 'partly-sunny-outline',
  evening: 'cloudy-night-outline',
  night: 'moon-outline',
};

/**
 * This card's add row, owning the text you type into it (2026-08-28, perf).
 *
 * Same reasoning as `components/DraftComposer.tsx` — read that file's header for the
 * measurement and the "only the TEXT moves" rule. `draft` was `useState` in `MedicineSurface`,
 * which draws all four trays, every medicine row and the tray-time editors, so a keystroke
 * re-rendered the lot.
 *
 * ⚠️ **It is NOT `DraftComposer`, and the difference is the composer underneath.** That one
 * wraps `PadTypeRow` (an always-open type line); this card uses `components/AddRow.tsx`, the
 * collapsed-"+"-bar composer, whose props and resting state are genuinely different. Making one
 * component render either would mean a union of two prop sets to save fifteen lines. The dose
 * field and the tray chips stay in the surface and arrive as the built `panel` node, exactly as
 * they do for DraftComposer's callers.
 *
 * `components/FoodTab.tsx`'s two AddRows have the same defect and are NOT fixed here: one is
 * keyed by dish id into a `Record` held by the parent and the other takes its value from props,
 * so both need a real restructure rather than this lift.
 */
function MedicineComposer({
  placeholder,
  accent,
  panel,
  showDivider,
  accessibilityLabel,
  onSubmit,
}: {
  placeholder: string;
  accent: string;
  panel?: React.ReactNode;
  showDivider?: boolean;
  accessibilityLabel?: string;
  onSubmit: (name: string) => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <AddRow
      placeholder={placeholder}
      value={draft}
      onChangeText={setDraft}
      onSubmit={() => {
        const name = draft.trim();
        if (!name) return;
        onSubmit(name);
        setDraft('');
      }}
      accent={accent}
      showDivider={showDivider}
      accessibilityLabel={accessibilityLabel}
      panel={panel}
    />
  );
}

export default function MedicineSurface() {
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

  const [timeDrafts, setTimeDrafts] = useState<Partial<Record<TrayId, string>>>({});
  const [selectedPerson, setSelectedPerson] = useState('');
  // Dose · Trays (phase 7's table, DESIGN_COMPARISON/19-IMPLEMENTATION.md) — both fields
  // already exist on `Medicine` (`dose` is free text, `trays` a TrayId[]), so this is
  // composer-only wiring, no schema change. An EMPTY `traysDraft` keeps the existing
  // "default to the tray we're standing in" behaviour from `commitAdd` below; picking any
  // tray here overrides that default.
  const [doseDraft, setDoseDraft] = useState('');
  const [traysDraft, setTraysDraft] = useState<TrayId[]>([]);

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

  function toggleTrayDraft(tray: TrayId) {
    tap();
    setTraysDraft((prev) => (prev.includes(tray) ? prev.filter((t) => t !== tray) : [...prev, tray]));
  }

  // Takes the name as an ARGUMENT — the draft lives in MedicineComposer now (see its note).
  function commitAdd(name: string) {
    // Default to the tray we're standing in — before the day's first tray, use that one —
    // unless the Trays option picked something else.
    const tray = currentTray(trayTimes, now) ?? sortedTrays(trayTimes)[0];
    addMedicine({
      name,
      dose: doseDraft.trim(),
      trays: traysDraft.length > 0 ? traysDraft : [tray],
      childName: person ?? '',
    });
    setDoseDraft('');
    setTraysDraft([]);
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

  return (
    <View style={styles.content}>
      {status && <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>}


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
                    // `recessed` (2026-08-24): these four sit INSIDE the Medicine card, which
                    // is the condition `FormControls`' prop is gated on — and the AddRow well
                    // one row below them is the shape they were disagreeing with. Left plain,
                    // they drew the editor field's resting stroke in the screen's hue, so this
                    // one card rendered four rose-outlined pills directly above a recessed,
                    // haloed well: two field shapes, one card, which is the complaint the
                    // consistency audit converted every other in-card field for.
                    recessed
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

      <MedicineComposer
        placeholder={t.medicine.addPlaceholder}
        onSubmit={commitAdd}
        accent={screenHue}
        showDivider={medicines.length > 0}
        accessibilityLabel={t.medicine.addPlaceholder}
        panel={
          <QuickAddOptionsPanel>
            {/* Dose · Trays — phase 7's table for this card. Both already exist on
                `Medicine` (dose is free text, trays a TrayId[]), so this is composer-only
                wiring, no schema change. */}
            <QuickAddOptionRow
              opt="dose"
              icon="medical-outline"
              label={t.medicine.doseLabel}
              wide
              accent={screenHue}
              value={
                <Input
                  value={doseDraft}
                  onChangeText={setDoseDraft}
                  placeholder={t.medicine.doseLabel}
                  containerStyle={styles.doseInput}
                  recessed
                />
              }
            />
            <QuickAddOptionRow
              opt="trays"
              icon="time-outline"
              label={t.medicine.traysLabel}
              wide
              accent={screenHue}
              value={
                <View style={styles.trayChipsRow}>
                  {TRAY_IDS.map((tray) => {
                    const active = traysDraft.includes(tray);
                    return (
                      <PressableScale
                        key={tray}
                        style={[
                          styles.trayChip,
                          {
                            backgroundColor: active ? screenHue : theme.surfaceMuted,
                            borderColor: active ? screenHue : theme.border,
                          },
                        ]}
                        onPress={() => toggleTrayDraft(tray)}
                        scaleTo={0.97}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={t.medicine.trays[tray]}
                      >
                        <Ionicons
                          name={TRAY_ICONS[tray]}
                          size={14}
                          color={active ? theme.accentInk : theme.textMuted}
                        />
                      </PressableScale>
                    );
                  })}
                </View>
              }
            />
          </QuickAddOptionsPanel>
        }
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // No padding and no margin: the shell that mounts this owns both — the card's own
  // `PAD_GUTTER` on Me, the pane's body padding when expanded. Padding here would be a second
  // inset stacked inside the first, which is the shape lib/__tests__/screenRhythm.test.ts bans
  // for every centre-modal screen for the same reason.
  content: {},
  status: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginTop: Spacing.xs },
  profileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  // The quick-add's Dose · Trays cells (phase 7) — `doseInput` gives FormControls' `Input` a
  // width the wide QuickAddOptionRow cell can flex, `trayChipsRow`/`trayChip` are a compact
  // multi-select, same geometry family as components/TodoSurface.tsx's Recurring "On" chips.
  doseInput: { flex: 1 },
  trayChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  trayChip: {
    width: 32,
    height: 28,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // The four wells are now the app's shared in-card field (`recessed`, 2026-08-24), so they
  // carry its halo — and a halo needs room before the card body's fold clips it. The grid's
  // own `gap` already covers the two inner edges; this is the outer four. See
  // `FIELD_GLOW_CLEARANCE` in constants/theme.ts, and `npm run halos` for the measurement.
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: FIELD_GLOW_CLEARANCE,
    paddingBottom: FIELD_GLOW_CLEARANCE,
  },
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
