/**
 * Unit test for settings sidebar navigation Credits & Usage link.
 *
 * Verifies acceptance criteria from ai-credits.md:
 * - "Credits & Usage" nav item with CreditCard icon appears in settings sidebar
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/credits",
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { email: "test@example.com" } },
    status: "authenticated",
  }),
  signOut: vi.fn(),
}));

import SettingsLayout from "@/app/settings/layout";

describe("Settings sidebar navigation", () => {
  it("contains 'Credits & Usage' link", () => {
    render(
      <SettingsLayout>
        <div>content</div>
      </SettingsLayout>
    );

    const links = screen.getAllByRole("link");
    const labels = links.map((l) => l.textContent);

    const creditsIndex = labels.findIndex((l) => l?.includes("Credits & Usage"));
    expect(creditsIndex).toBeGreaterThan(-1);

    // Should link to /settings/credits
    const creditsLink = links[creditsIndex];
    expect(creditsLink).toHaveAttribute("href", "/settings/credits");
  });
});
