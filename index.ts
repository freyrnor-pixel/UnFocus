/**
 * index.ts — real app entry point; hands off to expo-router.
 *
 * The single side-effecting import that boots the app: it registers
 * expo-router's file-based navigator, which renders app/_layout.tsx and the
 * route screens under app/. Set as `main` in package.json.
 *
 * Connections:
 *   Imports → expo-router/entry; (Android only) react-native-android-widget +
 *             lib/widgets/handler for the headless home-screen-widget task handler
 *   Used by → app entry (package.json "main"); not imported by other modules
 *   Data    → none
 *
 * Edit notes:
 *   - Keep app bootstrapping (DB init, store hydration) in app/_layout.tsx — the
 *     only extra thing that belongs here is the widget task handler registration.
 *   - The widget task handler MUST be registered at the entry (not in a screen) so
 *     Android can run it headless when the app process is dead. It is guarded to
 *     Android + wrapped in try/catch via require() so the native module is never
 *     touched on iOS or in a build without the widget native code linked.
 */
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('./lib/widgets/handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    /* native widget module absent (Expo Go / pre-build) — widgets stay inert */
  }
}
