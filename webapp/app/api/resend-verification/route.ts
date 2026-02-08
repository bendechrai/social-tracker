import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { buildVerificationEmail } from "@/lib/email-templates";
import aj from "@/lib/arcjet";
import { slidingWindow } from "@arcjet/next";

const resendAj = aj.withRule(
  slidingWindow({ mode: "LIVE", interval: "5m", max: 1, characteristics: ["userId"] })
);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Arcjet rate limit check
  const decision = await resendAj.protect(request, { userId: session.user.id });
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { emailVerified: true, email: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  if (user.emailVerified) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verificationEmail = buildVerificationEmail({
    userId: session.user.id,
    appUrl,
  });

  const result = await sendEmail({
    to: user.email,
    subject: verificationEmail.subject,
    html: verificationEmail.html,
    text: verificationEmail.text,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
