"use server";

import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordSchema, emailSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { buildWelcomeEmail } from "@/lib/email-templates";

export type SignupResult = {
  success: boolean;
  error?: string;
};

export type ChangePasswordResult = {
  success: boolean;
  error?: string;
};

/**
 * Creates a new user account with email and password.
 * Password is hashed using bcrypt with cost factor 12.
 */
export async function signup(
  email: string,
  password: string,
  confirmPassword: string
): Promise<SignupResult> {
  // Validate passwords match
  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match" };
  }

  // Validate email format
  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    return { success: false, error: emailResult.error.issues[0]?.message ?? "Invalid email" };
  }

  // Validate password requirements
  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    return { success: false, error: passwordResult.error.issues[0]?.message ?? "Invalid password" };
  }

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existingUser) {
    return { success: false, error: "An account with this email already exists" };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const [newUser] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
  }).returning({ id: users.id });

  // Send welcome email fire-and-forget (do not block signup)
  if (newUser) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const welcomeEmail = buildWelcomeEmail({ userId: newUser.id, appUrl });
    sendEmail({
      to: email.toLowerCase(),
      subject: welcomeEmail.subject,
      html: welcomeEmail.html,
      text: welcomeEmail.text,
    }).catch(() => {
      // Intentionally swallowed — welcome email failure must not affect signup
    });
  }

  return { success: true };
}

/**
 * Changes the current user's password.
 * Validates current password before allowing change.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<ChangePasswordResult> {
  // Get current session
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate new passwords match
  if (newPassword !== confirmNewPassword) {
    return { success: false, error: "New passwords do not match" };
  }

  // Validate new password requirements
  const passwordResult = passwordSchema.safeParse(newPassword);
  if (!passwordResult.success) {
    return { success: false, error: passwordResult.error.issues[0]?.message ?? "Invalid password" };
  }

  // Get user from database
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user || !user.passwordHash) {
    return { success: false, error: "User not found or no password set" };
  }

  // Verify current password
  const isValidCurrentPassword = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValidCurrentPassword) {
    return { success: false, error: "Current password is incorrect" };
  }

  // Don't allow same password
  if (currentPassword === newPassword) {
    return { success: false, error: "New password must be different from current password" };
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update password
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return { success: true };
}
