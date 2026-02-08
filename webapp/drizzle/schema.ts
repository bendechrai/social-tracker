import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table - includes Auth.js required columns (name, emailVerified, image)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  // Auth.js required columns (nullable for credentials-only auth)
  name: varchar("name", { length: 255 }),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  // Password for credentials auth
  passwordHash: text("password_hash"),
  // User's Groq API key (encrypted with AES-256-GCM)
  groqApiKey: text("groq_api_key"),
  // Email notification preferences
  emailNotifications: boolean("email_notifications").notNull().default(true),
  lastEmailedAt: timestamp("last_emailed_at"),
  // Password change tracking for session invalidation
  passwordChangedAt: timestamp("password_changed_at"),
  // NSFW content preference
  showNsfw: boolean("show_nsfw").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  subreddits: many(subreddits),
  tags: many(tags),
  userPosts: many(userPosts),
  sessions: many(sessions),
  accounts: many(accounts),
  chatMessages: many(chatMessages),
  creditBalance: one(creditBalances),
  creditPurchases: many(creditPurchases),
  aiUsageLog: many(aiUsageLog),
}));

// Auth.js Sessions table
// sessionToken is the primary key per Auth.js adapter requirements
export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Auth.js Accounts table (for OAuth providers)
// Property names must match Auth.js adapter expectations (snake_case)
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    uniqueIndex("accounts_provider_account_id_idx").on(
      table.provider,
      table.providerAccountId
    ),
  ]
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// Auth.js Verification Tokens table (for email verification)
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expires: timestamp("expires").notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// Subreddits table
export const subreddits = pgTable(
  "subreddits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("subreddits_user_name_idx").on(table.userId, table.name)]
);

export const subredditsRelations = relations(subreddits, ({ one }) => ({
  user: one(users, {
    fields: [subreddits.userId],
    references: [users.id],
  }),
}));

// Tags table
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#6366f1"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tags_user_name_idx").on(table.userId, table.name)]
);

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  searchTerms: many(searchTerms),
  userPostTags: many(userPostTags),
}));

// Search terms table
export const searchTerms = pgTable(
  "search_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("search_terms_tag_term_idx").on(table.tagId, table.term)]
);

export const searchTermsRelations = relations(searchTerms, ({ one }) => ({
  tag: one(tags, {
    fields: [searchTerms.tagId],
    references: [tags.id],
  }),
}));

// Posts table — global, shared across users, deduplicated by reddit_id
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    redditId: varchar("reddit_id", { length: 20 }).notNull().unique(),
    title: text("title").notNull(),
    body: text("body"),
    author: varchar("author", { length: 100 }).notNull(),
    subreddit: varchar("subreddit", { length: 100 }).notNull(),
    permalink: text("permalink").notNull(),
    url: text("url"),
    redditCreatedAt: timestamp("reddit_created_at").notNull(),
    score: integer("score").notNull().default(0),
    numComments: integer("num_comments").notNull().default(0),
    isNsfw: boolean("is_nsfw").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("posts_subreddit_idx").on(table.subreddit),
  ]
);

export const postsRelations = relations(posts, ({ many }) => ({
  userPosts: many(userPosts),
  chatMessages: many(chatMessages),
}));

// User posts table — per-user state for shared posts
export const userPosts = pgTable(
  "user_posts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("new"),
    responseText: text("response_text"),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index("user_posts_user_status_idx").on(table.userId, table.status),
  ]
);

export const userPostsRelations = relations(userPosts, ({ one, many }) => ({
  user: one(users, {
    fields: [userPosts.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [userPosts.postId],
    references: [posts.id],
  }),
  userPostTags: many(userPostTags),
}));

// User post tags — per-user tag associations for posts
export const userPostTags = pgTable(
  "user_post_tags",
  {
    userId: uuid("user_id").notNull(),
    postId: uuid("post_id").notNull(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId, table.tagId] }),
    foreignKey({
      columns: [table.userId, table.postId],
      foreignColumns: [userPosts.userId, userPosts.postId],
    }).onDelete("cascade"),
  ]
);

export const userPostTagsRelations = relations(userPostTags, ({ one }) => ({
  userPost: one(userPosts, {
    fields: [userPostTags.userId, userPostTags.postId],
    references: [userPosts.userId, userPosts.postId],
  }),
  tag: one(tags, {
    fields: [userPostTags.tagId],
    references: [tags.id],
  }),
}));

// Comments table — shared across users, stored during cron fetch
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    redditId: varchar("reddit_id", { length: 20 }).notNull().unique(),
    postRedditId: varchar("post_reddit_id", { length: 20 }).notNull(),
    parentRedditId: varchar("parent_reddit_id", { length: 20 }),
    author: varchar("author", { length: 100 }).notNull(),
    body: text("body").notNull(),
    score: integer("score").notNull().default(0),
    redditCreatedAt: timestamp("reddit_created_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("comments_post_reddit_id_idx").on(table.postRedditId),
  ]
);

// Chat messages table — per-user, per-post AI chat history
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chat_messages_user_post_created_idx").on(
      table.userId,
      table.postId,
      table.createdAt
    ),
  ]
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [chatMessages.postId],
    references: [posts.id],
  }),
}));

// Subreddit fetch status — tracks per-subreddit fetch state (shared across users)
export const subredditFetchStatus = pgTable("subreddit_fetch_status", {
  name: varchar("name", { length: 100 }).primaryKey(),
  lastFetchedAt: timestamp("last_fetched_at"),
  refreshIntervalMinutes: integer("refresh_interval_minutes").notNull().default(60),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Credit balances — per-user balance in cents
export const creditBalances = pgTable("credit_balances", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balanceCents: integer("balance_cents").notNull().default(0),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const creditBalancesRelations = relations(creditBalances, ({ one }) => ({
  user: one(users, {
    fields: [creditBalances.userId],
    references: [users.id],
  }),
}));

// Credit purchases — Stripe checkout session records
export const creditPurchases = pgTable("credit_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }).unique(),
  amountCents: integer("amount_cents").notNull(),
  creditsCents: integer("credits_cents").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creditPurchasesRelations = relations(creditPurchases, ({ one }) => ({
  user: one(users, {
    fields: [creditPurchases.userId],
    references: [users.id],
  }),
}));

// AI usage log — tracks per-request token usage and cost
export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    modelId: varchar("model_id", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    costCents: integer("cost_cents").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_usage_log_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const aiUsageLogRelations = relations(aiUsageLog, ({ one }) => ({
  user: one(users, {
    fields: [aiUsageLog.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [aiUsageLog.postId],
    references: [posts.id],
  }),
}));

// Type exports for use throughout the application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Subreddit = typeof subreddits.$inferSelect;
export type NewSubreddit = typeof subreddits.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type SearchTerm = typeof searchTerms.$inferSelect;
export type NewSearchTerm = typeof searchTerms.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type UserPost = typeof userPosts.$inferSelect;
export type NewUserPost = typeof userPosts.$inferInsert;

export type UserPostTag = typeof userPostTags.$inferSelect;
export type NewUserPostTag = typeof userPostTags.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;

export type SubredditFetchStatus = typeof subredditFetchStatus.$inferSelect;
export type NewSubredditFetchStatus = typeof subredditFetchStatus.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

export type CreditBalance = typeof creditBalances.$inferSelect;
export type NewCreditBalance = typeof creditBalances.$inferInsert;

export type CreditPurchase = typeof creditPurchases.$inferSelect;
export type NewCreditPurchase = typeof creditPurchases.$inferInsert;

export type AiUsageLogEntry = typeof aiUsageLog.$inferSelect;
export type NewAiUsageLogEntry = typeof aiUsageLog.$inferInsert;
