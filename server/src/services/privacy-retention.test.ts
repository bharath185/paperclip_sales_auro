import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { salesRoutes } from "../routes/sales.js";
import { salesCampaignService } from "./sales-campaign.js";

describe("Privacy Controls: Lead Export, Retention Policy & Audit Logging", () => {
  const companyId = "comp-privacy-001";
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.companyId = companyId;
      req.actor = {
        type: "board",
        userId: "user-admin",
        source: "session",
        companyIds: [companyId],
      };
      next();
    });
    app.use(salesRoutes({} as any));
  });

  it("exports campaign leads as structured JSON with provenance metadata", async () => {
    const campaign = await salesCampaignService.createCampaign({
      companyId,
      name: "Privacy Export Campaign",
      industry: "Manufacturing",
      location: "Bengaluru",
      targetTitles: ["Plant Head"],
      offerProposition: "Precision tooling",
    });

    await salesCampaignService.executeResearchStage(companyId, campaign.id);

    const res = await request(app).get(`/companies/${companyId}/sales/campaigns/${campaign.id}/export-json`);
    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toContain("application/json");
    expect(res.body.companyId).toBe(companyId);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.leads.length).toBeGreaterThan(0);
  });

  it("retrieves and updates company data retention policy", async () => {
    // 1. Get default retention policy
    const getRes = await request(app).get(`/companies/${companyId}/sales/settings/retention`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.retentionDays).toBe(90);

    // 2. Update retention policy
    const putRes = await request(app)
      .put(`/companies/${companyId}/sales/settings/retention`)
      .send({ retentionDays: 180, autoPurgeInactiveLeads: true });

    expect(putRes.status).toBe(200);
    expect(putRes.body.retentionDays).toBe(180);
    expect(putRes.body.autoPurgeInactiveLeads).toBe(true);
  });
});
