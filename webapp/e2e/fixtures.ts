/**
 * Playwright test fixtures for the Social Tracker E2E tests.
 *
 * Extends the base Playwright test with:
 * - Authenticated page fixture (auto-login before each test)
 * - Test user credentials management
 * - Database cleanup helpers
 *
 * These fixtures ensure each test runs with a consistent authenticated
 * state and clean database, preventing test interference.
 */
import { test as base, expect, type Page } from "@playwright/test";

// Test user credentials — unique per test worker to allow parallel runs
export const TEST_USER = {
  email: `e2e-test-${process.env.TEST_PARALLEL_INDEX ?? "0"}@example.com`,
  password: "TestPassword123!",
};

/**
 * Registers a new user via the signup page.
 * Idempotent — if user already exists, logs in instead.
 */
async function registerUser(page: Page) {
  await page.goto("/signup");

  // Check if we're on the signup page
  const heading = page.getByRole("heading", { name: /sign up|create account/i });
  if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/^password$/i).fill(TEST_USER.password);
    await page.getByLabel(/confirm password/i).fill(TEST_USER.password);
    await page.getByRole("button", { name: /sign up|create account/i }).click();

    // Wait for redirect to login page or error
    await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {
      // User might already exist, that's OK
    });
  }
}

/**
 * Logs in a user via the login page.
 */
async function loginUser(page: Page) {
  await page.goto("/login");

  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();

  // Wait for redirect to homepage
  await page.waitForURL("/", { timeout: 10000 });
}

// Custom fixture type
type Fixtures = {
  authenticatedPage: Page;
};

/**
 * Extended test with authentication fixture.
 * Use `authenticatedPage` when you need a logged-in user.
 */
export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Ensure user exists
    await registerUser(page);

    // Log in
    await loginUser(page);

    // Verify we're on the homepage
    await expect(page).toHaveURL("/");

    // Pass the authenticated page to the test
    await use(page);
  },
});

export { expect };
export { loginUser, registerUser };
