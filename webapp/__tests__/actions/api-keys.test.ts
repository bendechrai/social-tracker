/**
 * Unit tests for API key server actions.
 *
 * These tests verify that API key actions correctly:
 * - Save encrypted Groq API keys to the database
 * - Check if a user has an API key configured
 * - Get the last 4 characters of an API key for display
 * - Delete API keys from the database
 * - Validate API key format before saving
 * - Require authentication for all operations
 *
 * Uses mocked database and encryption to isolate unit tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database before importing actions
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...setArgs: unknown[]) => {
          mockSet(...setArgs);
          return {
            where: (...whereArgs: unknown[]) => {
              mockWhere(...whereArgs);
              return Promise.resolve();
            },
          };
        },
      };
    },
  },
}));

// Mock encryption module
const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();

vi.mock("@/lib/encryption", () => ({
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

// Mock getCurrentUserId
const mockGetCurrentUserId = vi.fn();

vi.mock("@/app/actions/users", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

// Import after mocks are set up
import {
  saveGroqApiKey,
  hasGroqApiKey,
  getGroqApiKeyHint,
  getGroqApiKey,
  deleteGroqApiKey,
} from "@/app/actions/api-keys";

// Test constants
const MOCK_USER_ID = "test-user-uuid-1234";
const VALID_API_KEY = "gsk_abc123def456ghi789jkl012mno345";
const ENCRYPTED_KEY = "encrypted:data:here";

describe("API key server actions", () => {
  beforeEach(() => {
    // Reset all mocks including implementations (not just call history)
    vi.resetAllMocks();
    // Default: authenticated user
    mockGetCurrentUserId.mockResolvedValue(MOCK_USER_ID);
    // Default encryption mocks
    mockEncrypt.mockReturnValue(ENCRYPTED_KEY);
    mockDecrypt.mockReturnValue(VALID_API_KEY);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("saveGroqApiKey", () => {
    it("encrypts and saves a valid API key", async () => {
      const result = await saveGroqApiKey(VALID_API_KEY);

      expect(result.success).toBe(true);
      expect(mockEncrypt).toHaveBeenCalledWith(VALID_API_KEY);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          groqApiKey: ENCRYPTED_KEY,
        })
      );
    });

    it("trims whitespace from the API key", async () => {
      await saveGroqApiKey(`  ${VALID_API_KEY}  `);

      expect(mockEncrypt).toHaveBeenCalledWith(VALID_API_KEY);
    });

    it("rejects empty API key", async () => {
      const result = await saveGroqApiKey("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API key cannot be empty");
      expect(mockEncrypt).not.toHaveBeenCalled();
    });

    it("rejects whitespace-only API key", async () => {
      const result = await saveGroqApiKey("   ");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API key cannot be empty");
    });

    it("rejects API key without gsk_ prefix", async () => {
      const result = await saveGroqApiKey("abc123def456ghi789");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid Groq API key format. Keys should start with 'gsk_'");
    });

    it("rejects API key that is too short", async () => {
      const result = await saveGroqApiKey("gsk_short");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API key appears to be too short");
    });

    it("returns error when not authenticated", async () => {
      mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

      const result = await saveGroqApiKey(VALID_API_KEY);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("handles database errors gracefully", async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await saveGroqApiKey(VALID_API_KEY);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to save API key");
    });
  });

  describe("hasGroqApiKey", () => {
    it("returns true when user has an API key", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: ENCRYPTED_KEY });

      const result = await hasGroqApiKey();

      expect(result).toBe(true);
    });

    it("returns false when user has no API key", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: null });

      const result = await hasGroqApiKey();

      expect(result).toBe(false);
    });

    it("returns false when user is not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await hasGroqApiKey();

      expect(result).toBe(false);
    });

    it("returns false when not authenticated", async () => {
      mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

      const result = await hasGroqApiKey();

      expect(result).toBe(false);
    });
  });

  describe("getGroqApiKeyHint", () => {
    it("returns last 4 characters of the API key", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: ENCRYPTED_KEY });
      mockDecrypt.mockReturnValue("gsk_abc123def456ghi789jkl012mno345");

      const result = await getGroqApiKeyHint();

      expect(result).toBe("o345");
      expect(mockDecrypt).toHaveBeenCalledWith(ENCRYPTED_KEY);
    });

    it("returns null when user has no API key", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: null });

      const result = await getGroqApiKeyHint();

      expect(result).toBeNull();
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    it("returns null when user is not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getGroqApiKeyHint();

      expect(result).toBeNull();
    });

    it("returns null when not authenticated", async () => {
      mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

      const result = await getGroqApiKeyHint();

      expect(result).toBeNull();
    });

    it("returns null when decryption fails", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: ENCRYPTED_KEY });
      mockDecrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const result = await getGroqApiKeyHint();

      expect(result).toBeNull();
    });
  });

  describe("getGroqApiKey", () => {
    it("returns decrypted API key", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: ENCRYPTED_KEY });
      mockDecrypt.mockReturnValue(VALID_API_KEY);

      const result = await getGroqApiKey();

      expect(result).toBe(VALID_API_KEY);
      expect(mockDecrypt).toHaveBeenCalledWith(ENCRYPTED_KEY);
    });

    it("returns null when user has no API key", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: null });

      const result = await getGroqApiKey();

      expect(result).toBeNull();
    });

    it("returns null when user is not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getGroqApiKey();

      expect(result).toBeNull();
    });

    it("returns null when not authenticated", async () => {
      mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

      const result = await getGroqApiKey();

      expect(result).toBeNull();
    });

    it("returns null when decryption fails", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: ENCRYPTED_KEY });
      mockDecrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const result = await getGroqApiKey();

      expect(result).toBeNull();
    });
  });

  describe("deleteGroqApiKey", () => {
    it("deletes the API key successfully", async () => {
      const result = await deleteGroqApiKey();

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          groqApiKey: null,
        })
      );
    });

    it("returns error when not authenticated", async () => {
      mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

      const result = await deleteGroqApiKey();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("handles database errors gracefully", async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await deleteGroqApiKey();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete API key");
    });
  });

  describe("security properties", () => {
    it("never returns the full API key through hasGroqApiKey", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: ENCRYPTED_KEY });

      const result = await hasGroqApiKey();

      expect(result).toBe(true);
      expect(mockDecrypt).not.toHaveBeenCalled();
    });

    it("only exposes last 4 characters through getGroqApiKeyHint", async () => {
      const longKey = "gsk_verylongapikeywithmanycharacters1234";
      mockFindFirst.mockResolvedValue({ groqApiKey: ENCRYPTED_KEY });
      mockDecrypt.mockReturnValue(longKey);

      const result = await getGroqApiKeyHint();

      expect(result).toBe("1234");
      expect(result?.length).toBe(4);
    });

    it("encrypts key before storing", async () => {
      await saveGroqApiKey(VALID_API_KEY);

      // Verify encryption was called before database update
      expect(mockEncrypt).toHaveBeenCalledBefore(mockUpdate);
    });
  });
});
