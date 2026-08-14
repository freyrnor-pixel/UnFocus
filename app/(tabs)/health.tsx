/**
 * health.tsx — health / symptom log, shaped like the Habits tab (2026-08-11).
 *
 * **The Habits/Goals layout, applied here** (maintainer, 2026-08-11: *"In Health screen I want
 * the same logic as with Goals and habits. Health issues same as Goals, and habits the same as
 * logging incidents. Not practically the same, but the same layout, and adjusted where
 * needed."*). Two halves, exactly as app/(tabs)/habits.tsx has them:
 *
 *   1. **One card you register on** — where Habits lists today's habits, this lists the issues
 *      that have actually been going on this week, each with a "+" that logs another incident
 *      where a habit row has its −/+, the 7-day severity strip as its expandable drawer, and
 *      a components/PadTypeRow composer pinned at the foot of the list.
 *   2. **A "Health issues" drawer at the foot** — components/CollapsedSection.tsx, the same
 *      component and the same two tap targets as the Goals drawer: the chevron previews the
 *      standing list (components/HealthIssuesPreviewList.tsx), the NAME opens the popup
 *      (components/HealthIssuesSheet.tsx) where issues are added and untracked.
 *
 * **What that replaced, and why it is not a loss.** The screen used to carry two separate
 * cards — a "Quick log" card and a "This week" card — plus a Health-log link folded into the
 * foot of the second. Quick log is now the composer at the bottom of the one card (a composer
 * belongs to the list it appends to, which is the placement rule the Food tab's "Add dish"
 * button was fixed to in 2026-08-06), and This week is that card's rows. Every field Quick log
 * had survives: name on the line, then still-going/over, start time, duration and severity as
 * the composer's labelled option cells, plus a "More options" button into the full form that
 * the old card had no equivalent of. The Health-log link moved into the drawer's body, which
 * is where the rest of this screen's ways-out now live.
 *
 * **What a "health issue" is.** `symptoms.tracked` (2026-08-11), not the `symptoms` table:
 * that table is 36 seeded Norwegian names powering the typeahead, so a drawer opening onto all
 * of them would be a vocabulary list. See store/useHealthStore.ts's `tracked` doc and the
 * migration in lib/db.ts. Untracking deletes nothing.
 *
 * **The no-scoreboard rule is load-bearing on this screen specifically.** A row's right-hand
 * value is how many times something happened this week, and a count of migraines is not an
 * achievement in either direction — the user does not control it. So: no streak, no "better
 * than last week", no total, no colour that escalates with the count, and no congratulation
 * for a quiet week. The card's own sub-header says so out loud. Same family as the medicine
 * tray being a window rather than a deadline, and lib/episodes.ts's refusal to interpret
 * relief data.
 *
 * **Habits moved out (2026-07-23, UX audit finding E1)**: this screen used to also
 * embed a full Habits section (today/week/month views, per-habit cards) below the
 * symptom summary — but "Health" as a tab name/icon only promises symptom tracking,
 * and a whole separate habit-building system living inside it was a name-vs-content
 * mismatch a user had to learn by accident. That section is now app/(tabs)/habits.tsx,
 * its own bottom-nav tab (replacing Scan — see lib/siteNav.ts). This file is purely the
 * symptom-tracking half now — which is what made the 2026-08-11 pass above possible: the
 * two screens are finally the same kind of screen.
 *
 * Connections:
 *   Imports → components/MedicineTrayCard (the medicine-tray dose card — see below),
 *             components/ScreenScaffold, components/HintCard, components/StarterCard
 *             (first-run explainer, shown while nothing has ever been logged; `collapsible`
 *             as of 2026-08-06 v3 — its example row collapses to a trigger row rather than
 *             always showing. Inside the card since 2026-08-11, where Habits has always kept
 *             its own), components/StarterExampleRow (its preview row),
 *             components/OpenEpisodeCard + components/EpisodeCloseSheet (ongoing episodes),
 *             components/CollapsedSection + components/HealthIssuesPreviewList +
 *             components/HealthIssuesSheet (2026-08-11 — the "Health issues" drawer and its
 *             popup, the exact shape app/(tabs)/habits.tsx gives Goals),
 *             components/Surface, components/CardAccent (CardAccentBadge),
 *             components/PadRow (2026-08-11 — the shared row shell each issue's header line is
 *             drawn through, the same conversion HabitCard got on 2026-08-01),
 *             components/PadTypeRow + components/QuickAddOptionsPanel +
 *             components/QuickAddOptionRow (the composer and its labelled option cells),
 *             components/Collapsible (the week-strip drawer),
 *             components/PressableScale, components/DebugNoteAnchor, components/TourTarget,
 *             components/FormControls (Input, SegmentedControl), constants/theme,
 *             constants/motion (Travel), lib/date, lib/episodes, lib/i18n,
 *             lib/useNowMinutes (keeps the week strip's `today` current across midnight),
 *             lib/severity, lib/useAppTheme, lib/useFirstVisitHint, lib/screenColor,
 *             lib/haptics, lib/useKeyboardLift (the composer's start-time/duration fields),
 *             store/useHealthStore,
 *             store/useSettingsStore (featureMedicine gate only)
 *   Used by → Expo Router route "/health" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx (BottomNav "Health" tab)
 *   Data    → useHealthStore — reads `logs` for the week's rows and `symptoms` for the drawer's
 *             count; calls `add()` + `ensureSymptom()` for the composer, for a row's "+" and for
 *             the StarterExampleRow "+". Full multi-field edit/delete still lives in
 *             app/health-form.tsx.
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - Grouping key is the symptom id when present, else the (lowercased) ailment string for
 *     legacy rows — same convention as health-log.tsx/health-detail.tsx. Keep it: a row's "+"
 *     resolves that name back through `ensureSymptom`, so a legacy free-text entry can be
 *     logged again from its row without first being repaired.
 *   - **A row's "+" writes at severity 3 and no time**, deliberately. AGENTS.md's composer
 *     contract says committing at tier 1 must always produce a valid row, and the one-gesture
 *     capture is exactly tier 1: the middle of the scale is the honest default when nothing
 *     was asked, and the composer below (or the entry's own page) is where a real severity is
 *     chosen. Don't carry the last entry's severity forward — that guesses at data.
 *   - **There is no "−" on a row**, and that is the deliberate divergence from HabitCard's
 *     −/+ pair. Un-counting a habit is a correction to a tally; un-logging a symptom means
 *     deleting a dated entry with a severity and possibly a note on it, which belongs in
 *     app/health-form.tsx via the row's ⋯ → its own page. A one-tap delete of health history
 *     on a list row is not a gesture this app should offer.
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus
 *     effect only closes the hint on blur.
 *   - `getScreenColor` (the plain function), **not** `useScreenColor` (the context hook), at
 *     the screen level: this component RENDERS ScreenScaffold, so it sits ABOVE that
 *     component's ScreenColorContext.Provider and the hook would read the default (grey) here.
 *     A child of ScreenScaffold — `IssueRow` below, MedicineTrayCard — can safely use the hook.
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
import CardHintNote from '@/components/CardHintNote';
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
import { CardAccentBadge } from '@/components/CardAccent';
import PressableScale from '@/components/PressableScale';
import { Input, SegmentedControl } from '@/components/FormControls';
import { useT } from '@/lib/i18n';
import { success, tap } from '@/lib/haptics';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { todayStr, getWeekDates, addDurationToTime } from '@/lib/date';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { openEpisodes } from '@/lib/episodes';
import { SEVERITY_COLORS, severities, severityInk } from '@/lib/severity';
import {
  BORDER_WIDTH,
  computeBorderTone,
  FontSize,
  Fonts,
  HitSlop,
  Radius,
  SCREEN_GAP,
  Spacing,
  Type,
} from '@/constants/theme';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { getScreenColor, useScreenColor } from '@/lib/screenColor';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

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
  onOpen,
  onLogAgain,
  first,
}: {
  issue: WeekIssue;
  weekDates: string[];
  today: string;
  severityAt: (key: string, date: string) => number | null;
  onOpen: () => void;
  onLogAgain: () => void;
  /** First row in the list — see `rowStacked`. */
  first?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  // Safe here, unlike at screen level: this component is a descendant of ScreenScaffold's
  // provider. See the file header's last Edit note.
  const screenHue = useScreenColor() ?? theme.border;
  const SEVERITIES = severities();

  // Boxed row (card design reset, 2026-08-05) — the screen hue at the FIELD rung, one step
  // lighter than the card's own edge. Byte-for-byte the same construction HabitCard uses, so
  // a row on Health and a row on Habits are the same object.
  const rowBox = {
    borderWidth: BORDER_WIDTH.field,
    borderColor: computeBorderTone(screenHue, isDark, 'field'),
    borderRadius: Radius.sm,
  };

  return (
    <View style={[styles.issueRowBox, rowBox, !first && styles.issueRowStacked]}>
      <PadRow
        title={issue.name}
        // The screen's own teal, not lib/domainColor's health identity (a wine-red that
        // mismatches every edge on this screen) — the same call the 2026-08-06 pass made for
        // this file's badges.
        accent={screenHue}
        // A.4 rule 1: the glyph is neutral; the hue lives on the edge, and severity lives in
        // the week strip below where it means something.
        leading={<Ionicons name="medical-outline" size={22} color={theme.textMuted} />}
        // The ONE right-hand value. A size, never a score — see the header.
        rightValue={t.healthIssues.timesThisWeek(issue.count)}
        onPress={() => setExpanded((v) => !v)}
        // PadRow's one row-level action, exactly where HabitCard puts "edit this habit".
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

      {/* Clip-revealed, like HabitCard's week strip — no opacity fade, so a folded row reads
          "still there, just folded". See components/Collapsible.tsx's header. */}
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

export default function HealthScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const symptoms = useHealthStore((s) => s.symptoms);
  const addLog = useHealthStore((s) => s.add);
  const ensureSymptom = useHealthStore((s) => s.ensureSymptom);
  const featureMedicine = useSettingsStore((s) => s.featureMedicine);

  // The ⓘ hint is collapsed until tapped (2026-07-31 — the first-visit auto-open and its
  // `autoOpen` arg are gone); StarterCard already teaches this.
  const [hintOpen, dismissHint] = useFirstVisitHint('health');
  const [quickDraft, setQuickDraft] = useState('');
  const [quickSeverity, setQuickSeverity] = useState(DEFAULT_SEVERITY);
  const [quickStartTime, setQuickStartTime] = useState('');
  const [quickDuration, setQuickDuration] = useState('');
  // Both fields sit well down the card (behind the ⓘ hint/starter/episode prompts), so each
  // self-lifts above the keyboard on focus — see lib/useKeyboardLift.ts. PadTypeRow's own
  // scroll-into-view covers its main input; these are separate controls in its panel and are
  // focused directly, so they still need their own.
  const quickStartTimeLift = useKeyboardLift<View>();
  const quickDurationLift = useKeyboardLift<View>();
  // StarterCard's example (2026-07-31, user report: it vanished with no feedback the instant
  // its "+" was pressed, since that write flips `logs.length` off zero). Keeps the card
  // mounted, dimmed, for the rest of this visit instead — see addHealthStarterLog below.
  const [healthStarterAdded, setHealthStarterAdded] = useState(false);
  // The composer's Still going / It's over pair, defaulting to "it's over" (EPISODES.md D5 —
  // most logging happens afterwards). "Still going" hides the Duration cell, because a
  // duration and an open episode contradict.
  const [quickOngoing, setQuickOngoing] = useState(false);
  // Prompts the user answered "Still going" to. In memory ONLY, deliberately: answering
  // writes no column and no timestamp anywhere. The five tabs are co-mounted (lazy: false),
  // so this survives tab switches for the whole session and returns on next launch — which
  // is correct, because the app genuinely does not know whether it ended.
  const [dismissedEpisodes, setDismissedEpisodes] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState<HealthLog | null>(null);
  const [issuesSheetOpen, setIssuesSheetOpen] = useState(false);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  // This screen's own hue — see the header's last Edit note for why this is the plain
  // function and not the context hook.
  const screenHue = getScreenColor(theme, 'health').base;
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  // Same minute tick as the Habits tab, for the weaker of the two reasons (2026-08-13): this
  // screen's `today` is DISPLAY only — the 7-day severity strip and its "is this day still in
  // the future" dimming — because every write here calls `todayStr()` fresh inside its own
  // handler. So a stale value showed last week's strip rather than filing an entry under the
  // wrong day. Fixed alongside Habits because it is the same one-line pairing and the two
  // screens are deliberately built alike; `lib/__tests__/todayFreshness.test.ts` pins both.
  useNowMinutes();
  const today = todayStr();
  const weekDates = useMemo(() => getWeekDates(today), [today]);

  // Issues with at least one entry this week + a per-(issue,date) max-severity index.
  // Unchanged from the "This week" card this replaced — the same grouping, the same ordering,
  // now drawn as rows instead of bars.
  const { thisWeekIssues, severityAt } = useMemo(() => {
    const weekSet = new Set(weekDates);
    const counts: Record<string, WeekIssue> = {};
    const sevByKey = new Map<string, number>(); // `${groupKey}|${date}` -> max severity
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

  /** How many issues the standing list holds — the drawer's count. A size, not a score. */
  const trackedCount = useMemo(() => symptoms.filter((s) => s.tracked).length, [symptoms]);

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

  /**
   * The one write path for every capture on this screen — the composer, a row's "+", and the
   * starter example all land here, so a log created by any of them is the same shape. Only the
   * fields a given caller actually asked about are passed; everything else takes the default
   * that makes the row valid on its own (see the header's "+" note).
   */
  function logIncident(name: string, opts?: {
    severity?: number;
    startTime?: string;
    durationMinutes?: string;
    ongoing?: boolean;
  }) {
    // Also promotes the symptom onto the standing "Health issues" list if it wasn't there.
    const sym = ensureSymptom(name);
    const startTime = (opts?.startTime ?? '').trim();
    const ongoing = opts?.ongoing ?? false;
    const computedEnd = addDurationToTime(todayStr(), startTime, Number((opts?.durationMinutes ?? '').trim()));
    addLog({
      date: todayStr(),
      startTime,
      // An open episode has no end, whatever was typed into Duration before switching.
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

  // Empty-state example (2026-07-27): logs a real entry (today, severity 3) through the same
  // path everything else uses — `logs.length` flips to 1 right after, which is why the card's
  // mount condition ORs in `healthStarterAdded`.
  function addHealthStarterLog() {
    // The teaching example must not create an open episode the user then has to close.
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

  /**
   * Tier 3 — "More options" (AGENTS.md's three-tier composer contract). Opens the full form
   * carrying the typed name and saves nothing, the same call app/(tabs)/habits.tsx makes for
   * `/habit-form`: health-form is a real create-mode editor, so nothing is written until Save
   * there. It MUST work on an empty line — PadTypeRow's `onMore` shows as soon as the field is
   * focused, and a handler that early-returns on an empty draft is the exact bug that button
   * was reworked to fix on 2026-08-05.
   */
  function openFormWithDraft() {
    tap();
    const name = quickDraft.trim();
    router.push({ pathname: '/health-form', params: name ? { name } : {} });
    setQuickDraft('');
  }

  /** A row's "+": one gesture, today, no time, middle of the severity scale. */
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

  return (
    <>
      <ScreenScaffold
        title={t.healthTitle}
        tier="site"
        screenKey="health"
        bottomNav={false}
        pagerFloatingNav
        ownBackground={false}
      >
        <View style={styles.content}>
          <HintCard
            text={t.hints.health.text}
            example={t.hints.health.example}
            open={hintOpen}
            noPill
            onDismiss={dismissHint}
          />

          {/* Ongoing-episode prompts (2026-08-01) — above the card, because they are about an
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

          {/* The one card — rows, then the composer, exactly how the Habits card is built.
              This replaced the separate "Quick log" and "This week" cards (2026-08-11); see
              the file header. */}
          <TourTarget id="tour.health.log">
            <DebugNoteAnchor id="health.quickLog" label="Health — This week">
              {/* No `borderColor` (card design reset, 2026-08-05): a card on its own screen
                  inherits that screen's one hue. The badge matches it too (`accentOverride`,
                  2026-08-06) — it used to keep drawing lib/domainColor.ts's identity hue (a
                  different wine-red vs this screen's teal), which read as a mismatched icon. */}
              <Surface style={styles.healthCard}>
                <View style={styles.sectionLabelRow}>
                  {/* Per-card glyph, not the domain default (2026-07-28 design review) — the
                      heart still marks the Health tab itself in BottomNav. Size 32 since
                      2026-08-09 ("icon in upper left is too small"). */}
                  <CardAccentBadge domain="health" icon="pulse" size={32} accentOverride={screenHue} />
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.thisWeekLabel}</Text>
                </View>

                {/* Sub-header — the counterpart of the Habits card's, restyled the same way it
                    was after the 2026-08-06 v2 feedback (bold, full-contrast, its own room), so
                    it reads as a heading FOR the card rather than a caption inside it. */}
                <Text style={[styles.cardSubtitle, { color: theme.text }]}>
                  {t.healthIssues.cardSubtitle}
                </Text>

                {/* Tips — a plain line under the sub-header, not boxed and not gated on
                    emptiness, the same permanent explainer Habits keeps.
                    **components/CardHintNote since 2026-08-13** — see the Habits tab's matching
                    mount. The two tabs hand-rolled this line separately and had drifted apart
                    (this one was regular weight and not italic; Habits' was medium italic at a
                    step larger), which is the whole reason it is one component now. */}
                <CardHintNote text={t.starters.health.text} placement="head" style={styles.tipsNote} />

                {/* The bottom half of the card — list, then composer. Matches the Habits card's
                    own `habitsCardBody` rhythm; the card breathed at the top and was flush at
                    the bottom before that was fixed there (2026-08-08). */}
                <View style={styles.healthCardBody}>
                  <View style={styles.section}>
                    {thisWeekIssues.length === 0 ? (
                      // 2026-08-12: the "Nothing logged this week." line was removed — the
                      // first-run explainer below (gated on the whole log being empty) and the
                      // permanent tips line above it already cover an empty week, and a quiet
                      // week deliberately gets no line of its own to avoid reading as either a
                      // gap to fill or an achievement.
                      null
                    ) : (
                      thisWeekIssues.map((issue, i) => (
                        <IssueRow
                          key={issue.key}
                          issue={issue}
                          weekDates={weekDates}
                          today={today}
                          severityAt={severityAt}
                          onOpen={() => openDetail(issue.symptomId, issue.ailment, issue.name)}
                          onLogAgain={() => logAgain(issue)}
                          first={i === 0}
                        />
                      ))
                    )}

                    {/* First-run explainer. Gated on the whole log being empty (not just this
                        week's), so a user with history doesn't see it on a quiet week — and it
                        returns if every entry is later deleted. **Stays mounted through
                        `healthStarterAdded`**: pressing the example's "+" writes a real log,
                        which flips `logs.length` off zero in the same tick — without the OR the
                        card would unmount itself the instant it was used. It has no `text` of
                        its own: the tips line above carries the explanation permanently, which
                        is exactly how the Habits card splits the same two jobs.
                        **`embedded`, and inside this section rather than above the card body
                        (2026-08-12)**: it used to be a StarterCard Surface between the tips
                        line and the body, i.e. a card inside this card, which put the example
                        51px in from the screen edge while the To-do day card draws its example
                        bare at 33.5. The example is a row in the list it is an example of now —
                        last in the list's own slot, directly above the composer that would
                        create the real thing, at the same width as both. See
                        components/StarterCard.tsx's `embedded` note. */}
                    {(logs.length === 0 || healthStarterAdded) && (
                      <StarterCard
                        embedded
                        collapsible
                        exampleHeaderLabel={t.starters.health.tapToAdd}
                        example={
                          <StarterExampleRow
                            icon="medical-outline"
                            title={t.starters.health.exampleTitle}
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
                  </View>

                  {/* The pad's type line — always open, at the bottom of the list it appends
                      to. This IS the old Quick log card: name on the line (tier 1, and it
                      alone produces a valid entry), the four settings that change what the
                      entry is as labelled cells (tier 2), and the full form behind "More
                      options" (tier 3). See AGENTS.md's three-tier composer contract. */}
                  <PadTypeRow
                    prompt={t.healthIssues.typePrompt}
                    value={quickDraft}
                    onChangeText={setQuickDraft}
                    onSubmit={handleQuickLog}
                    accent={screenHue}
                    onMore={openFormWithDraft}
                    // No check to preview: an issue row ends in a "+", never a check — the
                    // same reason app/(tabs)/habits.tsx passes this.
                    noGhostCheck
                    panel={
                      <QuickAddOptionsPanel>
                        {/* Adjacency is the caller's job (QuickAddOptionsPanel has no grouping
                            API): the two time fields are passed adjacent so they pair on one
                            line, with the two live controls `wide` above and below them. */}
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
                        {/* Hidden while the episode is open: a duration and an open episode
                            contradict. */}
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
                        <QuickAddOptionRow
                          icon="thermometer-outline"
                          label={t.severityLabel}
                          accent={screenHue}
                          wide
                          value={severityChips}
                        />
                      </QuickAddOptionsPanel>
                    }
                  />
                </View>
              </Surface>
            </DebugNoteAnchor>
          </TourTarget>

          {/* Medicine trays (2026-07-27) — gated on settings.featureMedicine (on by default,
              Settings → Advanced → Features); the card handles its own empty state, so it isn't
              gated on having medicines. It stays BELOW the logging card (2026-08-01): doses are
              recurring and a tray reminder already brings you to them, while an unlogged symptom
              is gone once the moment passes. */}
          {featureMedicine && <MedicineTrayCard />}

          {/* Health issues — the Goals-shaped drawer at the foot of the screen (2026-08-11).
              Chevron previews the standing list, the NAME opens the popup; both are ≥
              MIN_TAP_TARGET, the instructed rule-4 exception CollapsedSection documents. The
              count is a size (how many things you keep an eye on), which is the same test
              Shopping's Food/Catalogue drawers pass and Earlier days deliberately fails. */}
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
            {/* The full log, which used to be folded into the foot of the "This week" card.
                It belongs here now: this drawer is where this screen's ways out live, and a
                link to every entry ever is a peer of the list of issues, not of the week. */}
            <PressableScale
              onPress={() => router.push('/health-log')}
              accessibilityRole="button"
              accessibilityLabel={t.healthLogTitle}
              scaleTo={0.98}
              style={[styles.overviewLogLink, { borderTopColor: theme.border }]}
            >
              {/* A.4 rule 1: a link glyph takes the action colour, not the health hue. */}
              <Ionicons name="document-text-outline" size={18} color={theme.accent} />
              <Text style={[styles.navCardText, { color: theme.text }]}>{t.healthLogTitle}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </PressableScale>
          </CollapsedSection>

          <View style={{ height: Spacing.xl + Spacing.xxl }} />
        </View>
      </ScreenScaffold>

      <EpisodeCloseSheet log={closing} onClose={() => setClosing(null)} />
      <HealthIssuesSheet
        visible={issuesSheetOpen}
        onClose={() => setIssuesSheetOpen(false)}
        accent={screenHue}
      />
    </>
  );
}

const baseStyles = StyleSheet.create({
  // The screen owns the vertical rhythm (2026-08-08). `gap` here, and NO vertical margin on
  // any card in the stack — see SCREEN_GAP's doc in constants/theme.ts for the five different
  // gaps this replaced. A child that is always mounted but sometimes zero-height (a closed
  // Collapsible) must be grouped or conditionally rendered, or it books a gap slot for nothing.
  content: { padding: Spacing.md, gap: SCREEN_GAP },
  // The one card. `gap` rather than per-child margins, matching the Habits card.
  healthCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  // Row wrapper (2026-07-26, "bring the card colour back"): the health badge + the label.
  // No marginBottom — the card's own `gap` owns the spacing now.
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionLabel: { fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
  // Bold + full contrast, the shape the Habits sub-header was corrected to on 2026-08-06 v2
  // after a first pass in small muted text read as just another line of body copy.
  cardSubtitle: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // The tips line's own row/icon/text styles are gone (2026-08-13) — components/CardHintNote
  // draws all three now. This cancels the note's own head gap: the card already stacks its
  // children on `gap: Spacing.md`, and both together would make it 32px.
  tipsNote: { marginBottom: 0 },
  healthCardBody: { gap: Spacing.md },
  section: { gap: Spacing.xs },
  // Boxed row at the FIELD rung (card design reset, 2026-08-05) — the same construction
  // HabitCard uses; the colours are applied inline because they need the screen hue.
  issueRowBox: { paddingHorizontal: Spacing.sm },
  issueRowStacked: { marginTop: Spacing.xs },
  // "+" only — never a "−". See the file header's Edit note for why un-logging is not a row
  // gesture here. Same 30px key as HabitCard's adjuster buttons.
  logAgainBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logAgainText: { fontSize: FontSize.md, fontFamily: Fonts.bold, lineHeight: FontSize.md + 4 },
  weekStripWrap: { borderTopWidth: 1, paddingTop: Spacing.xs, paddingBottom: Spacing.sm },
  // "See all" past the three-card prompt cap — a plain link, no card, no count.
  moreEpisodesRow: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  moreEpisodesText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // A wrapper whose only job is holding useKeyboardLift's ref; it must not change the grid's
  // layout, so it carries QuickAddOptionRow's own `half` growth keys.
  // **`flexDirection: 'row'` is load-bearing, not tidiness.** The cell inside re-declares
  // `flexBasis: '46%'`, and a flex basis is measured along the container's MAIN axis — in a
  // default (column) wrapper that is the cell's HEIGHT, i.e. a percentage of an auto-height
  // parent. Making the wrapper a row keeps the basis on width, where the grid means it.
  quickTimeField: { flexDirection: 'row', flexGrow: 1, flexShrink: 1, flexBasis: '46%', minWidth: 0 },
  quickTimeInput: { paddingVertical: Spacing.xs },
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
  ailmentWeekStrip: { flexDirection: 'row', gap: 5, paddingLeft: 2 },
  ailmentDotCol: { alignItems: 'center', gap: 2 },
  ailmentDayAbbr: { fontSize: 7, fontFamily: Fonts.semibold },
  ailmentDot: { width: 9, height: 9, borderRadius: Radius.full, borderWidth: 1.5 },
  // Health-log link, now the foot of the Health issues drawer (2026-08-11; it was the foot of
  // the "This week" card from 2026-07-21). The hairline top border still makes it read as a
  // footer rather than as another issue row.
  overviewLogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  navCardText: { flex: 1, fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
});
