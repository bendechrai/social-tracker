/**
 * Unit tests for AES-256-GCM encryption utilities.
 *
 * These tests verify that encryption/decryption work correctly,
 * produce unique outputs for different inputs, and handle errors appropriately.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "@/lib/encryption";

// Store original env value
const originalEnv = process.env.ENCRYPTION_KEY;

// Valid 32-byte hex key for testing
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryption", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  describe("encrypt/decrypt round-trip", () => {
    it("returns original plaintext after encrypt then decrypt", () => {
      const plaintext = "Hello, World!";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles empty string", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles long plaintext", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles unicode characters", () => {
      const plaintext = "こんにちは世界 🌍 مرحبا";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles special characters", () => {
      const plaintext = `!@#$%^&*()_+-=[]{}|;':",.<>?/~\`\\`;
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles newlines and whitespace", () => {
      const plaintext = "line1\nline2\r\nline3\ttab";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("handles JSON data", () => {
      const data = {
        accessToken: "abc123",
        refreshToken: "def456",
        expiresAt: new Date().toISOString(),
      };
      const plaintext = JSON.stringify(data);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(JSON.parse(decrypted)).toEqual(data);
    });
  });

  describe("IV uniqueness", () => {
    it("produces different ciphertexts for same plaintext", () => {
      const plaintext = "test message";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // Ciphertexts should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it("different plaintexts produce different ciphertexts", () => {
      const encrypted1 = encrypt("message1");
      const encrypted2 = encrypt("message2");
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe("ciphertext format", () => {
    it("produces format iv:authTag:ciphertext", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
    });

    it("IV is valid base64", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      const ivBase64 = parts[0]!;
      expect(() => Buffer.from(ivBase64, "base64")).not.toThrow();
      // IV should be 16 bytes = 24 chars base64 (including padding)
      const iv = Buffer.from(ivBase64, "base64");
      expect(iv.length).toBe(16);
    });

    it("authTag is valid base64", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      const authTagBase64 = parts[1]!;
      expect(() => Buffer.from(authTagBase64, "base64")).not.toThrow();
      // Auth tag should be 16 bytes
      const authTag = Buffer.from(authTagBase64, "base64");
      expect(authTag.length).toBe(16);
    });
  });

  describe("tamper detection", () => {
    it("throws error when ciphertext is tampered", () => {
      const encrypted = encrypt("secret message");
      const parts = encrypted.split(":");
      // Tamper with the ciphertext portion
      const tamperedCiphertext =
        Buffer.from("tampered").toString("base64");
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws error when authTag is tampered", () => {
      const encrypted = encrypt("secret message");
      const parts = encrypted.split(":");
      // Tamper with the auth tag
      const tamperedAuthTag = Buffer.from("0".repeat(16)).toString("base64");
      const tampered = `${parts[0]}:${tamperedAuthTag}:${parts[2]}`;

      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws error when IV is tampered", () => {
      const encrypted = encrypt("secret message");
      const parts = encrypted.split(":");
      // Tamper with the IV
      const tamperedIV = Buffer.from("0".repeat(16)).toString("base64");
      const tampered = `${tamperedIV}:${parts[1]}:${parts[2]}`;

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("error handling", () => {
    it("throws error for invalid ciphertext format (no colons)", () => {
      expect(() => decrypt("invalidciphertext")).toThrow(
        "Invalid ciphertext format"
      );
    });

    it("throws error for invalid ciphertext format (only one colon)", () => {
      expect(() => decrypt("part1:part2")).toThrow("Invalid ciphertext format");
    });

    it("throws error for invalid ciphertext format (too many colons)", () => {
      expect(() => decrypt("part1:part2:part3:part4")).toThrow(
        "Invalid ciphertext format"
      );
    });

    it("throws error for invalid IV length", () => {
      const shortIV = Buffer.from("short").toString("base64");
      const validAuthTag = Buffer.from("0".repeat(16)).toString("base64");
      const validCiphertext = Buffer.from("test").toString("base64");

      expect(() =>
        decrypt(`${shortIV}:${validAuthTag}:${validCiphertext}`)
      ).toThrow("Invalid IV length");
    });

    it("throws error for invalid auth tag length", () => {
      const validIV = Buffer.from("0".repeat(16)).toString("base64");
      const shortAuthTag = Buffer.from("short").toString("base64");
      const validCiphertext = Buffer.from("test").toString("base64");

      expect(() =>
        decrypt(`${validIV}:${shortAuthTag}:${validCiphertext}`)
      ).toThrow("Invalid auth tag length");
    });
  });

  describe("missing ENCRYPTION_KEY", () => {
    it("throws descriptive error when ENCRYPTION_KEY is not set", () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY environment variable is not set");
    });

    it("throws descriptive error when decrypting without key", () => {
      const encrypted = encrypt("test");
      delete process.env.ENCRYPTION_KEY;

      expect(() => decrypt(encrypted)).toThrow(
        "ENCRYPTION_KEY environment variable is not set"
      );
    });
  });

  describe("invalid ENCRYPTION_KEY", () => {
    it("throws error for key that is too short", () => {
      process.env.ENCRYPTION_KEY = "tooshort";
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be a 64-character hex string");
    });

    it("throws error for key that is too long", () => {
      process.env.ENCRYPTION_KEY = "0".repeat(128);
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be a 64-character hex string");
    });
  });
});
