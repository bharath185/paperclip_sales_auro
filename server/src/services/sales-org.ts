import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, projects } from "@paperclipai/db";
import { agentService } from "./agents.js";
import { projectService } from "./projects.js";
import { agentInstructionsService } from "./agent-instructions.js";
import { loadModelConfig } from "./model-config.js";
import { notFound } from "../errors.js";

export const SALES_ROLES = ["ceo", "sales_manager", "researcher", "follow_up", "crm_sync"] as const;
export type SalesRole = (typeof SALES_ROLES)[number];

export const SALES_PROJECT_NAME = "Sales & Lead Generation";

export interface SalesAgentDefinition {
  name: string;
  role: SalesRole;
  title: string;
  reportsToRole: SalesRole | null;
  budgetMonthlyCents: number;
  defaultModel: string;
  permissions: Record<string, unknown>;
  promptFileName: string;
}

export const SALES_AGENT_DEFINITIONS: Record<SalesRole, SalesAgentDefinition> = {
  ceo: {
    name: "CEO",
    role: "ceo",
    title: "Chief Executive Officer (Revenue Strategy)",
    reportsToRole: null,
    budgetMonthlyCents: 50000,
    defaultModel: "opencode/deepseek-v4-pro",
    permissions: {
      canCreateAgents: true,
      canAuthorizeCampaigns: true,
      canManageBudgets: true,
      canApproveLargeSequences: true,
    },
    promptFileName: "ceo.md",
  },
  sales_manager: {
    name: "Sales Manager",
    role: "sales_manager",
    title: "Head of Outbound & Pipeline Operations",
    reportsToRole: "ceo",
    budgetMonthlyCents: 35000,
    defaultModel: "opencode/deepseek-v4-pro",
    permissions: {
      canReviewLeads: true,
      canApproveSequences: true,
      canAssignResearchBatches: true,
      canTriggerOutreach: true,
    },
    promptFileName: "sales_manager.md",
  },
  researcher: {
    name: "Lead Researcher",
    role: "researcher",
    title: "Market Intelligence & Lead Discovery Agent",
    reportsToRole: "sales_manager",
    budgetMonthlyCents: 20000,
    defaultModel: "opencode/deepseek-v4-flash",
    permissions: {
      canScrapePublicWeb: true,
      canExtractCompanyData: true,
      canValidateDomains: true,
    },
    promptFileName: "researcher.md",
  },
  follow_up: {
    name: "Follow-up Specialist",
    role: "follow_up",
    title: "Automated Email Sequence & Outreach Specialist",
    reportsToRole: "sales_manager",
    budgetMonthlyCents: 20000,
    defaultModel: "opencode/deepseek-v4-flash",
    permissions: {
      canDraftSequences: true,
      canQueueApprovedSends: true,
      canCheckSuppressions: true,
    },
    promptFileName: "follow_up.md",
  },
  crm_sync: {
    name: "CRM Sync Specialist",
    role: "crm_sync",
    title: "CRM Integration & Timeline Sync Specialist",
    reportsToRole: "sales_manager",
    budgetMonthlyCents: 15000,
    defaultModel: "opencode/deepseek-v4-flash",
    permissions: {
      canSyncHubSpot: true,
      canDispatchWebhooks: true,
      canUpdateLeadStages: true,
    },
    promptFileName: "crm_sync.md",
  },
};

export function resolveSalesPromptsDir(): string {
  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(current, "prompts", "sales");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(process.cwd(), "prompts", "sales");
}

export async function readSalesPromptFile(role: SalesRole): Promise<string> {
  const def = SALES_AGENT_DEFINITIONS[role];
  if (!def) throw notFound(`Unknown sales role: ${role}`);
  const filePath = path.join(resolveSalesPromptsDir(), def.promptFileName);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return `# ${def.name} - ${def.title} System Prompt\n\nYou are the ${def.name} for Sales & Lead Generation.\n`;
  }
}

export async function writeSalesPromptFile(role: SalesRole, content: string): Promise<void> {
  const def = SALES_AGENT_DEFINITIONS[role];
  if (!def) throw notFound(`Unknown sales role: ${role}`);
  const dir = resolveSalesPromptsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, def.promptFileName);
  await fs.writeFile(filePath, content, "utf8");
}

export async function listAllSalesPrompts(): Promise<Record<SalesRole, { role: string; title: string; content: string }>> {
  const result: Record<string, { role: string; title: string; content: string }> = {};
  for (const role of SALES_ROLES) {
    const content = await readSalesPromptFile(role);
    result[role] = {
      role,
      title: SALES_AGENT_DEFINITIONS[role].title,
      content,
    };
  }
  return result as Record<SalesRole, { role: string; title: string; content: string }>;
}

export function salesOrgService(db: Db) {
  const agentSvc = agentService(db);
  const projectSvc = projectService(db);
  const instructionsSvc = agentInstructionsService(db);

  async function getSalesOrgStatus(companyId: string) {
    const existingAgents = await db
      .select({
        id: agents.id,
        name: agents.name,
        role: agents.role,
        title: agents.title,
        reportsTo: agents.reportsTo,
        status: agents.status,
        adapterType: agents.adapterType,
        adapterConfig: agents.adapterConfig,
        budgetMonthlyCents: agents.budgetMonthlyCents,
      })
      .from(agents)
      .where(and(eq(agents.companyId, companyId), ne(agents.status, "terminated")));

    const salesAgents = existingAgents.filter((a) =>
      (a.role && SALES_ROLES.includes(a.role as SalesRole)) ||
      SALES_ROLES.some((r) => (a.name && a.name.toLowerCase() === r) || (a.role && a.role.startsWith("researcher"))),
    );

    const isComplete = SALES_ROLES.every((role) =>
      salesAgents.some((a) => a.role === role || (a.name && a.name.toLowerCase() === role) || (role === "researcher" && a.role && a.role.startsWith("researcher"))),
    );

    return {
      isComplete,
      count: salesAgents.length,
      agents: salesAgents,
    };
  }

  async function createSalesOrg(
    companyId: string,
    options?: {
      adapterType?: string;
      researcherCount?: number; // 1 to 3
      customModels?: Partial<Record<SalesRole, string>>;
    },
  ) {
    const modelConfig = loadModelConfig();
    const adapterType = options?.adapterType ?? "opencode_local";
    const researcherCount = Math.max(1, Math.min(3, options?.researcherCount ?? 2));

    // 1. Resolve or create "Sales & Lead Generation" project
    const existingProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.companyId, companyId));

    let projectId = existingProjects.find(
      (p) => p.name.trim().toLowerCase() === SALES_PROJECT_NAME.toLowerCase(),
    )?.id;

    if (!projectId) {
      const createdProject = await projectSvc.create(companyId, {
        name: SALES_PROJECT_NAME,
        description: "Autonomous sales pipeline: lead research, deduplication, personalized sequence drafting, and CRM sync.",
        status: "in_progress",
      });
      projectId = createdProject.id;
    }

    // 2. Fetch existing active agents
    const existingAgents = await db
      .select()
      .from(agents)
      .where(and(eq(agents.companyId, companyId), ne(agents.status, "terminated")));

    const createdAgentMap: Record<string, any> = {};

    // 3. Step A: CEO
    const ceoDef = SALES_AGENT_DEFINITIONS.ceo;
    let ceoAgent = existingAgents.find((a) => a.role === "ceo" || a.name === "CEO");

    const ceoModel =
      options?.customModels?.ceo ??
      modelConfig.model_mapping?.ceo?.primary ??
      ceoDef.defaultModel;

    const ceoPrompt = await readSalesPromptFile("ceo");

    if (!ceoAgent) {
      ceoAgent = await agentSvc.create(companyId, {
        name: ceoDef.name,
        role: ceoDef.role,
        title: ceoDef.title,
        reportsTo: null,
        adapterType,
        adapterConfig: {
          model: ceoModel,
          provider: "opencode",
        },
        budgetMonthlyCents: ceoDef.budgetMonthlyCents,
        permissions: ceoDef.permissions,
        status: "idle",
      });
    }

    try {
      await instructionsSvc.materializeManagedBundle(
        {
          id: ceoAgent.id,
          companyId,
          name: ceoAgent.name,
          adapterConfig: ceoAgent.adapterConfig,
        },
        { "AGENTS.md": ceoPrompt },
        { replaceExisting: true },
      );
    } catch {
      // Non-blocking in mock environments
    }
    createdAgentMap.ceo = ceoAgent;

    // 4. Step B: Sales Manager (Reports to CEO)
    const smDef = SALES_AGENT_DEFINITIONS.sales_manager;
    let smAgent = existingAgents.find((a) => a.role === "sales_manager" || a.name === "Sales Manager");

    const smModel =
      options?.customModels?.sales_manager ??
      modelConfig.model_mapping?.sales?.primary ??
      smDef.defaultModel;

    const smPrompt = await readSalesPromptFile("sales_manager");

    if (!smAgent) {
      smAgent = await agentSvc.create(companyId, {
        name: smDef.name,
        role: smDef.role,
        title: smDef.title,
        reportsTo: ceoAgent.id,
        adapterType,
        adapterConfig: {
          model: smModel,
          provider: "opencode",
        },
        budgetMonthlyCents: smDef.budgetMonthlyCents,
        permissions: smDef.permissions,
        status: "idle",
      });
    } else {
      await agentSvc.update(smAgent.id, {
        reportsTo: ceoAgent.id,
      });
    }

    try {
      await instructionsSvc.materializeManagedBundle(
        {
          id: smAgent.id,
          companyId,
          name: smAgent.name,
          adapterConfig: smAgent.adapterConfig,
        },
        { "AGENTS.md": smPrompt },
        { replaceExisting: true },
      );
    } catch {
      // Non-blocking in mock environments
    }
    createdAgentMap.sales_manager = smAgent;

    // 5. Step C: Researcher Agents (1 to 3 instances, reporting to Sales Manager)
    const resDef = SALES_AGENT_DEFINITIONS.researcher;
    const resPrompt = await readSalesPromptFile("researcher");
    const resModel =
      options?.customModels?.researcher ??
      modelConfig.model_mapping?.sales?.fallback ??
      resDef.defaultModel;

    createdAgentMap.researchers = [];
    for (let i = 1; i <= researcherCount; i++) {
      const name = researcherCount === 1 ? "Researcher" : `Researcher ${i}`;
      const role = researcherCount === 1 ? "researcher" : `researcher_${i}`;

      let resAgent = existingAgents.find((a) => a.role === role || a.name === name);
      if (!resAgent) {
        resAgent = await agentSvc.create(companyId, {
          name,
          role,
          title: `Market Intelligence Researcher ${i}`,
          reportsTo: smAgent.id,
          adapterType,
          adapterConfig: {
            model: resModel,
            provider: "opencode",
          },
          budgetMonthlyCents: resDef.budgetMonthlyCents,
          permissions: resDef.permissions,
          status: "idle",
        });
      } else {
        await agentSvc.update(resAgent.id, {
          reportsTo: smAgent.id,
        });
      }

      try {
        await instructionsSvc.materializeManagedBundle(
          {
            id: resAgent.id,
            companyId,
            name: resAgent.name,
            adapterConfig: resAgent.adapterConfig,
          },
          { "AGENTS.md": resPrompt },
          { replaceExisting: true },
        );
      } catch {
        // Non-blocking in mock environments
      }
      createdAgentMap.researchers.push(resAgent);
    }

    // 6. Step D: Follow-up Specialist (Reports to Sales Manager)
    const fuDef = SALES_AGENT_DEFINITIONS.follow_up;
    const fuPrompt = await readSalesPromptFile("follow_up");
    const fuModel =
      options?.customModels?.follow_up ??
      modelConfig.model_mapping?.sales?.fallback ??
      fuDef.defaultModel;

    let fuAgent = existingAgents.find((a) => a.role === "follow_up" || a.name === "Follow-up Specialist");
    if (!fuAgent) {
      fuAgent = await agentSvc.create(companyId, {
        name: fuDef.name,
        role: fuDef.role,
        title: fuDef.title,
        reportsTo: smAgent.id,
        adapterType,
        adapterConfig: {
          model: fuModel,
          provider: "opencode",
        },
        budgetMonthlyCents: fuDef.budgetMonthlyCents,
        permissions: fuDef.permissions,
        status: "idle",
      });
    } else {
      await agentSvc.update(fuAgent.id, {
        reportsTo: smAgent.id,
      });
    }

    try {
      await instructionsSvc.materializeManagedBundle(
        {
          id: fuAgent.id,
          companyId,
          name: fuAgent.name,
          adapterConfig: fuAgent.adapterConfig,
        },
        { "AGENTS.md": fuPrompt },
        { replaceExisting: true },
      );
    } catch {
      // Non-blocking in mock environments
    }
    createdAgentMap.follow_up = fuAgent;

    // 7. Step E: CRM Sync Specialist (Reports to Sales Manager)
    const crmDef = SALES_AGENT_DEFINITIONS.crm_sync;
    const crmPrompt = await readSalesPromptFile("crm_sync");
    const crmModel =
      options?.customModels?.crm_sync ??
      modelConfig.model_mapping?.sales?.fallback ??
      crmDef.defaultModel;

    let crmAgent = existingAgents.find((a) => a.role === "crm_sync" || a.name === "CRM Sync Specialist");
    if (!crmAgent) {
      crmAgent = await agentSvc.create(companyId, {
        name: crmDef.name,
        role: crmDef.role,
        title: crmDef.title,
        reportsTo: smAgent.id,
        adapterType,
        adapterConfig: {
          model: crmModel,
          provider: "opencode",
        },
        budgetMonthlyCents: crmDef.budgetMonthlyCents,
        permissions: crmDef.permissions,
        status: "idle",
      });
    } else {
      await agentSvc.update(crmAgent.id, {
        reportsTo: smAgent.id,
      });
    }

    try {
      await instructionsSvc.materializeManagedBundle(
        {
          id: crmAgent.id,
          companyId,
          name: crmAgent.name,
          adapterConfig: crmAgent.adapterConfig,
        },
        { "AGENTS.md": crmPrompt },
        { replaceExisting: true },
      );
    } catch {
      // Non-blocking in mock environments
    }
    createdAgentMap.crm_sync = crmAgent;

    return {
      projectId,
      agents: createdAgentMap,
    };
  }

  return {
    getSalesOrgStatus,
    createSalesOrg,
    readSalesPromptFile,
    writeSalesPromptFile,
    listAllSalesPrompts,
  };
}
