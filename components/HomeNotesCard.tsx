/**
 * HomeNotesCard.tsx — Home's notes pad (useNotesStore), and the reference implementation of
 * the pad language every other list-bearing card follows.
 *
 * A ruled sheet (components/PadSheet.tsx): a "Type note" line on the first rule, one
 * components/PadRow.tsx per note under it, two blank rules at the end, and one chevron
 * cycling the card's three sizes (closed → preview → open, lib/padState.ts). Each row carries
 * a ⋯ that sends the note somewhere else (components/SendToSheet.tsx) and a check circle in
 * the right margin.
 *
 * Rebuilt 2026-07-30 from a hand-rolled row list + a bottom "+ Add a note" AddRow bar. What
 * changed and why, since each was a specific complaint:
 *   - **Ruled lines instead of between-row dividers.** Rules now sit under every row and the
 *     type line, and two spare ones follow, so a light card still reads as a page rather than
 *     as a card that ran out of content ("look like notepads").
 *   - **Type line moved to the TOP and is always open.** The old collapsed "+ Add a note" bar
 *     cost two taps (expand, then focus) and sat after the list like chrome. Its prompt clears
 *     on FOCUS, not on the first keystroke — see PadTypeRow's header for why that needs a
 *     custom layer.
 *   - **Check moved to the right margin, ⋯ beside it.** App-wide row-rule change; see
 *     AGENTS.md. It also freed the left edge, which is what lets the rules run the full line.
 *   - **A ticked note stays put.** It strikes through and fades where it is for the rest of
 *     the day (`checkedAt`, lib/padState's isDoneRowStillInPlace) and only sinks into the
 *     "Checked off" zone tomorrow. It used to vanish from under your finger the instant you
 *     tapped, with no way to see that the tap had landed.
 *   - **One left edge.** The badge is inline in the header again; the old absolutely-pinned
 *     `badgeFixed` + `paddingLeft: 52` pair is gone, along with the react-native-web
 *     padding-inheritance trap it came with (see the note at the end of Edit notes).
 *
 * Connections:
 *   Imports → components/PadSheet, components/PadRow, components/PadTypeRow,
 *             components/PadFooterToggle, components/SendToSheet, components/Surface,
 *             components/PressableScale, components/CardAccent (CardAccentBadge),
 *             components/Collapsible + components/AnimatedChevron (checked-zone reveal),
 *             components/TimeBoxInput (quick-add's companion-task time field),
 *             constants/theme, lib/haptics, lib/i18n, lib/date (todayStr), lib/useAppTheme,
 *             lib/domainColor, lib/padState, lib/useCardState, lib/prefill (prefillRoute),
 *             lib/useVoiceCapture, lib/useKeyboardLift, store/useNotesStore, store/useTaskStore (quick-add's
 *             optional companion task only)
 *   Used by → app/(tabs)/index.tsx (the Notes preview slot)
 *   Data    → reads/writes useNotesStore (notes table): toggleChecked, add, update; quick-add's
 *             "also add as a task" toggle additionally writes useTaskStore (tasks table): add.
 *             Card size persists to settings.cardStates via lib/useCardState.
 *
 * Edit notes:
 *   - **Send-to ticks the note off.** Picking a target navigates there with the text prefilled
 *     (lib/prefill.ts) AND checks the note: it has been dealt with, so the pad clears itself as
 *     things are routed out of it. That was the maintainer's explicit choice over leaving it
 *     unticked — don't quietly drop the tick when editing this.
 *   - Existing rows stay read-only previews (no inline TextInput). Editing a note is
 *     app/notes.tsx's job; the type line here only CREATES.
 *   - `visibleNotes` is what the pad actually draws — pass that, never the full list, anywhere
 *     that asks "what is on screen" (the same rule lib/viewSnapshot's glow ids follow).
 *   - The summary count is computed from the FULL list, never from what's visible: folding the
 *     card away must not quietly tell the user they have less to do.
 *   - A note's check takes PadRow's default accessible name — the note's own title. It briefly
 *     passed `t.notes.checkedLabel` instead, which gave every check on the card the identical
 *     name ("Checked off"), so a screen reader couldn't tell which note it would tick.
 *   - Quick-add extras (2026-07-24, preserved through the rebuild): notes have no fields beyond
 *     header/body/checked, so the extras carry the three things that matter for a note captured
 *     in passing — a "details" field (→ `body`), an "also add as a task" chip, and (only while
 *     that's on) a TimeBoxInput for the companion task's start time. The companion task is a
 *     plain independent useTaskStore.add() — there's no noteId/taskId link column, so this is
 *     "also create a task with this title", not a synced pointer.
 *   - **Historical trap, now avoided rather than worked around**: the badge used to be
 *     absolutely positioned, which meant its origin inherited the parent's padding on native
 *     but NOT on react-native-web (which compiles to CSS, where the containing block is the
 *     padding edge). Testing that offset in the web preview was actively misleading. The badge
 *     is a normal flex child now, so there is no padding-inheritance question to get wrong —
 *     don't reintroduce an absolutely-positioned badge. Nothing on this card is absolutely
 *     positioned any more: the header wash went with it (2026-07-31, addendum A.4 rule 3 — one
 *     idea, one channel; the badge and the card's own edge already carry the hue twice).
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge } from '@/components/CardAccent';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import PadFooterToggle from '@/components/PadFooterToggle';
import CardHintNote from '@/components/CardHintNote';
import SendToSheet, { SendToTarget } from '@/components/SendToSheet';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import TimeBoxInput from '@/components/TimeBoxInput';
import {
  FontSize,
  Fonts,
  HOME_PREVIEW_CARD_MIN_HEIGHT,
  PAD_GUTTER,
  Radius,
  Spacing,
  TabularNums,
  rgba,
  HitSlop,
} from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { isDoneRowStillInPlace, padVisibleRows } from '@/lib/padState';
import { useCardState } from '@/lib/useCardState';
import { prefillRoute } from '@/lib/prefill';
import { useNotesStore } from '@/store/useNotesStore';
import { useTaskStore } from '@/store/useTaskStore';
import { getDomainColor } from '@/lib/domainColor';
import { useVoiceCapture } from '@/lib/useVoiceCapture';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

export default function HomeNotesCard() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const domainColor = getDomainColor(theme, 'note');
  const today = todayStr();

  const notes = useNotesStore((s) => s.notes);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);
  const addNote = useNotesStore((s) => s.add);
  const updateNote = useNotesStore((s) => s.update);
  const addTask = useTaskStore((s) => s.add);

  const [state, setState] = useCardState('notes');
  const [checkedOpen, setCheckedOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [extraInfoDraft, setExtraInfoDraft] = useState('');
  const [addAsTask, setAddAsTask] = useState(false);
  const [taskTimeDraft, setTaskTimeDraft] = useState('');
  const [sendToId, setSendToId] = useState<string | null>(null);
  // PadTypeRow's own keyboard-lift only fires for ITS primary field's focus/blur (see that
  // component's ScrollIntoViewContext wiring) — this extras field needs its own, or focusing
  // it while the row sits low in the card leaves it hidden behind the keyboard.
  const extraInfoLift = useKeyboardLift<TextInput>();

  const { listening, toggle: toggleVoiceCapture } = useVoiceCapture((text) => {
    const note = addNote();
    updateNote(note.id, { body: text });
    success();
  });

  // On the pad: everything unticked, plus anything ticked TODAY (struck through, in place —
  // a tick shouldn't make a row disappear from under your finger). Sunk: ticked earlier.
  const { padNotes, sunkNotes } = useMemo(() => {
    const pad = notes.filter((n) => !n.checked || isDoneRowStillInPlace(n.checkedAt, today));
    const sunk = notes.filter((n) => n.checked && !isDoneRowStillInPlace(n.checkedAt, today));
    return { padNotes: pad, sunkNotes: sunk };
  }, [notes, today]);

  const visibleNotes = padVisibleRows(padNotes, state);
  // From the FULL list, never from what's on screen — see the edit note.
  const leftCount = notes.filter((n) => !n.checked).length;

  function commitNoteDraft() {
    const trimmed = noteDraft.trim();
    if (!trimmed) return;
    const note = addNote();
    const body = extraInfoDraft.trim();
    updateNote(note.id, body ? { header: trimmed, body } : { header: trimmed });
    if (addAsTask) {
      addTask({
        title: trimmed,
        date: today,
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

  function handleToggle(id: string) {
    tap();
    toggleChecked(id);
  }

  // Send it elsewhere: navigate with the text prefilled AND tick the note — it's been dealt
  // with, so the pad clears itself as things are routed out of it.
  function handleSendTo(target: SendToTarget) {
    const note = notes.find((n) => n.id === sendToId);
    setSendToId(null);
    if (!note) return;
    const text = note.header.trim() || note.body.trim();
    if (!note.checked) toggleChecked(note.id);
    router.push(prefillRoute(target, text));
  }

  return (
    <Surface
      surfaceContext="ambient"
      borderColor={domainColor.accent}
      style={[styles.card, state !== 'open' && styles.cardCollapsed]}
    >
      <View style={styles.cardContent}>
        {/* Header. Badge is a normal flex child — one left edge for the whole card. */}
        <View style={styles.header}>
          <PressableScale
            onPress={() => router.push('/notes')}
            style={styles.headerLeft}
            scaleTo={0.98}
          >
            <CardAccentBadge domain="note" size={32} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {t.notes.title}
              </Text>
              {notes.length > 0 ? (
                <Text style={[styles.summary, { color: theme.textMuted }]}>
                  {t.pad.summary(leftCount, notes.length)}
                </Text>
              ) : null}
            </View>
          </PressableScale>
          <PressableScale
            onPress={toggleVoiceCapture}
            hitSlop={HitSlop.base}
            accessibilityRole="button"
            accessibilityLabel={listening ? t.notes.stopRecording : t.notes.recordVoiceNote}
            scaleTo={0.9}
          >
            <View
              style={[
                styles.micButton,
                {
                  backgroundColor: listening ? theme.badSoft : domainColor.soft,
                  borderColor: rgba(listening ? theme.bad : domainColor.accent, 0.4),
                },
              ]}
            >
              {/* A.4 rule 1: the identity hue stays on the plate + rim (a fill); the glyph is
                  the action colour, or the `bad` status token while recording. Notes' identity
                  is IDENTITY_NEUTRAL grey since A.3, which made a live control read as
                  disabled when the glyph took it. */}
              <Ionicons
                name={listening ? 'stop' : 'mic'}
                size={15}
                color={listening ? theme.bad : theme.accent}
              />
            </View>
          </PressableScale>
        </View>

        <PadSheet
          state={state}
          typeRow={
            <PadTypeRow
              prompt={t.pad.type.note}
              value={noteDraft}
              onChangeText={setNoteDraft}
              onSubmit={commitNoteDraft}
              accent={domainColor.accent}
              extras={
                <>
                  <TextInput
                    ref={extraInfoLift.ref}
                    style={[
                      styles.extraInfoInput,
                      { backgroundColor: theme.surfaceMuted, color: theme.text },
                    ]}
                    value={extraInfoDraft}
                    onChangeText={setExtraInfoDraft}
                    onFocus={extraInfoLift.onFocus}
                    onBlur={extraInfoLift.onBlur}
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
                    onPress={() => {
                      tap();
                      setAddAsTask((v) => !v);
                    }}
                    hitSlop={HitSlop.base}
                    scaleTo={0.9}
                    accessibilityRole="button"
                    accessibilityState={{ selected: addAsTask }}
                    accessibilityLabel={t.home.addToTaskLabel}
                  >
                    <Ionicons
                      name="checkbox-outline"
                      size={15}
                      color={addAsTask ? theme.accent : theme.textMuted}
                    />
                  </PressableScale>
                  {addAsTask && <TimeBoxInput value={taskTimeDraft} onChange={setTaskTimeDraft} />}
                </>
              }
            />
          }
          footer={
            sunkNotes.length > 0 ? (
              <View>
                <PressableScale
                  style={styles.doneHeader}
                  onPress={() => {
                    tap();
                    setCheckedOpen((v) => !v);
                  }}
                  scaleTo={0.97}
                >
                  <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>
                    {t.notes.checkedLabel} ({sunkNotes.length})
                  </Text>
                  <AnimatedChevron open={checkedOpen} size={14} color={theme.textMuted} />
                </PressableScale>
                {/* Clip-reveal, not a fade: folded away, still there. */}
                <Collapsible open={checkedOpen}>
                  {sunkNotes.map((note) => (
                    <PadRow
                      key={note.id}
                      title={note.header || t.notes.headerPlaceholder}
                      accent={domainColor.accent}
                      done
                      onToggle={() => handleToggle(note.id)}
                    />
                  ))}
                </Collapsible>
              </View>
            ) : null
          }
        >
          {visibleNotes.map((note) => (
            <PadRow
              key={note.id}
              title={note.header || t.notes.headerPlaceholder}
              accent={domainColor.accent}
              done={note.checked}
              meta={
                note.body ? (
                  <Text style={[styles.noteBody, { color: theme.textMuted }]} numberOfLines={1}>
                    {note.body}
                  </Text>
                ) : undefined
              }
              onAction={() => {
                tap();
                setSendToId(note.id);
              }}
              actionLabel={t.sendTo.title}
              onToggle={() => handleToggle(note.id)}
            />
          ))}
        </PadSheet>

        <PadFooterToggle
          state={state}
          onChange={setState}
          total={padNotes.length}
        />

        {/* Explainer at the FOOT (2026-07-30) — it used to sit between the header and the
            first rule, where it crowded the mic button and pushed the type line down. */}
        {notes.length === 0 ? <CardHintNote text={t.starters.notes.text} noBorder /> : null}
      </View>

      <SendToSheet
        visible={sendToId !== null}
        onClose={() => setSendToId(null)}
        onPick={handleSendTo}
      />
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Minimum height for the CLOSED and PREVIEW states, never for OPEN (maintainer's call,
  // 2026-07-30): the four cards read as one intentional size at rest, and an open card is free
  // to grow to whatever its content needs. Same constant, and the same "only while not fully
  // open" gate, the pre-pad card used — `state !== 'open'` is what `!expanded` used to mean.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  // ONE horizontal inset for the whole card (PAD_GUTTER). The old paddingLeft:52 title inset
  // that dodged an absolutely-pinned badge is gone with the badge.
  cardContent: { paddingHorizontal: PAD_GUTTER, paddingTop: PAD_GUTTER, paddingBottom: PAD_GUTTER },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    // Spacing.lg (was .md, was .sm before that), matching HomeHabitsCard/PlanTaskCard/
    // HomeShoppingCard's header gap (2026-07-30, user report: "tips-text too close to color
    // field... in notes it overlaps with color field") — this card's header carries a mic
    // button beside the badge, and content below still read as crowding both at .md.
    marginBottom: Spacing.lg,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  // includeFontPadding:false + textAlignVertical:'center' so the title optically centers against
  // the round CardAccentBadge on Android (same font-padding fix as TabSlider/ScreenHeader).
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: Fonts.bold,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // Tabular figures so the four Home cards' counts line up down the screen.
  summary: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, ...TabularNums },
  micButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  noteBody: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.regular },
  // Quick-add extras (2026-07-24) — the "details" field and the "also add as a task" chip.
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
  doneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
