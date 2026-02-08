import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockCreateSignedToken = vi.fn((_userId: string, _expiryMs: number) => "mock-signed-token");

vi.mock("@/lib/tokens", () => ({
  createSignedToken: (userId: string, expiryMs: number) =>
    mockCreateSignedToken(userId, expiryMs),
}));

import {
  buildNotificationEmail,
  buildWelcomeEmail,
  buildVerificationEmail,
  type TaggedPost,
  type NotificationEmailInput,
  type WelcomeEmailInput,
} from "@/lib/email-templates";

function makePost(overrides: Partial<TaggedPost> = {}): TaggedPost {
  return {
    postId: "post-1",
    title: "Test Post Title",
    body: "This is a test post body text.",
    subreddit: "javascript",
    author: "testuser",
    tagName: "React",
    tagColor: "#ef4444",
    ...overrides,
  };
}

function makeInput(posts: TaggedPost[]): NotificationEmailInput {
  return {
    userId: "user-123",
    posts,
    appUrl: "https://app.example.com",
  };
}

describe("buildNotificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("generates correct subject with singular post count", () => {
    const result = buildNotificationEmail(makeInput([makePost()]));

    expect(result.subject).toBe("Social Tracker: 1 new tagged post");
  });

  it("generates correct subject with plural post count", () => {
    const posts = [
      makePost({ postId: "p1" }),
      makePost({ postId: "p2" }),
      makePost({ postId: "p3" }),
    ];
    const result = buildNotificationEmail(makeInput(posts));

    expect(result.subject).toBe("Social Tracker: 3 new tagged posts");
  });

  it("groups posts by tag name in HTML output", () => {
    const posts = [
      makePost({ postId: "p1", tagName: "React", tagColor: "#ef4444", title: "React Post 1" }),
      makePost({ postId: "p2", tagName: "Node", tagColor: "#22c55e", title: "Node Post 1" }),
      makePost({ postId: "p3", tagName: "React", tagColor: "#ef4444", title: "React Post 2" }),
    ];
    const result = buildNotificationEmail(makeInput(posts));

    // React should appear before Node (first seen order)
    const reactIdx = result.html.indexOf("React");
    const nodeIdx = result.html.indexOf("Node");
    expect(reactIdx).toBeLessThan(nodeIdx);

    // Both React posts should be in the output
    expect(result.html).toContain("React Post 1");
    expect(result.html).toContain("React Post 2");
    expect(result.html).toContain("Node Post 1");
  });

  it("groups posts by tag name in plain text output", () => {
    const posts = [
      makePost({ postId: "p1", tagName: "React", title: "React Post 1" }),
      makePost({ postId: "p2", tagName: "Node", title: "Node Post 1" }),
    ];
    const result = buildNotificationEmail(makeInput(posts));

    expect(result.text).toContain("[React]");
    expect(result.text).toContain("[Node]");
    expect(result.text).toContain("React Post 1");
    expect(result.text).toContain("Node Post 1");
  });

  it("includes post links pointing to app dashboard", () => {
    const result = buildNotificationEmail(
      makeInput([makePost({ postId: "abc-123" })])
    );

    expect(result.html).toContain(
      "https://app.example.com/dashboard/posts/abc-123"
    );
    expect(result.text).toContain(
      "https://app.example.com/dashboard/posts/abc-123"
    );
  });

  it("includes subreddit and author metadata", () => {
    const result = buildNotificationEmail(
      makeInput([makePost({ subreddit: "typescript", author: "dev123" })])
    );

    expect(result.html).toContain("r/typescript");
    expect(result.html).toContain("u/dev123");
    expect(result.text).toContain("r/typescript");
    expect(result.text).toContain("u/dev123");
  });

  it("truncates body to 150 chars with ellipsis", () => {
    const longBody = "A".repeat(200);
    const result = buildNotificationEmail(
      makeInput([makePost({ body: longBody })])
    );

    expect(result.html).toContain("A".repeat(150) + "...");
    expect(result.text).toContain("A".repeat(150) + "...");
  });

  it("handles null body gracefully", () => {
    const result = buildNotificationEmail(
      makeInput([makePost({ body: null })])
    );

    // Should not crash and should still have the title
    expect(result.html).toContain("Test Post Title");
    expect(result.text).toContain("Test Post Title");
  });

  it("shows overflow text when more than 20 posts", () => {
    const posts = Array.from({ length: 25 }, (_, i) =>
      makePost({ postId: `p-${i}`, title: `Post ${i}` })
    );
    const result = buildNotificationEmail(makeInput(posts));

    // Subject shows total count (25)
    expect(result.subject).toBe("Social Tracker: 25 new tagged posts");

    // HTML and text show overflow
    expect(result.html).toContain("and 5 more");
    expect(result.html).toContain("view all in Social Tracker");
    expect(result.text).toContain("and 5 more");

    // Only 20 posts rendered (Post 0 through Post 19)
    expect(result.html).toContain("Post 19");
    expect(result.html).not.toContain("Post 20");
  });

  it("does not show overflow text for exactly 20 posts", () => {
    const posts = Array.from({ length: 20 }, (_, i) =>
      makePost({ postId: `p-${i}`, title: `Post ${i}` })
    );
    const result = buildNotificationEmail(makeInput(posts));

    expect(result.html).not.toContain("and ");
    expect(result.html).not.toContain("more");
  });

  it("includes plain text fallback with full URLs", () => {
    const result = buildNotificationEmail(
      makeInput([makePost({ postId: "p-1" })])
    );

    // Text contains the post URL as a full URL
    expect(result.text).toContain(
      "https://app.example.com/dashboard/posts/p-1"
    );
    // Text contains the settings URL
    expect(result.text).toContain(
      "https://app.example.com/settings/account"
    );
    // Text should not have HTML tags
    expect(result.text).not.toContain("<a ");
    expect(result.text).not.toContain("<div");
    expect(result.text).not.toContain("<p>");
  });

  it("includes unsubscribe footer in HTML", () => {
    const result = buildNotificationEmail(makeInput([makePost()]));

    expect(result.html).toContain("email notifications enabled");
    expect(result.html).toContain("Manage preferences");
    expect(result.html).toContain("https://app.example.com/settings/account");
  });

  it("includes unsubscribe footer in plain text", () => {
    const result = buildNotificationEmail(makeInput([makePost()]));

    expect(result.text).toContain("email notifications enabled");
    expect(result.text).toContain("Manage preferences");
  });

  it("generates List-Unsubscribe headers with signed token", () => {
    const result = buildNotificationEmail(makeInput([makePost()]));

    expect(result.headers["List-Unsubscribe"]).toBe(
      "<https://app.example.com/api/unsubscribe?token=mock-signed-token>"
    );
    expect(result.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
  });

  it("calls createSignedToken with userId and 30-day expiry", () => {
    buildNotificationEmail(makeInput([makePost()]));

    expect(mockCreateSignedToken).toHaveBeenCalledWith(
      "user-123",
      30 * 24 * 60 * 60 * 1000
    );
  });

  it("escapes HTML special characters in post content", () => {
    const result = buildNotificationEmail(
      makeInput([
        makePost({
          title: 'Test <script>alert("xss")</script>',
          body: "Body & more <b>bold</b>",
        }),
      ])
    );

    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("Body &amp; more");
  });

  it("includes tag color in HTML badge", () => {
    const result = buildNotificationEmail(
      makeInput([makePost({ tagColor: "#6366f1" })])
    );

    expect(result.html).toContain("background-color: #6366f1");
  });
});

describe("buildWelcomeEmail", () => {
  function makeWelcomeInput(overrides: Partial<WelcomeEmailInput> = {}): WelcomeEmailInput {
    return {
      userId: "user-456",
      appUrl: "https://app.example.com",
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("generates correct subject", () => {
    const result = buildWelcomeEmail(makeWelcomeInput());

    expect(result.subject).toBe("Welcome to Social Tracker");
  });

  it("includes greeting and intro in HTML", () => {
    const result = buildWelcomeEmail(makeWelcomeInput());

    expect(result.html).toContain("Welcome to Social Tracker!");
    expect(result.html).toContain("tracking Reddit posts across subreddits");
  });

  it("includes all 3 quick-start tips in HTML", () => {
    const result = buildWelcomeEmail(makeWelcomeInput());

    expect(result.html).toContain("Add a subreddit");
    expect(result.html).toContain("Create tags");
    expect(result.html).toContain("Add a Groq API key");
    expect(result.html).toContain("Settings &gt; Subreddits");
    expect(result.html).toContain("Settings &gt; Tags");
    expect(result.html).toContain("Settings &gt; API Keys");
  });

  it("includes all 3 quick-start tips in plain text", () => {
    const result = buildWelcomeEmail(makeWelcomeInput());

    expect(result.text).toContain("1. Add a subreddit");
    expect(result.text).toContain("2. Create tags");
    expect(result.text).toContain("3. Add a Groq API key");
    expect(result.text).toContain("Settings > Subreddits");
    expect(result.text).toContain("Settings > Tags");
    expect(result.text).toContain("Settings > API Keys");
  });

  it("includes Get Started CTA linking to dashboard", () => {
    const result = buildWelcomeEmail(makeWelcomeInput());

    expect(result.html).toContain("Get Started");
    expect(result.html).toContain("https://app.example.com/dashboard");
    expect(result.text).toContain("Get Started: https://app.example.com/dashboard");
  });

  it("includes verify email link with signed token", () => {
    const result = buildWelcomeEmail(makeWelcomeInput());

    expect(result.html).toContain("Verify Email");
    expect(result.html).toContain("https://app.example.com/api/verify-email?token=mock-signed-token");
    expect(result.text).toContain("Verify Email: https://app.example.com/api/verify-email?token=mock-signed-token");
  });

  it("calls createSignedToken with userId and 7-day expiry", () => {
    buildWelcomeEmail(makeWelcomeInput());

    expect(mockCreateSignedToken).toHaveBeenCalledWith(
      "user-456",
      7 * 24 * 60 * 60 * 1000
    );
  });

  it("includes plain text fallback with full URLs and no HTML tags", () => {
    const result = buildWelcomeEmail(makeWelcomeInput());

    expect(result.text).toContain("https://app.example.com/dashboard");
    expect(result.text).toContain("https://app.example.com/api/verify-email");
    expect(result.text).not.toContain("<a ");
    expect(result.text).not.toContain("<div");
    expect(result.text).not.toContain("<p>");
    expect(result.text).not.toContain("<ol>");
  });

  it("includes footer in HTML", () => {
    const result = buildWelcomeEmail(makeWelcomeInput());

    expect(result.html).toContain("signed up for Social Tracker");
  });
});

describe("buildVerificationEmail", () => {
  function makeVerifyInput(overrides: Partial<WelcomeEmailInput> = {}): WelcomeEmailInput {
    return {
      userId: "user-789",
      appUrl: "https://app.example.com",
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("generates correct subject", () => {
    const result = buildVerificationEmail(makeVerifyInput());

    expect(result.subject).toContain("Verify your email");
  });

  it("includes verify email link with signed token", () => {
    const result = buildVerificationEmail(makeVerifyInput());

    expect(result.html).toContain("Verify Email");
    expect(result.html).toContain("https://app.example.com/api/verify-email?token=mock-signed-token");
    expect(result.text).toContain("Verify Email: https://app.example.com/api/verify-email?token=mock-signed-token");
  });

  it("calls createSignedToken with userId and 7-day expiry", () => {
    buildVerificationEmail(makeVerifyInput());

    expect(mockCreateSignedToken).toHaveBeenCalledWith(
      "user-789",
      7 * 24 * 60 * 60 * 1000
    );
  });

  it("does not include welcome content (quick-start tips)", () => {
    const result = buildVerificationEmail(makeVerifyInput());

    expect(result.html).not.toContain("Add a subreddit");
    expect(result.html).not.toContain("Create tags");
    expect(result.html).not.toContain("Add a Groq API key");
    expect(result.html).not.toContain("Get Started");
    expect(result.text).not.toContain("Add a subreddit");
  });

  it("includes expiry note", () => {
    const result = buildVerificationEmail(makeVerifyInput());

    expect(result.html).toContain("7 days");
    expect(result.text).toContain("7 days");
  });

  it("includes plain text fallback with full URLs and no HTML tags", () => {
    const result = buildVerificationEmail(makeVerifyInput());

    expect(result.text).toContain("https://app.example.com/api/verify-email");
    expect(result.text).not.toContain("<a ");
    expect(result.text).not.toContain("<p>");
  });
});
