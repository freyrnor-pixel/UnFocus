/**
 * guided.tsx — the branch point: Guided vs Explore vs AI setup
 *
 * Three peer ways to start. "Guided" explains Energy, then takes the name step; "Explore"
 * skips both and jumps straight to the home screen, marking setup complete and leaving every
 * optional feature at its off default; "AI setup" (2026-08-02) downloads the AI setup guide
 * .txt and then finishes exactly like Explore, so the user lands in a working app with the
 * file saved and uploads the AI's reply from Settings later. (A feature picker sat between
 * the first two screens until 2026-07-31 — deleted, its switches kept in Settings.) The
 * per-screen ⓘ hints (which teach the settings the old wizard collected) are available on
 * every path — components/HintCard.tsx always renders its pill, and first-visit auto-expand
 * is driven by settings.seenScreenHints.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/store/useTaskStore, @/lib/notifications,
 *             @/lib/reminders, @/lib/date (todayStr), @/lib/aiSetupGuide
 *             (exportAiSetupGuide), @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/components/Button, @/components/Surface, @/components/PressableScale,
 *             @/components/AppModal (showAppModal)
 *   Used by → Expo Router route "/onboarding/guided"
 *   Data    → useSettingsStore (Explore and AI setup both write `setupComplete` +
 *             `lastMonthlyReset` through finishSetup(), then schedule reminders like the
 *             name-step finish; Guided writes nothing here)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - goGuided() → router.push "/onboarding/energy" (the Energy explainer → name step). The
 *     old 8-page intro slideshow it used to open is deleted; the guided tour now runs on the
 *     real app after onboarding (lib/tourSteps.ts).
 *   - Every path ends on "/" — app/onboarding/basics.tsx is screen ONE now and has already
 *     written firstRunComplete, so there is no personalization step left to route through.
 *   - **finishSetup() is the ONLY place this screen completes setup**, and both goExplore()
 *     and goAiSetup() go through it — two hand-written copies would eventually drift into one
 *     path finishing and the other not. It sets setupComplete + lastMonthlyReset (stamped to
 *     today, 2026-07-26 — same fix and same reason as app/onboarding/index.tsx's finish(): a
 *     fresh install's default '' otherwise always trips Shopping's auto-reset-review sheet on
 *     the very first Shopping visit, covering the first-visit ⓘ hint underneath it) and runs
 *     the same reminder sync as the name step's finish() (parity), then router.replace "/".
 *     __tests__/onboardingFlow.test.ts pins the single write site and both callers.
 *   - goAiSetup() finishes ONLY once exportAiSetupGuide() actually shared a file. A failed or
 *     unavailable export reports through showAppModal and leaves the user on this screen with
 *     the other two options still there — never stranded mid-onboarding with no way on.
 *   - No selection() haptic on the AI card (unlike components/TourSpotlight.tsx's
 *     handleAiGuide, which sits on a plain Button): PressableScale already fires one on a
 *     completed press, so calling it here would double up.
 *   - All three option cards sit on the plain glass Surface (theme.text on surface = full
 *     contrast); the recommended (Guided) one is marked by an accent icon badge + a
 *     "Recommended" chip, NOT an accent fill (the old tint={theme.accent} fill put
 *     low-contrast accentInk text on a busy fill — the "too filled / low contrast"
 *     complaint). The AI card is a PEER, not a promotion: neutral badge like Explore's, no
 *     chip. Its trailing icon is a download, not an arrow, because that is the honest
 *     description of what the tap does first. Decision 006 tokens throughout.
 *   - **Bordered recommendedChip (2026-07-26, user report)**: the chip was a flat accentSoft
 *     fill with no edge, the same borderless-chip bug fixed elsewhere (AddRow, Stepper,
 *     intro.tsx's hintNote) — added `theme.border` at 1px so it reads as a contained pill.
 *   - Three cards is the cap here. This screen is a branch point, so a third way to start is
 *     in scope; a fourth option or a sub-step is not (onboarding's anti-overwhelm rule).
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
import { todayStr } from '@/lib/date';
import { exportAiSetupGuide } from '@/lib/aiSetupGuide';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { showAppModal } from '@/components/AppModal';

export default function GuidedScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [aiBusy, setAiBusy] = useState(false);

  function goGuided() {
    router.push('/onboarding/energy');
  }

  // The single completion path for this screen — every non-guided way out calls it, so no
  // future edit can leave one branch finishing setup and another not. Both branches land on
  // the plain opt-in defaults (every optional feature off), which is the whole promise of
  // "jump right in". Schedule reminders the same way the name-step finish() does, so these
  // users aren't left unscheduled.
  // lastMonthlyReset stamp: see app/onboarding/index.tsx's finish() for why — same
  // fix, both places setupComplete flips true on a fresh install.
  function finishSetup() {
    settings.update({ setupComplete: true, lastMonthlyReset: todayStr() });
    if (settings.taskNotificationsEnabled || settings.remindersEnabled) {
      requestPermissions().finally(() => {
        syncReminders();
        useTaskStore.getState().syncAllTaskNotifications();
      });
    } else {
      syncReminders();
      useTaskStore.getState().syncAllTaskNotifications();
    }
    router.replace('/');
  }

  function goExplore() {
    finishSetup();
  }

  // Download the guide, then finish exactly like Explore. Order matters: the file has to be
  // in the user's hands before we navigate away, and a failed export must NOT complete setup
  // — it leaves them here with the other two ways to start still on screen.
  async function goAiSetup() {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const result = await exportAiSetupGuide();
      if (result === 'unavailable') {
        showAppModal(t.aiSetup.title, `${t.aiSetup.sharingUnavailable} ${t.aiSetupPickAnother}`);
        return;
      }
      finishSetup();
    } catch {
      showAppModal(t.aiSetup.title, `${t.aiSetup.exportError} ${t.aiSetupPickAnother}`);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View style={[styles.iconBadge, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="map-outline" size={36} color={theme.accent} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.guidedTitle}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.guidedSub}</Text>
        </View>

        <View style={styles.options}>
          {/* Whole card is the tap target. All three cards read theme.text on the plain glass
              surface (full contrast); the recommended one is marked with an accent icon
              badge + chip rather than a low-contrast accent fill. */}
          <PressableScale
            onPress={goGuided}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t.guidedBtn}
          >
            <Surface style={styles.optionCard}>
              <View style={[styles.optionBadge, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="list-outline" size={22} color={theme.accent} />
              </View>
              <View style={styles.optionText}>
                <View style={styles.optionLabelRow}>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>{t.guidedBtn}</Text>
                  <View style={[styles.recommendedChip, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
                    <Text style={[styles.recommendedChipText, { color: theme.accent }]}>{t.recommended}</Text>
                  </View>
                </View>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>{t.guidedDesc}</Text>
              </View>
              <Ionicons name="arrow-forward" size={22} color={theme.accent} />
            </Surface>
          </PressableScale>

          <PressableScale
            onPress={goExplore}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t.exploreBtn}
          >
            <Surface style={styles.optionCard}>
              <View style={[styles.optionBadge, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="compass-outline" size={22} color={theme.textMuted} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.text }]}>{t.exploreBtn}</Text>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>{t.exploreDesc}</Text>
              </View>
              <Ionicons name="arrow-forward" size={22} color={theme.textMuted} />
            </Surface>
          </PressableScale>

          {/* Third and last: a peer setup path, so no chip and no accent fill. The trailing
              download icon says what the tap does first — the copy carries the rest of the
              round trip (file → an AI → upload in Settings), because a first-run user who
              expects instant magic and gets a .txt has been misled. */}
          <PressableScale
            onPress={goAiSetup}
            disabled={aiBusy}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t.aiSetupBtn}
            accessibilityState={{ disabled: aiBusy }}
          >
            <Surface style={styles.optionCard}>
              <View style={[styles.optionBadge, { backgroundColor: theme.surfaceMuted }]}>
                <Ionicons name="sparkles-outline" size={22} color={theme.textMuted} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.text }]}>{t.aiSetupBtn}</Text>
                <Text style={[styles.optionDesc, { color: theme.textMuted }]}>{t.aiSetupDesc}</Text>
              </View>
              <Ionicons name="download-outline" size={22} color={theme.textMuted} />
            </Surface>
          </PressableScale>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t.previous}
          onPress={() => router.back()}
          variant="ghost"
          size="md"
        />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  top: { alignItems: 'center', gap: Spacing.md },
  iconBadge: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
  },
  heading: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
  },
  sub: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  options: { gap: Spacing.md },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  optionBadge: {
    width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  optionLabel: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semibold,
  },
  recommendedChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  recommendedChipText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
  },
  optionDesc: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  footer: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
});
