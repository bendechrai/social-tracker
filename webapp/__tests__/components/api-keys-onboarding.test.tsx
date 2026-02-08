/**
 * Unit tests for the API keys settings onboarding wizard (Step 3).
 *
 * Verifies acceptance criteria from welcome-wizard.md:
 * - Overlay shown when ?onboarding=3 query param is present
 * - Overlay hidden when ?onboarding=3 is not present
 * - Both "Skip" and "Next" buttons navigate to /settings/tags?onboarding=4
 * - Groq console link is shown in overlay
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
  useHasGroqApiKey: () => ({ data: false, isLoading: false }),
  useGroqApiKeyHint: () => ({ data: null, isLoading: false }),
  useSaveGroqApiKey: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  useDeleteGroqApiKey: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
}));

import ApiKeysPage from "@/app/settings/api-keys/page";

describe("API keys settings onboarding (Step 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
  });

  it("shows onboarding overlay when ?onboarding=3", () => {
    mockSearchParams = { onboarding: "3" };

    render(<ApiKeysPage />);

    expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
    expect(
      screen.getByText("AI-Powered Suggestions (Optional)")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add a Groq API key to enable AI-generated response suggestions for posts. This is free and optional — you can always add it later in settings."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
  });

  it("does not show onboarding overlay without ?onboarding=3", () => {
    mockSearchParams = {};

    render(<ApiKeysPage />);

    expect(
      screen.queryByTestId("onboarding-overlay")
    ).not.toBeInTheDocument();
  });

  it("shows Groq console link in overlay", () => {
    mockSearchParams = { onboarding: "3" };

    render(<ApiKeysPage />);

    const link = screen.getByText("Get a free API key at console.groq.com");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://console.groq.com"
    );
  });

  it("Skip button navigates to /settings/tags?onboarding=4", async () => {
    const user = userEvent.setup();
    mockSearchParams = { onboarding: "3" };

    render(<ApiKeysPage />);

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/settings/tags?onboarding=4"
    );
  });

  it("Next button navigates to /settings/tags?onboarding=4", async () => {
    const user = userEvent.setup();
    mockSearchParams = { onboarding: "3" };

    render(<ApiKeysPage />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/settings/tags?onboarding=4"
    );
  });
});
