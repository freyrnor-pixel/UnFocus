/**
 * index.tsx — Onboarding welcome + name capture (guided step 1 of 5)
 *
 * First guided step after the language/guided choice. Shows feature highlights
 * and a text field for the user's name, then advances into the setup wizard.
 *
 * Connections:
 *   Imports → @expo/vector-icons, @/store/useSettingsStore, @/lib/i18n, @/constants/theme,
 *             @/lib/useAppTheme, @/components/Button
 *   Used by → Expo Router route "/onboarding"
 *   Data    → useSettingsStore (writes `userName`)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - next() writes `userName` (trimmed) to settings, then router.push to "/onboarding/step2".
 *   - Progress dot index 0 here; keep the 6-dot row in sync across steps.
 *   - Decision 006 tokens throughout — no raw hex, no legacy theme.* names.
 */
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function OnboardingWelcome() {
  const router = useRouter();
  const update = useSettingsStore((s) => s.update);
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [name, setName] = useState('');

  function next() {
    update({ userName: name.trim() });
    router.push('/onboarding/step2');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name at the top — first impression */}
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.whatsYourName}</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.accent, backgroundColor: theme.surface }]}
              value={name}
              onChangeText={setName}
              placeholder={t.namePlaceholder}
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.accent}
              returnKeyType="done"
              onSubmitEditing={next}
              autoFocus={false}
            />
            <Text style={[styles.hint, { color: theme.textMuted }]}>{t.nameHint}</Text>
          </View>

          <View style={styles.top}>
            <View style={styles.logoShadow}>
              <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={[styles.heading, { color: theme.text }]}>{t.welcomeHeading}</Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>{t.welcomeSub}</Text>
          </View>

          <View style={[styles.featureList, { backgroundColor: theme.surface }]}>
            {t.features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name={f.icon as IoniconsName} size={20} color={theme.accent} />
                <Text style={[styles.featureText, { color: theme.text }]}>{f.text}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.noteBox, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.noteText, { color: theme.text }]}>{t.onboardingSettingsNote}</Text>
          </View>

          <View style={styles.progress}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: theme.border },
                  i === 0 && { ...styles.dotActive, backgroundColor: theme.accent },
                ]}
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t.getStarted}
            onPress={next}
            variant="primary"
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.md },
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
    lineHeight: 24,
  },
  featureList: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  featureText: { flex: 1, fontSize: FontSize.md, lineHeight: 22 },
  card: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.card,
  },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  input: {
    borderRadius: Radius.sm,
    borderWidth: 2,
    padding: Spacing.md,
    fontSize: FontSize.lg,
  },
  hint: { fontSize: FontSize.xs, lineHeight: 18 },
  noteBox: { borderRadius: Radius.md, padding: Spacing.md },
  noteText: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  progress: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { width: 20 },
  footer: { padding: Spacing.xl, paddingTop: Spacing.md },
});
