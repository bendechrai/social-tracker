"use server";

import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { getCurrentUserId } from "./users";
import { eq } from "drizzle-orm";

export type RedditConnectionStatus = {
  connected: boolean;
  username: string | null;
  expiresAt: Date | null;
};

export type DisconnectResult = {
  success: boolean;
  error?: string;
};

/**
 * Gets the current user's Reddit connection status.
 * Returns username and token expiry if connected.
 */
export async function getRedditConnectionStatus(): Promise<RedditConnectionStatus> {
  try {
    const userId = await getCurrentUserId();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        redditUsername: true,
        redditAccessToken: true,
        redditTokenExpiresAt: true,
      },
    });

    if (!user?.redditAccessToken || !user?.redditUsername) {
      return {
        connected: false,
        username: null,
        expiresAt: null,
      };
    }

    return {
      connected: true,
      username: user.redditUsername,
      expiresAt: user.redditTokenExpiresAt,
    };
  } catch {
    return {
      connected: false,
      username: null,
      expiresAt: null,
    };
  }
}

/**
 * Checks if the current user has a Reddit account connected.
 */
export async function hasRedditConnection(): Promise<boolean> {
  try {
    const status = await getRedditConnectionStatus();
    return status.connected;
  } catch {
    return false;
  }
}

/**
 * Disconnects the current user's Reddit account.
 * Clears all Reddit tokens and username.
 * Previously fetched posts remain in the database.
 */
export async function disconnectReddit(): Promise<DisconnectResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(users)
      .set({
        redditAccessToken: null,
        redditRefreshToken: null,
        redditTokenExpiresAt: null,
        redditUsername: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return { success: false, error: "Not authenticated" };
    }
    console.error("Error disconnecting Reddit:", error);
    return { success: false, error: "Failed to disconnect Reddit account" };
  }
}

/**
 * Checks if Reddit OAuth is configured (client ID and secret are set).
 * This is used to show/hide the connect button in the UI.
 */
export async function isRedditOAuthConfigured(): Promise<boolean> {
  return !!(
    process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET
  );
}
