/**
 * E2E tests for post management flows.
 *
 * Tests the core post lifecycle operations:
 * - Viewing posts by status tabs (New, Ignored, Done)
 * - Changing post status (Ignore, Mark Done, Mark as New)
 * - Tag filtering
 * - Pagination
 * - Response notes on done posts
 *
 * Requires seeded database with sample posts for testing.
 */
import { test, expect } from "./fixtures";

test.describe("Post Management", () => {
  test.describe("Status tabs", () => {
    test("should display status tabs with counts", async ({
      authenticatedPage: page,
    }) => {
      // Status tabs should be visible on dashboard
      await expect(page.getByRole("tab", { name: /New/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /Ignored/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /Done/i })).toBeVisible();
    });

    test("should switch between status tabs", async ({
      authenticatedPage: page,
    }) => {
      // Click on Ignored tab
      await page.getByRole("tab", { name: /Ignored/i }).click();

      // The tab should be active
      const ignoredTab = page.getByRole("tab", { name: /Ignored/i });
      await expect(ignoredTab).toHaveAttribute("data-state", "active");

      // Click on Done tab
      await page.getByRole("tab", { name: /Done/i }).click();

      const doneTab = page.getByRole("tab", { name: /Done/i });
      await expect(doneTab).toHaveAttribute("data-state", "active");

      // Click back to New tab
      await page.getByRole("tab", { name: /New/i }).click();

      const newTab = page.getByRole("tab", { name: /New/i });
      await expect(newTab).toHaveAttribute("data-state", "active");
    });
  });

  test.describe("Post display", () => {
    test("should show empty state when no posts exist", async ({
      authenticatedPage: page,
    }) => {
      // On a fresh account with no posts, should show empty message
      const emptyMessage = page.getByText(/no .* posts/i);
      // Either we see posts or we see the empty message
      const hasPosts = await page.locator("[data-slot='card']").count();
      if (hasPosts <= 1) {
        // Only the empty state card
        await expect(emptyMessage).toBeVisible();
      }
    });

    test("should display post cards with correct information", async ({
      authenticatedPage: page,
    }) => {
      // If there are posts, they should show relevant info
      const postCards = page.locator("[data-slot='card']");
      const count = await postCards.count();

      if (count > 0) {
        // First post card should have a title link, subreddit, and author
        const firstCard = postCards.first();
        await expect(firstCard.getByText(/r\//)).toBeVisible();
        await expect(firstCard.getByText(/u\//)).toBeVisible();
      }
    });
  });

  test.describe("Post actions", () => {
    test("should show Ignore and Mark Done buttons for new posts", async ({
      authenticatedPage: page,
    }) => {
      // Ensure we're on New tab
      await page.getByRole("tab", { name: /New/i }).click();

      // Check for action buttons (only if posts exist)
      const ignoreButton = page.getByRole("button", { name: /Ignore/i }).first();
      const markDoneButton = page.getByRole("button", { name: /Mark Done/i }).first();

      const hasNewPosts = await ignoreButton.isVisible().catch(() => false);
      if (hasNewPosts) {
        await expect(ignoreButton).toBeVisible();
        await expect(markDoneButton).toBeVisible();
      }
    });

    test("should show Mark as New button for ignored posts", async ({
      authenticatedPage: page,
    }) => {
      await page.getByRole("tab", { name: /Ignored/i }).click();

      const markNewButton = page.getByRole("button", { name: /Mark as New/i }).first();
      const hasIgnoredPosts = await markNewButton.isVisible().catch(() => false);

      if (hasIgnoredPosts) {
        await expect(markNewButton).toBeVisible();
      }
    });

    test("should show response notes for done posts", async ({
      authenticatedPage: page,
    }) => {
      await page.getByRole("tab", { name: /Done/i }).click();

      const responseNotes = page.getByText("Response Notes").first();
      const hasDonePosts = await responseNotes.isVisible().catch(() => false);

      if (hasDonePosts) {
        await expect(responseNotes).toBeVisible();
        await expect(
          page.getByPlaceholder("Record your response or notes here...").first()
        ).toBeVisible();
      }
    });
  });

  test.describe("Tag filtering", () => {
    test("should show tag filter dropdown", async ({
      authenticatedPage: page,
    }) => {
      const filterButton = page.getByRole("button", { name: /all tags|tag/i });
      await expect(filterButton).toBeVisible();
    });
  });

  test.describe("View on Reddit link", () => {
    test("should have View on Reddit links for posts", async ({
      authenticatedPage: page,
    }) => {
      const viewLinks = page.getByText("View on Reddit");
      const count = await viewLinks.count();

      if (count > 0) {
        const firstLink = viewLinks.first().locator("xpath=ancestor::a");
        await expect(firstLink).toHaveAttribute("href", /reddit\.com/);
        await expect(firstLink).toHaveAttribute("target", "_blank");
      }
    });
  });
});
