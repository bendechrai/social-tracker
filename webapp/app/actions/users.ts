"use server";

import { auth } from "@/lib/auth";

/**
 * Gets the current authenticated user's ID from the session.
 * Throws an error if not authenticated.
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return session.user.id;
}

/**
 * Gets the current authenticated user's ID, or null if not authenticated.
 * Use this when you need to check authentication without throwing.
 */
export async function getCurrentUserIdOrNull(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
