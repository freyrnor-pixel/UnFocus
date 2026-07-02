/**
 * _layout.tsx — root layout for Phase 1 scaffold testing
 *
 * Minimal bootstrap: loads fonts and sets up the Expo Router stack.
 * Full app initialization (stores, notifications, etc.) will be added
 * in later phases. Currently just sets up the basic navigation structure.
 *
 * Connections:
 *   Imports → expo-router, expo-status-bar, lib/useAppTheme, components/AppModal
 *   Used by → router layout — defines the Stack
 *
 * Edit notes:
 *   - Phase 1 focuses on the scaffold foundation. Full app bootstrap (store init,
 *     notifications, reminders) will come in later phases.
 *   - <AppModalHost/> mounted here (Session A2·2, 2026-07-02) per AppModal.tsx's own
 *     header note ("wired in during the screens phase") — app/shopping.tsx is the
 *     first real screen to call showAppModal() (delete-list confirm, done-shopping
 *     receipt choice, new-list chooser), so the host needs to exist before it renders.
 */
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import AppModalHost from '@/components/AppModal';

export default function RootLayout() {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.cream },
          headerShown: false,
          animationEnabled: true,
        }}
      />
      <AppModalHost />
    </GestureHandlerRootView>
  );
}
