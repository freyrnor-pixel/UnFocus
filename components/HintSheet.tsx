/**
 * HintSheet.tsx — the ⓘ "how this works" explanation, as a bottom sheet.
 *
 * Same content contract as components/HintCard.tsx (already-localized `text`/`example` plus
 * an optional `children` slot for a setting that lives nowhere else) — the difference is
 * where it lands: HintCard renders the body INLINE in the screen's scroll content, pushing
 * every card below it down while it is open; this renders it over the screen and leaves the
 * layout alone.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Surface, components/PressableScale,
 *             constants/theme, lib/useAppTheme, lib/i18n (useT — for the sheet's own title
 *             and Done label only; `text`/`example`/`children` arrive already localized)
 *   Used by → app/(tabs)/shopping.tsx
 *   Data    → none — purely presentational; the caller owns `visible` and every control it
 *             passes as `children`
 *
 * Edit notes:
 *   - **Why this exists (2026-08-13).** On Shopping the ⓘ body is the biggest block on the
 *     screen when open — two paragraphs plus the weekly-reset weekday row and the
 *     monthly-reset date field — and it opened between the sticky tab bar and the first list
 *     card, shoving the lists down the moment you asked a question about them. A sheet is
 *     the shape for "tell me, then get out of the way". The other ten HintCard callers are
 *     unchanged; converting one screen is deliberate, not drift — this is the same component
 *     any of them can adopt, not a second implementation of one.
 *   - **Wrapped in a KeyboardAvoidingView** (same fix as components/EpisodeCloseSheet.tsx /
 *     components/UpdateSheet.tsx): a `<Modal>` renders outside the screen's own scaffold, so
 *     lib/useKeyboardLift.ts — which hands the field to ScreenScaffold's ScrollView — cannot
 *     reach a field in here. Don't pass a lift ref to a child of this sheet; it is a no-op.
 *   - The body scrolls (`keyboardShouldPersistTaps="handled"`) and the sheet caps at 85% —
 *     the copy is bilingual and Norwegian runs longer, so a fixed height would clip NO first.
 *   - Deliberately NOT accent-barred like HintCard's card body: the sheet is already visually
 *     separated from the screen by its own scrim, so the bar would be decorating a boundary
 *     that the overlay already draws.
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Fonts, FontSize, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Already-localized explanation — same contract as HintCard's `text`. */
  text: string;
  /** Already-localized "e.g. …" line, rendered muted + italic under the text. */
  example?: string;
  /**
   * Optional controls rendered below the copy — used for a setting that lives nowhere else
   * (Shopping's weekly/monthly reset cadence). Same slot HintCard's `children` filled.
   */
  children?: React.ReactNode;
};

export default function HintSheet({ visible, onClose, text, example, children }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flexFill}>
        <Surface surfaceContext="overlay" style={styles.sheet}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={[styles.title, { color: theme.text }]}>{t.showHint}</Text>
            <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
            {example ? <Text style={[styles.example, { color: theme.textMuted }]}>{example}</Text> : null}
            {children ? <View style={styles.childrenSlot}>{children}</View> : null}
          </ScrollView>
          <PressableScale
            style={[styles.doneBtn, { backgroundColor: theme.accent }]}
            onPress={onClose}
            accessibilityRole="button"
            scaleTo={0.95}
          >
            <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.hintSheetDone}</Text>
          </PressableScale>
        </Surface>
      </KeyboardAvoidingView>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  flexFill: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  body: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  text: { fontSize: FontSize.sm, lineHeight: 20, fontFamily: Fonts.medium },
  example: { fontSize: FontSize.xs, lineHeight: 18, fontStyle: 'italic' },
  childrenSlot: { marginTop: Spacing.sm },
  doneBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP_TARGET,
  },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
