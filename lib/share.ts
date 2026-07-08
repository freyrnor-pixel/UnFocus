/**
 * share.ts — QR share payload encode/decode (UNFOCUS: prefixed JSON).
 *
 * Defines the versioned QR payload shape for sharing shopping lists ('s'),
 * tasks ('t'), or a device-pairing handshake ('p', Decision 038d), and
 * encode/decode helpers. decodeSharePayload validates the prefix, version, and
 * per-kind shape, returning null on anything malformed.
 *
 * Connections:
 *   Imports → —
 *   Used by → app/share-modal.tsx + app/scan.tsx ('s'/'t' kinds); app/pair-device.tsx
 *             encodes/decodes the 'p' pairing payload (038d), persisting the peer via
 *             store/usePeersStore — scan.tsx's own QR scanner deliberately still
 *             rejects 'p' payloads, pairing only ever scans from pair-device.tsx
 *   Data    → none (serialises in-memory items / pairing tokens to/from QR strings)
 *
 * Edit notes:
 *   - Wire-format is compact (single-letter keys n/a/u, d) to fit in a QR code —
 *     keep keys short and bump `v` if you change the schema.
 *   - decodeSharePayload must stay strict (prefix + v + per-kind shape check); it's
 *     parsing untrusted scanned input.
 *   - The 'p' pairing payload carries a shared HMAC secret — it is sensitive. It
 *     only ever lives inside the QR shown briefly during pairing; never log it.
 */
export type QRShoppingItem = { n: string; a: string; u: string };
export type QRTaskItem = { n: string; d: string };

/** Device-pairing handshake (Decision 038d): id=deviceId, nm=name, s=shared secret. */
export type QRPairing = { v: 1; k: 'p'; id: string; nm: string; s: string };

export type QRPayload =
  | { v: 1; k: 's'; b: string; i: QRShoppingItem[] }
  | { v: 1; k: 't'; b: string; i: QRTaskItem[] }
  | QRPairing;

const PREFIX = 'UNFOCUS:';

export function encodeSharePayload(payload: QRPayload): string {
  return PREFIX + JSON.stringify(payload);
}

export function decodeSharePayload(data: string): QRPayload | null {
  if (!data.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(data.slice(PREFIX.length));
    if (parsed?.v !== 1) return null;
    if ((parsed.k === 's' || parsed.k === 't') && Array.isArray(parsed.i)) {
      return parsed as QRPayload;
    }
    if (
      parsed.k === 'p' &&
      typeof parsed.id === 'string' &&
      typeof parsed.nm === 'string' &&
      typeof parsed.s === 'string'
    ) {
      return parsed as QRPairing;
    }
    return null;
  } catch {
    return null;
  }
}
