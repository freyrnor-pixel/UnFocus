/**
 * backupCrypto.test.ts — pins lib/backupCrypto.ts (password-encrypted backup envelope).
 *
 * Connections:
 *   Imports → lib/backupCrypto, node:crypto (test randomness)
 *   Used by → jest
 *   Data    → none
 */
import { randomBytes } from 'node:crypto';
import { decryptBackup, encryptBackup, isEncryptedBackup, WrongBackupPassword, DEFAULT_KDF } from '@/lib/backupCrypto';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(jest.requireActual<typeof import('node:crypto')>('node:crypto').randomBytes(n)) }));

const rand = (n: number) => new Uint8Array(randomBytes(n));
const FAST = { N: 2 ** 10, r: 8, p: 1 };
const PLAIN = JSON.stringify({ magic: 'unfocus-backup', tables: { medicines: [{ name: 'Elvanse 30 mg', notes: 'æøå 🙂' }] } });

describe('backupCrypto', () => {
  it('round-trips with the right password (unicode included)', async () => {
    const env = await encryptBackup(PLAIN, 'hemmelig', rand, FAST);
    expect(isEncryptedBackup(env)).toBe(true);
    expect(env).not.toContain('Elvanse');
    expect(await decryptBackup(env, 'hemmelig')).toBe(PLAIN);
  });

  it('a wrong password fails closed', async () => {
    const env = await encryptBackup(PLAIN, 'hemmelig', rand, FAST);
    await expect(decryptBackup(env, 'feil')).rejects.toBeInstanceOf(WrongBackupPassword);
  });

  it('a tampered file fails the same way', async () => {
    const env = JSON.parse(await encryptBackup(PLAIN, 'pw', rand, FAST));
    const bytes = Buffer.from(env.data, 'base64');
    bytes[5] ^= 1;
    env.data = bytes.toString('base64');
    await expect(decryptBackup(JSON.stringify(env), 'pw')).rejects.toBeInstanceOf(WrongBackupPassword);
  });

  it('two encryptions of the same data differ (fresh salt + nonce)', async () => {
    const a = await encryptBackup(PLAIN, 'pw', rand, FAST);
    const b = await encryptBackup(PLAIN, 'pw', rand, FAST);
    expect(a).not.toBe(b);
  });

  it('the envelope carries its KDF params; the default is scrypt N=2^15', async () => {
    expect(DEFAULT_KDF).toEqual({ N: 32768, r: 8, p: 1 });
    const env = await encryptBackup(PLAIN, 'pw');
    expect(JSON.parse(env)).toMatchObject({ kdf: 'scrypt', N: 32768, r: 8, p: 1, v: 1 });
    expect(await decryptBackup(env, 'pw')).toBe(PLAIN);
  });

  it('plain backups and junk are not envelopes', () => {
    expect(isEncryptedBackup(PLAIN)).toBe(false);
    expect(isEncryptedBackup('not json')).toBe(false);
  });
});
