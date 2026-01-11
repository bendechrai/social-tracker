/**
 * Unit tests for Zod validation schemas.
 *
 * These tests verify that validation schemas correctly accept valid input,
 * reject invalid input with descriptive errors, and apply transformations
 * (like normalization) as specified.
 */
import { describe, it, expect } from "vitest";
import {
  subredditNameSchema,
  tagSchema,
  searchTermSchema,
  postStatusSchema,
  suggestTermsSchema,
  TAG_COLOR_PALETTE,
  getNextTagColor,
} from "@/lib/validations";

describe("subredditNameSchema", () => {
  describe("valid inputs", () => {
    it("accepts a valid lowercase name", () => {
      const result = subredditNameSchema.safeParse("postgresql");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("postgresql");
      }
    });

    it("accepts a name with underscores", () => {
      const result = subredditNameSchema.safeParse("learn_python");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("learn_python");
      }
    });

    it("accepts a name with numbers", () => {
      const result = subredditNameSchema.safeParse("node123");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("node123");
      }
    });

    it("accepts minimum length (3 chars)", () => {
      const result = subredditNameSchema.safeParse("abc");
      expect(result.success).toBe(true);
    });

    it("accepts maximum length (21 chars)", () => {
      const result = subredditNameSchema.safeParse("a".repeat(21));
      expect(result.success).toBe(true);
    });
  });

  describe("normalization", () => {
    it("strips r/ prefix", () => {
      const result = subredditNameSchema.safeParse("r/postgresql");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("postgresql");
      }
    });

    it("strips R/ prefix (case-insensitive)", () => {
      const result = subredditNameSchema.safeParse("R/PostgreSQL");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("postgresql");
      }
    });

    it("converts to lowercase", () => {
      const result = subredditNameSchema.safeParse("PostgreSQL");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("postgresql");
      }
    });

    it("strips prefix and lowercases combined", () => {
      const result = subredditNameSchema.safeParse("r/LearnJavaScript");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("learnjavascript");
      }
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      const result = subredditNameSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Subreddit name is required");
      }
    });

    it("rejects name shorter than 3 characters", () => {
      const result = subredditNameSchema.safeParse("ab");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at least 3 characters");
      }
    });

    it("rejects name longer than 21 characters", () => {
      const result = subredditNameSchema.safeParse("a".repeat(22));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at most 21 characters");
      }
    });

    it("rejects special characters", () => {
      const result = subredditNameSchema.safeParse("test-subreddit");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("letters, numbers, and underscores");
      }
    });

    it("rejects spaces", () => {
      const result = subredditNameSchema.safeParse("learn python");
      expect(result.success).toBe(false);
    });

    it("rejects dots", () => {
      const result = subredditNameSchema.safeParse("node.js");
      expect(result.success).toBe(false);
    });
  });
});

describe("tagSchema", () => {
  describe("valid inputs", () => {
    it("accepts name only (uses default color)", () => {
      const result = tagSchema.safeParse({ name: "Yugabyte" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Yugabyte");
        expect(result.data.color).toBe(TAG_COLOR_PALETTE[0]);
      }
    });

    it("accepts name and valid hex color", () => {
      const result = tagSchema.safeParse({ name: "Test", color: "#ff5733" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#ff5733");
      }
    });

    it("accepts maximum length name (100 chars)", () => {
      const result = tagSchema.safeParse({ name: "a".repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty name", () => {
      const result = tagSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Tag name is required");
      }
    });

    it("rejects name longer than 100 characters", () => {
      const result = tagSchema.safeParse({ name: "a".repeat(101) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at most 100 characters");
      }
    });

    it("rejects invalid color format (no hash)", () => {
      const result = tagSchema.safeParse({ name: "Test", color: "ff5733" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid color format (wrong length)", () => {
      const result = tagSchema.safeParse({ name: "Test", color: "#fff" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid color format (non-hex chars)", () => {
      const result = tagSchema.safeParse({ name: "Test", color: "#gggggg" });
      expect(result.success).toBe(false);
    });
  });
});

describe("searchTermSchema", () => {
  describe("valid inputs", () => {
    it("accepts a simple term", () => {
      const result = searchTermSchema.safeParse("yugabyte");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("yugabyte");
      }
    });

    it("accepts term with spaces", () => {
      const result = searchTermSchema.safeParse("distributed postgres");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("distributed postgres");
      }
    });

    it("accepts maximum length (255 chars)", () => {
      const result = searchTermSchema.safeParse("a".repeat(255));
      expect(result.success).toBe(true);
    });
  });

  describe("normalization to lowercase", () => {
    it("converts uppercase to lowercase", () => {
      const result = searchTermSchema.safeParse("YUGABYTE");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("yugabyte");
      }
    });

    it("converts mixed case to lowercase", () => {
      const result = searchTermSchema.safeParse("YugabyteDB");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("yugabytedb");
      }
    });

    it("normalizes 'Distributed PostgreSQL' to lowercase", () => {
      const result = searchTermSchema.safeParse("Distributed PostgreSQL");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("distributed postgresql");
      }
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      const result = searchTermSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Search term is required");
      }
    });

    it("rejects term longer than 255 characters", () => {
      const result = searchTermSchema.safeParse("a".repeat(256));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at most 255 characters");
      }
    });
  });
});

describe("postStatusSchema", () => {
  describe("valid statuses", () => {
    it("accepts 'new'", () => {
      const result = postStatusSchema.safeParse("new");
      expect(result.success).toBe(true);
    });

    it("accepts 'ignored'", () => {
      const result = postStatusSchema.safeParse("ignored");
      expect(result.success).toBe(true);
    });

    it("accepts 'done'", () => {
      const result = postStatusSchema.safeParse("done");
      expect(result.success).toBe(true);
    });
  });

  describe("invalid statuses", () => {
    it("rejects unknown status", () => {
      const result = postStatusSchema.safeParse("pending");
      expect(result.success).toBe(false);
    });

    it("rejects empty string", () => {
      const result = postStatusSchema.safeParse("");
      expect(result.success).toBe(false);
    });

    it("rejects null", () => {
      const result = postStatusSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it("rejects number", () => {
      const result = postStatusSchema.safeParse(1);
      expect(result.success).toBe(false);
    });
  });
});

describe("suggestTermsSchema", () => {
  describe("valid inputs", () => {
    it("accepts a valid tag name", () => {
      const result = suggestTermsSchema.safeParse({ tagName: "Yugabyte" });
      expect(result.success).toBe(true);
    });

    it("accepts maximum length (100 chars)", () => {
      const result = suggestTermsSchema.safeParse({ tagName: "a".repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty tag name", () => {
      const result = suggestTermsSchema.safeParse({ tagName: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Tag name is required");
      }
    });

    it("rejects tag name longer than 100 characters", () => {
      const result = suggestTermsSchema.safeParse({ tagName: "a".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("rejects missing tagName property", () => {
      const result = suggestTermsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

describe("TAG_COLOR_PALETTE", () => {
  it("contains exactly 8 colors", () => {
    expect(TAG_COLOR_PALETTE).toHaveLength(8);
  });

  it("all colors are valid hex format", () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    for (const color of TAG_COLOR_PALETTE) {
      expect(color).toMatch(hexPattern);
    }
  });

  it("first color is indigo (#6366f1)", () => {
    expect(TAG_COLOR_PALETTE[0]).toBe("#6366f1");
  });

  it("contains expected colors", () => {
    expect(TAG_COLOR_PALETTE).toContain("#6366f1"); // indigo
    expect(TAG_COLOR_PALETTE).toContain("#f43f5e"); // rose
    expect(TAG_COLOR_PALETTE).toContain("#f59e0b"); // amber
    expect(TAG_COLOR_PALETTE).toContain("#10b981"); // emerald
    expect(TAG_COLOR_PALETTE).toContain("#06b6d4"); // cyan
    expect(TAG_COLOR_PALETTE).toContain("#a855f7"); // purple
    expect(TAG_COLOR_PALETTE).toContain("#ec4899"); // pink
    expect(TAG_COLOR_PALETTE).toContain("#3b82f6"); // blue
  });
});

describe("getNextTagColor", () => {
  it("returns first palette color when no colors are used", () => {
    const result = getNextTagColor([]);
    expect(result).toBe(TAG_COLOR_PALETTE[0]);
  });

  it("returns second color when first is used", () => {
    const result = getNextTagColor([TAG_COLOR_PALETTE[0]]);
    expect(result).toBe(TAG_COLOR_PALETTE[1]);
  });

  it("returns first unused color", () => {
    const usedColors = [TAG_COLOR_PALETTE[0], TAG_COLOR_PALETTE[1], TAG_COLOR_PALETTE[2]];
    const result = getNextTagColor(usedColors);
    expect(result).toBe(TAG_COLOR_PALETTE[3]);
  });

  it("cycles back to first when all colors are used", () => {
    const result = getNextTagColor([...TAG_COLOR_PALETTE]);
    expect(result).toBe(TAG_COLOR_PALETTE[0]);
  });

  it("handles non-palette colors in used list", () => {
    const result = getNextTagColor(["#000000", "#ffffff"]);
    expect(result).toBe(TAG_COLOR_PALETTE[0]);
  });
});
