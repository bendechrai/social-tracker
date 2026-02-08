import { describe, it, expect, vi, beforeEach } from "vitest";

const mockArcjet = vi.fn().mockReturnValue({ withRule: vi.fn() });
const mockShield = vi.fn().mockReturnValue({ type: "shield", mode: "DRY_RUN" });

vi.mock("@arcjet/next", () => ({
  default: (...args: unknown[]) => mockArcjet(...args),
  shield: (...args: unknown[]) => mockShield(...args),
}));

describe("Arcjet client", () => {
  beforeEach(() => {
    vi.resetModules();
    mockArcjet.mockClear();
    mockShield.mockClear();
    process.env.ARCJET_KEY = "ajkey_test_123";
  });

  it("creates client with ARCJET_KEY and Shield in DRY_RUN mode in non-production", async () => {
    await import("@/lib/arcjet");

    expect(mockShield).toHaveBeenCalledWith({ mode: "DRY_RUN" });
    expect(mockArcjet).toHaveBeenCalledWith({
      key: "ajkey_test_123",
      rules: [{ type: "shield", mode: "DRY_RUN" }],
    });
  });

  it("exports ajMode based on NODE_ENV", async () => {
    const arcjetModule = await import("@/lib/arcjet");
    expect(arcjetModule.ajMode).toBe("DRY_RUN");
  });

  it("exports the client as default", async () => {
    const arcjetModule = await import("@/lib/arcjet");
    expect(arcjetModule.default).toBeDefined();
  });
});
