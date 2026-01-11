"use server";

import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { encrypt, decrypt } from "@/lib/encryption";
import { getCurrentUserId } from "./users";
import { eq } from "drizzle-orm";

export type ApiKeyResult = {
  success: boolean;
  error?: string;
};

/**
 * Saves the user's Groq API key (encrypted).
 * The key is encrypted using AES-256-GCM before storage.
 */
export async function saveGroqApiKey(key: string): Promise<ApiKeyResult> {
  try {
    const userId = await getCurrentUserId();

    // Basic validation - Groq API keys start with "gsk_"
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return { success: false, error: "API key cannot be empty" };
    }
    if (!trimmedKey.startsWith("gsk_")) {
      return { success: false, error: "Invalid Groq API key format. Keys should start with 'gsk_'" };
    }
    if (trimmedKey.length < 20) {
      return { success: false, error: "API key appears to be too short" };
    }

    // Encrypt the key
    const encryptedKey = encrypt(trimmedKey);

    // Update the user record
    await db
      .update(users)
      .set({
        groqApiKey: encryptedKey,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return { success: false, error: "Not authenticated" };
    }
    console.error("Error saving Groq API key:", error);
    return { success: false, error: "Failed to save API key" };
  }
}

/**
 * Checks if the user has a Groq API key configured.
 * Returns a boolean indicating whether a key is stored.
 */
export async function hasGroqApiKey(): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { groqApiKey: true },
    });

    return !!user?.groqApiKey;
  } catch {
    return false;
  }
}

/**
 * Gets the last 4 characters of the user's Groq API key for display.
 * Returns null if no key is configured.
 */
export async function getGroqApiKeyHint(): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { groqApiKey: true },
    });

    if (!user?.groqApiKey) {
      return null;
    }

    // Decrypt the key to get the last 4 characters
    const decryptedKey = decrypt(user.groqApiKey);
    return decryptedKey.slice(-4);
  } catch {
    return null;
  }
}

/**
 * Gets the user's decrypted Groq API key.
 * This is for internal use only (e.g., by the suggest-terms API).
 * Returns null if no key is configured.
 */
export async function getGroqApiKey(): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { groqApiKey: true },
    });

    if (!user?.groqApiKey) {
      return null;
    }

    return decrypt(user.groqApiKey);
  } catch {
    return null;
  }
}

/**
 * Deletes the user's Groq API key.
 */
export async function deleteGroqApiKey(): Promise<ApiKeyResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(users)
      .set({
        groqApiKey: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return { success: false, error: "Not authenticated" };
    }
    console.error("Error deleting Groq API key:", error);
    return { success: false, error: "Failed to delete API key" };
  }
}
