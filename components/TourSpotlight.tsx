/**
 * TourSpotlight.tsx — the guided tour's overlay: dim the screen, light up one card, explain it.
 *
 * This is what replaced the 8-page intro slideshow. Instead of describing features on cards the
 * user can't touch, it runs on the real app: it walks to each tab in turn, cuts a hole around
 * one real card (registered by components/TourTarget.tsx), and says what that card is for. The
 * card underneath stays live and interactive through the hole, because most steps are asking
 * the user to actually use it.
 *
 * **Everything about it is escapable.** Every step offers "Skip the tour" outright. A
 * walkthrough you can't leave is worse than none at all, particularly here — and progress is
 * recorded as a SET of step ids (lib/tourSteps.ts), so a skipped step and a finished one are
 * indistinguishable afterwards. There is deliberately no "you left the tour unfinished" state
 * to come back to.
 * Each step ALSO carried a per-step "Skip this" until 2026-08-03. It was deleted, not
 * relabelled, because it and "Got it" both called `record(step.id)` — the same button under
 * two names, which is what the set-not-sequence design implies and which left a reader
 * comparing "Skip this" to "Skip the tour" for a difference that wasn't there. Two buttons,
 * one primary, per rule 6.
 *
 * **Leaving the tour returns you to your chosen start screen** (2026-08-03). The tour walks
 * tab to tab and used to just stop, so finishing it left a new user on Health — the last tab
 * it visited, not one they picked — and skipping from step 2 left them on Shopping. `dismissAll`
 * now navigates to `settings.startScreen`. See its own comment.
 *
 * The last panel is not a spotlight but a plain centred card: it carries the "this is an
 * experimental build" note and the AI setup guide download, both of which used to live on the
 * deleted intro slideshow's final pages and had nowhere else to be reachable from onboarding.
 * Since 2026-08-02 the AI guide is ALSO offered up front, as the third card on
 * app/onboarding/guided.tsx — this is the second entry point, not the only one, and the two
 * do different jobs (that one is a way to START, this one a way to go further later).
 *
 * Connections:
 *   Imports → react-native, react-native-safe-area-context, expo-router (useRouter),
 *             @expo/vector-icons, @/lib/tourSteps, @/lib/tourSpotlight (the hole/ring
 *             geometry), @/components/ScreenScaffold (tabChromeBand — where the chrome is),
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
 *   - **Targets are measured in WINDOW space and this overlay subtracts its own origin**
 *     (2026-08-14). The scrim is a `StyleSheet.absoluteFill` inside the tabs root view, which is
 *     NOT the origin `measureInWindow` reports against on Android — see `origin` below and
 *     components/TourTarget.tsx's coordinate-space note. Every hole shipped one status bar too
 *     high on device because of it. Don't "simplify" this by swapping in `measure()`: its
 *     root-relative pageX/pageY are right on native and wrong on web, and that trade was
 *     measured, not assumed.
 *   - **The hole is clamped to the chrome's band, and the arithmetic is in lib/tourSpotlight.ts**
 *     (2026-08-14). A target's measured rect is its LAYOUT box; content scrolls under the
 *     floating header and nav cards and is hidden BY them, so the part of a rect that runs past
 *     that band is not visible content — cutting a hole there un-dims the CHROME. Home's to-do
 *     card is taller than the band, and that shipped: the bottom nav sat lit at full brightness
 *     with the focus ring drawn across it while the rest of the screen was dimmed. The band
 *     comes from ScreenScaffold's `tabChromeBand`, never re-summed here.
 *   - **The hole is four dim rects around the target, not an SVG `<Mask>`.** Masking is the
 *     flakier path across native and the web preview; four plain views need no mask support
 *     anywhere, and they leave the middle genuinely untouched — so the card underneath is
 *     still tappable, which a full-screen scrim with a masked hole would not be.
 *   - **The hole re-measures on a cadence while a step is up** (2026-08-05, remeasureTargets()).
 *     A target's rect is measured on mount/focus/onLayout, and none of those fire when
 *     something above it grows and pushes it down — which is what a Collapsible reveal does,
 *     from a worklet. Don't replace the interval with a one-shot on step entry: the card under
 *     the hole stays live and tappable by design, so it can resize at any point in the step.
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
import { Animated, PixelRatio, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { getTargetRect, remeasureTargets, subscribeTargets, type TargetRect } from '@/components/TourTarget';
// The chrome's own footprint, from the component that positions it — see the hole's clamp.
import { tabChromeBand } from '@/components/ScreenScaffold';
// Where to leave the user when the tour ends — see dismissAll. Same map app/(tabs)/_layout.tsx
// uses for `initialRouteName`, in its navigate-there-now form.
import { START_SCREEN_PATHS } from '@/lib/firstRunOptions';
// The hole/ring arithmetic, pure and unit-tested — see lib/tourSpotlight.ts's header for why
// it does not live inline here.
import { hasHole, spotlightHole, spotlightRing } from '@/lib/tourSpotlight';

/** Space the coach card is guaranteed, so it can never be pushed off either edge. */
const CARD_RESERVE = 260;
/**
 * How often the active step re-measures its target (and this overlay its own origin). One
 * `measureInWindow` per mounted target,
 * and TourTarget's own measure() skips the update (and the re-render) whenever the rect is
 * unchanged — which is the normal case. Duration.card because that is the timescale the
 * layout shifts this exists to catch actually move on; the point is a stale ring corrects
 * itself within a frame or two of the thing that moved, not that it polls fast.
 */
const REMEASURE_INTERVAL = Duration.card;

export default function TourSpotlight() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const { reducedMotion } = useAccessibility();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const tourProgress = useSettingsStore((s) => s.tourProgress);
  const setupComplete = useSettingsStore((s) => s.setupComplete);
  const startScreen = useSettingsStore((s) => s.startScreen);
  const update = useSettingsStore((s) => s.update);

  const done = useMemo(() => parseProgress(tourProgress), [tourProgress]);
  const step = nextStep(done);
  const dismissed = done.has(TOUR_DISMISSED);
  // All steps done but not yet dismissed → the closing card.
  const showFinale = !step && !dismissed;

  // Re-render when a target measures or unmounts.
  const [, bump] = useState(0);
  useEffect(() => subscribeTargets(() => bump((n) => n + 1)), []);

  /**
   * Where this overlay's own top-left sits in the coordinate space TourTarget measures in
   * (2026-08-14). Targets come back from `measureInWindow`; the scrim below is a
   * `StyleSheet.absoluteFill` inside the tabs root view. **Those are not the same origin.** On
   * Android, Fabric folds a viewport offset into "window" that is `−statusBarHeight` under the
   * edge-to-edge window Expo enforces (see TourTarget's coordinate-space note), so every hole
   * was drawn one status bar too high on device — the bug five real-device screenshots showed.
   *
   * Measuring THIS view the same way and subtracting cancels whatever a platform folds in,
   * with no status-bar constant written down anywhere: the delta is 0 on iOS and on the web
   * preview, and exactly the status bar on Android. Starting at {0,0} is the right initial
   * guess (it is the final answer on two of the three platforms) and the first measure lands
   * within a frame, well inside the fade-in.
   */
  const overlayRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const measureOrigin = useCallback(() => {
    overlayRef.current?.measureInWindow((x, y) => {
      setOrigin((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    });
  }, []);

  const measured: TargetRect | undefined = step ? getTargetRect(step.targetId) : undefined;
  const raw = measured && { ...measured, x: measured.x - origin.x, y: measured.y - origin.y };
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

  /**
   * Keep the hole on the card (2026-08-05). A target's registered rect is measured on mount,
   * on focus and on its own onLayout — none of which fire when something ABOVE it resizes and
   * pushes it down the screen. On a fresh install that happens within a beat of the tour
   * starting: the Shopping tab's first-visit HintCard reveals itself through
   * components/Collapsible.tsx, which animates its height from a Reanimated worklet, so every
   * sibling below it moves with no React layout pass of its own. The recorded rect stayed put
   * and the ring sat ~130px above the card it was pointing at, over blank space.
   *
   * Re-measuring on a cadence for as long as the step is showing — not just once on entry —
   * answers that and everything shaped like it (async store loads, a scroll, the user actually
   * using the live card the tour invites them to use) with one mechanism. See
   * remeasureTargets() for the cost, which is negligible.
   */
  useEffect(() => {
    if (!step) return;
    // The overlay's own origin rides the same cadence: it moves for the same reasons a target
    // does (an insets dispatch, a rotation), and one extra measureInWindow per tick is nothing
    // next to the five this already does.
    const pass = () => {
      measureOrigin();
      remeasureTargets();
    };
    pass();
    const iv = setInterval(pass, REMEASURE_INTERVAL);
    return () => clearInterval(iv);
  }, [step, measureOrigin]);

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

  /**
   * Leave the tour — from the "Skip the tour" button on any step, or from the closing card.
   *
   * Navigating is the point of the `router.navigate` here (2026-08-03). The tour walks tab to
   * tab and simply STOPPED on whichever one the last step visited, so finishing it dropped a
   * brand-new user on Health — a tab they had not chosen, holding a symptom log they had no
   * reason to want first. Skipping from step 2 stranded them on Shopping just as arbitrarily.
   * The user already told us where they want to start (`settings.startScreen`, the Basics
   * screen's last row); this honours it at the one moment the app is deciding for them.
   * `navigate`, not `push`, for the same reason the step walker uses it: these are tabs.
   */
  const dismissAll = useCallback(() => {
    selection();
    const next = new Set(done);
    next.add(TOUR_DISMISSED);
    update({ tourProgress: formatProgress(next) });
    router.navigate(START_SCREEN_PATHS[startScreen] ?? '/');
  }, [done, update, router, startScreen]);

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

  /**
   * Every return below goes through this wrapper, INCLUDING the empty one, because it is what
   * carries `overlayRef` — the origin probe (see `origin` above) has to be mounted and
   * measurable before there is anything to draw, or the first frame of each step is placed
   * against a stale offset. It is an empty `absoluteFill` with `box-none`, so while the tour
   * has nothing on screen it costs one view and blocks no touches. `collapsable={false}` keeps
   * Android from flattening away the very view being measured.
   */
  const frame = (children: React.ReactNode) => (
    <View ref={overlayRef} style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="box-none" collapsable={false}>
      {children}
    </View>
  );

  // ── The closing card ──────────────────────────────────────────────────────
  if (showFinale) {
    return frame(
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
      </Animated.View>,
    );
  }

  if (!step || !rect) return frame(null);

  // ── The hole ──────────────────────────────────────────────────────────────
  // **Clamped to where the target is actually VISIBLE, not to its whole rect** (2026-08-14,
  // real-device report + reproduced in the web preview). A target's measured rect is its layout
  // box, and on a tab screen that box routinely runs past what you can see: content scrolls
  // underneath the floating header and bottom-nav cards and is hidden BY them (they are opaque
  // — see the `viewportInset` note in components/ScreenScaffold.tsx). Home's to-do card is
  // taller than the band, so the un-clamped hole ran 28px into the nav bar and left it lit at
  // full brightness with the focus ring drawn straight across it, while everything else on the
  // screen was dimmed. Shopping's target is the whole sticky block, so its hole overhung both
  // side edges too.
  // The band comes from ScreenScaffold rather than being re-summed here: two places computing
  // the same chrome geometry and drifting by a few px is the exact failure the 2026-08-10 clip
  // pass is a long note about.
  // A target scrolled fully behind the chrome clamps to zero. The four dim rects below then
  // degenerate into a plain full-screen scrim, which is the honest picture — there is nothing to
  // point at. The coach card still renders, so the tour stays advanceable rather than stranding
  // the user on a dimmed screen with no way forward.
  const screen = { width, height };
  const band = tabChromeBand(insets, PixelRatio.getFontScale());
  const hole = spotlightHole(rect, screen, band);
  const ring = spotlightRing(hole, screen, band);
  const lit = hasHole(hole);
  // Put the card on whichever side of the hole has more room, and pin it to that EDGE rather
  // than to the hole. Anchoring it to the hole meant a target near the top of the screen
  // pushed the card off the top, where it was clipped and unreadable — and a tall target
  // (Shopping's whole content region) made that the normal case, not the edge case.
  const spaceBelow = height - (hole.y + hole.h);
  const cardBelow = spaceBelow >= hole.y;
  const copy = t.tour.steps[step.id as keyof typeof t.tour.steps];

  return frame(
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
      {lit && (
        <View
          pointerEvents="none"
          style={[
            styles.halo,
            { borderColor: theme.accent, top: ring.y, left: ring.x, width: ring.w, height: ring.h },
          ]}
        />
      )}

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
        {/* ONE primary and ONE escape (rule 6). There used to be three buttons here, and two
            of them — "Skip this" and "Got it" — called `record(step.id)`, i.e. they were the
            same button with two labels. That is a consequence of progress being a SET, which
            makes a skipped step and a finished one deliberately indistinguishable; the
            behaviour is right and the second label was the mistake. A first-time reader had
            to parse "Skip this" against "Skip the tour" to discover the difference, and there
            wasn't one worth the reading. Escapability is unchanged: "Skip the tour" leaves
            from any step, which is what the file header's promise actually rests on. */}
        <View style={styles.cardActions}>
          <Button label={t.tour.skipAll} onPress={dismissAll} variant="ghost" size="sm" />
          <Button
            label={t.tour.next}
            onPress={() => record(step.id)}
            variant="primary"
            size="sm"
            style={styles.cardPrimary}
          />
        </View>
      </View>
    </Animated.View>,
  );
}

const baseStyles = StyleSheet.create({
  // **The zIndex belongs on the OUTERMOST view, not on the scrim inside it.** app/(tabs)/
  // _layout.tsx renders PagerFloatingNav — itself `zIndex: 100` — as this component's sibling,
  // so whatever is the sibling here has to carry the matching value or the bar paints straight
  // over the dim and the coach card. Losing this to the origin-probe wrapper (2026-08-14) left
  // the bottom nav lit while everything around it dimmed, which reads exactly like the
  // un-clamped hole this pass had just fixed.
  root: { zIndex: 100 },
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
  // The escape and the primary share one row since 2026-08-03 (the third button went). That
  // put the app's longest ghost label — Norwegian "Hopp over omvisningen" — beside "Got it"
  // for the first time, and `npm run wraps --lang=no --width=327` caught the primary hanging
  // 2px off the right edge at the `large` font scale. `flexWrap` + `rowGap` is the fix the
  // task editor's Delete·Discard·Save row already uses for the same shape: three labelled
  // buttons that genuinely don't fit can only wrap, since shortening the copy would truncate
  // the words off them. `marginLeft: 'auto'` on the primary keeps it right-aligned whether
  // the row wraps or not, so nothing moves in the common case.
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    rowGap: Spacing.xs,
    minHeight: MIN_TAP_TARGET,
    marginTop: Spacing.xs,
  },
  cardPrimary: { marginLeft: 'auto' },
});
