import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, verificationTokens } from "@/drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { emailSchema } from "@/lib/validations";
import { sendEmail } from "@/lib/email";
import { buildPasswordResetEmail } from "@/lib/email-templates";
import aj, { ajMode } from "@/lib/arcjet";
import { protectSignup } from "@arcjet/next";

const resetAj = aj.withRule(
  protectSignup({
    email: {
      mode: ajMode,
      deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"],
    },
    bots: {
      mode: ajMode,
      allow: [],
    },
    rateLimit: {
      mode: ajMode,
      interval: "15m",
      max: 3,
    },
  })
);

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

function getAppUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

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

  const parsed = emailSchema.safeParse(
    (body as Record<string, unknown>)?.email
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 }
    );
  }

  const email = parsed.data.toLowerCase();

  // Arcjet protection: shield + bot detection + email validation + rate limiting
  const decision = await resetAj.protect(req, { email });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }
    if (decision.reason.isBot()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (decision.reason.isEmail()) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Look up user by email (case-insensitive)
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // If user not found, return 200 (don't reveal email existence)
  if (!user) {
    return NextResponse.json({ success: true });
  }

  // Rate limit: check for token created within the last 15 minutes.
  // Tokens expire in 1 hour, so a token created < 15min ago has expires > now + 45min.
  const rateLimitThreshold = new Date(
    Date.now() + TOKEN_EXPIRY_MS - RATE_LIMIT_MS
  );
  const recentTokens = await db
    .select({ token: verificationTokens.token })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        gt(verificationTokens.expires, rateLimitThreshold)
      )
    )
    .limit(1);

  if (recentTokens.length > 0) {
    // Rate limited — still return 200 to not reveal info
    return NextResponse.json({ success: true });
  }

  // Delete any existing reset tokens for this email
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, email));

  // Generate cryptographically random token
  const rawToken = crypto.randomBytes(32).toString("hex");

  // Hash with SHA-256 before storing
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // Insert into verificationTokens
  const expires = new Date(Date.now() + TOKEN_EXPIRY_MS);
  await db.insert(verificationTokens).values({
    identifier: email,
    token: hashedToken,
    expires,
  });

  // Send reset email (fire-and-forget)
  const appUrl = getAppUrl(req);
  const emailContent = buildPasswordResetEmail({
    token: rawToken,
    appUrl,
  });

  sendEmail({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  }).catch(() => {
    // Fire-and-forget: swallow email errors
  });

  return NextResponse.json({ success: true });
}
