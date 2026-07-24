/**
 * HomeNotesCard.tsx — Home-screen preview of the real Notes feature (useNotesStore).
 *
 * Mirrors PlanTaskCard's Surface + domain-colored-border layout: always shows a collapsed
 * preview of the first COLLAPSED_COUNT active notes, with a footer toggle to reveal
 * the rest. Inline checkbox taps mark notes checked/unchecked; a "+" header action
 * creates a blank note and routes to /notes; a "See all →" footer link opens the full
 * Notes screen. Shows an empty-state message inline when the notes list is empty
 * (always-render-header per Decision 043 rule 4) — it does not render nothing/null.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, components/CardAccent
 *             (badge+wash gradient move), components/HomePreviewEmpty, components/AddRow,
 *             components/TimeBoxInput (quick-add's companion-task time field),
 *             components/Collapsible + components/AnimatedChevron (checked-zone clip reveal),
 *             constants/theme, lib/haptics, lib/i18n, lib/date (todayStr), lib/useAppTheme,
 *             lib/domainColor, lib/useVoiceCapture, store/useNotesStore, store/useTaskStore
 *             (quick-add's optional companion task only)
 *   Used by → app/(tabs)/index.tsx (replaces InboxSection in the Notes preview slot)
 *   Data    → reads/writes useNotesStore (notes table): toggleChecked, add, update; quick-add's
 *             "also add as a task" toggle additionally writes useTaskStore (tasks table): add
 *
 * Edit notes:
 *   - **Collapsed sizing (2026-07-13)**: `cardCollapsed` (minHeight:
 *     `HOME_PREVIEW_CARD_MIN_HEIGHT`, constants/theme.ts) is a compact shared *resting* floor
 *     applied only while `!expanded`, so this card reads the same size as
 *     PlanTaskCard/HomeShoppingCard when light — then grows per note row above it;
 *     `noteRow`'s paddingVertical was trimmed to `Spacing.xs` for a slimmer collapsed row.
 *   - **Empty state**: an empty list renders the shared `HomePreviewEmpty` (left-aligned
 *     `t.notes.emptyState` message), which fills the resting floor as one inviting block
 *     instead of leaving a bare band under a single line of text.
 *   - Existing note rows are read-only previews (no inline TextInput) — editing them is the
 *     /notes screen's job. The only inline TextInput here is the trailing AddRow, which
 *     *creates* a new note (title-only, mirrors Health's add-habit / Plans' add-task AddRow
 *     flow) rather than editing one — it calls addNote() + updateNote(id, {header}) on submit,
 *     so a typed quick note is a sibling of the mic's voice-note create, not a variant of it.
 *   - Checked notes are shown in a dimmed collapsed sub-section only when fully expanded,
 *     mirroring PlanTaskCard's done zone.
 *   - **Inline mic button (title row)**: records a voice note without leaving Home, via
 *     lib/useVoiceCapture (the same recording logic app/notes.tsx's VoiceNoteFAB uses) — on a
 *     finished transcript it creates a note (add() + update({body})), matching notes.tsx's own
 *     onTranscript handler exactly, so a note recorded from Home is identical to one recorded
 *     from /notes. Sits as a sibling of the title's PressableScale (not nested inside it) so
 *     its tap doesn't also trigger the title's navigate-to-/notes press. success() haptic on
 *     a created note; tap() haptic on toggle/expand.
 *   - **Quick-add essential settings (2026-07-24)**: notes have no fields beyond
 *     header/body/checked, so there's nothing to expose from useNotesStore itself. Instead the
 *     AddRow's `extras` carry the three things that actually matter for a note captured
 *     in-passing: a secondary "extra info" TextInput (→ `body`, same field the full /notes
 *     editor uses), an "also add as a task" toggle chip, and — only while that toggle is on
 *     (standalone notes have no time field) — a `TimeBoxInput` for the companion task's start
 *     time. The companion task is a plain independent `useTaskStore.add()` call (undated/
 *     Whenever, dated today, non-recurring — the same shape Home's Plans-preview quick-add
 *     uses for its own title-only case) — there's no `noteId`/`taskId` link column, so this is
 *     "also create a task with this title", not a synced pointer. All three extras reset to
 *     their defaults after each commit.
 *   - **Touch target (2026-07-11)**: check circle is visually 22x22 but `hitSlop={13}`
 *     brings the tappable area to ~48dp, meeting Android's minimum touch-target size.
 *   - **Badge pinned (2026-07-24)**: `CardAccentBadge` is absolutely positioned (`badgeFixed`)
 *     instead of inline in `titleLeft` — see the JSX comment at the header block.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge, CardAccentWash } from '@/components/CardAccent';
import HomePreviewEmpty from '@/components/HomePreviewEmpty';
import AddRow from '@/components/AddRow';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import TimeBoxInput from '@/components/TimeBoxInput';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, Radius, Spacing, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useNotesStore } from '@/store/useNotesStore';
import { useTaskStore } from '@/store/useTaskStore';
import { getDomainColor } from '@/lib/domainColor';
import { useVoiceCapture } from '@/lib/useVoiceCapture';

const COLLAPSED_COUNT = 5;

export default function HomeNotesCard() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const domainColor = getDomainColor(theme, 'note');

  const notes = useNotesStore((s) => s.notes);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);
  const addNote = useNotesStore((s) => s.add);
  const updateNote = useNotesStore((s) => s.update);
  const addTask = useTaskStore((s) => s.add);

  const [expanded, setExpanded] = useState(false);
  const [checkedOpen, setCheckedOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [extraInfoDraft, setExtraInfoDraft] = useState('');
  const [addAsTask, setAddAsTask] = useState(false);
  const [taskTimeDraft, setTaskTimeDraft] = useState('');

  const { listening, toggle: toggleVoiceCapture } = useVoiceCapture((text) => {
    const note = addNote();
    updateNote(note.id, { body: text });
    success();
  });

  function commitNoteDraft() {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    const note = addNote();
    const body = extraInfoDraft.trim();
    updateNote(note.id, body ? { header: trimmed, body } : { header: trimmed });
    if (addAsTask) {
      addTask({
        title: trimmed,
        date: todayStr(),
        time: taskTimeDraft || undefined,
        taskType: 'start-at',
        done: false,
        recurring: 'none',
        recurringDays: [],
        sortOrder: 0,
        hasStartDate: false,
      });
    }
    setNoteDraft('');
    setExtraInfoDraft('');
    setAddAsTask(false);
    setTaskTimeDraft('');
    success();
  }

  const activeNotes = notes.filter((n) => !n.checked);
  const checkedNotes = notes.filter((n) => n.checked);

  const visibleActive = expanded ? activeNotes : activeNotes.slice(0, COLLAPSED_COUNT);
  const showToggle = activeNotes.length > COLLAPSED_COUNT;

  function handleToggle(id: string) {
    tap();
    toggleChecked(id);
  }

  function handleTitlePress() {
    router.push('/notes');
  }

  return (
    <Surface
      surfaceContext="ambient"
      borderColor={domainColor.accent}
      style={[styles.card, !expanded && styles.cardCollapsed]}
    >
      <View style={styles.cardContent}>
        {/* Header wash — the "one gradient move" (bled past the content padding to the card edge). */}
        {/* Wash band = default 64 (2026-07-24, "stretch the colour to fit the text"): the taller
            band gives symmetric colour above/below the header. titleRow's marginBottom is bumped to
            Spacing.md so the content still starts at the band divider (paddingTop 16 + badge 32 +
            16 = 64), keeping the body aligned.
            **Badge pinned (2026-07-24)**: the badge is absolutely positioned (`badgeFixed`) instead
            of inline in `titleLeft` — inline + vertically centred, it could drift toward the wash/
            surface seam when the title's lineHeight grows at large accessibility text sizes
            ("touching the line" — user report). Pinning it removes that dependency; `titleRow` gets
            a matching `paddingLeft` (badge width + gap) so the title text still clears it. Same
            pattern applied to PlanTaskCard/HomeShoppingCard for consistency. */}
        <CardAccentWash domain="note" style={styles.headerWash} />
        <CardAccentBadge domain="note" size={32} style={styles.badgeFixed} />

        {/* Title row — title/badge (navigates to /notes) and the mic button are siblings,
            not nested Pressables, so tapping the mic doesn't also fire the title's navigate. */}
        <View style={styles.titleRow}>
          <PressableScale onPress={handleTitlePress} style={styles.titleLeftPressable} scaleTo={0.97}>
            <View style={styles.titleLeft}>
              <Text style={[styles.title, { color: theme.text }]}>{t.notes.title}</Text>
              {activeNotes.length > 0 && (
                <View style={[styles.badge, { backgroundColor: domainColor.soft, borderColor: rgba(domainColor.accent, 0.4) }]}>
                  <Text style={[styles.badgeText, { color: domainColor.accent }]}>{activeNotes.length}</Text>
                </View>
              )}
            </View>
          </PressableScale>
          <PressableScale
            onPress={toggleVoiceCapture}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={listening ? t.notes.stopRecording : t.notes.recordVoiceNote}
            scaleTo={0.9}
          >
            <View
              style={[
                styles.micButton,
                { backgroundColor: listening ? theme.badSoft : domainColor.soft, borderColor: rgba(listening ? theme.bad : domainColor.accent, 0.4) },
              ]}
            >
              <Ionicons name={listening ? 'stop' : 'mic'} size={15} color={listening ? theme.bad : domainColor.accent} />
            </View>
          </PressableScale>
        </View>

        {/* Active note rows */}
        {activeNotes.length === 0 ? (
          <HomePreviewEmpty text={t.notes.emptyState} domainColor={domainColor} />
        ) : (
          <View style={styles.rowsContainer}>
            <View style={styles.rows}>
              {visibleActive.map((note, idx) => (
                <View key={note.id}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                  <View style={styles.noteRow}>
                    <PressableScale
                      style={[styles.check, { borderColor: domainColor.accent }]}
                      onPress={() => handleToggle(note.id)}
                      hitSlop={13}
                      accessibilityLabel={t.notes.checkedLabel}
                      scaleTo={0.97}
                    >
                      {/* circle only — tap marks it checked and it moves to the done section */}
                    </PressableScale>
                    <View style={styles.noteText}>
                      <Text
                        style={[styles.noteHeader, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {note.header || t.notes.headerPlaceholder}
                      </Text>
                      {!!note.body && (
                        <Text
                          style={[styles.noteBody, { color: theme.textMuted }]}
                          numberOfLines={1}
                        >
                          {note.body}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Type-to-add: a title-only quick-create, mirrors Health's add-habit / Plans'
            add-task AddRow (bottom-of-list, hairline divider — no nested "well" box, since
            this card's rows already sit flush per the 2026-07-13 wells-removed pass). */}
        <AddRow
          placeholder={t.notes.addNote}
          value={noteDraft}
          onChangeText={setNoteDraft}
          onSubmit={commitNoteDraft}
          accent={domainColor.accent}
          accessibilityLabel={t.notes.addNote}
          extras={
            <>
              <TextInput
                style={[styles.extraInfoInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                value={extraInfoDraft}
                onChangeText={setExtraInfoDraft}
                placeholder={t.home.extraInfoPlaceholder}
                placeholderTextColor={theme.textMuted}
                onSubmitEditing={commitNoteDraft}
              />
              <PressableScale
                style={[
                  styles.taskChip,
                  { borderColor: addAsTask ? domainColor.accent : theme.border },
                  addAsTask && { backgroundColor: domainColor.soft },
                ]}
                onPress={() => { tap(); setAddAsTask((v) => !v); }}
                hitSlop={8}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityState={{ selected: addAsTask }}
                accessibilityLabel={t.home.addToTaskLabel}
              >
                <Ionicons name="checkbox-outline" size={15} color={addAsTask ? domainColor.accent : theme.textMuted} />
              </PressableScale>
              {addAsTask && <TimeBoxInput value={taskTimeDraft} onChange={setTaskTimeDraft} />}
            </>
          }
        />

        {/* Expand/collapse active notes */}
        {showToggle && (
          <PressableScale
            style={styles.footerBtn}
            onPress={() => { tap(); setExpanded((v) => !v); }}
            scaleTo={0.97}
          >
            <Text style={[styles.footerBtnText, { color: domainColor.accent }]}>
              {expanded ? t.home.notesCollapse : t.home.notesExpand}
            </Text>
          </PressableScale>
        )}

        {/* Checked/done zone — only shown when expanded, mirroring PlanTaskCard done zone */}
        {expanded && checkedNotes.length > 0 && (
          <View style={styles.rowsContainer}>
            <PressableScale
              style={styles.doneHeader}
              onPress={() => { tap(); setCheckedOpen((v) => !v); }}
              scaleTo={0.97}
            >
              <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>
                {t.notes.checkedLabel} ({checkedNotes.length})
              </Text>
              <AnimatedChevron open={checkedOpen} size={14} color={theme.textMuted} />
            </PressableScale>
            {/* Clip-reveal (unveil), not a pop/fade — the checked notes feel folded away, still
                there, matching the Tasks/PlanTaskCard done zones (see Collapsible header). */}
            <Collapsible open={checkedOpen}>
              {checkedNotes.map((note, idx) => (
                <View key={note.id}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                  <View style={styles.noteRow}>
                    <PressableScale
                      style={[styles.check, { borderColor: domainColor.accent, backgroundColor: domainColor.accent }]}
                      onPress={() => handleToggle(note.id)}
                      hitSlop={8}
                      scaleTo={0.97}
                    >
                      <Ionicons name="checkmark" size={12} color={theme.accentInk} />
                    </PressableScale>
                    <View style={styles.noteText}>
                      <Text
                        style={[styles.noteHeader, { color: theme.textMuted, textDecorationLine: 'line-through' }]}
                        numberOfLines={1}
                      >
                        {note.header || t.notes.headerPlaceholder}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Collapsible>
          </View>
        )}
      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Quick-add extras (2026-07-24) — secondary "extra info" input + the "also add as a task"
  // toggle chip (TimeBoxInput, when shown, brings its own sizing).
  extraInfoInput: {
    width: 76,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  taskChip: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Collapsed-only floor so Notes/Plans/Shopping read as the same size regardless of how
  // little content one of them has (e.g. a single note) — see constants/theme.ts.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  // paddingTop Spacing.md (was Spacing.sm) so the header sits VERTICALLY CENTERED in the 64px
  // CardAccentWash band instead of hugging the top edge — matches PlanTaskCard's 2026-07-24 fix
  // for "title too high, not centered between the top border and the wash divider".
  cardContent: { flex: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: Spacing.md },
  // Bleed the wash band past cardContent's padding so it spans the full card width and touches
  // the top (top offset == -paddingTop so the band starts exactly at the card edge).
  headerWash: { top: -Spacing.md, left: -Spacing.md, right: -Spacing.md },
  // marginBottom Spacing.md (was .sm) so the content starts at the 64px wash divider — see the
  // CardAccentWash comment above.
  // paddingLeft (badge offset 16 + badge size 32 + gap 8 = 56) clears the fixed badge
  // (badgeFixed below) — the badge no longer sits inline here, see the edit note above.
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md, gap: Spacing.sm, paddingLeft: 56 },
  titleLeftPressable: { flexShrink: 1 },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // Takes the badge out of flex flow so its position is fixed regardless of sibling content
  // height (e.g. a scaled-up title at large accessibility text sizes) — see edit note above.
  // top/left Spacing.md (not 0) — 0 sat the badge flush in the card's own rounded top-left
  // corner, clipping it against the mask (2026-07-24 bug report: "badge wrongly placed,
  // upper-left corner"). Spacing.md matches cardContent's own padding, so the badge lines up
  // with where normal content starts instead of overlapping the corner.
  badgeFixed: { position: 'absolute', top: Spacing.md, left: Spacing.md, zIndex: 2 },
  // includeFontPadding:false + textAlignVertical:'center' so the title optically centers against
  // the round CardAccentBadge on Android (same font-padding fix as TabSlider/ScreenHeader).
  title: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8, includeFontPadding: false, textAlignVertical: 'center' },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  micButton: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  // Wells removed (2026-07-13 grouping pass): rows sit directly on the card face so the
  // whole section reads as one thing, instead of a flat surfaceMuted box-in-a-box.
  rowsContainer: { marginBottom: Spacing.sm },
  rows: { gap: 0 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.xs, gap: Spacing.sm },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  noteText: { flex: 1 },
  noteHeader: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  noteBody: { fontSize: FontSize.xs, fontFamily: Fonts.regular, marginTop: 1 },
  divider: { height: 1 },
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
