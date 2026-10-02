// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import React from "react";
import { GovernanceOrgCard } from "./GovernanceOrgCard";
import { governanceApi } from "@/api/governance";

vi.mock("@/api/governance", () => ({
  governanceApi: {
    getStatus: vi.fn(),
    createOrg: vi.fn(),
  },
}));

describe("GovernanceOrgCard Component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("renders governance org roles, reporting lines, and provision button", async () => {
    vi.mocked(governanceApi.getStatus).mockResolvedValueOnce({
      isComplete: false,
      count: 0,
      agents: [],
    });

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<GovernanceOrgCard companyId="company-1" />);
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Project Governance Organization Template");
      expect(container.textContent).toContain("Chief Executive Officer");
      expect(container.textContent).toContain("Chief Technology Officer");
      expect(container.textContent).toContain("Product Manager");
      expect(container.textContent).toContain("Quality Assurance Lead");
      expect(container.textContent).toContain("DevOps Engineer");
      expect(container.textContent).toContain("Security Officer");
      expect(container.textContent).toContain("One-Click Provision Governance Org");
    });
  });

  it("triggers org provisioning on button click", async () => {
    vi.mocked(governanceApi.getStatus).mockResolvedValue({
      isComplete: false,
      count: 0,
      agents: [],
    });

    vi.mocked(governanceApi.createOrg).mockResolvedValueOnce({
      success: true,
      projectId: "proj-1",
      agents: [],
    });

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<GovernanceOrgCard companyId="company-1" />);
    });

    await vi.waitFor(() => {
      const btn = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("One-Click Provision Governance Org"),
      );
      expect(btn).toBeDefined();
      expect(btn?.disabled).toBe(false);
    });

    const provisionBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("One-Click Provision Governance Org"),
    );

    await flushSync(async () => {
      provisionBtn?.click();
    });

    await vi.waitFor(() => {
      expect(governanceApi.createOrg).toHaveBeenCalledWith("company-1");
      expect(container.textContent).toContain("All 6 executive and operational agents created");
    });
  });
});
