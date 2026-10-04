/**
 * Sales Organization & Lead Generation REST Routes
 * 
 * Endpoints:
 * - POST /api/companies/:companyId/sales/org/provision
 * - GET  /api/companies/:companyId/sales/prompts
 * - PUT  /api/companies/:companyId/sales/prompts/:role
 * - POST /api/companies/:companyId/sales/campaigns
 * - GET  /api/companies/:companyId/sales/campaigns
 * - GET  /api/companies/:companyId/sales/campaigns/:campaignId
 * - POST /api/companies/:companyId/sales/campaigns/:campaignId/research
 * - GET  /api/companies/:companyId/sales/campaigns/:campaignId/leads
 * - GET  /api/companies/:companyId/sales/campaigns/:campaignId/approvals
 * - POST /api/companies/:companyId/sales/campaigns/:campaignId/approvals/:batchId
 * - POST /api/companies/:companyId/sales/campaigns/:campaignId/sequence
 * - POST /api/companies/:companyId/sales/campaigns/:campaignId/crm-sync
 * - GET  /api/companies/:companyId/sales/hot-leads
 * - POST /api/companies/:companyId/sales/hot-leads
 * - GET  /api/companies/:companyId/sales/suppressions
 * - POST /api/companies/:companyId/sales/suppressions
 * - GET  /api/companies/:companyId/sales/campaigns/:campaignId/export-csv
 */

import { Router, type Request } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { getActorInfo } from "./authz.js";
import { validate } from "../middleware/validate.js";
import { salesOrgService, SALES_ROLES, type SalesRole } from "../services/sales-org.js";
import { salesCampaignService, type CampaignBrief } from "../services/sales-campaign.js";
import { CsvExportConnector } from "../services/sales-crm.js";
import { logActivity } from "../services/activity-log.js";
import { unprocessable, notFound } from "../errors.js";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
}

function resolveCompanyId(req: Request): string {
  const candidate =
    (req.params.companyId as string) ||
    (req.query.companyId as string) ||
    (req.body?.companyId as string) ||
    ((req as any).companyId as string);
  if (!candidate) {
    throw unprocessable("Company ID is required");
  }
  assertCompanyAccess(req, candidate);
  return candidate;
}

const campaignBriefSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  industry: z.string().min(1, "Industry is required"),
  subSegment: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  companySize: z.string().optional(),
  targetTitles: z.array(z.string()).min(1, "At least one target title required"),
  offerProposition: z.string().min(1, "Value proposition is required"),
  callToAction: z.string().optional(),
  dailyLeadQuota: z.number().int().positive().optional(),
  weeklyLeadQuota: z.number().int().positive().optional(),
  emailCadenceDays: z.array(z.number()).optional(),
  isDemo: z.boolean().optional(),
  complianceSettings: z.object({
    dryRun: z.boolean().default(true),
    requireHumanApproval: z.boolean().default(true),
    perDomainHourlyLimit: z.number().default(5),
    enableWarmupRamp: z.boolean().default(true),
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
        const companyId = resolveCompanyId(req);
        const actor = getActorInfo(req);

        const org = await orgSvc.createSalesOrg(companyId);
        const status = await orgSvc.getSalesOrgStatus(companyId);

        try {
          await logActivity(db, {
            companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            action: "sales_org.provisioned",
            entityType: "company",
            entityId: companyId,
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
      const companyId = resolveCompanyId(req);

      const promptsMap = await orgSvc.listAllSalesPrompts();
      const promptsList = Object.values(promptsMap);
      res.json(promptsList);
    }
  );

  router.put(
    "/companies/:companyId/sales/prompts/:role",
    validate(updatePromptSchema),
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const role = getParam(req.params.role);

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
      const companyId = resolveCompanyId(req);
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
          entityType: "campaign",
          entityId: campaign.id,
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
      const companyId = resolveCompanyId(req);

      const list = await salesCampaignService.listCampaigns(companyId);
      res.json(list);
    }
  );

  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);

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
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);

      const leads = await salesCampaignService.executeResearchStage(companyId, campaignId);
      const log = await salesCampaignService.getResearchLog(companyId, campaignId);
      res.json({ success: true, count: leads.length, leads, log });
    }
  );

  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId/research-log",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);

      const log = await salesCampaignService.getResearchLog(companyId, campaignId);
      if (!log) {
        throw notFound("No research execution log found for this campaign");
      }
      res.json(log);
    }
  );

  // 5. Leads & Approvals
  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId/leads",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);

      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const status = req.query.status as string | undefined;
      const minScore = req.query.minScore ? parseInt(req.query.minScore as string, 10) : undefined;
      const search = req.query.search as string | undefined;

      const result = await salesCampaignService.listLeads(companyId, campaignId, {
        page,
        limit,
        status,
        minScore,
        search,
      });
      res.json(result);
    }
  );

  // Privacy Lead Deletion (GDPR/CCPA right to erasure)
  router.delete(
    "/companies/:companyId/sales/leads/:leadId",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const leadId = getParam(req.params.leadId);
      const actor = getActorInfo(req);

      const result = await salesCampaignService.deleteLead(companyId, leadId);

      try {
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "sales_lead.deleted_gdpr",
          entityType: "lead",
          entityId: leadId,
          details: { scrubbedFields: result.scrubbedFields },
        });
      } catch {
        // Logging non-blocking
      }

      res.json(result);
    }
  );

  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId/approvals",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);

      const batches = await salesCampaignService.listApprovalBatches(companyId, campaignId);
      res.json(batches);
    }
  );

  router.post(
    "/companies/:companyId/sales/campaigns/:campaignId/approvals/:batchId",
    validate(approveBatchSchema),
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);
      const batchId = getParam(req.params.batchId);
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
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);

      const sequence = await salesCampaignService.generateCampaignSequence(companyId, campaignId);
      res.json(sequence);
    }
  );

  // 7. CRM Sync
  router.post(
    "/companies/:companyId/sales/campaigns/:campaignId/crm-sync",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);

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
      const companyId = resolveCompanyId(req);

      const hotLeads = await salesCampaignService.getHotLeads(companyId);
      res.json(hotLeads);
    }
  );

  router.post(
    "/companies/:companyId/sales/hot-leads",
    validate(hotLeadSchema),
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);

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
      const companyId = resolveCompanyId(req);

      const hashes = await salesCampaignService.listSuppressions();
      res.json({ suppressions: hashes });
    }
  );

  router.post(
    "/companies/:companyId/sales/suppressions",
    validate(suppressionSchema),
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);

      const result = await salesCampaignService.addSuppression(req.body.email);
      res.status(201).json(result);
    }
  );

  // 10. Data Export (CSV & JSON) with Audit Logging
  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId/export-csv",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);
      const actor = getActorInfo(req);

      const result = await salesCampaignService.listLeads(companyId, campaignId, { limit: 100000 });
      const csvExporter = new CsvExportConnector();
      const csvData = csvExporter.exportCsvString(result.leads);

      try {
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "sales_leads.exported_csv",
          entityType: "campaign",
          entityId: campaignId,
          details: { format: "csv", count: result.leads.length },
        });
      } catch {
        // Non-blocking logging
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="leads-${campaignId}.csv"`);
      res.send(csvData);
    }
  );

  router.get(
    "/companies/:companyId/sales/campaigns/:campaignId/export-json",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const campaignId = getParam(req.params.campaignId);
      const actor = getActorInfo(req);

      const result = await salesCampaignService.listLeads(companyId, campaignId, { limit: 100000 });

      try {
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "sales_leads.exported_json",
          entityType: "campaign",
          entityId: campaignId,
          details: { format: "json", count: result.leads.length },
        });
      } catch {
        // Non-blocking logging
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="leads-${campaignId}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        companyId,
        campaignId,
        total: result.leads.length,
        leads: result.leads,
      });
    }
  );

  // 11. Privacy Data Retention Policy Settings
  router.get(
    "/companies/:companyId/sales/settings/retention",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      res.json({
        companyId,
        retentionDays: 90,
        autoPurgeInactiveLeads: true,
        purgeSuppressedPii: true,
      });
    }
  );

  router.put(
    "/companies/:companyId/sales/settings/retention",
    async (req: Request, res) => {
      const companyId = resolveCompanyId(req);
      const actor = getActorInfo(req);
      const retentionDays = Number(req.body.retentionDays || 90);
      const autoPurgeInactiveLeads = Boolean(req.body.autoPurgeInactiveLeads ?? true);

      try {
        await logActivity(db, {
          companyId,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "sales_settings.retention_updated",
          entityType: "company",
          entityId: companyId,
          details: { retentionDays, autoPurgeInactiveLeads },
        });
      } catch {
        // Non-blocking logging
      }

      res.json({
        success: true,
        companyId,
        retentionDays,
        autoPurgeInactiveLeads,
        updatedAt: new Date().toISOString(),
      });
    }
  );

  return router;
}
