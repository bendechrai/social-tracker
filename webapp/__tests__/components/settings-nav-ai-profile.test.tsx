/**
 * Unit test for settings sidebar navigation AI Profile link.
 *
 * Verifies acceptance criteria from ai-assistant-improvements.md:
 * - "AI Profile" nav item appears after "API Keys" and before "Subreddits"
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/ai-profile",
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
  it("contains 'AI Profile' link between 'API Keys' and 'Subreddits'", () => {
    render(
      <SettingsLayout>
        <div>content</div>
      </SettingsLayout>
    );

    const links = screen.getAllByRole("link");
    const labels = links.map((l) => l.textContent);

    const apiKeysIndex = labels.findIndex((l) => l?.includes("API Keys"));
    const aiProfileIndex = labels.findIndex((l) => l?.includes("AI Profile"));
    const subredditsIndex = labels.findIndex((l) => l?.includes("Subreddits"));

    expect(apiKeysIndex).toBeGreaterThan(-1);
    expect(aiProfileIndex).toBeGreaterThan(-1);
    expect(subredditsIndex).toBeGreaterThan(-1);

    // AI Profile comes after API Keys
    expect(aiProfileIndex).toBeGreaterThan(apiKeysIndex);
    // AI Profile comes before Subreddits
    expect(aiProfileIndex).toBeLessThan(subredditsIndex);
  });
});
