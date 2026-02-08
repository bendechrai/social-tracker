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
 * Priority: 1) User's stored Groq key, 2) Env Groq key, 3) Credit balance, 4) None
 */
async function resolveAiProvider(
  userId: string,
  requestedModelId?: string
): Promise<AiProvider> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { groqApiKey: true },
  });

  // Priority 1: User has their own Groq API key
  if (user?.groqApiKey) {
    try {
      const apiKey = decrypt(user.groqApiKey);
      return { type: "groq", apiKey };
    } catch (error) {
      console.error("Error decrypting user's Groq API key:", error);
    }
  }

  // Priority 2: Fall back to env Groq key
  if (process.env.GROQ_API_KEY) {
    return { type: "groq", apiKey: process.env.GROQ_API_KEY };
  }

  // Priority 3: Credit balance with OpenRouter
  const balance = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.userId, userId),
    columns: { balanceCents: true },
  });

  if (balance && balance.balanceCents > 0) {
    const modelId = requestedModelId ?? "google/gemini-2.0-flash-001";
    if (!isAllowedModel(modelId)) {
      return { type: "none" };
    }
    return { type: "credits", modelId };
  }

  return { type: "none" };
}

function buildSystemPrompt(post: {
  title: string;
  body: string | null;
  subreddit: string;
  author: string;
}, postComments: Array<{
  author: string;
  body: string;
  score: number;
  parentRedditId: string | null;
}>): string {
  const commentsText = postComments
    .map((c) => {
      const indent = c.parentRedditId ? "  " : "";
      return `${indent}u/${c.author} (score: ${c.score}):\n${indent}${c.body}`;
    })
    .join("\n\n");

  return `You are an AI assistant helping a user engage with a Reddit post. You have full context of the post and its comments.

Post: ${post.title}
Subreddit: r/${post.subreddit}
Author: u/${post.author}
Body: ${post.body ?? "(no body)"}

Comments:
${commentsText || "(no comments)"}

Important rules:
- NEVER fabricate, guess, or invent information you don't have. If you don't know something, say so clearly.
- You can ONLY see the post content and comments provided above. You cannot access URLs, GitHub repositories, external websites, or any resources outside this conversation.
- If the user asks you to visit a link, review a repo, or look something up, tell them: "I can only work with the post and comments shown here — I'm not able to browse the web or visit links. Web research is a feature we're working on for the future."
- When discussing tools, libraries, or technical claims made in the post or comments, base your analysis ONLY on what's stated in the text. Do not add technical details you're not certain about.
- If you're unsure about a technical detail, say "Based on what's described in the post..." or "I'd need to verify this, but..." rather than stating it as fact.

Help the user understand the discussion, identify key points, and draft thoughtful responses. When asked to draft a reply, write it in a natural Reddit comment style — conversational, helpful, and relevant to the discussion.`;
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

    // Build messages array for the LLM
    const systemPrompt = buildSystemPrompt(userPost.post, postComments);
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
          const orUsage = await result.experimental_providerMetadata;

          const promptTokens =
            orUsage?.openrouter?.promptTokens ??
            usage?.promptTokens ??
            0;
          const completionTokens =
            orUsage?.openrouter?.completionTokens ??
            usage?.completionTokens ??
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
