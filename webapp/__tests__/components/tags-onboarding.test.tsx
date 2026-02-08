/**
 * Unit tests for the tag settings onboarding wizard (Step 4).
 *
 * Verifies acceptance criteria from welcome-wizard.md:
 * - Overlay shown when ?onboarding=4 query param is present
 * - Overlay hidden when ?onboarding=4 is not present
 * - Tag explanation with example is shown
 * - Both "Skip" and "Done" buttons navigate to /dashboard
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockSearchParams: Record<string, string> = {};
const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams[key] ?? null,
  }),
}));

// Mock hooks
vi.mock("@/lib/hooks", () => ({
  useTags: () => ({ data: [], isLoading: false }),
  useHasGroqApiKey: () => ({ data: false, isLoading: false }),
  useCreateTag: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  useUpdateTag: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  useDeleteTag: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  useAddSearchTerm: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  useRemoveSearchTerm: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
}));

import TagsSettingsPage from "@/app/settings/tags/page";

describe("Tag settings onboarding (Step 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
  });

  it("shows onboarding overlay when ?onboarding=4", () => {
    mockSearchParams = { onboarding: "4" };

    render(<TagsSettingsPage />);

    expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
    expect(screen.getByText("Organize with Tags")).toBeInTheDocument();
    expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();
  });

  it("does not show onboarding overlay without ?onboarding=4", () => {
    mockSearchParams = {};

    render(<TagsSettingsPage />);

    expect(
      screen.queryByTestId("onboarding-overlay")
    ).not.toBeInTheDocument();
  });

  it("shows tag explanation with example in overlay", () => {
    mockSearchParams = { onboarding: "4" };

    render(<TagsSettingsPage />);

    expect(
      screen.getByText(/tags help you categorize posts/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Performance/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/slow.*latency.*benchmark/i)
    ).toBeInTheDocument();
  });

  it("Skip button navigates to /dashboard", async () => {
    const user = userEvent.setup();
    mockSearchParams = { onboarding: "4" };

    render(<TagsSettingsPage />);

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
  });

  it("Done button navigates to /dashboard", async () => {
    const user = userEvent.setup();
    mockSearchParams = { onboarding: "4" };

    render(<TagsSettingsPage />);

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
  });
});
