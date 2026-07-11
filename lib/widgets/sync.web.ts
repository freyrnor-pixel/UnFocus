/**
 * sync.web.ts — Web preview shim for lib/widgets/sync.ts.
 *
 * `react-native-android-widget` (imported at module scope by lib/widgets/WidgetViews.tsx)
 * has no web build. The Android widgets + persistent notification have nothing to target
 * in a browser preview, so this just no-ops the one function callers use.
 *
 * Connections:
 *   Imports → none
 *   Used by → app/_layout.tsx, app/settings.tsx (web bundle resolves this over lib/widgets/sync.ts)
 *   Data    → none
 */
export async function syncWidgetsAndOverview(_opts?: { persistentOnly?: boolean }) {}
