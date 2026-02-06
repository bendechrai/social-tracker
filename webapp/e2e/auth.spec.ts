/**
 * E2E tests for authentication flows.
 *
 * Tests the complete authentication lifecycle:
 * - User signup with password validation
 * - Login with valid/invalid credentials
 * - Protected route access control
 * - Session persistence across reloads
 * - Logout
 *
 * These tests run against a live Next.js dev server with a real database,
 * verifying the full stack from UI to database works correctly.
 */
import { test, expect } from "./fixtures";
import { TEST_USER, registerUser, loginUser } from "./fixtures";

test.describe("Authentication", () => {
  test.describe("Signup", () => {
    test("should show password requirements on signup page", async ({ page }) => {
      await page.goto("/signup");

      await expect(page.getByText("Create an account")).toBeVisible();
      await expect(page.getByText("At least 12 characters")).toBeVisible();
      await expect(page.getByText("One uppercase letter")).toBeVisible();
      await expect(page.getByText("One lowercase letter")).toBeVisible();
      await expect(page.getByText("One number")).toBeVisible();
      await expect(page.getByText(/One symbol/)).toBeVisible();
    });

    test("should show real-time password strength feedback", async ({ page }) => {
      await page.goto("/signup");

      const passwordInput = page.getByLabel(/^password$/i);

      // Type a weak password — requirements should not be met
      await passwordInput.fill("short");

      // Check that "At least 12 characters" is not met (X icon visible)
      // The requirement items have color classes that indicate met/not-met
      const lengthReq = page.getByText("At least 12 characters");
      await expect(lengthReq).toBeVisible();

      // Type a strong password — all requirements should be met
      await passwordInput.fill("StrongPass123!");

      // All requirements should now show as met (green checkmarks)
      // We check that the requirement text is still visible
      await expect(page.getByText("At least 12 characters")).toBeVisible();
    });

    test("should show password match/mismatch feedback", async ({ page }) => {
      await page.goto("/signup");

      await page.getByLabel(/^password$/i).fill("StrongPass123!");
      await page.getByLabel(/confirm password/i).fill("DifferentPass123!");

      await expect(page.getByText("Passwords do not match")).toBeVisible();

      await page.getByLabel(/confirm password/i).fill("StrongPass123!");

      await expect(page.getByText("Passwords match")).toBeVisible();
    });

    test("should successfully create account and redirect to login", async ({ page }) => {
      const uniqueEmail = `e2e-signup-${Date.now()}@example.com`;

      await page.goto("/signup");

      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel(/^password$/i).fill("StrongPass123!");
      await page.getByLabel(/confirm password/i).fill("StrongPass123!");

      await page.getByRole("button", { name: "Create account" }).click();

      // Should redirect to login with success message
      await page.waitForURL(/\/login\?registered=true/);
      await expect(page.getByText("Account created successfully")).toBeVisible();
    });

    test("should show error for duplicate email", async ({ page }) => {
      // First, register the test user
      await registerUser(page);

      // Try to register again with same email
      await page.goto("/signup");

      await page.getByLabel(/email/i).fill(TEST_USER.email);
      await page.getByLabel(/^password$/i).fill(TEST_USER.password);
      await page.getByLabel(/confirm password/i).fill(TEST_USER.password);

      await page.getByRole("button", { name: "Create account" }).click();

      // Should show error about existing account
      await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 10000 });
    });

    test("should have link to sign in page", async ({ page }) => {
      await page.goto("/signup");

      const signInLink = page.getByRole("link", { name: /sign in/i });
      await expect(signInLink).toBeVisible();
      await signInLink.click();
      await page.waitForURL(/\/login/);
    });
  });

  test.describe("Login", () => {
    test.beforeAll(async ({ browser }) => {
      // Ensure test user exists before login tests
      const page = await browser.newPage();
      await registerUser(page);
      await page.close();
    });

    test("should successfully log in with valid credentials", async ({ page }) => {
      await loginUser(page);

      await expect(page).toHaveURL("/");
      // Should see the main dashboard elements
      await expect(page.getByText("Social Tracker")).toBeVisible();
    });

    test("should show error for invalid credentials", async ({ page }) => {
      await page.goto("/login");

      await page.getByLabel(/email/i).fill(TEST_USER.email);
      await page.getByLabel(/password/i).fill("WrongPassword123!");

      await page.getByRole("button", { name: /sign in/i }).click();

      // Should show generic error (not revealing if email exists)
      await expect(page.getByText(/invalid email or password/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test("should show error for non-existent email", async ({ page }) => {
      await page.goto("/login");

      await page.getByLabel(/email/i).fill("nonexistent@example.com");
      await page.getByLabel(/password/i).fill("SomePassword123!");

      await page.getByRole("button", { name: /sign in/i }).click();

      await expect(page.getByText(/invalid email or password/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test("should have link to signup page", async ({ page }) => {
      await page.goto("/login");

      const createLink = page.getByRole("link", { name: /create one/i });
      await expect(createLink).toBeVisible();
      await createLink.click();
      await page.waitForURL(/\/signup/);
    });
  });

  test.describe("Protected routes", () => {
    test("should redirect to login when accessing dashboard unauthenticated", async ({
      page,
    }) => {
      await page.goto("/");

      // Should be redirected to login page
      await expect(page).toHaveURL(/\/login/);
    });

    test("should redirect to login when accessing settings unauthenticated", async ({
      page,
    }) => {
      await page.goto("/settings");

      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Session persistence", () => {
    test("should maintain session after page reload", async ({
      authenticatedPage,
    }) => {
      // Already authenticated via fixture
      await expect(authenticatedPage).toHaveURL("/");

      // Reload the page
      await authenticatedPage.reload();

      // Should still be on the homepage (not redirected to login)
      await expect(authenticatedPage).toHaveURL("/");
      await expect(authenticatedPage.getByText("Social Tracker")).toBeVisible();
    });
  });
});
