/**
 * privacy.tsx — the LAST onboarding screen: the local-only promise, and the way in.
 *
 * Onboarding is two screens as of 2026-08-03 (basics → privacy). This one states that no
 * data leaves the device and that the app is free, then finishes setup. It also carries the
 * two things that used to be screens of their own: the backup restore, and the AI setup guide.
 *
 * **What this replaced, and why.** Onboarding was six screens — basics, restore, privacy,
 * a three-way "how do you want to start?" branch, an Energy explainer, and a name field —
 * followed by the five-step guided tour. A first-time-user walkthrough (2026-08-03) found
 * that a new user made roughly eighteen decisions before seeing a single real screen, and
 * still could not say what the app was for. Every screen removed here was removed because it
 * asked for something before it had earned the right to:
 *   - **restore** asked every NEW user a returning user's question. It is a link on this
 *     screen now, where the person who needs it will look for it and nobody else pays for it.
 *   - **guided** offered three peer ways to start, one of them ("Set it up with an AI") a
 *     power-user round trip through an external chatbot, on screen four of a fresh install.
 *     The guided tour it gated runs unconditionally now — it is already skippable from every
 *     step, which is what the branch was really buying. The AI guide is the link below.
 *   - **energy** made the user choose between Energy and Rewards having seen neither, under a
 *     heading that opened by explaining why it needed explaining. Energy is on by default
 *     (it always was); the strip on Home now names itself and can be set from where it is
 *     (components/EnergyMeter.tsx), and Rewards mode lives in Settings → Advanced.
 *   - **index** (the name field) was optional and used only to say hi. Settings → General →
 *     Profile already has the same field, and it already calls publishSelfName on blur.
 *
 * **This screen owns the ONLY completion path**, `finishSetup()` — moved here wholesale from
 * the deleted guided.tsx, stamp for stamp. Both ways off this screen (Start, and a successful
 * AI export) go through it. Two hand-written completions is exactly the shape that drifts into
 * one path forgetting `setupComplete`, and __tests__/onboardingFlow.test.ts pins the single
 * write site.
 *
 * Connections:
 *   Imports → @/lib/i18n, @/constants/theme, @/lib/useAppTheme, @/components/Button,
 *             @/components/PressableScale, @/components/AppModal (showAppModal),
 *             @/store/useSettingsStore, @/store/useTaskStore, @/lib/notifications
 *             (requestPermissions), @/lib/reminders (syncReminders), @/lib/date (todayStr),
 *             @/lib/aiSetupGuide (exportAiSetupGuide)
 *   Used by → Expo Router route "/onboarding/privacy" (pushed from onboarding/basics.tsx)
 *   Data    → useSettingsStore (writes `setupComplete` + `lastMonthlyReset` via finishSetup);
 *             schedules reminders via syncReminders() + useTaskStore.syncAllTaskNotifications()
 *
 * Edit notes:
 *   - All strings through useT().
 *   - The `lastMonthlyReset: todayStr()` stamp is load-bearing and predates this file owning
 *     it: a fresh install's default '' always satisfies "haven't reset this period", so
 *     Shopping's auto-reset-review sheet fires on the very first Shopping visit and covers the
 *     first-visit ⓘ hint underneath it.
 *   - goAiSetup() finishes ONLY once exportAiSetupGuide() actually shared a file. A failed or
 *     unavailable export reports through showAppModal and leaves the user here with Start
 *     still on screen — never stranded mid-onboarding with no way on.
 *   - **One primary action** (rule 6). Start is the button; restore and the AI guide are plain
 *     links below it, deliberately not cards. They were cards on the deleted branch screen and
 *     that is precisely what made a first-time user read the AI round trip as something they
 *     were expected to consider.
 *   - Decision 006 tokens throughout — no raw hex, no legacy theme.* names.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import { showAppModal } from '@/components/AppModal';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { requestPermissions } from '@/lib/notifications';
import { syncReminders } from '@/lib/reminders';
import { todayStr } from '@/lib/date';
import { exportAiSetupGuide } from '@/lib/aiSetupGuide';

export default function PrivacyScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [aiBusy, setAiBusy] = useState(false);

  // The single completion path — every way out of onboarding calls it, so no future edit can
  // leave one branch finishing setup and another not. See the header for the lastMonthlyReset
  // stamp's reason.
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

  // Download the guide, then finish. Order matters: the file has to be in the user's hands
  // before we navigate away, and a failed export must NOT complete setup.
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
          {/* Ionicons, not emoji (2026-07-28). A full-colour 🔒 glyph at 72px is a different
              vendor's artwork on every device, ignores the theme entirely, and reads as
              clip-art next to the app's own outline iconography. Outline glyphs in the
              theme's accent match the rest of the app and follow dark mode. */}
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="lock-closed-outline" size={40} color={theme.accent} />
          </View>
          <Text style={[styles.headline, { color: theme.text }]}>{t.onboarding.privacy.headline}</Text>
        </View>

        <View style={[styles.bulletCard, { backgroundColor: theme.surface }]}>
          <View style={styles.bulletRow}>
            <Ionicons name="phone-portrait-outline" size={22} color={theme.accent} style={styles.bullet} />
            <Text style={[styles.bulletText, { color: theme.text }]}>{t.onboarding.privacy.local}</Text>
          </View>
          <View style={styles.bulletRow}>
            <Ionicons name="heart-outline" size={22} color={theme.good} style={styles.bullet} />
            <Text style={[styles.bulletText, { color: theme.text }]}>{t.onboarding.privacy.free}</Text>
          </View>
        </View>

        <Button label={t.onboarding.privacy.cta} onPress={finishSetup} variant="primary" size="md" />

        {/* The two secondary ways off this screen. Plain links, below the primary, quiet on
            purpose — see the header's note on why these were the wrong thing as cards. */}
        <View style={styles.links}>
          <PressableScale
            onPress={() => router.push('/onboarding/restore')}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={t.onboarding.privacy.restoreLink}
          >
            <Text style={[styles.link, { color: theme.accent }]}>{t.onboarding.privacy.restoreLink}</Text>
          </PressableScale>
          <PressableScale
            onPress={goAiSetup}
            disabled={aiBusy}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={t.aiSetupBtn}
          >
            <Text style={[styles.link, { color: theme.accent }]}>{`${t.aiSetupBtn} →`}</Text>
          </PressableScale>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.previous} onPress={() => router.back()} variant="ghost" size="md" />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  top: { alignItems: 'center', gap: Spacing.md },
  // A soft accent disc behind the glyph, so the hero icon still has the visual weight the
  // 72px emoji had without being a picture.
  iconBadge: {
    width: 84,
    height: 84,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
  },
  // Horizontal padding trimmed lg -> md (2026-07-28 wrap audit): this card sat inside the
  // screen's own padding, and the two together left its text only 238px of a 393px phone —
  // 40% of the width gone to chrome, which is what pushed "UnFocus er gratis og vil alltid
  // være det." onto a second line. Vertical padding is untouched; onboarding still breathes.
  bulletCard: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    width: '100%',
    ...Shadow.card,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  // Nudged down a hair so a 22px glyph sits on the first text line's optical centre.
  bullet: { marginTop: 1 },
  bulletText: {
    flex: 1,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  // Secondary links, stacked and centred under the primary. `gap` rather than margins so the
  // pair reads as one group rather than two strays.
  links: { alignItems: 'center', gap: Spacing.md },
  link: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, textAlign: 'center' },
  footer: { paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
});
