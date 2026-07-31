/**
 * restore.tsx — "Have you used UnFocus before?" (onboarding step between language and privacy)
 *
 * Gives a returning user a way back in before they start a fresh setup: pick a
 * backup file and restore all data (which replaces the whole DB and reloads the
 * app — the restored settings row already has setup_complete = 1, so the reload
 * lands on Home). A new user continues to the privacy screen. Placed right after
 * language because a restore overwrites everything, so it must run before any
 * fresh setup is entered.
 *
 * Connections:
 *   Imports → @/lib/i18n, @/constants/theme, @/lib/useAppTheme, @/components/Button,
 *             @/components/AppModal (showAppModal), @/lib/backup
 *             (pickAndParseBackup/restoreBackup/reloadApp), @/lib/haptics, @expo/vector-icons
 *   Used by → Expo Router route "/onboarding/restore" (pushed from onboarding/basics.tsx)
 *   Data    → via lib/backup: restore DELETEs+re-INSERTs every table in unfocus.db
 *
 * Edit notes:
 *   - All strings through useT(); the restore flow reuses the existing t.backup.*
 *     confirm/error strings (shared with app/settings.tsx's handleImport).
 *   - "No, I'm new" navigates to /onboarding/privacy; Previous goes back to language.
 *   - `busy` guards against double-taps while the file picker / restore runs.
 *   - **Hero icon is a themed badge, not an emoji (2026-07-27, user report)**: this page used a
 *     raw 💾 `<Text>` where every sibling onboarding page renders an accent-circle `iconBadge` +
 *     Ionicons (intro.tsx, features.tsx, guided.tsx). The emoji ignored the theme entirely and
 *     broke the flow's visual continuity. Keep any future illustration on the badge pattern.
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
import { showAppModal } from '@/components/AppModal';
import { pickAndParseBackup, restoreBackup, reloadApp } from '@/lib/backup';
import { warning, heavy } from '@/lib/haptics';

export default function RestoreScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [busy, setBusy] = useState(false);

  async function handleRestore() {
    if (busy) return;
    setBusy(true);
    try {
      const parsed = await pickAndParseBackup();
      if (parsed.status === 'canceled') return;
      if (parsed.status === 'invalid') {
        showAppModal(t.backup.title, t.backup.invalidFile);
        return;
      }
      if (parsed.status === 'tooNew') {
        showAppModal(t.backup.title, t.backup.tooNew);
        return;
      }
      warning();
      showAppModal(t.backup.importConfirmTitle, t.backup.importConfirmBody(parsed.rowCount), [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.backup.importConfirmBtn,
          style: 'destructive',
          onPress: () => {
            heavy();
            try {
              restoreBackup(parsed.data);
            } catch {
              showAppModal(t.backup.title, t.backup.restoreError);
              return;
            }
            showAppModal(t.backup.title, t.backup.restoreDone, [
              { text: t.ok, onPress: () => { void reloadApp(); } },
            ]);
          },
        },
      ]);
    } finally {
      setBusy(false);
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
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="cloud-download-outline" size={44} color={theme.accent} />
          </View>
          <Text style={[styles.headline, { color: theme.text }]}>{t.onboarding.restore.headline}</Text>
        </View>

        <View style={[styles.bulletCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.bodyText, { color: theme.text }]}>{t.onboarding.restore.body}</Text>
        </View>

        <Button
          label={t.onboarding.restore.restoreCta}
          onPress={handleRestore}
          variant="primary"
          size="md"
          disabled={busy}
        />
        <Button
          label={t.onboarding.restore.newCta}
          onPress={() => router.push('/onboarding/privacy')}
          variant="ghost"
          size="md"
        />
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
    flexGrow: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  top: { alignItems: 'center', gap: Spacing.md },
  // Same accent-circle badge every other onboarding page uses (intro/features/guided) — see
  // the 2026-07-27 edit note above.
  iconBadge: {
    width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center',
  },
  headline: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.semibold,
    textAlign: 'center',
  },
  bulletCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: '100%',
    ...Shadow.card,
  },
  bodyText: {
    fontSize: FontSize.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: { paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
});
