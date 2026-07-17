/**
 * language.tsx — Language picker (first onboarding screen)
 *
 * Entry point of the onboarding flow. Lets the user pick English or Norwegian,
 * persisting the choice so all subsequent strings render in that language.
 *
 * Connections:
 *   Imports → assets/icon.png, @expo/vector-icons, @/store/useSettingsStore, @/lib/i18n,
 *             @/constants/theme, @/lib/useAppTheme, @/components/PressableScale
 *   Used by → Expo Router route "/onboarding/language"
 *   Data    → useSettingsStore (writes `language`); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - choose() writes `language` to settings, then router.push to "/onboarding/restore".
 *   - OPTIONS labels are intentionally literal language names (not translated).
 *   - Decision 006 tokens throughout — no raw hex, no legacy theme.* names.
 *   - Top hero image is the real app icon (assets/icon.png, the watercolor tree mark),
 *     not an Ionicons badge — this is the first thing a new user sees. Same
 *     logoShadow/logo pattern as app/onboarding/index.tsx's welcome logo, for consistency.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';
import type { Language } from '@/store/useSettingsStore';

type LangOption = {
  code: Language;
  flag: string;
  label: string;
  sublabel: string;
};

const OPTIONS: LangOption[] = [
  { code: 'en', flag: '🇬🇧', label: 'English', sublabel: 'English' },
  { code: 'no', flag: '🇳🇴', label: 'Norsk', sublabel: 'Norwegian' },
];

export default function LanguageScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  function choose(lang: Language) {
    settings.update({ language: lang });
    router.push('/onboarding/restore');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.top}>
          <View style={styles.logoShadow}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" fadeDuration={0} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.chooseLanguage}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.chooseLanguageSub}</Text>
        </View>

        <View style={styles.optionsRow}>
          {OPTIONS.map((opt) => (
            <PressableScale
              key={opt.code}
              style={[
                styles.option,
                { backgroundColor: theme.surface, borderColor: theme.border },
                settings.language === opt.code && { borderColor: theme.accent },
              ]}
              onPress={() => choose(opt.code)}
              scaleTo={0.97}
            >
              <Text style={styles.flag}>{opt.flag}</Text>
              <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
              <Text style={[styles.optionSub, { color: theme.textMuted }]}>{opt.sublabel}</Text>
              {settings.language === opt.code && (
                <View style={[styles.checkmark, { backgroundColor: theme.accent }]}>
                  <Ionicons name="checkmark" size={14} color={theme.accentInk} />
                </View>
              )}
            </PressableScale>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.xl,
    justifyContent: 'center',
  },
  top: { alignItems: 'center', gap: Spacing.md },
  logoShadow: { borderRadius: Radius.lg, ...Shadow.card },
  logo: { width: 110, height: 110, borderRadius: Radius.lg, overflow: 'hidden' },
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
  optionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  option: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    position: 'relative',
    ...Shadow.card,
  },
  flag: { fontSize: 48 },
  optionLabel: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.semibold,
  },
  optionSub: {
    fontSize: FontSize.sm,
  },
  checkmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
