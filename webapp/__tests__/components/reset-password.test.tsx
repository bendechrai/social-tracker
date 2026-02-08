/**
 * Unit tests for the Reset Password page.
 *
 * Verifies acceptance criteria from password-reset.md:
 * - Missing token shows error with link to /forgot-password
 * - Valid token shows password form with requirement checklist
 * - Password validation checklist (same requirements as signup)
 * - Successful submission redirects to /login?reset=true
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import ResetPasswordPage from "@/app/reset-password/page";

describe("ResetPasswordPage", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockSearchParams = new URLSearchParams();
  });

  describe("missing token", () => {
    it("shows error message when no token in URL", () => {
      render(<ResetPasswordPage />);

      expect(
        screen.getByText(/this password reset link is invalid or has expired/i)
      ).toBeInTheDocument();
    });

    it("shows link to request a new reset link", () => {
      render(<ResetPasswordPage />);

      const link = screen.getByRole("link", {
        name: /request a new reset link/i,
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/forgot-password");
    });

    it("does not show the password form", () => {
      render(<ResetPasswordPage />);

      expect(
        screen.queryByLabelText("New Password")
      ).not.toBeInTheDocument();
    });
  });

  describe("valid token", () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams("token=valid-token-123");
    });

    it("renders password form with requirement checklist", () => {
      render(<ResetPasswordPage />);

      expect(
        screen.getByLabelText("New Password")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Confirm New Password")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reset password/i })
      ).toBeInTheDocument();

      // Password requirements checklist
      expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one number/i)).toBeInTheDocument();
      expect(screen.getByText(/one symbol/i)).toBeInTheDocument();
    });

    it("disables submit button when password requirements not met", () => {
      render(<ResetPasswordPage />);

      expect(
        screen.getByRole("button", { name: /reset password/i })
      ).toBeDisabled();
    });

    it("enables submit button when all requirements met and passwords match", async () => {
      const user = userEvent.setup();
      render(<ResetPasswordPage />);

      await user.type(
        screen.getByLabelText("New Password"),
        "ValidPass123!!"
      );
      await user.type(
        screen.getByLabelText("Confirm New Password"),
        "ValidPass123!!"
      );

      expect(
        screen.getByRole("button", { name: /reset password/i })
      ).toBeEnabled();
    });

    it("shows passwords do not match indicator", async () => {
      const user = userEvent.setup();
      render(<ResetPasswordPage />);

      await user.type(
        screen.getByLabelText("New Password"),
        "ValidPass123!!"
      );
      await user.type(
        screen.getByLabelText("Confirm New Password"),
        "DifferentPass1!"
      );

      expect(
        screen.getByText(/passwords do not match/i)
      ).toBeInTheDocument();
    });

    it("shows passwords match indicator when matching", async () => {
      const user = userEvent.setup();
      render(<ResetPasswordPage />);

      await user.type(
        screen.getByLabelText("New Password"),
        "ValidPass123!!"
      );
      await user.type(
        screen.getByLabelText("Confirm New Password"),
        "ValidPass123!!"
      );

      expect(screen.getByText(/passwords match/i)).toBeInTheDocument();
    });

    it("calls POST /api/auth/execute-reset on submit", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<ResetPasswordPage />);

      await user.type(
        screen.getByLabelText("New Password"),
        "ValidPass123!!"
      );
      await user.type(
        screen.getByLabelText("Confirm New Password"),
        "ValidPass123!!"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/auth/execute-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "valid-token-123",
            password: "ValidPass123!!",
            confirmPassword: "ValidPass123!!",
          }),
        });
      });
    });

    it("redirects to /login?reset=true on success", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<ResetPasswordPage />);

      await user.type(
        screen.getByLabelText("New Password"),
        "ValidPass123!!"
      );
      await user.type(
        screen.getByLabelText("Confirm New Password"),
        "ValidPass123!!"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login?reset=true");
      });
    });

    it("shows error on API failure (invalid/expired token)", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Invalid or expired reset link" }),
      });

      render(<ResetPasswordPage />);

      await user.type(
        screen.getByLabelText("New Password"),
        "ValidPass123!!"
      );
      await user.type(
        screen.getByLabelText("Confirm New Password"),
        "ValidPass123!!"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/invalid or expired reset link/i)
        ).toBeInTheDocument();
      });
    });

    it("shows error on network failure", async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      render(<ResetPasswordPage />);

      await user.type(
        screen.getByLabelText("New Password"),
        "ValidPass123!!"
      );
      await user.type(
        screen.getByLabelText("Confirm New Password"),
        "ValidPass123!!"
      );
      await user.click(
        screen.getByRole("button", { name: /reset password/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/something went wrong/i)
        ).toBeInTheDocument();
      });
    });

    it("shows link to request a new reset link", () => {
      render(<ResetPasswordPage />);

      const link = screen.getByRole("link", {
        name: /request a new reset link/i,
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/forgot-password");
    });
  });
});
