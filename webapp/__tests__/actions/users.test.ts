/**
 * Unit tests for user server actions (email notifications).
 *
 * Verifies:
 * - getEmailNotifications returns the user's preference
 * - updateEmailNotifications updates the email_notifications column
 * - Authentication required for both operations
 * - Error handling for database failures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth before importing actions
const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock database
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

import {
  getEmailNotifications,
  updateEmailNotifications,
  getEmailVerified,
  getShowNsfw,
  updateShowNsfw,
} from "@/app/actions/users";

const MOCK_USER_ID = "test-user-uuid-1234";

describe("User email notification actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: authenticated user
    mockAuth.mockResolvedValue({
      user: { id: MOCK_USER_ID },
    });
  });

  describe("getEmailNotifications", () => {
    it("returns true when user has notifications enabled", async () => {
      mockFindFirst.mockResolvedValue({ emailNotifications: true });

      const result = await getEmailNotifications();

      expect(result).toBe(true);
    });

    it("returns false when user has notifications disabled", async () => {
      mockFindFirst.mockResolvedValue({ emailNotifications: false });

      const result = await getEmailNotifications();

      expect(result).toBe(false);
    });

    it("returns true by default when user not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getEmailNotifications();

      expect(result).toBe(true);
    });

    it("throws when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(getEmailNotifications()).rejects.toThrow(
        "Not authenticated"
      );
    });
  });

  describe("updateEmailNotifications", () => {
    it("enables email notifications", async () => {
      const result = await updateEmailNotifications(true);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          emailNotifications: true,
        })
      );
    });

    it("disables email notifications", async () => {
      const result = await updateEmailNotifications(false);

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          emailNotifications: false,
        })
      );
    });

    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const result = await updateEmailNotifications(true);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("handles database errors gracefully", async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await updateEmailNotifications(true);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update email notifications");
    });
  });

  describe("getShowNsfw", () => {
    it("returns true when user has show_nsfw enabled", async () => {
      mockFindFirst.mockResolvedValue({ showNsfw: true });

      const result = await getShowNsfw();

      expect(result).toBe(true);
    });

    it("returns false when user has show_nsfw disabled", async () => {
      mockFindFirst.mockResolvedValue({ showNsfw: false });

      const result = await getShowNsfw();

      expect(result).toBe(false);
    });

    it("returns false by default when user not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getShowNsfw();

      expect(result).toBe(false);
    });

    it("throws when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(getShowNsfw()).rejects.toThrow("Not authenticated");
    });
  });

  describe("updateShowNsfw", () => {
    it("enables NSFW content", async () => {
      const result = await updateShowNsfw(true);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          showNsfw: true,
        })
      );
    });

    it("disables NSFW content", async () => {
      const result = await updateShowNsfw(false);

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          showNsfw: false,
        })
      );
    });

    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const result = await updateShowNsfw(true);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("handles database errors gracefully", async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await updateShowNsfw(true);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update NSFW preference");
    });
  });

  describe("getEmailVerified", () => {
    it("returns true when user email is verified", async () => {
      mockFindFirst.mockResolvedValue({ emailVerified: new Date() });

      const result = await getEmailVerified();

      expect(result).toBe(true);
    });

    it("returns false when user email is not verified", async () => {
      mockFindFirst.mockResolvedValue({ emailVerified: null });

      const result = await getEmailVerified();

      expect(result).toBe(false);
    });

    it("returns false when user not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getEmailVerified();

      expect(result).toBe(false);
    });

    it("throws when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(getEmailVerified()).rejects.toThrow("Not authenticated");
    });
  });
});
