/**
 * Unit tests for tag server actions.
 *
 * These tests verify that tag actions correctly:
 * - List tags with search terms and post counts, alphabetically ordered
 * - Create tags with optional color and initial terms
 * - Update tag name and color with uniqueness validation
 * - Delete tags with proper cascade to search terms and user_user_post_tags
 * - Add and remove search terms with case-insensitive duplicate detection
 *
 * Uses mocked database to isolate unit tests from database.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock database before importing actions
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockValues = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      tags: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      searchTerms: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...valArgs: unknown[]) => {
          mockValues(...valArgs);
          return {
            returning: () => mockReturning(),
          };
        },
      };
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return {
        where: (...whereArgs: unknown[]) => {
          mockWhere(...whereArgs);
          return Promise.resolve();
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...setArgs: unknown[]) => {
          mockSet(...setArgs);
          return {
            where: (...whereArgs: unknown[]) => {
              mockWhere(...whereArgs);
              return {
                returning: () => mockReturning(),
              };
            },
          };
        },
      };
    },
  },
}));

// Mock next/cache revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock users action to return consistent user ID
vi.mock("@/app/actions/users", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("test-user-uuid-1234"),
}));

// User ID constant for use in tests
const MOCK_USER_ID = "test-user-uuid-1234";

// Import after mocks are set up
import {
  listTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  addSearchTerm,
  removeSearchTerm,
} from "@/app/actions/tags";
import { TAG_COLOR_PALETTE } from "@/lib/validations";

describe("tag server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("listTags", () => {
    it("returns empty array when no tags exist", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await listTags();

      expect(result).toEqual([]);
      expect(mockFindMany).toHaveBeenCalledOnce();
    });

    it("returns tags with search terms and post counts", async () => {
      const mockData = [
        {
          id: "tag-1",
          name: "Distributed PG",
          color: "#10b981",
          userId: MOCK_USER_ID,
          createdAt: new Date("2024-01-01"),
          searchTerms: [
            { id: "term-1", term: "distributed postgres", tagId: "tag-1", createdAt: new Date() },
            { id: "term-2", term: "distributed postgresql", tagId: "tag-1", createdAt: new Date() },
          ],
          userPostTags: [{ userId: MOCK_USER_ID, postId: "post-1", tagId: "tag-1" }, { userId: MOCK_USER_ID, postId: "post-2", tagId: "tag-1" }],
        },
        {
          id: "tag-2",
          name: "Yugabyte",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date("2024-01-02"),
          searchTerms: [
            { id: "term-3", term: "yugabyte", tagId: "tag-2", createdAt: new Date() },
          ],
          userPostTags: [{ userId: MOCK_USER_ID, postId: "post-3", tagId: "tag-2" }],
        },
      ];
      mockFindMany.mockResolvedValue(mockData);

      const result = await listTags();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "tag-1",
        name: "Distributed PG",
        color: "#10b981",
        createdAt: new Date("2024-01-01"),
        terms: [
          { id: "term-1", term: "distributed postgres" },
          { id: "term-2", term: "distributed postgresql" },
        ],
        postCount: 2,
      });
      expect(result[1]).toEqual({
        id: "tag-2",
        name: "Yugabyte",
        color: "#6366f1",
        createdAt: new Date("2024-01-02"),
        terms: [{ id: "term-3", term: "yugabyte" }],
        postCount: 1,
      });
    });

    it("returns tags in alphabetical order", async () => {
      const mockData = [
        {
          id: "tag-1",
          name: "Database",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [],
          userPostTags: [],
        },
        {
          id: "tag-2",
          name: "Node",
          color: "#10b981",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [],
          userPostTags: [],
        },
        {
          id: "tag-3",
          name: "PostgreSQL",
          color: "#f59e0b",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [],
          userPostTags: [],
        },
      ];
      mockFindMany.mockResolvedValue(mockData);

      const result = await listTags();

      expect(result.map((t) => t.name)).toEqual(["Database", "Node", "PostgreSQL"]);
    });
  });

  describe("getTag", () => {
    it("returns error when tag not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getTag("nonexistent-id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tag not found");
      }
    });

    it("returns tag with terms and post count", async () => {
      mockFindFirst.mockResolvedValue({
        id: "tag-1",
        name: "Yugabyte",
        color: "#6366f1",
        userId: MOCK_USER_ID,
        createdAt: new Date("2024-01-01"),
        searchTerms: [
          { id: "term-1", term: "yugabyte", tagId: "tag-1", createdAt: new Date() },
          { id: "term-2", term: "yugabytedb", tagId: "tag-1", createdAt: new Date() },
        ],
        userPostTags: [
          { userId: MOCK_USER_ID, postId: "post-1", tagId: "tag-1" },
          { userId: MOCK_USER_ID, postId: "post-2", tagId: "tag-1" },
          { userId: MOCK_USER_ID, postId: "post-3", tagId: "tag-1" },
        ],
      });

      const result = await getTag("tag-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tag.id).toBe("tag-1");
        expect(result.tag.name).toBe("Yugabyte");
        expect(result.tag.color).toBe("#6366f1");
        expect(result.tag.terms).toHaveLength(2);
        expect(result.tag.postCount).toBe(3);
      }
    });
  });

  describe("createTag", () => {
    describe("validation", () => {
      it("rejects empty tag name", async () => {
        // Validation happens before database queries, so no mocks needed
        const result = await createTag("");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("Tag name is required");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects name longer than 100 characters", async () => {
        // Validation happens before database queries, so no mocks needed
        const result = await createTag("a".repeat(101));

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("at most 100 characters");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });

      it("rejects invalid color format", async () => {
        // Validation happens before database queries when color is provided
        const result = await createTag("Test", "invalid-color");

        expect(result.success).toBe(false);
        expect(mockInsert).not.toHaveBeenCalled();
      });
    });

    describe("default color with getNextTagColor", () => {
      it("uses first palette color when no existing tags", async () => {
        // No existing tags (empty array)
        mockFindMany.mockResolvedValue([]);
        mockFindFirst.mockResolvedValue(null); // No duplicate
        mockReturning.mockResolvedValue([
          {
            id: "new-tag",
            name: "Test",
            color: TAG_COLOR_PALETTE[0],
            userId: MOCK_USER_ID,
            createdAt: new Date(),
          },
        ]);

        const result = await createTag("Test");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.tag.color).toBe(TAG_COLOR_PALETTE[0]);
        }
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({ color: TAG_COLOR_PALETTE[0] })
        );
      });

      it("uses next available palette color when some colors are in use", async () => {
        // Simulate first color already in use
        mockFindMany.mockResolvedValue([{ color: TAG_COLOR_PALETTE[0] }]);
        mockFindFirst.mockResolvedValue(null); // No duplicate
        mockReturning.mockResolvedValue([
          {
            id: "new-tag",
            name: "Test",
            color: TAG_COLOR_PALETTE[1], // Should be second color
            userId: MOCK_USER_ID,
            createdAt: new Date(),
          },
        ]);

        const result = await createTag("Test");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.tag.color).toBe(TAG_COLOR_PALETTE[1]);
        }
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({ color: TAG_COLOR_PALETTE[1] })
        );
      });

      it("cycles through palette colors as tags are created", async () => {
        // Simulate first three colors already in use
        mockFindMany.mockResolvedValue([
          { color: TAG_COLOR_PALETTE[0] },
          { color: TAG_COLOR_PALETTE[1] },
          { color: TAG_COLOR_PALETTE[2] },
        ]);
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          {
            id: "new-tag",
            name: "Test",
            color: TAG_COLOR_PALETTE[3], // Should be fourth color
            userId: MOCK_USER_ID,
            createdAt: new Date(),
          },
        ]);

        const result = await createTag("Test");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.tag.color).toBe(TAG_COLOR_PALETTE[3]);
        }
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({ color: TAG_COLOR_PALETTE[3] })
        );
      });

      it("cycles back to first color when all palette colors are used", async () => {
        // All 8 colors in use
        mockFindMany.mockResolvedValue(
          TAG_COLOR_PALETTE.map((color) => ({ color }))
        );
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          {
            id: "new-tag",
            name: "Test",
            color: TAG_COLOR_PALETTE[0], // Should cycle back to first
            userId: MOCK_USER_ID,
            createdAt: new Date(),
          },
        ]);

        const result = await createTag("Test");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.tag.color).toBe(TAG_COLOR_PALETTE[0]);
        }
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({ color: TAG_COLOR_PALETTE[0] })
        );
      });

      it("uses provided custom color when valid (skips auto-color)", async () => {
        mockFindFirst.mockResolvedValue(null);
        mockReturning.mockResolvedValue([
          {
            id: "new-tag",
            name: "Test",
            color: "#ff5733",
            userId: MOCK_USER_ID,
            createdAt: new Date(),
          },
        ]);

        const result = await createTag("Test", "#ff5733");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.tag.color).toBe("#ff5733");
        }
        // Should not query for existing tag colors when color is provided
        expect(mockFindMany).not.toHaveBeenCalled();
      });
    });

    describe("duplicate detection", () => {
      it("rejects duplicate tag name for same user", async () => {
        // Mock for getNextTagColor query (existing tags)
        mockFindMany.mockResolvedValue([]);
        mockFindFirst.mockResolvedValue({
          id: "existing-tag",
          name: "Yugabyte",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        });

        const result = await createTag("Yugabyte");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe("Tag with this name already exists");
        }
        expect(mockInsert).not.toHaveBeenCalled();
      });
    });

    describe("initial terms", () => {
      it("creates tag with initial search terms", async () => {
        // Mock for getNextTagColor query (existing tags)
        mockFindMany.mockResolvedValue([]);
        // First call: check for duplicate tag - should return null
        // Subsequent calls: check for duplicate terms - should return null
        mockFindFirst.mockImplementation(() => {
          return Promise.resolve(null);
        });

        mockReturning
          .mockResolvedValueOnce([
            {
              id: "new-tag",
              name: "Yugabyte",
              color: "#6366f1",
              userId: MOCK_USER_ID,
              createdAt: new Date(),
            },
          ])
          .mockResolvedValueOnce([
            { id: "term-1", term: "yugabyte", tagId: "new-tag", createdAt: new Date() },
          ])
          .mockResolvedValueOnce([
            { id: "term-2", term: "yugabytedb", tagId: "new-tag", createdAt: new Date() },
          ]);

        const result = await createTag("Yugabyte", undefined, ["Yugabyte", "YugabyteDB"]);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.tag.name).toBe("Yugabyte");
          expect(result.tag.terms).toHaveLength(2);
        }
      });

      it("normalizes initial terms to lowercase", async () => {
        // Mock for getNextTagColor query (existing tags)
        mockFindMany.mockResolvedValue([]);
        mockFindFirst.mockResolvedValue(null);
        mockReturning
          .mockResolvedValueOnce([
            {
              id: "new-tag",
              name: "Test",
              color: "#6366f1",
              userId: MOCK_USER_ID,
              createdAt: new Date(),
            },
          ])
          .mockResolvedValueOnce([
            { id: "term-1", term: "distributed postgres", tagId: "new-tag", createdAt: new Date() },
          ]);

        await createTag("Test", undefined, ["Distributed Postgres"]);

        // Verify the term was normalized when inserted
        expect(mockValues).toHaveBeenCalledWith(
          expect.objectContaining({ term: "distributed postgres" })
        );
      });
    });

    describe("successful creation", () => {
      it("creates tag and returns complete data", async () => {
        mockFindFirst.mockResolvedValue(null);
        const createdAt = new Date();
        mockReturning.mockResolvedValue([
          {
            id: "new-tag-id",
            name: "PostgreSQL",
            color: "#10b981",
            userId: MOCK_USER_ID,
            createdAt,
          },
        ]);

        const result = await createTag("PostgreSQL", "#10b981");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.tag).toEqual({
            id: "new-tag-id",
            name: "PostgreSQL",
            color: "#10b981",
            createdAt,
            terms: [],
            postCount: 0,
          });
        }
      });
    });
  });

  describe("updateTag", () => {
    it("returns error when tag not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await updateTag("nonexistent-id", "New Name");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tag not found");
      }
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("updates tag name", async () => {
      // First call: find existing tag
      // Second call: check for duplicate name
      mockFindFirst
        .mockResolvedValueOnce({
          id: "tag-1",
          name: "Old Name",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [],
          userPostTags: [],
        })
        .mockResolvedValueOnce(null); // No duplicate

      mockReturning.mockResolvedValue([
        {
          id: "tag-1",
          name: "New Name",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        },
      ]);

      const result = await updateTag("tag-1", "New Name");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tag.name).toBe("New Name");
      }
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Name" })
      );
    });

    it("updates tag color", async () => {
      mockFindFirst.mockResolvedValue({
        id: "tag-1",
        name: "Test",
        color: "#6366f1",
        userId: MOCK_USER_ID,
        createdAt: new Date(),
        searchTerms: [],
        userPostTags: [],
      });

      mockReturning.mockResolvedValue([
        {
          id: "tag-1",
          name: "Test",
          color: "#ff5733",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        },
      ]);

      const result = await updateTag("tag-1", undefined, "#ff5733");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tag.color).toBe("#ff5733");
      }
    });

    it("rejects duplicate name when updating", async () => {
      // First call: find existing tag
      // Second call: find duplicate with same name
      mockFindFirst
        .mockResolvedValueOnce({
          id: "tag-1",
          name: "Original",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
          searchTerms: [],
          userPostTags: [],
        })
        .mockResolvedValueOnce({
          id: "tag-2", // Different ID
          name: "Existing",
          color: "#10b981",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        });

      const result = await updateTag("tag-1", "Existing");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tag with this name already exists");
      }
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("rejects invalid color format when updating", async () => {
      mockFindFirst.mockResolvedValue({
        id: "tag-1",
        name: "Test",
        color: "#6366f1",
        userId: MOCK_USER_ID,
        createdAt: new Date(),
        searchTerms: [],
        userPostTags: [],
      });

      const result = await updateTag("tag-1", undefined, "invalid");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid color format");
      }
    });
  });

  describe("deleteTag", () => {
    it("returns error when tag not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await deleteTag("nonexistent-id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tag not found");
      }
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("successfully deletes tag", async () => {
      mockFindFirst.mockResolvedValue({
        id: "tag-to-delete",
        name: "Test",
        color: "#6366f1",
        userId: MOCK_USER_ID,
        createdAt: new Date(),
      });

      const result = await deleteTag("tag-to-delete");

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledOnce();
    });

    it("cascade deletes search terms and user_post_tags (via schema constraint)", async () => {
      // The cascade is handled by database FK constraints, not by the action code
      // This test verifies that only the tag table delete is called
      mockFindFirst.mockResolvedValue({
        id: "tag-to-delete",
        name: "Test",
        color: "#6366f1",
        userId: MOCK_USER_ID,
        createdAt: new Date(),
      });

      const result = await deleteTag("tag-to-delete");

      expect(result.success).toBe(true);
      // Only one delete call should be made (to tags table)
      // Cascade handles search_terms and user_post_tags
      expect(mockDelete).toHaveBeenCalledOnce();
    });
  });

  describe("addSearchTerm", () => {
    it("returns error when tag not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await addSearchTerm("nonexistent-tag", "test term");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Tag not found");
      }
    });

    it("validates and normalizes term to lowercase", async () => {
      // First call: find tag
      // Second call: check for duplicate term
      mockFindFirst
        .mockResolvedValueOnce({
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        })
        .mockResolvedValueOnce(null); // No duplicate

      mockReturning.mockResolvedValue([
        { id: "new-term", term: "distributed postgres", tagId: "tag-1", createdAt: new Date() },
      ]);

      const result = await addSearchTerm("tag-1", "Distributed Postgres");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.term.term).toBe("distributed postgres");
      }
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ term: "distributed postgres" })
      );
    });

    it("rejects empty term", async () => {
      mockFindFirst.mockResolvedValue({
        id: "tag-1",
        name: "Test",
        color: "#6366f1",
        userId: MOCK_USER_ID,
        createdAt: new Date(),
      });

      const result = await addSearchTerm("tag-1", "");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Search term is required");
      }
    });

    it("rejects duplicate term (case-insensitive)", async () => {
      // First call: find tag
      // Second call: find duplicate term (normalized to lowercase)
      mockFindFirst
        .mockResolvedValueOnce({
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "existing-term",
          term: "yugabyte",
          tagId: "tag-1",
          createdAt: new Date(),
        });

      const result = await addSearchTerm("tag-1", "YUGABYTE"); // Uppercase input

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Term already exists for this tag");
      }
    });

    it("successfully adds term", async () => {
      mockFindFirst
        .mockResolvedValueOnce({
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        })
        .mockResolvedValueOnce(null);

      mockReturning.mockResolvedValue([
        { id: "new-term-id", term: "new search term", tagId: "tag-1", createdAt: new Date() },
      ]);

      const result = await addSearchTerm("tag-1", "new search term");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.term).toEqual({
          id: "new-term-id",
          term: "new search term",
        });
      }
    });
  });

  describe("removeSearchTerm", () => {
    it("returns error when term not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await removeSearchTerm("nonexistent-term");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Search term not found");
      }
    });

    it("returns error when term belongs to different user", async () => {
      mockFindFirst.mockResolvedValue({
        id: "term-1",
        term: "test",
        tagId: "tag-1",
        createdAt: new Date(),
        tag: {
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: "different-user-id", // Different user
          createdAt: new Date(),
        },
      });

      const result = await removeSearchTerm("term-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Search term not found");
      }
    });

    it("successfully removes term", async () => {
      mockFindFirst.mockResolvedValue({
        id: "term-to-delete",
        term: "test",
        tagId: "tag-1",
        createdAt: new Date(),
        tag: {
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        },
      });

      const result = await removeSearchTerm("term-to-delete");

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledOnce();
    });

    it("does not untag already-tagged posts when removing term", async () => {
      // Removing a search term should not affect posts that were already tagged
      // This is verified by only deleting from search_terms table
      mockFindFirst.mockResolvedValue({
        id: "term-to-delete",
        term: "test",
        tagId: "tag-1",
        createdAt: new Date(),
        tag: {
          id: "tag-1",
          name: "Test",
          color: "#6366f1",
          userId: MOCK_USER_ID,
          createdAt: new Date(),
        },
      });

      const result = await removeSearchTerm("term-to-delete");

      expect(result.success).toBe(true);
      // Only one delete call (search_terms), no user_post_tags manipulation
      expect(mockDelete).toHaveBeenCalledOnce();
    });
  });
});
