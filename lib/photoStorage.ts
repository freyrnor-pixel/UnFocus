/**
 * photoStorage.ts — copies a picker/camera photo into permanent app storage.
 *
 * expo-image-picker/expo-camera hand back a file in a transient cache directory
 * the OS can clear at any time; anything meant to outlive the current session
 * (e.g. a receipt photo) must be copied into documentDirectory first. Uses
 * expo-file-system's legacy API — same convention as lib/backup.ts.
 *
 * Connections:
 *   Imports → expo-file-system/legacy, lib/id
 *   Used by → app/scan.tsx (receipt photo)
 *   Data    → writes files under documentDirectory + '<subfolder>/'
 */
import { documentDirectory, getInfoAsync, makeDirectoryAsync, copyAsync } from 'expo-file-system/legacy';
import { generateId } from '@/lib/id';

/** Copies `uri` (a cache/temp file) into a permanent app-storage subfolder; returns the new URI. */
export async function persistPhoto(uri: string, subfolder: string): Promise<string> {
  const dir = `${documentDirectory}${subfolder}/`;
  const info = await getInfoAsync(dir);
  if (!info.exists) {
    await makeDirectoryAsync(dir, { intermediates: true });
  }
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const dest = `${dir}${generateId()}.${ext}`;
  await copyAsync({ from: uri, to: dest });
  return dest;
}
