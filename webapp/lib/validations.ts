import { z } from "zod/v4";

// Color palette for tags (8 colors)
export const TAG_COLOR_PALETTE = [
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#ec4899", // pink
  "#3b82f6", // blue
] as const;

// Subreddit name validation
// - 3-21 characters
// - Alphanumeric + underscore only
// - Strips r/ prefix and lowercases
export const subredditNameSchema = z
  .string()
  .min(1, "Subreddit name is required")
  .transform((val) => {
    // Strip r/ prefix if present
    const stripped = val.replace(/^r\//i, "");
    return stripped.toLowerCase();
  })
  .pipe(
    z
      .string()
      .min(3, "Subreddit name must be at least 3 characters")
      .max(21, "Subreddit name must be at most 21 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Subreddit name can only contain letters, numbers, and underscores"
      )
  );

// Tag schema
export const tagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(100, "Tag name must be at most 100 characters"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional()
    .default(TAG_COLOR_PALETTE[0]),
});

// Search term schema - normalized to lowercase for case-insensitive matching
export const searchTermSchema = z
  .string()
  .min(1, "Search term is required")
  .max(255, "Search term must be at most 255 characters")
  .transform((val) => val.toLowerCase());

// Post status enum
export const postStatusSchema = z.enum(["new", "ignored", "done"]);

// Suggest terms request schema
export const suggestTermsSchema = z.object({
  tagName: z
    .string()
    .min(1, "Tag name is required")
    .max(100, "Tag name must be at most 100 characters"),
});

// Helper to get the next color from palette
export function getNextTagColor(existingColors: string[]): string {
  const usedColors = new Set(existingColors);
  for (const color of TAG_COLOR_PALETTE) {
    if (!usedColors.has(color)) {
      return color;
    }
  }
  // If all colors used, cycle back to first
  return TAG_COLOR_PALETTE[0];
}

// Password validation schema
// Requirements: 12+ chars, uppercase, lowercase, number, symbol
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .refine((val) => /[A-Z]/.test(val), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((val) => /[0-9]/.test(val), {
    message: "Password must contain at least one number",
  })
  .refine((val) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val), {
    message: "Password must contain at least one symbol (!@#$%^&*()_+-=[]{}';:\"\\|,.<>/?)",
  });

// Email validation schema
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .max(255, "Email must be at most 255 characters");

// Type exports
export type PostStatus = z.infer<typeof postStatusSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type SuggestTermsInput = z.infer<typeof suggestTermsSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
