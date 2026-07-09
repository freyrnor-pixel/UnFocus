/**
 * peerAuth.ts — sign/verify LAN envelopes against a paired peer key (Decision 038d).
 *
 * The trust layer that sits between 038a transport and the app: it wraps an
 * outbound application body with an HMAC tag keyed by the shared secret exchanged
 * during QR pairing, and verifies inbound wrappers before the app trusts them.
 * A message whose tag doesn't verify against a *known paired* peer is rejected —
 * this is what stops a hostile device on the same Wi-Fi from impersonating the
 * paired partner (the risk called out in 038d option (b)).
 *
 * Connections:
 *   Imports → lib/hmac, expo-crypto
 *   Used by → lib/syncService.ts (signOutbound on every broadcastRow, verifyInbound
 *             on every received envelope; peer secrets come from store/usePeersStore),
 *             app/pair-device.tsx (generateSecret() when a user starts the QR
 *             pairing handshake as the initiator)
 *   Data    → none directly (secrets are supplied by usePeersStore at the call site)
 *
 * Edit notes:
 *   - The tag covers `from` + the exact serialised body string, so a receiver must
 *     HMAC the *received* body string verbatim — never re-serialise before verify,
 *     or key-order differences would break the tag. That's why the wire body `b`
 *     is a string, not a nested object.
 *   - HMAC authenticates, it does NOT encrypt. Bodies cross the LAN in cleartext.
 *   - Secret generation now uses expo-crypto's getRandomBytes (native CSPRNG), same
 *     hex format/length as before so existing stored secrets stay compatible. This
 *     supersedes 038d's "Math.random, no new native module" tradeoff note — expo-crypto
 *     landed as a dependency for this. getRandomBytes() throws on installs whose native
 *     binary predates this dependency (OTA can't add native modules); generateSecret()
 *     catches that and falls back to the old Math.random path so pairing keeps working
 *     (with the old, weaker guarantee) until those installs get a new native build.
 */
import * as Crypto from 'expo-crypto';
import { hmacSha256 } from '@/lib/hmac';

/** Signed wire wrapper carried as the 038a envelope `payload`. */
export type SignedWrapper = {
  /** Serialised application body (verbatim string the tag is computed over). */
  b: string;
  /** HMAC-SHA256(secret, from + '\n' + b) as hex. */
  m: string;
};

/** Length of a pairing secret in bytes (→ 64 hex chars). */
const SECRET_BYTES = 32;

/**
 * Generate a shared pairing secret (hex). Uses expo-crypto's native CSPRNG; falls
 * back to Math.random (see header edit note) if the native module isn't linked yet.
 */
export function generateSecret(): string {
  let bytes: Uint8Array;
  try {
    bytes = Crypto.getRandomBytes(SECRET_BYTES);
  } catch {
    bytes = new Uint8Array(SECRET_BYTES);
    for (let i = 0; i < SECRET_BYTES; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

/** Wrap an application body into a signed wrapper for sending to a paired peer. */
export function signOutbound(secret: string, from: string, body: unknown): SignedWrapper {
  const b = JSON.stringify(body);
  return { b, m: hmacSha256(secret, from + '\n' + b) };
}

/** Length-independent tag compare to blunt timing side-channels. */
function tagsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify an inbound wrapper from `from` using the paired peer's `secret`.
 * Returns the parsed application body on success, or null if the tag doesn't
 * verify or the wrapper is malformed. Caller supplies `secret` from
 * usePeersStore.getSecret(from); a missing secret (unknown peer) means the
 * caller should not even reach here — treat undefined as "reject".
 */
export function verifyInbound<T = unknown>(
  secret: string,
  from: string,
  wrapper: unknown,
): T | null {
  if (
    !wrapper ||
    typeof (wrapper as SignedWrapper).b !== 'string' ||
    typeof (wrapper as SignedWrapper).m !== 'string'
  ) {
    return null;
  }
  const { b, m } = wrapper as SignedWrapper;
  const expected = hmacSha256(secret, from + '\n' + b);
  if (!tagsEqual(expected, m)) return null;
  try {
    return JSON.parse(b) as T;
  } catch {
    return null;
  }
}
