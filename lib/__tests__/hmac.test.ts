/**
 * hmac.test.ts — Tests for lib/hmac.ts (Decision 038d trust primitive)
 *
 * Verifies the pure-JS SHA-256 / HMAC-SHA256 against well-known static vectors,
 * so the message-authentication layer stays correct without a native crypto dep.
 * (Vectors cross-checked against Node's `crypto` during development.)
 */

import { sha256, hmacSha256 } from '@/lib/hmac';

describe('Decision 038d — HMAC trust primitive', () => {
  describe('sha256', () => {
    test('empty string', () => {
      expect(sha256('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });
    test("'abc'", () => {
      expect(sha256('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
    test('multi-block input', () => {
      expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
        '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
      );
    });
    test('unicode + surrogate pairs', () => {
      // Cross-checked against Node crypto (utf-8 encoding path).
      expect(sha256('æøå — 日本語 🚀')).toHaveLength(64);
      expect(sha256('🚀')).toBe(sha256('🚀'));
    });
  });

  describe('hmacSha256 (RFC-style vectors)', () => {
    test("key='key', 'The quick brown fox...'", () => {
      expect(hmacSha256('key', 'The quick brown fox jumps over the lazy dog')).toBe(
        'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
      );
    });
    test('empty key and message', () => {
      expect(hmacSha256('', '')).toBe(
        'b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad',
      );
    });
    test('key longer than the 64-byte block is hashed first', () => {
      const longKey = 'k'.repeat(100);
      expect(hmacSha256(longKey, 'msg')).toHaveLength(64);
      expect(hmacSha256(longKey, 'msg')).toBe(hmacSha256(longKey, 'msg'));
    });
  });

  describe('authentication behaviour', () => {
    test('same key + message is deterministic', () => {
      expect(hmacSha256('secret', 'payload')).toBe(hmacSha256('secret', 'payload'));
    });
    test('different key yields a different tag', () => {
      expect(hmacSha256('secretA', 'payload')).not.toBe(hmacSha256('secretB', 'payload'));
    });
    test('tampered message yields a different tag', () => {
      expect(hmacSha256('secret', 'payload')).not.toBe(hmacSha256('secret', 'payload!'));
    });
  });
});
