/**
 * Unit tests for Reddit connection server actions.
 *
 * These tests verify that Reddit connection actions correctly:
 * - Get Reddit connection status (username, expiry, connected state)
 * - Check if user has Reddit connected
 * - Disconnect Reddit (clear tokens)
 * - Check if OAuth is configured
 * - Require authentication for all operations
 *
 * Uses mocked database to isolate unit tests.
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

// Mock getCurrentUserId
const mockGetCurrentUserId = vi.fn();

vi.mock("@/app/actions/users", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

// Import after mocks are set up
import {
  getRedditConnectionStatus,
  hasRedditConnection,
  disconnectReddit,
  isRedditOAuthConfigured,
} from "@/app/actions/reddit-connection";

// Test constants
const MOCK_USER_ID = "test-user-uuid-1234";
const MOCK_REDDIT_USERNAME = "test_reddit_user";
const MOCK_ACCESS_TOKEN = "encrypted_access_token";
const MOCK_TOKEN_EXPIRES = new Date(Date.now() + 3600000); // 1 hour from now

describe("Reddit connection server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: authenticated user
    mockGetCurrentUserId.mockResolvedValue(MOCK_USER_ID);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getRedditConnectionStatus", () => {
    it("returns connected status with username when connected", async () => {
      mockFindFirst.mockResolvedValue({
        redditUsername: MOCK_REDDIT_USERNAME,
        redditAccessToken: MOCK_ACCESS_TOKEN,
        redditTokenExpiresAt: MOCK_TOKEN_EXPIRES,
      });

      const result = await getRedditConnectionStatus();

      expect(result.connected).toBe(true);
      expect(result.username).toBe(MOCK_REDDIT_USERNAME);
      expect(result.expiresAt).toEqual(MOCK_TOKEN_EXPIRES);
    });

    it("returns not connected when no access token", async () => {
      mockFindFirst.mockResolvedValue({
        redditUsername: null,
        redditAccessToken: null,
        redditTokenExpiresAt: null,
      });

      const result = await getRedditConnectionStatus();

      expect(result.connected).toBe(false);
      expect(result.username).toBeNull();
      expect(result.expiresAt).toBeNull();
    });

    it("returns not connected when user not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getRedditConnectionStatus();

      expect(result.connected).toBe(false);
      expect(result.username).toBeNull();
    });

    it("returns not connected when not authenticated", async () => {
      mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

      const result = await getRedditConnectionStatus();

      expect(result.connected).toBe(false);
    });

    it("returns not connected when username is missing but token exists", async () => {
      mockFindFirst.mockResolvedValue({
        redditUsername: null,
        redditAccessToken: MOCK_ACCESS_TOKEN,
        redditTokenExpiresAt: MOCK_TOKEN_EXPIRES,
      });

      const result = await getRedditConnectionStatus();

      expect(result.connected).toBe(false);
    });
  });

  describe("hasRedditConnection", () => {
    it("returns true when user has Reddit connected", async () => {
      mockFindFirst.mockResolvedValue({
        redditUsername: MOCK_REDDIT_USERNAME,
        redditAccessToken: MOCK_ACCESS_TOKEN,
        redditTokenExpiresAt: MOCK_TOKEN_EXPIRES,
      });

      const result = await hasRedditConnection();

      expect(result).toBe(true);
    });

    it("returns false when user has no Reddit connected", async () => {
      mockFindFirst.mockResolvedValue({
        redditUsername: null,
        redditAccessToken: null,
        redditTokenExpiresAt: null,
      });

      const result = await hasRedditConnection();

      expect(result).toBe(false);
    });

    it("returns false when not authenticated", async () => {
      mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

      const result = await hasRedditConnection();

      expect(result).toBe(false);
    });
  });

  describe("disconnectReddit", () => {
    it("clears all Reddit tokens successfully", async () => {
      const result = await disconnectReddit();

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          redditAccessToken: null,
          redditRefreshToken: null,
          redditTokenExpiresAt: null,
          redditUsername: null,
        })
      );
    });

    it("returns error when not authenticated", async () => {
      mockGetCurrentUserId.mockRejectedValue(new Error("Not authenticated"));

      const result = await disconnectReddit();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("handles database errors gracefully", async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await disconnectReddit();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to disconnect Reddit account");
    });
  });

  describe("isRedditOAuthConfigured", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("returns true when both client ID and secret are set", async () => {
      process.env.REDDIT_CLIENT_ID = "test_client_id";
      process.env.REDDIT_CLIENT_SECRET = "test_client_secret";

      const result = await isRedditOAuthConfigured();

      expect(result).toBe(true);
    });

    it("returns false when client ID is missing", async () => {
      delete process.env.REDDIT_CLIENT_ID;
      process.env.REDDIT_CLIENT_SECRET = "test_client_secret";

      const result = await isRedditOAuthConfigured();

      expect(result).toBe(false);
    });

    it("returns false when client secret is missing", async () => {
      process.env.REDDIT_CLIENT_ID = "test_client_id";
      delete process.env.REDDIT_CLIENT_SECRET;

      const result = await isRedditOAuthConfigured();

      expect(result).toBe(false);
    });

    it("returns false when both are missing", async () => {
      delete process.env.REDDIT_CLIENT_ID;
      delete process.env.REDDIT_CLIENT_SECRET;

      const result = await isRedditOAuthConfigured();

      expect(result).toBe(false);
    });
  });
});
