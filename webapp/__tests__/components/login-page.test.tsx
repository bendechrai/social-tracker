/**
 * Unit tests for the Login page.
 *
 * Verifies acceptance criteria from password-reset.md:
 * - "Forgot password?" link below login form linking to /forgot-password
 * - Success message when ?reset=true query param is present
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Track search params
let mockSearchParams: Record<string, string> = {};

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams[key] ?? null,
  }),
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

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

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
  });

  it("renders 'Forgot password?' link pointing to /forgot-password", () => {
    render(<LoginPage />);

    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("shows success message when ?reset=true is in URL", () => {
    mockSearchParams = { reset: "true" };
    render(<LoginPage />);

    expect(
      screen.getByText(
        /password reset successfully\. please log in with your new password\./i
      )
    ).toBeInTheDocument();
  });

  it("does not show reset success message without query param", () => {
    render(<LoginPage />);

    expect(
      screen.queryByText(/password reset successfully/i)
    ).not.toBeInTheDocument();
  });
});
