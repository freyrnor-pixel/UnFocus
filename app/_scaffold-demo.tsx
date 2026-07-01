/**
 * _scaffold-demo.tsx — temporary demo screen for ScreenScaffold verification.
 *
 * Not added to navigation; accessible only via direct navigation for testing.
 * Renders both tier='site' and tier='sub' variants to verify the scaffold
 * composes correctly. Delete after visual review (flagged in PROGRESS_LOG.md).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, lib/i18n
 *   Used by → none (demo only, not routed)
 *
 * Edit notes:
 *   - This file will be deleted after Phase 1 visual review.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/lib/useAppTheme';
import { FontSize, Spacing } from '@/constants/theme';
import ScreenScaffold from '@/components/ScreenScaffold';
import { useT } from '@/lib/i18n';

export default function ScaffoldDemo() {
  const [variant, setVariant] = useState<'site' | 'sub'>('site');
  const theme = useAppTheme();
  const router = useRouter();
  const t = useT();

  const handleToggle = () => {
    setVariant(variant === 'site' ? 'sub' : 'site');
  };

  const handleBack = () => {
    router.back();
  };

  const headerRight = variant === 'sub' ? (
    <Pressable onPress={() => alert('Right action pressed')}>
      <Text style={[styles.actionText, { color: theme.orange }]}>Action</Text>
    </Pressable>
  ) : null;

  return (
    <ScreenScaffold
      title={variant === 'site' ? 'Home' : 'Sub-screen'}
      tier={variant}
      isHome={variant === 'site'}
      onBack={handleBack}
      headerRight={headerRight}
    >
      <View style={[styles.content, { backgroundColor: theme.cream }]}>
        <Text style={[styles.heading, { color: theme.text }]}>
          Scaffold Demo
        </Text>
        <Text style={[styles.subtitle, { color: theme.textLight }]}>
          Current tier: {variant}
        </Text>

        <Pressable
          style={[styles.button, { backgroundColor: theme.orange }]}
          onPress={handleToggle}
        >
          <Text style={[styles.buttonText, { color: theme.white }]}>
            Toggle to {variant === 'site' ? 'sub' : 'site'} tier
          </Text>
        </Pressable>

        <View style={[styles.infoBox, { borderColor: theme.border }]}>
          <Text style={[styles.infoText, { color: theme.text }]}>
            {variant === 'site'
              ? 'Site tier: Shows Settings (left) and Focus (right) icons. Bottom nav visible.'
              : 'Sub tier: Shows back link on iOS (Android uses system back). Right slot for custom action. No bottom nav.'}
          </Text>
        </View>

        <Text style={[styles.label, { color: theme.textLight }]}>
          Content scrolls behind header and bottom nav ↑↓
        </Text>

        {Array.from({ length: 10 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.demoCard,
              { backgroundColor: theme.white, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.cardText, { color: theme.text }]}>
              Demo Card {i + 1}
            </Text>
          </View>
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  actionText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  label: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
  },
  demoCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardText: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
});
