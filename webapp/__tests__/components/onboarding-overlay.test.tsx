/**
 * Unit tests for the OnboardingOverlay component.
 *
 * Verifies acceptance criteria from welcome-wizard.md:
 * - Renders with correct heading and description
 * - Shows step progress indicator (e.g., "Step 2 of 4")
 * - Conditional rendering based on ?onboarding query param
 * - Step 1 renders without query param
 * - Action buttons render and fire callbacks
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let mockSearchParams: Record<string, string> = {};

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams[key] ?? null,
  }),
}));

import { OnboardingOverlay } from "@/components/onboarding-overlay";

describe("OnboardingOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
  });

  it("renders with correct heading and description", () => {
    render(
      <OnboardingOverlay
        step={1}
        totalSteps={4}
        heading="Welcome to Social Tracker"
        description="Track Reddit posts across subreddits."
        actions={[]}
      />
    );
    expect(screen.getByText("Welcome to Social Tracker")).toBeInTheDocument();
    expect(
      screen.getByText("Track Reddit posts across subreddits.")
    ).toBeInTheDocument();
  });

  it("shows step progress indicator", () => {
    render(
      <OnboardingOverlay
        step={2}
        totalSteps={4}
        heading="Add a Subreddit"
        description="Add at least one subreddit."
        actions={[]}
      />
    );
    // Step 2 requires query param to render
    expect(screen.queryByText("Step 2 of 4")).not.toBeInTheDocument();

    mockSearchParams = { onboarding: "2" };
    const { unmount } = render(
      <OnboardingOverlay
        step={2}
        totalSteps={4}
        heading="Add a Subreddit"
        description="Add at least one subreddit."
        actions={[]}
      />
    );
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    unmount();
  });

  it("renders step 1 without query param", () => {
    mockSearchParams = {};
    render(
      <OnboardingOverlay
        step={1}
        totalSteps={4}
        heading="Welcome"
        description="Let's get started."
        actions={[]}
      />
    );
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
  });

  it("does not render step 2 without matching query param", () => {
    mockSearchParams = {};
    render(
      <OnboardingOverlay
        step={2}
        totalSteps={4}
        heading="Add a Subreddit"
        description="Add at least one."
        actions={[]}
      />
    );
    expect(screen.queryByTestId("onboarding-overlay")).not.toBeInTheDocument();
  });

  it("does not render step 3 when query param is 2", () => {
    mockSearchParams = { onboarding: "2" };
    render(
      <OnboardingOverlay
        step={3}
        totalSteps={4}
        heading="API Keys"
        description="Add a Groq key."
        actions={[]}
      />
    );
    expect(screen.queryByTestId("onboarding-overlay")).not.toBeInTheDocument();
  });

  it("renders step 2 when query param matches", () => {
    mockSearchParams = { onboarding: "2" };
    render(
      <OnboardingOverlay
        step={2}
        totalSteps={4}
        heading="Add a Subreddit"
        description="Add at least one."
        actions={[]}
      />
    );
    expect(screen.getByTestId("onboarding-overlay")).toBeInTheDocument();
    expect(screen.getByText("Add a Subreddit")).toBeInTheDocument();
  });

  it("renders action buttons and fires onClick", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <OnboardingOverlay
        step={1}
        totalSteps={4}
        heading="Welcome"
        description="Get started."
        actions={[{ label: "Get Started", onClick: handleClick }]}
      />
    );
    const button = screen.getByRole("button", { name: "Get Started" });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("renders multiple actions with different variants", () => {
    mockSearchParams = { onboarding: "3" };
    render(
      <OnboardingOverlay
        step={3}
        totalSteps={4}
        heading="API Keys"
        description="Optional step."
        actions={[
          { label: "Skip", variant: "outline", onClick: vi.fn() },
          { label: "Next", onClick: vi.fn() },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <OnboardingOverlay
        step={1}
        totalSteps={4}
        heading="Welcome"
        description="Get started."
        actions={[]}
      >
        <p>Extra content here</p>
      </OnboardingOverlay>
    );
    expect(screen.getByText("Extra content here")).toBeInTheDocument();
  });

  it("renders action with href as a link", () => {
    mockSearchParams = { onboarding: "3" };
    render(
      <OnboardingOverlay
        step={3}
        totalSteps={4}
        heading="API Keys"
        description="Add a Groq key."
        actions={[
          { label: "Get API Key", href: "https://console.groq.com" },
        ]}
      />
    );
    const link = screen.getByRole("link", { name: "Get API Key" });
    expect(link).toHaveAttribute("href", "https://console.groq.com");
  });
});
