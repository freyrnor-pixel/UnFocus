/**
 * health.tsx — health / symptom log (quick-log + this-week overview)
 *
 * Shows only the current Mon–Sun week's symptom activity, grouped by catalog
 * symptom (predefined + custom) with a per-day severity strip. Tapping a
 * symptom's row opens its full history (app/health-detail.tsx). A "Health-log"
 * link opens the sectioned overview of every issue ever logged
 * (app/health-log.tsx), for browsing history or adding a multi-field entry
 * (severity/dates/notes) via app/health-form.tsx.
 *
 * Card order (2026-08-01, addendum B.2): first-run explainer → **Quick log** → Medicine trays →
 * This week + the full-log link. Quick log leads because writing down what is happening right
 * now is the unplanned reason this tab gets opened, and the only thing here that is lost by not
 * being recorded; the trays are a standing surface a reminder already brings you to. Quick log
 * stays a CARD rather than a one-line strip — it is four fields (name / start time / duration /
 * severity), three of which unfold once the name is non-empty, so a strip would only hide them.
 *
 * A "Quick log" card above the weekly summary (2026-07-23) lets an occurrence be
 * recorded straight from this tab: type a name, then optionally set start time,
 * duration, and severity — it saves instantly (dated today, no notes) — no
 * navigation. This reinstates an add affordance on this screen (after an earlier
 * same-day decision removed the old FAB in favour of the dedicated form) but keeps
 * it deliberately essentials-only (name/time/duration/severity); the full form
 * stays the place for notes, multi-day ("ongoing") entries, and editing.
 * (2026-07-24: start time + duration were added alongside severity — these three
 * are the fields users actually reach for at log time, per user feedback that
 * hiding them behind the full form made quick-logging feel incomplete.)
 *
 * **Medicine trays (2026-07-27)**: components/MedicineTrayCard.tsx — four time-of-day trays
 * (morning/midday/evening/night) with tap-to-take dose logging, one reminder per tray, and
 * as-needed medicines guarded by a minimum gap. It sat ABOVE Quick log until 2026-08-01 and now
 * sits directly below it (see "Card order" above). Symptom entries can optionally be
 * attributed to a medicine (`health_logs.medicine_id`, picked in app/health-form.tsx), which
 * is what makes "this med gives me stomach issues" visible on the medicine's own page.
 * Gated on settings.featureMedicine (on by default, still a real toggle).
 *
 * **Habits moved out (2026-07-23, UX audit finding E1)**: this screen used to also
 * embed a full Habits section (today/week/month views, per-habit cards) below the
 * symptom summary — but "Health" as a tab name/icon only promises symptom tracking,
 * and a whole separate habit-building system living inside it was a name-vs-content
 * mismatch a user had to learn by accident. That section is now app/(tabs)/habits.tsx,
 * its own bottom-nav tab (replacing Scan — see lib/siteNav.ts). This file is purely the
 * symptom-tracking half now.
 *
 * Connections:
 *   Imports → components/MedicineTrayCard (the medicine-tray dose card — see below),
 *             components/ScreenScaffold, components/HintCard, components/StarterCard
 *             (first-run explainer, shown while nothing has ever been logged; `collapsible`
 *             as of 2026-08-06 v3 — its example row collapses to a trigger row rather than
 *             always showing),
 *             components/StarterExampleRow (its preview row), components/Surface,
 *             components/CardAccent (CardAccentBadge), components/PressableScale,
 *             components/DebugNoteAnchor, components/AddRow,
 *             components/FormControls (Input), constants/theme, lib/date, lib/i18n,
 *             lib/severity, lib/useAppTheme, lib/useFirstVisitHint, lib/screenColor,
 *             lib/haptics, lib/useKeyboardLift (Quick log's start-time/duration fields),
 *             store/useHealthStore,
 *             store/useSettingsStore (featureMedicine gate only)
 *   Used by → Expo Router route "/health" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx (BottomNav "Health" tab)
 *   Data    → useHealthStore — reads `logs` for the weekly summary, and calls `add()` +
 *             `ensureSymptom()` directly for the Quick log card (full multi-field edit/delete
 *             still lives in app/health-form.tsx) AND for the StarterExampleRow "+" button
 *             (addHealthStarterLog — same two calls, today's date, severity 3)
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - "This week" replaces the old "last 30 days" window — grouping/counting/severity-strip
 *     logic is unchanged, just windowed to `getWeekDates(today)` instead of a 30-day cutoff.
 *   - Grouping key is the symptom id when present, else the (lowercased) ailment string for
 *     legacy rows — same convention as health-log.tsx/health-detail.tsx.
 *   - Quick log card: essentials-only (name + start time + duration + severity, dated today,
 *     no notes/"ongoing") instant save via useHealthStore's existing add()/ensureSymptom() — no
 *     new DB columns. Start time reuses the `startTime` free-text field the full form already
 *     writes; duration (minutes) is quick-log-only UI that's converted to `endTime`/`endDate` at
 *     save time (see `handleQuickLog`) — there's no separate duration column. Editing an entry's
 *     notes, "ongoing" state, or the full picker/typeahead still goes through app/health-form.tsx
 *     (via app/health-detail.tsx or app/health-log.tsx's own AddRow).
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus
 *     effect only closes the hint on blur.
 *   - **(2026-07-26)** Quick log / This week headers each lead with a `CardAccentBadge`
 *     (domain="health") next to their label — part of a broader "bring the card colour back"
 *     pass restoring domain-colour presence across tabs, mirroring Home's preview-card badges.
 *     **Size bumped 22→32 (2026-08-09, user report: "icon in upper left is too small")** —
 *     now actually matches the Home badge size it was already meant to mirror.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog } from '@/store/useHealthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import StarterCard from '@/components/StarterCard';
import StarterExampleRow from '@/components/StarterExampleRow';
import MedicineTrayCard from '@/components/MedicineTrayCard';
import OpenEpisodeCard from '@/components/OpenEpisodeCard';
import EpisodeCloseSheet from '@/components/EpisodeCloseSheet';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';
import Surface from '@/components/Surface';
import { CardAccentBadge } from '@/components/CardAccent';
import PressableScale from '@/components/PressableScale';
import AddRow from '@/components/AddRow';
import { Input } from '@/components/FormControls';
import { useT } from '@/lib/i18n';
import { success } from '@/lib/haptics';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { todayStr, getWeekDates, addDurationToTime } from '@/lib/date';
import { openEpisodes } from '@/lib/episodes';
import { SEVERITY_COLORS, severities, severityInk } from '@/lib/severity';
import { FontSize, Fonts, Radius, SCREEN_GAP, Spacing, Type } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { getScreenColor } from '@/lib/screenColor';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

export default function HealthScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const addLog = useHealthStore((s) => s.add);
  const ensureSymptom = useHealthStore((s) => s.ensureSymptom);
  const featureMedicine = useSettingsStore((s) => s.featureMedicine);

  // The ⓘ hint is collapsed until tapped (2026-07-31 — the first-visit auto-open and its
  // `autoOpen` arg are gone); StarterCard already teaches this.
  const [hintOpen, setHintOpen] = useFirstVisitHint('health');
  const [quickDraft, setQuickDraft] = useState('');
  const [quickSeverity, setQuickSeverity] = useState(3);
  const [quickStartTime, setQuickStartTime] = useState('');
  const [quickDuration, setQuickDuration] = useState('');
  // Both fields sit well down the Quick log card (behind the ⓘ hint/starter/episode prompts),
  // so each self-lifts above the keyboard on focus — see lib/useKeyboardLift.ts.
  const quickStartTimeLift = useKeyboardLift<View>();
  const quickDurationLift = useKeyboardLift<View>();
  // StarterCard's example (2026-07-31, user report: it vanished with no feedback the instant
  // its "+" was pressed, since that write flips `logs.length` off zero). Keeps the card
  // mounted, dimmed, for the rest of this visit instead — see addHealthStarterLog below.
  const [healthStarterAdded, setHealthStarterAdded] = useState(false);
  // Quick log's Still going / It's over pair, defaulting to "it's over" (EPISODES.md D5 —
  // most logging happens afterwards). "Still going" hides the Duration field, because a
  // duration and an open episode contradict.
  const [quickOngoing, setQuickOngoing] = useState(false);
  // Prompts the user answered "Still going" to. In memory ONLY, deliberately: answering
  // writes no column and no timestamp anywhere. The five tabs are co-mounted (lazy: false),
  // so this survives tab switches for the whole session and returns on next launch — which
  // is correct, because the app genuinely does not know whether it ended.
  const [dismissedEpisodes, setDismissedEpisodes] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState<HealthLog | null>(null);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  // This screen's own hue (the card edge's source, via Surface's ambient useScreenColor
  // fallback) — badges and buttons on this screen now match it instead of the (differently
  // coloured) domain identity hue, per the same fix applied to Home's preview cards.
  // **Must be `getScreenColor` (the plain function), not `useScreenColor` (the context hook)**:
  // this component is the one that RENDERS ScreenScaffold below, so it sits ABOVE that
  // component's ScreenColorContext.Provider in the tree — the hook would read the context at
  // this component's OWN position (outside the provider) and silently fall back to
  // `theme.border` grey. A child of ScreenScaffold (e.g. MedicineTrayCard) can safely use the
  // hook; the screen component that creates the provider cannot read its own provider this way.
  const screenHue = getScreenColor(theme, 'health').base;
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  useFocusEffect(
    useCallback(() => {
      return () => {
        setHintOpen(false);
      };
    }, [setHintOpen])
  );

  const today = todayStr();
  const weekDates = getWeekDates(today);

  // Symptoms with at least one entry this week + a per-(symptom,date) max-severity index.
  const { thisWeekSymptoms, severityAt } = useMemo(() => {
    const weekSet = new Set(weekDates);
    const counts: Record<
      string,
      { name: string; symptomId: string; ailment: string; count: number }
    > = {};
    const sevByKey = new Map<string, number>(); // `${groupKey}|${date}` -> max severity
    const groupKeyFor = (l: HealthLog) => l.symptomId || l.ailment.trim().toLowerCase();
    for (const l of logs) {
      const key = groupKeyFor(l);
      if (weekSet.has(l.date)) {
        const entry = counts[key] ?? {
          name: l.ailment,
          symptomId: l.symptomId,
          ailment: l.ailment,
          count: 0,
        };
        entry.count += 1;
        counts[key] = entry;
      }
      const sk = `${key}|${l.date}`;
      const prev = sevByKey.get(sk);
      sevByKey.set(sk, prev === undefined ? l.severity : Math.max(prev, l.severity));
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, v]) => ({ key, ...v }));
    const severityAt = (key: string, d: string): number | null =>
      sevByKey.get(`${key}|${d}`) ?? null;
    return { thisWeekSymptoms: top, severityAt };
  }, [logs, weekDates]);

  function openDetail(symptomId: string, ailment: string, name: string) {
    router.push({ pathname: '/health-detail', params: { symptomId, ailment, name } });
  }

  // Open episodes still awaiting an answer this session. Capped at three cards with a plain
  // link past that (EPISODES.md D10): a column of eight prompts is itself the alarming state
  // this feature exists to avoid. Openness is `episodeState`, never a blank end date.
  const OPEN_EPISODE_CARDS = 3;
  const promptEpisodes = useMemo(
    () => openEpisodes(logs).filter((l) => !dismissedEpisodes.has(l.id)),
    [logs, dismissedEpisodes]
  );

  // Empty-state example (2026-07-27): logs a real entry (today, now, severity 3) via the
  // same ensureSymptom+add pair handleQuickLog uses — logs.length flips to 1 right after.
  function addHealthStarterLog() {
    const sym = ensureSymptom(t.starters.health.exampleTitle);
    addLog({
      date: todayStr(),
      startTime: '',
      endDate: '',
      endTime: '',
      ailment: sym.name,
      symptomId: sym.id,
      severity: 3,
      notes: '',
      medicineId: '',
      // The teaching example must not create an open episode the user then has to close.
      episodeState: 'point',
      reliefNote: '',
      reliefMedicineId: '',
    });
    setHealthStarterAdded(true);
    success();
  }

  function handleQuickLog() {
    const name = quickDraft.trim();
    if (!name) return;
    const sym = ensureSymptom(name);
    const startTime = quickStartTime.trim();
    const computedEnd = addDurationToTime(todayStr(), startTime, Number(quickDuration.trim()));
    addLog({
      date: todayStr(),
      startTime,
      // An open episode has no end, whatever was typed into Duration before switching.
      endDate: quickOngoing ? '' : (computedEnd?.endDate ?? ''),
      endTime: quickOngoing ? '' : (computedEnd?.endTime ?? ''),
      ailment: sym.name,
      symptomId: sym.id,
      severity: quickSeverity,
      notes: '',
      medicineId: '',
      episodeState: quickOngoing ? 'ongoing' : 'point',
      reliefNote: '',
      reliefMedicineId: '',
    });
    setQuickDraft('');
    setQuickSeverity(3);
    setQuickStartTime('');
    setQuickDuration('');
    setQuickOngoing(false);
  }

  return (
    <>
      <ScreenScaffold
        title={t.healthTitle}
        tier="site"
        screenKey="health"
        bottomNav={false}
        pagerFloatingNav
        ownBackground={false}
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
      >
        <View style={styles.content}>
          <HintCard
            text={t.hints.health.text}
            example={t.hints.health.example}
            open={hintOpen}
            noPill
          />

          {/* First-run explainer (2026-07-26): why to log at the moment it happens rather
              than from memory, plus what an entry looks like. Gated on the whole log being
              empty (not just this week's), so a user with history doesn't see it on a quiet
              week — and it returns if every entry is later deleted.
              **Stays mounted through `healthStarterAdded` (2026-07-31)**: pressing the
              example's "+" writes a real log, which flips `logs.length` off zero in the same
              tick — without the OR below the card would unmount itself the instant it was
              used, reading as the example just disappearing. See
              components/StarterExampleRow's `added` Edit note.
              **`collapsible` (2026-08-06 v3)**: the example row now sits behind StarterCard's
              shared collapse-to-row drop-down (open by default), same mechanism Habits/Goals/
              Plans use — this screen's own mount condition above is unchanged. */}
          {(logs.length === 0 || healthStarterAdded) && (
            <StarterCard
              text={t.starters.health.text}
              collapsible
              exampleHeaderLabel={t.starters.health.tapToAdd}
              example={
                <StarterExampleRow
                  icon="medical-outline"
                  title={t.starters.health.exampleTitle}
                  tag={t.starters.exampleLabel}
                  meta="3/5"
                  metaVariant="warning"
                  accent={SEVERITY_COLORS[2]}
                  onAdd={healthStarterAdded ? undefined : addHealthStarterLog}
                  addLabel={t.starters.addExample}
                  added={healthStarterAdded}
                />
              }
            />
          )}

          {/* Ongoing-episode prompts (2026-08-01) — above Quick log, because they are about an
              episode already in progress rather than a new one. One quiet card per open entry,
              deliberately neutral-bordered and un-animated: see components/OpenEpisodeCard.tsx
              for why it must never escalate with age. "Still going" writes nothing at all. */}
          {promptEpisodes.slice(0, OPEN_EPISODE_CARDS).map((episode) => (
            <OpenEpisodeCard
              key={episode.id}
              symptom={episode.ailment || t.unnamedIssue}
              onStillGoing={() => setDismissedEpisodes((prev) => new Set(prev).add(episode.id))}
              onItsOver={() => setClosing(episode)}
              onOpen={() => router.push({ pathname: '/health-form', params: { id: episode.id } })}
            />
          ))}
          {promptEpisodes.length > OPEN_EPISODE_CARDS && (
            <PressableScale
              onPress={() => router.push('/health-log')}
              accessibilityRole="button"
              scaleTo={0.98}
              style={styles.moreEpisodesRow}
            >
              <Text style={[styles.moreEpisodesText, { color: theme.textMuted }]}>
                {t.episodes.seeAllOpen}
              </Text>
            </PressableScale>
          )}

          {/* Quick log — essentials-only instant record (name + start time + duration +
              severity, dated today).
              **Above the Medicine card as of 2026-08-01** (addendum B.2): logging what is
              happening right now is the reason this tab gets opened unplanned, and it is the
              only thing on the screen that can be lost by not being written down — the trays
              are a standing, all-day surface that a reminder already brings you to. It stays a
              CARD and was not thinned into a one-line strip: the addendum's strip proposal
              assumed one field, and this is four (name, start time, duration, severity), three
              of which unfold once the name is non-empty. */}
          <TourTarget id="tour.health.log">
            <DebugNoteAnchor id="health.quickLog" label="Health — Quick log">
              {/* No `borderColor` (card design reset, 2026-08-05): a card on its own screen inherits
                that screen's one hue. The badge inside now matches it too (`accentOverride`,
                2026-08-06) — it used to keep drawing lib/domainColor.ts's identity hue (a
                different wine-red vs this screen's teal), which read as a mismatched icon. */}
              <Surface style={styles.overviewCardRow}>
                <View style={styles.overviewCardContent}>
                  <View style={styles.sectionLabelRow}>
                    {/* Per-card glyph, not the domain default (2026-07-28 design review): Medicine,
                      Quick log and This week all fell back to DOMAIN_ICON.health (heart), so three
                      stacked cards carried the identical badge and it signified nothing. The heart
                      still marks the Health tab itself in BottomNav. */}
                    <CardAccentBadge domain="health" icon="pulse" size={32} accentOverride={screenHue} />
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>
                      {t.quickLogLabel}
                    </Text>
                  </View>
                  <AddRow
                    placeholder={t.logSymptomTrigger}
                    value={quickDraft}
                    onChangeText={setQuickDraft}
                    onSubmit={handleQuickLog}
                    accent={screenHue}
                    confirmIcon="checkmark"
                    showDivider={false}
                    accessibilityLabel={t.logSymptomTrigger}
                  />
                  {quickDraft.trim().length > 0 && (
                    <>
                      {/* Still going / It's over — defaults to It's over (D5). Picking "Still
                        going" hides Duration and writes an open episode with no end pair. */}
                      <View style={styles.quickStateRow}>
                        {[
                          { open: true, label: t.episodes.stillGoing },
                          { open: false, label: t.episodes.itsOver },
                        ].map((option) => {
                          const active = quickOngoing === option.open;
                          return (
                            <PressableScale
                              key={option.label}
                              style={[
                                styles.quickStateChip,
                                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                                active && {
                                  backgroundColor: theme.accent,
                                  borderColor: theme.accent,
                                },
                              ]}
                              onPress={() => setQuickOngoing(option.open)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                              scaleTo={0.97}
                            >
                              <Text
                                style={[
                                  styles.quickStateChipText,
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
                      <View style={styles.quickTimeRow}>
                        <View style={styles.quickTimeField} ref={quickStartTimeLift.ref}>
                          <Text style={[styles.quickSeverityLabel, { color: theme.textMuted }]}>
                            {t.whenStartedLabel}
                          </Text>
                          <Input
                            value={quickStartTime}
                            onChangeText={setQuickStartTime}
                            placeholder={t.timeInputPlaceholder}
                            keyboardType="numbers-and-punctuation"
                            style={styles.quickTimeInput}
                            onFocus={quickStartTimeLift.onFocus}
                            onBlur={quickStartTimeLift.onBlur}
                          />
                        </View>
                        {!quickOngoing && (
                          <View style={styles.quickTimeField} ref={quickDurationLift.ref}>
                            <Text style={[styles.quickSeverityLabel, { color: theme.textMuted }]}>
                              {t.durationLabel}
                            </Text>
                            <Input
                              value={quickDuration}
                              onChangeText={setQuickDuration}
                              placeholder={t.durationPlaceholder}
                              keyboardType="number-pad"
                              style={styles.quickTimeInput}
                              onFocus={quickDurationLift.onFocus}
                              onBlur={quickDurationLift.onBlur}
                            />
                          </View>
                        )}
                      </View>
                      <View style={styles.quickSeverityRow}>
                        <Text style={[styles.quickSeverityLabel, { color: theme.textMuted }]}>
                          {t.severityLabel}
                        </Text>
                        <View style={styles.quickSeverityChips}>
                          {SEVERITIES.map((s) => {
                            const active = quickSeverity === s.value;
                            return (
                              <PressableScale
                                key={s.value}
                                onPress={() => setQuickSeverity(s.value)}
                                style={[
                                  styles.quickSevChip,
                                  { backgroundColor: s.color },
                                  active && { borderColor: theme.text, borderWidth: 2 },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={severityLabel(s.value)}
                              >
                                <Text
                                  style={[styles.quickSevChipText, { color: severityInk(s.value) }]}
                                >
                                  {s.value}
                                </Text>
                              </PressableScale>
                            );
                          })}
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </Surface>
            </DebugNoteAnchor>
          </TourTarget>

          {/* Medicine trays (2026-07-27; moved BELOW Quick log 2026-08-01) — gated on
              settings.featureMedicine (on by default, Settings → Advanced → Features); the card
              handles its own empty state, so it isn't gated on having medicines. It sat above
              Quick log on the reasoning that doses are the time-sensitive, recurring reason to
              open this tab — but that recurring-ness is exactly what a tray reminder already
              handles, while an unlogged symptom is gone once the moment passes. */}
          {featureMedicine && <MedicineTrayCard />}

          {/* This week — debug notes: one anchor per region (the card, not its inner rows). */}
          <DebugNoteAnchor id="health.overview" label="Health — This week">
            <Surface style={styles.overviewCardRow}>
              <View style={styles.overviewCardContent}>
                <View style={styles.sectionLabelRow}>
                  {/* Distinct from Medicine/Quick log — see the note at the Quick log badge. */}
                  <CardAccentBadge domain="health" icon="stats-chart" size={32} accentOverride={screenHue} />
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>
                    {t.thisWeekLabel}
                  </Text>
                </View>
                {thisWeekSymptoms.length === 0 && (
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    {t.noLogsThisWeek}
                  </Text>
                )}
                {thisWeekSymptoms.map((s) => {
                  const weekSeverities = weekDates.map((d) => severityAt(s.key, d));
                  const maxCount = thisWeekSymptoms[0]?.count ?? 1;
                  return (
                    <PressableScale
                      key={s.key}
                      style={styles.overviewAilment}
                      onPress={() => openDetail(s.symptomId, s.ailment, s.name)}
                      accessibilityRole="button"
                      accessibilityLabel={t.symptomHistoryTitle(s.name)}
                      scaleTo={0.97}
                    >
                      <View style={styles.overviewRow}>
                        <Text style={[styles.overviewName, { color: theme.text }]}>{s.name}</Text>
                        <View style={[styles.overviewBar, { backgroundColor: theme.surfaceMuted }]}>
                          <View
                            style={[
                              styles.overviewFill,
                              {
                                backgroundColor: SEVERITY_COLORS[2],
                                width: `${Math.min((s.count / maxCount) * 100, 100)}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.overviewCount, { color: theme.textMuted }]}>
                          {s.count}×
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                      </View>
                      <View style={styles.ailmentWeekStrip}>
                        {weekDates.map((d, i) => {
                          const sev = weekSeverities[i];
                          const sevColor = sev
                            ? (SEVERITIES.find((x) => x.value === sev)?.color ?? theme.border)
                            : 'transparent';
                          const isFuture = d > today;
                          return (
                            <View key={d} style={styles.ailmentDotCol}>
                              <Text style={[styles.ailmentDayAbbr, { color: theme.textMuted }]}>
                                {t.dayLabels[i][0]}
                              </Text>
                              <View
                                style={[
                                  styles.ailmentDot,
                                  {
                                    backgroundColor: sev ? sevColor : 'transparent',
                                    borderColor: isFuture
                                      ? theme.border
                                      : sev
                                        ? sevColor
                                        : theme.border,
                                    opacity: isFuture ? 0.3 : 1,
                                  },
                                ]}
                              />
                            </View>
                          );
                        })}
                      </View>
                    </PressableScale>
                  );
                })}
                {/* Open full log — folded into the This week card (debug-note 2026-07-21):
                  one consolidated card instead of a separate nav card below. Shown even on
                  an empty week so there's always a clear way into the full log. */}
                <PressableScale
                  onPress={() => router.push('/health-log')}
                  accessibilityRole="button"
                  accessibilityLabel={t.healthLogTitle}
                  scaleTo={0.98}
                  style={[styles.overviewLogLink, { borderTopColor: theme.border }]}
                >
                  {/* A.4 rule 1: a link glyph takes the action colour, not the health hue. */}
                  <Ionicons name="document-text-outline" size={18} color={theme.accent} />
                  <Text style={[styles.navCardText, { color: theme.text }]}>
                    {t.healthLogTitle}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </PressableScale>
              </View>
            </Surface>
          </DebugNoteAnchor>

          <View style={{ height: Spacing.xl + Spacing.xxl }} />
        </View>
      </ScreenScaffold>

      <EpisodeCloseSheet log={closing} onClose={() => setClosing(null)} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  // The screen owns the vertical rhythm (2026-08-08). `gap` here, and NO vertical margin on
  // any card in the stack — see SCREEN_GAP's doc in constants/theme.ts for the five different
  // gaps this replaced. A child that is always mounted but sometimes zero-height (a closed
  // Collapsible) must be grouped or conditionally rendered, or it books a gap slot for nothing.
  content: { padding: Spacing.md, gap: SCREEN_GAP },
  // Decision 043 rule 2: Spacing.xl above every section.
  // No vertical margin: the screen's content container owns the gap between stacked cards
  // (SCREEN_GAP, constants/theme.ts). Was `marginTop: Spacing.xl`.
  overviewCardRow: { borderRadius: Radius.md },
  overviewCardContent: { flex: 1, padding: Spacing.md },
  // Row wrapper (2026-07-26, "bring the card colour back"): holds the health-domain gradient
  // badge + the label together, carrying the label's old marginBottom so its spacing to the
  // content below is unchanged.
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionLabel: { fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
  // "See all" past the three-card prompt cap — a plain link, no card, no count.
  moreEpisodesRow: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  moreEpisodesText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  quickStateRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  quickStateChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  quickStateChipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  quickTimeRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  quickTimeField: { flex: 1, gap: Spacing.xs },
  quickTimeInput: { paddingVertical: Spacing.xs },
  quickSeverityRow: { marginTop: Spacing.sm, gap: Spacing.xs },
  quickSeverityLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  quickSeverityChips: { flexDirection: 'row', gap: Spacing.xs },
  quickSevChip: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  quickSevChipText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  overviewAilment: { marginTop: Spacing.sm },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ailmentWeekStrip: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 5,
    paddingLeft: 2,
  },
  ailmentDotCol: { alignItems: 'center', gap: 2 },
  ailmentDayAbbr: { fontSize: 7, fontFamily: Fonts.semibold },
  ailmentDot: { width: 9, height: 9, borderRadius: Radius.full, borderWidth: 1.5 },
  overviewName: { fontSize: FontSize.sm, width: 100 },
  overviewBar: {
    flex: 1,
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  overviewFill: { height: 8, borderRadius: Radius.full },
  overviewCount: { fontSize: FontSize.xs, width: 28, textAlign: 'right' },
  emptyText: { fontSize: FontSize.sm },
  // Health-log link, folded into the foot of the This week card (2026-07-21) — a hairline
  // top border makes it read as a card footer rather than another symptom row.
  overviewLogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  navCardText: { flex: 1, fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
});
