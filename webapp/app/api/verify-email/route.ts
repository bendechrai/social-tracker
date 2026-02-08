import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifySignedToken } from "@/lib/tokens";

export async function GET(request: NextRequest) {
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
