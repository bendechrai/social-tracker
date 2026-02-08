import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { buildVerificationEmail } from "@/lib/email-templates";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
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

  await sendEmail({
    to: user.email,
    subject: verificationEmail.subject,
    html: verificationEmail.html,
    text: verificationEmail.text,
  });

  return NextResponse.json({ success: true });
}
