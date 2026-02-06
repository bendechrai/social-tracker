/**
 * Unit tests for utils.ts
 *
 * Tests the cn() utility function which merges CSS class names using
 * clsx and tailwind-merge. This is a foundational utility used across
 * all UI components for conditional and merged Tailwind class handling.
 */
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (class name merge utility)", () => {
  it("should return empty string with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("should pass through a single class name", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("should merge multiple class names", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("should handle conditional classes via clsx", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
    expect(cn("base", true && "hidden", "visible")).toBe("base hidden visible");
  });

  it("should handle undefined and null values", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("should handle object syntax for conditional classes", () => {
    expect(cn({ "text-red-500": true, "bg-blue-500": false })).toBe(
      "text-red-500"
    );
  });

  it("should handle array syntax", () => {
    expect(cn(["text-red-500", "bg-blue-500"])).toBe("text-red-500 bg-blue-500");
  });

  it("should resolve Tailwind conflicts by keeping the last class", () => {
    // tailwind-merge resolves conflicting utility classes
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should resolve conflicting padding classes", () => {
    expect(cn("p-4", "px-2")).toBe("p-4 px-2");
  });

  it("should handle mixed conditional and Tailwind merge", () => {
    const isActive = true;
    expect(
      cn("bg-gray-100", isActive && "bg-blue-500", "rounded")
    ).toBe("bg-blue-500 rounded");
  });

  it("should handle empty strings", () => {
    expect(cn("", "text-red-500", "")).toBe("text-red-500");
  });

  it("should handle complex real-world usage patterns", () => {
    const variant: string = "primary";
    const disabled = false;
    const result = cn(
      "inline-flex items-center rounded-md",
      variant === "primary" && "bg-blue-500 text-white",
      variant === "secondary" && "bg-gray-200 text-gray-900",
      disabled && "opacity-50 cursor-not-allowed"
    );
    expect(result).toBe(
      "inline-flex items-center rounded-md bg-blue-500 text-white"
    );
  });
});
