/**
 * Unit tests for the TagFilter component.
 *
 * Verifies that the tag filter correctly:
 * - Renders all user tags plus an "Untagged" option
 * - "Untagged" is unchecked by default
 * - Selecting "Untagged" calls onChange with sentinel value
 * - "Clear all" clears Untagged selection
 * - "Untagged" can be combined with specific tag selections
 * - Shows "No tags available" when empty
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagFilter } from "@/components/tag-filter";

describe("TagFilter component", () => {
  const defaultTags = [
    { id: "tag-1", name: "Yugabyte", color: "#6366f1" },
    { id: "tag-2", name: "PostgreSQL", color: "#10b981" },
  ];

  const defaultProps = {
    tags: defaultTags,
    selectedIds: [] as string[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the filter button with 'All tags' when nothing selected", () => {
      render(<TagFilter {...defaultProps} />);

      expect(screen.getByText("All tags")).toBeInTheDocument();
    });

    it("renders 'Untagged' option in dropdown", async () => {
      const user = userEvent.setup();
      render(<TagFilter {...defaultProps} />);

      // Open the dropdown
      await user.click(screen.getByText("All tags"));

      expect(screen.getByText("Untagged")).toBeInTheDocument();
    });

    it("renders all user tags in dropdown", async () => {
      const user = userEvent.setup();
      render(<TagFilter {...defaultProps} />);

      await user.click(screen.getByText("All tags"));

      expect(screen.getByText("Yugabyte")).toBeInTheDocument();
      expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    });

    it("shows 'No tags available' when tags array is empty", async () => {
      const user = userEvent.setup();
      render(<TagFilter {...defaultProps} tags={[]} />);

      await user.click(screen.getByText("All tags"));

      expect(screen.getByText("No tags available")).toBeInTheDocument();
    });

    it("shows selected count in button", () => {
      render(
        <TagFilter {...defaultProps} selectedIds={["tag-1", "tag-2"]} />
      );

      expect(screen.getByText("2 tags")).toBeInTheDocument();
    });

    it("shows singular for single selection", () => {
      render(
        <TagFilter {...defaultProps} selectedIds={["tag-1"]} />
      );

      expect(screen.getByText("1 tag")).toBeInTheDocument();
    });
  });

  describe("Untagged option", () => {
    it("Untagged is unchecked by default", async () => {
      const user = userEvent.setup();
      render(<TagFilter {...defaultProps} />);

      await user.click(screen.getByText("All tags"));

      // The Untagged checkbox should not be in the selectedIds
      expect(defaultProps.selectedIds).not.toContain("untagged");
    });

    it("selecting Untagged calls onChange with sentinel value", async () => {
      const user = userEvent.setup();
      render(<TagFilter {...defaultProps} />);

      await user.click(screen.getByText("All tags"));
      await user.click(screen.getByText("Untagged"));

      expect(defaultProps.onChange).toHaveBeenCalledWith(["untagged"]);
    });

    it("Untagged can be combined with specific tag selections", async () => {
      const user = userEvent.setup();
      render(
        <TagFilter {...defaultProps} selectedIds={["untagged"]} />
      );

      await user.click(screen.getByText("1 tag"));
      await user.click(screen.getByText("Yugabyte"));

      expect(defaultProps.onChange).toHaveBeenCalledWith(["untagged", "tag-1"]);
    });
  });

  describe("clear all", () => {
    it("clear all clears Untagged selection", async () => {
      const user = userEvent.setup();
      render(
        <TagFilter
          {...defaultProps}
          selectedIds={["untagged", "tag-1"]}
        />
      );

      await user.click(screen.getByText("2 tags"));
      await user.click(screen.getByText("Clear all filters"));

      expect(defaultProps.onChange).toHaveBeenCalledWith([]);
    });
  });
});
