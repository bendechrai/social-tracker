/**
 * Unit tests for the /api/suggest-terms API route.
 *
 * Tests the POST endpoint that uses Groq's LLM to suggest search terms
 * for a given tag/topic name. Verifies:
 * - Input validation via suggestTermsSchema
 * - BYOK: user's encrypted API key is prioritized over env var fallback
 * - LLM response parsing with retry logic (up to 2 attempts)
 * - Graceful error handling (returns empty suggestions, never crashes)
 * - Missing API key returns helpful error message
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
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

// Mock encryption
const mockDecrypt = vi.fn();
vi.mock("@/lib/encryption", () => ({
  decrypt: (val: string) => mockDecrypt(val),
}));

// Mock AI SDK
const mockGenerateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

const mockGroqModel = vi.fn();
const mockCreateGroq = vi.fn(() => (model: string) => {
  mockGroqModel(model);
  return `groq-model-${model}`;
});
vi.mock("@ai-sdk/groq", () => ({
  createGroq: (...args: unknown[]) => mockCreateGroq(...(args as [])),
}));

// Mock drizzle-orm eq (preserve other exports like relations used by schema)
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val })),
  };
});

// Import after mocks
import { POST, rateLimitMap } from "@/app/api/suggest-terms/route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/suggest-terms", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/suggest-terms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear rate limiter between tests
    rateLimitMap.clear();
    // Default: authenticated user without stored key, env var fallback
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
    mockFindFirst.mockResolvedValue({ groqApiKey: null });
    delete process.env.GROQ_API_KEY;
  });

  describe("input validation", () => {
    it("should reject request with missing tagName", async () => {
      const req = makeRequest({});
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should reject request with empty tagName", async () => {
      const req = makeRequest({ tagName: "" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should reject request with tagName exceeding 100 characters", async () => {
      const req = makeRequest({ tagName: "a".repeat(101) });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("API key resolution (BYOK)", () => {
    it("should use user's stored API key when available", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: "encrypted-key" });
      mockDecrypt.mockReturnValue("user-groq-key-123");
      mockGenerateText.mockResolvedValue({
        text: '["term1", "term2"]',
      });

      const req = makeRequest({ tagName: "React" });
      await POST(req);

      expect(mockDecrypt).toHaveBeenCalledWith("encrypted-key");
      expect(mockCreateGroq).toHaveBeenCalledWith({ apiKey: "user-groq-key-123" });
    });

    it("should fall back to GROQ_API_KEY env var when user has no key", async () => {
      process.env.GROQ_API_KEY = "env-groq-key";
      mockFindFirst.mockResolvedValue({ groqApiKey: null });
      mockGenerateText.mockResolvedValue({
        text: '["term1"]',
      });

      const req = makeRequest({ tagName: "React" });
      await POST(req);

      expect(mockDecrypt).not.toHaveBeenCalled();
      expect(mockCreateGroq).toHaveBeenCalledWith({ apiKey: "env-groq-key" });
    });

    it("should fall back to env var when decryption fails", async () => {
      process.env.GROQ_API_KEY = "env-groq-key";
      mockFindFirst.mockResolvedValue({ groqApiKey: "corrupt-encrypted-key" });
      mockDecrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });
      mockGenerateText.mockResolvedValue({
        text: '["term1"]',
      });

      const req = makeRequest({ tagName: "React" });
      await POST(req);

      expect(mockCreateGroq).toHaveBeenCalledWith({ apiKey: "env-groq-key" });
    });

    it("should return MISSING_API_KEY error when no API key available", async () => {
      mockFindFirst.mockResolvedValue({ groqApiKey: null });
      // No env var set (cleared in beforeEach)

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.code).toBe("MISSING_API_KEY");
      expect(data.error).toContain("not configured");
    });

    it("should handle unauthenticated user by falling back to env var", async () => {
      process.env.GROQ_API_KEY = "env-groq-key";
      mockAuth.mockResolvedValue(null);
      mockGenerateText.mockResolvedValue({
        text: '["term1"]',
      });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.suggestions).toEqual(["term1"]);
      expect(mockFindFirst).not.toHaveBeenCalled();
    });
  });

  describe("LLM response parsing", () => {
    beforeEach(() => {
      process.env.GROQ_API_KEY = "test-key";
    });

    it("should parse a valid JSON array from LLM response", async () => {
      mockGenerateText.mockResolvedValue({
        text: '["react", "reactjs", "react-dom", "jsx"]',
      });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.suggestions).toEqual(["react", "reactjs", "react-dom", "jsx"]);
    });

    it("should extract JSON array from text with surrounding content", async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Here are the terms:\n["react", "reactjs"]\nHope this helps!',
      });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(data.suggestions).toEqual(["react", "reactjs"]);
    });

    it("should lowercase all suggestions", async () => {
      mockGenerateText.mockResolvedValue({
        text: '["React", "ReactJS", "REACT"]',
      });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(data.suggestions).toEqual(["react", "reactjs", "react"]);
    });

    it("should filter out non-string values from LLM response", async () => {
      mockGenerateText.mockResolvedValue({
        text: '["react", 42, "reactjs", null, true]',
      });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(data.suggestions).toEqual(["react", "reactjs"]);
    });

    it("should retry once on failed JSON parse, then succeed", async () => {
      mockGenerateText
        .mockResolvedValueOnce({ text: "Here are some terms for you:" })
        .mockResolvedValueOnce({ text: '["react", "reactjs"]' });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(data.suggestions).toEqual(["react", "reactjs"]);
    });

    it("should return empty suggestions after all retry attempts fail", async () => {
      mockGenerateText
        .mockResolvedValueOnce({ text: "No JSON here" })
        .mockResolvedValueOnce({ text: "Still no JSON" });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(data.suggestions).toEqual([]);
    });

    it("should handle generateText throwing an error with retry", async () => {
      mockGenerateText
        .mockRejectedValueOnce(new Error("API rate limit"))
        .mockResolvedValueOnce({ text: '["react"]' });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(data.suggestions).toEqual(["react"]);
    });

    it("should use llama-3.3-70b-versatile model", async () => {
      mockGenerateText.mockResolvedValue({ text: '["term"]' });

      const req = makeRequest({ tagName: "React" });
      await POST(req);

      expect(mockGroqModel).toHaveBeenCalledWith("llama-3.3-70b-versatile");
    });

    it("should include proper system prompt and user prompt", async () => {
      mockGenerateText.mockResolvedValue({ text: '["term"]' });

      const req = makeRequest({ tagName: "Kubernetes" });
      await POST(req);

      const callArgs = mockGenerateText.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs.system).toContain("developer relations");
      expect(callArgs.prompt).toBe("Topic: Kubernetes");
    });
  });

  describe("rate limiting", () => {
    beforeEach(() => {
      process.env.GROQ_API_KEY = "test-key";
    });

    it("should allow requests within rate limit", async () => {
      mockGenerateText.mockResolvedValue({ text: '["term"]' });

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);

      expect(res.status).toBe(200);
    });

    it("should return 429 when rate limit exceeded", async () => {
      mockGenerateText.mockResolvedValue({ text: '["term"]' });

      // Fill up the rate limit (10 requests)
      for (let i = 0; i < 10; i++) {
        const req = makeRequest({ tagName: "React" });
        await POST(req);
      }

      // 11th request should be rate limited
      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toContain("Rate limit exceeded");
      expect(data.suggestions).toEqual([]);
    });

    it("should not rate limit unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);
      mockGenerateText.mockResolvedValue({ text: '["term"]' });

      // Even many requests should succeed for unauthenticated users
      for (let i = 0; i < 15; i++) {
        const req = makeRequest({ tagName: "React" });
        const res = await POST(req);
        expect(res.status).toBe(200);
      }
    });
  });

  describe("invalid API key handling", () => {
    beforeEach(() => {
      process.env.GROQ_API_KEY = "invalid-key";
    });

    it("should return INVALID_API_KEY error on 401 response from Groq", async () => {
      mockGenerateText.mockRejectedValue(new Error("401 Unauthorized"));

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.code).toBe("INVALID_API_KEY");
      expect(data.error).toContain("Invalid API key");
    });

    it("should return INVALID_API_KEY error on authentication error from Groq", async () => {
      mockGenerateText.mockRejectedValue(new Error("Authentication failed: invalid api key"));

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.code).toBe("INVALID_API_KEY");
      expect(data.error).toContain("Invalid API key");
    });
  });

  describe("error handling", () => {
    it("should return empty suggestions on invalid JSON body", async () => {
      const req = new NextRequest("http://localhost:3000/api/suggest-terms", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.suggestions).toEqual([]);
    });

    it("should return 200 with empty suggestions on unexpected errors", async () => {
      process.env.GROQ_API_KEY = "test-key";
      mockGenerateText
        .mockRejectedValueOnce(new Error("Unexpected"))
        .mockRejectedValueOnce(new Error("Unexpected again"));

      const req = makeRequest({ tagName: "React" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.suggestions).toEqual([]);
    });
  });
});
