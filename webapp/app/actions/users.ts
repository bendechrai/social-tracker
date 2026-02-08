"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

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

/**
 * Gets the current user's email notification preference.
 */
export async function getEmailNotifications(): Promise<boolean> {
  const userId = await getCurrentUserId();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { emailNotifications: true },
  });

  return user?.emailNotifications ?? true;
}

/**
 * Updates the current user's email notification preference.
 */
export async function updateEmailNotifications(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(users)
      .set({
        emailNotifications: enabled,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return { success: false, error: "Not authenticated" };
    }
    console.error("Error updating email notifications:", error);
    return { success: false, error: "Failed to update email notifications" };
  }
}
