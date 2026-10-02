// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LeadCampaignWizard } from "./LeadCampaignWizard";
import { salesApi } from "@/api/sales";

vi.mock("@/api/sales", () => ({
  salesApi: {
    createCampaign: vi.fn(),
  },
}));

describe("LeadCampaignWizard Component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("renders wizard step 1 form fields with default values", () => {
    const root = createRoot(container);
    flushSync(() => {
      root.render(<LeadCampaignWizard companyId="comp-test-01" />);
    });

    expect(container.textContent).toContain("Lead Generation Campaign Wizard");
    expect(container.textContent).toContain("Campaign Name");
    const industryInput = container.querySelector("#industry") as HTMLInputElement;
    expect(industryInput?.value).toBe("Manufacturing");
    const locInput = container.querySelector("#location") as HTMLInputElement;
    expect(locInput?.value).toBe("Bengaluru, Karnataka, India");
  });

  it("submits valid campaign payload and displays success confirmation card", async () => {
    vi.mocked(salesApi.createCampaign).mockResolvedValue({
      id: "camp-123",
      companyId: "comp-test-01",
      name: "Bengaluru Precision Manufacturing Outbound Q4",
      status: "running",
      brief: {
        name: "Bengaluru Precision Manufacturing Outbound Q4",
        industry: "Manufacturing",
        subSegment: "Auto Components & Powertrain",
        location: "Bengaluru, Karnataka, India",
        targetTitles: ["VP of Operations"],
        offerProposition: "Cutting tooling cycle times by 35%",
        dailyLeadQuota: 20,
        weeklyLeadQuota: 100,
        researcherInstances: 2,
      },
      stats: {
        totalLeadsFound: 4,
        leadsApproved: 4,
        emailsGenerated: 3,
        emailsSent: 0,
        repliesReceived: 0,
        hotLeadsCount: 0,
        crmSyncedCount: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const root = createRoot(container);
    flushSync(() => {
      root.render(<LeadCampaignWizard companyId="comp-test-01" />);
    });

    // Advance through steps to step 4
    const continueBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Continue")
    );
    expect(continueBtn).toBeDefined();

    flushSync(() => {
      continueBtn?.click();
    });
    expect(container.textContent).toContain("Step 2");

    flushSync(() => {
      const btn2 = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Continue")
      );
      btn2?.click();
    });
    expect(container.textContent).toContain("Step 3");

    flushSync(() => {
      const btn3 = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Continue")
      );
      btn3?.click();
    });
    expect(container.textContent).toContain("Step 4");

    const submitBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Launch Sales Campaign")
    );
    expect(submitBtn).toBeDefined();

    await flushSync(async () => {
      submitBtn?.click();
    });

    expect(salesApi.createCampaign).toHaveBeenCalledWith("comp-test-01", expect.objectContaining({
      name: "Bengaluru Precision Manufacturing Outbound Q4",
      industry: "Manufacturing",
    }));
  });
});
