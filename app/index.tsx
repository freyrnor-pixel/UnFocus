/**
 * index.tsx — Phase 1 placeholder / demo entry point
 *
 * Temporary entry point for Phase 1. Shows a simple welcome screen
 * and a link to the scaffold demo. Will be replaced with the full
 * home screen in later phases.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, lib/i18n, lib/useAppTheme
 *   Used by → Expo Router (home route)
 *
 * Edit notes:
 *   - This is a placeholder for Phase 1 foundation testing only.
 *   - Will be replaced with the full home screen (index.tsx) from
 *     All-the-small-things in phase 6.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/lib/useAppTheme';
import { FontSize, Spacing } from '@/constants/theme';
import ScreenScaffold from '@/components/ScreenScaffold';
import { useT } from '@/lib/i18n';

export default function Home() {
  const theme = useAppTheme();
  const router = useRouter();
  const t = useT();

  const handleViewDemo = () => {
    // Navigate to the demo screen
    router.push('/_scaffold-demo' as any);
  };

  return (
    <ScreenScaffold title="UnFocus" tier="site" isHome>
      <View style={[styles.content, { backgroundColor: theme.cream }]}>
        <Text style={[styles.heading, { color: theme.text }]}>
          Welcome to UnFocus Rebuild
        </Text>
        <Text style={[styles.subtitle, { color: theme.textLight }]}>
          Phase 1: Foundation & Screen Scaffold
        </Text>

        <View style={[styles.box, { backgroundColor: theme.white, borderColor: theme.border }]}>
          <Text style={[styles.boxText, { color: theme.text }]}>
            The universal screen scaffold is now ready. All screens will use ScreenScaffold
            to compose consistent layouts with material-aware chrome (translucent header and
            bottom navigation).
          </Text>
        </View>

        <Pressable
          style={[styles.button, { backgroundColor: theme.orange }]}
          onPress={handleViewDemo}
        >
          <Text style={[styles.buttonText, { color: theme.white }]}>
            View Scaffold Demo
          </Text>
        </Pressable>

        <Text style={[styles.label, { color: theme.textLight }]}>
          Next phases will port remaining components and screens.
        </Text>
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
  box: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  boxText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
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
  label: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
  },
});
