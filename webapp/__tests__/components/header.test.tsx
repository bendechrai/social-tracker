/**
 * Unit tests for the Header component.
 *
 * Verifies:
 * - Header shows title "Social Tracker"
 * - Settings button linking to /settings
 * - UserMenu is rendered
 * - No "Fetch New" button (auto-fetch replaces manual fetch)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/header";

// Mock UserMenu to avoid session dependency
vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Header component", () => {
  it("renders 'Social Tracker' title", () => {
    render(<Header />);
    expect(screen.getByText("Social Tracker")).toBeInTheDocument();
  });

  it("renders Settings link to /settings", () => {
    render(<Header />);
    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("renders UserMenu", () => {
    render(<Header />);
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });

  it("does not render a Fetch New button", () => {
    render(<Header />);
    expect(screen.queryByText("Fetch New")).not.toBeInTheDocument();
  });
});
