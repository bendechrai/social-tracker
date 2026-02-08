import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  userPosts,
  comments,
  chatMessages,
  creditBalances,
  aiUsageLog,
} from "@/drizzle/schema";
import { decrypt } from "@/lib/encryption";
import { eq, and, asc, sql } from "drizzle-orm";
import aj, { ajMode } from "@/lib/arcjet";
import { slidingWindow } from "@arcjet/next";
import { getOpenRouterClient } from "@/lib/openrouter";
import { isAllowedModel } from "@/lib/ai-models";

const chatAj = aj.withRule(
  slidingWindow({ mode: ajMode, interval: "1m", max: 20, characteristics: ["userId"] })
);

type AiProvider =
  | { type: "groq"; apiKey: string }
  | { type: "credits"; modelId: string }
  | { type: "none" };

/**
 * Resolves the AI provider for the given user.
 * If modelId is provided → try credits path (OpenRouter).
 * If no modelId → try BYOK Groq path (user key, then env fallback).
 * If neither works → none.
 */
async function resolveAiProvider(
  userId: string,
  requestedModelId?: string
): Promise<AiProvider> {
  // Path 1: modelId provided → use credits (OpenRouter)
  if (requestedModelId) {
    if (!isAllowedModel(requestedModelId)) {
      return { type: "none" };
    }

    const balance = await db.query.creditBalances.findFirst({
      where: eq(creditBalances.userId, userId),
      columns: { balanceCents: true },
    });

    if (balance && balance.balanceCents > 0) {
      return { type: "credits", modelId: requestedModelId };
    }

    return { type: "none" };
  }

  // Path 2: no modelId → try BYOK Groq
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { groqApiKey: true },
  });

  if (user?.groqApiKey) {
    try {
      const apiKey = decrypt(user.groqApiKey);
      return { type: "groq", apiKey };
    } catch (error) {
      console.error("Error decrypting user's Groq API key:", error);
    }
  }

  if (process.env.GROQ_API_KEY) {
    return { type: "groq", apiKey: process.env.GROQ_API_KEY };
  }

  return { type: "none" };
}

export function buildSystemPrompt(
  post: {
    title: string;
    body: string | null;
    subreddit: string;
    author: string;
  },
  postComments: Array<{
    author: string;
    body: string;
    score: number;
    parentRedditId: string | null;
  }>,
  profile?: {
    profileRole: string | null;
    profileCompany: string | null;
    profileGoal: string | null;
    profileTone: string | null;
    profileContext: string | null;
  }
): string {
  const commentsText = postComments
    .map((c) => {
      const indent = c.parentRedditId ? "  " : "";
      return `${indent}u/${c.author} (score: ${c.score}):\n${indent}${c.body}`;
    })
    .join("\n\n");

  // Build profile section if any fields are set
  let profileSection = "";
  if (profile) {
    const lines: string[] = [];
    if (profile.profileRole || profile.profileCompany) {
      const rolePart = profile.profileRole ?? "";
      const companyPart = profile.profileCompany ?? "";
      if (rolePart && companyPart) {
        lines.push(`- Role: ${rolePart} at ${companyPart}`);
      } else if (rolePart) {
        lines.push(`- Role: ${rolePart}`);
      } else {
        lines.push(`- Company: ${companyPart}`);
      }
    }
    if (profile.profileGoal) {
      lines.push(`- Goal: ${profile.profileGoal}`);
    }
    if (profile.profileTone) {
      lines.push(`- Preferred tone: ${profile.profileTone.charAt(0).toUpperCase() + profile.profileTone.slice(1)}`);
    }
    if (profile.profileContext) {
      lines.push(`- Additional notes: ${profile.profileContext}`);
    }
    if (lines.length > 0) {
      profileSection = `\n\nAbout the user:\n${lines.join("\n")}\n\nWhen drafting replies, write in the user's voice as described above. The user will post these as themselves on Reddit, so they must sound natural and genuine.`;
    }
  }

  return `You are an AI assistant helping a user engage with a Reddit post. You have full context of the post and its comments.

Post: ${post.title}
Subreddit: r/${post.subreddit}
Author: u/${post.author}
Body: ${post.body ?? "(no body)"}

Comments:
${commentsText || "(no comments)"}${profileSection}

Important rules:
- NEVER fabricate, guess, or invent information you don't have. If you don't know something, say so clearly.
- You can ONLY see the post content and comments provided above. You cannot access URLs, GitHub repositories, external websites, or any resources outside this conversation.
- If the user asks you to visit a link, review a repo, or look something up, tell them: "I can only work with the post and comments shown here — I'm not able to browse the web or visit links. Web research is a feature we're working on for the future."
- When discussing tools, libraries, or technical claims made in the post or comments, base your analysis ONLY on what's stated in the text. Do not add technical details you're not certain about.
- If you're unsure about a technical detail, say "Based on what's described in the post..." or "I'd need to verify this, but..." rather than stating it as fact.

Help the user understand the discussion and draft responses.

When drafting a reply for the user to post:
- Write like a real person on Reddit — casual, concise, and genuine
- Match the tone of the subreddit (technical subreddits expect technical credibility, not marketing speak)
- Keep it short unless the user asks for detail
- No flowery language, no filler phrases, no "Great question!" openers
- No emoji unless the subreddit culture uses them
- If the user has a profile configured, write in their voice as described`;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // Arcjet rate limit check
    const decision = await chatAj.protect(request, { userId });
    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { postId, message, modelId } = body as {
      postId?: string;
      message?: string;
      modelId?: string;
    };

    if (!postId || typeof postId !== "string") {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // Verify user has access to this post
    const userPost = await db.query.userPosts.findFirst({
      where: and(eq(userPosts.postId, postId), eq(userPosts.userId, userId)),
      with: {
        post: true,
      },
    });

    if (!userPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Resolve AI provider
    const provider = await resolveAiProvider(userId, modelId);
    if (provider.type === "none") {
      return NextResponse.json(
        { error: "No AI access configured", code: "NO_AI_ACCESS" },
        { status: 422 }
      );
    }

    // Load comments for the post
    const postComments = await db
      .select({
        author: comments.author,
        body: comments.body,
        score: comments.score,
        parentRedditId: comments.parentRedditId,
      })
      .from(comments)
      .where(eq(comments.postRedditId, userPost.post.redditId));

    // Load existing chat history
    const chatHistory = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.postId, postId)
        )
      )
      .orderBy(asc(chatMessages.createdAt));

    // Load user profile for system prompt
    const userProfile = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        profileRole: true,
        profileCompany: true,
        profileGoal: true,
        profileTone: true,
        profileContext: true,
      },
    });

    // Build messages array for the LLM
    const systemPrompt = buildSystemPrompt(userPost.post, postComments, userProfile ?? undefined);
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...chatHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message.trim() },
    ];

    // Persist the user message
    await db.insert(chatMessages).values({
      userId,
      postId,
      role: "user",
      content: message.trim(),
    });

    if (provider.type === "groq") {
      // Stream response from Groq
      const groq = createGroq({ apiKey: provider.apiKey });

      const result = streamText({
        model: groq("llama-3.3-70b-versatile"),
        system: systemPrompt,
        messages,
      });

      const response = result.toTextStreamResponse();

      // Persist the assistant message after streaming completes
      Promise.resolve(result.text)
        .then(async (fullText) => {
          try {
            await db.insert(chatMessages).values({
              userId,
              postId,
              role: "assistant",
              content: fullText,
            });
          } catch (error) {
            console.error("Failed to persist assistant message:", error);
          }
        })
        .catch((error: unknown) => {
          console.error("Error collecting streamed text:", error);
        });

      return response;
    }

    // Credits path — use OpenRouter
    const openrouter = getOpenRouterClient();

    const result = streamText({
      model: openrouter(provider.modelId),
      system: systemPrompt,
      messages,
    });

    const response = result.toTextStreamResponse();

    // After streaming: persist message, log usage, deduct credits
    Promise.resolve(result.text)
      .then(async (fullText) => {
        try {
          await db.insert(chatMessages).values({
            userId,
            postId,
            role: "assistant",
            content: fullText,
          });
        } catch (error) {
          console.error("Failed to persist assistant message:", error);
        }

        try {
          const usage = await result.usage;
          const orUsage = await result.providerMetadata;

          const promptTokens =
            (orUsage?.openrouter?.promptTokens as number | undefined) ??
            usage?.inputTokens ??
            0;
          const completionTokens =
            (orUsage?.openrouter?.completionTokens as number | undefined) ??
            usage?.outputTokens ??
            0;

          // OpenRouter returns cost in USD via generation metadata
          let costUsd = 0;
          const genCost = orUsage?.openrouter?.cost;
          if (typeof genCost === "number") {
            costUsd = genCost;
          }

          const costCents = Math.max(1, Math.ceil(costUsd * 100));

          // Atomically deduct credits (floor at 0)
          await db
            .update(creditBalances)
            .set({
              balanceCents: sql`GREATEST(0, ${creditBalances.balanceCents} - ${costCents})`,
            })
            .where(eq(creditBalances.userId, userId));

          // Log usage
          await db.insert(aiUsageLog).values({
            userId,
            postId,
            modelId: provider.modelId,
            provider: "openrouter",
            promptTokens: Number(promptTokens),
            completionTokens: Number(completionTokens),
            costCents,
          });
        } catch (error) {
          console.error("Failed to log usage or deduct credits:", error);
        }
      })
      .catch((error: unknown) => {
        console.error("Error collecting streamed text:", error);
      });

    return response;
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // Get postId from query params
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    // Delete all chat messages for this user and post
    await db
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.postId, postId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
