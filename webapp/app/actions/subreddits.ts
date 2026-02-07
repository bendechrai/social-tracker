"use server";

import { db } from "@/lib/db";
import { subreddits, posts, userPosts, userPostTags, tags } from "@/drizzle/schema";
import { getCurrentUserId } from "./users";
import { subredditNameSchema } from "@/lib/validations";
import { verifySubredditExists } from "@/lib/reddit";
import { eq, and, asc } from "drizzle-orm";
import type { Post } from "@/drizzle/schema";
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
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid subreddit name" };
  }

  const normalizedName = parsed.data;

  // Verify subreddit exists via Arctic Shift API
  const exists = await verifySubredditExists(normalizedName);
  if (!exists) {
    return { success: false, error: "Subreddit not found on Reddit" };
  }

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

  // Link existing posts or trigger on-demand fetch
  // Check if posts already exist for this subreddit name in the global posts table
  const existingPosts = await db.query.posts.findMany({
    where: eq(posts.subreddit, normalizedName),
  });

  if (existingPosts.length > 0) {
    // Posts exist — link them to this user (create user_posts and user_post_tags)
    await linkExistingPostsToUser(userId, existingPosts);
  } else {
    // Brand-new subreddit — trigger immediate fetch via the cron endpoint
    const { GET } = await import("@/app/api/cron/fetch-posts/route");
    await GET();
  }

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

// Link existing global posts to a user by creating user_posts and user_post_tags.
// Used when a user adds a subreddit that already has posts in the system.
async function linkExistingPostsToUser(
  userId: string,
  existingPosts: Post[]
): Promise<void> {
  // Load user's tags with search terms for matching
  const userTags = await db.query.tags.findMany({
    where: eq(tags.userId, userId),
    with: {
      searchTerms: true,
    },
  });

  // Build term → tagIds map
  const termToTagIds = new Map<string, string[]>();
  for (const tag of userTags) {
    for (const st of tag.searchTerms) {
      const existing = termToTagIds.get(st.term) ?? [];
      existing.push(tag.id);
      termToTagIds.set(st.term, existing);
    }
  }

  for (const post of existingPosts) {
    // Create user_post (conflict on (user_id, post_id) do nothing)
    const userPostResult = await db
      .insert(userPosts)
      .values({
        userId,
        postId: post.id,
        status: "new",
      })
      .onConflictDoNothing()
      .returning();

    if (userPostResult[0]) {
      // Match tags for this user
      const postText = `${post.title} ${post.body ?? ""}`.toLowerCase();
      const matchedTagIds = new Set<string>();

      for (const [term, tagIdList] of termToTagIds.entries()) {
        if (postText.includes(term.toLowerCase())) {
          for (const tagId of tagIdList) {
            matchedTagIds.add(tagId);
          }
        }
      }

      for (const tagId of matchedTagIds) {
        await db
          .insert(userPostTags)
          .values({
            userId,
            postId: post.id,
            tagId,
          })
          .onConflictDoNothing();
      }
    }
  }
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
