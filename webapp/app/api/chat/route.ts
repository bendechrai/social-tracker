import { NextRequest, NextResponse } from "next/server";
import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, userPosts, comments, chatMessages } from "@/drizzle/schema";
import { decrypt } from "@/lib/encryption";
import { eq, and, asc } from "drizzle-orm";

/**
 * Gets the Groq API key for the given user.
 * Priority: 1) User's stored key, 2) Environment variable
 */
async function getApiKey(userId: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { groqApiKey: true },
  });

  if (user?.groqApiKey) {
    try {
      return decrypt(user.groqApiKey);
    } catch (error) {
      console.error("Error decrypting user's Groq API key:", error);
    }
  }

  return process.env.GROQ_API_KEY ?? null;
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

    // Parse request body
    const body = await request.json();
    const { postId, message } = body as { postId?: string; message?: string };

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

    // Get API key
    const apiKey = await getApiKey(userId);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Groq API key not configured", code: "MISSING_API_KEY" },
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

    // Stream response from Groq
    const groq = createGroq({ apiKey });

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages,
    });

    // Collect the full response text and persist after streaming
    const response = result.toTextStreamResponse();

    // Use the text promise to persist the assistant message after streaming completes
    Promise.resolve(result.text).then(async (fullText) => {
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
    }).catch((error: unknown) => {
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
