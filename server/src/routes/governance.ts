import { Router, type Request } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import {
  governanceOrgService,
  GOVERNANCE_ROLES,
  type GovernanceRole,
} from "../services/governance-org.js";
import { governanceOrchestrationService } from "../services/governance-orchestration.js";
import { logActivity } from "../services/activity-log.js";
import { unprocessable } from "../errors.js";

const kickoffBriefSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  problem: z.string().min(1, "Problem statement is required"),
  targetUsers: z.string().min(1, "Target users is required"),
  goals: z.string().min(1, "Goals are required"),
  constraints: z.string().optional(),
  budget: z.union([z.string(), z.number()]).optional(),
  deadline: z.string().optional(),
  preferredStack: z.string().optional(),
  integrations: z.string().optional(),
  teamSizeAndSkills: z.string().optional(),
  attachments: z.string().optional(),
});

const updatePromptSchema = z.object({
  content: z.string().min(1, "Prompt content cannot be empty"),
});

const createOrgSchema = z.object({
  adapterType: z.string().optional(),
  customModels: z.record(z.string(), z.string()).optional(),
});

function resolveCompanyId(req: Request): string {
  const candidate = (req.params.companyId as string) || (req.query.companyId as string) || (req.body?.companyId as string);
  if (!candidate) {
    throw unprocessable("Company ID is required");
  }
  assertCompanyAccess(req, candidate);
  return candidate;
}

export function governanceRoutes(db: Db) {
  const router = Router();
  const orgSvc = governanceOrgService(db);
  const orchSvc = governanceOrchestrationService(db);

  // Status check: /companies/:companyId/governance/status or /governance/status?companyId=...
  const handleGetStatus = async (req: Request, res: any) => {
    const companyId = resolveCompanyId(req);
    const status = await orgSvc.getGovernanceOrgStatus(companyId);
    res.json(status);
  };
  router.get("/companies/:companyId/governance/status", handleGetStatus);
  router.get("/governance/status", handleGetStatus);

  // One-click create/provision Governance Org
  const handleCreateOrg = async (req: Request, res: any) => {
    const companyId = resolveCompanyId(req);
    const result = await orgSvc.createGovernanceOrg(companyId, req.body);
    const actor = getActorInfo(req);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "governance.org_provisioned",
      entityType: "company",
      entityId: companyId,
      details: {
        agentCount: Object.keys(result.agents).length,
        projectId: result.projectId,
      },
    });

    res.status(201).json({
      success: true,
      projectId: result.projectId,
      agents: Object.values(result.agents).map((a: any) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        title: a.title,
        reportsTo: a.reportsTo,
        budgetMonthlyCents: a.budgetMonthlyCents,
      })),
    });
  };
  router.post("/companies/:companyId/governance/org/create", validate(createOrgSchema), handleCreateOrg);
  router.post("/governance/org/create", validate(createOrgSchema), handleCreateOrg);

  // Read all versioned governance prompts
  router.get("/governance/prompts", async (_req, res) => {
    const prompts = await orgSvc.listAllGovernancePrompts();
    res.json(prompts);
  });

  // Read a single role prompt
  router.get("/governance/prompts/:role", async (req, res) => {
    const role = req.params.role as GovernanceRole;
    const content = await orgSvc.readGovernancePromptFile(role);
    res.json({ role, content });
  });

  // Edit a versioned governance prompt
  router.put("/governance/prompts/:role", validate(updatePromptSchema), async (req, res) => {
    const role = req.params.role as GovernanceRole;
    await orgSvc.writeGovernancePromptFile(role, req.body.content);
    res.json({ success: true, role, content: req.body.content });
  });

  // Submit Project Kickoff brief (creates Goal assigned to CEO + runs orchestration)
  const handleKickoff = async (req: Request, res: any) => {
    const companyId = resolveCompanyId(req);
    const result = await orchSvc.submitKickoffBrief(companyId, req.body);
    const actor = getActorInfo(req);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      agentApiKeyId: actor.agentApiKeyId,
      action: "governance.project_kickoff_submitted",
      entityType: "goal",
      entityId: result.goalId,
      details: {
        projectName: result.projectName,
        goalId: result.goalId,
        kickoffIssueId: result.kickoffIssueId,
        workstreamCount: result.workstreams.length,
      },
    });

    res.status(201).json(result);
  };
  router.post("/companies/:companyId/governance/kickoff", validate(kickoffBriefSchema), handleKickoff);
  router.post("/governance/kickoff", validate(kickoffBriefSchema), handleKickoff);

  return router;
}
