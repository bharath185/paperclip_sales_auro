import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, companies, projects } from "@paperclipai/db";
import { agentService } from "./agents.js";
import { projectService } from "./projects.js";
import { agentInstructionsService } from "./agent-instructions.js";
import { loadModelConfig } from "./model-config.js";
import { unprocessable, notFound } from "../errors.js";

export const GOVERNANCE_ROLES = ["ceo", "cto", "pm", "qa", "devops", "security"] as const;
export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

export const GOVERNANCE_PROJECT_NAME = "Project Governance";

export interface GovernanceAgentDefinition {
  name: string;
  role: GovernanceRole;
  title: string;
  reportsToRole: GovernanceRole | null;
  budgetMonthlyCents: number;
  defaultModel: string;
  permissions: Record<string, unknown>;
  promptFileName: string;
}

export const GOVERNANCE_AGENT_DEFINITIONS: Record<GovernanceRole, GovernanceAgentDefinition> = {
  ceo: {
    name: "CEO",
    role: "ceo",
    title: "Chief Executive Officer",
    reportsToRole: null,
    budgetMonthlyCents: 50000,
    defaultModel: "opencode/deepseek-v4-pro",
    permissions: {
      canCreateAgents: true,
      canAssignTasks: true,
      canApprovePlans: true,
      canManageBudgets: true,
    },
    promptFileName: "ceo.md",
  },
  cto: {
    name: "CTO",
    role: "cto",
    title: "Chief Technology Officer",
    reportsToRole: "ceo",
    budgetMonthlyCents: 30000,
    defaultModel: "opencode/deepseek-v4-pro",
    permissions: {
      canCreateTasks: true,
      canWriteDocs: true,
      canReviewCode: true,
    },
    promptFileName: "cto.md",
  },
  pm: {
    name: "PM",
    role: "pm",
    title: "Product Manager",
    reportsToRole: "ceo",
    budgetMonthlyCents: 20000,
    defaultModel: "opencode/deepseek-v4-pro",
    permissions: {
      canCreateTasks: true,
      canWriteDocs: true,
      canPrioritize: true,
    },
    promptFileName: "pm.md",
  },
  qa: {
    name: "QA",
    role: "qa",
    title: "Quality Assurance Lead",
    reportsToRole: "ceo",
    budgetMonthlyCents: 15000,
    defaultModel: "opencode/deepseek-v4-pro",
    permissions: {
      canCreateTasks: true,
      canWriteDocs: true,
      canRunTests: true,
    },
    promptFileName: "qa.md",
  },
  devops: {
    name: "DevOps",
    role: "devops",
    title: "DevOps Engineer",
    reportsToRole: "ceo",
    budgetMonthlyCents: 20000,
    defaultModel: "opencode/deepseek-v4-pro",
    permissions: {
      canCreateTasks: true,
      canWriteDocs: true,
      canManageInfra: true,
    },
    promptFileName: "devops.md",
  },
  security: {
    name: "Security",
    role: "security",
    title: "Security Officer",
    reportsToRole: "ceo",
    budgetMonthlyCents: 25000,
    defaultModel: "opencode/kimi-k2.7-code",
    permissions: {
      canCreateTasks: true,
      canWriteDocs: true,
      canReviewSecurity: true,
    },
    promptFileName: "security.md",
  },
};

import { existsSync } from "node:fs";

export function resolveGovernancePromptsDir(): string {
  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(current, "prompts", "governance");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(process.cwd(), "prompts", "governance");
}

export async function readGovernancePromptFile(role: GovernanceRole): Promise<string> {
  const def = GOVERNANCE_AGENT_DEFINITIONS[role];
  if (!def) throw notFound(`Unknown governance role: ${role}`);
  const filePath = path.join(resolveGovernancePromptsDir(), def.promptFileName);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return `# ${def.name} - ${def.title} System Prompt\n\nYou are the ${def.name} (${def.title}) for Project Governance.\n`;
  }
}

export async function writeGovernancePromptFile(role: GovernanceRole, content: string): Promise<void> {
  const def = GOVERNANCE_AGENT_DEFINITIONS[role];
  if (!def) throw notFound(`Unknown governance role: ${role}`);
  const dir = resolveGovernancePromptsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, def.promptFileName);
  await fs.writeFile(filePath, content, "utf8");
}

export async function listAllGovernancePrompts(): Promise<Record<GovernanceRole, { role: string; title: string; content: string }>> {
  const result: Record<string, { role: string; title: string; content: string }> = {};
  for (const role of GOVERNANCE_ROLES) {
    const content = await readGovernancePromptFile(role);
    result[role] = {
      role,
      title: GOVERNANCE_AGENT_DEFINITIONS[role].title,
      content,
    };
  }
  return result as Record<GovernanceRole, { role: string; title: string; content: string }>;
}

export function governanceOrgService(db: Db) {
  const agentSvc = agentService(db);
  const projectSvc = projectService(db);
  const instructionsSvc = agentInstructionsService(db);

  async function getGovernanceOrgStatus(companyId: string) {
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

    const governanceAgents = existingAgents.filter((a) =>
      GOVERNANCE_ROLES.includes(a.role as GovernanceRole) ||
      GOVERNANCE_ROLES.some((r) => a.name.toLowerCase() === r)
    );

    const isComplete = GOVERNANCE_ROLES.every((role) =>
      governanceAgents.some((a) => a.role === role || a.name.toLowerCase() === role)
    );

    return {
      isComplete,
      count: governanceAgents.length,
      agents: governanceAgents,
    };
  }

  async function createGovernanceOrg(
    companyId: string,
    options?: {
      adapterType?: string;
      customModels?: Partial<Record<GovernanceRole, string>>;
    },
  ) {
    const modelConfig = loadModelConfig();
    const adapterType = options?.adapterType ?? "opencode_local";

    // 1. Resolve or create Project Governance project
    const existingProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.companyId, companyId));

    let projectId = existingProjects.find(
      (p) => p.name.trim().toLowerCase() === GOVERNANCE_PROJECT_NAME.toLowerCase(),
    )?.id;

    if (!projectId) {
      const createdProject = await projectSvc.create(companyId, {
        name: GOVERNANCE_PROJECT_NAME,
        description: "Central project for coordination, requirements, architecture, QA, DevOps, and security reviews.",
        status: "in_progress",
      });
      projectId = createdProject.id;
    }

    // 2. Fetch existing active agents
    const existingAgents = await db
      .select()
      .from(agents)
      .where(and(eq(agents.companyId, companyId), ne(agents.status, "terminated")));

    const createdAgentMap: Partial<Record<GovernanceRole, any>> = {};

    // 3. First pass: Create or resolve CEO
    const ceoDef = GOVERNANCE_AGENT_DEFINITIONS.ceo;
    let ceoAgent = existingAgents.find((a) => a.role === "ceo" || a.name === "CEO");

    const ceoModel =
      options?.customModels?.ceo ??
      modelConfig.model_mapping?.ceo?.primary ??
      ceoDef.defaultModel;

    const ceoPrompt = await readGovernancePromptFile("ceo");

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
    } else {
      await agentSvc.update(ceoAgent.id, {
        title: ceoDef.title,
        budgetMonthlyCents: ceoDef.budgetMonthlyCents,
        permissions: ceoDef.permissions,
      });
    }

    // Initialize managed instructions bundle with versioned prompt
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

    createdAgentMap.ceo = ceoAgent;

    // 4. Second pass: Create/update Direct Reports (CTO, PM, QA, DevOps, Security)
    const directRoles: GovernanceRole[] = ["cto", "pm", "qa", "devops", "security"];

    for (const role of directRoles) {
      const def = GOVERNANCE_AGENT_DEFINITIONS[role];
      let agent = existingAgents.find((a) => a.role === role || a.name.toLowerCase() === def.name.toLowerCase());

      const model =
        options?.customModels?.[role] ??
        modelConfig.model_mapping?.[role]?.primary ??
        def.defaultModel;

      const prompt = await readGovernancePromptFile(role);

      if (!agent) {
        agent = await agentSvc.create(companyId, {
          name: def.name,
          role: def.role,
          title: def.title,
          reportsTo: ceoAgent.id,
          adapterType,
          adapterConfig: {
            model,
            provider: "opencode",
          },
          budgetMonthlyCents: def.budgetMonthlyCents,
          permissions: def.permissions,
          status: "idle",
        });
      } else {
        await agentSvc.update(agent.id, {
          title: def.title,
          reportsTo: ceoAgent.id,
          budgetMonthlyCents: def.budgetMonthlyCents,
          permissions: def.permissions,
        });
      }

      await instructionsSvc.materializeManagedBundle(
        {
          id: agent.id,
          companyId,
          name: agent.name,
          adapterConfig: agent.adapterConfig,
        },
        { "AGENTS.md": prompt },
        { replaceExisting: true },
      );

      createdAgentMap[role] = agent;
    }

    return {
      projectId,
      agents: createdAgentMap as Record<GovernanceRole, any>,
    };
  }

  return {
    getGovernanceOrgStatus,
    createGovernanceOrg,
    readGovernancePromptFile,
    writeGovernancePromptFile,
    listAllGovernancePrompts,
  };
}
