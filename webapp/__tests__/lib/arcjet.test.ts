import { describe, it, expect, vi, beforeEach } from "vitest";

const mockArcjet = vi.fn().mockReturnValue({ withRule: vi.fn() });
const mockShield = vi.fn().mockReturnValue({ type: "shield", mode: "LIVE" });

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

  it("creates client with ARCJET_KEY and Shield in LIVE mode", async () => {
    await import("@/lib/arcjet");

    expect(mockShield).toHaveBeenCalledWith({ mode: "LIVE" });
    expect(mockArcjet).toHaveBeenCalledWith({
      key: "ajkey_test_123",
      rules: [{ type: "shield", mode: "LIVE" }],
    });
  });

  it("exports the client as default", async () => {
    const arcjetModule = await import("@/lib/arcjet");
    expect(arcjetModule.default).toBeDefined();
  });
});
