/**
 * Unit tests for the AI Profile settings page.
 *
 * Verifies acceptance criteria from ai-assistant-improvements.md:
 * - Renders all fields with placeholders
 * - Loads existing profile data
 * - Save button disabled while saving
 * - Successful save shows toast
 * - Error shows destructive toast
 * - Tone dropdown has 4 options plus empty
 * - Fields are optional (can save empty)
 * - Max length attributes on textareas
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock next/navigation (needed for useRouter and useSearchParams)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock server actions — must be before any import that references them
const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();

vi.mock("@/app/actions/profile", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Mock credits actions (used by hooks/index.ts)
vi.mock("@/app/actions/credits", () => ({
  getCreditBalance: vi.fn().mockResolvedValue(0),
  getUsageHistory: vi.fn().mockResolvedValue({ entries: [], total: 0, page: 1, totalPages: 0 }),
  getUsageSummary: vi.fn().mockResolvedValue([]),
  getPurchaseHistory: vi.fn().mockResolvedValue([]),
  getAiAccessInfo: vi.fn().mockResolvedValue({ hasGroqKey: false, creditBalanceCents: 0, mode: "none" }),
  createCheckoutSession: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }),
}));

// Mock other server actions that hooks/index.ts imports
vi.mock("@/app/actions/posts", () => ({
  listPosts: vi.fn().mockResolvedValue({ posts: [], total: 0 }),
  getPostCounts: vi.fn().mockResolvedValue({ new: 0, ignored: 0, done: 0, total: 0 }),
  changePostStatus: vi.fn().mockResolvedValue({ success: true }),
  updateResponseText: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/subreddits", () => ({
  listSubreddits: vi.fn().mockResolvedValue([]),
  addSubreddit: vi.fn().mockResolvedValue({ success: true }),
  removeSubreddit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/tags", () => ({
  listTags: vi.fn().mockResolvedValue([]),
  createTag: vi.fn().mockResolvedValue({ success: true }),
  updateTag: vi.fn().mockResolvedValue({ success: true }),
  deleteTag: vi.fn().mockResolvedValue({ success: true }),
  addSearchTerm: vi.fn().mockResolvedValue({ success: true }),
  removeSearchTerm: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/api-keys", () => ({
  hasGroqApiKey: vi.fn().mockResolvedValue(false),
  saveGroqApiKey: vi.fn().mockResolvedValue({ success: true }),
  deleteGroqApiKey: vi.fn().mockResolvedValue({ success: true }),
  getGroqApiKeyHint: vi.fn().mockResolvedValue(null),
}));

// Mock toast
const mockToast = vi.fn();

vi.mock("@/lib/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

import AiProfilePage from "@/app/settings/ai-profile/page";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("AI Profile settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({
      role: null,
      company: null,
      goal: null,
      tone: null,
      context: null,
    });
    mockUpdateProfile.mockResolvedValue({ success: true });
  });

  it("renders all fields with placeholders", async () => {
    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Role")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Company / Project")).toBeInTheDocument();
    expect(screen.getByLabelText("Goal")).toBeInTheDocument();
    expect(screen.getByLabelText("Tone")).toBeInTheDocument();
    expect(screen.getByLabelText("Additional context")).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(
        "e.g., Developer Advocate, Community Manager"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "e.g., YugabyteDB, My Open Source Project"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "e.g., Engage with community discussions about our database product"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        /Any other instructions for the AI/
      )
    ).toBeInTheDocument();
  });

  it("loads existing profile data", async () => {
    mockGetProfile.mockResolvedValue({
      role: "Developer Advocate",
      company: "YugabyteDB",
      goal: "Engage with community",
      tone: "casual",
      context: "Keep it short",
    });

    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Role")).toHaveValue("Developer Advocate");
    });
    expect(screen.getByLabelText("Company / Project")).toHaveValue(
      "YugabyteDB"
    );
    expect(screen.getByLabelText("Goal")).toHaveValue(
      "Engage with community"
    );
    expect(screen.getByLabelText("Additional context")).toHaveValue(
      "Keep it short"
    );
  });

  it("Save button disabled while saving", async () => {
    const user = userEvent.setup();
    let resolveUpdate: (value: { success: boolean }) => void;
    mockUpdateProfile.mockReturnValue(
      new Promise((r) => {
        resolveUpdate = r;
      })
    );

    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Role")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    // Resolve the pending update
    resolveUpdate!({ success: true });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });
  });

  it("successful save shows toast", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValue({ success: true });

    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Role")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "AI profile updated",
        })
      );
    });
  });

  it("error shows destructive toast", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValue({
      success: false,
      error: "Role must be 255 characters or less",
    });

    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Role")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "Role must be 255 characters or less",
          variant: "destructive",
        })
      );
    });
  });

  it("tone dropdown has 4 options plus empty", async () => {
    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Tone")).toBeInTheDocument();
    });

    // Radix Select renders a hidden native <select> with all options for accessibility
    // Check via the native select's option elements (Radix uses aria-hidden select)
    const options = document.querySelectorAll("select option");
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts).toContain("No preference");
    expect(optionTexts).toContain("Casual");
    expect(optionTexts).toContain("Professional");
    expect(optionTexts).toContain("Technical");
    expect(optionTexts).toContain("Friendly");
    expect(options.length).toBe(5);
  });

  it("fields are optional (can save empty)", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValue({ success: true });

    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        role: "",
        company: "",
        goal: "",
        tone: "",  // "none" sentinel mapped to "" for server action
        context: "",
      });
    });
  });

  it("max length attributes on textareas", async () => {
    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Goal")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Goal")).toHaveAttribute(
      "maxlength",
      "1000"
    );
    expect(screen.getByLabelText("Additional context")).toHaveAttribute(
      "maxlength",
      "2000"
    );
  });

  it("shows helper text about optional fields", async () => {
    render(<AiProfilePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText(
          "These fields help the AI write in your voice. All fields are optional."
        )
      ).toBeInTheDocument();
    });
  });
});
