/**
 * intro.tsx — Short "what UnFocus does" tour (guided path, before the name step)
 *
 * Replaces the old 4-step setup wizard (work mode / shopping days / notifications /
 * handedness). Those settings now default and are taught in context on each screen's
 * first-run ⓘ hint; this tour is pure orientation. Three kinds of short, non-scrolling
 * page, each a centered icon "up in the middle" plus a line of copy:
 *   1. 'feature'      — one per t.features entry (Home, to-do, shopping, habits,
 *                       health, energy) + the "look for the ⓘ" reminder.
 *   2. 'principles'   — t.introPrinciples: the criteria the app is designed within.
 *   3. 'experimental' — t.introExperimental: this is a work-in-progress build.
 * Stepped with Next/Back — the last page continues to the feature picker (features.tsx),
 * which then hands off to the name step (index.tsx) to finish onboarding.
 *
 * Connections:
 *   Imports → @/lib/i18n, @/constants/theme, @/lib/useAppTheme, @/components/Button,
 *             @/components/PressableScale, @/components/AppModal (showAppModal),
 *             @/lib/aiSetupGuide (exportAiSetupGuide)
 *   Used by → Expo Router route "/onboarding/intro" (pushed from onboarding/guided.tsx)
 *   Data    → none (presentational; writes happen on the name step). The "experimental"
 *             page's download link writes a .txt to the cache dir + opens the share
 *             sheet (exportAiSetupGuide) — no app data is touched.
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - Pages are built in `pages` (t.features + the two closing pages); the dot count
 *     follows pages.length, so adding a feature needs no change here.
 *   - No vertical scroll — each page is sized to one viewport (justifyContent:'center').
 *     The principles page is the tallest; keep its bullets short rather than adding a
 *     ScrollView.
 *   - Next on the last page → router.push('/onboarding/features') (the "what do you want to
 *     use?" picker, which continues to the name + finish screen).
 *   - The "download AI setup guide" link on the experimental page only downloads (share
 *     sheet) — no upload/import here, since onboarding has no existing data yet to
 *     configure; upload lives only in Settings (app/settings.tsx). Same
 *     exportAiSetupGuide() call as Settings' handler, duplicated locally rather than
 *     shared — two call sites don't need an abstraction.
 *   - **Bordered hintNote (2026-07-26, user report)**: the ⓘ/principle/experimental info
 *     boxes were a flat `surfaceMuted` fill with no edge — the same "borderless chip reads as
 *     floating text" bug AddRow's and Stepper's collapsed pills had (see those files' 2026-07-25
 *     notes). Added `theme.border` at 1px, matching HintCard's convention for the same kind of
 *     ⓘ info box.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import { showAppModal } from '@/components/AppModal';
import { selection } from '@/lib/haptics';
import { exportAiSetupGuide } from '@/lib/aiSetupGuide';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type IntroPage =
  | { kind: 'feature'; icon: string; text: string }
  | { kind: 'principles' }
  | { kind: 'experimental' };

export default function OnboardingIntro() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [page, setPage] = useState(0);

  const pages: IntroPage[] = [
    ...t.features.map((f) => ({ kind: 'feature' as const, icon: f.icon, text: f.text })),
    { kind: 'principles' },
    { kind: 'experimental' },
  ];
  const last = pages.length - 1;
  const current = pages[page];

  function next() {
    if (page < last) setPage((p) => p + 1);
    else router.push('/onboarding/features');
  }

  function back() {
    if (page > 0) setPage((p) => p - 1);
    else router.back();
  }

  async function handleDownloadAiGuide() {
    selection();
    try {
      const result = await exportAiSetupGuide();
      if (result === 'unavailable') showAppModal(t.aiSetup.title, t.aiSetup.sharingUnavailable);
    } catch {
      showAppModal(t.aiSetup.title, t.aiSetup.exportError);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.pageBody}>
          {current.kind === 'feature' && (
            <>
              <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name={current.icon as IoniconsName} size={44} color={theme.accent} />
              </View>
              <Text style={[styles.featureText, { color: theme.text }]}>{current.text}</Text>
              <View style={[styles.hintNote, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
                <Text style={[styles.hintNoteText, { color: theme.textMuted }]}>{t.introHintNote}</Text>
              </View>
            </>
          )}

          {current.kind === 'principles' && (
            <>
              <View style={[styles.iconBadgeSm, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="heart-circle-outline" size={36} color={theme.accent} />
              </View>
              <Text style={[styles.featureText, { color: theme.text }]}>{t.introPrinciples.title}</Text>
              <View style={styles.bulletList}>
                {t.introPrinciples.bullets.map((b) => (
                  <View key={b.text} style={[styles.hintNote, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                    <Ionicons name={b.icon as IoniconsName} size={18} color={theme.accent} />
                    <Text style={[styles.hintNoteText, { color: theme.textMuted }]}>{b.text}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {current.kind === 'experimental' && (
            <>
              <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="flask-outline" size={44} color={theme.accent} />
              </View>
              <Text style={[styles.featureText, { color: theme.text }]}>{t.introExperimental.title}</Text>
              <View style={[styles.hintNote, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Ionicons name="construct-outline" size={18} color={theme.accent} />
                <Text style={[styles.hintNoteText, { color: theme.textMuted }]}>{t.introExperimental.body}</Text>
              </View>
              <PressableScale onPress={handleDownloadAiGuide} style={styles.aiGuideLink} scaleTo={0.97}>
                <Ionicons name="download-outline" size={16} color={theme.accent} />
                <Text style={[styles.aiGuideLinkText, { color: theme.accent }]}>{t.aiSetup.downloadButton}</Text>
              </PressableScale>
            </>
          )}
        </View>

        <View style={styles.progress}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: theme.border },
                i === page && { ...styles.dotActive, backgroundColor: theme.accent },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button label={t.previous} onPress={back} variant="ghost" size="md" />
        <Button
          label={page < last ? t.next : t.getStarted}
          onPress={next}
          variant="primary"
          size="md"
        />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.xl },
  pageBody: { alignItems: 'center', gap: Spacing.lg },
  iconBadge: {
    width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center',
  },
  // Smaller badge for the principles page — it carries three bullet rows and has to
  // stay inside one viewport without scrolling.
  iconBadgeSm: {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
  },
  bulletList: { alignSelf: 'stretch', gap: Spacing.sm },
  featureText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
    lineHeight: 28,
  },
  hintNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  hintNoteText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  aiGuideLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  aiGuideLinkText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
});
