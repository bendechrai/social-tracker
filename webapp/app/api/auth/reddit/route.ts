import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Reddit OAuth initiation endpoint.
 * Generates the Reddit authorization URL and redirects the user.
 *
 * Required scopes: read (for fetching posts), identity (for username)
 */
export async function GET(request: NextRequest) {
  // Require authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check required environment variables
  const clientId = process.env.REDDIT_CLIENT_ID;
  if (!clientId) {
    console.error("REDDIT_CLIENT_ID not configured");
    return NextResponse.json(
      { error: "Reddit OAuth not configured" },
      { status: 500 }
    );
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString("hex");

  // Store state in cookie for verification in callback
  const cookieStore = await cookies();
  cookieStore.set("reddit_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  // Build callback URL
  const baseUrl = request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/reddit/callback`;

  // Build Reddit authorization URL
  const authUrl = new URL("https://www.reddit.com/api/v1/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("duration", "permanent"); // Get refresh token
  authUrl.searchParams.set("scope", "read identity");

  return NextResponse.redirect(authUrl.toString());
}
