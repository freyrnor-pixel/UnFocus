/**
 * location.ts — foreground "tag task with my current location" helper.
 *
 * Reserve-only (expo-location, already installed + plugin-registered — see
 * app.json / AGENTS.md "Known gotchas"). One-shot foreground fix only.
 * Background geofencing (location_radius_m/geofence_id, backgroundLocationEnabled)
 * is explicitly out of scope for this file.
 *
 * Connections:
 *   Imports → expo-location
 *   Used by → app/task-form.tsx
 *   Data    → none (returns lat/lng to the caller; no SQLite/store access)
 *
 * Edit notes:
 *   - .web.ts stub always returns { status: 'error' } — no GPS hardware in the
 *     web preview's Playwright pass either, so this is never exercised there.
 *   - Distinguishes denied vs. a native failure (mirrors lib/useVoiceCapture.ts's
 *     not-allowed vs. generic-error split) so the caller can show the right modal copy.
 */
import * as Location from 'expo-location';

export type TaskLocation = { lat: number; lng: number };
export type LocationResult =
  | { status: 'ok'; location: TaskLocation }
  | { status: 'denied' }
  | { status: 'error' };

export async function getCurrentTaskLocation(): Promise<LocationResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { status: 'denied' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { status: 'ok', location: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch {
    return { status: 'error' };
  }
}
