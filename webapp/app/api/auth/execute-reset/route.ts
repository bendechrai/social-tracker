import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { passwordSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { token, password, confirmPassword } = body as Record<string, unknown>;

  // Validate token is present
  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "Token is required" },
      { status: 400 }
    );
  }

  // Validate passwords match
  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: "Passwords do not match" },
      { status: 400 }
    );
  }

  // Validate password against schema
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid password" },
      { status: 400 }
    );
  }

  // Hash the provided token with SHA-256
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Look up the hashed token in verificationTokens
  const [tokenRecord] = await db
    .select({
      identifier: verificationTokens.identifier,
      expires: verificationTokens.expires,
    })
    .from(verificationTokens)
    .where(eq(verificationTokens.token, hashedToken))
    .limit(1);

  if (!tokenRecord || tokenRecord.expires < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired reset link" },
      { status: 400 }
    );
  }

  // Look up user by identifier (email)
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, tokenRecord.identifier))
    .limit(1);

  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired reset link" },
      { status: 400 }
    );
  }

  // Hash new password with bcrypt
  const passwordHash = await hashPassword(parsed.data);

  // Update user: set passwordHash and passwordChangedAt
  await db
    .update(users)
    .set({
      passwordHash,
      passwordChangedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Delete the used token
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, tokenRecord.identifier),
        eq(verificationTokens.token, hashedToken)
      )
    );

  return NextResponse.json({ success: true });
}
