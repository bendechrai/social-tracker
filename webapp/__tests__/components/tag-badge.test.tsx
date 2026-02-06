/**
 * Unit tests for the TagBadge component.
 *
 * Verifies that the tag badge correctly:
 * - Renders tag name text
 * - Applies background color from props
 * - Calculates contrast text color (white on dark, dark on light)
 * - Accepts optional className prop
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagBadge } from "@/components/tag-badge";

describe("TagBadge component", () => {
  describe("rendering", () => {
    it("renders the tag name", () => {
      render(<TagBadge name="React" color="#6366f1" />);
      expect(screen.getByText("React")).toBeInTheDocument();
    });

    it("applies background color from props", () => {
      render(<TagBadge name="React" color="#6366f1" />);
      const badge = screen.getByText("React");
      expect(badge).toHaveStyle({ backgroundColor: "#6366f1" });
    });

    it("applies additional className", () => {
      render(<TagBadge name="React" color="#6366f1" className="ml-2" />);
      const badge = screen.getByText("React");
      expect(badge).toHaveClass("ml-2");
    });

    it("renders as inline-flex span", () => {
      render(<TagBadge name="React" color="#6366f1" />);
      const badge = screen.getByText("React");
      expect(badge.tagName).toBe("SPAN");
    });
  });

  describe("contrast color calculation", () => {
    it("uses white text on dark backgrounds", () => {
      // Dark indigo (#6366f1)
      render(<TagBadge name="Dark" color="#6366f1" />);
      const badge = screen.getByText("Dark");
      expect(badge).toHaveStyle({ color: "#ffffff" });
    });

    it("uses dark text on light backgrounds", () => {
      // Light amber (#f59e0b)
      render(<TagBadge name="Light" color="#f59e0b" />);
      const badge = screen.getByText("Light");
      expect(badge).toHaveStyle({ color: "#1f2937" });
    });

    it("uses white text for pure black", () => {
      render(<TagBadge name="Black" color="#000000" />);
      const badge = screen.getByText("Black");
      expect(badge).toHaveStyle({ color: "#ffffff" });
    });

    it("uses dark text for pure white", () => {
      render(<TagBadge name="White" color="#ffffff" />);
      const badge = screen.getByText("White");
      expect(badge).toHaveStyle({ color: "#1f2937" });
    });

    it("uses dark text for cyan (#06b6d4)", () => {
      render(<TagBadge name="Cyan" color="#06b6d4" />);
      const badge = screen.getByText("Cyan");
      // Cyan has luminance: (0.299*6 + 0.587*182 + 0.114*212)/255 ≈ 0.52 > 0.5
      expect(badge).toHaveStyle({ color: "#1f2937" });
    });

    it("uses white text for rose (#f43f5e)", () => {
      render(<TagBadge name="Rose" color="#f43f5e" />);
      const badge = screen.getByText("Rose");
      // Rose luminance: (0.299*244 + 0.587*63 + 0.114*94)/255 ≈ 0.47 < 0.5
      expect(badge).toHaveStyle({ color: "#ffffff" });
    });
  });
});
