/**
 * goals-editor.tsx — the Goals editor as a centre pop-up.
 *
 * ⚠️ **Why this route exists (2026-09-01).** Goals used to be edited in a `SectionCard` folded
 * inside two different cards — To-do's Today card ("Practical goals") and the Habits card
 * ("Personal goals") — which were the same `components/GoalsEditor.tsx` over the same store
 * under two labels, in two places, on two tabs. Maintainer: *"Goal editing is done by an 'Edit
 * Goals' button that appears at the bottom of the drop-down-menu when user presses 'Goal' in
 * card."* So the two sections are gone and the way in is the goal picker itself — which is where
 * you already are when you discover you need a goal that does not exist yet.
 *
 * A pop-up rather than a pushed screen because a card never navigates away (2026-08-20), and a
 * route rather than a sheet so both pickers can reach it with one line and no shared state.
 * `app/goals.tsx` was deleted on 2026-08-12 for being a second implementation of the editor;
 * this is not that — it mounts the same component, and is the only way in.
 *
 * Connections:
 *   Imports → components/CenterModalScreen, components/GoalsEditor, lib/i18n, lib/screenColor,
 *             lib/useAppTheme
 *   Used by → Expo Router route "/goals-editor", opened from the "Edit goals" row at the foot of
 *             components/GoalPicker.tsx's dropdown and components/GoalQuickCell.tsx's picker.
 *             Listed in CENTRE_MODAL_ROUTES (app/_layout.tsx).
 *   Data    → none of its own; GoalsEditor owns every read and write.
 *
 * Edit notes:
 *   - **Pads nothing.** `CenterModalScreen` pads its own body, so a screen-edge inset here is a
 *     second one stacked inside the first — the inverted rule `lib/__tests__/screenRhythm.test.ts`
 *     asserts over `CENTRE_MODAL_SCREENS`.
 *   - It wears the PLANS hue rather than the hue of whichever card opened it. A drawer that
 *     changed colour depending on where you opened it from was the 2026-08-10 "wrong coloring"
 *     report; goals are one domain, so they get one colour wherever you reach them.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import CenterModalScreen from '@/components/CenterModalScreen';
import GoalsEditor from '@/components/GoalsEditor';
import { useT } from '@/lib/i18n';
import { usePrefill } from '@/lib/prefill';
import { getScreenColor } from '@/lib/screenColor';
import { useAppTheme } from '@/lib/useAppTheme';

export default function GoalsEditorScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  // A note sent to Goals arrives here as `?prefill=…&prefillSlot=goals` and opens the add row
  // with its text (lib/prefill.ts). Consumed once and cleared off the route by `usePrefill`.
  const prefill = usePrefill('goals');
  return (
    <CenterModalScreen title={t.goals.editTitle} screenKey="plans" onClose={() => router.back()}>
      <GoalsEditor accent={getScreenColor(theme, 'plans').base} prefill={prefill} />
    </CenterModalScreen>
  );
}
