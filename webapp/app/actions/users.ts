"use server";

import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

const DEFAULT_EMAIL = "dev@example.com";

// Get or create the default user (for v1 single-user mode)
export async function getOrCreateDefaultUser() {
  // Try to find existing user
  let user = await db.query.users.findFirst({
    where: eq(users.email, DEFAULT_EMAIL),
  });

  // Create if not exists
  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({ email: DEFAULT_EMAIL })
      .returning();
    user = newUser!;
  }

  return user;
}

// Get current user ID (for v1, always returns default user)
export async function getCurrentUserId(): Promise<string> {
  const user = await getOrCreateDefaultUser();
  return user.id;
}
