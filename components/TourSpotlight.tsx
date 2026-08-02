/**
 * TourSpotlight.tsx — the guided tour's overlay: dim the screen, light up one card, explain it.
 *
 * This is what replaced the 8-page intro slideshow. Instead of describing features on cards the
 * user can't touch, it runs on the real app: it walks to each tab in turn, cuts a hole around
 * one real card (registered by components/TourTarget.tsx), and says what that card is for. The
 * card underneath stays live and interactive through the hole, because most steps are asking
 * the user to actually use it.
 *
 * **Everything about it is escapable.** Every step has its own "Skip this", and every step also
 * offers "Skip the tour" outright. A walkthrough you can't leave is worse than none at all,
 * particularly here — and progress is recorded as a SET of step ids (lib/tourSteps.ts), so a
 * skipped step and a finished one are indistinguishable afterwards. There is deliberately no
 * "you left the tour unfinished" state to come back to.
 *
 * The last panel is not a spotlight but a plain centred card: it carries the "this is an
 * experimental build" note and the AI setup guide download, both of which used to live on the
 * deleted intro slideshow's final pages and had nowhere else to be reachable from onboarding.
 * Since 2026-08-02 the AI guide is ALSO offered up front, as the third card on
 * app/onboarding/guided.tsx — this is the second entry point, not the only one, and the two
 * do different jobs (that one is a way to START, this one a way to go further later).
 *
 * Connections:
 *   Imports → react-native, expo-router (useRouter), @expo/vector-icons, @/lib/tourSteps,
 *             @/components/TourTarget (the rect registry), @/components/Motif,
 *             @/components/Button, @/lib/i18n, @/lib/haptics, @/lib/useAppTheme,
 *             @/lib/aiSetupGuide (exportAiSetupGuide), @/components/AppModal,
 *             @/store/useSettingsStore, @/constants/theme, @/constants/motion
 *   Used by → app/(tabs)/_layout.tsx — ONE instance, mounted above the pager and the bottom
 *             nav so the scrim covers everything
 *   Data    → useSettingsStore.tourProgress (read + written on every advance/skip)
 *
 * Edit notes:
 *   - **The focus ring is an outline, not the `fab-halo` motif.** That motif is three FILLED
 *     concentric circles meant to sit BEHIND a floating button; drawn over the un-dimmed hole
 *     it tinted the card it was supposed to be picking out. `halo-ring` is still used on the
 *     closing card, where it IS behind an icon and works as designed.
 *   - **The hole is four dim rects around the target, not an SVG `<Mask>`.** Masking is the
 *     flakier path across native and the web preview; four plain views need no mask support
 *     anywhere, and they leave the middle genuinely untouched — so the card underneath is
 *     still tappable, which a full-screen scrim with a masked hole would not be.
 *   - A step whose target isn't mounted, measured, or currently ON SCREEN renders NOTHING
 *     rather than a hole in the wrong place. That last condition matters more than it looks:
 *     the pager runs with `lazy: false`, so all five tab screens are mounted from launch and
 *     every target measures itself straight away, including the ones swiped off-screen.
 *   - Tap targets go through MIN_TAP_TARGET and motion through Duration.* — bare `44`,
 *     `hitSlop: 8` or `duration: 220` are CI failures (lib/__tests__/designTokens.test.ts).
 *   - Honour reducedMotion: the fade is skipped, not shortened.
 *   - Copy tone: no exclamation marks and nothing that implies falling behind
 *     (lib/__tests__/copyTone.test.ts scans every string in lib/i18n.ts).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { selection } from '@/lib/haptics';
import { useAppTheme, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Shadow, Spacing } from '@/constants/theme';
import { Duration, Ease } from '@/constants/motion';
import Button from '@/components/Button';
import Motif from '@/components/Motif';
import { showAppModal } from '@/components/AppModal';
import { exportAiSetupGuide } from '@/lib/aiSetupGuide';
import {
  TOUR_DISMISSED,
  TOUR_STEPS,
  formatProgress,
  nextStep,
  parseProgress,
  stepPosition,
} from '@/lib/tourSteps';
import { getTargetRect, subscribeTargets, type TargetRect } from '@/components/TourTarget';

/** Breathing room between the target's edge and the hole. */
const HOLE_PAD = 8;
/** How far the focus ring sits outside the hole. */
const RING_GAP = 4;
/** Space the coach card is guaranteed, so it can never be pushed off either edge. */
const CARD_RESERVE = 260;

export default function TourSpotlight() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();
  const { width, height } = useWindowDimensions();

  const tourProgress = useSettingsStore((s) => s.tourProgress);
  const setupComplete = useSettingsStore((s) => s.setupComplete);
  const update = useSettingsStore((s) => s.update);

  const done = useMemo(() => parseProgress(tourProgress), [tourProgress]);
  const step = nextStep(done);
  const dismissed = done.has(TOUR_DISMISSED);
  // All steps done but not yet dismissed → the closing card.
  const showFinale = !step && !dismissed;

  // Re-render when a target measures or unmounts.
  const [, bump] = useState(0);
  useEffect(() => subscribeTargets(() => bump((n) => n + 1)), []);

  const raw: TargetRect | undefined = step ? getTargetRect(step.targetId) : undefined;
  // Only trust a rect that is actually on screen. app/(tabs)/_layout.tsx runs the pager with
  // `lazy: false`, so ALL FIVE tab screens are mounted from launch and every target measures
  // itself immediately — including the four currently swiped off-screen. Taking the first
  // rect on offer meant the spotlight ringed a card on a screen the user wasn't looking at,
  // and narrated Shopping over Home.
  const rect = raw && raw.x > -width / 2 && raw.x < width * 1.5 ? raw : undefined;

  // Walk to the step's screen, on every step change. NOT conditional on the rect being
  // missing: with every screen pre-mounted the rect is never missing, so that condition
  // never fired and the tour never navigated anywhere.
  const routedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!step) return;
    if (routedFor.current === step.id) return;
    routedFor.current = step.id;
    // navigate, not push: these are tabs, and pushing would pile up back-stack entries.
    router.navigate(step.route);
  }, [step, router]);

  const fade = useRef(new Animated.Value(0)).current;
  const visible = Boolean((step && rect) || showFinale);
  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      return;
    }
    if (reducedMotion) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    const a = Animated.timing(fade, {
      toValue: 1,
      duration: Duration.card,
      easing: Ease.enter,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [visible, step?.id, reducedMotion, fade]);

  const record = useCallback(
    (id: string) => {
      selection();
      const next = new Set(done);
      next.add(id);
      update({ tourProgress: formatProgress(next) });
    },
    [done, update],
  );

  const dismissAll = useCallback(() => {
    selection();
    const next = new Set(done);
    next.add(TOUR_DISMISSED);
    update({ tourProgress: formatProgress(next) });
  }, [done, update]);

  const handleAiGuide = useCallback(async () => {
    selection();
    try {
      const result = await exportAiSetupGuide();
      if (result === 'unavailable') showAppModal(t.aiSetup.title, t.aiSetup.sharingUnavailable);
    } catch {
      showAppModal(t.aiSetup.title, t.aiSetup.exportError);
    }
  }, [t]);

  // The tour only ever greets a finished-onboarding install; existing users were back-filled
  // to 'dismissed' by the migration, so this never surprises someone mid-use.
  if (!setupComplete || dismissed) return null;

  // ── The closing card ──────────────────────────────────────────────────────
  if (showFinale) {
    return (
      <Animated.View style={[StyleSheet.absoluteFill, styles.finaleWrap, { opacity: fade }]}>
        <View style={[styles.scrimFull, { backgroundColor: theme.overlay }]} />
        <View style={[styles.card, styles.finaleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.finaleIcon}>
            <Motif id="halo-ring" color={theme.accent} fit="meet" style={styles.finaleMotif} />
            <Ionicons name="leaf-outline" size={26} color={theme.accent} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{t.tour.finale.title}</Text>
          <Text style={[styles.cardBody, { color: theme.textMuted }]}>{t.tour.finale.body}</Text>
          <Text style={[styles.cardNote, { color: theme.textMuted, borderColor: theme.border }]}>
            {t.tour.finale.experimental}
          </Text>
          <Button
            label={t.aiSetup.downloadButton}
            onPress={handleAiGuide}
            variant="secondary"
            size="sm"
            icon="download-outline"
          />
          <Button label={t.tour.finale.done} onPress={dismissAll} variant="primary" size="md" />
        </View>
      </Animated.View>
    );
  }

  if (!step || !rect) return null;

  // ── The hole ──────────────────────────────────────────────────────────────
  const hole = {
    x: Math.max(0, rect.x - HOLE_PAD),
    y: Math.max(0, rect.y - HOLE_PAD),
    w: rect.width + HOLE_PAD * 2,
    h: rect.height + HOLE_PAD * 2,
  };
  // Put the card on whichever side of the hole has more room, and pin it to that EDGE rather
  // than to the hole. Anchoring it to the hole meant a target near the top of the screen
  // pushed the card off the top, where it was clipped and unreadable — and a tall target
  // (Shopping's whole content region) made that the normal case, not the edge case.
  const spaceBelow = height - (hole.y + hole.h);
  const cardBelow = spaceBelow >= hole.y;
  const copy = t.tour.steps[step.id as keyof typeof t.tour.steps];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fade }]} pointerEvents="box-none">
      {/* Four rects around the target rather than a masked scrim — see the edit notes. The
          middle is left genuinely uncovered, so the card underneath stays tappable. */}
      <View style={[styles.dim, { backgroundColor: theme.overlay, top: 0, left: 0, right: 0, height: hole.y }]} />
      <View style={[styles.dim, { backgroundColor: theme.overlay, top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.dim, { backgroundColor: theme.overlay, top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
      <View
        style={[
          styles.dim,
          { backgroundColor: theme.overlay, top: hole.y, left: hole.x + hole.w, width: Math.max(0, width - hole.x - hole.w), height: hole.h },
        ]}
      />

      {/* A ring, not a wash. `fab-halo` was the obvious motif here and is the wrong one: it is
          three FILLED concentric circles designed to sit BEHIND a floating button, so drawn
          over an un-dimmed hole it tinted the very card it was meant to pick out. An outline
          adds the emphasis without touching the content's colour. */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            borderColor: theme.accent,
            top: hole.y - RING_GAP,
            left: hole.x - RING_GAP,
            width: hole.w + RING_GAP * 2,
            height: hole.h + RING_GAP * 2,
          },
        ]}
      />

      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
          cardBelow
            ? { top: Math.min(hole.y + hole.h + Spacing.md, height - CARD_RESERVE) }
            : { bottom: Math.min(height - hole.y + Spacing.md, height - CARD_RESERVE) },
        ]}
      >
        <Text style={[styles.cardStep, { color: theme.textMuted }]}>
          {t.tour.step(stepPosition(step.id), TOUR_STEPS.length)}
        </Text>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{copy.title}</Text>
        <Text style={[styles.cardBody, { color: theme.textMuted }]}>{copy.body}</Text>
        <View style={styles.cardActions}>
          <Button label={t.tour.skipStep} onPress={() => record(step.id)} variant="ghost" size="sm" />
          <Button label={t.tour.next} onPress={() => record(step.id)} variant="primary" size="sm" />
        </View>
        <Button label={t.tour.skipAll} onPress={dismissAll} variant="ghost" size="sm" />
      </View>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  overlay: { zIndex: 100 },
  finaleWrap: { zIndex: 100, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  scrimFull: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  dim: { position: 'absolute' },
  halo: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: Radius.lg,
  },
  card: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...Shadow.cardHeavy,
  },
  finaleCard: { position: 'relative', left: 0, right: 0, alignSelf: 'stretch', gap: Spacing.sm },
  finaleIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  finaleMotif: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cardStep: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  cardTitle: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  cardBody: { fontSize: FontSize.sm, lineHeight: 20 },
  cardNote: {
    fontSize: FontSize.sm,
    lineHeight: 19,
    borderLeftWidth: 2,
    paddingLeft: Spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
    marginTop: Spacing.xs,
  },
});
