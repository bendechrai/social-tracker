/**
 * Unit tests for the /api/chat API route.
 *
 * Tests the POST endpoint that streams AI chat responses about a Reddit post
 * and the DELETE endpoint that clears chat history.
 *
 * All external dependencies (auth, db, encryption, AI SDK) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock database
const mockFindFirst = vi.fn();
const mockUserPostsFindFirst = vi.fn();
const mockCreditBalancesFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
      userPosts: {
        findFirst: (...args: unknown[]) => mockUserPostsFindFirst(...args),
      },
      creditBalances: {
        findFirst: (...args: unknown[]) => mockCreditBalancesFindFirst(...args),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// Mock encryption
const mockDecrypt = vi.fn();
vi.mock("@/lib/encryption", () => ({
  decrypt: (val: string) => mockDecrypt(val),
}));

// Mock AI SDK streamText
const mockStreamText = vi.fn();
vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

const mockCreateGroq = vi.fn(() => (model: string) => `groq-model-${model}`);
vi.mock("@ai-sdk/groq", () => ({
  createGroq: (...args: unknown[]) => mockCreateGroq(...(args as [])),
}));

// Mock Arcjet
const mockProtect = vi.fn();
vi.mock("@/lib/arcjet", () => ({
  default: {
    withRule: () => ({ protect: (...args: unknown[]) => mockProtect(...args) }),
  },
  ajMode: "DRY_RUN",
}));

vi.mock("@arcjet/next", () => ({
  slidingWindow: vi.fn().mockReturnValue([]),
}));

// Mock OpenRouter and AI models (Phase 34 dependencies)
vi.mock("@/lib/openrouter", () => ({
  getOpenRouterClient: vi.fn(() => (model: string) => `openrouter-model-${model}`),
}));

vi.mock("@/lib/ai-models", () => ({
  isAllowedModel: vi.fn(() => true),
}));

// Mock drizzle-orm (preserve real exports used by schema)
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val })),
    and: vi.fn((...conditions) => ({ and: conditions })),
    asc: vi.fn((col) => ({ asc: col })),
  };
});

// Import after mocks
import { POST, DELETE, buildSystemPrompt } from "@/app/api/chat/route";

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest(postId?: string): NextRequest {
  const url = postId
    ? `http://localhost:3000/api/chat?postId=${postId}`
    : "http://localhost:3000/api/chat";
  return new NextRequest(url, { method: "DELETE" });
}

// Helper to set up mock chain for db.insert().values()
function setupInsertChain() {
  const chain = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  mockInsert.mockReturnValue(chain);
  return chain;
}

// Helper to set up mock chain for db.delete().where()
function setupDeleteChain() {
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockDelete.mockReturnValue(chain);
  return chain;
}

const mockPost = {
  id: "post-1",
  redditId: "t3_abc123",
  title: "Test Post Title",
  body: "Test post body content",
  author: "testauthor",
  subreddit: "testsubreddit",
  permalink: "/r/testsubreddit/comments/abc123/test/",
  url: null,
  redditCreatedAt: new Date("2025-01-01"),
  score: 42,
  numComments: 5,
  isNsfw: false,
  createdAt: new Date("2025-01-01"),
};

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
    mockFindFirst.mockResolvedValue({ groqApiKey: null, profileRole: null, profileCompany: null, profileGoal: null, profileTone: null, profileContext: null });
    process.env.GROQ_API_KEY = "test-groq-key";
    // Default: Arcjet allows request
    mockProtect.mockResolvedValue({
      isDenied: () => false,
    });
  });

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makePostRequest({ postId: "post-1", message: "Hello" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when postId is missing", async () => {
    const req = makePostRequest({ message: "Hello" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("postId");
  });

  it("should return 400 when message is missing", async () => {
    const req = makePostRequest({ postId: "post-1" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("message");
  });

  it("should return 400 when message is empty string", async () => {
    const req = makePostRequest({ postId: "post-1", message: "   " });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("message");
  });

  it("should return 404 when post not found or user has no association", async () => {
    mockUserPostsFindFirst.mockResolvedValue(null);

    const req = makePostRequest({ postId: "post-1", message: "Hello" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Post not found");
  });

  it("should return 422 when no AI access is available", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });
    mockFindFirst.mockResolvedValue({ groqApiKey: null, profileRole: null, profileCompany: null, profileGoal: null, profileTone: null, profileContext: null });
    mockCreditBalancesFindFirst.mockResolvedValue(null);
    delete process.env.GROQ_API_KEY;

    const req = makePostRequest({ postId: "post-1", message: "Hello" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.code).toBe("NO_AI_ACCESS");
  });

  it("should stream a valid chat response", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });

    // First select call: comments query (chain ends at .where())
    // Second select call: chat history query (chain ends at .orderBy())
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
    });

    const insertChain = setupInsertChain();

    // Mock streamText to return a stream result
    const mockResponse = new Response("streamed data", {
      headers: { "Content-Type": "text/event-stream" },
    });
    const textPromise = Promise.resolve("AI response text");
    mockStreamText.mockReturnValue({
      toTextStreamResponse: () => mockResponse,
      text: textPromise,
    });

    const req = makePostRequest({ postId: "post-1", message: "Explain this post" });
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Verify user message was persisted
    expect(mockInsert).toHaveBeenCalled();
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        postId: "post-1",
        role: "user",
        content: "Explain this post",
      })
    );

    // Verify streamText was called with correct params
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("Test Post Title"),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Explain this post" }),
        ]),
      })
    );
  });

  it("should load and include chat history in messages", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });

    const chatHistoryData = [
      { role: "user", content: "Previous question" },
      { role: "assistant", content: "Previous answer" },
    ];

    // First select call returns comments (empty), second returns chat history
    let selectCallCount = 0;
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Comments query doesn't use orderBy — it's the chat history query
          return Promise.resolve(chatHistoryData);
        }
        return Promise.resolve([]);
      }),
    };
    // Comments query (no orderBy)
    const commentsChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return commentsChain;
      return selectChain;
    });

    setupInsertChain();

    const textPromise = Promise.resolve("New response");
    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response("stream", { headers: { "Content-Type": "text/event-stream" } }),
      text: textPromise,
    });

    const req = makePostRequest({ postId: "post-1", message: "Follow-up question" });
    await POST(req);

    // Verify messages include history + new message
    const streamCallArgs = mockStreamText.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(streamCallArgs.messages).toEqual([
      { role: "user", content: "Previous question" },
      { role: "assistant", content: "Previous answer" },
      { role: "user", content: "Follow-up question" },
    ]);
  });

  it("should use user's encrypted API key when available", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });
    mockFindFirst.mockResolvedValue({ groqApiKey: "encrypted-key", profileRole: null, profileCompany: null, profileGoal: null, profileTone: null, profileContext: null });
    mockDecrypt.mockReturnValue("user-groq-key");

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
    });
    setupInsertChain();

    const textPromise = Promise.resolve("Response");
    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response("stream", { headers: { "Content-Type": "text/event-stream" } }),
      text: textPromise,
    });

    const req = makePostRequest({ postId: "post-1", message: "Hello" });
    await POST(req);

    expect(mockDecrypt).toHaveBeenCalledWith("encrypted-key");
    expect(mockCreateGroq).toHaveBeenCalledWith({ apiKey: "user-groq-key" });
  });

  it("should return 429 when Arcjet rate limit is exceeded", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: { isRateLimit: () => true },
    });

    const req = makePostRequest({ postId: "post-1", message: "Hello" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe("Too many requests");
  });

  it("should return 403 when Arcjet denies for non-rate-limit reason", async () => {
    mockProtect.mockResolvedValueOnce({
      isDenied: () => true,
      reason: { isRateLimit: () => false },
    });

    const req = makePostRequest({ postId: "post-1", message: "Hello" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("should pass userId to Arcjet protect", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
    });
    setupInsertChain();

    const textPromise = Promise.resolve("Response");
    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response("stream", { headers: { "Content-Type": "text/event-stream" } }),
      text: textPromise,
    });

    const req = makePostRequest({ postId: "post-1", message: "Hello" });
    await POST(req);

    expect(mockProtect).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "user-1" })
    );
  });

  it("should build system prompt with post context and comments", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });

    const postComments = [
      { author: "commenter1", body: "Great post!", score: 10, parentRedditId: null },
      { author: "commenter2", body: "I agree", score: 5, parentRedditId: "t1_parent" },
    ];

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Comments query
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(postComments),
        };
      }
      // Chat history query
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
    });

    setupInsertChain();

    const textPromise = Promise.resolve("Response");
    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response("stream", { headers: { "Content-Type": "text/event-stream" } }),
      text: textPromise,
    });

    const req = makePostRequest({ postId: "post-1", message: "Summarize" });
    await POST(req);

    const streamCallArgs = mockStreamText.mock.calls[0]?.[0] as { system: string };
    expect(streamCallArgs.system).toContain("Test Post Title");
    expect(streamCallArgs.system).toContain("r/testsubreddit");
    expect(streamCallArgs.system).toContain("u/testauthor");
    expect(streamCallArgs.system).toContain("Test post body content");
    expect(streamCallArgs.system).toContain("commenter1");
    expect(streamCallArgs.system).toContain("Great post!");
  });

  it("should include anti-hallucination guardrails in system prompt", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
    });

    setupInsertChain();

    const textPromise = Promise.resolve("Response");
    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response("stream", { headers: { "Content-Type": "text/event-stream" } }),
      text: textPromise,
    });

    const req = makePostRequest({ postId: "post-1", message: "Check this URL" });
    await POST(req);

    const streamCallArgs = mockStreamText.mock.calls[0]?.[0] as { system: string };
    expect(streamCallArgs.system).toContain("NEVER fabricate");
    expect(streamCallArgs.system).toContain("I can only work with the post and comments shown here");
    expect(streamCallArgs.system).toContain("Web research is a feature we're working on for the future");
    expect(streamCallArgs.system).toContain("Based on what's described in the post");
  });

  it("should include tone-calibrated closing instructions in system prompt", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
    });

    setupInsertChain();

    const textPromise = Promise.resolve("Response");
    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response("stream", { headers: { "Content-Type": "text/event-stream" } }),
      text: textPromise,
    });

    const req = makePostRequest({ postId: "post-1", message: "Draft a reply" });
    await POST(req);

    const streamCallArgs = mockStreamText.mock.calls[0]?.[0] as { system: string };
    expect(streamCallArgs.system).toContain("Write like a real person on Reddit");
    expect(streamCallArgs.system).toContain("No flowery language");
    expect(streamCallArgs.system).not.toContain("identify key points, and draft thoughtful responses");
  });
});

describe("buildSystemPrompt profile integration", () => {
  const testPost = {
    title: "Test Post",
    body: "Test body",
    subreddit: "testsubreddit",
    author: "testauthor",
  };

  it("omits profile section when no profile provided", () => {
    const prompt = buildSystemPrompt(testPost, []);
    expect(prompt).not.toContain("About the user:");
  });

  it("includes full profile when all fields set", () => {
    const prompt = buildSystemPrompt(testPost, [], {
      profileRole: "Developer Advocate",
      profileCompany: "YugabyteDB",
      profileGoal: "Engage with community",
      profileTone: "casual",
      profileContext: "Keep it short",
    });
    expect(prompt).toContain("About the user:");
    expect(prompt).toContain("Role: Developer Advocate at YugabyteDB");
    expect(prompt).toContain("Goal: Engage with community");
    expect(prompt).toContain("Preferred tone: Casual");
    expect(prompt).toContain("Additional notes: Keep it short");
    expect(prompt).toContain("write in the user's voice");
  });

  it("combines role and company", () => {
    const prompt = buildSystemPrompt(testPost, [], {
      profileRole: "Engineer",
      profileCompany: "Acme",
      profileGoal: null,
      profileTone: null,
      profileContext: null,
    });
    expect(prompt).toContain("Role: Engineer at Acme");
  });

  it("shows only non-null fields in partial profile", () => {
    const prompt = buildSystemPrompt(testPost, [], {
      profileRole: null,
      profileCompany: null,
      profileGoal: "Help users",
      profileTone: "technical",
      profileContext: null,
    });
    expect(prompt).toContain("About the user:");
    expect(prompt).toContain("Goal: Help users");
    expect(prompt).toContain("Preferred tone: Technical");
    expect(prompt).not.toContain("Role:");
    expect(prompt).not.toContain("Company:");
    expect(prompt).not.toContain("Additional notes:");
  });

  it("includes tone preference", () => {
    const prompt = buildSystemPrompt(testPost, [], {
      profileRole: null,
      profileCompany: null,
      profileGoal: null,
      profileTone: "professional",
      profileContext: null,
    });
    expect(prompt).toContain("Preferred tone: Professional");
  });
});

describe("POST /api/chat profile loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
    mockFindFirst.mockResolvedValue({
      groqApiKey: null,
      profileRole: "DevRel",
      profileCompany: "TestCo",
      profileGoal: "Community engagement",
      profileTone: "casual",
      profileContext: "Be brief",
    });
    process.env.GROQ_API_KEY = "test-groq-key";
    mockProtect.mockResolvedValue({ isDenied: () => false });
  });

  it("should load and pass user profile to buildSystemPrompt", async () => {
    mockUserPostsFindFirst.mockResolvedValue({ post: mockPost });

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        };
      }
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
    });

    setupInsertChain();

    const textPromise = Promise.resolve("Response");
    mockStreamText.mockReturnValue({
      toTextStreamResponse: () =>
        new Response("stream", { headers: { "Content-Type": "text/event-stream" } }),
      text: textPromise,
    });

    const req = makePostRequest({ postId: "post-1", message: "Draft a reply" });
    await POST(req);

    const streamCallArgs = mockStreamText.mock.calls[0]?.[0] as { system: string };
    expect(streamCallArgs.system).toContain("About the user:");
    expect(streamCallArgs.system).toContain("Role: DevRel at TestCo");
    expect(streamCallArgs.system).toContain("Goal: Community engagement");
    expect(streamCallArgs.system).toContain("Preferred tone: Casual");
  });
});

describe("DELETE /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeDeleteRequest("post-1");
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when postId is missing", async () => {
    const req = makeDeleteRequest();
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("postId");
  });

  it("should successfully clear chat messages", async () => {
    const deleteChain = setupDeleteChain();

    const req = makeDeleteRequest("post-1");
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
    expect(deleteChain.where).toHaveBeenCalled();
  });
});
