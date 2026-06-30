/**
 * index.ts — real app entry point; hands off to expo-router.
 *
 * The single side-effecting import that boots the app: it registers
 * expo-router's file-based navigator, which renders app/_layout.tsx and the
 * route screens under app/. Set as `main` in package.json.
 *
 * Connections:
 *   Imports → —
 *   Used by → app entry (package.json "main"); not imported by other modules
 *   Data    → none
 *
 * Edit notes:
 *   - Keep this to the single expo-router/entry import; app bootstrapping
 *     (DB init, store hydration) belongs in app/_layout.tsx.
 */
import 'expo-router/entry';
