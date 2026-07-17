/**
 * location.web.ts — web preview stub for lib/location.ts.
 *
 * expo-location's device GPS is never exercised headlessly (no hardware in the
 * container running npm run preview's Playwright pass), so this always reports
 * an error rather than attempting a browser geolocation fallback.
 *
 * Connections:
 *   Imports → none
 *   Used by → app/task-form.tsx (Metro resolves this over lib/location.ts on web)
 *   Data    → none
 */
export type TaskLocation = { lat: number; lng: number };
export type LocationResult =
  | { status: 'ok'; location: TaskLocation }
  | { status: 'denied' }
  | { status: 'error' };

export async function getCurrentTaskLocation(): Promise<LocationResult> {
  return { status: 'error' };
}
