import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSignedToken, verifySignedToken } from "@/lib/tokens";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const originalEnv = process.env.ENCRYPTION_KEY;

describe("tokens", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  describe("createSignedToken / verifySignedToken round-trip", () => {
    it("creates and verifies a valid token", () => {
      const userId = "user-123-abc";
      const token = createSignedToken(userId, 60_000); // 1 minute
      const result = verifySignedToken(token);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
      expect(result!.expires).toBeGreaterThan(Date.now());
    });

    it("works with UUID-style user IDs", () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const token = createSignedToken(userId, 3_600_000);
      const result = verifySignedToken(token);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(userId);
    });
  });

  describe("expired token rejection", () => {
    it("returns null for an expired token", () => {
      vi.spyOn(Date, "now")
        .mockReturnValueOnce(1000) // createSignedToken: expires = 1000 + 5000 = 6000
        .mockReturnValueOnce(7000); // verifySignedToken: now = 7000 > 6000

      const token = createSignedToken("user-1", 5000);
      const result = verifySignedToken(token);

      expect(result).toBeNull();
    });
  });

  describe("tampered token rejection", () => {
    it("returns null when signature is tampered", () => {
      const token = createSignedToken("user-1", 60_000);
      const parts = token.split(".");
      const tamperedToken = `${parts[0]}.invalidSignature`;
      const result = verifySignedToken(tamperedToken);

      expect(result).toBeNull();
    });

    it("returns null when payload is tampered", () => {
      const token = createSignedToken("user-1", 60_000);
      const parts = token.split(".");
      const fakePayload = Buffer.from("hacker.9999999999999").toString(
        "base64url"
      );
      const tamperedToken = `${fakePayload}.${parts[1]}`;
      const result = verifySignedToken(tamperedToken);

      expect(result).toBeNull();
    });
  });

  describe("malformed token handling", () => {
    it("returns null for empty string", () => {
      expect(verifySignedToken("")).toBeNull();
    });

    it("returns null for token without separator", () => {
      expect(verifySignedToken("noseparator")).toBeNull();
    });

    it("returns null for token with too many parts", () => {
      expect(verifySignedToken("a.b.c")).toBeNull();
    });
  });

  describe("missing ENCRYPTION_KEY", () => {
    it("throws when creating token without key", () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => createSignedToken("user-1", 60_000)).toThrow(
        "ENCRYPTION_KEY environment variable is not set"
      );
    });

    it("returns null when verifying token without key", () => {
      const token = createSignedToken("user-1", 60_000);
      delete process.env.ENCRYPTION_KEY;

      expect(verifySignedToken(token)).toBeNull();
    });
  });
});
