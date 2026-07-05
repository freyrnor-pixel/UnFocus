/**
 * _layout.tsx — Stack navigator for the onboarding flow
 *
 * Defines the Expo Router Stack that wraps every onboarding screen. Hides the
 * native header and applies a slide-from-right transition between steps. A faint,
 * centered tree watermark sits behind every step so the app's brand mark is
 * present from the very first screen (language) onward, not only on the name step.
 *
 * Connections:
 *   Imports → expo-router, react-native, @/components/TreeWatermark, @/lib/useAppTheme
 *   Used by → onboarding stack layout (router layout for /onboarding/*)
 *   Data    → none (presentational)
 *
 * Edit notes:
 *   - headerShown:false here means each screen renders its own SafeAreaView header/footer.
 *   - Changing `animation` affects all onboarding step transitions at once.
 *   - The Stack's `contentStyle` is transparent so the shared tree watermark (rendered
 *     behind it here) shows through each screen's transparent SafeAreaView. The opaque
 *     base colour lives on this wrapper View instead of the per-screen background.
 */
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import TreeWatermark from '@/components/TreeWatermark';
import { useAppTheme } from '@/lib/useAppTheme';

export default function OnboardingLayout() {
  const theme = useAppTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={styles.treeWrap} pointerEvents="none">
        <TreeWatermark size={300} opacity={0.06} absolute={false} />
      </View>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  treeWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
