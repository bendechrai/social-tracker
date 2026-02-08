import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifySignedToken } from "@/lib/tokens";
import aj, { ajMode } from "@/lib/arcjet";
import { slidingWindow } from "@arcjet/next";

const verifyEmailAj = aj.withRule(
  slidingWindow({ mode: ajMode, interval: "1m", max: 5 })
);

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.url;

  // Arcjet rate limit check
  const decision = await verifyEmailAj.protect(request);
  if (decision.isDenied()) {
    return NextResponse.redirect(
      new URL("/dashboard?verify_error=true", appUrl)
    );
  }

  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/dashboard?verify_error=true", appUrl)
    );
  }

  const verified = verifySignedToken(token);
  if (!verified) {
    return NextResponse.redirect(
      new URL("/dashboard?verify_error=true", appUrl)
    );
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, verified.userId));

  return NextResponse.redirect(
    new URL("/dashboard?verified=true", appUrl)
  );
}
