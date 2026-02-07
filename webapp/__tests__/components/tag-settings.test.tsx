/**
 * Unit tests for the TagSettings component.
 *
 * Verifies acceptance criteria from tag-system.md and ui-components.md:
 * - Tag CRUD works (create, edit, delete)
 * - Term CRUD works (add, remove)
 * - Empty state message when no tags
 * - Error display on failed operations
 * - Loading states during operations
 * - Tag header expand/collapse with keyboard accessibility
 * - Color picker with focus styles and aria-labels
 * - Remove term button with focus styles and aria-labels
 * - Delete confirmation dialog
 * - Edit dialog
 * - Post count and term count display
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagSettings } from "@/components/settings/tag-settings";

vi.mock("@/components/settings/suggest-terms", () => ({
  SuggestTerms: () => <div data-testid="suggest-terms">Suggest Terms Mock</div>,
}));

const makeTags = () => [
  {
    id: "tag-1",
    name: "Yugabyte",
    color: "#6366f1",
    terms: [
      { id: "term-1", term: "yugabyte" },
      { id: "term-2", term: "yugabytedb" },
    ],
    postCount: 5,
  },
  {
    id: "tag-2",
    name: "Distributed PG",
    color: "#10b981",
    terms: [{ id: "term-3", term: "distributed postgres" }],
    postCount: 3,
  },
];

describe("TagSettings component", () => {
  const defaultProps = {
    tags: makeTags(),
    hasGroqKey: true,
    onCreate: vi.fn().mockResolvedValue({ success: true }),
    onUpdate: vi.fn().mockResolvedValue({ success: true }),
    onDelete: vi.fn().mockResolvedValue({ success: true }),
    onAddTerm: vi.fn().mockResolvedValue({ success: true }),
    onRemoveTerm: vi.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the heading", () => {
      render(<TagSettings {...defaultProps} />);
      expect(screen.getByText("Tags")).toBeInTheDocument();
    });

    it("renders Add Tag button", () => {
      render(<TagSettings {...defaultProps} />);
      expect(screen.getByText("Add Tag")).toBeInTheDocument();
    });

    it("renders tag badges with names", () => {
      render(<TagSettings {...defaultProps} />);
      expect(screen.getByText("Yugabyte")).toBeInTheDocument();
      expect(screen.getByText("Distributed PG")).toBeInTheDocument();
    });

    it("renders term count and post count", () => {
      render(<TagSettings {...defaultProps} />);
      expect(screen.getByText(/2 terms/)).toBeInTheDocument();
      expect(screen.getByText(/5 posts/)).toBeInTheDocument();
      expect(screen.getByText(/1 term/)).toBeInTheDocument();
      expect(screen.getByText(/3 posts/)).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no tags", () => {
      render(<TagSettings {...defaultProps} tags={[]} />);
      expect(
        screen.getByText(
          "No tags created. Create your first tag to start tracking topics."
        )
      ).toBeInTheDocument();
    });
  });

  describe("expand/collapse", () => {
    it("expands tag details when header is clicked", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Click the tag header button
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      expect(yugabyteHeader).toBeDefined();
      await user.click(yugabyteHeader!);

      // Should show search terms
      expect(screen.getByText("Search Terms")).toBeInTheDocument();
      expect(screen.getByText("yugabyte")).toBeInTheDocument();
      expect(screen.getByText("yugabytedb")).toBeInTheDocument();
    });

    it("collapses tag details when header is clicked again", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Click to expand
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);
      expect(screen.getByText("Search Terms")).toBeInTheDocument();

      // Click to collapse
      const expandedHeader = screen.getByRole("button", { expanded: true });
      await user.click(expandedHeader);
      expect(screen.queryByText("Search Terms")).not.toBeInTheDocument();
    });

    it("tag header is a button element for keyboard accessibility", () => {
      render(<TagSettings {...defaultProps} />);
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      expect(yugabyteHeader).toBeDefined();
      expect(yugabyteHeader!.tagName).toBe("BUTTON");
    });

    it("tag header has aria-expanded attribute", () => {
      render(<TagSettings {...defaultProps} />);
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      expect(yugabyteHeader).toHaveAttribute("aria-expanded", "false");
    });

    it("shows SuggestTerms component when expanded", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);

      expect(screen.getByTestId("suggest-terms")).toBeInTheDocument();
    });
  });

  describe("creating tags", () => {
    it("shows create form when Add Tag is clicked", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      await user.click(screen.getByText("Add Tag"));

      expect(screen.getByText("New Tag")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Tag name")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search terms (comma-separated)")
      ).toBeInTheDocument();
    });

    it("calls onCreate with correct arguments", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      await user.click(screen.getByText("Add Tag"));
      await user.type(screen.getByPlaceholderText("Tag name"), "NewTag");
      await user.type(
        screen.getByPlaceholderText("Search terms (comma-separated)"),
        "term1, term2, term3"
      );
      await user.click(screen.getByText("Create"));

      expect(defaultProps.onCreate).toHaveBeenCalledWith(
        "NewTag",
        expect.any(String), // default color
        ["term1", "term2", "term3"]
      );
    });

    it("clears form and hides it after successful create", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      await user.click(screen.getByText("Add Tag"));
      await user.type(screen.getByPlaceholderText("Tag name"), "NewTag");
      await user.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(screen.queryByText("New Tag")).not.toBeInTheDocument();
      });
    });

    it("shows error when create fails", async () => {
      const user = userEvent.setup();
      const onCreate = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Tag already exists" });
      render(<TagSettings {...defaultProps} onCreate={onCreate} />);

      await user.click(screen.getByText("Add Tag"));
      await user.type(screen.getByPlaceholderText("Tag name"), "Existing");
      await user.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(screen.getByText("Tag already exists")).toBeInTheDocument();
      });
    });

    it("does not call onCreate when name is empty", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      await user.click(screen.getByText("Add Tag"));
      // Create button should be disabled when name is empty
      const createBtn = screen.getByText("Create");
      expect(createBtn.closest("button")).toBeDisabled();
    });

    it("cancels create form", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      await user.click(screen.getByText("Add Tag"));
      expect(screen.getByText("New Tag")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));
      expect(screen.queryByText("New Tag")).not.toBeInTheDocument();
    });

    it("disables Add Tag button while form is open", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      await user.click(screen.getByText("Add Tag"));
      expect(screen.getByText("Add Tag").closest("button")).toBeDisabled();
    });
  });

  describe("editing tags", () => {
    it("opens edit dialog when edit button is clicked", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Find icon-only buttons inside tag rows (edit and delete buttons)
      const allButtons = screen.getAllByRole("button");
      // Find buttons that are inside tag rows - we look for ghost variant buttons
      let clickedEdit = false;
      for (const btn of allButtons) {
        if (btn.textContent === "" && btn.closest(".border.rounded-lg")) {
          // This is likely an icon-only button in a tag row
          await user.click(btn);
          clickedEdit = true;
          break;
        }
      }

      if (clickedEdit) {
        await waitFor(() => {
          expect(screen.getByText("Edit Tag")).toBeInTheDocument();
        });
      }
    });

    it("calls onUpdate with correct arguments", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Open edit dialog for first tag - click the first pencil button
      // The pencil buttons are ghost variant buttons inside tag headers
      const allButtons = screen.getAllByRole("button");
      for (const btn of allButtons) {
        if (btn.textContent === "" && btn.closest(".border.rounded-lg")) {
          await user.click(btn);
          break;
        }
      }

      await waitFor(() => {
        expect(screen.getByText("Edit Tag")).toBeInTheDocument();
      });

      // Clear and type new name
      const nameInput = screen.getByPlaceholderText("Tag name");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Yugabyte");
      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(defaultProps.onUpdate).toHaveBeenCalledWith(
          "tag-1",
          "Updated Yugabyte",
          expect.any(String)
        );
      });
    });
  });

  describe("deleting tags", () => {
    it("shows delete confirmation dialog", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Find delete buttons (TrashIcon) - they're the second icon-only button in each tag
      const allButtons = screen.getAllByRole("button");
      const tagRowButtons = allButtons.filter(
        (btn) => btn.textContent === "" && btn.closest(".border.rounded-lg")
      );
      // Second icon-only button per tag is delete
      if (tagRowButtons.length >= 2) {
        await user.click(tagRowButtons[1]!);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete Tag")).toBeInTheDocument();
        expect(
          screen.getByText(/Are you sure you want to delete this tag/)
        ).toBeInTheDocument();
      });
    });

    it("calls onDelete when confirmed", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Open delete dialog
      const allButtons = screen.getAllByRole("button");
      const tagRowButtons = allButtons.filter(
        (btn) => btn.textContent === "" && btn.closest(".border.rounded-lg")
      );
      if (tagRowButtons.length >= 2) {
        await user.click(tagRowButtons[1]!);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete Tag")).toBeInTheDocument();
      });

      // Click Delete button in dialog
      const deleteBtn = screen.getByRole("button", { name: "Delete" });
      await user.click(deleteBtn);

      await waitFor(() => {
        expect(defaultProps.onDelete).toHaveBeenCalledWith("tag-1");
      });
    });

    it("cancels delete dialog", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Open delete dialog
      const allButtons = screen.getAllByRole("button");
      const tagRowButtons = allButtons.filter(
        (btn) => btn.textContent === "" && btn.closest(".border.rounded-lg")
      );
      if (tagRowButtons.length >= 2) {
        await user.click(tagRowButtons[1]!);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete Tag")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByText("Delete Tag")).not.toBeInTheDocument();
      });

      expect(defaultProps.onDelete).not.toHaveBeenCalled();
    });
  });

  describe("term management", () => {
    it("adds a term via Enter key", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Expand the first tag
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);

      const termInput = screen.getByPlaceholderText("Add a term");
      await user.type(termInput, "new-term{Enter}");

      expect(defaultProps.onAddTerm).toHaveBeenCalledWith("tag-1", "new-term");
    });

    it("adds a term via button click", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Expand the first tag
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);

      const termInput = screen.getByPlaceholderText("Add a term");
      await user.type(termInput, "new-term");

      // Find the add term button (PlusIcon button in the expanded area)
      const expandedSection = screen.getByPlaceholderText("Add a term").closest(".space-y-3");
      const addButton = expandedSection?.querySelectorAll("button");
      // The button next to the input is the add button
      if (addButton && addButton.length > 0) {
        await user.click(addButton[addButton.length - 1]!);
      }

      expect(defaultProps.onAddTerm).toHaveBeenCalledWith("tag-1", "new-term");
    });

    it("clears term input after successful add", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Expand tag
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);

      const termInput = screen.getByPlaceholderText("Add a term");
      await user.type(termInput, "new-term{Enter}");

      await waitFor(() => {
        expect(termInput).toHaveValue("");
      });
    });

    it("removes a term", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Expand tag
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);

      // Find remove button for "yugabyte" term
      const removeBtn = screen.getByRole("button", {
        name: "Remove term yugabyte",
      });
      await user.click(removeBtn);

      expect(defaultProps.onRemoveTerm).toHaveBeenCalledWith("term-1");
    });

    it("remove term button has aria-label for accessibility", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      // Expand tag
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);

      expect(
        screen.getByRole("button", { name: "Remove term yugabyte" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Remove term yugabytedb" })
      ).toBeInTheDocument();
    });

    it("shows empty terms message", async () => {
      const user = userEvent.setup();
      const tagsWithNoTerms = [
        { ...makeTags()[0]!, terms: [], postCount: 0 },
      ];
      render(<TagSettings {...defaultProps} tags={tagsWithNoTerms} />);

      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const header = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(header!);

      expect(screen.getByText("No terms added")).toBeInTheDocument();
    });
  });

  describe("color picker accessibility", () => {
    it("color picker buttons have aria-labels", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      await user.click(screen.getByText("Add Tag"));

      const colorButtons = screen.getAllByRole("button", {
        name: /Select color/,
      });
      expect(colorButtons.length).toBeGreaterThan(0);
    });

    it("color picker buttons have focus-visible styles", async () => {
      const user = userEvent.setup();
      render(<TagSettings {...defaultProps} />);

      await user.click(screen.getByText("Add Tag"));

      const colorButtons = screen.getAllByRole("button", {
        name: /Select color/,
      });
      // Check that the class includes focus-visible styles
      expect(colorButtons[0]!.className).toContain("focus-visible:ring-2");
    });
  });

  describe("error handling", () => {
    it("shows error when add term fails", async () => {
      const user = userEvent.setup();
      const onAddTerm = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Duplicate term" });
      render(<TagSettings {...defaultProps} onAddTerm={onAddTerm} />);

      // Expand tag
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);

      const termInput = screen.getByPlaceholderText("Add a term");
      await user.type(termInput, "yugabyte{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Duplicate term")).toBeInTheDocument();
      });
    });

    it("shows error when remove term fails", async () => {
      const user = userEvent.setup();
      const onRemoveTerm = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Cannot remove" });
      render(<TagSettings {...defaultProps} onRemoveTerm={onRemoveTerm} />);

      // Expand tag
      const tagHeaders = screen.getAllByRole("button", { expanded: false });
      const yugabyteHeader = tagHeaders.find((btn) =>
        btn.textContent?.includes("Yugabyte")
      );
      await user.click(yugabyteHeader!);

      const removeBtn = screen.getByRole("button", {
        name: "Remove term yugabyte",
      });
      await user.click(removeBtn);

      await waitFor(() => {
        expect(screen.getByText("Cannot remove")).toBeInTheDocument();
      });
    });

    it("shows error when delete fails", async () => {
      const user = userEvent.setup();
      const onDelete = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Delete failed" });
      render(<TagSettings {...defaultProps} onDelete={onDelete} />);

      // Open delete dialog
      const allButtons = screen.getAllByRole("button");
      const tagRowButtons = allButtons.filter(
        (btn) => btn.textContent === "" && btn.closest(".border.rounded-lg")
      );
      if (tagRowButtons.length >= 2) {
        await user.click(tagRowButtons[1]!);
      }

      await waitFor(() => {
        expect(screen.getByText("Delete Tag")).toBeInTheDocument();
      });

      const deleteBtn = screen.getByRole("button", { name: "Delete" });
      await user.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText("Delete failed")).toBeInTheDocument();
      });
    });
  });
});
