"use server";

import { db } from "@/lib/db";
import { posts, userPosts, userPostTags, tags, subreddits } from "@/drizzle/schema";
import { getCurrentUserId } from "./users";
import { postStatusSchema, type PostStatus } from "@/lib/validations";
import { fetchRedditPosts } from "@/lib/reddit";
import { eq, and, desc, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface PostData {
  id: string;
  redditId: string;
  title: string;
  body: string | null;
  author: string;
  subreddit: string;
  permalink: string;
  url: string | null;
  redditCreatedAt: Date;
  score: number;
  numComments: number;
  status: PostStatus;
  responseText: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ id: string; name: string; color: string }>;
}

export interface ListPostsResult {
  posts: PostData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// List posts with filters and pagination
export async function listPosts(
  status: PostStatus,
  tagIds?: string[],
  page = 1,
  limit = 20
): Promise<ListPostsResult> {
  const userId = await getCurrentUserId();

  // Build the base query conditions on user_posts
  const conditions = [
    eq(userPosts.userId, userId),
    eq(userPosts.status, status),
  ];

  // Get posts with optional tag filtering (supports "untagged" sentinel)
  let filteredPostIds: string[] | null = null;

  if (tagIds && tagIds.length > 0) {
    const includeUntagged = tagIds.includes("untagged");
    const realTagIds = tagIds.filter((id) => id !== "untagged");

    const matchedPostIds = new Set<string>();

    // Get post IDs that have ANY of the selected real tags for this user
    if (realTagIds.length > 0) {
      const postIdsWithTags = await db
        .selectDistinct({ postId: userPostTags.postId })
        .from(userPostTags)
        .where(and(
          eq(userPostTags.userId, userId),
          inArray(userPostTags.tagId, realTagIds),
        ));

      for (const p of postIdsWithTags) {
        matchedPostIds.add(p.postId);
      }
    }

    // Get post IDs that have zero tags for this user (untagged)
    if (includeUntagged) {
      // Find all post IDs that DO have tags
      const postIdsWithAnyTag = await db
        .selectDistinct({ postId: userPostTags.postId })
        .from(userPostTags)
        .where(eq(userPostTags.userId, userId));

      const taggedPostIds = postIdsWithAnyTag.map((p) => p.postId);

      // Get user_posts that are NOT in the tagged set
      const untaggedUserPosts = taggedPostIds.length > 0
        ? await db
          .selectDistinct({ postId: userPosts.postId })
          .from(userPosts)
          .where(and(
            eq(userPosts.userId, userId),
            eq(userPosts.status, status),
            notInArray(userPosts.postId, taggedPostIds),
          ))
        : await db
          .selectDistinct({ postId: userPosts.postId })
          .from(userPosts)
          .where(and(
            eq(userPosts.userId, userId),
            eq(userPosts.status, status),
          ));

      for (const p of untaggedUserPosts) {
        matchedPostIds.add(p.postId);
      }
    }

    filteredPostIds = Array.from(matchedPostIds);

    // If no posts match the filter, return empty
    if (filteredPostIds.length === 0) {
      return {
        posts: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }
  }

  // Count total matching posts
  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(userPosts)
    .where(
      filteredPostIds
        ? and(...conditions, inArray(userPosts.postId, filteredPostIds))
        : and(...conditions)
    );

  const [countResult] = await countQuery;
  const total = Number(countResult?.count ?? 0);
  const totalPages = Math.ceil(total / limit);

  // Get paginated post IDs ordered by Reddit creation time (newest first)
  // Uses query builder (not relational API) to order by posts.redditCreatedAt
  const offset = (page - 1) * limit;

  const paginatedRows = await db
    .select({
      postId: userPosts.postId,
      redditCreatedAt: posts.redditCreatedAt,
    })
    .from(userPosts)
    .innerJoin(posts, eq(userPosts.postId, posts.id))
    .where(
      filteredPostIds
        ? and(...conditions, inArray(userPosts.postId, filteredPostIds))
        : and(...conditions)
    )
    .orderBy(desc(posts.redditCreatedAt))
    .limit(limit)
    .offset(offset);

  const paginatedPostIds = paginatedRows.map((r) => r.postId);

  // Load full data with tags for the paginated post IDs
  let results: Array<{
    post: typeof posts.$inferSelect;
    userId: string;
    postId: string;
    status: string;
    responseText: string | null;
    respondedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    userPostTags: Array<{
      tag: typeof tags.$inferSelect;
    }>;
  }> = [];

  if (paginatedPostIds.length > 0) {
    const loaded = await db.query.userPosts.findMany({
      where: and(
        eq(userPosts.userId, userId),
        inArray(userPosts.postId, paginatedPostIds),
      ),
      with: {
        post: true,
        userPostTags: {
          with: {
            tag: true,
          },
        },
      },
    });
    results = loaded as typeof results;
  }

  // Sort results to match the paginated order (by redditCreatedAt desc)
  const postIdOrder = new Map(paginatedPostIds.map((id, i) => [id, i]));
  results.sort((a, b) => (postIdOrder.get(a.postId) ?? 0) - (postIdOrder.get(b.postId) ?? 0));

  const postsData: PostData[] = results.map((up) => ({
    id: up.post.id,
    redditId: up.post.redditId,
    title: up.post.title,
    body: up.post.body,
    author: up.post.author,
    subreddit: up.post.subreddit,
    permalink: up.post.permalink,
    url: up.post.url,
    redditCreatedAt: up.post.redditCreatedAt,
    score: up.post.score,
    numComments: up.post.numComments,
    status: up.status as PostStatus,
    responseText: up.responseText,
    respondedAt: up.respondedAt,
    createdAt: up.createdAt,
    updatedAt: up.updatedAt,
    tags: up.userPostTags.map((upt) => ({
      id: upt.tag.id,
      name: upt.tag.name,
      color: upt.tag.color,
    })),
  }));

  return {
    posts: postsData,
    total,
    page,
    limit,
    totalPages,
  };
}

// Get a single post with tags
export async function getPost(
  id: string
): Promise<{ success: true; post: PostData } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Find the user_post for this post
  const userPost = await db.query.userPosts.findFirst({
    where: and(eq(userPosts.postId, id), eq(userPosts.userId, userId)),
    with: {
      post: true,
      userPostTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  if (!userPost) {
    return { success: false, error: "Post not found" };
  }

  return {
    success: true,
    post: {
      id: userPost.post.id,
      redditId: userPost.post.redditId,
      title: userPost.post.title,
      body: userPost.post.body,
      author: userPost.post.author,
      subreddit: userPost.post.subreddit,
      permalink: userPost.post.permalink,
      url: userPost.post.url,
      redditCreatedAt: userPost.post.redditCreatedAt,
      score: userPost.post.score,
      numComments: userPost.post.numComments,
      status: userPost.status as PostStatus,
      responseText: userPost.responseText,
      respondedAt: userPost.respondedAt,
      createdAt: userPost.createdAt,
      updatedAt: userPost.updatedAt,
      tags: userPost.userPostTags.map((upt) => ({
        id: upt.tag.id,
        name: upt.tag.name,
        color: upt.tag.color,
      })),
    },
  };
}

// Change post status with optional response text
export async function changePostStatus(
  id: string,
  status: PostStatus,
  responseText?: string
): Promise<{ success: true; post: PostData } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Validate status
  const parsed = postStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { success: false, error: "Invalid status" };
  }

  // Verify user_post exists and belongs to user
  const existing = await db.query.userPosts.findFirst({
    where: and(eq(userPosts.postId, id), eq(userPosts.userId, userId)),
    with: {
      post: true,
      userPostTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  if (!existing) {
    return { success: false, error: "Post not found" };
  }

  // Prepare update values
  const updates: Partial<{
    status: string;
    responseText: string | null;
    respondedAt: Date | null;
  }> = {
    status,
  };

  // Handle response text and responded_at based on status
  if (status === "done") {
    if (responseText !== undefined) {
      updates.responseText = responseText;
    }
    // Set respondedAt when transitioning to done (if not already set or if response is provided)
    if (!existing.respondedAt || responseText !== undefined) {
      updates.respondedAt = new Date();
    }
  } else {
    // Clear respondedAt when changing away from done, but keep response text
    updates.respondedAt = null;
  }

  const [updated] = await db
    .update(userPosts)
    .set(updates)
    .where(and(eq(userPosts.postId, id), eq(userPosts.userId, userId)))
    .returning();

  revalidatePath("/");

  return {
    success: true,
    post: {
      id: existing.post.id,
      redditId: existing.post.redditId,
      title: existing.post.title,
      body: existing.post.body,
      author: existing.post.author,
      subreddit: existing.post.subreddit,
      permalink: existing.post.permalink,
      url: existing.post.url,
      redditCreatedAt: existing.post.redditCreatedAt,
      score: existing.post.score,
      numComments: existing.post.numComments,
      status: updated!.status as PostStatus,
      responseText: updated!.responseText,
      respondedAt: updated!.respondedAt,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
      tags: existing.userPostTags.map((upt) => ({
        id: upt.tag.id,
        name: upt.tag.name,
        color: upt.tag.color,
      })),
    },
  };
}

// Update response text without changing status
export async function updateResponseText(
  id: string,
  responseText: string
): Promise<{ success: true } | { success: false; error: string }> {
  const userId = await getCurrentUserId();

  // Verify user_post exists and belongs to user
  const existing = await db.query.userPosts.findFirst({
    where: and(eq(userPosts.postId, id), eq(userPosts.userId, userId)),
  });

  if (!existing) {
    return { success: false, error: "Post not found" };
  }

  // Update the response text on user_posts
  await db
    .update(userPosts)
    .set({
      responseText,
      respondedAt: existing.status === "done" ? new Date() : existing.respondedAt,
    })
    .where(and(eq(userPosts.postId, id), eq(userPosts.userId, userId)));

  revalidatePath("/");

  return { success: true };
}

// Get post counts by status
export async function getPostCounts(): Promise<{
  new: number;
  ignored: number;
  done: number;
}> {
  const userId = await getCurrentUserId();

  const results = await db
    .select({
      status: userPosts.status,
      count: sql<number>`count(*)`,
    })
    .from(userPosts)
    .where(eq(userPosts.userId, userId))
    .groupBy(userPosts.status);

  const counts = {
    new: 0,
    ignored: 0,
    done: 0,
  };

  for (const row of results) {
    if (row.status === "new" || row.status === "ignored" || row.status === "done") {
      counts[row.status] = Number(row.count);
    }
  }

  return counts;
}

// Get the most recent reddit_created_at per subreddit from the posts table.
// Only considers the given subreddit names. Returns a Map<string, Date>.
export async function getLastPostTimestampPerSubreddit(
  subredditNames: string[]
): Promise<Map<string, Date>> {
  if (subredditNames.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      subreddit: posts.subreddit,
      maxRedditCreatedAt: sql<Date>`max(${posts.redditCreatedAt})`,
    })
    .from(posts)
    .where(inArray(posts.subreddit, subredditNames))
    .groupBy(posts.subreddit);

  const result = new Map<string, Date>();
  for (const row of rows) {
    if (row.maxRedditCreatedAt) {
      result.set(row.subreddit, new Date(row.maxRedditCreatedAt));
    }
  }
  return result;
}

// Fetch new posts from Reddit
export async function fetchNewPosts(): Promise<{
  success: true;
  count: number;
  message: string;
} | {
  success: false;
  error: string;
}> {
  const userId = await getCurrentUserId();

  // Get user's subreddits
  const userSubreddits = await db.query.subreddits.findMany({
    where: eq(subreddits.userId, userId),
  });

  if (userSubreddits.length === 0) {
    return {
      success: true,
      count: 0,
      message: "No subreddits configured. Add subreddits in settings.",
    };
  }

  // Get all tags with their search terms
  const userTags = await db.query.tags.findMany({
    where: eq(tags.userId, userId),
    with: {
      searchTerms: true,
    },
  });

  // Collect all search terms
  const allTerms: string[] = [];
  const termToTagIds: Map<string, string[]> = new Map();

  for (const tag of userTags) {
    for (const term of tag.searchTerms) {
      allTerms.push(term.term);
      const existing = termToTagIds.get(term.term) ?? [];
      existing.push(tag.id);
      termToTagIds.set(term.term, existing);
    }
  }

  // Build per-subreddit timestamp map using DB-based incremental fetching
  // Spec: use last known reddit_created_at per subreddit, or 7 days ago for initial backfill
  const subredditNames = userSubreddits.map((s) => s.name);
  const lastTimestamps = await getLastPostTimestampPerSubreddit(subredditNames);

  const sevenDaysAgoSec = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const subredditTimestamps = new Map<string, number>();
  for (const sub of userSubreddits) {
    const lastDate = lastTimestamps.get(sub.name);
    if (lastDate) {
      subredditTimestamps.set(sub.name, Math.floor(lastDate.getTime() / 1000));
    } else {
      subredditTimestamps.set(sub.name, sevenDaysAgoSec);
    }
  }
  const fetchedPosts = await fetchRedditPosts(subredditTimestamps);

  let newCount = 0;

  for (const fetchedPost of fetchedPosts) {
    // Upsert into global posts table (conflict on reddit_id globally)
    const postResult = await db
      .insert(posts)
      .values({
        redditId: fetchedPost.redditId,
        title: fetchedPost.title,
        body: fetchedPost.body,
        author: fetchedPost.author,
        subreddit: fetchedPost.subreddit,
        permalink: fetchedPost.permalink,
        url: fetchedPost.url,
        redditCreatedAt: fetchedPost.redditCreatedAt,
        score: fetchedPost.score,
        numComments: fetchedPost.numComments,
      })
      .onConflictDoNothing({ target: posts.redditId })
      .returning();

    // Get the post ID — either newly inserted or existing
    let postId: string;
    if (postResult[0]) {
      postId = postResult[0].id;
    } else {
      // Post already exists — look it up
      const existingPost = await db.query.posts.findFirst({
        where: eq(posts.redditId, fetchedPost.redditId),
      });
      if (!existingPost) continue;
      postId = existingPost.id;
    }

    // Match tags locally — check if title/body contains any search terms
    const matchedTagIds = new Set<string>();
    const postText = `${fetchedPost.title} ${fetchedPost.body ?? ""}`.toLowerCase();

    for (const [term, tagIdList] of termToTagIds.entries()) {
      if (postText.includes(term.toLowerCase())) {
        for (const tagId of tagIdList) {
          matchedTagIds.add(tagId);
        }
      }
    }

    // Create user_post record for all posts from monitored subreddits
    // (conflict on (user_id, post_id) do nothing)
    const userPostResult = await db
      .insert(userPosts)
      .values({
        userId,
        postId,
        status: "new",
      })
      .onConflictDoNothing()
      .returning();

    // If user_post was newly created, assign matching tags
    if (userPostResult[0]) {
      for (const tagId of matchedTagIds) {
        await db
          .insert(userPostTags)
          .values({
            userId,
            postId,
            tagId,
          })
          .onConflictDoNothing();
      }
      newCount++;
    }
  }

  revalidatePath("/");

  return {
    success: true,
    count: newCount,
    message: `Found ${newCount} new post${newCount === 1 ? "" : "s"}.`,
  };
}
