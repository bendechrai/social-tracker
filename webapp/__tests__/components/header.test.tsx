/**
 * Unit tests for the Header component.
 *
 * Verifies:
 * - Header shows title "Social Tracker"
 * - UserMenu is rendered
 * - No settings icon in header (settings is in user menu)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/header";

// Mock UserMenu to avoid session dependency
vi.mock("@/components/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

describe("Header component", () => {
  it("renders 'Social Tracker' title", () => {
    render(<Header />);
    expect(screen.getByText("Social Tracker")).toBeInTheDocument();
  });

  it("renders UserMenu", () => {
    render(<Header />);
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });

  it("does not render a settings icon in the header", () => {
    render(<Header />);
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});
