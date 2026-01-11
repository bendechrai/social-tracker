"use server";

import { db } from "@/lib/db";
import { subreddits } from "@/drizzle/schema";
import { getCurrentUserId } from "./users";
import { subredditNameSchema } from "@/lib/validations";
import { eq, and, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface SubredditData {
  id: string;
  name: string;
  createdAt: Date;
}

// List all subreddits for the current user, alphabetically ordered
export async function listSubreddits(): Promise<SubredditData[]> {
  const userId = await getCurrentUserId();

  const results = await db.query.subreddits.findMany({
    where: eq(subreddits.userId, userId),
    orderBy: [asc(subreddits.name)],
  });

  return results.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
  }));
}

// Add a new subreddit
export async function addSubreddit(
  name: string
): Promise<{ success: true; subreddit: SubredditData } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Validate and normalize the name
  const parsed = subredditNameSchema.safeParse(name);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid subreddit name" };
  }

  const normalizedName = parsed.data;

  // Check for duplicate
  const existing = await db.query.subreddits.findFirst({
    where: and(
      eq(subreddits.userId, userId),
      eq(subreddits.name, normalizedName)
    ),
  });

  if (existing) {
    return { success: false, error: "Subreddit already added" };
  }

  // Create the subreddit
  const [created] = await db
    .insert(subreddits)
    .values({ userId, name: normalizedName })
    .returning();

  revalidatePath("/");

  return {
    success: true,
    subreddit: {
      id: created!.id,
      name: created!.name,
      createdAt: created!.createdAt,
    },
  };
}

// Remove a subreddit
export async function removeSubreddit(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Verify the subreddit belongs to the user
  const existing = await db.query.subreddits.findFirst({
    where: and(eq(subreddits.id, id), eq(subreddits.userId, userId)),
  });

  if (!existing) {
    return { success: false, error: "Subreddit not found" };
  }

  // Delete the subreddit (posts from this subreddit remain in the database)
  await db.delete(subreddits).where(eq(subreddits.id, id));

  revalidatePath("/");

  return { success: true };
}
