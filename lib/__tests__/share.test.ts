/**
 * share.test.ts — unit tests for lib/share.ts (QR payload codec).
 *
 * decodeSharePayload parses untrusted scanned input, so the contract that
 * matters is: valid payloads round-trip, and ANYTHING malformed returns null
 * (never throws, never leaks a half-parsed object). Pure functions, no mocks.
 */
import { encodeSharePayload, decodeSharePayload, QRPayload, QRPairing } from '@/lib/share';

describe('encode/decode round-trip', () => {
  it('round-trips a shopping payload', () => {
    const payload: QRPayload = {
      v: 1,
      k: 's',
      b: 'Weekly',
      i: [{ n: 'Milk', a: '2', u: 'l' }],
    };
    expect(decodeSharePayload(encodeSharePayload(payload))).toEqual(payload);
  });

  it('round-trips a task payload', () => {
    const payload: QRPayload = { v: 1, k: 't', b: 'Today', i: [{ n: 'Call', d: '2026-07-15' }] };
    expect(decodeSharePayload(encodeSharePayload(payload))).toEqual(payload);
  });

  it('round-trips a pairing payload', () => {
    const payload: QRPairing = { v: 1, k: 'p', id: 'dev1', nm: 'Phone', s: 'secret' };
    expect(decodeSharePayload(encodeSharePayload(payload))).toEqual(payload);
  });

  it('prefixes encoded output with UNFOCUS:', () => {
    expect(encodeSharePayload({ v: 1, k: 's', b: '', i: [] })).toMatch(/^UNFOCUS:/);
  });
});

describe('decodeSharePayload rejects malformed input', () => {
  it('returns null when the prefix is missing', () => {
    expect(decodeSharePayload(JSON.stringify({ v: 1, k: 's', b: '', i: [] }))).toBeNull();
  });

  it('returns null on non-JSON after the prefix', () => {
    expect(decodeSharePayload('UNFOCUS:not json{')).toBeNull();
  });

  it('returns null on a wrong version', () => {
    expect(decodeSharePayload('UNFOCUS:' + JSON.stringify({ v: 2, k: 's', i: [] }))).toBeNull();
  });

  it('returns null when a shopping payload has no items array', () => {
    expect(decodeSharePayload('UNFOCUS:' + JSON.stringify({ v: 1, k: 's', b: 'x' }))).toBeNull();
  });

  it('returns null on an unknown kind', () => {
    expect(decodeSharePayload('UNFOCUS:' + JSON.stringify({ v: 1, k: 'z', i: [] }))).toBeNull();
  });

  it('returns null when a pairing payload is missing its secret', () => {
    expect(
      decodeSharePayload('UNFOCUS:' + JSON.stringify({ v: 1, k: 'p', id: 'd', nm: 'n' }))
    ).toBeNull();
  });

  it('returns null on the empty string', () => {
    expect(decodeSharePayload('')).toBeNull();
  });
});
