/**
 * features.tsx — "What do you want to use?" picker (guided path, after the intro tour)
 *
 * A screen of switches for the still-optional, off-by-default features, so a new user
 * decides what those add instead of meeting every surface at once. Sits between the
 * intro tour and the name step; the Explore path skips it entirely and keeps the same
 * defaults, which is exactly the "just show me the app" behaviour it promises.
 *
 * **Three rows here** — Sharing & QR, Automations, and Bonsai/points (2026-07-31 addition,
 * see lib/bonsai.ts). This screen originally offered six: Energy, Goals, Sharing, Scan,
 * Food, Automations, all unchecked. Maintainer feedback the same day (2026-07-25) changed
 * that: Energy and Goals now default ON (still real toggles, just in Settings → Advanced →
 * Features, not here — an "opt in from nothing" picker doesn't fit a feature that's already
 * on), and Scan & receipts / Food & recipes are permanently on, like Habits/Health, so
 * there's nothing left to offer for either. Sharing, Automations and — as of 2026-07-31 —
 * the Bonsai/points reward system are the genuinely off-by-default opt-ins: unlike Energy/
 * Goals it's pure reward rather than balance/planning, which is exactly the kind of "ask
 * first" feature this picker exists for (see components/BonsaiCard.tsx's header for why it
 * isn't on by default — the app has deliberately avoided score/reward framing elsewhere).
 *
 * Choices are written once on Next; the same three switches live in Settings → Advanced →
 * Features afterwards.
 *
 * Connections:
 *   Imports → @/store/useSettingsStore, @/lib/i18n, @/constants/theme, @/lib/useAppTheme,
 *             @/lib/haptics, @/components/Button, @/components/Surface,
 *             @/components/FormControls (Switch)
 *   Used by → Expo Router route "/onboarding/features" (pushed from onboarding/intro.tsx)
 *   Data    → useSettingsStore (writes featureSharing/featureAutomations/showPoints on Next)
 *
 * Edit notes:
 *   - All user-facing strings go through useT() — no hardcoded text. The per-feature
 *     label/hint copy is shared with the Settings card via t.config.features.*, so a wording
 *     change lands in both places at once.
 *   - Selections are held in local state and committed in ONE settings.update() on Next,
 *     rather than writing per toggle — a half-finished onboarding shouldn't leave a
 *     partially-configured settings row behind if the user backs out.
 *   - Next → router.push('/onboarding') (the name + finish screen), matching what
 *     intro.tsx used to do directly before this step was inserted.
 *   - Adding a still-optional feature: add its flag to store/useSettingsStore.ts + a
 *     lib/db.ts migration, add `config.features.<name>` in BOTH languages, then add one line
 *     to ROWS below and one to FEATURE_ROWS in app/settings.tsx. If a feature instead defaults
 *     on (like Goals) or becomes permanently on (like Scan/Food), it does NOT belong here —
 *     see store/useSettingsStore.ts's per-field docs for the distinction.
 *   - This screen scrolls (unlike intro.tsx, which is sized to one viewport) so it holds up
 *     if a future row is added at the large font-size setting, even though two rows fit
 *     comfortably today.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore, Settings } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { selection } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import Button from '@/components/Button';
import Surface from '@/components/Surface';
import { Switch as FormSwitch } from '@/components/FormControls';

/** The still-optional features offered here, in the order they're shown. */
type FeatureKey = 'featureSharing' | 'featureAutomations' | 'showPoints';

const ROWS: { key: FeatureKey; copy: (t: ReturnType<typeof useT>) => { label: string; hint: string } }[] = [
  { key: 'featureSharing', copy: (t) => t.config.features.sharing },
  { key: 'featureAutomations', copy: (t) => t.config.features.automations },
  { key: 'showPoints', copy: (t) => t.config.features.bonsai },
];

export default function OnboardingFeatures() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  // Start from nothing selected. Deliberately NOT seeded from the current settings row:
  // this step exists to make "off unless you ask for it" the visible starting point.
  const [picked, setPicked] = useState<Record<FeatureKey, boolean>>({
    featureSharing: false,
    featureAutomations: false,
    showPoints: false,
  });

  function toggle(key: FeatureKey, value: boolean) {
    selection();
    setPicked((p) => ({ ...p, [key]: value }));
  }

  function next() {
    settings.update(picked as Partial<Settings>);
    router.push('/onboarding');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="options-outline" size={36} color={theme.accent} />
          </View>
          <Text style={[styles.heading, { color: theme.text }]}>{t.featurePicker.title}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{t.featurePicker.sub}</Text>
        </View>

        <Surface style={styles.card}>
          {ROWS.map(({ key, copy }, i) => (
            <View key={key}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: theme.text }]}>{copy(t).label}</Text>
                  <Text style={[styles.rowHint, { color: theme.textMuted }]}>{copy(t).hint}</Text>
                </View>
                <FormSwitch checked={picked[key]} onChange={(v) => toggle(key, v)} />
              </View>
            </View>
          ))}
        </Surface>

        <View style={[styles.noteCard, { backgroundColor: theme.surfaceMuted }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
          <View style={styles.noteText}>
            <Text style={[styles.note, { color: theme.textMuted }]}>{t.featurePicker.alwaysOn}</Text>
            <Text style={[styles.note, { color: theme.textMuted }]}>{t.featurePicker.note}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.previous} onPress={() => router.back()} variant="ghost" size="md" />
        <Button label={t.next} onPress={next} variant="primary" size="md" />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.md },
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
  card: { borderRadius: Radius.lg, padding: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  rowHint: { fontSize: FontSize.sm, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth },
  noteCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  noteText: { flex: 1, gap: 2 },
  note: { fontSize: FontSize.sm, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
});
