/**
 * _layout.tsx — Stack navigator for the onboarding flow
 *
 * Defines the Expo Router Stack that wraps every onboarding screen. Hides the
 * native header and applies a slide-from-right transition between steps.
 *
 * Connections:
 *   Imports → expo-router
 *   Used by → onboarding stack layout (router layout for /onboarding/*)
 *   Data    → none (presentational)
 *
 * Edit notes:
 *   - headerShown:false here means each screen renders its own SafeAreaView header/footer.
 *   - Changing `animation` affects all onboarding step transitions at once.
 */
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
  );
}
