/**
 * first-run.tsx — the four-step first-run personalization flow
 *
 * Motion → text size → appearance → starting screen, one question per screen, shown once
 * after onboarding finishes. Built to FIRST_RUN_PERSONALIZATION_HANDOFF.md; the invariants
 * below are the point of the screen, not incidental details.
 *
 *   1. **Skipping is always safe.** Every value this flow can write already has a working
 *      default applied (store/useSettingsStore.ts's defaultSettings + the DEFAULTs on the
 *      columns in lib/db.ts), and the flow seeds its selections FROM those. It only ever
 *      adjusts; it never establishes a requirement.
 *   2. **Nothing can be invalid.** Every option is one of a fixed enumerated set in
 *      lib/firstRunOptions.ts — no free text, no numbers, nothing to validate.
 *   3. **One atomic write, at the very end or on skip.** Selections live in `picks`
 *      (React state) until commit(); `settingsPatchFromPicks()` returns one patch holding
 *      all four steps AND `firstRunComplete: true`, so the gate can never be set without
 *      the selections landing with it, and a force-quit mid-flow leaves the settings row
 *      untouched — the flow simply runs again.
 *   4. **Live preview means changing THIS screen**, not showing a swatch. Which is why the
 *      screen resolves its own palette and text scale from `picks` via the pure
 *      buildTheme()/resolveIsDark()/scaleStyles() helpers instead of the useAppTheme()
 *      hooks: the hooks read the store, and the store deliberately doesn't know about these
 *      choices yet. That also rules out Surface/Button here — they read the store too, and
 *      would sit at the committed appearance while everything around them previewed the
 *      new one. Hence the hand-rolled cards and footer buttons below.
 *   5. **The OS reduce-motion flag is a floor, never a ceiling.** `reducedMotion` is OR'd
 *      with the live OS flag in lib/useAppTheme.ts, so picking "Full" here cannot give a
 *      phone more movement than it asked for. When the OS flag is on we additionally
 *      pre-select "Reduced" rather than "Full" and say so above the options.
 *
 * Connections:
 *   Imports → @/lib/firstRunOptions, @/store/useSettingsStore, @/lib/i18n,
 *             @/lib/useAppTheme (pure helpers + useSystemReducedMotion),
 *             @/lib/haptics, @/components/PressableScale, @/constants/theme, @/constants/motion
 *   Used by → Expo Router route "/first-run" — entered from app/onboarding/index.tsx's
 *             finish(), app/onboarding/guided.tsx's Explore path, app/settings.tsx's
 *             "Run setup again" row, and app/_layout.tsx's guard (the safety net for an
 *             install that reaches the tabs with firstRunComplete still false)
 *   Data    → useSettingsStore — READS the four settings to seed its selections, WRITES
 *             them plus firstRunComplete exactly once, in one update()
 *
 * Edit notes:
 *   - Adding a step: extend FIRST_RUN_STEPS + both mapping functions in
 *     lib/firstRunOptions.ts, then add a case to `stepContent()`. Four is the cap —
 *     a fifth thing belongs in Settings, per the handoff doc's anti-overwhelm rules.
 *   - "Skip for now" and the primary action are the same size and sit in the same place on
 *     every step, by design: skipping is a legitimate choice, not a failure. Don't demote
 *     skip to a text link. Skipping ONE step is pressing Continue without tapping a card —
 *     that step's current value stands, which is why nothing is ever left unset.
 *   - No progress bar, no celebration screen, no exclamation marks (the last is enforced by
 *     lib/__tests__/copyTone.test.ts). The step position is a quiet "2 of 4".
 *   - The commit navigates to the chosen tab directly (START_SCREEN_PATHS). The pager is
 *     already mounted by now, so app/(tabs)/_layout.tsx's `initialRouteName` only governs
 *     later cold launches — both paths are needed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { selection } from '@/lib/haptics';
import {
  DARK_MODE_CHOICES,
  FIRST_RUN_STEPS,
  FONT_SIZE_CHOICES,
  FirstRunPicks,
  MOTION_CHOICES,
  START_SCREEN_CHOICES,
  START_SCREEN_PATHS,
  picksFromSettings,
  settingsPatchFromPicks,
} from '@/lib/firstRunOptions';
import {
  buildTheme,
  resolveIsDark,
  scaleStyles,
  useSystemReducedMotion,
} from '@/lib/useAppTheme';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { Duration, Ease } from '@/constants/motion';
import PressableScale from '@/components/PressableScale';

/** One tappable option: what it writes, what it says, and whether it's currently picked. */
type Option = { value: string; label: string; desc: string };

const STEP_COUNT = FIRST_RUN_STEPS.length;
/** How far a step slides in at full motion. Small — this is orientation, not a journey. */
const STEP_SLIDE = 16;

export default function FirstRun() {
  const router = useRouter();
  const settings = useSettingsStore();
  const t = useT();
  const systemScheme = useColorScheme();
  const osReducedMotion = useSystemReducedMotion();

  // Seed from the settings that are ALREADY applied — shipped defaults on a fresh install,
  // the user's own choices on a re-run. Nothing here is ever unset, which is what makes
  // "Skip on step 1" and "re-run and press straight through" both no-ops.
  const [picks, setPicks] = useState<FirstRunPicks>(() => {
    const seeded = picksFromSettings(settings);
    // A phone asking for reduced motion never gets offered "Full" as the pre-selection.
    return osReducedMotion && seeded.motion === 'full' ? { ...seeded, motion: 'reduced' } : seeded;
  });
  const [step, setStep] = useState(0);

  // ── Live preview: this screen renders from `picks`, not from the store ──────
  const theme = useMemo(
    () => buildTheme(resolveIsDark(picks.darkMode, systemScheme)),
    [picks.darkMode, systemScheme],
  );
  const styles = useMemo(() => scaleStyles(baseStyles, picks.fontSize), [picks.fontSize]);
  // The OS flag is a floor: it can only ever take motion away from the preview.
  const previewMotion = osReducedMotion && picks.motion === 'full' ? 'reduced' : picks.motion;

  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (previewMotion === 'none') {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: previewMotion === 'full' ? Duration.card : Duration.micro,
      easing: Ease.enter,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [step, previewMotion, enter]);

  const enterStyle =
    previewMotion === 'full'
      ? {
          opacity: enter,
          transform: [
            { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [STEP_SLIDE, 0] }) },
          ],
        }
      : { opacity: enter };

  // ── The one write ──────────────────────────────────────────────────────────
  const commit = useCallback(
    (final: FirstRunPicks) => {
      settings.update(settingsPatchFromPicks(final));
      router.replace(START_SCREEN_PATHS[final.startScreen]);
    },
    [settings, router],
  );

  const advance = useCallback(() => {
    selection();
    if (step < STEP_COUNT - 1) setStep((s) => s + 1);
    else commit(picks);
  }, [step, picks, commit]);

  const skip = useCallback(() => {
    selection();
    // Skipping commits whatever is currently held — which, for a step never reached, is
    // the value that was already applied. So "skip" and "leave it alone" agree.
    commit(picks);
  }, [picks, commit]);

  function choose<K extends keyof FirstRunPicks>(key: K, value: FirstRunPicks[K]) {
    selection();
    setPicks((p) => ({ ...p, [key]: value }));
  }

  // ── Step content ───────────────────────────────────────────────────────────
  const stepKey = FIRST_RUN_STEPS[step];
  const { title, sub, note, options, selected, onSelect } = stepContent(stepKey, t, picks, osReducedMotion);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        {step > 0 ? (
          <PressableScale
            onPress={() => setStep((s) => s - 1)}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t.previous}
          >
            <Ionicons name="chevron-back" size={22} color={theme.textMuted} />
          </PressableScale>
        ) : (
          <View style={styles.backBtn} />
        )}
        {/* Quiet position, never a filling bar — the handoff doc's "no progress pressure". */}
        <Text style={[styles.stepCount, { color: theme.textMuted }]}>
          {t.firstRun.step(step + 1, STEP_COUNT)}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <Animated.View style={[styles.flex, enterStyle]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <Text style={[styles.heading, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>{sub}</Text>
            {note ? (
              <Text style={[styles.note, { color: theme.textMuted, borderColor: theme.border }]}>{note}</Text>
            ) : null}
          </View>

          <View style={styles.options}>
            {options.map((opt) => {
              const isOn = opt.value === selected;
              return (
                <PressableScale
                  key={opt.value}
                  onPress={() => onSelect(opt.value, choose)}
                  scaleTo={0.98}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isOn }}
                  accessibilityLabel={`${opt.label}. ${opt.desc}`}
                >
                  <View
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: isOn ? theme.accentSoft : theme.surface,
                        borderColor: isOn ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
                      <Text style={[styles.optionDesc, { color: theme.textMuted }]}>{opt.desc}</Text>
                    </View>
                    {/* The icon carries the selected state as well as the colour does —
                        DESIGN_RULES.md rule "no meaning by colour alone". */}
                    <Ionicons
                      name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isOn ? theme.accent : theme.border}
                    />
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <Text style={[styles.settingsNote, { color: theme.textMuted }]}>{t.firstRun.settingsNote}</Text>
        </ScrollView>
      </Animated.View>

      {/* Skip sits beside the primary action at the same size on every step. */}
      <View style={styles.footer}>
        <PressableScale
          onPress={skip}
          style={[styles.footerBtn, { borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={t.firstRun.skip}
        >
          <Text style={[styles.footerBtnText, { color: theme.text }]}>{t.firstRun.skip}</Text>
        </PressableScale>
        <PressableScale
          onPress={advance}
          style={[styles.footerBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel={step === STEP_COUNT - 1 ? t.firstRun.finish : t.firstRun.continue}
        >
          <Text style={[styles.footerBtnText, { color: theme.accentInk }]}>
            {step === STEP_COUNT - 1 ? t.firstRun.finish : t.firstRun.continue}
          </Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

/** A step's copy, its options, and which pick key a tap writes. */
function stepContent(
  stepKey: (typeof FIRST_RUN_STEPS)[number],
  t: ReturnType<typeof useT>,
  picks: FirstRunPicks,
  osReducedMotion: boolean,
): {
  title: string;
  sub: string;
  note?: string;
  options: Option[];
  selected: string;
  onSelect: (value: string, choose: <K extends keyof FirstRunPicks>(k: K, v: FirstRunPicks[K]) => void) => void;
} {
  switch (stepKey) {
    case 'motion':
      return {
        title: t.firstRun.motion.title,
        sub: t.firstRun.motion.sub,
        note: osReducedMotion ? t.firstRun.motion.osReduced : undefined,
        options: MOTION_CHOICES.map((v) => ({ value: v, ...t.firstRun.motion[v] })),
        selected: picks.motion,
        onSelect: (v, choose) => choose('motion', v as FirstRunPicks['motion']),
      };
    case 'textSize':
      return {
        title: t.firstRun.textSize.title,
        sub: t.firstRun.textSize.sub,
        // Labels come from Settings' own font-size control, so the two never drift apart.
        options: FONT_SIZE_CHOICES.map((v) => ({
          value: v,
          label: FONT_SIZE_LABELS[v](t),
          desc: t.firstRun.textSize[v],
        })),
        selected: picks.fontSize,
        onSelect: (v, choose) => choose('fontSize', v as FirstRunPicks['fontSize']),
      };
    case 'appearance':
      return {
        title: t.firstRun.appearance.title,
        sub: t.firstRun.appearance.sub,
        options: DARK_MODE_CHOICES.map((v) => ({ value: v, ...t.firstRun.appearance[v] })),
        selected: picks.darkMode,
        onSelect: (v, choose) => choose('darkMode', v as FirstRunPicks['darkMode']),
      };
    case 'startScreen':
      return {
        title: t.firstRun.startScreen.title,
        sub: t.firstRun.startScreen.sub,
        // Each tab is named exactly as the bottom nav names it.
        options: START_SCREEN_CHOICES.map((v) => ({
          value: v,
          label: START_SCREEN_LABELS[v](t),
          desc: t.firstRun.startScreen[v],
        })),
        selected: picks.startScreen,
        onSelect: (v, choose) => choose('startScreen', v as FirstRunPicks['startScreen']),
      };
  }
}

/** Reused from Settings → Accessibility → Font size rather than restated. */
const FONT_SIZE_LABELS = {
  small: (t: ReturnType<typeof useT>) => t.settings.accessibility.fontSizeSmall,
  default: (t: ReturnType<typeof useT>) => t.settings.accessibility.fontSizeDefault,
  large: (t: ReturnType<typeof useT>) => t.settings.accessibility.fontSizeLarge,
};

/** Reused from the bottom nav rather than restated. */
const START_SCREEN_LABELS = {
  home: (t: ReturnType<typeof useT>) => t.nav.home,
  plans: (t: ReturnType<typeof useT>) => t.nav.plans,
  shopping: (t: ReturnType<typeof useT>) => t.nav.shop,
};

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  backBtn: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.xl,
  },
  top: { gap: Spacing.sm },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold },
  sub: { fontSize: FontSize.md, lineHeight: 22 },
  note: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    borderLeftWidth: 2,
    paddingLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  options: { gap: Spacing.md },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    // Deliberately md, not lg: `npm run wraps` showed the screen padding + card padding +
    // icon gutter stacking down to 255 of 393px, which pushed one-sentence descriptions
    // onto a second line for the sake of ~30px. See AGENTS.md's "horizontal chrome stacks"
    // note — the container was the problem, not the copy.
    gap: Spacing.sm,
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  optionDesc: { fontSize: FontSize.sm, lineHeight: 18 },
  settingsNote: { fontSize: FontSize.sm, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  footerBtn: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  footerBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold, textAlign: 'center' },
});
