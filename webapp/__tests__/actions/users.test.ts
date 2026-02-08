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
});
