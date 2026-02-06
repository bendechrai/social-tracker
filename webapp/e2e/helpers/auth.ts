/**
 * Authentication helper utilities for E2E tests.
 *
 * Provides convenience functions for common auth operations
 * used across multiple test files.
 */
import { type Page, expect } from "@playwright/test";
import { TEST_USER } from "../fixtures";

/**
 * Verifies the user is currently logged in by checking for
 * authenticated UI elements (user menu).
 */
export async function assertLoggedIn(page: Page) {
  // The user menu or email should be visible when logged in
  await expect(page.getByText(TEST_USER.email).or(
    page.getByRole("button", { name: /user|account|menu/i })
  )).toBeVisible({ timeout: 5000 });
}

/**
 * Verifies the user is currently logged out by checking
 * they're redirected to the login page.
 */
export async function assertLoggedOut(page: Page) {
  await expect(page).toHaveURL(/\/login/);
}

/**
 * Logs out the current user via the UI.
 */
export async function logout(page: Page) {
  // Click user menu to reveal logout option
  const userMenu = page.getByRole("button", { name: /user|account|menu/i });
  if (await userMenu.isVisible()) {
    await userMenu.click();
    await page.getByText(/log out|sign out/i).click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
  }
}

/**
 * Generates a strong password meeting all requirements:
 * 12+ chars, uppercase, lowercase, number, symbol
 */
export function generateStrongPassword(): string {
  return `Test${Date.now()}!Aa1`;
}
