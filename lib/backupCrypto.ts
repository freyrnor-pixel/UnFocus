/**
 * backupCrypto.ts — optional password encryption for backup files (2026-10-26).
 *
 * A backup is the whole database as JSON — medicines, symptoms, notes — and the auto-backup
 * deliberately lives OUTSIDE the app sandbox (a SAF folder that may well be a synced cloud
 * drive). Mood Cairns (BackupCrypto.kt) encrypts its backups with AES-GCM under a PBKDF2 key;
 * this is the same envelope idea in pure JS, so it ships over OTA with no native module:
 *   - KDF: scrypt (N=2^15, r=8, p=1), @noble/hashes — memory-hard, and fast enough on Hermes
 *     where 600k PBKDF2 rounds in JS would take most of a minute.
 *   - Cipher: XChaCha20-Poly1305, @noble/ciphers — authenticated, and its 24-byte random
 *     nonce is safe to pick at random per file.
 * The envelope carries its own salt and KDF parameters, so they can be raised later without
 * breaking files already written.
 *
 * Connections:
 *   Imports → @noble/ciphers (xchacha20poly1305), @noble/hashes (scryptAsync, utf8 helpers),
 *             expo-crypto (getRandomBytes — the default randomness source)
 *   Used by → lib/backup.ts (encrypt on every export path when a password is set; detect +
 *             decrypt on import), lib/__tests__/backupCrypto.test.ts
 *   Data    → none (pure apart from randomness)
 *
 * Edit notes:
 *   - A wrong password and a tampered file are the same failure (the Poly1305 tag does not
 *     verify) — both surface as `WrongBackupPassword`. Never "repair" a file that fails it.
 *   - The password itself is never written into any backup: lib/backup.ts strips the
 *     settings column before serialising.
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { scryptAsync } from '@noble/hashes/scrypt';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils';
import { getRandomBytes } from 'expo-crypto';

export const ENCRYPTED_MAGIC = 'unfocus-backup-encrypted';

type Envelope = {
  magic: typeof ENCRYPTED_MAGIC;
  v: 1;
  kdf: 'scrypt';
  N: number;
  r: number;
  p: number;
  salt: string;
  nonce: string;
  data: string;
};

export const DEFAULT_KDF = { N: 2 ** 15, r: 8, p: 1 } as const;

export class WrongBackupPassword extends Error {
  constructor() {
    super('wrong backup password');
    this.name = 'WrongBackupPassword';
  }
}

type RandomFn = (n: number) => Uint8Array;

function toB64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function deriveKey(password: string, salt: Uint8Array, k: { N: number; r: number; p: number }) {
  // asyncTick keeps the JS thread breathing so the settings screen doesn't freeze.
  return scryptAsync(utf8ToBytes(password.normalize('NFKC')), salt, { ...k, dkLen: 32, asyncTick: 20 });
}

/** Is this file text an encrypted envelope (as opposed to a plain JSON backup)? */
export function isEncryptedBackup(text: string): boolean {
  try {
    const o = JSON.parse(text);
    return !!o && o.magic === ENCRYPTED_MAGIC;
  } catch {
    return false;
  }
}

/** Encrypt a plain backup JSON string into an envelope JSON string. */
export async function encryptBackup(
  plainJson: string,
  password: string,
  random: RandomFn = getRandomBytes,
  kdf: { N: number; r: number; p: number } = DEFAULT_KDF,
): Promise<string> {
  const salt = random(16);
  const nonce = random(24);
  const key = await deriveKey(password, salt, kdf);
  const data = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(plainJson));
  const env: Envelope = {
    magic: ENCRYPTED_MAGIC,
    v: 1,
    kdf: 'scrypt',
    ...kdf,
    salt: toB64(salt),
    nonce: toB64(nonce),
    data: toB64(data),
  };
  return JSON.stringify(env);
}

/** Decrypt an envelope back to the plain backup JSON. Throws WrongBackupPassword on failure. */
export async function decryptBackup(envelopeJson: string, password: string): Promise<string> {
  let env: Envelope;
  try {
    env = JSON.parse(envelopeJson);
  } catch {
    throw new WrongBackupPassword();
  }
  if (!env || env.magic !== ENCRYPTED_MAGIC || env.kdf !== 'scrypt') throw new WrongBackupPassword();
  try {
    const key = await deriveKey(password, fromB64(env.salt), { N: env.N, r: env.r, p: env.p });
    return bytesToUtf8(xchacha20poly1305(key, fromB64(env.nonce)).decrypt(fromB64(env.data)));
  } catch {
    throw new WrongBackupPassword();
  }
}
