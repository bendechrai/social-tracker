"use server";

import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { getCurrentUserId } from "./users";
import { eq } from "drizzle-orm";

const VALID_TONES = ["casual", "professional", "technical", "friendly"] as const;

export type Profile = {
  role: string | null;
  company: string | null;
  goal: string | null;
  tone: string | null;
  context: string | null;
};

export async function getProfile(): Promise<Profile> {
  const userId = await getCurrentUserId();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      profileRole: true,
      profileCompany: true,
      profileGoal: true,
      profileTone: true,
      profileContext: true,
    },
  });

  return {
    role: user?.profileRole ?? null,
    company: user?.profileCompany ?? null,
    goal: user?.profileGoal ?? null,
    tone: user?.profileTone ?? null,
    context: user?.profileContext ?? null,
  };
}

export async function updateProfile(data: {
  role?: string;
  company?: string;
  goal?: string;
  tone?: string;
  context?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getCurrentUserId();

    // Validate tone
    if (data.tone !== undefined && data.tone !== "" && data.tone !== null) {
      if (!VALID_TONES.includes(data.tone as (typeof VALID_TONES)[number])) {
        return { success: false, error: "Invalid tone. Must be casual, professional, technical, or friendly" };
      }
    }

    // Trim and validate lengths
    const role = data.role !== undefined ? (data.role.trim() || null) : undefined;
    const company = data.company !== undefined ? (data.company.trim() || null) : undefined;
    const goal = data.goal !== undefined ? (data.goal.trim() || null) : undefined;
    const tone = data.tone !== undefined ? (data.tone.trim() || null) : undefined;
    const context = data.context !== undefined ? (data.context.trim() || null) : undefined;

    if (role !== undefined && role !== null && role.length > 255) {
      return { success: false, error: "Role must be 255 characters or less" };
    }
    if (company !== undefined && company !== null && company.length > 255) {
      return { success: false, error: "Company must be 255 characters or less" };
    }
    if (goal !== undefined && goal !== null && goal.length > 1000) {
      return { success: false, error: "Goal must be 1000 characters or less" };
    }
    if (context !== undefined && context !== null && context.length > 2000) {
      return { success: false, error: "Context must be 2000 characters or less" };
    }

    const updateData: Record<string, string | null | Date> = {
      updatedAt: new Date(),
    };

    if (role !== undefined) updateData.profileRole = role;
    if (company !== undefined) updateData.profileCompany = company;
    if (goal !== undefined) updateData.profileGoal = goal;
    if (tone !== undefined) updateData.profileTone = tone;
    if (context !== undefined) updateData.profileContext = context;

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return { success: false, error: "Not authenticated" };
    }
    console.error("Error updating profile:", error);
    return { success: false, error: "Failed to update profile" };
  }
}
