/**
 * Unit tests for the Pagination component.
 *
 * These tests verify that pagination controls:
 * - Render correct page numbers and total pages
 * - Disable states work correctly at boundaries
 * - Page size change resets to page 1
 * - Keyboard navigation works
 * - Respects disabled state
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "@/components/ui/pagination";

describe("Pagination component", () => {
  const defaultProps = {
    page: 1,
    totalPages: 5,
    total: 100,
    pageSize: 20,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders page indicator with correct format", () => {
      render(<Pagination {...defaultProps} page={2} totalPages={10} />);

      expect(screen.getByText("Page 2 of 10")).toBeInTheDocument();
    });

    it("renders total items count", () => {
      render(<Pagination {...defaultProps} total={100} />);

      expect(screen.getByText(/of 100 items/)).toBeInTheDocument();
    });

    it("uses singular 'item' for 1 item", () => {
      render(<Pagination {...defaultProps} total={1} totalPages={1} />);

      expect(screen.getByText(/of 1 item$/)).toBeInTheDocument();
    });

    it("renders page size selector with options", () => {
      render(<Pagination {...defaultProps} pageSize={10} />);

      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue("10");
    });

    it("renders custom page size options", () => {
      render(
        <Pagination
          {...defaultProps}
          pageSize={50}
          pageSizeOptions={[25, 50, 100]}
        />
      );

      const select = screen.getByRole("combobox");
      expect(select).toHaveValue("50");

      // Check options exist
      expect(screen.getByRole("option", { name: "25" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "50" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "100" })).toBeInTheDocument();
    });

    it("does not render when total is 0", () => {
      const { container } = render(
        <Pagination {...defaultProps} total={0} totalPages={0} />
      );

      expect(container.querySelector("nav")).not.toBeInTheDocument();
    });
  });

  describe("disabled states", () => {
    it("disables Previous button on first page", () => {
      render(<Pagination {...defaultProps} page={1} />);

      const prevButton = screen.getByLabelText("Go to previous page");
      expect(prevButton).toBeDisabled();
    });

    it("enables Previous button on pages > 1", () => {
      render(<Pagination {...defaultProps} page={2} />);

      const prevButton = screen.getByLabelText("Go to previous page");
      expect(prevButton).not.toBeDisabled();
    });

    it("disables Next button on last page", () => {
      render(<Pagination {...defaultProps} page={5} totalPages={5} />);

      const nextButton = screen.getByLabelText("Go to next page");
      expect(nextButton).toBeDisabled();
    });

    it("enables Next button when not on last page", () => {
      render(<Pagination {...defaultProps} page={4} totalPages={5} />);

      const nextButton = screen.getByLabelText("Go to next page");
      expect(nextButton).not.toBeDisabled();
    });

    it("disables all controls when disabled prop is true", () => {
      render(<Pagination {...defaultProps} page={3} disabled />);

      const prevButton = screen.getByLabelText("Go to previous page");
      const nextButton = screen.getByLabelText("Go to next page");
      const select = screen.getByRole("combobox");

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
      expect(select).toBeDisabled();
    });
  });

  describe("navigation", () => {
    it("calls onPageChange with previous page when Previous clicked", async () => {
      const onPageChange = vi.fn();
      render(
        <Pagination {...defaultProps} page={3} onPageChange={onPageChange} />
      );

      const prevButton = screen.getByLabelText("Go to previous page");
      await userEvent.click(prevButton);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it("calls onPageChange with next page when Next clicked", async () => {
      const onPageChange = vi.fn();
      render(
        <Pagination {...defaultProps} page={3} onPageChange={onPageChange} />
      );

      const nextButton = screen.getByLabelText("Go to next page");
      await userEvent.click(nextButton);

      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it("does not call onPageChange when Previous clicked on first page", async () => {
      const onPageChange = vi.fn();
      render(
        <Pagination {...defaultProps} page={1} onPageChange={onPageChange} />
      );

      const prevButton = screen.getByLabelText("Go to previous page");
      await userEvent.click(prevButton);

      expect(onPageChange).not.toHaveBeenCalled();
    });

    it("does not call onPageChange when Next clicked on last page", async () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          {...defaultProps}
          page={5}
          totalPages={5}
          onPageChange={onPageChange}
        />
      );

      const nextButton = screen.getByLabelText("Go to next page");
      await userEvent.click(nextButton);

      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe("page size changes", () => {
    it("calls onPageSizeChange when page size is changed", async () => {
      const onPageSizeChange = vi.fn();
      const onPageChange = vi.fn();
      render(
        <Pagination
          {...defaultProps}
          pageSize={20}
          onPageSizeChange={onPageSizeChange}
          onPageChange={onPageChange}
        />
      );

      const select = screen.getByRole("combobox");
      await userEvent.selectOptions(select, "50");

      expect(onPageSizeChange).toHaveBeenCalledWith(50);
    });

    it("resets to page 1 when page size changes", async () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          {...defaultProps}
          page={3}
          pageSize={20}
          onPageChange={onPageChange}
        />
      );

      const select = screen.getByRole("combobox");
      await userEvent.selectOptions(select, "50");

      expect(onPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe("keyboard navigation", () => {
    it("navigates to previous page on ArrowLeft", () => {
      const onPageChange = vi.fn();
      render(
        <Pagination {...defaultProps} page={3} onPageChange={onPageChange} />
      );

      const nav = screen.getByRole("navigation");
      fireEvent.keyDown(nav, { key: "ArrowLeft" });

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it("navigates to next page on ArrowRight", () => {
      const onPageChange = vi.fn();
      render(
        <Pagination {...defaultProps} page={3} onPageChange={onPageChange} />
      );

      const nav = screen.getByRole("navigation");
      fireEvent.keyDown(nav, { key: "ArrowRight" });

      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it("does not navigate when disabled", () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          {...defaultProps}
          page={3}
          onPageChange={onPageChange}
          disabled
        />
      );

      const nav = screen.getByRole("navigation");
      fireEvent.keyDown(nav, { key: "ArrowLeft" });
      fireEvent.keyDown(nav, { key: "ArrowRight" });

      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has accessible navigation role", () => {
      render(<Pagination {...defaultProps} />);

      expect(screen.getByRole("navigation")).toHaveAttribute(
        "aria-label",
        "Pagination"
      );
    });

    it("has accessible button labels", () => {
      render(<Pagination {...defaultProps} />);

      expect(
        screen.getByLabelText("Go to previous page")
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
    });

    it("has live region for page indicator", () => {
      render(<Pagination {...defaultProps} />);

      const pageIndicator = screen.getByText("Page 1 of 5");
      expect(pageIndicator).toHaveAttribute("aria-live", "polite");
    });
  });
});
