import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { suggestTermsSchema } from "@/lib/validations";

const SYSTEM_PROMPT = `You are helping a developer relations professional track mentions of a technology topic on Reddit. Given a topic name, suggest search terms that would find relevant Reddit posts about this topic. Include: the exact topic name (lowercase), common variations and abbreviations, component names or features, related technical terms, common misspellings if applicable. Return ONLY a JSON array of strings, no explanation. Keep terms lowercase. Aim for 5-15 terms.`;

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

    // Check if Groq API key is configured
    if (!process.env.GROQ_API_KEY) {
      console.warn("GROQ_API_KEY not configured, returning empty suggestions");
      return NextResponse.json({ suggestions: [] });
    }

    // Call Groq LLM for suggestions
    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
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
