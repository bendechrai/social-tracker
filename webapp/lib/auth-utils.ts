/**
 * Authentication utility functions.
 *
 * Separated from auth.ts to allow unit testing without
 * initializing the full NextAuth configuration.
 */
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { verifyPassword } from "@/lib/password";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Email validation schema - exported for testing
export const emailSchema = z.string().email("Invalid email format");

// 7 days in seconds for session duration
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

// Credentials input type - uses unknown to match Auth.js type
export interface CredentialsInput {
  email?: unknown;
  password?: unknown;
}

// Authorize result type
export interface AuthorizeResult {
  id: string;
  email: string;
}

/**
 * Authorize credentials for login.
 * Validates email format, looks up user, and verifies password.
 * Returns user data for session or null if authentication fails.
 *
 * Exported for unit testing - used internally by Credentials provider.
 */
export async function authorizeCredentials(
  credentials: CredentialsInput | undefined
): Promise<AuthorizeResult | null> {
  // Validate email format
  const emailResult = emailSchema.safeParse(credentials?.email);
  if (!emailResult.success) {
    return null;
  }

  const email = emailResult.data;
  const password = credentials?.password;

  if (!password || typeof password !== "string") {
    return null;
  }

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user || !user.passwordHash) {
    // User not found or no password set (OAuth-only user)
    return null;
  }

  // Verify password using bcrypt
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  // Return user object for session
  return {
    id: user.id,
    email: user.email,
  };
}
