import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from '../src/utils/crypto.js';

describe('Crypto Utilities', () => {
  const testText = 'test-secret-123';

  describe('encrypt', () => {
    it('should encrypt text and return valid format', () => {
      const encrypted = encrypt(testText);

      // Should be in format: iv:authTag:encryptedData (hex:hex:hex)
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // IV should be 32 hex chars (16 bytes)
      expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);

      // Auth tag should be 32 hex chars (16 bytes)
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);

      // Encrypted data should be hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce different ciphertext for same input (random IV)', () => {
      const encrypted1 = encrypt(testText);
      const encrypted2 = encrypt(testText);

      // Same plaintext should produce different ciphertext due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(testText);
      expect(decrypt(encrypted2)).toBe(testText);
    });

    it('should throw error if encryption key is missing', () => {
      const originalKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY;

      try {
        expect(() => encrypt(testText)).toThrow(
          'TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'
        );
      } finally {
        process.env.TWO_FACTOR_ENCRYPTION_KEY = originalKey;
      }
    });

    it('should throw error if encryption key has invalid length', () => {
      const originalKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
      process.env.TWO_FACTOR_ENCRYPTION_KEY = '0000'; // Too short

      try {
        expect(() => encrypt(testText)).toThrow(
          'TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'
        );
      } finally {
        process.env.TWO_FACTOR_ENCRYPTION_KEY = originalKey;
      }
    });

    it('should encrypt empty string', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should encrypt unicode characters', () => {
      const unicodeText = '🔐 Secret 密碼 🔒';
      const encrypted = encrypt(unicodeText);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(unicodeText);
    });

    it('should encrypt long strings', () => {
      const longText = 'a'.repeat(10000);
      const encrypted = encrypt(longText);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(longText);
    });
  });

  describe('decrypt', () => {
    let validEncrypted: string;

    beforeAll(() => {
      validEncrypted = encrypt(testText);
    });

    it('should decrypt valid encrypted text', () => {
      const decrypted = decrypt(validEncrypted);
      expect(decrypted).toBe(testText);
    });

    it('should throw error on malformed format (missing separators)', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted text format');
      expect(() => decrypt('part1:part2')).toThrow('Invalid encrypted text format');
      expect(() => decrypt('part1:part2:part3:part4')).toThrow('Invalid encrypted text format');
    });

    it('should throw error on invalid IV length', () => {
      // IV too short (should be 32 hex chars = 16 bytes)
      const malformed = '0000:' + validEncrypted.split(':')[1] + ':' + validEncrypted.split(':')[2];
      expect(() => decrypt(malformed)).toThrow('Invalid IV length');
    });

    it('should throw error on invalid auth tag length', () => {
      const [iv, , encrypted] = validEncrypted.split(':');
      // Auth tag too short (should be 32 hex chars = 16 bytes)
      const malformed = `${iv}:0000:${encrypted}`;
      expect(() => decrypt(malformed)).toThrow('Invalid auth tag length');
    });

    it('should throw error if auth tag has invalid hex format', () => {
      const [iv, , encrypted] = validEncrypted.split(':');
      // Invalid hex characters in tag
      const malformed = `${iv}:${'z'.repeat(32)}:${encrypted}`;
      expect(() => decrypt(malformed)).toThrow();
    });

    it('should throw error if IV has invalid hex format', () => {
      const [, authTag, encrypted] = validEncrypted.split(':');
      // Invalid hex characters in IV
      const malformed = `${'z'.repeat(32)}:${authTag}:${encrypted}`;
      expect(() => decrypt(malformed)).toThrow();
    });

    it('should throw error if encrypted data has invalid hex format', () => {
      const [iv, authTag] = validEncrypted.split(':');
      // Invalid hex characters in encrypted data
      const malformed = `${iv}:${authTag}:zzzzzzzzzzzz`;
      expect(() => decrypt(malformed)).toThrow();
    });

    it('should reject tampered IV (authentication failure)', () => {
      const [iv, authTag, encrypted] = validEncrypted.split(':');

      // Flip a bit in the IV
      const ivBuffer = Buffer.from(iv, 'hex');
      ivBuffer[0] = ivBuffer[0] ^ 0x01;
      const tamperedIv = ivBuffer.toString('hex');

      const tampered = `${tamperedIv}:${authTag}:${encrypted}`;

      // Should throw because authentication fails (different IV, same auth tag)
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should reject tampered auth tag (authentication failure)', () => {
      const [iv, authTag, encrypted] = validEncrypted.split(':');

      // Flip a bit in the auth tag
      const tagBuffer = Buffer.from(authTag, 'hex');
      tagBuffer[0] = tagBuffer[0] ^ 0x01;
      const tamperedTag = tagBuffer.toString('hex');

      const tampered = `${iv}:${tamperedTag}:${encrypted}`;

      // Should throw because authentication fails (tag doesn't match)
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should reject tampered encrypted data (authentication failure)', () => {
      const [iv, authTag] = validEncrypted.split(':');
      const encrypted = validEncrypted.split(':')[2];

      // Flip a bit in the encrypted data
      const dataBuffer = Buffer.from(encrypted, 'hex');
      dataBuffer[0] = dataBuffer[0] ^ 0x01;
      const tamperedData = dataBuffer.toString('hex');

      const tampered = `${iv}:${authTag}:${tamperedData}`;

      // Should throw because authentication fails (data was modified)
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw error if encryption key is missing during decryption', () => {
      const originalKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY;

      try {
        expect(() => decrypt(validEncrypted)).toThrow(
          'TWO_FACTOR_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'
        );
      } finally {
        process.env.TWO_FACTOR_ENCRYPTION_KEY = originalKey;
      }
    });

    it('should throw error if encryption key is invalid during decryption', () => {
      const originalKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
      process.env.TWO_FACTOR_ENCRYPTION_KEY =
        '1111111111111111111111111111111111111111111111111111111111111111'; // Different key

      try {
        // Will fail during GCM authentication check (different key)
        expect(() => decrypt(validEncrypted)).toThrow();
      } finally {
        process.env.TWO_FACTOR_ENCRYPTION_KEY = originalKey;
      }
    });
  });

  describe('Round-trip encryption/decryption', () => {
    const testCases = [
      'simple',
      'with spaces',
      'with-dashes',
      'with_underscores',
      'with.dots',
      '123456789',
      'MixedCase123!@#$%^&*()',
      '🔐🔒🗝️',
      'a'.repeat(1000),
    ];

    testCases.forEach((testCase) => {
      it(`should encrypt and decrypt: "${testCase.substring(0, 30)}${testCase.length > 30 ? '...' : ''}"`, () => {
        const encrypted = encrypt(testCase);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(testCase);
      });
    });
  });
});
