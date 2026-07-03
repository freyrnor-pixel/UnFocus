/**
 * share.ts — QR share payload encode/decode (UNFOCUS: prefixed JSON).
 *
 * Defines the versioned QR payload shape for sharing shopping lists ('s') or
 * tasks ('t') between users, and encode/decode helpers. decodeSharePayload
 * validates the prefix, version, kind, and items array, returning null on
 * anything malformed.
 *
 * Connections:
 *   Imports → —
 *   Used by → app/share-modal.tsx (app/scan.tsx not ported yet — this is a leaf ahead of that screen)
 *   Data    → none (serialises in-memory items to/from QR strings)
 *
 * Edit notes:
 *   - Wire-format is compact (single-letter keys n/a/u, d) to fit in a QR code —
 *     keep keys short and bump `v` if you change the schema.
 *   - decodeSharePayload must stay strict (prefix + v + k + Array check); it's
 *     parsing untrusted scanned input.
 */
export type QRShoppingItem = { n: string; a: string; u: string };
export type QRTaskItem = { n: string; d: string };

export type QRPayload =
  | { v: 1; k: 's'; b: string; i: QRShoppingItem[] }
  | { v: 1; k: 't'; b: string; i: QRTaskItem[] };

const PREFIX = 'UNFOCUS:';

export function encodeSharePayload(payload: QRPayload): string {
  return PREFIX + JSON.stringify(payload);
}

export function decodeSharePayload(data: string): QRPayload | null {
  if (!data.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(data.slice(PREFIX.length));
    if (parsed?.v === 1 && (parsed.k === 's' || parsed.k === 't') && Array.isArray(parsed.i)) {
      return parsed as QRPayload;
    }
    return null;
  } catch {
    return null;
  }
}
