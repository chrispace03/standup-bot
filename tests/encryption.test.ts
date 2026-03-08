import { encrypt, decrypt } from '../src/utils/encryption';

const TEST_KEY = 'test-encryption-key-for-unit-tests';

describe('Encryption utility', () => {
  it('encrypts and decrypts a string', () => {
    const plaintext = 'xoxb-slack-token-value';
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext, TEST_KEY);
    const b = encrypt(plaintext, TEST_KEY);
    expect(a).not.toBe(b);
    expect(decrypt(a, TEST_KEY)).toBe(plaintext);
    expect(decrypt(b, TEST_KEY)).toBe(plaintext);
  });

  it('fails to decrypt with wrong key', () => {
    const encrypted = encrypt('secret', TEST_KEY);
    expect(() => decrypt(encrypted, 'wrong-key')).toThrow();
  });

  it('fails to decrypt tampered ciphertext', () => {
    const encrypted = encrypt('secret', TEST_KEY);
    const tampered = encrypted.slice(0, -2) + 'XX';
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it('handles empty string', () => {
    const encrypted = encrypt('', TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe('');
  });

  it('handles unicode content', () => {
    const plaintext = 'token with emoji \u{1f680} and accents \u00e9\u00e0\u00fc';
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext);
  });
});
