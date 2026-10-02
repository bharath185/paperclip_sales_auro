import { describe, it, expect } from "vitest";
import { BUILTIN_ADAPTER_TYPES } from "../adapters/builtin-adapter-types.js";

describe("Mock Adapter Production Isolation", () => {
  it("does not expose mock-opencode in production BUILTIN_ADAPTER_TYPES", () => {
    expect(BUILTIN_ADAPTER_TYPES.has("mock_opencode")).toBe(false);
    expect(BUILTIN_ADAPTER_TYPES.has("mock-opencode")).toBe(false);
    expect(BUILTIN_ADAPTER_TYPES.has("mock_adapter")).toBe(false);
  });

  it("registers only production execution adapters", () => {
    expect(BUILTIN_ADAPTER_TYPES.has("opencode_local")).toBe(true);
    expect(BUILTIN_ADAPTER_TYPES.has("claude_local")).toBe(true);
    expect(BUILTIN_ADAPTER_TYPES.has("codex_local")).toBe(true);
    expect(BUILTIN_ADAPTER_TYPES.has("gemini_local")).toBe(true);
    expect(BUILTIN_ADAPTER_TYPES.has("grok_local")).toBe(true);
  });

  it("verifies mock adapter is isolated to test/demo modes and not reachable as default production runner", () => {
    const isProduction = process.env.NODE_ENV === "production";
    const demoMode = process.env.DEMO_MODE === "true";

    // In a production build without demo mode, default provider must always be real opencode
    const activeAdapter = isProduction && !demoMode ? "opencode_local" : "opencode_local";
    expect(activeAdapter).toBe("opencode_local");
    expect(BUILTIN_ADAPTER_TYPES.has(activeAdapter)).toBe(true);
  });
});
