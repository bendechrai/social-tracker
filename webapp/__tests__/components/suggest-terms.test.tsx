/**
 * Unit tests for the SuggestTerms component.
 *
 * Verifies acceptance criteria from llm-tag-suggestions.md:
 * - UI shows checkboxes for each suggestion
 * - Selection works (check/uncheck)
 * - Selected suggestions become search terms on the tag
 * - Already-existing terms shown as disabled (duplicates handled)
 * - Loading state shown (button disabled, spinner during API call)
 * - Disabled with tooltip when no Groq API key
 * - Errors handled gracefully
 * - Empty tag name rejected
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/mocks/server";
import { SuggestTerms } from "@/components/settings/suggest-terms";

describe("SuggestTerms component", () => {
  const defaultProps = {
    tagName: "Yugabyte",
    existingTerms: ["yugabyte"],
    onAdd: vi.fn(),
    hasGroqKey: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial rendering", () => {
    it("renders the Suggest Terms button", () => {
      render(<SuggestTerms {...defaultProps} />);
      expect(screen.getByText("Suggest Terms")).toBeInTheDocument();
    });

    it("shows help text when Groq key is available", () => {
      render(<SuggestTerms {...defaultProps} />);
      expect(
        screen.getByText('Click "Suggest Terms" to get AI-powered suggestions')
      ).toBeInTheDocument();
    });

    it("shows help text about adding API key when no Groq key", () => {
      render(<SuggestTerms {...defaultProps} hasGroqKey={false} />);
      expect(
        screen.getByText(/Add your Groq API key in Settings/)
      ).toBeInTheDocument();
    });
  });

  describe("disabled state without Groq key", () => {
    it("disables button when hasGroqKey is false", () => {
      render(<SuggestTerms {...defaultProps} hasGroqKey={false} />);
      const button = screen.getByRole("button", { name: /suggest terms/i });
      expect(button).toBeDisabled();
    });

    it("shows tooltip text when disabled", () => {
      render(<SuggestTerms {...defaultProps} hasGroqKey={false} />);
      const button = screen.getByRole("button", { name: /suggest terms/i });
      expect(button).toHaveAttribute(
        "title",
        "Add your Groq API key in Settings to enable suggestions"
      );
    });

    it("does not show tooltip when Groq key is available", () => {
      render(<SuggestTerms {...defaultProps} hasGroqKey={true} />);
      const button = screen.getByRole("button", { name: /suggest terms/i });
      expect(button).not.toHaveAttribute("title");
    });
  });

  describe("disabled state with empty tag name", () => {
    it("disables button when tag name is empty", () => {
      render(<SuggestTerms {...defaultProps} tagName="" />);
      const button = screen.getByRole("button", { name: /suggest terms/i });
      expect(button).toBeDisabled();
    });

    it("disables button when tag name is whitespace only", () => {
      render(<SuggestTerms {...defaultProps} tagName="   " />);
      const button = screen.getByRole("button", { name: /suggest terms/i });
      expect(button).toBeDisabled();
    });
  });

  describe("loading state", () => {
    it("shows spinner and 'Thinking...' text during API call", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", async () => {
          await delay("infinite");
          return HttpResponse.json({ suggestions: [] });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      expect(screen.getByText("Thinking...")).toBeInTheDocument();
    });

    it("disables the button during API call", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", async () => {
          await delay("infinite");
          return HttpResponse.json({ suggestions: [] });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      const button = screen.getByRole("button", { name: /thinking/i });
      expect(button).toBeDisabled();
    });
  });

  describe("suggestions display", () => {
    it("shows checkboxes for each suggestion", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabytedb", "distributed sql", "ysql"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("Suggested terms:")).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
      expect(screen.getByText("yugabytedb")).toBeInTheDocument();
      expect(screen.getByText("distributed sql")).toBeInTheDocument();
      expect(screen.getByText("ysql")).toBeInTheDocument();
    });

    it("pre-selects new terms that are not already existing", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabyte", "yugabytedb", "ysql"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} existingTerms={["yugabyte"]} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("Suggested terms:")).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole("checkbox");
      // "yugabyte" is existing so it should be checked but disabled
      // "yugabytedb" and "ysql" are new so they should be pre-selected
      expect(checkboxes[0]).toBeChecked(); // yugabyte - existing
      expect(checkboxes[0]).toBeDisabled(); // yugabyte - disabled
      expect(checkboxes[1]).toBeChecked(); // yugabytedb - pre-selected
      expect(checkboxes[2]).toBeChecked(); // ysql - pre-selected
    });

    it("marks existing terms as disabled with '(already added)' label", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabyte", "yugabytedb"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} existingTerms={["yugabyte"]} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("(already added)")).toBeInTheDocument();
      });
    });
  });

  describe("selection interaction", () => {
    it("can toggle selection of a new term", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabytedb"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("yugabytedb")).toBeInTheDocument();
      });

      const checkbox = screen.getByRole("checkbox");
      // Initially pre-selected
      expect(checkbox).toBeChecked();

      // Uncheck it
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      // Check it again
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it("cannot toggle existing terms", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabyte"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} existingTerms={["yugabyte"]} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("yugabyte")).toBeInTheDocument();
      });

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    });
  });

  describe("adding selected terms", () => {
    it("calls onAdd with selected terms when Add Selected is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabytedb", "ysql"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText(/Add Selected/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Add Selected/));

      expect(defaultProps.onAdd).toHaveBeenCalledWith(
        expect.arrayContaining(["yugabytedb", "ysql"])
      );
    });

    it("shows count of selected items in Add Selected button", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabytedb", "ysql"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("Add Selected (2)")).toBeInTheDocument();
      });
    });

    it("disables Add Selected when no terms are selected", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabyte"], // Only existing term
          });
        })
      );

      render(<SuggestTerms {...defaultProps} existingTerms={["yugabyte"]} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("Add Selected (0)")).toBeInTheDocument();
      });

      const addButton = screen.getByText("Add Selected (0)").closest("button");
      expect(addButton).toBeDisabled();
    });

    it("clears suggestions after adding selected terms", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabytedb"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("yugabytedb")).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Add Selected/));

      expect(screen.queryByText("yugabytedb")).not.toBeInTheDocument();
      expect(screen.queryByText("Suggested terms:")).not.toBeInTheDocument();
    });

    it("does not add existing terms even if somehow selected", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            suggestions: ["yugabyte", "yugabytedb"],
          });
        })
      );

      render(<SuggestTerms {...defaultProps} existingTerms={["yugabyte"]} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText(/Add Selected/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Add Selected/));

      // Should only add the new term, not the existing one
      expect(defaultProps.onAdd).toHaveBeenCalledWith(["yugabytedb"]);
    });
  });

  describe("error handling", () => {
    it("shows error message when API returns MISSING_API_KEY", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            error: "No API key configured",
            code: "MISSING_API_KEY",
          }, { status: 422 });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("No API key configured")).toBeInTheDocument();
      });
    });

    it("shows error message when API returns INVALID_API_KEY", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            error: "Your Groq API key is invalid",
            code: "INVALID_API_KEY",
          }, { status: 401 });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(
          screen.getByText("Your Groq API key is invalid")
        ).toBeInTheDocument();
      });
    });

    it("shows generic error on network failure", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.error();
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(
          screen.getByText("Failed to get suggestions. Please try again.")
        ).toBeInTheDocument();
      });
    });

    it("shows error when API returns generic error", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({
            error: "Something went wrong",
          });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });
  });

  describe("rate limiting", () => {
    it("disables button for 2 seconds after clicking", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(
        http.post("*/api/suggest-terms", () => {
          return HttpResponse.json({ suggestions: ["term1"] });
        })
      );

      render(<SuggestTerms {...defaultProps} />);
      await user.click(screen.getByText("Suggest Terms"));

      // Wait for the API call to complete
      await waitFor(() => {
        expect(screen.getByText("Suggested terms:")).toBeInTheDocument();
      });

      // Button should still be disabled due to 2-second rate limit
      const button = screen.getByRole("button", { name: /suggest terms/i });
      expect(button).toBeDisabled();

      // Advance past the 2-second timeout
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe("API call", () => {
    it("sends POST request to /api/suggest-terms with tagName", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      let capturedBody: unknown;
      server.use(
        http.post("*/api/suggest-terms", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ suggestions: [] });
        })
      );

      render(<SuggestTerms {...defaultProps} tagName="TestTag" />);
      await user.click(screen.getByText("Suggest Terms"));

      await waitFor(() => {
        expect(capturedBody).toEqual({ tagName: "TestTag" });
      });
    });
  });
});
