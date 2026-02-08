/**
 * Unit tests for the AccountSettings page (email notifications toggle).
 *
 * Verifies acceptance criteria from email-notifications.md:
 * - Toggle labeled "Email notifications" renders
 * - Toggle has description about digest frequency
 * - Toggle calls server action to update preference
 * - Toggle defaults to on (enabled)
 * - Toggle reverts on error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next-auth/react
const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

// Mock server actions
const mockGetEmailNotifications = vi.fn();
const mockUpdateEmailNotifications = vi.fn();
const mockGetEmailVerified = vi.fn();

vi.mock("@/app/actions/users", () => ({
  getEmailNotifications: () => mockGetEmailNotifications(),
  updateEmailNotifications: (...args: unknown[]) =>
    mockUpdateEmailNotifications(...args),
  getEmailVerified: () => mockGetEmailVerified(),
}));

const mockChangePassword = vi.fn();

vi.mock("@/app/actions/auth", () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

// Mock toast
const mockToast = vi.fn();

vi.mock("@/lib/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

import AccountSettingsPage from "@/app/settings/account/page";

describe("AccountSettings email notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: { user: { email: "test@example.com" } },
      status: "authenticated",
    });
    mockGetEmailNotifications.mockResolvedValue(true);
    mockUpdateEmailNotifications.mockResolvedValue({ success: true });
    mockGetEmailVerified.mockResolvedValue(true);
  });

  it("renders the email notifications toggle", async () => {
    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Email notifications")).toBeInTheDocument();
  });

  it("shows description about digest frequency", async () => {
    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Receive email digests when new posts match your tags (at most every 4 hours)"
        )
      ).toBeInTheDocument();
    });
  });

  it("loads notification preference on mount", async () => {
    mockGetEmailNotifications.mockResolvedValue(false);

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(mockGetEmailNotifications).toHaveBeenCalled();
    });

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("data-state", "unchecked");
  });

  it("defaults to checked when preference is true", async () => {
    mockGetEmailNotifications.mockResolvedValue(true);

    render(<AccountSettingsPage />);

    await waitFor(() => {
      const toggle = screen.getByRole("switch");
      expect(toggle).toHaveAttribute("data-state", "checked");
    });
  });

  it("calls updateEmailNotifications when toggled off", async () => {
    const user = userEvent.setup();
    mockGetEmailNotifications.mockResolvedValue(true);

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toHaveAttribute(
        "data-state",
        "checked"
      );
    });

    await user.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(mockUpdateEmailNotifications).toHaveBeenCalledWith(false);
    });
  });

  it("shows success toast when toggle succeeds", async () => {
    const user = userEvent.setup();
    mockGetEmailNotifications.mockResolvedValue(true);
    mockUpdateEmailNotifications.mockResolvedValue({ success: true });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toHaveAttribute(
        "data-state",
        "checked"
      );
    });

    await user.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Email notifications disabled",
        })
      );
    });
  });

  it("reverts toggle and shows error toast on failure", async () => {
    const user = userEvent.setup();
    mockGetEmailNotifications.mockResolvedValue(true);
    mockUpdateEmailNotifications.mockResolvedValue({
      success: false,
      error: "Failed to update",
    });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toHaveAttribute(
        "data-state",
        "checked"
      );
    });

    await user.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          variant: "destructive",
        })
      );
    });

    // Should revert to checked
    await waitFor(() => {
      expect(screen.getByRole("switch")).toHaveAttribute(
        "data-state",
        "checked"
      );
    });
  });
});

describe("AccountSettings resend verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: { user: { email: "test@example.com" } },
      status: "authenticated",
    });
    mockGetEmailNotifications.mockResolvedValue(true);
    mockUpdateEmailNotifications.mockResolvedValue({ success: true });
  });

  it("shows resend verification button when email is not verified", async () => {
    mockGetEmailVerified.mockResolvedValue(false);

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /resend verification email/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/your email is not verified/i)
    ).toBeInTheDocument();
  });

  it("hides resend verification button when email is verified", async () => {
    mockGetEmailVerified.mockResolvedValue(true);

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Email")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /resend verification email/i })
    ).not.toBeInTheDocument();
  });
});
