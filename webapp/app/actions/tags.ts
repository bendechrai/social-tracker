"use server";

import { db } from "@/lib/db";
import { tags, searchTerms } from "@/drizzle/schema";
import { getCurrentUserId } from "./users";
import { tagSchema, searchTermSchema, getNextTagColor } from "@/lib/validations";
import { eq, and, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface TagData {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  terms: Array<{ id: string; term: string }>;
  postCount: number;
}

// List all tags for the current user with search terms and post counts
export async function listTags(): Promise<TagData[]> {
  const userId = await getCurrentUserId();

  // Get all tags with their search terms
  const tagsWithTerms = await db.query.tags.findMany({
    where: eq(tags.userId, userId),
    orderBy: [asc(tags.name)],
    with: {
      searchTerms: {
        orderBy: [asc(searchTerms.term)],
      },
      userPostTags: true,
    },
  });

  return tagsWithTerms.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt,
    terms: tag.searchTerms.map((t) => ({ id: t.id, term: t.term })),
    postCount: tag.userPostTags.length,
  }));
}

// Get a single tag with its terms
export async function getTag(
  id: string
): Promise<{ success: true; tag: TagData } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  const tag = await db.query.tags.findFirst({
    where: and(eq(tags.id, id), eq(tags.userId, userId)),
    with: {
      searchTerms: {
        orderBy: [asc(searchTerms.term)],
      },
      userPostTags: true,
    },
  });

  if (!tag) {
    return { success: false, error: "Tag not found" };
  }

  return {
    success: true,
    tag: {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
      terms: tag.searchTerms.map((t) => ({ id: t.id, term: t.term })),
      postCount: tag.userPostTags.length,
    },
  };
}

// Create a new tag with required initial terms
export async function createTag(
  name: string,
  color?: string,
  initialTerms?: string[]
): Promise<{ success: true; tag: TagData } | { success: false; error: string }> {
  // Validate at least one search term is provided
  if (!initialTerms || initialTerms.length === 0) {
    return { success: false, error: "At least one search term is required" };
  }

  const userId = await getCurrentUserId();

  // Validate tag input
  const parsed = tagSchema.safeParse({ name, color });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid tag data" };
  }

  // Get existing tag colors to determine next available color
  let finalColor = parsed.data.color;
  if (!color) {
    const existingTags = await db.query.tags.findMany({
      where: eq(tags.userId, userId),
      columns: { color: true },
    });
    const existingColors = existingTags.map((t) => t.color);
    finalColor = getNextTagColor(existingColors);
  }

  // Check for duplicate name
  const existing = await db.query.tags.findFirst({
    where: and(
      eq(tags.userId, userId),
      eq(tags.name, parsed.data.name)
    ),
  });

  if (existing) {
    return { success: false, error: "Tag with this name already exists" };
  }

  // Create the tag
  const [created] = await db
    .insert(tags)
    .values({
      userId,
      name: parsed.data.name,
      color: finalColor,
    })
    .returning();

  // Add initial terms if provided
  const terms: Array<{ id: string; term: string }> = [];
  if (initialTerms && initialTerms.length > 0) {
    for (const term of initialTerms) {
      const parsedTerm = searchTermSchema.safeParse(term);
      if (parsedTerm.success) {
        // Check for duplicate term
        const existingTerm = await db.query.searchTerms.findFirst({
          where: and(
            eq(searchTerms.tagId, created!.id),
            eq(searchTerms.term, parsedTerm.data)
          ),
        });

        if (!existingTerm) {
          const [newTerm] = await db
            .insert(searchTerms)
            .values({
              tagId: created!.id,
              term: parsedTerm.data,
            })
            .returning();
          terms.push({ id: newTerm!.id, term: newTerm!.term });
        }
      }
    }
  }

  revalidatePath("/");

  return {
    success: true,
    tag: {
      id: created!.id,
      name: created!.name,
      color: created!.color,
      createdAt: created!.createdAt,
      terms,
      postCount: 0,
    },
  };
}

// Update an existing tag
export async function updateTag(
  id: string,
  name?: string,
  color?: string
): Promise<{ success: true; tag: TagData } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Verify the tag exists and belongs to user
  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.id, id), eq(tags.userId, userId)),
    with: {
      searchTerms: true,
      userPostTags: true,
    },
  });

  if (!existing) {
    return { success: false, error: "Tag not found" };
  }

  // Prepare updates
  const updates: Partial<{ name: string; color: string }> = {};

  if (name !== undefined) {
    // Check for duplicate name
    const duplicate = await db.query.tags.findFirst({
      where: and(
        eq(tags.userId, userId),
        eq(tags.name, name),
        sql`${tags.id} != ${id}`
      ),
    });

    if (duplicate) {
      return { success: false, error: "Tag with this name already exists" };
    }
    updates.name = name;
  }

  if (color !== undefined) {
    // Validate color
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return { success: false, error: "Invalid color format" };
    }
    updates.color = color;
  }

  // Apply updates
  const [updated] = await db
    .update(tags)
    .set(updates)
    .where(eq(tags.id, id))
    .returning();

  revalidatePath("/");

  return {
    success: true,
    tag: {
      id: updated!.id,
      name: updated!.name,
      color: updated!.color,
      createdAt: updated!.createdAt,
      terms: existing.searchTerms.map((t) => ({ id: t.id, term: t.term })),
      postCount: existing.userPostTags.length,
    },
  };
}

// Delete a tag (cascades to search terms and user_post_tags)
export async function deleteTag(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Verify the tag exists and belongs to user
  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.id, id), eq(tags.userId, userId)),
  });

  if (!existing) {
    return { success: false, error: "Tag not found" };
  }

  // Delete the tag (cascade handles search_terms and user_post_tags)
  await db.delete(tags).where(eq(tags.id, id));

  revalidatePath("/");

  return { success: true };
}

// Add a search term to a tag
export async function addSearchTerm(
  tagId: string,
  term: string
): Promise<{ success: true; term: { id: string; term: string } } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Verify the tag exists and belongs to user
  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.id, tagId), eq(tags.userId, userId)),
  });

  if (!existing) {
    return { success: false, error: "Tag not found" };
  }

  // Validate and normalize term
  const parsed = searchTermSchema.safeParse(term);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid search term" };
  }

  // Check for duplicate (case-insensitive)
  const duplicate = await db.query.searchTerms.findFirst({
    where: and(
      eq(searchTerms.tagId, tagId),
      eq(searchTerms.term, parsed.data)
    ),
  });

  if (duplicate) {
    return { success: false, error: "Term already exists for this tag" };
  }

  // Create the term
  const [created] = await db
    .insert(searchTerms)
    .values({
      tagId,
      term: parsed.data,
    })
    .returning();

  revalidatePath("/");

  return {
    success: true,
    term: { id: created!.id, term: created!.term },
  };
}

// Remove a search term
export async function removeSearchTerm(
  termId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Find the term and verify it belongs to a tag owned by the user
  const term = await db.query.searchTerms.findFirst({
    where: eq(searchTerms.id, termId),
    with: {
      tag: true,
    },
  });

  if (!term || term.tag.userId !== userId) {
    return { success: false, error: "Search term not found" };
  }

  // Delete the term
  await db.delete(searchTerms).where(eq(searchTerms.id, termId));

  revalidatePath("/");

  return { success: true };
}
