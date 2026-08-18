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
 * **It is laid out like the rest of onboarding (2026-08-14).** Maintainer, on device: *"The
 * 'setup basics' is not a part of the introduction, and looks bad."* It read as a settings
 * form dropped into the flow rather than a step of it, for four separate reasons, all in the
 * styles and none in the logic: the scroll container had no `flexGrow`, no `justifyContent`
 * and no `alignItems`, so content was pinned to the top with a large dead band under it; the
 * rows sat bare on the backdrop where privacy/restore put theirs in a shadowed card; the
 * footer buttons were `Radius.md` rectangles against those screens' `Radius.full` pills; and
 * the rhythm was `Spacing.lg` against their `Spacing.xl`. All four now match
 * `privacy.tsx`/`restore.tsx`, which are the flow's idiom.
 *
 * **Everything is centred, on BOTH entry paths.** Centring used to be applied only when
 * `!showAllRows` (`topHero`, `headingCenter`, `subCenter`), and only to the hero — so the
 * fresh install was half-centred and the `?rows=all` re-run from Settings was entirely
 * left-aligned with no icon. One screen, two alignments. Each row is now a centred label over
 * a symmetric pill row, which is what the rest of the flow looks like. The one thing still
 * conditional on `showAllRows` is VERTICAL centring, and that is a scroll constraint rather
 * than a style choice — see the ScrollView's own comment.
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
 *   - **The real app icon (assets/icon.png), fresh-install only (2026-08-09).** This screen
 *     used to open on nothing but text and pills, with the onboarding backdrop's abstract
 *     line-art tree as the only visual — never the app's actual designed icon. It's the FIRST
 *     screen a new install shows, so it is now the one place in onboarding that leads with the
 *     real icon rather than generated decoration. Gated on `!showAllRows`: the Settings
 *     "Run setup again" re-entry doesn't need re-introducing to an app the user is already in.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore, type StartScreen } from '@/store/useSettingsStore';
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
import { FontSize, Fonts, glassKey, MIN_TAP_TARGET, Radius, Shadow, Spacing } from '@/constants/theme';
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
  // `isDark` is pulled out as well as folded into `theme`: `glassKey` below needs it, and this
  // screen previews an UNCOMMITTED appearance from local state, so it cannot call `useIsDark()`
  // (that reads the store and would answer for the theme the user has not chosen yet).
  const isDark = useMemo(() => resolveIsDark(picks.darkMode, systemScheme), [picks.darkMode, systemScheme]);
  const theme = useMemo(() => buildTheme(isDark), [isDark]);
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
      <ScrollView
        // Vertically centred only when the content is SHORT enough to fit (the fresh-install
        // path draws one row). A ScrollView whose content container centres content taller
        // than the viewport pushes the top of that content above the scroll origin, where it
        // cannot be reached — so the six-row re-run from Settings stays top-anchored.
        contentContainerStyle={[styles.scrollContent, !showAllRows && styles.scrollContentCentered]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          {/* The app's real icon, not a generated backdrop motif — this is the first thing a
              new install ever shows, so it is the one place onboarding should look like the
              app rather than like abstract decoration. Fresh-install only: a re-run from
              Settings is already inside the app and doesn't need re-introducing. */}
          {!showAllRows ? (
            <View style={styles.appIconShadow}>
              <View style={styles.appIconClip}>
                <Image source={require('../../assets/icon.png')} style={styles.appIcon} resizeMode="cover" />
              </View>
            </View>
          ) : null}
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

        {/* The rows live in a card, the way privacy.tsx's bullets do — see the header. */}
        <View style={[styles.rowsCard, { backgroundColor: theme.surface }]}>
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
                <Text style={[styles.rowNote, { color: theme.textMuted }]}>{note}</Text>
              ) : null}
            </View>
          );
        })}
        </View>

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
          // Matte glass, from the same `glassKey` every other action pill uses (2026-08-17).
          // `glassKey` is a PURE function of a colour and a boolean, so it is one of the few
          // shared pieces this screen can use — see the header note on why it hand-rolls the rest.
          style={[styles.footerBtn, glassKey(theme.accent, isDark)]}
          accessibilityRole="button"
          accessibilityLabel={t.firstRun.continue}
        >
          <Text style={[styles.footerBtnText, { color: theme.text }]}>{t.firstRun.continue}</Text>
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
const START_SCREEN_LABELS: Record<StartScreen, (t: Translations) => string> = {
  home: (t: Translations) => t.nav.home,
  shopping: (t: Translations) => t.nav.shop,
  health: (t: Translations) => t.nav.health,
};

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  // **Laid out like privacy.tsx and restore.tsx (2026-08-14)** — `flexGrow`, `Spacing.xl`
  // rhythm, centred column. Maintainer, on device: *"The 'setup basics' is not a part of the
  // introduction, and looks bad."* It wasn't: this was a left-aligned settings form with no
  // `flexGrow`, no `alignItems` and no container, top-anchored above a large dead band, in a
  // flow whose other two screens are a centred hero over a card. Worse, the centring it DID
  // have was applied only on the `!showAllRows` branch, so the same screen had two different
  // alignments depending on whether you arrived from a fresh install or from Settings.
  scrollContent: {
    flexGrow: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
    alignItems: 'center',
  },
  // See the ScrollView's comment — short content only.
  scrollContentCentered: { justifyContent: 'center' },
  top: { alignItems: 'center', gap: Spacing.xs },
  // icon.png is a flat opaque square (no alpha) — round it here so it reads as an app-icon
  // tile rather than a hard-edged sticker against the screen's own colour. Shadow lives on the
  // outer view (a shadow and `overflow:hidden` fight on the same node); the inner view does
  // the actual rounding + clip, and the image just fills it.
  appIconShadow: { width: 96, height: 96, marginBottom: Spacing.xs, ...Shadow.card },
  appIconClip: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  appIcon: { width: '100%', height: '100%' },
  heading: { fontSize: FontSize.xxl, fontFamily: Fonts.semibold, textAlign: 'center' },
  sub: { fontSize: FontSize.md, lineHeight: 22, textAlign: 'center' },
  // The rows' container, matching privacy.tsx's `bulletCard` — same radius, same shadow, same
  // vertical rhythm — but **`Spacing.sm` horizontally, not that card's `Spacing.md`.**
  //
  // Horizontal chrome stacks, and this card holds three-across PILL ROWS rather than text.
  // Wrapping the rows cost them 2 × Spacing.md on top of the screen's own Spacing.lg, and
  // `npm run wraps --lang=no --width=327` caught the result immediately: "Standard" truncated
  // in the text-size row, which is the selected pill and so also carries a checkmark. A row of
  // n equal flex pills has a hard floor that a paragraph does not — the same arithmetic behind
  // AGENTS.md's weekday-chip note — so this card gets the tightest inset that still reads as a
  // card, and privacy's `Spacing.md` is the right number only for the card that holds prose.
  rowsCard: {
    width: '100%',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.lg,
    ...Shadow.card,
  },
  row: { gap: Spacing.xs },
  rowLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold, textAlign: 'center' },
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
    // 2px horizontally, not Spacing.xs. The tight case is the text-size row's "Standard" —
    // three equal pills, and the selected one also carries a checkmark — which `npm run wraps
    // --lang=no --width=327` truncated once these rows moved inside a card. The label is
    // centred and the pill's own edge is what bounds it, so horizontal padding here buys
    // nothing but a smaller label; the tap target is unaffected (minHeight, and the pill
    // spans a third of the row).
    paddingHorizontal: 2,
    paddingVertical: Spacing.xs,
  },
  pillCheck: { marginRight: -2 },
  pillText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, flexShrink: 1 },
  rowDesc: { fontSize: FontSize.sm, lineHeight: 18, textAlign: 'center' },
  // Was a left accent bar (`borderLeftWidth: 2` + `paddingLeft`), which fought the centred
  // column — a rule down the left of centred text reads as a misalignment rather than an
  // accent. Italic carries "this is an aside" on its own, the way the app's explainer line
  // does. This is the OS-reduce-motion note; it appears on at most one row at a time.
  rowNote: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 2,
  },
  settingsNote: { fontSize: FontSize.sm, lineHeight: 18, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  // `Radius.full` and 12/22 padding are components/Button.tsx's `size="md"` geometry, which is
  // what privacy.tsx and restore.tsx draw. These stay hand-rolled — `Button` reads the store,
  // and this screen previews an UNCOMMITTED theme from local state (see the header) — so the
  // shape has to be copied rather than imported. `MIN_TAP_TARGET` is 48, which is also that
  // size's height, so the two agree by construction rather than by coincidence.
  footerBtn: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  footerBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold, textAlign: 'center' },
});
