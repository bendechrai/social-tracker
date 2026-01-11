"use server";

import { db } from "@/lib/db";
import { posts, postTags, tags, searchTerms, subreddits } from "@/drizzle/schema";
import { getCurrentUserId } from "./users";
import { postStatusSchema, type PostStatus } from "@/lib/validations";
import { fetchRedditPosts, isRedditConfigured } from "@/lib/reddit";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
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

  // Build the base query conditions
  const conditions = [
    eq(posts.userId, userId),
    eq(posts.status, status),
  ];

  // Get posts with optional tag filtering
  let filteredPostIds: string[] | null = null;

  if (tagIds && tagIds.length > 0) {
    // Get post IDs that have ANY of the selected tags
    const postIdsWithTags = await db
      .selectDistinct({ postId: postTags.postId })
      .from(postTags)
      .where(inArray(postTags.tagId, tagIds));

    filteredPostIds = postIdsWithTags.map((p) => p.postId);

    // If no posts match the tag filter, return empty
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
    .from(posts)
    .where(
      filteredPostIds
        ? and(...conditions, inArray(posts.id, filteredPostIds))
        : and(...conditions)
    );

  const [countResult] = await countQuery;
  const total = Number(countResult?.count ?? 0);
  const totalPages = Math.ceil(total / limit);

  // Get paginated posts
  const offset = (page - 1) * limit;

  const postsQuery = db.query.posts.findMany({
    where: filteredPostIds
      ? and(...conditions, inArray(posts.id, filteredPostIds))
      : and(...conditions),
    orderBy: [desc(posts.redditCreatedAt)],
    limit,
    offset,
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  const results = await postsQuery;

  const postsData: PostData[] = results.map((post) => ({
    id: post.id,
    redditId: post.redditId,
    title: post.title,
    body: post.body,
    author: post.author,
    subreddit: post.subreddit,
    permalink: post.permalink,
    url: post.url,
    redditCreatedAt: post.redditCreatedAt,
    score: post.score,
    numComments: post.numComments,
    status: post.status as PostStatus,
    responseText: post.responseText,
    respondedAt: post.respondedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    tags: post.postTags.map((pt) => ({
      id: pt.tag.id,
      name: pt.tag.name,
      color: pt.tag.color,
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

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.userId, userId)),
    with: {
      postTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  if (!post) {
    return { success: false, error: "Post not found" };
  }

  return {
    success: true,
    post: {
      id: post.id,
      redditId: post.redditId,
      title: post.title,
      body: post.body,
      author: post.author,
      subreddit: post.subreddit,
      permalink: post.permalink,
      url: post.url,
      redditCreatedAt: post.redditCreatedAt,
      score: post.score,
      numComments: post.numComments,
      status: post.status as PostStatus,
      responseText: post.responseText,
      respondedAt: post.respondedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      tags: post.postTags.map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        color: pt.tag.color,
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

  // Verify post exists and belongs to user
  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.userId, userId)),
    with: {
      postTags: {
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
    .update(posts)
    .set(updates)
    .where(eq(posts.id, id))
    .returning();

  revalidatePath("/");

  return {
    success: true,
    post: {
      id: updated!.id,
      redditId: updated!.redditId,
      title: updated!.title,
      body: updated!.body,
      author: updated!.author,
      subreddit: updated!.subreddit,
      permalink: updated!.permalink,
      url: updated!.url,
      redditCreatedAt: updated!.redditCreatedAt,
      score: updated!.score,
      numComments: updated!.numComments,
      status: updated!.status as PostStatus,
      responseText: updated!.responseText,
      respondedAt: updated!.respondedAt,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
      tags: existing.postTags.map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        color: pt.tag.color,
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

  // Verify post exists and belongs to user
  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.userId, userId)),
  });

  if (!existing) {
    return { success: false, error: "Post not found" };
  }

  // Update the response text
  await db
    .update(posts)
    .set({
      responseText,
      respondedAt: existing.status === "done" ? new Date() : existing.respondedAt,
    })
    .where(eq(posts.id, id));

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
      status: posts.status,
      count: sql<number>`count(*)`,
    })
    .from(posts)
    .where(eq(posts.userId, userId))
    .groupBy(posts.status);

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

  // Check if Reddit is configured
  if (!isRedditConfigured()) {
    return {
      success: true,
      count: 0,
      message: "Reddit API not configured. Using test data only.",
    };
  }

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

  if (allTerms.length === 0) {
    return {
      success: true,
      count: 0,
      message: "No search terms configured. Add tags with search terms in settings.",
    };
  }

  // Fetch posts from Reddit
  const subredditNames = userSubreddits.map((s) => s.name);
  const fetchedPosts = await fetchRedditPosts(subredditNames, allTerms);

  let newCount = 0;

  for (const fetchedPost of fetchedPosts) {
    // Check if post already exists
    const existing = await db.query.posts.findFirst({
      where: and(
        eq(posts.userId, userId),
        eq(posts.redditId, fetchedPost.redditId)
      ),
    });

    if (existing) {
      continue; // Skip duplicates
    }

    // Create the post
    const [newPost] = await db
      .insert(posts)
      .values({
        userId,
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
        status: "new",
      })
      .returning();

    // Determine which tags match this post
    const matchedTagIds = new Set<string>();
    const postText = `${fetchedPost.title} ${fetchedPost.body ?? ""}`.toLowerCase();

    for (const [term, tagIdList] of termToTagIds.entries()) {
      if (postText.includes(term)) {
        for (const tagId of tagIdList) {
          matchedTagIds.add(tagId);
        }
      }
    }

    // Create post_tag associations
    for (const tagId of matchedTagIds) {
      await db.insert(postTags).values({
        postId: newPost!.id,
        tagId,
      });
    }

    newCount++;
  }

  revalidatePath("/");

  return {
    success: true,
    count: newCount,
    message: `Found ${newCount} new post${newCount === 1 ? "" : "s"}.`,
  };
}
