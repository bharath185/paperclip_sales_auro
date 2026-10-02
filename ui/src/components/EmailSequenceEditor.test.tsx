// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { EmailSequenceEditor } from "./EmailSequenceEditor";

describe("EmailSequenceEditor Component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("renders 3-touch sequence editor with default merge tags", () => {
    const root = createRoot(container);
    flushSync(() => {
      root.render(<EmailSequenceEditor companyId="comp-001" campaignId="camp-001" />);
    });

    expect(container.textContent).toContain("3-Touch Email Sequence Architect");
    expect(container.textContent).toContain("Touch 1 (Day 0)");
    expect(container.textContent).toContain("Touch 2 (+3d)");
    expect(container.textContent).toContain("Touch 3 (+7d)");
    expect(container.textContent).toContain("Statutory Footer Injection Active");
  });

  it("toggles into live simulated preview mode with sample lead details", () => {
    const root = createRoot(container);
    flushSync(() => {
      root.render(<EmailSequenceEditor companyId="comp-001" campaignId="camp-001" />);
    });

    const previewBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Live Preview")
    );
    expect(previewBtn).toBeDefined();

    flushSync(() => {
      previewBtn?.click();
    });

    expect(container.textContent).toContain("rajesh.kumar@precisionaero.co.in");
    expect(container.textContent).toContain("Precision Aero Components Pvt Ltd");
    expect(container.textContent).toContain("Unsubscribe from future communications");
  });
});
