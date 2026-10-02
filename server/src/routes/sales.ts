import { Router, type Request } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { salesOrgService, SALES_ROLES, type SalesRole } from "../services/sales-org.js";
import { salesCampaignService, type CampaignBrief } from "../services/sales-campaign.js";
import { CsvExportConnector } from "../services/sales-crm.js";
import { logActivity } from "../services/activity-log.js";
import { notFound, unprocessable } from "../errors.js";

const campaignBriefSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  industry: z.string().min(1, "Industry is required"),
  subSegment: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  companySize: z.string().optional(),
  targetTitles: z.array(z.string()).min(1, "At least one target title is required"),
  offerProposition: z.string().min(1, "Offer and value proposition is required"),
  dailyLeadQuota: z.number().int().positive().default(20),
  weeklyLeadQuota: z.number().int().positive().default(100),
  researcherInstances: z.number().int().min(1).max(3).default(2),
  isDemo: z.boolean().default(true),
  complianceSettings: z.object({
    dryRunDefault: z.boolean().default(true),
    requireHumanApproval: z.boolean().default(true),
    postalAddress: z.string().optional(),
    dailyLimit: z.number().int().positive().default(20),
  }).optional(),
  crmConfig: z.object({
    provider: z.enum(["hubspot", "generic_webhook", "csv_export"]),
    apiKey: z.string().optional(),
    endpointUrl: z.string().optional(),
    headers: z.record(z.string()).optional(),
    isMock: z.boolean().optional(),
  }).optional(),
});

const updatePromptSchema = z.object({
  content: z.string().min(1, "Prompt content cannot be empty"),
});

const approveBatchSchema = z.object({
  approvedLeadIds: z.array(z.string()),
});

const hotLeadSchema = z.object({
  campaignId: z.string().min(1),
  leadId: z.string().min(1),
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  replySnippet: z.string().min(1),
  sentiment: z.enum(["positive", "meeting_requested", "information_requested"]).default("positive"),
});

const suppressionSchema = z.object({
  email: z.string().email(),
});

export function salesRoutes(db: Db) {
  const router = Router();
  const orgSvc = salesOrgService(db);

  // 1. Provision Sales Organization (CEO, Sales Manager, Researcher x1-3, Follow-up, CRM Sync)
  router.post(
    "/companies/:companyId/sales/org/provision",
    async (req: Request, res, next) => {
      try {
        const { companyId } = req.params;
        assertCompanyAccess(req, companyId);
        const actor = getActorInfo(req);

        const org = await orgSvc.createSalesOrg(companyId);
        const status = await orgSvc.getSalesOrgStatus(companyId);

        try {
          await logActivity(db, {
            companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            action: "sales_org.provisioned",
            details: { agentsCount: status.count },
          });
        } catch {
          // Non-blocking activity logging
        }

        res.status(201).json({
          projectId: org.projectId,
          isComplete: true,
          count: Object.values(org.agents).flat().length,
          agents: Object.values(org.agents).flat(),
        });
      } catch (err) {
        console.error('ERROR IN PROVISION ROUTE:', err);
        next(err);
      }
    }
  );

  // 2. Prompts Management
  router.get(
    "/companies/:companyId/sales/prompts",
    async (req: Request, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);

      const promptsMap = await orgSvc.listAllSalesPrompts();
      const promptsList = Object.values(promptsMap);
      res.json(promptsList);
    }
  );

  router.put(
    "/companies/:companyId/sales/prompts/:role",
    validate(updatePromptSchema),
    async (req: Request, res) => {
      const { companyId, role } = req.params;
      assertCompanyAccess(req, companyId);

      if (!SALES_ROLES.includes(role as SalesRole)) {
        throw unprocessable(`Invalid sales role: ${role}`);
      }

      await orgSvc.writeSalesPromptFile(role as SalesRole, req.body.content);
      const updatedPrompt = await orgSvc.readSalesPromptFile(role as SalesRole);

      res.json({
        role,
        content: updatedPrompt,
        version: 2,
      });
    }
  );

  // 3. Campaigns Lifecycle
  router.post(
    "/companies/:companyId/sales/campaigns",
    validate(campaignBriefSchema),
    async (req: Request, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);

      const brief: CampaignBrief = {
        ...req.body,
        companyId,
      };

      const campaign = await salesCampaignService.createCampaign(brief);

      try {
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "sales_campaign.created",
          details: { campaignId: campaign.id, name: campaign.name },
        });
      } catch {
        // Non-blocking activity logging
      }

      res.status(201).json(campaign);
    }
  );

  router.get(
    "/companies/:companyId/sales/campaigns",
    async (req: Request, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);

      const list = await salesCampaignService.listCampaigns(companyId);
      res.json(list);
    }
  );

  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId",
    async (req: Request, res) => {
      const { companyId, campaignId } = req.params;
      assertCompanyAccess(req, companyId);

      const campaign = await salesCampaignService.getCampaign(companyId, campaignId);
      if (!campaign) {
        throw notFound("Sales campaign not found");
      }
      res.json(campaign);
    }
  );

  // 4. Research Stage Execution
  router.post(
    "/companies/:companyId/sales/campaigns/:campaignId/research",
    async (req: Request, res) => {
      const { companyId, campaignId } = req.params;
      assertCompanyAccess(req, companyId);

      const leads = await salesCampaignService.executeResearchStage(companyId, campaignId);
      res.json({ success: true, count: leads.length, leads });
    }
  );

  // 5. Leads & Approvals
  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId/leads",
    async (req: Request, res) => {
      const { companyId, campaignId } = req.params;
      assertCompanyAccess(req, companyId);

      const leads = await salesCampaignService.listLeads(companyId, campaignId);
      res.json(leads);
    }
  );

  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId/approvals",
    async (req: Request, res) => {
      const { companyId, campaignId } = req.params;
      assertCompanyAccess(req, companyId);

      const batches = await salesCampaignService.listApprovalBatches(companyId, campaignId);
      res.json(batches);
    }
  );

  router.post(
    "/companies/:companyId/sales/campaigns/:campaignId/approvals/:batchId",
    validate(approveBatchSchema),
    async (req: Request, res) => {
      const { companyId, campaignId, batchId } = req.params;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);

      const batch = await salesCampaignService.approveLeadBatch(
        companyId,
        campaignId,
        batchId,
        req.body.approvedLeadIds,
        actor.actorId
      );

      res.json(batch);
    }
  );

  // 6. Sequence Generation
  router.post(
    "/companies/:companyId/sales/campaigns/:campaignId/sequence",
    async (req: Request, res) => {
      const { companyId, campaignId } = req.params;
      assertCompanyAccess(req, companyId);

      const sequence = await salesCampaignService.generateCampaignSequence(companyId, campaignId);
      res.json(sequence);
    }
  );

  // 7. CRM Sync
  router.post(
    "/companies/:companyId/sales/campaigns/:campaignId/crm-sync",
    async (req: Request, res) => {
      const { companyId, campaignId } = req.params;
      assertCompanyAccess(req, companyId);

      const result = await salesCampaignService.syncLeadsToCrm(
        companyId,
        campaignId,
        req.body.crmConfig
      );

      res.json(result);
    }
  );

  // 8. Hot Leads
  router.get(
    "/companies/:companyId/sales/hot-leads",
    async (req: Request, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);

      const hotLeads = await salesCampaignService.getHotLeads(companyId);
      res.json(hotLeads);
    }
  );

  router.post(
    "/companies/:companyId/sales/hot-leads",
    validate(hotLeadSchema),
    async (req: Request, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);

      const hotLead = await salesCampaignService.recordHotLead({
        ...req.body,
        companyId,
      });

      res.status(201).json(hotLead);
    }
  );

  // 9. Email Global Suppression
  router.get(
    "/companies/:companyId/sales/suppressions",
    async (req: Request, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);

      const hashes = await salesCampaignService.listSuppressions();
      res.json({ suppressions: hashes });
    }
  );

  router.post(
    "/companies/:companyId/sales/suppressions",
    validate(suppressionSchema),
    async (req: Request, res) => {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);

      const result = await salesCampaignService.addSuppression(req.body.email);
      res.status(201).json(result);
    }
  );

  // 10. CSV Export
  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId/export-csv",
    async (req: Request, res) => {
      const { companyId, campaignId } = req.params;
      assertCompanyAccess(req, companyId);

      const leads = await salesCampaignService.listLeads(companyId, campaignId);
      const csvExporter = new CsvExportConnector();
      const csvData = csvExporter.exportCsvString(leads);

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="leads-${campaignId}.csv"`);
      res.send(csvData);
    }
  );

  return router;
}
