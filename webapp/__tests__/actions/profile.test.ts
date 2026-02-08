/**
 * Unit tests for profile server actions.
 *
 * Verifies:
 * - getProfile returns profile fields for authenticated user
 * - updateProfile saves all fields, trims whitespace, validates constraints
 * - Authentication required for both operations
 * - Error handling
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

import { getProfile, updateProfile } from "@/app/actions/profile";

const MOCK_USER_ID = "test-user-uuid-1234";

describe("Profile server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: MOCK_USER_ID },
    });
  });

  describe("getProfile", () => {
    it("returns profile fields for authenticated user", async () => {
      mockFindFirst.mockResolvedValue({
        profileRole: "Developer Advocate",
        profileCompany: "YugabyteDB",
        profileGoal: "Engage with community discussions",
        profileTone: "casual",
        profileContext: "Keep responses short",
      });

      const result = await getProfile();

      expect(result).toEqual({
        role: "Developer Advocate",
        company: "YugabyteDB",
        goal: "Engage with community discussions",
        tone: "casual",
        context: "Keep responses short",
      });
    });

    it("returns null fields when profile is empty", async () => {
      mockFindFirst.mockResolvedValue({
        profileRole: null,
        profileCompany: null,
        profileGoal: null,
        profileTone: null,
        profileContext: null,
      });

      const result = await getProfile();

      expect(result).toEqual({
        role: null,
        company: null,
        goal: null,
        tone: null,
        context: null,
      });
    });

    it("returns null fields when user not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getProfile();

      expect(result).toEqual({
        role: null,
        company: null,
        goal: null,
        tone: null,
        context: null,
      });
    });

    it("throws when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(getProfile()).rejects.toThrow("Not authenticated");
    });
  });

  describe("updateProfile", () => {
    it("saves all fields", async () => {
      const result = await updateProfile({
        role: "Developer Advocate",
        company: "YugabyteDB",
        goal: "Engage with community",
        tone: "casual",
        context: "Keep it short",
      });

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          profileRole: "Developer Advocate",
          profileCompany: "YugabyteDB",
          profileGoal: "Engage with community",
          profileTone: "casual",
          profileContext: "Keep it short",
        })
      );
    });

    it("trims whitespace from all fields", async () => {
      const result = await updateProfile({
        role: "  Developer Advocate  ",
        company: "  YugabyteDB  ",
        goal: "  Engage  ",
        tone: "casual",
        context: "  Keep it short  ",
      });

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          profileRole: "Developer Advocate",
          profileCompany: "YugabyteDB",
          profileGoal: "Engage",
          profileContext: "Keep it short",
        })
      );
    });

    it("validates tone enum - accepts valid tones", async () => {
      for (const tone of ["casual", "professional", "technical", "friendly"]) {
        vi.resetAllMocks();
        mockAuth.mockResolvedValue({ user: { id: MOCK_USER_ID } });

        const result = await updateProfile({ tone });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid tone value", async () => {
      const result = await updateProfile({ tone: "sarcastic" });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Invalid tone. Must be casual, professional, technical, or friendly"
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("validates role max length", async () => {
      const result = await updateProfile({ role: "a".repeat(256) });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Role must be 255 characters or less");
    });

    it("validates company max length", async () => {
      const result = await updateProfile({ company: "a".repeat(256) });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Company must be 255 characters or less");
    });

    it("validates goal max length", async () => {
      const result = await updateProfile({ goal: "a".repeat(1001) });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Goal must be 1000 characters or less");
    });

    it("validates context max length", async () => {
      const result = await updateProfile({ context: "a".repeat(2001) });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Context must be 2000 characters or less");
    });

    it("clears fields with empty strings", async () => {
      const result = await updateProfile({
        role: "",
        company: "",
        goal: "",
        tone: "",
        context: "",
      });

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          profileRole: null,
          profileCompany: null,
          profileGoal: null,
          profileTone: null,
          profileContext: null,
        })
      );
    });

    it("partial update preserves other fields (only sends provided fields)", async () => {
      const result = await updateProfile({ role: "Engineer" });

      expect(result.success).toBe(true);
      const setArg = mockSet.mock.calls[0]![0] as Record<string, unknown>;
      expect(setArg.profileRole).toBe("Engineer");
      expect(setArg).not.toHaveProperty("profileCompany");
      expect(setArg).not.toHaveProperty("profileGoal");
      expect(setArg).not.toHaveProperty("profileTone");
      expect(setArg).not.toHaveProperty("profileContext");
    });

    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const result = await updateProfile({ role: "Engineer" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });

    it("handles database errors gracefully", async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await updateProfile({ role: "Engineer" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update profile");
    });
  });
});
