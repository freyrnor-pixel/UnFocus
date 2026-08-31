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
 *     cost two taps (expand, then focus) and sat after the list like chrome.
 *   - **The type line is a real bordered FIELD, and its options are a labelled panel
 *     (2026-08-05).** It used to be a bare borderless line sharing one 44px row with a fixed
 *     76px "Details…" box, a ghost check and two buttons — so focused-and-empty rendered as a
 *     caret with no field around it and no room to grow one. Details moved down onto its own
 *     labelled row (`panel`, the same shape Habits and To-do already used), which is also what
 *     freed the width. See PadTypeRow's header.
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
 *             components/QuickAddOptionsPanel + components/QuickAddOptionRow (the Details row
 *             on the quick-add's labelled panel),
 *             components/PadFooterToggle, components/SendToSheet, components/Surface,
 *             components/PressableScale, components/CardAccent (CardAccentBadge), components/Badge,
 *             components/Collapsible + components/AnimatedChevron (checked-zone reveal),
 *             constants/theme, lib/haptics, lib/i18n, lib/date (todayStr), lib/useAppTheme,
 *             lib/screenColor, lib/padState, lib/useCardState, lib/prefill (prefillRoute),
 *             lib/useVoiceCapture, lib/useKeyboardLift, store/useNotesStore
 *   Used by → app/(tabs)/index.tsx (the Notes preview slot)
 *   Data    → reads/writes useNotesStore (notes table): toggleChecked, add, update. Card size
 *             persists to settings.cardStates via lib/useCardState.
 *
 * Edit notes:
 *   - **Count pill, not a summary sentence (2026-08-04, DESIGN_COMPARISON/09).** The old
 *     grey "{left}/{total} left" second line under the title is gone; a `components/Badge`
 *     pill (the card's screenColor `soft` fill, plain `theme.textMuted` ink — never the hue
 *     itself as text, same rule lib/domainColor.ts's A.4 used to state) sits at the header's
 *     fixed right slot instead, holding just the digits. It's a header-row sibling, not inline after the title
 *     text, specifically so it stays at the same x regardless of title length/language and
 *     keeps lining up with the other three Home cards' pills — an inline placement would drift
 *     with a long Norwegian title and lose that.
 *   - **Send-to ticks the note off.** Picking a target navigates there with the text prefilled
 *     (lib/prefill.ts) AND checks the note: it has been dealt with, so the pad clears itself as
 *     things are routed out of it. That was the maintainer's explicit choice over leaving it
 *     unticked — don't quietly drop the tick when editing this.
 *   - Existing rows stay read-only previews (no inline TextInput). Editing a note is
 *     app/notes.tsx's job; the type line here only CREATES.
 *   - `visibleNotes` is what the pad actually draws — pass that, never the full list, anywhere
 *     that asks "what is on screen" (the same rule lib/viewSnapshot's glow ids follow).
 *   - The pill's count is computed from the FULL list, never from what's visible: folding the
 *     card away must not quietly tell the user they have less to do.
 *   - A note's check takes PadRow's default accessible name — the note's own title. It briefly
 *     passed `t.notes.checkedLabel` instead, which gave every check on the card the identical
 *     name ("Checked off"), so a screen reader couldn't tell which note it would tick.
 *   - **Quick-add extras (2026-07-24, narrowed 2026-08-01)**: notes have no fields beyond
 *     header/body/checked, so the only extra is a "details" field (→ `body`). The "also add as
 *     a task" chip + companion TimeBoxInput are gone — that capability already exists from the
 *     full Notes screen via each row's own "Send it to… → To-do" (SendToSheet), so keeping a
 *     second copy of it inline here was redundant.
 *   - **`onMore` / "…" (2026-08-01)**: commits the same draft as the checkmark, then navigates
 *     to `/notes`. Unlike Habits/To-do there's nothing further to pre-fill — a note's header and
 *     body are both already editable per-row on that screen — so this is just "take me to it".
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
import PressableScale from '@/components/PressableScale';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import DraftComposer from '@/components/DraftComposer';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import { Input } from '@/components/FormControls';
import Card from '@/components/Card';
import PadFooterToggle from '@/components/PadFooterToggle';
import SendToSheet, { SendToTarget } from '@/components/SendToSheet';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import { Fonts, FontSize, HitSlop, IconSize, Radius, rgba, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { isDoneRowStillInPlace, padVisibleRows } from '@/lib/padState';
import { useCardState } from '@/lib/useCardState';
import { prefillRoute } from '@/lib/prefill';
import { useNotesStore } from '@/store/useNotesStore';
import { getScreenColor } from '@/lib/screenColor';
import { useVoiceCapture } from '@/lib/useVoiceCapture';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

/**
 * The card's quick-add, as its own component — and the SPLIT is the point, not the tidiness
 * (2026-08-28, perf).
 *
 * `noteDraft` and `extraInfoDraft` used to be `useState` in `HomeNotesCard` itself, which
 * renders the whole card: the rail, the count, the mic, every visible `PadRow`, the done
 * drawer and the send-to sheet. React re-renders from where the state lives downward, so
 * **every keystroke re-rendered all of that** — and since nothing in the card tree is
 * memoised, each pass re-ran `Surface`'s work for the card and every row inside it. That is
 * the "typing lags" report, and it is a property of where the `useState` sits rather than of
 * anything being slow.
 *
 * Now a character typed re-renders this component and nothing else. The parent is handed the
 * two finished strings on submit, which is all it ever wanted them for.
 *
 * ⚠️ **This is the shape `components/TodoSurface.tsx`'s `InlineTaskAdd` has always had** — the
 * codebase's own pattern, applied to a card that predates it, not a new idea. Keep a
 * composer's draft inside the composer; a surface that renders a list must not hold the text
 * of the field at the bottom of it.
 */
function NotesComposer({ accent, onCommit, voice }: {
  accent: string;
  onCommit: (header: string, body: string) => void;
  /**
   * The voice-capture control, built by the card (it owns the recogniser state) and drawn here.
   *
   * ⚠️ **It moved out of the card HEADER on 2026-08-31.** The ruling on the corrected screens'
   * "control cluster drifted" finding was *two icons plus at most one card-specific control*,
   * and this card's header carried two — the mic and the ⋮. The ⋮ stays because it is Home's
   * only way to put a card away (the Manage cards sheet is the four non-Home tabs' answer, and
   * Home is deliberately not one of its callers), so the mic is the one that moves. The mockup
   * names the same destination: *"voice capture lives in the note composer"*.
   *   A labelled `QuickAddOptionRow` rather than a glyph wedged into the field, because that is
   * what tier 2 IS on this app's composers — and dictating a note is a way of FILLING the field,
   * so it belongs beside the field's other option rather than inside it.
   */
  voice?: React.ReactNode;
}) {
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  // ⚠️ **Only the BODY lives here; the title lives in DraftComposer.** This card is the one
  // caller with a second field, and the split is the same rule as everywhere else: the title
  // changes on every keystroke and is the hot one, so it goes in the shared composer, while
  // this field is built into the `panel` node the composer receives. Typing a BODY re-renders
  // this small component (which is fine — it draws one field), typing a TITLE re-renders only
  // DraftComposer.
  const [extraInfoDraft, setExtraInfoDraft] = useState('');
  // PadTypeRow's own keyboard-lift only fires for ITS primary field's focus/blur (see that
  // component's ScrollIntoViewContext wiring) — this extras field needs its own, or focusing
  // it while the row sits low in the card leaves it hidden behind the keyboard.
  const extraInfoLift = useKeyboardLift<TextInput>();

  function commit(header: string) {
    onCommit(header, extraInfoDraft.trim());
    setExtraInfoDraft('');
  }

  return (
    <DraftComposer
      prompt={t.pad.type.note}
      onSubmit={commit}
      accent={accent}
      // The labelled panel, not the inline `extras` row (2026-08-05). Details used to
      // be a bare 76px-wide box sharing one 44px line with the title input, the ghost
      // check and two buttons — which is most of why the title input had no room to
      // look like a field at all. On its own labelled row it gets the full width, the
      // title input gets the whole line above it, and this card's quick-add finally
      // matches Habits' and To-do's. Nothing about a note changed: still a header and
      // a body, still committed by the same onSubmit.
      panel={
        <QuickAddOptionsPanel>
          <QuickAddOptionRow
            icon="document-text-outline"
            label={t.home.extraInfoLabel}
            value={
              /* ⚠️ **The shared `Input` (2026-08-21, CONSISTENCY_AUDIT.md §1).** This
                 was a hand-rolled bordered box that had been tuned twice to LOOK like
                 the shared field — a plain surface fill "matching PadTypeRow's field
                 above it", a 1px border, `Radius.sm` — which is the whole mechanism
                 that section is about: every hand-rolled field is somebody carefully
                 reproducing the real one, and the copies drift the moment the original
                 moves. components/HealthSurface.tsx already mounts `Input` in this
                 exact slot (a QuickAddOptionRow's `value`), so this is converging on a
                 sibling rather than on a theory. */
              <Input
                ref={extraInfoLift.ref}
                style={styles.extraInfoInput}
                value={extraInfoDraft}
                onChangeText={setExtraInfoDraft}
                onFocus={extraInfoLift.onFocus}
                onBlur={extraInfoLift.onBlur}
                placeholder={t.home.extraInfoPlaceholder}
                // No onSubmitEditing: the title is the required field and it lives in
                // DraftComposer, so this field cannot commit on its own without reaching for
                // a title it does not hold. Submitting from the title line still takes the
                // body along, which is the path that was always used.
              />
            }
            accent={accent}
          />
          {voice ? (
            <QuickAddOptionRow
              icon="mic-outline"
              label={t.notes.recordVoiceNote}
              value={voice}
              accent={accent}
            />
          ) : null}
        </QuickAddOptionsPanel>
      }
    />
  );
}

export default function HomeNotesCard() {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  // Full-screen expansion (2026-08-20) — replaces the title's old push to /notes (see below);
  // `ref` attaches to this card's outer Surface.
  // The card's one hue (border + every content accent). This used to be lib/domainColor's
  // 'note' identity — IDENTITY_NEUTRAL grey, since Notes carries no badge identity hue — while
  // the card's border (below) is the screen's own yellow, so the badge pill/mic button/row
  // checks all drew grey against a yellow edge. Content now pulls from the same screenColor.
  const screenColor = getScreenColor(theme, 'notes');
  const today = todayStr();

  const notes = useNotesStore((s) => s.notes);
  const toggleChecked = useNotesStore((s) => s.toggleChecked);
  const addNote = useNotesStore((s) => s.add);
  const updateNote = useNotesStore((s) => s.update);

  const [state, setState] = useCardState('notes');
  const [checkedOpen, setCheckedOpen] = useState(false);
  const [sendToId, setSendToId] = useState<string | null>(null);

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

  // Takes the two strings from the composer rather than reading state of its own — see
  // NotesComposer's own note for why the draft does not live up here any more.
  const commitNote = React.useCallback((header: string, body: string) => {
    const note = addNote();
    updateNote(note.id, body ? { header, body } : { header });
    success();
  }, [addNote, updateNote]);

  /**
   * There is deliberately NO "More options" button on this card (2026-08-05).
   *
   * There used to be a "…" that committed the draft and pushed /notes. It opened with
   * `if (!noteDraft.trim()) return;` while `PadTypeRow` shows the button from the moment the
   * line is FOCUSED — so on an empty line it animated the press and did nothing, which is the
   * user report that started this pass ("The three dots don't do anything").
   *
   * It is not being fixed here, it is being removed, because a note has nothing left to open:
   * a note IS a header and a body, and both are on this quick-add now (the body via the
   * Details row in the panel below). Unlike a habit or a task there is no editor screen to
   * reach — /notes edits its rows in place through NoteRow's `titleInput` — so a "more" button
   * here would only ever navigate somewhere showing the same two fields. The card's own title
   * is already a link to /notes for that. See PadTypeRow's `onMore` note: pass no handler
   * rather than one that can no-op.
   */

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

  // ⚠️ **Built here, drawn in the composer (2026-08-31).** The card owns the recogniser state,
  // so the control is constructed here — but it is no longer a header control; see
  // NotesComposer's `voice` prop for the ruling that moved it.
  const voiceButton = (
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
                  backgroundColor: listening ? theme.badSoft : screenColor.soft,
                  borderColor: rgba(listening ? theme.bad : screenColor.base, 0.4),
                },
              ]}
            >
              {/* A.4 rule 1: the identity hue stays on the plate + rim (a fill); the glyph is
                  the action colour, or the `bad` status token while recording. */}
              <Ionicons
                name={listening ? 'stop' : 'mic'}
                size={15}
                color={listening ? theme.bad : theme.accent}
              />
            </View>
          </PressableScale>
  );

  return (
    <>
    <Card
      id="homeNotes"
      count={notes.length > 0 ? { left: leftCount, total: notes.length } : undefined}
      peek={t.peek.homeNotes(notes.length)}
    >
        <PadSheet
          state={state}
          typeRow={<NotesComposer accent={screenColor.base} onCommit={commitNote} voice={voiceButton} />}
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
                  <AnimatedChevron open={checkedOpen} />
                </PressableScale>
                {/* Clip-reveal, not a fade: folded away, still there. */}
                <Collapsible open={checkedOpen}>
                  {sunkNotes.map((note) => (
                    <PadRow
                      key={note.id}
                      title={note.header || t.notes.headerPlaceholder}
                      accent={screenColor.base}
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
              accent={screenColor.base}
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
    </Card>

      {/* A SIBLING of the card, not a child: a sheet inside a folding card would be clipped
          away with the card's body. */}
      <SendToSheet
        visible={sendToId !== null}
        onClose={() => setSendToId(null)}
        onPick={handleSendTo}
      />
    </>
  );
}

// ⚠️ **The card's own shell styles are gone (2026-08-21).** `card`, `cardCollapsed`,
// `cardContent`, `header`, `headerLeft`, `headerText` and `title` all described a hand-rolled
// card header; components/Card.tsx draws it now. `cardCollapsed`'s
// `HOME_PREVIEW_CARD_MIN_HEIGHT` floor went with them and is not coming back on this card: it
// existed so the four Me cards read as one size at rest, and at rest a card is now a bare
// header, which is already one size.
const baseStyles = StyleSheet.create({






  micButton: {
    // `IconSize.action` (2026-08-21). This sits in the same
    // header cluster as that ⋯ and the ⤢, and was the third diameter in a row of three controls.
    width: IconSize.action,
    height: IconSize.action,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  noteBody: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.regular },
  // Quick-add extras (2026-07-24, "also add as a task" chip removed 2026-08-01) — the
  // "details" field (→ body).
  // The Details field, now the `value` of its own labelled panel row (2026-08-05). It was a
  // fixed `width: 76` because it shared one 44px line with the title input and two buttons;
  // on its own row it takes the width the row gives it, with a floor so a one-word label
  // can't squeeze it back to nothing. Bordered like every other field in the app now — see
  // components/PadTypeRow.tsx's header.
  // Layout only now (2026-08-21) — the FILL, the border, the radius and the focus ring belong
  // to components/FormControls.tsx's `Input`. What survives is the one thing that is about this
  // row rather than about fields: it has to take the width the QuickAddOptionRow gives it, with
  // a floor so a one-word label can't squeeze it back to nothing.
  extraInfoInput: { flex: 1, minWidth: 0 },
  doneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
