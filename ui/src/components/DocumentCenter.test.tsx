// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { DocumentCenter } from "./DocumentCenter";
import { governanceApi } from "@/api/governance";

vi.mock("@/api/governance", () => ({
  governanceApi: {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    reviewDocument: vi.fn(),
    approvePack: vi.fn(),
    getExportUrl: vi.fn().mockImplementation((_cid, format) => `/api/companies/test/governance/export/${format}`),
  },
}));

describe("DocumentCenter Component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();

    vi.mocked(governanceApi.listDocuments).mockResolvedValue({
      projectName: "Project Auro Demo",
      packStatus: "in_review",
      documents: [
        {
          kind: "charter",
          title: "Project Charter & Vision",
          fileName: "CHARTER.md",
          authorRole: "ceo",
          currentVersion: 1,
          versionCount: 1,
          reviewCount: 0,
          isValid: true,
          missingSections: [],
          foundSections: ["Executive Summary", "Problem Statement"],
        },
        {
          kind: "prd",
          title: "Product Requirements Document",
          fileName: "PRD.md",
          authorRole: "pm",
          currentVersion: 2,
          versionCount: 2,
          reviewCount: 1,
          isValid: true,
          missingSections: [],
          foundSections: ["Product Overview", "Functional Requirements"],
        },
      ],
    });

    vi.mocked(governanceApi.getDocument).mockResolvedValue({
      kind: "charter",
      title: "Project Charter & Vision",
      fileName: "CHARTER.md",
      authorRole: "ceo",
      currentVersion: 1,
      content: "# Project Charter\n## Executive Summary\nSummary text.\n## Problem Statement\nProblem text.",
      isValid: true,
      missingSections: [],
      foundSections: ["Executive Summary", "Problem Statement"],
      versions: [
        {
          version: 1,
          content: "# Project Charter\n## Executive Summary\nSummary text.",
          authorRole: "ceo",
          changeSummary: "Initial draft",
          createdAt: new Date().toISOString(),
        },
      ],
      reviews: [
        {
          reviewerRole: "qa",
          status: "approved",
          comments: "Reviewed and approved by QA Lead.",
          createdAt: new Date().toISOString(),
        },
      ],
    });
  });

  it("renders Document Center header, status, and export buttons", async () => {
    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<DocumentCenter companyId="test-company" />);
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Document Center: Project Auro Demo");
      expect(container.textContent).toContain("In Review");
      expect(container.textContent).toContain("ZIP");
      expect(container.textContent).toContain("PDF");
      expect(container.textContent).toContain("DOCX");
      expect(container.textContent).toContain("Jira CSV");
      expect(container.textContent).toContain("XLSX");
      expect(container.textContent).toContain("CEO Pack Sign-off");
    });
  });

  it("displays document list and loads selected document details", async () => {
    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<DocumentCenter companyId="test-company" />);
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Project Charter & Vision");
      expect(container.textContent).toContain("Product Requirements Document");
      expect(container.textContent).toContain("CHARTER.md");
      expect(container.textContent).toContain("Valid Section Structure");
    });
  });

  it("triggers CEO Pack approval on button click", async () => {
    vi.mocked(governanceApi.approvePack).mockResolvedValue({
      success: true,
      packStatus: "approved",
      message: "Project Governance Pack has been formally APPROVED by the CEO.",
      projectName: "Project Auro Demo",
      approvedAt: new Date().toISOString(),
    });

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<DocumentCenter companyId="test-company" />);
    });

    await vi.waitFor(() => {
      expect(container.querySelector("button")).toBeTruthy();
    });

    const approveButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("CEO Pack Sign-off"),
    );
    expect(approveButton).toBeDefined();

    await flushSync(async () => {
      approveButton?.click();
    });

    await vi.waitFor(() => {
      expect(governanceApi.approvePack).toHaveBeenCalledWith("test-company");
    });
  });

  it("switches to Markdown Editor tab, allows editing, and saves a new document version", async () => {
    vi.mocked(governanceApi.updateDocument).mockResolvedValue({
      success: true,
      kind: "charter",
      version: 2,
      isValid: true,
      missingSections: [],
      document: {
        kind: "charter",
        title: "Project Charter & Vision",
        fileName: "CHARTER.md",
        authorRole: "ceo",
        currentVersion: 2,
        content: "# Project Charter Updated",
        isValid: true,
        missingSections: [],
        foundSections: ["Executive Summary"],
        versions: [],
        reviews: [],
      },
    });

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<DocumentCenter companyId="test-company" />);
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("CHARTER.md");
    });

    const editTabBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.trim() === "Edit",
    );
    expect(editTabBtn).toBeDefined();

    await flushSync(async () => {
      editTabBtn?.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector("textarea")).toBeTruthy();
    });

    const textarea = container.querySelector("textarea")!;
    const summaryInput = container.querySelector("input[placeholder*='Added section']")!;

    await flushSync(async () => {
      textarea.value = "# Project Charter Updated\n## Executive Summary\nNew summary.";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));

      if (summaryInput) {
        (summaryInput as HTMLInputElement).value = "Revised executive summary";
        summaryInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save New Version"),
    );
    expect(saveBtn).toBeDefined();

    await flushSync(async () => {
      saveBtn?.click();
    });

    await vi.waitFor(() => {
      expect(governanceApi.updateDocument).toHaveBeenCalled();
    });
  });
});
