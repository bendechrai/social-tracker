import { db } from "@/lib/db";
import {
  users,
  subreddits,
  tags,
  searchTerms,
  posts,
  postTags,
} from "./schema";
import { eq, and } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Create or get default user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, "dev@example.com"),
  });

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    console.log("Using existing user:", userId);
  } else {
    const [newUser] = await db
      .insert(users)
      .values({ email: "dev@example.com" })
      .returning();
    userId = newUser!.id;
    console.log("Created new user:", userId);
  }

  // Create sample subreddits (upsert pattern)
  const subredditNames = ["postgresql", "database", "node"];
  for (const name of subredditNames) {
    const existing = await db.query.subreddits.findFirst({
      where: and(eq(subreddits.userId, userId), eq(subreddits.name, name)),
    });
    if (!existing) {
      await db.insert(subreddits).values({ userId, name });
      console.log("Created subreddit:", name);
    }
  }

  // Create sample tags with search terms
  const tagData = [
    {
      name: "Yugabyte",
      color: "#6366f1",
      terms: ["yugabyte", "yugabytedb"],
    },
    {
      name: "Distributed PG",
      color: "#10b981",
      terms: ["distributed postgres", "distributed postgresql"],
    },
  ];

  for (const { name, color, terms } of tagData) {
    let tag = await db.query.tags.findFirst({
      where: and(eq(tags.userId, userId), eq(tags.name, name)),
    });

    if (!tag) {
      const [newTag] = await db
        .insert(tags)
        .values({ userId, name, color })
        .returning();
      tag = newTag!;
      console.log("Created tag:", name);
    }

    // Add search terms
    for (const term of terms) {
      const existingTerm = await db.query.searchTerms.findFirst({
        where: and(
          eq(searchTerms.tagId, tag.id),
          eq(searchTerms.term, term.toLowerCase())
        ),
      });
      if (!existingTerm) {
        await db.insert(searchTerms).values({
          tagId: tag.id,
          term: term.toLowerCase(),
        });
        console.log("  Added term:", term);
      }
    }
  }

  // Get tags for post creation
  const allTags = await db.query.tags.findMany({
    where: eq(tags.userId, userId),
  });
  const yugabyteTag = allTags.find((t) => t.name === "Yugabyte");
  const distributedTag = allTags.find((t) => t.name === "Distributed PG");

  // Create sample posts for each status
  const samplePosts = [
    // New posts
    {
      redditId: "sample_new_1",
      title: "Question about YugabyteDB performance",
      body: "Has anyone benchmarked YugabyteDB vs CockroachDB for write-heavy workloads?",
      author: "db_enthusiast",
      subreddit: "database",
      permalink: "/r/database/comments/sample_new_1/question_about_yugabytedb/",
      score: 15,
      numComments: 8,
      status: "new",
      tagIds: [yugabyteTag?.id],
    },
    {
      redditId: "sample_new_2",
      title: "Distributed PostgreSQL options in 2024",
      body: "Looking for recommendations on distributed PostgreSQL solutions.",
      author: "devops_lead",
      subreddit: "postgresql",
      permalink: "/r/postgresql/comments/sample_new_2/distributed_postgresql_options/",
      score: 42,
      numComments: 23,
      status: "new",
      tagIds: [distributedTag?.id],
    },
    {
      redditId: "sample_new_3",
      title: "YugabyteDB cluster setup issues",
      body: "Having trouble with yb-master nodes. Any tips?",
      author: "cluster_admin",
      subreddit: "database",
      permalink: "/r/database/comments/sample_new_3/yugabytedb_cluster_setup/",
      score: 5,
      numComments: 12,
      status: "new",
      tagIds: [yugabyteTag?.id, distributedTag?.id],
    },
    // Ignored posts
    {
      redditId: "sample_ignored_1",
      title: "Off-topic discussion about databases",
      body: "Just wanted to chat about random database stuff.",
      author: "casual_user",
      subreddit: "database",
      permalink: "/r/database/comments/sample_ignored_1/offtopic/",
      score: 2,
      numComments: 1,
      status: "ignored",
      tagIds: [],
    },
    {
      redditId: "sample_ignored_2",
      title: "Yugabyte alternatives?",
      body: "Not really about Yugabyte specifically...",
      author: "alternative_seeker",
      subreddit: "postgresql",
      permalink: "/r/postgresql/comments/sample_ignored_2/alternatives/",
      score: 8,
      numComments: 5,
      status: "ignored",
      tagIds: [yugabyteTag?.id],
    },
    {
      redditId: "sample_ignored_3",
      title: "Generic database question",
      body: "This isn't really relevant to our topics.",
      author: "newbie",
      subreddit: "node",
      permalink: "/r/node/comments/sample_ignored_3/generic/",
      score: 1,
      numComments: 0,
      status: "ignored",
      tagIds: [],
    },
    // Done posts
    {
      redditId: "sample_done_1",
      title: "Help with YugabyteDB connection pooling",
      body: "Need guidance on setting up connection pooling with YugabyteDB.",
      author: "pool_master",
      subreddit: "postgresql",
      permalink: "/r/postgresql/comments/sample_done_1/connection_pooling/",
      score: 25,
      numComments: 15,
      status: "done",
      responseText:
        "Helped them configure PgBouncer with YugabyteDB. They were happy with the solution!",
      tagIds: [yugabyteTag?.id],
    },
    {
      redditId: "sample_done_2",
      title: "Distributed PostgreSQL for high availability",
      body: "We need HA for our PostgreSQL cluster. What are the options?",
      author: "ha_seeker",
      subreddit: "database",
      permalink: "/r/database/comments/sample_done_2/ha_options/",
      score: 55,
      numComments: 31,
      status: "done",
      responseText:
        "Provided comprehensive comparison of distributed PostgreSQL options including YugabyteDB.",
      tagIds: [distributedTag?.id],
    },
    {
      redditId: "sample_done_3",
      title: "YugabyteDB vs traditional PostgreSQL",
      body: "When should I choose YugabyteDB over regular PostgreSQL?",
      author: "decision_maker",
      subreddit: "postgresql",
      permalink: "/r/postgresql/comments/sample_done_3/comparison/",
      score: 88,
      numComments: 45,
      status: "done",
      responseText:
        "Explained use cases where distributed PostgreSQL makes sense vs single-node PostgreSQL.",
      tagIds: [yugabyteTag?.id, distributedTag?.id],
    },
  ];

  for (const postData of samplePosts) {
    // Check if post already exists
    const existing = await db.query.posts.findFirst({
      where: and(
        eq(posts.userId, userId),
        eq(posts.redditId, postData.redditId)
      ),
    });

    if (existing) {
      console.log("Post already exists:", postData.redditId);
      continue;
    }

    // Create post
    const [post] = await db
      .insert(posts)
      .values({
        userId,
        redditId: postData.redditId,
        title: postData.title,
        body: postData.body,
        author: postData.author,
        subreddit: postData.subreddit,
        permalink: postData.permalink,
        url: `https://reddit.com${postData.permalink}`,
        redditCreatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        score: postData.score,
        numComments: postData.numComments,
        status: postData.status,
        responseText: postData.responseText,
        respondedAt: postData.status === "done" ? new Date() : null,
      })
      .returning();

    console.log("Created post:", postData.title);

    // Add post tags
    for (const tagId of postData.tagIds) {
      if (tagId) {
        await db.insert(postTags).values({
          postId: post!.id,
          tagId,
        });
      }
    }
  }

  console.log("Seeding complete!");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
