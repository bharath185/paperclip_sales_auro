// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Sales } from "./Sales";
import { salesApi } from "@/api/sales";

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({
    currentCompany: { id: "comp-test-01", name: "Auro Labs" },
    companies: [{ id: "comp-test-01", name: "Auro Labs" }],
  }),
}));

vi.mock("@/api/sales", () => ({
  salesApi: {
    listCampaigns: vi.fn().mockResolvedValue([
      {
        id: "camp-001",
        companyId: "comp-test-01",
        name: "Bengaluru Manufacturing Outbound Q4",
        status: "running",
        brief: {
          name: "Bengaluru Manufacturing Outbound Q4",
          industry: "Manufacturing",
          location: "Bengaluru",
          targetTitles: ["VP of Operations"],
          offerProposition: "Cutting tooling turnaround time",
        },
        stats: {
          totalLeadsFound: 12,
          leadsApproved: 8,
          emailsGenerated: 3,
          emailsSent: 20,
          repliesReceived: 3,
          hotLeadsCount: 1,
          crmSyncedCount: 8,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]),
    provisionSalesOrg: vi.fn().mockResolvedValue({ isComplete: true, count: 5, agents: [] }),
    listLeads: vi.fn().mockResolvedValue([]),
    listApprovalBatches: vi.fn().mockResolvedValue([]),
    listHotLeads: vi.fn().mockResolvedValue([]),
    listSuppressions: vi.fn().mockResolvedValue({ suppressions: [] }),
    getCsvExportUrl: vi.fn().mockImplementation((cid, campId) => `/api/companies/${cid}/sales/campaigns/${campId}/export-csv`),
  },
}));

describe("Sales Page", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("renders Sales page header and active campaign cards", async () => {
    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<Sales />);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(container.textContent).toContain("Sales & Lead Generation Organization");
    expect(container.textContent).toContain("Bengaluru Manufacturing Outbound Q4");
    expect(container.textContent).toContain("12"); // Leads Found
    expect(container.textContent).toContain("8"); // Approved
  });

  it("switches tabs between Campaigns, Lead Center, Sequences, and Suppressions", async () => {
    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<Sales />);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    // Click Lead Center tab
    const leadCenterTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Lead Center")
    );
    expect(leadCenterTab).toBeDefined();

    await flushSync(async () => {
      leadCenterTab?.click();
    });

    expect(container.textContent).toContain("Lead Database & Market Intelligence");

    // Click Sequences tab
    const seqTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("3-Touch Sequences")
    );
    expect(seqTab).toBeDefined();

    flushSync(() => {
      seqTab?.click();
    });

    expect(container.textContent).toContain("3-Touch Email Sequence Architect");
  });
});
