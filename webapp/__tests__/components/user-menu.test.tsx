/**
 * Unit tests for the UserMenu component.
 *
 * Verifies acceptance criteria from authentication.md and ui-components.md:
 * - Logout works: User can sign out, session destroyed
 * - User menu shows email, settings link, sign out button
 * - Loading state while session is being checked
 * - Unauthenticated state shows sign in/sign up links
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "@/components/user-menu";

// Mock next-auth/react
const mockSignOut = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("UserMenu component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows loading spinner when session status is loading", () => {
      mockUseSession.mockReturnValue({ data: null, status: "loading" });

      render(<UserMenu />);

      // Should show a disabled button with spinner
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("unauthenticated state", () => {
    it("shows sign in and sign up links when not authenticated", () => {
      mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

      render(<UserMenu />);

      expect(screen.getByText("Sign in")).toBeInTheDocument();
      expect(screen.getByText("Sign up")).toBeInTheDocument();
    });

    it("links sign in to /login", () => {
      mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

      render(<UserMenu />);

      const signInLink = screen.getByText("Sign in").closest("a");
      expect(signInLink).toHaveAttribute("href", "/login");
    });

    it("links sign up to /signup", () => {
      mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

      render(<UserMenu />);

      const signUpLink = screen.getByText("Sign up").closest("a");
      expect(signUpLink).toHaveAttribute("href", "/signup");
    });
  });

  describe("authenticated state", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { email: "test@example.com" },
          expires: "2026-02-14",
        },
        status: "authenticated",
      });
    });

    it("shows user email in trigger button", () => {
      render(<UserMenu />);
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    it("shows dropdown menu with settings and sign out when clicked", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      // Click the trigger button
      await user.click(screen.getByText("test@example.com"));

      // Should show menu items
      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeInTheDocument();
        expect(screen.getByText("Sign out")).toBeInTheDocument();
      });
    });

    it("shows user email in the dropdown label", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByText("test@example.com"));

      await waitFor(() => {
        expect(screen.getByText("Account")).toBeInTheDocument();
        // Email appears twice: once in trigger, once in dropdown label
        const emails = screen.getAllByText("test@example.com");
        expect(emails.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("has settings link pointing to /settings", async () => {
      const user = userEvent.setup();
      render(<UserMenu />);

      await user.click(screen.getByText("test@example.com"));

      await waitFor(() => {
        const settingsLink = screen.getByText("Settings").closest("a");
        expect(settingsLink).toHaveAttribute("href", "/settings");
      });
    });

    it("calls signOut with callbackUrl when Sign out is clicked", async () => {
      const user = userEvent.setup();
      mockSignOut.mockResolvedValue(undefined);

      render(<UserMenu />);

      // Open the dropdown
      await user.click(screen.getByText("test@example.com"));

      await waitFor(() => {
        expect(screen.getByText("Sign out")).toBeInTheDocument();
      });

      // Click sign out
      await user.click(screen.getByText("Sign out"));

      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    });
  });
});
