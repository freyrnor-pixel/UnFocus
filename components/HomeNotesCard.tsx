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
 *             components/CardMenuSheet (CardMenuButton — the header "⋮", when Home passes a menu),
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
 *   - **The header "⋮" (2026-08-04, workstream A)**: `cardMenu` is optional and BUILT BY HOME
 *     (app/(tabs)/index.tsx), not here — the rows it carries change `settings.homeCardOrder`
 *     and Home's reorder mode, neither of which this card can reach. No prop, no ⋮; this card
 *     has no card-scoped settings of its own to add to the list.
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
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import PadFooterToggle from '@/components/PadFooterToggle';
import SendToSheet, { SendToTarget } from '@/components/SendToSheet';
import { CardMenuButton, CardMenu } from '@/components/CardMenuSheet';
import CardExpandButton from '@/components/CardExpandButton';
import { useCardExpand } from '@/lib/useCardExpand';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import { Badge } from '@/components/Badge';
import {
  FontSize,
  Fonts,
  HOME_PREVIEW_CARD_MIN_HEIGHT,
  OpticalCenter,
  PAD_GUTTER,
  Radius,
  Spacing,
  rgba,
  HitSlop,
  Type,
} from '@/constants/theme';
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

type Props = {
  /** Home's per-card menu (components/CardMenuSheet.tsx). Omitted → no "⋮" is drawn. */
  cardMenu?: CardMenu;
};

export default function HomeNotesCard({ cardMenu }: Props) {
  const t = useT();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  // Full-screen expansion (2026-08-20) — replaces the title's old push to /notes (see below);
  // `ref` attaches to this card's outer Surface.
  const cardExpand = useCardExpand('homeNotes');
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
  const [noteDraft, setNoteDraft] = useState('');
  const [extraInfoDraft, setExtraInfoDraft] = useState('');
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
    setNoteDraft('');
    setExtraInfoDraft('');
    success();
  }

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

  return (
    <View ref={cardExpand.ref} collapsable={false}>
    <Surface
      surfaceContext="ambient"
      style={[styles.card, state !== 'open' && styles.cardCollapsed]}
    >
      <View style={styles.cardContent}>
        {/* Header. Badge is a normal flex child — one left edge for the whole card. */}
        <View style={styles.header}>
          <PressableScale
            // Full screen replaces the push (2026-08-20) — this used to push to /notes;
            // nothing in the UI pushes there any more (see components/NotesSurface.tsx).
            onPress={cardExpand.onExpand}
            style={styles.headerLeft}
            scaleTo={0.98}
          >
            <CardAccentBadge domain="note" size={32} accentOverride={screenColor.base} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {t.notes.title}
              </Text>
            </View>
          </PressableScale>
          {/* Count pill, not the old grey "{left}/{total} left" sentence (DESIGN_COMPARISON/09):
              a compact digit pair reads at a glance and costs no vertical line. Sits at a FIXED
              x (right of the flexible title column, left of the mic button) rather than inline
              after the title text — a title-adjacent pill would drift left/right with title
              length (worse in Norwegian) and stop lining up with the other three Home cards'
              pills down the screen, which is the one thing worth preserving from the sentence
              layout. Bare digits carry the full sentence as their accessibility label. */}
          {notes.length > 0 ? (
            <Badge
              label={`${leftCount}/${notes.length}`}
              bg={screenColor.soft}
              fg={theme.textMuted}
              borderColor={rgba(screenColor.base, 0.3)}
              tabularNums
              accessibilityLabel={t.pad.summary(leftCount, notes.length)}
            />
          ) : null}
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
          {/* ⤢ LAST (2026-08-20). The app-wide rule the UI-consistency pass settled: whatever a
              card's own controls are, the full-screen button is the right-most thing in the
              header, so it lands in the card's actual top-right corner on every surface. This
              pair used to be the other way round. */}
          {cardMenu ? <CardMenuButton cardTitle={t.notes.title} {...cardMenu} /> : null}
          <CardExpandButton expanded={cardExpand.expanded} onExpand={cardExpand.onExpand} onCollapse={cardExpand.onCollapse} />
        </View>


        <PadSheet
          state={state}
          typeRow={
            <PadTypeRow
              prompt={t.pad.type.note}
              value={noteDraft}
              onChangeText={setNoteDraft}
              onSubmit={commitNoteDraft}
              accent={screenColor.base}
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
                      <TextInput
                        ref={extraInfoLift.ref}
                        style={[
                          styles.extraInfoInput,
                          {
                            // Plain surface fill, matching PadTypeRow's field above it
                            // (2026-08-06, "text-boxes are too grey") — a grey well here would
                            // look like a different, disabled-looking control right under it.
                            backgroundColor: theme.surface,
                            color: theme.text,
                            borderColor: theme.border,
                          },
                        ]}
                        value={extraInfoDraft}
                        onChangeText={setExtraInfoDraft}
                        onFocus={extraInfoLift.onFocus}
                        onBlur={extraInfoLift.onBlur}
                        placeholder={t.home.extraInfoPlaceholder}
                        placeholderTextColor={theme.textMuted}
                        onSubmitEditing={commitNoteDraft}
                      />
                    }
                    accent={screenColor.base}
                  />
                </QuickAddOptionsPanel>
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

      </View>

      <SendToSheet
        visible={sendToId !== null}
        onClose={() => setSendToId(null)}
        onPick={handleSendTo}
      />
    </Surface>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // No vertical margin (2026-08-08): the list that stacks these owns the gap
  // (`SCREEN_GAP`, constants/theme.ts). Was `marginBottom: Spacing.sm`.
  card: { borderRadius: Radius.md },
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
    // the Home shopping card's header gap (2026-07-30, user report: "tips-text too close to color
    // field... in notes it overlaps with color field") — this card's header carries a mic
    // button beside the badge, and content below still read as crowding both at .md.
    marginBottom: Spacing.lg,
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  // OpticalCenter so the title optically centers against the round CardAccentBadge on Android
  // (same font-padding fix as TabSlider/ScreenHeader — see constants/theme.ts for why).
  // ⚠️ **`Type.heading`, not a literal (consistency audit, 2026-08-21).** This was a
  // hardcoded `fontSize: 20, lineHeight: 25`, repeated verbatim in five card files — the
  // exact values `Type.heading` already holds (20 × 1.25), so this is a substitution with
  // no visual change. A literal here is invisible to the type scale and to the design lab's
  // font pass alike, and it is why the app shipped card titles at 17, 20 and 24 with three
  // different ways of spelling 20. See CONSISTENCY_AUDIT.md §2.
  title: {
    fontSize: Type.heading.size,
    lineHeight: Type.heading.size * Type.heading.line,
    fontFamily: Type.heading.fontFamily,
    ...OpticalCenter,
  },
  micButton: {
    width: 28,
    height: 28,
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
  extraInfoInput: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  doneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
