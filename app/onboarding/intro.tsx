/**
 * intro.tsx — Short "what UnFocus does" tour (guided path, before the name step)
 *
 * Replaces the old 4-step setup wizard (work mode / shopping days / notifications /
 * handedness). Those settings now default and are taught in context on each screen's
 * first-run ⓘ hint; this tour is pure orientation. One short, non-scrolling page per
 * feature (from t.features): a centered icon "up in the middle", a one-line use-case,
 * and a reminder that every screen has an ⓘ hint bubble. Stepped with Next/Back — the
 * last page continues to the name step (index.tsx), which finishes onboarding.
 *
 * Connections:
 *   Imports → @/lib/i18n, @/constants/theme, @/lib/useAppTheme, @/components/Button
 *   Used by → Expo Router route "/onboarding/intro" (pushed from onboarding/guided.tsx)
 *   Data    → none (presentational; writes happen on the name step)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text.
 *   - Page content is t.features (icon + text); dots count = t.features.length.
 *   - No vertical scroll — each page is sized to one viewport (justifyContent:'center').
 *   - Next on the last page → router.push('/onboarding') (the name + finish screen).
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

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function OnboardingIntro() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [page, setPage] = useState(0);

  const features = t.features;
  const last = features.length - 1;
  const feature = features[page];

  function next() {
    if (page < last) setPage((p) => p + 1);
    else router.push('/onboarding');
  }

  function back() {
    if (page > 0) setPage((p) => p - 1);
    else router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.pageBody}>
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name={feature.icon as IoniconsName} size={44} color={theme.accent} />
          </View>
          <Text style={[styles.featureText, { color: theme.text }]}>{feature.text}</Text>
          <View style={[styles.hintNote, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
            <Text style={[styles.hintNoteText, { color: theme.textMuted }]}>{t.introHintNote}</Text>
          </View>
        </View>

        <View style={styles.progress}>
          {features.map((_, i) => (
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  hintNoteText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
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
