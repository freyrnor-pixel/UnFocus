/**
 * HealthSurface.tsx — the health/symptom log content: this week's issues + composer, medicine
 * trays, and the "Health issues" drawer.
 *
 * Extracted from app/health.tsx (2026-08-20, "full-screen card expansion") when Health left the
 * bottom nav and became a Home card instead (components/HomeHealthCard.tsx) — the same
 * `embedded`-prop pattern components/FoodTab.tsx and components/CatalogueTab.tsx already use to
 * mount inside both a full screen and a drawer/card.
 *
 * Connections:
 *   Imports → components/NarratorQuote, components/HintCard,
 *             components/StarterCard, components/StarterExampleRow, components/OpenEpisodeCard
 *             + components/EpisodeCloseSheet, components/CollapsedSection +
 *             components/HealthIssuesPreviewList + components/HealthIssuesSheet,
 *             components/Surface, components/CardAccent, components/PadRow,
 *             components/PadTypeRow + components/QuickAddOptionsPanel +
 *             components/QuickAddOptionRow, components/Collapsible, components/PressableScale,
 *             components/DebugNoteAnchor, components/TourTarget, components/FormControls,
 *             lib/date, lib/episodes, lib/i18n, lib/useNowMinutes, lib/severity,
 *             lib/useAppTheme, lib/useFirstVisitHint, lib/screenColor, lib/haptics,
 *             lib/useKeyboardLift, store/useHealthStore, store/useSettingsStore
 *   Used by → app/health.tsx (non-embedded — the back-compat pushed route, nothing in the UI
 *             pushes to it any more), components/HomeHealthCard.tsx (`embedded` — the Home
 *             card) and components/CardExpandHost.tsx's `homeHealth` registry entry (`embedded`
 *             — its pane already supplies the title bar)
 *   Data    → useHealthStore — reads `logs`/`symptoms`, calls `add()`/`ensureSymptom()`
 *
 * Edit notes:
 *   - **`embedded` drops the outer card's own Surface, not its content, and NOT its fold.** A
 *     caller mounting this inside its own card (HomeHealthCard) owes it two things per the
 *     established convention: no Surface of its own (a Surface inside the caller's Surface reads
 *     as a nested panel) and no scroll of its own. `embedded` unwraps exactly that; the rows,
 *     the narrator, the starter card and the composer are unchanged.
 *   - **⚠️ The "This week" fold used to be DEAD when embedded (fixed 2026-08-21,
 *     CONSISTENCY_AUDIT.md §10).** The embedded branch rendered `cardBody` bare — no chevron and
 *     no `Collapsible` — while `weekCollapsed` was computed and read only by the other branch.
 *     So a user who folded that card on the Health screen found the setting silently ignored on
 *     Home: same card, same stored id, two different answers. Both branches honour it now; the
 *     embedded one keeps its label row and chevron and drops only the `Surface`, which is the
 *     `SectionCard embedded` shape (`Shell = embedded ? View : Surface`) TodoSurface's Week card
 *     established. A fold that is stored is a fold every mount site has to draw.
 *   - **Medicine is NOT here any more (2026-08-21).** It was `<MedicineTrayCard />`, a full
 *     `Surface` mounted unconditionally with respect to `embedded` — so on Home it was a card
 *     inside HomeHealthCard's card. It is components/HomeMedicineCard.tsx now, a peer on the Me
 *     tab (maintainer, asked whether it should be: *"Yes."*). Don't mount it back in: this
 *     surface is about symptoms and episodes, and the `featureMedicine` gate moved with it.
 *   - **`IssueRow` takes `screenHue` as a PROP now, not `useScreenColor()`.** The pre-extraction
 *     screen could read the context hook safely because `IssueRow` was always a descendant of
 *     ITS OWN ScreenScaffold (health's teal). Embedded inside Home, the nearest
 *     ScreenColorContext is Home's own (`index`'s hue), which would have painted every issue
 *     row's edge in the wrong colour. The screen (app/health.tsx) still resolves the same value
 *     via `getScreenColor(theme, 'health')` — the plain function, not the hook, for the same
 *     "sits above the provider" reason the original file's header explained — so nothing about
 *     the resolved colour changed, only how it reaches the row.
 *   - `getScreenColor` (the plain function) is used throughout rather than `useScreenColor`
 *     (the context hook) for exactly that reason: this component is mounted in more than one
 *     screen's context now, and only the explicit key is guaranteed correct in all of them.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog } from '@/store/useHealthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import NarratorQuote from '@/components/NarratorQuote';
import StarterCard from '@/components/StarterCard';
import StarterExampleRow from '@/components/StarterExampleRow';
import OpenEpisodeCard from '@/components/OpenEpisodeCard';
import EpisodeCloseSheet from '@/components/EpisodeCloseSheet';
import CollapsedSection from '@/components/CollapsedSection';
import HealthIssuesPreviewList from '@/components/HealthIssuesPreviewList';
import HealthIssuesSheet from '@/components/HealthIssuesSheet';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';
import Surface from '@/components/Surface';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import Collapsible from '@/components/Collapsible';
import CardCollapseToggle from '@/components/CardCollapseToggle';
import { CardAccentBadge } from '@/components/CardAccent';
import PressableScale from '@/components/PressableScale';
import { Input, SegmentedControl } from '@/components/FormControls';
import { useT } from '@/lib/i18n';
import { success, tap } from '@/lib/haptics';
import { todayStr, getWeekDates, addDurationToTime } from '@/lib/date';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { openEpisodes } from '@/lib/episodes';
import { severities, severityInk } from '@/lib/severity';
import {
  BORDER_WIDTH,
  computeBorderTone,
  FontSize,
  Fonts,
  HitSlop,
  OpticalCenter,
  Radius,
  SCREEN_GAP,
  Spacing,
  Type,
} from '@/constants/theme';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { getScreenColor } from '@/lib/screenColor';
import { useKeyboardLift } from '@/lib/useKeyboardLift';
import { useCollapsedCard } from '@/lib/useCollapsedCard';

/** The severity a one-gesture capture writes. See the file header's "+" edit note. */
const DEFAULT_SEVERITY = 3;

/** One issue that has been going on this week — the row that sits where a habit row sits. */
type WeekIssue = {
  key: string;
  name: string;
  symptomId: string;
  ailment: string;
  count: number;
};

function IssueRow({
  issue,
  weekDates,
  today,
  severityAt,
  screenHue,
  onOpen,
  onLogAgain,
  first,
}: {
  issue: WeekIssue;
  weekDates: string[];
  today: string;
  severityAt: (key: string, date: string) => number | null;
  /** The screen's own hue — see the file header on why this is a prop, not `useScreenColor()`. */
  screenHue: string;
  onOpen: () => void;
  onLogAgain: () => void;
  first?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();

  const rowBox = {
    borderWidth: BORDER_WIDTH.field,
    borderColor: computeBorderTone(screenHue, isDark, 'field'),
    borderRadius: Radius.sm,
  };

  return (
    <View style={[styles.issueRowBox, rowBox, !first && styles.issueRowStacked]}>
      <PadRow
        title={issue.name}
        accent={screenHue}
        leading={<Ionicons name="medical-outline" size={22} color={theme.textMuted} />}
        rightValue={t.healthIssues.timesThisWeek(issue.count)}
        onPress={() => setExpanded((v) => !v)}
        onAction={onOpen}
        actionLabel={t.symptomHistoryTitle(issue.name)}
        trailing={
          <PressableScale
            style={[styles.logAgainBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={onLogAgain}
            hitSlop={HitSlop.base}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={t.healthIssues.logAgain(issue.name)}
          >
            <Text style={[styles.logAgainText, { color: theme.text }]}>+</Text>
          </PressableScale>
        }
      />

      <Collapsible open={expanded}>
        <View style={[styles.weekStripWrap, { borderTopColor: theme.border }]}>
          <View style={styles.ailmentWeekStrip}>
            {weekDates.map((d, i) => {
              const sev = severityAt(issue.key, d);
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
                        borderColor: isFuture ? theme.border : sev ? sevColor : theme.border,
                        opacity: isFuture ? 0.3 : 1,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </Collapsible>
    </View>
  );
}

type Props = {
  /** Mounted inside a caller's own card (HomeHealthCard) — drops the Surface + header row. */
  embedded?: boolean;
};

export default function HealthSurface({ embedded = false }: Props) {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const symptoms = useHealthStore((s) => s.symptoms);
  const addLog = useHealthStore((s) => s.add);
  const ensureSymptom = useHealthStore((s) => s.ensureSymptom);

  const [quickDraft, setQuickDraft] = useState('');
  const [quickSeverity, setQuickSeverity] = useState(DEFAULT_SEVERITY);
  const [quickStartTime, setQuickStartTime] = useState('');
  const [quickDuration, setQuickDuration] = useState('');
  const quickStartTimeLift = useKeyboardLift<View>();
  const quickDurationLift = useKeyboardLift<View>();
  const [healthStarterAdded, setHealthStarterAdded] = useState(false);
  const [quickOngoing, setQuickOngoing] = useState(false);
  const [dismissedEpisodes, setDismissedEpisodes] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState<HealthLog | null>(null);
  const [issuesSheetOpen, setIssuesSheetOpen] = useState(false);
  const [weekCollapsed, toggleWeekCollapsed] = useCollapsedCard('healthWeek');
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const screenHue = getScreenColor(theme, 'health').base;
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  useNowMinutes();
  const today = todayStr();
  const weekDates = useMemo(() => getWeekDates(today), [today]);

  const { thisWeekIssues, severityAt } = useMemo(() => {
    const weekSet = new Set(weekDates);
    const counts: Record<string, WeekIssue> = {};
    const sevByKey = new Map<string, number>();
    const groupKeyFor = (l: HealthLog) => l.symptomId || l.ailment.trim().toLowerCase();
    for (const l of logs) {
      const key = groupKeyFor(l);
      if (weekSet.has(l.date)) {
        const entry = counts[key] ?? {
          key,
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
    const top = Object.values(counts).sort((a, b) => b.count - a.count);
    const severityAt = (key: string, d: string): number | null => sevByKey.get(`${key}|${d}`) ?? null;
    return { thisWeekIssues: top, severityAt };
  }, [logs, weekDates]);

  const trackedCount = useMemo(() => symptoms.filter((s) => s.tracked).length, [symptoms]);

  function openDetail(symptomId: string, ailment: string, name: string) {
    router.push({ pathname: '/health-detail', params: { symptomId, ailment, name } });
  }

  const OPEN_EPISODE_CARDS = 3;
  const promptEpisodes = useMemo(
    () => openEpisodes(logs).filter((l) => !dismissedEpisodes.has(l.id)),
    [logs, dismissedEpisodes]
  );

  function logIncident(name: string, opts?: {
    severity?: number;
    startTime?: string;
    durationMinutes?: string;
    ongoing?: boolean;
  }) {
    const sym = ensureSymptom(name);
    const startTime = (opts?.startTime ?? '').trim();
    const ongoing = opts?.ongoing ?? false;
    const computedEnd = addDurationToTime(todayStr(), startTime, Number((opts?.durationMinutes ?? '').trim()));
    addLog({
      date: todayStr(),
      startTime,
      endDate: ongoing ? '' : (computedEnd?.endDate ?? ''),
      endTime: ongoing ? '' : (computedEnd?.endTime ?? ''),
      ailment: sym.name,
      symptomId: sym.id,
      severity: opts?.severity ?? DEFAULT_SEVERITY,
      notes: '',
      medicineId: '',
      episodeState: ongoing ? 'ongoing' : 'point',
      reliefNote: '',
      reliefMedicineId: '',
    });
    return sym;
  }

  function addHealthStarterLog() {
    logIncident(t.starters.health.exampleTitle);
    setHealthStarterAdded(true);
    success();
  }

  function handleQuickLog() {
    const name = quickDraft.trim();
    if (!name) return;
    logIncident(name, {
      severity: quickSeverity,
      startTime: quickStartTime,
      durationMinutes: quickDuration,
      ongoing: quickOngoing,
    });
    setQuickDraft('');
    setQuickSeverity(DEFAULT_SEVERITY);
    setQuickStartTime('');
    setQuickDuration('');
    setQuickOngoing(false);
  }

  function openFormWithDraft() {
    tap();
    const name = quickDraft.trim();
    router.push({ pathname: '/health-form', params: name ? { name } : {} });
    setQuickDraft('');
  }

  function logAgain(issue: WeekIssue) {
    logIncident(issue.name);
    success();
  }

  const severityChips = (
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
            <Text style={[styles.quickSevChipText, { color: severityInk(s.value) }]}>{s.value}</Text>
          </PressableScale>
        );
      })}
    </View>
  );

  const cardBody = (
    <View style={styles.healthCardBody}>
      <View style={styles.section}>
        {thisWeekIssues.length === 0 ? (
          <NarratorQuote category="health" />
        ) : (
          thisWeekIssues.map((issue, i) => (
            <IssueRow
              key={issue.key}
              issue={issue}
              weekDates={weekDates}
              today={today}
              severityAt={severityAt}
              screenHue={screenHue}
              onOpen={() => openDetail(issue.symptomId, issue.ailment, issue.name)}
              onLogAgain={() => logAgain(issue)}
              first={i === 0}
            />
          ))
        )}

        {(logs.length === 0 || healthStarterAdded) && (
          <StarterCard
            embedded
            collapsible
            // The old ⓘ banner's line (2026-08-20). StarterCard's `text` had been empty here
            // since the "no manual" pass took `starters.health.text`; the banner it deferred to
            // is gone, so the one sentence lands in the card the maintainer's rule names.
            text={t.hints.health.text}
            example={
              <StarterExampleRow
                icon="medical-outline"
                title={t.starters.health.exampleTitle}
                meta="3/5"
                metaVariant="warning"
                onAdd={healthStarterAdded ? undefined : addHealthStarterLog}
                addLabel={t.starters.addExample}
                added={healthStarterAdded}
              />
            }
          />
        )}
      </View>

      <PadTypeRow
        prompt={t.healthIssues.typePrompt}
        value={quickDraft}
        onChangeText={setQuickDraft}
        onSubmit={handleQuickLog}
        accent={screenHue}
        onMore={openFormWithDraft}
        noGhostCheck
        panel={
          <QuickAddOptionsPanel>
            <QuickAddOptionRow
              icon="pulse-outline"
              label={t.whenFinishedLabel}
              accent={screenHue}
              wide
              value={
                <SegmentedControl
                  compact
                  options={[
                    { value: 'ongoing', label: t.episodes.stillGoing },
                    { value: 'over', label: t.episodes.itsOver },
                  ]}
                  value={quickOngoing ? 'ongoing' : 'over'}
                  onChange={(v) => setQuickOngoing(v === 'ongoing')}
                />
              }
            />
            <View style={styles.quickTimeField} ref={quickStartTimeLift.ref}>
              <QuickAddOptionRow
                icon="time-outline"
                label={t.whenStartedLabel}
                accent={screenHue}
                value={
                  <Input
                    value={quickStartTime}
                    onChangeText={setQuickStartTime}
                    placeholder={t.timeInputPlaceholder}
                    keyboardType="numbers-and-punctuation"
                    style={styles.quickTimeInput}
                    onFocus={quickStartTimeLift.onFocus}
                    onBlur={quickStartTimeLift.onBlur}
                  />
                }
              />
            </View>
            {!quickOngoing && (
              <View style={styles.quickTimeField} ref={quickDurationLift.ref}>
                <QuickAddOptionRow
                  icon="hourglass-outline"
                  label={t.durationLabel}
                  accent={screenHue}
                  value={
                    <Input
                      value={quickDuration}
                      onChangeText={setQuickDuration}
                      placeholder={t.durationPlaceholder}
                      keyboardType="number-pad"
                      style={styles.quickTimeInput}
                      onFocus={quickDurationLift.onFocus}
                      onBlur={quickDurationLift.onBlur}
                    />
                  }
                />
              </View>
            )}
            <QuickAddOptionRow icon="thermometer-outline" label={t.severityLabel} accent={screenHue} wide value={severityChips} />
          </QuickAddOptionsPanel>
        }
      />
    </View>
  );

  // The header row and the fold are the SAME in both branches — only the Surface differs. They
  // used to differ, and that was the §10 defect: the embedded branch drew neither, so the
  // stored fold did nothing on Home. See the edit note.
  const weekHeader = (
    <View style={styles.sectionLabelRow}>
      <CardAccentBadge domain="health" icon="pulse" size={32} accentOverride={screenHue} />
      <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.thisWeekLabel}</Text>
      <CardCollapseToggle collapsed={weekCollapsed} onToggle={toggleWeekCollapsed} cardLabel={t.thisWeekLabel} />
    </View>
  );

  const weekCard = embedded ? (
    <View style={styles.healthCardEmbedded}>
      {weekHeader}
      <Collapsible open={!weekCollapsed}>{cardBody}</Collapsible>
    </View>
  ) : (
    <TourTarget id="tour.health.log">
      <DebugNoteAnchor id="health.quickLog" label="Health — This week">
        <Surface style={styles.healthCard}>
          {weekHeader}
          <Collapsible open={!weekCollapsed}>{cardBody}</Collapsible>
        </Surface>
      </DebugNoteAnchor>
    </TourTarget>
  );

  return (
    <View style={embedded ? styles.embeddedContent : styles.content}>
      {/* ⚠️ No ⓘ banner since 2026-08-20 — its sentence moved into the StarterCard above,
          which is what this screen says while it has nothing on it. */}

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
        <PressableScale onPress={() => router.push('/health-log')} accessibilityRole="button" scaleTo={0.98} style={styles.moreEpisodesRow}>
          <Text style={[styles.moreEpisodesText, { color: theme.textMuted }]}>{t.episodes.seeAllOpen}</Text>
        </PressableScale>
      )}

      {weekCard}

      <CollapsedSection
        hue={screenHue}
        domain="health"
        icon="medical-outline"
        label={t.healthIssues.title}
        count={trackedCount}
        onTitlePress={() => setIssuesSheetOpen(true)}
        titlePressHint={t.healthIssues.openLabel}
      >
        <HealthIssuesPreviewList accent={screenHue} onOpenIssue={openDetail} />
        <PressableScale
          onPress={() => router.push('/health-log')}
          accessibilityRole="button"
          accessibilityLabel={t.healthLogTitle}
          scaleTo={0.98}
          style={[styles.overviewLogLink, { borderTopColor: theme.border }]}
        >
          <Ionicons name="document-text-outline" size={18} color={theme.accent} />
          <Text style={[styles.navCardText, { color: theme.text }]}>{t.healthLogTitle}</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </PressableScale>
      </CollapsedSection>

      {!embedded && <EpisodeCloseSheet log={closing} onClose={() => setClosing(null)} />}
      {!embedded && <HealthIssuesSheet visible={issuesSheetOpen} onClose={() => setIssuesSheetOpen(false)} accent={screenHue} />}
      {embedded && <EpisodeCloseSheet log={closing} onClose={() => setClosing(null)} />}
      {embedded && <HealthIssuesSheet visible={issuesSheetOpen} onClose={() => setIssuesSheetOpen(false)} accent={screenHue} />}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  content: { gap: SCREEN_GAP },
  // No horizontal padding either way — the caller supplies its own inset (screen content
  // wrapper, Home card padding, or CardExpandHost's), same convention components/FoodTab.tsx's
  // `root` follows.
  embeddedContent: { gap: SCREEN_GAP },
  healthCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  healthCardEmbedded: { gap: Spacing.md },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionLabel: { flex: 1, minWidth: 0, fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
  cardSubtitle: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  healthCardBody: { gap: Spacing.md },
  section: { gap: Spacing.xs },
  issueRowBox: { paddingHorizontal: Spacing.sm },
  issueRowStacked: { marginTop: Spacing.xs },
  logAgainBtn: { width: 30, height: 30, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  // `OpticalCenter` (2026-08-21): a Text whose box height is pinned by the circle around it,
  // which is the condition Android's asymmetric font padding breaks. Guarded by
  // lib/__tests__/designTokens.test.ts.
  logAgainText: { fontSize: FontSize.md, fontFamily: Fonts.bold, lineHeight: FontSize.md + 4, ...OpticalCenter },
  weekStripWrap: { borderTopWidth: 1, paddingTop: Spacing.xs, paddingBottom: Spacing.sm },
  moreEpisodesRow: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  moreEpisodesText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  quickTimeField: { flexDirection: 'row', flexGrow: 1, flexShrink: 1, flexBasis: '46%', minWidth: 0 },
  quickTimeInput: { paddingVertical: Spacing.xs },
  quickSeverityChips: { flexDirection: 'row', gap: Spacing.xs },
  quickSevChip: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 0, borderColor: 'transparent' },
  // `OpticalCenter` (2026-08-21): a severity digit inside a 28px circle — a box whose height the
  // text does not set, which is the condition Android's asymmetric font padding breaks.
  quickSevChipText: { fontSize: FontSize.xs, fontFamily: Fonts.bold, ...OpticalCenter },
  ailmentWeekStrip: { flexDirection: 'row', gap: 5, paddingLeft: 2 },
  ailmentDotCol: { alignItems: 'center', gap: 2 },
  ailmentDayAbbr: { fontSize: 7, fontFamily: Fonts.semibold },
  ailmentDot: { width: 9, height: 9, borderRadius: Radius.full, borderWidth: 1.5 },
  overviewLogLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs, paddingTop: Spacing.sm, borderTopWidth: 1 },
  navCardText: { flex: 1, fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
});
