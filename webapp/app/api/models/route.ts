import { NextResponse } from "next/server";
import { ALLOWED_MODELS } from "@/lib/ai-models";

interface OpenRouterModel {
  id: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

interface CachedModels {
  data: Array<{
    id: string;
    name: string;
    vendor: string;
    promptPricePerMillion: number;
    completionPricePerMillion: number;
  }>;
  fetchedAt: number;
}

let cache: CachedModels | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({ models: cache.data });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      const staticModels = ALLOWED_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        vendor: m.vendor,
        promptPricePerMillion: 0,
        completionPricePerMillion: 0,
      }));
      return NextResponse.json({ models: staticModels });
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const json = (await response.json()) as { data: OpenRouterModel[] };
    const allowedIds = new Set(ALLOWED_MODELS.map((m) => m.id));

    const models = json.data
      .filter((m: OpenRouterModel) => allowedIds.has(m.id))
      .map((m: OpenRouterModel) => {
        const allowed = ALLOWED_MODELS.find((a) => a.id === m.id);
        const promptPrice = parseFloat(m.pricing?.prompt ?? "0");
        const completionPrice = parseFloat(m.pricing?.completion ?? "0");
        return {
          id: m.id,
          name: allowed?.name ?? m.id,
          vendor: allowed?.vendor ?? "Unknown",
          promptPricePerMillion: Math.round(promptPrice * 1_000_000 * 100) / 100,
          completionPricePerMillion: Math.round(completionPrice * 1_000_000 * 100) / 100,
        };
      });

    cache = { data: models, fetchedAt: now };
    return NextResponse.json({ models });
  } catch (error) {
    console.error("Error fetching models:", error);
    const staticModels = ALLOWED_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      vendor: m.vendor,
      promptPricePerMillion: 0,
      completionPricePerMillion: 0,
    }));
    return NextResponse.json({ models: staticModels });
  }
}
