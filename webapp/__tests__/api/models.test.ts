/**
 * Tests for GET /api/models
 *
 * Covers:
 * - Returns filtered model list from OpenRouter API
 * - Caches for 1 hour
 * - Handles OpenRouter API error (falls back to static models)
 * - Only returns allowlisted models
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";

// Store original env
const originalEnv = { ...process.env };

describe("GET /api/models", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  it("returns filtered model list from OpenRouter API", async () => {
    server.use(
      http.get("https://openrouter.ai/api/v1/models", () => {
        return HttpResponse.json({
          data: [
            {
              id: "openai/gpt-4o-mini",
              pricing: { prompt: "0.00000015", completion: "0.0000006" },
            },
            {
              id: "google/gemini-2.0-flash-001",
              pricing: { prompt: "0.0000001", completion: "0.0000004" },
            },
            {
              id: "some/other-model",
              pricing: { prompt: "0.001", completion: "0.002" },
            },
          ],
        });
      })
    );

    const { GET } = await import("@/app/api/models/route");
    const response = await GET();
    const json = await response.json();

    // Should only return the 2 allowlisted models, not "some/other-model"
    expect(json.models).toHaveLength(2);
    expect(json.models[0].id).toBe("openai/gpt-4o-mini");
    expect(json.models[0].name).toBe("GPT-4o Mini");
    expect(json.models[0].vendor).toBe("OpenAI");
    expect(typeof json.models[0].promptPricePerMillion).toBe("number");
    expect(typeof json.models[0].completionPricePerMillion).toBe("number");
    expect(json.models[1].id).toBe("google/gemini-2.0-flash-001");
  });

  it("caches for 1 hour", async () => {
    let fetchCount = 0;
    server.use(
      http.get("https://openrouter.ai/api/v1/models", () => {
        fetchCount++;
        return HttpResponse.json({
          data: [
            {
              id: "openai/gpt-4o-mini",
              pricing: { prompt: "0.00000015", completion: "0.0000006" },
            },
          ],
        });
      })
    );

    const { GET } = await import("@/app/api/models/route");

    // First call should fetch
    await GET();
    expect(fetchCount).toBe(1);

    // Second call within 1 hour should use cache
    await GET();
    expect(fetchCount).toBe(1);
  });

  it("handles OpenRouter API error and falls back to static models", async () => {
    server.use(
      http.get("https://openrouter.ai/api/v1/models", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { GET } = await import("@/app/api/models/route");
    const response = await GET();
    const json = await response.json();

    // Should return static models with zero pricing
    expect(json.models.length).toBeGreaterThan(0);
    expect(json.models[0].promptPricePerMillion).toBe(0);
    expect(json.models[0].completionPricePerMillion).toBe(0);
  });

  it("only returns allowlisted models", async () => {
    server.use(
      http.get("https://openrouter.ai/api/v1/models", () => {
        return HttpResponse.json({
          data: [
            {
              id: "openai/gpt-4o-mini",
              pricing: { prompt: "0.00000015", completion: "0.0000006" },
            },
            {
              id: "not-in-allowlist/some-model",
              pricing: { prompt: "0.001", completion: "0.002" },
            },
            {
              id: "another/unknown-model",
              pricing: { prompt: "0.0005", completion: "0.001" },
            },
            {
              id: "deepseek/deepseek-chat",
              pricing: { prompt: "0.00000014", completion: "0.00000028" },
            },
          ],
        });
      })
    );

    const { GET } = await import("@/app/api/models/route");
    const response = await GET();
    const json = await response.json();

    const ids = json.models.map((m: { id: string }) => m.id);
    expect(ids).toContain("openai/gpt-4o-mini");
    expect(ids).toContain("deepseek/deepseek-chat");
    expect(ids).not.toContain("not-in-allowlist/some-model");
    expect(ids).not.toContain("another/unknown-model");
    expect(json.models).toHaveLength(2);
  });
});
