/**
 * Unit tests for the StatusTabs component.
 *
 * Verifies that status tabs correctly:
 * - Render all three status tabs (New, Ignored, Done)
 * - Display counts for each status
 * - Highlight the currently active tab
 * - Call onChange with correct status when clicked
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusTabs } from "@/components/status-tabs";

describe("StatusTabs component", () => {
  const defaultProps = {
    currentStatus: "new" as const,
    counts: { new: 10, ignored: 5, done: 3 },
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders all three status tabs", () => {
      render(<StatusTabs {...defaultProps} />);

      expect(screen.getByText("New (10)")).toBeInTheDocument();
      expect(screen.getByText("Ignored (5)")).toBeInTheDocument();
      expect(screen.getByText("Done (3)")).toBeInTheDocument();
    });

    it("renders with zero counts", () => {
      render(
        <StatusTabs
          {...defaultProps}
          counts={{ new: 0, ignored: 0, done: 0 }}
        />
      );

      expect(screen.getByText("New (0)")).toBeInTheDocument();
      expect(screen.getByText("Ignored (0)")).toBeInTheDocument();
      expect(screen.getByText("Done (0)")).toBeInTheDocument();
    });

    it("renders with large counts", () => {
      render(
        <StatusTabs
          {...defaultProps}
          counts={{ new: 1234, ignored: 567, done: 890 }}
        />
      );

      expect(screen.getByText("New (1234)")).toBeInTheDocument();
      expect(screen.getByText("Ignored (567)")).toBeInTheDocument();
      expect(screen.getByText("Done (890)")).toBeInTheDocument();
    });
  });

  describe("tab selection", () => {
    it("marks the current status tab as selected", () => {
      render(<StatusTabs {...defaultProps} currentStatus="new" />);

      const newTab = screen.getByRole("tab", { name: "New (10)" });
      expect(newTab).toHaveAttribute("data-state", "active");
    });

    it("marks ignored tab as selected when current status is ignored", () => {
      render(<StatusTabs {...defaultProps} currentStatus="ignored" />);

      const ignoredTab = screen.getByRole("tab", { name: "Ignored (5)" });
      expect(ignoredTab).toHaveAttribute("data-state", "active");
    });

    it("marks done tab as selected when current status is done", () => {
      render(<StatusTabs {...defaultProps} currentStatus="done" />);

      const doneTab = screen.getByRole("tab", { name: "Done (3)" });
      expect(doneTab).toHaveAttribute("data-state", "active");
    });
  });

  describe("interactions", () => {
    it("calls onChange with 'new' when New tab is clicked", async () => {
      const user = userEvent.setup();
      render(<StatusTabs {...defaultProps} currentStatus="ignored" />);

      await user.click(screen.getByRole("tab", { name: "New (10)" }));

      expect(defaultProps.onChange).toHaveBeenCalledWith("new");
    });

    it("calls onChange with 'ignored' when Ignored tab is clicked", async () => {
      const user = userEvent.setup();
      render(<StatusTabs {...defaultProps} currentStatus="new" />);

      await user.click(screen.getByRole("tab", { name: "Ignored (5)" }));

      expect(defaultProps.onChange).toHaveBeenCalledWith("ignored");
    });

    it("calls onChange with 'done' when Done tab is clicked", async () => {
      const user = userEvent.setup();
      render(<StatusTabs {...defaultProps} currentStatus="new" />);

      await user.click(screen.getByRole("tab", { name: "Done (3)" }));

      expect(defaultProps.onChange).toHaveBeenCalledWith("done");
    });
  });
});
