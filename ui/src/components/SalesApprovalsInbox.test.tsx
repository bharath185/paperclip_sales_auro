// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SalesApprovalsInbox } from "./SalesApprovalsInbox";
import { salesApi, type LeadApprovalBatchDto, type CampaignRecordDto } from "@/api/sales";

vi.mock("@/api/sales", () => ({
  salesApi: {
    listApprovalBatches: vi.fn(),
    approveBatch: vi.fn(),
  },
}));

describe("SalesApprovalsInbox", () => {
  let container: HTMLDivElement;

  const mockCampaign: CampaignRecordDto = {
    id: "camp-1",
    companyId: "comp-1",
    name: "Bengaluru Industrial Machining Q4",
    status: "running",
    brief: {
      name: "Bengaluru Industrial Machining Q4",
      industry: "Manufacturing",
      location: "Bengaluru",
      targetTitles: ["VP of Manufacturing Operations"],
      offerProposition: "Industrial automation solutions",
    },
    stats: {
      totalLeadsFound: 1,
      leadsApproved: 0,
      emailsGenerated: 0,
      emailsSent: 0,
      repliesReceived: 0,
      hotLeadsCount: 0,
      crmSyncedCount: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockBatch: LeadApprovalBatchDto = {
    id: "batch-1",
    companyId: "comp-1",
    campaignId: "camp-1",
    status: "pending",
    createdAt: new Date().toISOString(),
    leads: [
      {
        id: "lead-1",
        companyId: "comp-1",
        companyName: "Precision Aero Components Pvt Ltd",
        companyDomain: "precisionaero.co.in",
        industry: "Manufacturing",
        subSegment: "Aerospace Machining",
        locationCity: "Bengaluru",
        contactName: "Rajesh Kumar",
        contactTitle: "VP of Manufacturing Operations",
        contactEmail: "rajesh.kumar@precisionaero.co.in",
        leadScore: 95,
        verificationStatus: "verified",
        crmStage: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("renders pending approval batch and lets operator approve verified prospects", async () => {
    vi.mocked(salesApi.listApprovalBatches).mockResolvedValue([mockBatch]);
    vi.mocked(salesApi.approveBatch).mockResolvedValue(mockBatch);

    const onBatchApproved = vi.fn();

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(
        <SalesApprovalsInbox
          companyId="comp-1"
          campaign={mockCampaign}
          onBatchApproved={onBatchApproved}
        />
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(container.textContent).toContain("Precision Aero Components Pvt Ltd");
    expect(container.textContent).toContain("Rajesh Kumar (VP of Manufacturing Operations)");
    expect(container.textContent).toContain("Approve & Schedule Sequence (1)");

    const approveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Approve & Schedule Sequence")
    );
    expect(approveBtn).toBeDefined();

    await flushSync(async () => {
      approveBtn?.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(salesApi.approveBatch).toHaveBeenCalledWith("comp-1", "camp-1", "batch-1", ["lead-1"]);
    expect(onBatchApproved).toHaveBeenCalled();
  });

  it("renders empty state when no pending batches exist", async () => {
    vi.mocked(salesApi.listApprovalBatches).mockResolvedValue([]);

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(
        <SalesApprovalsInbox
          companyId="comp-1"
          campaign={mockCampaign}
        />
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(container.textContent).toContain("No Pending Lead Batches");
    expect(container.textContent).toContain("All discovered leads have been approved");
  });
});
