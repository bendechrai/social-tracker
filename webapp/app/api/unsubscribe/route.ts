import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifySignedToken } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing token" },
      { status: 400 }
    );
  }

  const verified = verifySignedToken(token);
  if (!verified) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ emailNotifications: false })
    .where(eq(users.id, verified.userId));

  return NextResponse.json({ success: true });
}
