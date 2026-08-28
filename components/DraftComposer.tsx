/**
 * DraftComposer.tsx — a `PadTypeRow` that owns the text you are typing into it.
 *
 * **Why this exists is a performance property, not a tidiness one (2026-08-28).** Every surface
 * that mounts a `PadTypeRow` has to hold a `value`/`onChangeText` pair somewhere, and five of
 * them held it in the component that draws the whole surface — `PlanTaskCard` (~2 000 lines of
 * timeline, rows, day log and followers), `HabitsSurface`, `HealthSurface`, `HomeShoppingCard`,
 * `HomeNotesCard`. React re-renders from where state lives downward, and nothing in those trees
 * is memoised, so **one character typed re-rendered the entire card stack**, each pass re-running
 * `components/Surface.tsx`'s work for every card in it. Measured (CDP profiler, JS busy time per
 * ten keystrokes, median of three): Home's "I dag" card **57ms → 18ms**, the Habits card
 * **64ms → 15ms**. That is the "typing lags" report, and it was a property of where the
 * `useState` sat rather than of anything being slow.
 *
 * Putting the text here means a keystroke re-renders this component and nothing else.
 *
 * ⚠️ **Only the TEXT belongs here — do not move a caller's option state in.** The energy
 * stepper, the target, the remind toggle, the recurrence draft, the task-vs-moment switch: those
 * change on a TAP, not on a character, so they are not what makes typing expensive, and the
 * caller's commit handler reads them. They arrive as the already-built `panel`/`extras` NODE, so
 * when a keystroke re-renders this component the caller has NOT re-rendered — `panel` is the same
 * element reference and React bails out of that whole subtree. **Splitting on "what changes per
 * keystroke" is the point; splitting on "what belongs to the composer" would drag the option
 * state down here and be slower.**
 *
 * This is the shape `components/TodoSurface.tsx`'s `InlineTaskAdd` has always had, and
 * `components/InlineAddItem.tsx` too — both own their own drafts. This is that pattern named
 * once instead of copied per surface; it was three near-identical local wrappers before the
 * fourth and fifth callers made it worth a file.
 *
 * Connections:
 *   Imports → components/PadTypeRow
 *   Used by → components/PlanTaskCard (the day card's type line), components/HabitsSurface,
 *             components/HealthSurface, components/HomeShoppingCard, components/HomeNotesCard
 *             (its title — that card keeps its own second field, the Details body, and builds
 *             the panel around it)
 *   Data    → none; it holds one string and hands it to the caller on submit
 *
 * Edit notes:
 *   - **`onSubmit` fires only for a non-empty trimmed value; `onMore` fires for ANY press,
 *     including an empty line.** That asymmetry is deliberate and load-bearing — see
 *     `PlanTaskCard`'s `commitAddAndEdit` (2026-08-05): "…" is shown from the moment the line is
 *     FOCUSED, so guarding it on text meant a button that visibly animated and did nothing,
 *     which is the user report that pass came from. Don't "tidy" the two into one guard.
 *   - The field clears after a committed submit, and after `onMore` unless `clearOnMore` is
 *     false. Callers that push to an editor generally want the clear (the draft has been handed
 *     on); a caller that opens something non-destructive may not.
 *   - `prefill` seeds the field once, for text arriving from a note's ⋯ → Send it to…
 *     (lib/prefill.ts). The SURFACE reads the prefill slot — one slot, one consumer — and passes
 *     the string down, because the field it seeds lives here.
 *   - No `React.memo`. `panel` is fresh JSX whenever the caller re-renders, so a memo would
 *     never hit; what makes this fast is that the caller *doesn't* re-render on a keystroke.
 */
import React, { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import PadTypeRow from '@/components/PadTypeRow';

type Props = {
  /** The grey prompt, worded for this card: "Type note" / "Type task" / … */
  prompt: string;
  /** This CARD's categorical colour — see PadTypeRow's own note on why it is a prop. */
  accent: string;
  /** The labelled options panel, built by the caller from the caller's own option state. */
  panel?: React.ReactNode;
  /** The older inline-chips slot. A caller passes this or `panel`, never both. */
  extras?: React.ReactNode;
  noGhostCheck?: boolean;
  disabled?: boolean;
  moreLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Text arriving from lib/prefill.ts, read and consumed by the surface. */
  prefill?: string | null;
  /** Fires with the trimmed text, only when it is non-empty. The field then clears. */
  onSubmit: (text: string) => void;
  /** Fires with the trimmed text on ANY press — an empty line included. See the edit notes. */
  onMore?: (text: string) => void;
  /** Whether a press of "…" clears the field. Default true. */
  clearOnMore?: boolean;
};

export default function DraftComposer({
  prompt,
  accent,
  panel,
  extras,
  noGhostCheck,
  disabled,
  moreLabel,
  style,
  prefill,
  onSubmit,
  onMore,
  clearOnMore = true,
}: Props) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (prefill) setDraft(prefill);
  }, [prefill]);

  return (
    <PadTypeRow
      prompt={prompt}
      value={draft}
      onChangeText={setDraft}
      onSubmit={() => {
        const text = draft.trim();
        if (!text) return;
        onSubmit(text);
        setDraft('');
      }}
      accent={accent}
      onMore={
        onMore
          ? () => {
              // Deliberately NOT guarded on an empty line — see the edit notes.
              onMore(draft.trim());
              if (clearOnMore) setDraft('');
            }
          : undefined
      }
      moreLabel={moreLabel}
      extras={extras}
      panel={panel}
      noGhostCheck={noGhostCheck}
      disabled={disabled}
      style={style}
    />
  );
}
