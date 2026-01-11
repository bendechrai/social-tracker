import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { encrypt } from "@/lib/encryption";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface RedditUserResponse {
  name: string;
  id: string;
}

/**
 * Reddit OAuth callback endpoint.
 * Handles the authorization callback from Reddit, exchanges the code for tokens,
 * and stores them encrypted in the user's record.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Build redirect URLs
  const baseUrl = request.nextUrl.origin;
  const settingsUrl = `${baseUrl}/settings/connected-accounts`;
  const errorUrl = (message: string) =>
    `${settingsUrl}?error=${encodeURIComponent(message)}`;
  const successUrl = `${settingsUrl}?success=reddit`;

  // Handle user denial or error from Reddit
  if (error) {
    console.error("Reddit OAuth error:", error);
    return NextResponse.redirect(
      errorUrl(error === "access_denied" ? "Authorization was denied" : error)
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(errorUrl("Missing authorization code or state"));
  }

  // Verify CSRF state token
  const cookieStore = await cookies();
  const storedState = cookieStore.get("reddit_oauth_state")?.value;
  cookieStore.delete("reddit_oauth_state");

  if (!storedState || storedState !== state) {
    console.error("Reddit OAuth state mismatch");
    return NextResponse.redirect(errorUrl("Invalid state parameter"));
  }

  // Require authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(errorUrl("Not authenticated"));
  }

  // Check required environment variables
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Reddit OAuth credentials not configured");
    return NextResponse.redirect(errorUrl("Reddit OAuth not configured"));
  }

  const redirectUri = `${baseUrl}/api/auth/reddit/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SocialTracker/1.0",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Reddit token exchange failed:", tokenResponse.status, errorText);
      return NextResponse.redirect(errorUrl("Failed to exchange authorization code"));
    }

    const tokenData = (await tokenResponse.json()) as RedditTokenResponse;

    // Fetch Reddit username using the identity scope
    const userResponse = await fetch("https://oauth.reddit.com/api/v1/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "SocialTracker/1.0",
      },
    });

    if (!userResponse.ok) {
      console.error("Failed to fetch Reddit user info:", userResponse.status);
      return NextResponse.redirect(errorUrl("Failed to get Reddit user info"));
    }

    const userData = (await userResponse.json()) as RedditUserResponse;

    // Calculate token expiration time
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Encrypt tokens before storage
    const encryptedAccessToken = encrypt(tokenData.access_token);
    const encryptedRefreshToken = encrypt(tokenData.refresh_token);

    // Store encrypted tokens and username in database
    await db
      .update(users)
      .set({
        redditAccessToken: encryptedAccessToken,
        redditRefreshToken: encryptedRefreshToken,
        redditTokenExpiresAt: expiresAt,
        redditUsername: userData.name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("Reddit OAuth callback error:", error);
    return NextResponse.redirect(errorUrl("An error occurred during authorization"));
  }
}
