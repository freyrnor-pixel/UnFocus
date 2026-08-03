/**
 * basics.tsx — the whole of "set the app up", on one screen
 *
 * Six rows: language → appearance → text size → movement → menu side → starting screen.
 * This replaces SIX sequential screens (app/onboarding/language.tsx plus app/first-run.tsx's
 * four-step wizard), which is the single biggest reason getting started felt long: six
 * screens for six switches, each of which already had a working default.
 *
 * The invariants are inherited from first-run.tsx and are the point of the screen, not
 * incidental details:
 *
 *   1. **Skipping is always safe.** Every value here already has a working default applied
 *      (store/useSettingsStore.ts's defaultSettings + the DEFAULTs on the columns in
 *      lib/db.ts), and the screen seeds its selections FROM those. It only ever adjusts; it
 *      never establishes a requirement.
 *   2. **Nothing can be invalid.** Every option is one of a fixed enumerated set in
 *      lib/firstRunOptions.ts — no free text, no numbers, nothing to validate.
 *   3. **One atomic write, at the very end or on skip.** Selections live in `picks` (React
 *      state) until commit(); `settingsPatchFromPicks()` returns one patch holding all six
 *      rows AND `firstRunComplete: true`, so the gate can never be set without the
 *      selections landing with it, and a force-quit leaves the settings row untouched — the
 *      screen simply runs again.
 *   4. **Live preview means changing THIS screen**, not showing a swatch. Which is why it
 *      resolves its own palette, text scale AND language from `picks` via the pure
 *      buildTheme()/resolveIsDark()/scaleStyles()/getTranslations() helpers instead of the
 *      useAppTheme()/useT() hooks: those read the store, and the store deliberately doesn't
 *      know about these choices yet. That also rules out Surface/Button here — they read the
 *      store too, and would sit at the committed appearance while everything around them
 *      previewed the new one. Hence the hand-rolled cards and footer buttons below.
 *   5. **The OS reduce-motion flag is a floor, never a ceiling.** `reducedMotion` is OR'd
 *      with the live OS flag in lib/useAppTheme.ts, so picking "Full" here cannot give a
 *      phone more movement than it asked for. When the OS flag is on we additionally
 *      pre-select "Reduced" rather than "Full" and say so under that row.
 *
 * **Language is row one, and it previews like everything else** — tapping Norsk re-renders
 * the entire screen in Norwegian on the spot. That is both the clearest possible
 * demonstration that this screen previews at all, and the reason language no longer needs a
 * screen ahead of everything else.
 *
 * Connections:
 *   Imports → @/lib/firstRunOptions, @/store/useSettingsStore, @/lib/i18n (getTranslations),
 *             @/lib/useAppTheme (pure helpers + useSystemReducedMotion), @/lib/haptics,
 *             @/components/PressableScale, @/constants/theme, @/constants/motion
 *   Used by → Expo Router route "/onboarding/basics" — the FIRST onboarding screen, and the
 *             target of app/settings.tsx's "Run setup again" row and app/_layout.tsx's
 *             first-run guard (the safety net for an install that reaches the tabs with
 *             firstRunComplete still false)
 *   Data    → useSettingsStore — READS the six settings to seed its selections, WRITES them
 *             plus firstRunComplete exactly once, in one update()
 *
 * Edit notes:
 *   - Adding a row: extend BASICS_ROWS + both mapping functions in lib/firstRunOptions.ts,
 *     then add a case to `rowContent()`. ONE SCREEN is the cap — a seventh thing goes to
 *     Settings, which is the same anti-overwhelm rule the old four-step cap encoded.
 *   - Each row shows its options as pills and the SELECTED option's description as one line
 *     underneath. Showing all 16 descriptions at once turns a short screen into a long one;
 *     showing none loses the explanation the four-step flow had room for.
 *   - "Skip for now" and the primary action are the same size and sit in the same place, by
 *     design: skipping is a legitimate choice, not a failure. Don't demote skip to a text
 *     link.
 *   - No progress bar and no exclamation marks (the latter is enforced by
 *     lib/__tests__/copyTone.test.ts).
 *   - Options pills use `flex: 1` with no minWidth — see AGENTS.md's "horizontal chrome
 *     stacks" note. A row of three Norwegian labels is the tightest case in the app.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { getTranslations, type Translations } from '@/lib/i18n';
import { selection } from '@/lib/haptics';
import {
  BASICS_ROWS,
  DARK_MODE_CHOICES,
  FONT_SIZE_CHOICES,
  FirstRunPicks,
  HANDEDNESS_CHOICES,
  LANGUAGE_CHOICES,
  MOTION_CHOICES,
  START_SCREEN_CHOICES,
  picksFromSettings,
  settingsPatchFromPicks,
} from '@/lib/firstRunOptions';
import { buildTheme, resolveIsDark, scaleStyles, useSystemReducedMotion } from '@/lib/useAppTheme';
import { FontSize, Fonts, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import PressableScale from '@/components/PressableScale';

/** One tappable option in a row. */
type Option = { value: string; label: string; desc: string };

export default function OnboardingBasics() {
  const router = useRouter();
  const settings = useSettingsStore();
  const systemScheme = useColorScheme();
  const osReducedMotion = useSystemReducedMotion();

  /**
   * Which rows to draw — the 2026-08-03 split.
   *
   * A fresh install shows ONE row (language) under a headline that says what the app is.
   * The re-run from Settings → Personal → Layout ("Run setup again") passes `?rows=all` and
   * gets the full six, which is what that row has always meant.
   *
   * Why: screen one of a brand-new install was a six-row settings form, asking for fifteen
   * decisions before the user had seen anything and before they knew what UnFocus was for.
   * Every one of those values already has a working default (invariant 1 below), so the
   * screen only ever ADJUSTED — which makes it exactly the kind of thing that belongs in
   * Settings, where all five of the hidden rows already have a home (Appearance, Text size
   * and Movement under General; Menu side and Starting screen under Personal → Layout).
   * Language stays because everything after it is rendered in whatever it picks.
   *
   * The write is UNCHANGED and still atomic over all six (see commit()): the five rows this
   * mode doesn't draw are committed at their seeded values, which are the values already in
   * the store. So a first-run commit and a straight-through re-run are both no-ops for them,
   * `settingsPatchFromPicks` keeps its 324-combination round-trip contract, and
   * `firstRunComplete` still cannot be set without the selections landing with it.
   */
  const { rows: rowsParam } = useLocalSearchParams<{ rows?: string }>();
  const showAllRows = rowsParam === 'all';
  const visibleRows = showAllRows ? BASICS_ROWS : (['language'] as const);

  // Seed from the settings that are ALREADY applied — shipped defaults on a fresh install,
  // the user's own choices on a re-run. Nothing here is ever unset, which is what makes both
  // "Skip" and "re-run and press straight through" no-ops.
  const [picks, setPicks] = useState<FirstRunPicks>(() => {
    const seeded = picksFromSettings(settings);
    // A phone asking for reduced motion never gets offered "Full" as the pre-selection.
    return osReducedMotion && seeded.motion === 'full' ? { ...seeded, motion: 'reduced' } : seeded;
  });

  // ── Live preview: this screen renders from `picks`, not from the store ──────
  const t = useMemo(() => getTranslations(picks.language), [picks.language]);
  const theme = useMemo(
    () => buildTheme(resolveIsDark(picks.darkMode, systemScheme)),
    [picks.darkMode, systemScheme],
  );
  const styles = useMemo(() => scaleStyles(baseStyles, picks.fontSize), [picks.fontSize]);

  // ── The one write ──────────────────────────────────────────────────────────
  const commit = useCallback(
    (final: FirstRunPicks) => {
      settings.update(settingsPatchFromPicks(final));
      // A re-run from Settings has nowhere to go on — onboarding proper is one screen away
      // from finishing and the user is not in it. Go back where they came from.
      if (showAllRows) {
        router.back();
        return;
      }
      // Onboarding continues to the privacy screen, which is now the LAST one: it carries the
      // Start button, the restore detour and the AI setup link. The restore step used to sit
      // here, between this screen and privacy, and was asked of every new user before they had
      // seen anything — it is a returning user's question, so it waits on privacy for the
      // person who needs it.
      router.push('/onboarding/privacy');
    },
    [settings, router, showAllRows],
  );

  const choose = useCallback(<K extends keyof FirstRunPicks>(key: K, value: FirstRunPicks[K]) => {
    selection();
    setPicks((p) => ({ ...p, [key]: value }));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          {/* Two headings for two jobs. On a fresh install this screen has to answer "what is
              this app?" before it asks for anything — nothing else in onboarding or the tour
              ever did. The re-run from Settings keeps the original wording, where the only
              open question really is what you are picking. */}
          <Text style={[styles.heading, { color: theme.text }]}>
            {showAllRows ? t.basics.title : t.basics.welcomeTitle}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {showAllRows ? t.basics.sub : t.basics.welcomeSub}
          </Text>
        </View>

        {visibleRows.map((rowKey) => {
          const { label, options, selected, note } = rowContent(rowKey, t, picks, osReducedMotion);
          const chosen = options.find((o) => o.value === selected);
          return (
            <View key={rowKey} style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
              <View style={styles.pills}>
                {options.map((opt) => {
                  const isOn = opt.value === selected;
                  return (
                    <PressableScale
                      key={opt.value}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: isOn ? theme.accentSoft : theme.surface,
                          borderColor: isOn ? theme.accent : theme.border,
                        },
                      ]}
                      onPress={() => choose(rowKey as keyof FirstRunPicks, opt.value as never)}
                      scaleTo={0.97}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isOn }}
                      accessibilityLabel={`${label}: ${opt.label}. ${opt.desc}`}
                    >
                      {/* The check carries the selected state as well as the colour does —
                          DESIGN_RULES.md's "no meaning by colour alone". */}
                      {isOn ? (
                        <Ionicons name="checkmark" size={14} color={theme.accent} style={styles.pillCheck} />
                      ) : null}
                      <Text
                        style={[styles.pillText, { color: isOn ? theme.accent : theme.text }]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
              {/* One line, for the CHOSEN option only — see the edit notes. */}
              {chosen ? (
                <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{chosen.desc}</Text>
              ) : null}
              {note ? (
                <Text style={[styles.rowNote, { color: theme.textMuted, borderColor: theme.border }]}>
                  {note}
                </Text>
              ) : null}
            </View>
          );
        })}

        <Text style={[styles.settingsNote, { color: theme.textMuted }]}>{t.firstRun.settingsNote}</Text>
      </ScrollView>

      {/* Skip sits beside the primary action at the same size. */}
      <View style={styles.footer}>
        <PressableScale
          onPress={() => {
            selection();
            // Skipping commits whatever is currently held — which, for a row never touched,
            // is the value that was already applied. So "skip" and "leave it alone" agree.
            commit(picks);
          }}
          style={[styles.footerBtn, { borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={t.firstRun.skip}
        >
          <Text style={[styles.footerBtnText, { color: theme.text }]}>{t.firstRun.skip}</Text>
        </PressableScale>
        <PressableScale
          onPress={() => {
            selection();
            commit(picks);
          }}
          style={[styles.footerBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel={t.firstRun.continue}
        >
          <Text style={[styles.footerBtnText, { color: theme.accentInk }]}>{t.firstRun.continue}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

/** A row's label, its options, and which one is currently picked. */
function rowContent(
  rowKey: (typeof BASICS_ROWS)[number],
  t: Translations,
  picks: FirstRunPicks,
  osReducedMotion: boolean,
): { label: string; options: Option[]; selected: string; note?: string } {
  switch (rowKey) {
    case 'language':
      return {
        label: t.basics.language.label,
        // Language names stay in their own language, never translated — the same reason the
        // old dedicated language screen listed "English / Norsk" literally.
        options: LANGUAGE_CHOICES.map((v) => ({ value: v, ...t.basics.language[v] })),
        selected: picks.language,
      };
    case 'appearance':
      return {
        label: t.basics.appearance,
        options: DARK_MODE_CHOICES.map((v) => ({ value: v, ...t.firstRun.appearance[v] })),
        selected: picks.darkMode,
      };
    case 'textSize':
      return {
        label: t.basics.textSize,
        // Labels come from Settings' own font-size control, so the two never drift apart.
        options: FONT_SIZE_CHOICES.map((v) => ({
          value: v,
          label: FONT_SIZE_LABELS[v](t),
          desc: t.firstRun.textSize[v],
        })),
        selected: picks.fontSize,
      };
    case 'motion':
      return {
        label: t.basics.motion,
        options: MOTION_CHOICES.map((v) => ({ value: v, ...t.firstRun.motion[v] })),
        selected: picks.motion,
        note: osReducedMotion ? t.firstRun.motion.osReduced : undefined,
      };
    case 'handedness':
      return {
        label: t.basics.handedness.label,
        options: HANDEDNESS_CHOICES.map((v) => ({ value: v, ...t.basics.handedness[v] })),
        selected: picks.handedness,
      };
    case 'startScreen':
      return {
        label: t.firstRun.startScreen.settingsLabel,
        // Each tab is named exactly as the bottom nav names it.
        options: START_SCREEN_CHOICES.map((v) => ({
          value: v,
          label: START_SCREEN_LABELS[v](t),
          desc: t.firstRun.startScreen[v],
        })),
        selected: picks.startScreen,
      };
  }
}

/** Reused from Settings → Accessibility → Font size rather than restated. */
const FONT_SIZE_LABELS = {
  small: (t: Translations) => t.settings.accessibility.fontSizeSmall,
  default: (t: Translations) => t.settings.accessibility.fontSizeDefault,
  large: (t: Translations) => t.settings.accessibility.fontSizeLarge,
};

/** Reused from the bottom nav rather than restated. */
const START_SCREEN_LABELS = {
  home: (t: Translations) => t.nav.home,
  plans: (t: Translations) => t.nav.plans,
  shopping: (t: Translations) => t.nav.shop,
};

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  top: { gap: Spacing.xs },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold },
  sub: { fontSize: FontSize.md, lineHeight: 22 },
  row: { gap: Spacing.xs },
  rowLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  pills: { flexDirection: 'row', gap: Spacing.xs },
  // flex:1 with NO minWidth — a hard minimum is what breaks a control row on a 360px
  // phone (AGENTS.md's wrap-audit lessons). Norwegian labels are the tight case here.
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  pillCheck: { marginRight: -2 },
  pillText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, flexShrink: 1 },
  rowDesc: { fontSize: FontSize.sm, lineHeight: 18 },
  rowNote: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    borderLeftWidth: 2,
    paddingLeft: Spacing.sm,
    marginTop: 2,
  },
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
