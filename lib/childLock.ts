/**
 * childLock.ts — parent password storage for child mode (Decision 038c).
 *
 * Stores and verifies the parent password that gates child mode. The secret lives
 * ONLY in expo-secure-store (iOS Keychain / Android Keystore) — never in the SQLite
 * settings row, which holds only the `child_mode` / `child_mode_password_set` flags
 * (Decision 038c). Even in secure-store we persist a **salted SHA-256 hash**, not the
 * plaintext, so a keystore compromise still doesn't leak the password.
 *
 * Connections:
 *   Imports → expo-secure-store (native — folds into the Decision 038a/038c consolidated
 *             build), lib/hmac (sha256)
 *   Used by → app/settings.tsx (set/change/clear password + enter/exit child mode);
 *             store/useSettingsStore only mirrors the flags, never the secret.
 *   Data    → expo-secure-store key `unfocus.childMode.password` (JSON {salt,hash});
 *             does NOT touch SQLite.
 *
 * Edit notes:
 *   - Keep the flag (`childModePasswordSet` in settings) in sync with hasPassword():
 *     callers set the flag after setPassword()/clearPassword() succeeds.
 *   - Never log the password or the stored hash. verify() is best-effort constant-time
 *     via the hash compare in lib/hmac's consumers; timing here is not security-critical
 *     because a hash mismatch reveals nothing about the secret.
 *   - SecureStore is async and unavailable on web — child mode is a device feature.
 */
import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@/lib/hmac';

const KEY = 'unfocus.childMode.password';

type Stored = { salt: string; hash: string };

function randomSalt(): string {
  let s = '';
  for (let i = 0; i < 16; i++) s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return s;
}

/** Whether a parent password has been set on this device. */
export async function hasPassword(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(KEY);
  return !!raw;
}

/** Set (or replace) the parent password. Stores only a salted hash. */
export async function setPassword(password: string): Promise<void> {
  const salt = randomSalt();
  const stored: Stored = { salt, hash: sha256(salt + password) };
  await SecureStore.setItemAsync(KEY, JSON.stringify(stored));
}

/** Verify an entered password against the stored salted hash. */
export async function verifyPassword(password: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return false;
  try {
    const { salt, hash } = JSON.parse(raw) as Stored;
    return sha256(salt + password) === hash;
  } catch {
    return false;
  }
}

/** Remove the parent password (e.g. parent disables child mode entirely). */
export async function clearPassword(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
