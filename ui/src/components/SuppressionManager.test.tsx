// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SuppressionManager } from "./SuppressionManager";
import { salesApi } from "@/api/sales";

vi.mock("@/api/sales", () => ({
  salesApi: {
    listSuppressions: vi.fn(),
    addSuppression: vi.fn(),
  },
}));

describe("SuppressionManager", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("renders suppression list showing zero raw PII and active SHA-256 hashed suppression entries", async () => {
    vi.mocked(salesApi.listSuppressions).mockResolvedValue({
      suppressions: [
        "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
        "f9e8d7c6b5a4039281706f5e4d3c2b1a0f9e8d7c6b5a4039281706f5e4d3c2b1",
      ],
    });

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<SuppressionManager companyId="comp-1" />);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(container.textContent).toContain("Global Email Suppression & Privacy Safeguards");
    expect(container.textContent).toContain("Hashed Suppression Registry (2 Records)");
    expect(container.textContent).toContain("a1b2c3d4e5f60718");
  });

  it("adds new email to suppression list and shows confirmation with SHA-256 hash", async () => {
    vi.mocked(salesApi.listSuppressions).mockResolvedValue({
      suppressions: [],
    });
    vi.mocked(salesApi.addSuppression).mockResolvedValue({
      success: true,
      emailHash: "9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef",
    });

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<SuppressionManager companyId="comp-1" />);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeDefined();

    // In React 19 / controlled component: set value and call native value setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    nativeInputValueSetter?.call(input, "optout@targetcorp.in");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const form = container.querySelector("form") as HTMLFormElement;
    expect(form).toBeDefined();

    await flushSync(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(salesApi.addSuppression).toHaveBeenCalledWith("comp-1", "optout@targetcorp.in");
    expect(container.textContent).toContain("Address suppressed permanently with SHA-256 hash");
  });
});
