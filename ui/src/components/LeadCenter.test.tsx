// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LeadCenter } from "./LeadCenter";
import { salesApi, type LeadRecordDto, type CampaignRecordDto } from "@/api/sales";

vi.mock("@/api/sales", () => ({
  salesApi: {
    listLeads: vi.fn(),
    runResearch: vi.fn(),
    syncCrm: vi.fn(),
    getCsvExportUrl: vi.fn().mockImplementation((cid, campId) => `/api/companies/${cid}/sales/campaigns/${campId}/export-csv`),
  },
}));

describe("LeadCenter Component", () => {
  let container: HTMLDivElement;

  const mockCampaign: CampaignRecordDto = {
    id: "camp-001",
    companyId: "comp-001",
    name: "Bengaluru Precision Manufacturing Outbound Q4",
    status: "running",
    brief: {
      name: "Bengaluru Precision Manufacturing Outbound Q4",
      industry: "Manufacturing",
      location: "Bengaluru",
      targetTitles: ["VP of Operations"],
      offerProposition: "Cutting tooling cycle times",
    },
    stats: {
      totalLeadsFound: 2,
      leadsApproved: 2,
      emailsGenerated: 2,
      emailsSent: 0,
      repliesReceived: 0,
      hotLeadsCount: 0,
      crmSyncedCount: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockLeads: LeadRecordDto[] = [
    {
      id: "lead-1",
      companyId: "comp-001",
      companyName: "Precision Aero Components Pvt Ltd",
      companyDomain: "precisionaero.co.in",
      industry: "Manufacturing",
      subSegment: "Aerospace Precision Machining",
      locationCity: "Bengaluru",
      contactName: "Rajesh Kumar",
      contactTitle: "VP of Manufacturing Operations",
      contactEmail: "rajesh.kumar@precisionaero.co.in",
      contactPhone: "+91 80 2839 1234",
      leadScore: 90,
      verificationStatus: "verified",
      crmStage: "qualified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "lead-2",
      companyId: "comp-001",
      companyName: "Apex Tooling & Die Works",
      companyDomain: "apextooling.in",
      industry: "Manufacturing",
      subSegment: "Machine Tools & Dies",
      locationCity: "Bengaluru",
      contactName: "Ananya Deshmukh",
      contactTitle: "Head of Tooling Engineering",
      contactEmail: "ananya.d@apextooling.in",
      contactPhone: "+91 80 2783 5678",
      leadScore: 85,
      verificationStatus: "verified",
      crmStage: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
    vi.mocked(salesApi.listLeads).mockResolvedValue(mockLeads);
  });

  it("renders lead table with discovered company records and scores", async () => {
    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<LeadCenter companyId="comp-001" campaign={mockCampaign} />);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(container.textContent).toContain("Lead Database & Market Intelligence");
    expect(container.textContent).toContain("Precision Aero Components Pvt Ltd");
    expect(container.textContent).toContain("Apex Tooling & Die Works");
    expect(container.textContent).toContain("90/100");
    expect(container.textContent).toContain("85/100");
  });

  it("triggers researcher dispatch on button click", async () => {
    vi.mocked(salesApi.runResearch).mockResolvedValue({ success: true, count: 2, leads: mockLeads });

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<LeadCenter companyId="comp-001" campaign={mockCampaign} />);
    });

    const dispatchBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Dispatch Researchers")
    );
    expect(dispatchBtn).toBeDefined();

    await flushSync(async () => {
      dispatchBtn?.click();
    });

    expect(salesApi.runResearch).toHaveBeenCalledWith("comp-001", "camp-001");
  });
});
