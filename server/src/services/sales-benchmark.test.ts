import { describe, it, expect } from "vitest";
import { SalesCampaignService, type SalesLead, type CampaignBrief } from "./sales-campaign.js";

describe("Sales Leads 10k Benchmark & Resilience Test", () => {
  it("benchmarks pagination, search, and filtering over 10,000 leads with sub-50ms latency", async () => {
    const service = new SalesCampaignService();
    const brief: CampaignBrief = {
      companyId: "comp-perf-001",
      name: "Scale Benchmark Campaign",
      industry: "Manufacturing",
      location: "Bengaluru",
      targetTitles: ["Plant Head", "VP Operations"],
      offerProposition: "Scale test proposition",
      dailyLeadQuota: 25,
      weeklyLeadQuota: 100,
    };

    const campaign = await service.createCampaign(brief);

    // Seed 10,000 simulated leads
    const largeBatch: SalesLead[] = [];
    const industries = ["Manufacturing", "Automotive", "Aerospace", "Electronics", "Precision Tooling"];
    const statuses: SalesLead["status"][] = ["discovered", "approved", "sequence_active", "replied", "hot_lead"];

    for (let i = 1; i <= 10000; i++) {
      largeBatch.push({
        id: `lead-perf-${i}`,
        companyId: "comp-perf-001",
        campaignId: campaign.id,
        companyName: `Precision Enterprise ${i} Pvt Ltd`,
        website: `https://enterprise${i}.co.in`,
        domain: `enterprise${i}.co.in`,
        industry: industries[i % industries.length],
        subSegment: "Heavy Machining",
        location: i % 2 === 0 ? "Peenya Industrial Area, Bengaluru" : "Whitefield, Bengaluru",
        companySize: "50-200",
        decisionMakerName: `Executive Officer ${i}`,
        decisionMakerTitle: i % 3 === 0 ? "VP Operations" : "Plant Head",
        email: `exec.${i}@enterprise${i}.co.in`,
        phone: `+91 80 4000 ${String(i).padStart(4, "0")}`,
        sourceUrl: `https://enterprise${i}.co.in/about`,
        discoveredAt: new Date().toISOString(),
        score: (i % 100) + 1,
        status: statuses[i % statuses.length],
      });
    }

    // Direct injection into campaign store
    (service as any).leads.set(campaign.id, largeBatch);

    // 1. Pagination benchmark (page 1, 50 per page)
    const t0 = performance.now();
    const page1 = await service.listLeads("comp-perf-001", campaign.id, { page: 1, limit: 50 });
    const page1Duration = performance.now() - t0;

    expect(page1.leads).toHaveLength(50);
    expect(page1.total).toBe(10000);
    expect(page1Duration).toBeLessThan(50);

    // 2. Pagination benchmark (deep page: page 100)
    const t1 = performance.now();
    const page100 = await service.listLeads("comp-perf-001", campaign.id, { page: 100, limit: 50 });
    const page100Duration = performance.now() - t1;

    expect(page100.leads).toHaveLength(50);
    expect(page100Duration).toBeLessThan(50);

    // 3. Status filter benchmark
    const t2 = performance.now();
    const hotLeads = await service.listLeads("comp-perf-001", campaign.id, { status: "hot_lead", limit: 100 });
    const filterDuration = performance.now() - t2;

    expect(hotLeads.total).toBe(2000);
    expect(hotLeads.leads.length).toBe(100);
    expect(filterDuration).toBeLessThan(50);

    // 4. Score filter & search benchmark
    const t3 = performance.now();
    const highScorers = await service.listLeads("comp-perf-001", campaign.id, {
      minScore: 80,
      search: "Peenya",
      limit: 50,
    });
    const searchDuration = performance.now() - t3;

    expect(highScorers.total).toBeGreaterThan(0);
    expect(highScorers.leads.every((l) => l.score >= 80)).toBe(true);
    expect(searchDuration).toBeLessThan(50);
  });
});
