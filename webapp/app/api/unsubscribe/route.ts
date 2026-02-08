import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { verifySignedToken } from "@/lib/tokens";
import aj from "@/lib/arcjet";
import { slidingWindow } from "@arcjet/next";

const unsubscribeAj = aj.withRule(
  slidingWindow({ mode: "LIVE", interval: "1m", max: 5 })
);

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(
      renderPage("Invalid Link", "This unsubscribe link is missing a token."),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const verified = verifySignedToken(token);
  if (!verified) {
    return new NextResponse(
      renderPage(
        "Invalid Link",
        "This unsubscribe link is invalid or has expired."
      ),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(
    renderPage(
      "Unsubscribe from Email Notifications",
      `<p>Click the button below to unsubscribe from email notifications.</p>
       <form method="POST" action="/api/unsubscribe?token=${encodeURIComponent(token)}">
         <button type="submit" style="background:#dc2626;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:16px;cursor:pointer;">Unsubscribe</button>
       </form>
       <p style="margin-top:24px;">Or <a href="/settings/account">manage your notification preferences</a> in settings.</p>`
    ),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function renderPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Social Tracker</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 480px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  // Arcjet rate limit check
  const decision = await unsubscribeAj.protect(request);
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
