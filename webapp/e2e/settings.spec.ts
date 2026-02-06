/**
 * E2E tests for settings pages.
 *
 * Tests the settings functionality:
 * - Account settings (password change)
 * - API Keys management (Groq key add/remove)
 * - Navigation between settings sections
 *
 * Uses authenticated page fixture for all tests.
 */
import { test, expect } from "./fixtures";

test.describe("Settings", () => {
  test.describe("Navigation", () => {
    test("should navigate to settings page", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/settings");

      // Should see settings layout with sidebar
      await expect(page.getByText(/account/i)).toBeVisible();
      await expect(page.getByText(/api keys/i)).toBeVisible();
    });

    test("should navigate between settings sections", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/settings");

      // Click on API Keys section
      await page.getByRole("link", { name: /api keys/i }).click();
      await page.waitForURL(/\/settings\/api-keys/);

      // Click on Account section
      await page.getByRole("link", { name: /account/i }).click();
      await page.waitForURL(/\/settings\/account/);
    });
  });

  test.describe("Account Settings", () => {
    test("should display password change form", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/settings/account");

      await expect(page.getByText(/change password|password/i).first()).toBeVisible();
      await expect(page.getByLabel(/current password/i)).toBeVisible();
      await expect(page.getByLabel(/new password/i).first()).toBeVisible();
      await expect(page.getByLabel(/confirm/i)).toBeVisible();
    });

    test("should reject password change with wrong current password", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/settings/account");

      await page.getByLabel(/current password/i).fill("WrongCurrent123!");
      await page.getByLabel(/new password/i).first().fill("NewPassword123!!");
      await page.getByLabel(/confirm/i).fill("NewPassword123!!");

      await page.getByRole("button", { name: /change password|update/i }).click();

      await expect(page.getByText(/incorrect|wrong|invalid/i)).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("API Keys Settings", () => {
    test("should display Groq API key management", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/settings/api-keys");

      await expect(page.getByText(/groq/i).first()).toBeVisible();
    });
  });
});
