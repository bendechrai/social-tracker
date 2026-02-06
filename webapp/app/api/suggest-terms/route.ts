import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { suggestTermsSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { decrypt } from "@/lib/encryption";
import { eq } from "drizzle-orm";

const SYSTEM_PROMPT = `You are helping a developer relations professional track mentions of a technology topic on Reddit. Given a topic name, suggest search terms that would find relevant Reddit posts about this topic. Include: the exact topic name (lowercase), common variations and abbreviations, component names or features, related technical terms, common misspellings if applicable. Return ONLY a JSON array of strings, no explanation. Keep terms lowercase. Aim for 5-15 terms.`;

// Simple in-memory rate limiter: 10 requests per minute per user
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
export const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  let timestamps = rateLimitMap.get(userId);

  if (!timestamps) {
    rateLimitMap.set(userId, [now]);
    return true;
  }

  // Remove timestamps older than the window
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(userId, timestamps);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  timestamps.push(now);
  return true;
}

/**
 * Gets the Groq API key to use for this request.
 * Priority: 1) User's stored key, 2) Environment variable
 */
async function getApiKey(userId?: string): Promise<string | null> {
  // Try to get user's API key first
  if (userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { groqApiKey: true },
    });

    if (user?.groqApiKey) {
      try {
        return decrypt(user.groqApiKey);
      } catch (error) {
        console.error("Error decrypting user's Groq API key:", error);
        // Fall through to env var
      }
    }
  }

  // Fall back to environment variable
  return process.env.GROQ_API_KEY ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const parsed = suggestTermsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { tagName } = parsed.data;

    // Get session once for both rate limiting and API key resolution
    const session = await auth();
    const userId = session?.user?.id;

    // Rate limit check
    if (userId) {
      if (!checkRateLimit(userId)) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please wait before making more requests.", suggestions: [] },
          { status: 429 }
        );
      }
    }

    // Get API key (user's key or env var fallback)
    const apiKey = await getApiKey(userId);
    if (!apiKey) {
      console.warn("No Groq API key available (neither user key nor GROQ_API_KEY env var)");
      return NextResponse.json({
        error: "Groq API key not configured",
        code: "MISSING_API_KEY",
      });
    }

    // Call Groq LLM for suggestions
    const groq = createGroq({
      apiKey,
    });

    let suggestions: string[] = [];
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const result = await generateText({
          model: groq("llama-3.3-70b-versatile"),
          system: SYSTEM_PROMPT,
          prompt: `Topic: ${tagName}`,
        });

        // Parse the JSON array from the response
        const text = result.text.trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            // Ensure all items are lowercase strings
            suggestions = parsed
              .filter((item): item is string => typeof item === "string")
              .map((s) => s.toLowerCase());
            break;
          }
        }

        // If we get here, JSON parsing failed, try again
        console.warn(`Attempt ${attempts}: Failed to parse JSON from LLM response`);
      } catch (parseError) {
        // Detect invalid API key errors from the Groq SDK
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        if (errorMessage.includes("401") || errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("unauthorized") || errorMessage.toLowerCase().includes("authentication")) {
          console.error("Invalid Groq API key:", errorMessage);
          return NextResponse.json({
            error: "Invalid API key. Check your Groq API key in Settings.",
            code: "INVALID_API_KEY",
          });
        }
        console.error(`Attempt ${attempts}: Error parsing LLM response:`, parseError);
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error in suggest-terms API:", error);
    // Return empty array on error, don't crash
    return NextResponse.json({ suggestions: [] });
  }
}
