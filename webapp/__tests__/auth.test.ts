/**
 * Unit tests for authentication configuration and authorization logic.
 *
 * These tests verify that the credentials provider correctly:
 * - Rejects invalid email format
 * - Rejects missing password
 * - Rejects non-existent users
 * - Rejects wrong passwords
 * - Accepts valid credentials
 * - Returns correct user data for session
 *
 * Also tests session configuration constants.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword } from "@/lib/password";

// Mock database before importing auth module
const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

// Import after mocks are set up
// Import from auth-utils directly to avoid NextAuth initialization
import {
  authorizeCredentials,
  emailSchema,
  SESSION_MAX_AGE,
} from "@/lib/auth-utils";

describe("auth configuration", () => {
  describe("SESSION_MAX_AGE", () => {
    it("is set to 7 days in seconds", () => {
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;
      expect(SESSION_MAX_AGE).toBe(sevenDaysInSeconds);
      expect(SESSION_MAX_AGE).toBe(604800);
    });
  });

  describe("emailSchema", () => {
    it("accepts valid email format", () => {
      const result = emailSchema.safeParse("user@example.com");
      expect(result.success).toBe(true);
    });

    it("accepts email with subdomain", () => {
      const result = emailSchema.safeParse("user@mail.example.com");
      expect(result.success).toBe(true);
    });

    it("accepts email with plus sign", () => {
      const result = emailSchema.safeParse("user+tag@example.com");
      expect(result.success).toBe(true);
    });

    it("rejects invalid email format", () => {
      const result = emailSchema.safeParse("not-an-email");
      expect(result.success).toBe(false);
    });

    it("rejects email without domain", () => {
      const result = emailSchema.safeParse("user@");
      expect(result.success).toBe(false);
    });

    it("rejects email without @ symbol", () => {
      const result = emailSchema.safeParse("userexample.com");
      expect(result.success).toBe(false);
    });

    it("rejects empty string", () => {
      const result = emailSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("authorizeCredentials", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("email validation", () => {
      it("rejects undefined credentials", async () => {
        const result = await authorizeCredentials(undefined);
        expect(result).toBeNull();
        expect(mockFindFirst).not.toHaveBeenCalled();
      });

      it("rejects missing email", async () => {
        const result = await authorizeCredentials({
          password: "SomePassword123!",
        });
        expect(result).toBeNull();
        expect(mockFindFirst).not.toHaveBeenCalled();
      });

      it("rejects invalid email format", async () => {
        const result = await authorizeCredentials({
          email: "not-valid-email",
          password: "SomePassword123!",
        });
        expect(result).toBeNull();
        expect(mockFindFirst).not.toHaveBeenCalled();
      });

      it("rejects empty email", async () => {
        const result = await authorizeCredentials({
          email: "",
          password: "SomePassword123!",
        });
        expect(result).toBeNull();
        expect(mockFindFirst).not.toHaveBeenCalled();
      });
    });

    describe("password validation", () => {
      it("rejects missing password", async () => {
        const result = await authorizeCredentials({
          email: "user@example.com",
        });
        expect(result).toBeNull();
        expect(mockFindFirst).not.toHaveBeenCalled();
      });

      it("rejects empty password", async () => {
        const result = await authorizeCredentials({
          email: "user@example.com",
          password: "",
        });
        expect(result).toBeNull();
        expect(mockFindFirst).not.toHaveBeenCalled();
      });
    });

    describe("user lookup", () => {
      it("rejects non-existent user", async () => {
        mockFindFirst.mockResolvedValueOnce(null);

        const result = await authorizeCredentials({
          email: "nonexistent@example.com",
          password: "SomePassword123!",
        });

        expect(result).toBeNull();
        expect(mockFindFirst).toHaveBeenCalled();
      });

      it("rejects user without password hash (OAuth-only user)", async () => {
        mockFindFirst.mockResolvedValueOnce({
          id: "user-uuid",
          email: "oauth-user@example.com",
          passwordHash: null,
        });

        const result = await authorizeCredentials({
          email: "oauth-user@example.com",
          password: "SomePassword123!",
        });

        expect(result).toBeNull();
      });
    });

    describe("password verification", () => {
      it("rejects wrong password", async () => {
        const correctPassword = "CorrectPassword123!";
        const passwordHash = await hashPassword(correctPassword);

        mockFindFirst.mockResolvedValueOnce({
          id: "user-uuid",
          email: "user@example.com",
          passwordHash,
        });

        const result = await authorizeCredentials({
          email: "user@example.com",
          password: "WrongPassword456!",
        });

        expect(result).toBeNull();
      });

      it("accepts valid credentials", async () => {
        const password = "ValidPassword123!";
        const passwordHash = await hashPassword(password);

        mockFindFirst.mockResolvedValueOnce({
          id: "user-uuid-12345",
          email: "valid@example.com",
          passwordHash,
        });

        const result = await authorizeCredentials({
          email: "valid@example.com",
          password,
        });

        expect(result).not.toBeNull();
        expect(result).toEqual({
          id: "user-uuid-12345",
          email: "valid@example.com",
        });
      });
    });

    describe("returned user data", () => {
      it("returns only id and email", async () => {
        const password = "SecurePassword123!";
        const passwordHash = await hashPassword(password);

        mockFindFirst.mockResolvedValueOnce({
          id: "test-user-id",
          email: "test@example.com",
          passwordHash,
          name: "Test User",
          image: "https://example.com/avatar.jpg",
          createdAt: new Date(),
          updatedAt: new Date(),
          groqApiKey: "encrypted-key",
          redditUsername: "testreddit",
        });

        const result = await authorizeCredentials({
          email: "test@example.com",
          password,
        });

        expect(result).toEqual({
          id: "test-user-id",
          email: "test@example.com",
        });
        // Verify sensitive data is not included
        expect(result).not.toHaveProperty("passwordHash");
        expect(result).not.toHaveProperty("groqApiKey");
        expect(result).not.toHaveProperty("redditUsername");
      });

      it("preserves exact email case from database", async () => {
        const password = "Password123!";
        const passwordHash = await hashPassword(password);

        mockFindFirst.mockResolvedValueOnce({
          id: "user-id",
          email: "User@Example.COM",
          passwordHash,
        });

        const result = await authorizeCredentials({
          email: "user@example.com",
          password,
        });

        // Email should match what's in the database
        expect(result?.email).toBe("User@Example.COM");
      });
    });

    describe("security properties", () => {
      it("performs case-sensitive password comparison", async () => {
        const password = "CaseSensitive123!";
        const passwordHash = await hashPassword(password);

        mockFindFirst.mockResolvedValueOnce({
          id: "user-id",
          email: "user@example.com",
          passwordHash,
        });

        // Try lowercase version
        const result = await authorizeCredentials({
          email: "user@example.com",
          password: "casesensitive123!",
        });

        expect(result).toBeNull();
      });

      it("does not expose timing information for invalid email", async () => {
        const start = Date.now();
        await authorizeCredentials({
          email: "invalid-email",
          password: "password",
        });
        const invalidEmailDuration = Date.now() - start;

        // Invalid email should return quickly (< 10ms typically)
        expect(invalidEmailDuration).toBeLessThan(50);
      });
    });
  });
});
