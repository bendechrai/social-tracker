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
import type { JWT } from "next-auth/jwt";
import aj from "@/lib/arcjet";
import { detectBot, slidingWindow, request } from "@arcjet/next";

const loginAj = aj
  .withRule(slidingWindow({ mode: "LIVE", interval: "5m", max: 10 }))
  .withRule(detectBot({ mode: "LIVE", allow: [] }));

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

  // Arcjet protection: shield + bot detection + rate limiting
  const req = await request();
  const decision = await loginAj.protect(req);

  if (decision.isDenied()) {
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

/**
 * Check if a user's password was changed after the JWT was issued.
 * Returns true if the session should be invalidated (password changed after token issued).
 *
 * Only checks on token refresh (not initial sign-in, when `user` is present).
 */
export async function isSessionInvalidatedByPasswordChange(
  userId: string
): Promise<Date | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { passwordChangedAt: true },
  });
  return user?.passwordChangedAt ?? null;
}

/**
 * JWT callback handler that checks passwordChangedAt on refresh.
 * On initial sign-in (user present), persists user info into token.
 * On refresh (no user), checks if password was changed after token issued.
 * Returns token with id/email cleared to invalidate the session.
 */
export async function handleJwtCallback({
  token,
  user,
}: {
  token: JWT;
  user?: { id?: string; email?: string | null };
}): Promise<JWT> {
  // On sign-in, persist user id and email into the JWT
  if (user) {
    token.id = user.id;
    token.email = user.email;
    return token;
  }

  // On refresh, check if password was changed after token was issued
  if (token.id && token.iat) {
    const passwordChangedAt = await isSessionInvalidatedByPasswordChange(
      String(token.id)
    );
    if (passwordChangedAt) {
      const iatDate = new Date(Number(token.iat) * 1000);
      if (passwordChangedAt > iatDate) {
        // Password was changed after this token was issued — invalidate
        // Clear user fields so the session becomes unauthenticated
        delete token.id;
        delete token.email;
        return token;
      }
    }
  }

  return token;
}
