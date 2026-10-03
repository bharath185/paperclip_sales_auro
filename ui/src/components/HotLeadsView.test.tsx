// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { HotLeadsView } from "./HotLeadsView";
import { salesApi, type HotLeadEventDto } from "@/api/sales";

vi.mock("@/api/sales", () => ({
  salesApi: {
    listHotLeads: vi.fn(),
  },
}));

describe("HotLeadsView", () => {
  let container: HTMLDivElement;

  const mockHotLeads: HotLeadEventDto[] = [
    {
      id: "hl-1",
      companyId: "comp-1",
      campaignId: "camp-1",
      leadId: "lead-1",
      contactName: "Karthik Subramanian",
      contactEmail: "karthik.s@bengaluru-gears.com",
      companyName: "Bengaluru Precision Gears Pvt Ltd",
      sentiment: "meeting_requested",
      replySnippet: "Wants to connect next Tuesday at 3 PM to evaluate automation tooling.",
      detectedAt: "2026-10-02T14:30:00Z",
    },
  ];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it("renders empty state when no hot inbound replies exist", async () => {
    vi.mocked(salesApi.listHotLeads).mockResolvedValue([]);

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<HotLeadsView companyId="comp-1" />);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(container.textContent).toContain("No Hot Inbound Replies Yet");
  });

  it("renders hot leads list with sentiment badge, contact details, and meeting summary", async () => {
    vi.mocked(salesApi.listHotLeads).mockResolvedValue(mockHotLeads);

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<HotLeadsView companyId="comp-1" />);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => {});

    expect(container.textContent).toContain("Karthik Subramanian");
    expect(container.textContent).toContain("Bengaluru Precision Gears Pvt Ltd");
    expect(container.textContent).toContain("Wants to connect next Tuesday");
    expect(container.textContent).toContain("Meeting Requested");
  });
});
