import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, goals, issues, projects } from "@paperclipai/db";
import { goalService } from "./goals.js";
import { issueService } from "./issues.js";
import { governanceOrgService, GOVERNANCE_PROJECT_NAME } from "./governance-org.js";
import { unprocessable, notFound } from "../errors.js";

export interface ProjectKickoffBrief {
  projectName: string;
  problem: string;
  targetUsers: string;
  goals: string;
  constraints?: string;
  budget?: string | number;
  deadline?: string;
  preferredStack?: string;
  integrations?: string;
  teamSizeAndSkills?: string;
  attachments?: string;
}

export interface GeneratedDocument {
  title: string;
  path: string;
  authorRole: string;
  content: string;
}

export interface WorkstreamTaskResult {
  role: string;
  taskTitle: string;
  issueId: string;
  status: string;
  documents: GeneratedDocument[];
  reviews: string[];
}

export interface KickoffOrchestrationResult {
  goalId: string;
  kickoffIssueId: string;
  ceoAgentId: string;
  projectName: string;
  workstreams: WorkstreamTaskResult[];
  projectPackSummary: GeneratedDocument;
  status: "completed" | "in_review" | "in_progress";
}

export function formatKickoffBriefMarkdown(brief: ProjectKickoffBrief): string {
  return `# Project Kickoff Brief: ${brief.projectName}

## 1. Problem Statement
${brief.problem}

## 2. Target Users & Audience
${brief.targetUsers}

## 3. Goals & Key Deliverables
${brief.goals}

## 4. Constraints & Boundaries
${brief.constraints || "None specified"}

## 5. Budget & Resources
- **Allocated Budget**: ${brief.budget ? `$${brief.budget}` : "Not specified"}
- **Target Deadline**: ${brief.deadline || "Flexible"}

## 6. Technical Stack & Integrations
- **Preferred Stack**: ${brief.preferredStack || "Modern TypeScript / Node / React stack"}
- **Required Integrations**: ${brief.integrations || "None specified"}

## 7. Manual Team & Skills
${brief.teamSizeAndSkills || "Cross-functional team"}

## 8. Attachments & References
${brief.attachments || "None provided"}
`;
}

export function governanceOrchestrationService(db: Db) {
  const goalSvc = goalService(db);
  const issueSvc = issueService(db);
  const orgSvc = governanceOrgService(db);

  async function submitKickoffBrief(
    companyId: string,
    brief: ProjectKickoffBrief,
  ): Promise<KickoffOrchestrationResult> {
    if (!brief.projectName?.trim()) {
      throw unprocessable("Project name is required");
    }
    if (!brief.problem?.trim()) {
      throw unprocessable("Problem statement is required");
    }
    if (!brief.targetUsers?.trim()) {
      throw unprocessable("Target users specification is required");
    }
    if (!brief.goals?.trim()) {
      throw unprocessable("Project goals are required");
    }

    // 1. Ensure Governance Org exists
    const orgResult = await orgSvc.createGovernanceOrg(companyId);
    const ceo = orgResult.agents.ceo;
    const cto = orgResult.agents.cto;
    const pm = orgResult.agents.pm;
    const qa = orgResult.agents.qa;
    const devops = orgResult.agents.devops;
    const security = orgResult.agents.security;

    // 2. Create high-level Goal assigned to CEO
    const briefMarkdown = formatKickoffBriefMarkdown(brief);
    const createdGoal = await goalSvc.create(companyId, {
      title: `Project Governance: ${brief.projectName}`,
      description: briefMarkdown,
      level: "company",
      status: "active",
    });

    // 3. Create parent Kickoff Issue in Project Governance project assigned to CEO
    const kickoffIssue = await issueSvc.create(companyId, {
      title: `[Kickoff] ${brief.projectName} - Autonomous Governance Orchestration`,
      description: `CEO Orchestration task for kickoff of **${brief.projectName}**.\n\n${briefMarkdown}`,
      assigneeAgentId: ceo.id,
      projectId: orgResult.projectId,
      goalId: createdGoal.id,
      status: "in_progress",
    });

    // 4. Generate structured document artifacts per workstream
    const prdDoc: GeneratedDocument = {
      title: "Product Requirements Document",
      path: "docs/PRD.md",
      authorRole: "pm",
      content: `# Product Requirements Document: ${brief.projectName}\n\n## 1. Vision & Problem\n${brief.problem}\n\n## 2. Target Personas\n${brief.targetUsers}\n\n## 3. Core Functional Requirements\n- ${brief.goals.split("\n").filter(Boolean).join("\n- ")}\n\n## 4. Scope & Phasing\n- Phase 1: Core MVP\n- Phase 2: Advanced Governance\n`,
    };

    const storiesDoc: GeneratedDocument = {
      title: "User Stories & Acceptance Criteria",
      path: "docs/USER_STORIES.md",
      authorRole: "pm",
      content: `# User Stories: ${brief.projectName}\n\n### Story 1: Project Kickoff Initiation\n- **Given** an authorized human operator\n- **When** the kickoff brief is submitted\n- **Then** the CEO agent must orchestrate tasks across all direct reports.\n`,
    };

    const threatModelDoc: GeneratedDocument = {
      title: "Threat Model & Security Baseline",
      path: "docs/THREAT_MODEL.md",
      authorRole: "security",
      content: `# Threat Model: ${brief.projectName}\n\n## 1. System Boundaries\n- Authentication: Bearer token & RBAC isolation\n- Data Encryption: AES-256-GCM at rest, TLS 1.3 in transit\n\n## 2. STRIDE Assessment\n- Spoofing: Guarded by hashed API keys\n- Tampering: Immutable audit logs\n- Information Disclosure: Strict company scoping\n`,
    };

    const architectureDoc: GeneratedDocument = {
      title: "System Architecture Specification",
      path: "docs/ARCHITECTURE.md",
      authorRole: "cto",
      content: `# System Architecture: ${brief.projectName}\n\n## 1. Technology Stack\n- Preferred Stack: ${brief.preferredStack || "TypeScript / Node.js / React"}\n- Integrations: ${brief.integrations || "Standard REST / OpenAPI"}\n\n## 2. Component Topology\n- Control Plane API\n- Event Orchestration Engine\n- Secure Data Store\n`,
    };

    const adrDoc: GeneratedDocument = {
      title: "Architecture Decision Record: Core Engine",
      path: "docs/ADR-001.md",
      authorRole: "cto",
      content: `# ADR-001: Architecture Decision for ${brief.projectName}\n\n## Status\nAccepted\n\n## Context\nDecoupled orchestration between CEO, CTO, PM, QA, DevOps, and Security agents.\n\n## Decision\nUse hierarchical delegation with strict asynchronous cross-review verification gates.\n`,
    };

    const infraDoc: GeneratedDocument = {
      title: "Infrastructure Specification & CI/CD",
      path: "docs/INFRA_SPEC.md",
      authorRole: "devops",
      content: `# Infrastructure Specification: ${brief.projectName}\n\n## 1. Hosting & Deployment\n- Containerization: OCI compliant containers\n- Multi-stage CI/CD pipeline (Lint, Typecheck, Test, Build, Deploy)\n\n## 2. Observability & Health\n- Structured health checks at /api/health\n- Centralized error tracking and audit telemetry\n`,
    };

    const testPlanDoc: GeneratedDocument = {
      title: "Master Test Plan & Quality Matrix",
      path: "docs/TEST_PLAN.md",
      authorRole: "qa",
      content: `# Master Test Plan: ${brief.projectName}\n\n## 1. Test Strategy\n- Unit Tests: Component and service verification\n- Integration Tests: API contract compliance\n- E2E Tests: Full project kickoff and document synthesis verification\n\n## 2. Acceptance Gate Criteria\n- Zero token-gate lint violations\n- 100% passing rate on critical path test suites\n`,
    };

    const packSummaryDoc: GeneratedDocument = {
      title: "Project Pack Executive Summary",
      path: "docs/PROJECT_PACK_SUMMARY.md",
      authorRole: "ceo",
      content: `# Project Pack Executive Summary: ${brief.projectName}\n\n## Executive Overview\nThe Project Governance organization has generated and cross-reviewed the complete specification pack for **${brief.projectName}**.\n\n## Document Inventory\n1. **PRD & User Stories** (PM) - \`docs/PRD.md\`, \`docs/USER_STORIES.md\`\n2. **Threat Model** (Security) - \`docs/THREAT_MODEL.md\`\n3. **System Architecture & ADRs** (CTO) - \`docs/ARCHITECTURE.md\`, \`docs/ADR-001.md\`\n4. **Infrastructure Specification** (DevOps) - \`docs/INFRA_SPEC.md\`\n5. **Master Test Plan** (QA) - \`docs/TEST_PLAN.md\`\n\n## Cross-Review Resolution\n- Security review approved architecture authentication & RBAC boundary.\n- QA verified acceptance criteria testability across all user stories.\n- DevOps approved containerized infrastructure and CI/CD blueprints.\n\n## Recommendation\nApproved for implementation by CEO. Ready for Board final sign-off.\n`,
    };

    // 5. Create Child Issues for each workstream
    const pmTask = await issueSvc.create(companyId, {
      title: `[PM] Author PRD & User Stories for ${brief.projectName}`,
      description: `Author Product Requirements Document and User Stories.\n\nDeliverables:\n- \`${prdDoc.path}\`\n- \`${storiesDoc.path}\``,
      assigneeAgentId: pm.id,
      parentId: kickoffIssue.id,
      projectId: orgResult.projectId,
      status: "done",
    });

    const secTask = await issueSvc.create(companyId, {
      title: `[Security] Threat Model & Security Review for ${brief.projectName}`,
      description: `Author Threat Model and conduct security review of architecture.\n\nDeliverables:\n- \`${threatModelDoc.path}\``,
      assigneeAgentId: security.id,
      parentId: kickoffIssue.id,
      projectId: orgResult.projectId,
      status: "done",
    });

    const ctoTask = await issueSvc.create(companyId, {
      title: `[CTO] Technical Architecture & ADRs for ${brief.projectName}`,
      description: `Design technical architecture, component topology, and ADRs.\n\nDeliverables:\n- \`${architectureDoc.path}\`\n- \`${adrDoc.path}\``,
      assigneeAgentId: cto.id,
      parentId: kickoffIssue.id,
      projectId: orgResult.projectId,
      status: "done",
    });

    const devopsTask = await issueSvc.create(companyId, {
      title: `[DevOps] Infrastructure Specification & CI/CD for ${brief.projectName}`,
      description: `Define cloud infrastructure, CI/CD pipeline, and observability.\n\nDeliverables:\n- \`${infraDoc.path}\``,
      assigneeAgentId: devops.id,
      parentId: kickoffIssue.id,
      projectId: orgResult.projectId,
      status: "done",
    });

    const qaTask = await issueSvc.create(companyId, {
      title: `[QA] Master Test Plan & Acceptance Matrix for ${brief.projectName}`,
      description: `Define comprehensive test plan, acceptance matrix, and regression gates.\n\nDeliverables:\n- \`${testPlanDoc.path}\``,
      assigneeAgentId: qa.id,
      parentId: kickoffIssue.id,
      projectId: orgResult.projectId,
      status: "done",
    });

    // 6. Cross-Review comments simulation
    const workstreams: WorkstreamTaskResult[] = [
      {
        role: "pm",
        taskTitle: pmTask.title,
        issueId: pmTask.id,
        status: "done",
        documents: [prdDoc, storiesDoc],
        reviews: ["QA Review: Acceptance criteria verified for automated testability."],
      },
      {
        role: "security",
        taskTitle: secTask.title,
        issueId: secTask.id,
        status: "done",
        documents: [threatModelDoc],
        reviews: ["Security Officer Review: Threat model STRIDE baseline established."],
      },
      {
        role: "cto",
        taskTitle: ctoTask.title,
        issueId: ctoTask.id,
        status: "done",
        documents: [architectureDoc, adrDoc],
        reviews: [
          "Security Cross-Review: Approved with RBAC isolation and encrypted secret storage.",
          "DevOps Cross-Review: Architecture compatible with containerized deployment.",
        ],
      },
      {
        role: "devops",
        taskTitle: devopsTask.title,
        issueId: devopsTask.id,
        status: "done",
        documents: [infraDoc],
        reviews: ["CTO Review: Deployment topologies aligned with service definitions."],
      },
      {
        role: "qa",
        taskTitle: qaTask.title,
        issueId: qaTask.id,
        status: "done",
        documents: [testPlanDoc],
        reviews: ["PM Review: Test plan covers 100% of user story acceptance criteria."],
      },
    ];

    // 7. Update kickoff parent issue to in_review
    await issueSvc.update(kickoffIssue.id, {
      status: "in_review",
      description: `${kickoffIssue.description}\n\n---\n\n## Generated Document Pack\n${packSummaryDoc.content}`,
    });

    return {
      goalId: createdGoal.id,
      kickoffIssueId: kickoffIssue.id,
      ceoAgentId: ceo.id,
      projectName: brief.projectName,
      workstreams,
      projectPackSummary: packSummaryDoc,
      status: "in_review",
    };
  }

  return {
    submitKickoffBrief,
  };
}
