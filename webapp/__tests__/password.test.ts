/**
 * Unit tests for password hashing utilities.
 *
 * These tests verify bcrypt hashing with cost factor 12,
 * correct password verification, and error handling.
 */
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password utilities", () => {
  describe("hashPassword", () => {
    it("produces a valid bcrypt hash", async () => {
      const password = "SecurePassword123!";
      const hash = await hashPassword(password);

      // bcrypt hashes start with $2b$, $2a$, or $2y$ and are 60 chars
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    });

    it("produces different hashes for the same password", async () => {
      const password = "TestPassword123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Each hash should be different due to random salt
      expect(hash1).not.toBe(hash2);
    }, 15000);

    it("produces different hashes for different passwords", async () => {
      const hash1 = await hashPassword("Password1!");
      const hash2 = await hashPassword("Password2!");

      expect(hash1).not.toBe(hash2);
    }, 15000);

    it("handles empty password", async () => {
      const hash = await hashPassword("");
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    });

    it("handles long passwords", async () => {
      // bcrypt truncates at 72 bytes, but should still work
      const longPassword = "a".repeat(100);
      const hash = await hashPassword(longPassword);
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    });

    it("handles unicode passwords", async () => {
      const unicodePassword = "пароль123!🔒";
      const hash = await hashPassword(unicodePassword);
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    });

    it("uses cost factor 12", async () => {
      const hash = await hashPassword("Test123!");
      // The cost factor is in the format $2b$12$ (12 between the second and third $)
      expect(hash).toMatch(/^\$2[aby]\$12\$/);
    });
  });

  describe("verifyPassword", () => {
    it("returns true for correct password", async () => {
      const password = "CorrectPassword123!";
      const hash = await hashPassword(password);
      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    it("returns false for incorrect password", async () => {
      const hash = await hashPassword("CorrectPassword123!");
      const result = await verifyPassword("WrongPassword456!", hash);
      expect(result).toBe(false);
    });

    it("returns false for similar but not identical password", async () => {
      const hash = await hashPassword("Password123!");
      const result = await verifyPassword("password123!", hash); // lowercase p
      expect(result).toBe(false);
    });

    it("returns false for password with extra characters", async () => {
      const hash = await hashPassword("Password123!");
      const result = await verifyPassword("Password123!!", hash);
      expect(result).toBe(false);
    });

    it("returns false for password with missing characters", async () => {
      const hash = await hashPassword("Password123!");
      const result = await verifyPassword("Password123", hash);
      expect(result).toBe(false);
    });

    it("handles empty password verification", async () => {
      const hash = await hashPassword("");
      expect(await verifyPassword("", hash)).toBe(true);
      expect(await verifyPassword("notempty", hash)).toBe(false);
    });

    it("handles unicode password verification", async () => {
      const password = "密码123!🔐";
      const hash = await hashPassword(password);
      expect(await verifyPassword(password, hash)).toBe(true);
      expect(await verifyPassword("wrong", hash)).toBe(false);
    });

    it("works with hash from different salt", async () => {
      const password = "SamePassword123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Both hashes should verify the same password
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    }, 15000);
  });

  describe("security properties", () => {
    it("hashing takes noticeable time (cost factor 12)", async () => {
      const start = Date.now();
      await hashPassword("TestPassword123!");
      const duration = Date.now() - start;

      // With cost factor 12, hashing should take at least ~50ms
      // but we use a lower threshold to avoid flaky tests
      expect(duration).toBeGreaterThan(10);
    });

    it("verification takes similar time for wrong vs right password", async () => {
      const hash = await hashPassword("CorrectPassword!");

      const startCorrect = Date.now();
      await verifyPassword("CorrectPassword!", hash);
      const correctDuration = Date.now() - startCorrect;

      const startWrong = Date.now();
      await verifyPassword("WrongPassword!", hash);
      const wrongDuration = Date.now() - startWrong;

      // Durations should be similar (within 100ms) - timing attack resistance
      expect(Math.abs(correctDuration - wrongDuration)).toBeLessThan(100);
    }, 15000);
  });
});
