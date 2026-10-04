import { describe, it, expect, beforeEach } from "vitest";
import {
  SalesCampaignService,
  type CampaignBrief,
} from "./sales-campaign.js";
import { HubSpotConnector } from "./sales-crm.js";
import type { LeadRecord } from "./sales-research.js";

describe("Sales Resilience & Fault Tolerance", () => {
  let service: SalesCampaignService;
  const testCompanyId = "comp-resilience-101";

  beforeEach(() => {
    service = new SalesCampaignService();
  });

  const baseBrief: CampaignBrief = {
    companyId: testCompanyId,
    name: "Resilience & Rate Limit Test Campaign",
    industry: "Manufacturing",
    location: "Bengaluru",
    targetTitles: ["Plant Head", "Director of Operations"],
    offerProposition: "AI Automated Predictive Maintenance",
    dailyLeadQuota: 50,
    weeklyLeadQuota: 200,
    researcherInstances: 2,
    isDemo: true,
    complianceSettings: {
      dryRunDefault: false,
      requireHumanApproval: true,
      postalAddress: "100 Security Blvd, Suite 200, San Francisco, CA 94105",
      dailyLimit: 50,
    },
  };

  describe("Mid-Campaign State Machine Recovery & Idempotency", () => {
    it("preserves approved lead state and avoids re-sending already dispatched leads on crash restart", async () => {
      // 1. Create campaign and research leads
      const campaign = await service.createCampaign(baseBrief);
      const leads = await service.executeResearchStage(testCompanyId, campaign.id);
      expect(leads.length).toBeGreaterThanOrEqual(2);

      const batches = await service.listApprovalBatches(testCompanyId, campaign.id);
      const batchId = batches[0].id;
      const allLeadIds = leads.map((l) => l.id);

      // 2. Approve all leads
      await service.approveLeadBatch(testCompanyId, campaign.id, batchId, allLeadIds, "user-admin-1");

      // 3. Dispatch first batch of emails
      const senderIdentity = {
        senderName: "Auro Outbound",
        legalBusinessName: "Auro Technologies Inc",
        physicalAddress: "100 Security Blvd, San Francisco, CA 94105",
        senderEmail: "outreach@example.com",
      };

      const sendRun1 = await service.dispatchApprovedBatchEmails(
        testCompanyId,
        campaign.id,
        batchId,
        senderIdentity,
        false // live mode (not dry run)
      );

      expect(sendRun1.dispatchedCount).toBe(leads.length);

      // 4. Simulate Crash / Restart & Retry of the same batch
      // Idempotency: Repeating the dispatch on the already-dispatched batch must be a safe no-op
      const sendRun2 = await service.dispatchApprovedBatchEmails(
        testCompanyId,
        campaign.id,
        batchId,
        senderIdentity,
        false
      );

      // Dispatched count must be 0 because all leads were already processed
      expect(sendRun2.dispatchedCount).toBe(0);
      expect(sendRun2.alreadyDispatchedCount).toBe(leads.length);
    });

    it("ensures CRM sync with idempotency keys prevents duplicate contact creations on network retry", async () => {
      const mockLead: LeadRecord = {
        id: "lead-crm-idempotent-01",
        companyId: testCompanyId,
        companyName: "Apex Precision Tools",
        contactName: "Sanjay Kumar",
        contactTitle: "VP Manufacturing",
        contactEmail: "sanjay@apexprecision.example.com",
        locationCity: "Peenya Industrial Area, Bengaluru",
        industry: "Manufacturing",
        leadScore: 92,
        notes: "High intent precision tooling",
        createdAt: new Date().toISOString(),
      } as unknown as LeadRecord;

      const crm = new HubSpotConnector({
        provider: "hubspot",
        isMock: true,
        apiKey: "mock_hubspot_token_val_123",
      });

      // 1st sync attempt
      const result1 = await crm.upsertLead(mockLead);
      expect(result1.success).toBe(true);
      expect(result1.externalId).toBeDefined();

      // 2nd sync attempt with same lead (simulating network retry)
      const result2 = await crm.upsertLead(mockLead);
      expect(result2.success).toBe(true);
      expect(result2.externalId).toBe(result1.externalId);
    });
  });

  describe("429 Quota Exhaustion & Rate Limiting Recovery", () => {
    it("gracefully pauses campaign execution on 429 quota exhaustion and permits clean resume", async () => {
      const campaign = await service.createCampaign(baseBrief);
      expect(campaign.status).toBe("draft");

      // Set status to running
      await service.executeResearchStage(testCompanyId, campaign.id);
      const runningCamp = await service.getCampaign(testCompanyId, campaign.id);
      expect(runningCamp?.status).toBe("running");

      // Simulate 429 rate limit error handling: pause campaign with reason
      const pauseResult = await service.pauseCampaign(
        testCompanyId,
        campaign.id,
        "HTTP 429: Outbound provider daily quota reached (25/25 sent). Campaign paused."
      );
      expect(pauseResult.status).toBe("paused");
      expect(pauseResult.pauseReason).toContain("HTTP 429");

      // Attempting to dispatch emails while paused should be rejected
      await expect(
        service.dispatchApprovedBatchEmails(
          testCompanyId,
          campaign.id,
          "batch-fake-id",
          {
            senderName: "Auro",
            legalBusinessName: "Auro Inc",
            physicalAddress: "100 Security Blvd",
            senderEmail: "sales@example.com",
          },
          false
        )
      ).rejects.toThrow(/paused/i);

      // Resume campaign when quota resets
      const resumed = await service.resumeCampaign(testCompanyId, campaign.id);
      expect(resumed.status).toBe("running");
      expect(resumed.pauseReason).toBeUndefined();
    });
  });
});
