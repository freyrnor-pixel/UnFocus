/**
 * EnergyPauseSheet.tsx — the two equal-weight ways out of an over-budget day (2026-08-02).
 *
 * Opened from components/EnergyMeter.tsx — either by the strip's calm overspend control, or
 * once a day on its own when `useEnergyPause().shouldAutoShow` and the Home screen is idle.
 * It replaces the amber "⚠️ Today is planned to use 3 more Energy than you have available"
 * line that used to sit under the meter, which was the loudest piece of guilt copy left in
 * the app. The sheet states the situation once, in the narrator's voice, and offers two
 * answers:
 *
 *   **I'll decide** → up to four of today's cards; tapping one pins it (the rest keep).
 *   **I'm good**    → energy stops showing itself for the rest of today.
 *
 * **The two options carry equal visual weight, and that is non-negotiable.** Same
 * components/Button.tsx `variant`, same `size`, `flex: 1` each, side by side — neither is
 * primary, neither is a ghost. "I'm good" must never read as the lesser answer, because on
 * the days this sheet appears it is very often the right one. This is also why the sheet is
 * NOT components/AppModal.tsx's `showAppModal`: its two-button row hard-codes button 0 to an
 * accent fill and button 1 to a ghost, which is exactly the weighting the spec forbids.
 *
 * **Dismissal IS "I'm good"**, which is why there is no `onClose` prop — backdrop tap and the
 * Android back gesture (both already wired inside AnimatedBottomSheet) run `onImGood`. The
 * permissive answer should be the fastest one to reach, not the one you have to aim for.
 *
 * **Nothing here confirms anything.** No "are you sure", no warning about overcommitting, no
 * summary afterwards. The app never refers back to the choice — see lib/energyDayState.ts.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Button, components/PressableScale,
 *             components/Surface, constants/theme, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useTaskStore (TYPE ONLY — no runtime dep)
 *   Used by → components/EnergyMeter.tsx (mounts it and owns both triggers)
 *   Data    → none. It writes nothing itself; `onPin`/`onImGood` are
 *             lib/useEnergyPause.ts's `pin`/`pause`, which persist to the device-local
 *             `app_meta` day-state row (never synced).
 *
 * Edit notes:
 *   - The shell geometry is copied from components/LayoutPickerSheet.tsx on purpose — the
 *     bottom-pinned overlay Surface, the 40x4 grab handle, and the `minHeight: 56` /
 *     `Radius.md` / `borderWidth: 1` / `surfaceMuted` option row. The app has ONE bottom-sheet
 *     option row; don't let it gain a second that nearly matches.
 *   - `candidates` arrives already capped at four by lib/energyPause.ts's
 *     `decideCandidates`. Don't slice again here, and don't make this list scrollable — a
 *     scrolling list of everything is the over-full day restated, not a way out of it.
 *   - The stage resets to 'ask' on every open, so a sheet re-opened later in the day never
 *     comes back already showing the candidate list.
 *   - No KeyboardAvoidingView: there is no text input, so the sheet has nothing to lift.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import type { Task } from '@/store/useTaskStore';

type Props = {
  visible: boolean;
  /** Today's cards to offer, already capped at four by lib/energyPause.ts. */
  candidates: Task[];
  /** "I'll decide", then a pick — pins that one card for today. */
  onPin: (taskId: string) => void;
  /** "I'm good" — and also what a backdrop tap or the back gesture means. */
  onImGood: () => void;
};

/** 'ask' is the two equal buttons; 'decide' swaps them for the candidate rows. */
type Stage = 'ask' | 'decide';

export default function EnergyPauseSheet({ visible, candidates, onPin, onImGood }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const [stage, setStage] = useState<Stage>('ask');

  // Every open starts at the question. Keyed off the rising edge only — resetting on close
  // would swap the content out mid exit-animation.
  useEffect(() => {
    if (visible) setStage('ask');
  }, [visible]);

  return (
    <AnimatedBottomSheet visible={visible} onClose={onImGood}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />

        <Text style={[styles.line, { color: theme.text }]}>
          {stage === 'ask' ? t.energyPause.sheetLine : t.energyPause.afterDecide}
        </Text>

        {stage === 'ask' ? (
          // Two answers, one row, identical treatment. See the file header before touching
          // either the variant or the flex — the equal weighting is the feature.
          <View style={styles.actions}>
            <Button
              label={t.energyPause.decide}
              variant="secondary"
              onPress={() => {
                selection();
                setStage('decide');
              }}
              style={styles.action}
            />
            <Button
              label={t.energyPause.imGood}
              variant="secondary"
              onPress={() => {
                selection();
                onImGood();
              }}
              style={styles.action}
            />
          </View>
        ) : (
          candidates.map((task) => (
            <PressableScale
              key={task.id}
              style={[styles.option, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
              onPress={() => {
                selection();
                onPin(task.id);
              }}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={task.title}
            >
              <Text style={[styles.optionLabel, { color: theme.text }]} numberOfLines={2}>
                {task.title}
              </Text>
            </PressableScale>
          ))
        )}
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  line: { fontSize: FontSize.md, fontFamily: Fonts.medium, marginBottom: Spacing.xs },
  // `flexWrap` is the audit's answer for a control row that genuinely cannot shrink further
  // (AGENTS.md's wrap-audit notes): at the 1.2x font scale in Norwegian these two labels can
  // outgrow half the sheet each, and wrapping keeps both words intact rather than truncating
  // one of the two answers — which would break the equal weighting as surely as a variant swap.
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, rowGap: Spacing.sm },
  // No minWidth: the pair has to survive 327px (the `large` text setting at 393px) and a
  // minWidth floor is exactly what silently breaks a wrapping control row on a smaller phone.
  action: { flex: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 56,
  },
  optionLabel: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
});
