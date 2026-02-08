import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifySignedToken } from "@/lib/tokens";
import aj from "@/lib/arcjet";
import { slidingWindow } from "@arcjet/next";

const verifyEmailAj = aj.withRule(
  slidingWindow({ mode: "LIVE", interval: "1m", max: 5 })
);

export async function GET(request: NextRequest) {
  // Arcjet rate limit check
  const decision = await verifyEmailAj.protect(request);
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.redirect(
        new URL("/dashboard?verify_error=true", request.url)
      );
    }
    return NextResponse.redirect(
      new URL("/dashboard?verify_error=true", request.url)
    );
  }

  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/dashboard?verify_error=true", request.url)
    );
  }

  const verified = verifySignedToken(token);
  if (!verified) {
    return NextResponse.redirect(
      new URL("/dashboard?verify_error=true", request.url)
    );
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, verified.userId));

  return NextResponse.redirect(
    new URL("/dashboard?verified=true", request.url)
  );
}
