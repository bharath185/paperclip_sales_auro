/**
 * Project Auro - Governance Document Pack Definitions, Templates, and Validators
 * 
 * Defines the 12 canonical project governance documents:
 * 1. Charter / Vision (CEO)
 * 2. PRD (PM)
 * 3. Architecture + ADRs (CTO)
 * 4. Tech Stack (CTO)
 * 5. DB/ER + OpenAPI (CTO / DevOps)
 * 6. Execution Plan + Timeline (PM / CEO)
 * 7. Sprint Plan (PM)
 * 8. Team Allocation Sheet (CEO / PM)
 * 9. Test Strategy + QA Checklist (QA)
 * 10. CI/CD + Infra (DevOps)
 * 11. Threat Model + Security Requirements (Security)
 * 12. Risk Register + RACI Matrix (CEO / Security)
 */

export const GOVERNANCE_DOCUMENT_KINDS = [
  "charter",
  "prd",
  "architecture",
  "tech_stack",
  "db_openapi",
  "execution_plan",
  "sprint_plan",
  "team_allocation",
  "test_strategy",
  "cicd_infra",
  "threat_model",
  "risk_raci",
] as const;

export type GovernanceDocumentKind = (typeof GOVERNANCE_DOCUMENT_KINDS)[number];

export interface DocumentSectionRequirement {
  id: string;
  heading: string;
  aliases?: string[];
  description: string;
}

export interface GovernanceDocumentDefinition {
  kind: GovernanceDocumentKind;
  title: string;
  fileName: string;
  authorRole: "ceo" | "cto" | "pm" | "qa" | "devops" | "security";
  reviewerRoles: Array<"ceo" | "cto" | "pm" | "qa" | "devops" | "security">;
  requiredSections: DocumentSectionRequirement[];
  templateGenerator: (context: GovernanceProjectContext) => string;
}

export interface GovernanceProjectContext {
  projectName: string;
  problem: string;
  targetUsers: string;
  goals: string;
  constraints?: string;
  budget?: string;
  deadline?: string;
  preferredStack?: string;
  integrations?: string;
  teamSize?: string;
  teamSkills?: string;
  isDemo?: boolean;
}

export interface DocumentVersion {
  version: number;
  content: string;
  authorRole: string;
  changeSummary: string;
  createdAt: string;
}

export interface DocumentReview {
  id: string;
  reviewerRole: "ceo" | "cto" | "pm" | "qa" | "devops" | "security";
  status: "approved" | "changes_requested" | "pending";
  comments: string;
  createdAt: string;
}

export interface GovernanceDocumentRecord {
  id: string;
  kind: GovernanceDocumentKind;
  title: string;
  fileName: string;
  currentVersion: number;
  status: "draft" | "in_review" | "approved";
  versions: DocumentVersion[];
  reviews: DocumentReview[];
  metadata?: Record<string, unknown>;
}

export const GOVERNANCE_DOC_DEFINITIONS: Record<GovernanceDocumentKind, GovernanceDocumentDefinition> = {
  charter: {
    kind: "charter",
    title: "Project Charter & Vision",
    fileName: "CHARTER.md",
    authorRole: "ceo",
    reviewerRoles: ["cto", "pm"],
    requiredSections: [
      { id: "exec_summary", heading: "Executive Summary", aliases: ["Executive Summary", "Project Summary"], description: "High level project overview" },
      { id: "problem_statement", heading: "Problem Statement", aliases: ["Problem Statement", "Problem"], description: "Core problem being solved" },
      { id: "target_users", heading: "Target Users & Stakeholders", aliases: ["Target Users", "Target Audience", "Target Users & Stakeholders"], description: "User personas and stakeholders" },
      { id: "strategic_goals", heading: "Strategic Goals & Success Metrics", aliases: ["Strategic Goals", "Goals & Metrics", "Success Metrics"], description: "Key objectives and measurable KPIs" },
      { id: "scope_boundaries", heading: "Scope & Non-Goals", aliases: ["Scope & Non-Goals", "Scope Boundaries", "In Scope & Out of Scope"], description: "What is explicitly in and out of scope" },
    ],
    templateGenerator: (ctx) => `# Project Charter & Vision: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Executive Summary
${ctx.projectName} is designed to deliver a modern, autonomous solution for ${ctx.problem.slice(0, 100)}...

## Problem Statement
${ctx.problem}

## Target Users & Stakeholders
- Primary Audience: ${ctx.targetUsers}
- Key Stakeholders: Executive leadership, product team, and engineering organization.

## Strategic Goals & Success Metrics
- Goals: ${ctx.goals}
- Budget Target: ${ctx.budget || "Standard allocation"}
- Target Timeline: ${ctx.deadline || "TBD"}

## Scope & Non-Goals
### In Scope
- Core workflow automation, project governance pack, agent orchestration.
### Non-Goals
- Legacy on-premise mainframe integrations without API access.
`,
  },

  prd: {
    kind: "prd",
    title: "Product Requirements Document (PRD)",
    fileName: "PRD.md",
    authorRole: "pm",
    reviewerRoles: ["ceo", "qa", "cto"],
    requiredSections: [
      { id: "overview", heading: "Product Overview", aliases: ["Product Overview", "Overview"], description: "Product concept and vision" },
      { id: "user_journeys", heading: "User Journeys & Use Cases", aliases: ["User Journeys", "Use Cases", "User Journeys & Use Cases"], description: "Step-by-step user workflows" },
      { id: "functional_reqs", heading: "Functional Requirements", aliases: ["Functional Requirements", "Functional Specs"], description: "Detailed feature requirements" },
      { id: "non_functional_reqs", heading: "Non-Functional Requirements", aliases: ["Non-Functional Requirements", "NFRs", "System Quality Attributes"], description: "Performance, security, availability" },
      { id: "acceptance_criteria", heading: "Acceptance Criteria", aliases: ["Acceptance Criteria", "Definition of Done"], description: "Sign-off rules for release" },
    ],
    templateGenerator: (ctx) => `# Product Requirements Document: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Product Overview
${ctx.projectName} addresses critical operational requirements for ${ctx.targetUsers}.

## User Journeys & Use Cases
1. **Kickoff Flow**: User inputs project constraints and triggers full governance pack.
2. **Review & Refinement**: Agents cross-review generated artifacts and resolve feedback in-thread.
3. **Delivery Hand-off**: Approved sprint tickets are exported to Jira / XLSX.

## Functional Requirements
- **FR-1 (Kickoff)**: Capture project metadata, team skills (${ctx.teamSkills || "N/A"}), and constraints.
- **FR-2 (Orchestration)**: CEO delegates workstreams to CTO, PM, QA, DevOps, and Security.
- **FR-3 (Document Generation)**: Produce all 12 validated governance artifacts.

## Non-Functional Requirements
- **Performance**: Document pack compilation under 15 seconds.
- **Reliability**: Automatic model fallback on quota / provider errors.
- **Security**: Strict tenant isolation and sandbox enforcement.

## Acceptance Criteria
- [ ] All 12 documents pass section validator checks.
- [ ] Cross-reviews completed and signed off.
- [ ] Final document pack approved by CEO.
`,
  },

  architecture: {
    kind: "architecture",
    title: "System Architecture & ADRs",
    fileName: "ARCHITECTURE.md",
    authorRole: "cto",
    reviewerRoles: ["security", "devops", "ceo"],
    requiredSections: [
      { id: "arch_overview", heading: "Architecture Overview", aliases: ["Architecture Overview", "System Overview"], description: "High-level topology" },
      { id: "mermaid_diagram", heading: "System Component Diagram (Mermaid)", aliases: ["System Component Diagram", "Mermaid Diagram", "Component Diagram"], description: "Mermaid architecture diagram" },
      { id: "data_flow", heading: "Data Flow & Integration Points", aliases: ["Data Flow", "Data Flow & Integration Points"], description: "Communication protocols and data flows" },
      { id: "adrs", heading: "Architectural Decision Records (ADRs)", aliases: ["Architectural Decision Records", "ADRs", "ADR-001"], description: "Key architectural trade-offs and decisions" },
    ],
    templateGenerator: (ctx) => `# System Architecture & ADRs: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Architecture Overview
The architecture is structured around modular control plane services, isolated execution sandboxes, and autonomous multi-agent orchestration.

## System Component Diagram (Mermaid)
\`\`\`mermaid
flowchart TD
  Client[Web UI / Mobile] --> Gateway[API Gateway / Router]
  Gateway --> GovService[Governance Service]
  Gateway --> AgentOrch[Agent Orchestration Engine]
  AgentOrch --> ModelProvider[OpenCode Model Provider Layer]
  ModelProvider --> DeepSeek[DeepSeek V4 Pro]
  ModelProvider --> Kimi[Kimi K2.7 Code]
  AgentOrch --> DocEngine[Document Generation & Validator]
  DocEngine --> Store[(Persistent Store / Artifacts)]
\`\`\`

## Data Flow & Integration Points
- **External Integrations**: ${ctx.integrations || "Standard REST / Webhooks"}
- **Preferred Stack**: ${ctx.preferredStack || "TypeScript / Node.js / React"}

## Architectural Decision Records (ADRs)
### ADR-001: Model Provider Layer with Automatic Failover
- **Context**: Relying on a single AI provider causes downtime during quota exhaustion.
- **Decision**: Implement OpenCode provider with transparent fallback to DeepSeek V4 Flash / Pro.
- **Consequences**: Zero agent downtime; seamless quota management.
`,
  },

  tech_stack: {
    kind: "tech_stack",
    title: "Technology Stack & Justification",
    fileName: "TECH_STACK.md",
    authorRole: "cto",
    reviewerRoles: ["devops", "pm"],
    requiredSections: [
      { id: "stack_summary", heading: "Stack Summary Matrix", aliases: ["Stack Summary Matrix", "Stack Summary", "Technology Stack"], description: "Table of technologies by layer" },
      { id: "frontend_backend", heading: "Frontend & Backend Rationale", aliases: ["Frontend & Backend Rationale", "Frontend and Backend"], description: "Framework and language selection" },
      { id: "database_storage", heading: "Database & Storage Layer", aliases: ["Database & Storage Layer", "Database and Storage", "Storage"], description: "Data persistence and caching" },
      { id: "dependencies_licensing", heading: "Third-Party Dependencies & Licensing", aliases: ["Third-Party Dependencies & Licensing", "Dependencies & Licensing", "Dependencies"], description: "Library vetting and licenses" },
    ],
    templateGenerator: (ctx) => `# Technology Stack & Justification: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Stack Summary Matrix
| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | React + Vite + Tailwind | React 19 / Vite 6 | Responsive, token-gated UI |
| Backend | Node.js + Express + TypeScript | Node 24 / TS 5.7 | API and orchestration engine |
| Database | PostgreSQL + Drizzle ORM | Postgres 16 | Relational data with type-safe schema |
| AI Adapter | OpenCode Provider Layer | Latest | Multi-model agent execution |

## Frontend & Backend Rationale
- Selection based on project requirements: ${ctx.preferredStack || "Modern full-stack TypeScript"}.
- Shared type packages ensure end-to-end type safety between client and server.

## Database & Storage Layer
- Relational schema managed with strict migration numbering and tenant isolation checks.
- Artifacts and document versions stored with immutable history hashes.

## Third-Party Dependencies & Licensing
- All core dependencies use permissive licenses (MIT / Apache-2.0 / BSD).
`,
  },

  db_openapi: {
    kind: "db_openapi",
    title: "Database Schema (ER) & OpenAPI Specification",
    fileName: "DB_OPENAPI.md",
    authorRole: "cto",
    reviewerRoles: ["devops", "security"],
    requiredSections: [
      { id: "er_diagram", heading: "Entity-Relationship (ER) Diagram (Mermaid)", aliases: ["Entity-Relationship Diagram", "ER Diagram", "Entity-Relationship (ER) Diagram (Mermaid)"], description: "Mermaid ER diagram" },
      { id: "data_dictionary", heading: "Data Dictionary & Tables", aliases: ["Data Dictionary & Tables", "Data Dictionary", "Table Definitions"], description: "Field specifications and constraints" },
      { id: "openapi_spec", heading: "OpenAPI 3.0 REST Specification Draft", aliases: ["OpenAPI Specification", "OpenAPI 3.0 REST Specification Draft", "OpenAPI Spec"], description: "API endpoints, request/response models" },
    ],
    templateGenerator: (ctx) => `# Database Schema (ER) & OpenAPI Specification: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Entity-Relationship (ER) Diagram (Mermaid)
\`\`\`mermaid
erDiagram
  COMPANY ||--o{ PROJECT : owns
  PROJECT ||--o{ GOVERNANCE_PACK : contains
  GOVERNANCE_PACK ||--o{ GOVERNANCE_DOCUMENT : holds
  GOVERNANCE_DOCUMENT ||--o{ DOCUMENT_VERSION : tracks
  GOVERNANCE_DOCUMENT ||--o{ DOCUMENT_REVIEW : receives

  COMPANY {
    uuid id PK
    string name
    string status
  }
  PROJECT {
    uuid id PK
    uuid company_id FK
    string name
  }
  GOVERNANCE_PACK {
    uuid id PK
    uuid project_id FK
    string status
  }
  GOVERNANCE_DOCUMENT {
    uuid id PK
    uuid pack_id FK
    string kind
    string title
  }
\`\`\`

## Data Dictionary & Tables
- **governance_packs**: Holds overall pack lifecycle (draft, in_review, approved).
- **governance_documents**: Individual documents with validation states.
- **document_versions**: Content snapshots and author change summaries.

## OpenAPI 3.0 REST Specification Draft
\`\`\`yaml
openapi: 3.0.3
info:
  title: ${ctx.projectName} Governance API
  version: 1.0.0
paths:
  /api/companies/{companyId}/governance/pack:
    get:
      summary: Retrieve active project governance pack
      responses:
        '200':
          description: Governance pack details
\`\`\`
`,
  },

  execution_plan: {
    kind: "execution_plan",
    title: "Execution Plan & Timeline",
    fileName: "EXECUTION_PLAN.md",
    authorRole: "pm",
    reviewerRoles: ["ceo", "cto"],
    requiredSections: [
      { id: "phases_milestones", heading: "Project Phases & Major Milestones", aliases: ["Project Phases & Major Milestones", "Project Phases", "Milestones"], description: "Phase breakdown" },
      { id: "timeline_gantt", heading: "Timeline & Critical Path", aliases: ["Timeline & Critical Path", "Timeline", "Critical Path"], description: "Timeline chart and critical path dependencies" },
      { id: "resource_capacity", heading: "Resource Requirements & Capacity", aliases: ["Resource Requirements & Capacity", "Resource Requirements", "Capacity Planning"], description: "Staffing and compute resources" },
    ],
    templateGenerator: (ctx) => `# Execution Plan & Timeline: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Project Phases & Major Milestones
- **Phase 1: Kickoff & Governance Alignment** (Target: Week 1) — Approval of all 12 governance pack documents.
- **Phase 2: Core Platform & Infrastructure** (Target: Weeks 2-3) — Backend services, database migrations, CI/CD pipeline.
- **Phase 3: Feature Development & Validation** (Target: Weeks 4-5) — Functional user stories, test suites, cross-reviews.
- **Phase 4: Release & Hand-off** (Target: ${ctx.deadline || "Week 6"}) — Production deployment and user onboarding.

## Timeline & Critical Path
- Critical Path: Architecture & PRD Approval -> Data Schema & API Contract -> Core Implementation -> QA Sign-off.

## Resource Requirements & Capacity
- Budget: ${ctx.budget || "$50,000 allocated"}
- Team Size: ${ctx.teamSize || "5-8 engineers"}
- Skill Coverage: ${ctx.teamSkills || "Full-stack development, QA automation, DevOps, Security"}
`,
  },

  sprint_plan: {
    kind: "sprint_plan",
    title: "Sprint Plan & Backlog Breakdown",
    fileName: "SPRINT_PLAN.md",
    authorRole: "pm",
    reviewerRoles: ["cto", "qa"],
    requiredSections: [
      { id: "epics_overview", heading: "Epics Overview", aliases: ["Epics Overview", "Epics"], description: "High level epic summaries" },
      { id: "user_stories", heading: "User Stories & Acceptance Criteria", aliases: ["User Stories & Acceptance Criteria", "User Stories", "Stories"], description: "Detailed story list with story points" },
      { id: "task_breakdown", heading: "Engineering Task Breakdown & Dependencies", aliases: ["Engineering Task Breakdown & Dependencies", "Engineering Tasks", "Task Breakdown"], description: "Granular tasks with estimates and prerequisites" },
    ],
    templateGenerator: (ctx) => `# Sprint Plan & Backlog Breakdown: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Epics Overview
- **EPIC-1 (Core Platform)**: Project setup, API routing, and DB models.
- **EPIC-2 (Document Center)**: Document viewing, markdown editing, versioning, and exports.
- **EPIC-3 (Security & QA)**: Automated test harnesses, RBAC policies, sandbox confinement.

## User Stories & Acceptance Criteria
### US-101: Project Kickoff Initiation
- **As a** Project Lead,
- **I want to** initialize the project governance wizard with stack and team constraints,
- **So that** the autonomous agent organization generates the complete document pack.
- **Estimate**: 5 Story Points | **Priority**: High

### US-102: Document Review & CEO Pack Approval
- **As a** Stakeholder,
- **I want to** inspect cross-agent document reviews and approve the final release pack,
- **So that** tickets can be assigned and exported to Jira / XLSX.
- **Estimate**: 8 Story Points | **Priority**: High

## Engineering Task Breakdown & Dependencies
| Task ID | Description | Assignee Role | Estimate (hrs) | Depends On |
|---|---|---|---|---|
| TASK-01 | Setup Drizzle DB schema & migrations | DevOps / CTO | 4 | None |
| TASK-02 | Implement document validation service | PM / CTO | 6 | TASK-01 |
| TASK-03 | Build Document Center UI & diff viewer | Frontend Lead | 8 | TASK-02 |
| TASK-04 | Setup CI/CD sandbox & test runner | DevOps / QA | 4 | TASK-01 |
`,
  },

  team_allocation: {
    kind: "team_allocation",
    title: "Team Allocation & Capacity Sheet",
    fileName: "TEAM_ALLOCATION.md",
    authorRole: "ceo",
    reviewerRoles: ["pm", "cto"],
    requiredSections: [
      { id: "team_roster", heading: "Team Roster & Skill Matrix", aliases: ["Team Roster & Skill Matrix", "Team Roster", "Skill Matrix"], description: "Human team members, roles, and skills" },
      { id: "workstream_assignments", heading: "Workstream & Role Assignments", aliases: ["Workstream & Role Assignments", "Workstream Assignments", "Role Assignments"], description: "Allocation of members to workstreams" },
      { id: "capacity_ratios", heading: "Capacity Ratios & On-Call Coverage", aliases: ["Capacity Ratios & On-Call Coverage", "Capacity Planning", "On-Call Coverage"], description: "Weekly availability and rotation" },
    ],
    templateGenerator: (ctx) => `# Team Allocation & Capacity Sheet: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Team Roster & Skill Matrix
- **Team Size**: ${ctx.teamSize || "5 Core Members"}
- **Identified Skills**: ${ctx.teamSkills || "TypeScript, React, PostgreSQL, Docker, Security Auditing, Test Automation"}

| Name | Role | Primary Skills | Weekly Capacity (hrs) |
|---|---|---|---|
| Alice Morgan | Lead Architect | Node.js, Systems, Drizzle, DB | 40 |
| Bob Chen | Frontend Specialist | React, Vite, Tailwind CSS | 40 |
| Carlos Diaz | QA Engineer | Vitest, E2E, Test Planning | 35 |
| Diana Vance | DevOps Engineer | Docker, CI/CD, Linux Sandboxes | 35 |
| Evan Wright | Security Lead | STRIDE, RBAC, Auth Audits | 20 |

## Workstream & Role Assignments
- **Architecture & Backend**: Alice Morgan (Lead), Bob Chen
- **UI & Document Center**: Bob Chen (Lead)
- **Quality Assurance**: Carlos Diaz
- **Infrastructure & Deployments**: Diana Vance
- **Security & Compliance**: Evan Wright

## Capacity Ratios & On-Call Coverage
- Development Capacity: 75%
- Review & Bug Triage: 15%
- Maintenance / On-Call: 10%
`,
  },

  test_strategy: {
    kind: "test_strategy",
    title: "Test Strategy & QA Checklist",
    fileName: "TEST_STRATEGY.md",
    authorRole: "qa",
    reviewerRoles: ["pm", "cto"],
    requiredSections: [
      { id: "test_philosophy", heading: "Testing Strategy & Scope", aliases: ["Testing Strategy & Scope", "Test Strategy", "Testing Strategy"], description: "Testing pyramid and objectives" },
      { id: "test_pyramid_levels", heading: "Test Levels & Automation Matrix", aliases: ["Test Levels & Automation Matrix", "Test Levels", "Automation Matrix"], description: "Unit, integration, E2E breakdown" },
      { id: "qa_checklist", heading: "Release QA Checklist & Criteria", aliases: ["Release QA Checklist & Criteria", "QA Checklist", "Release Criteria"], description: "Pre-deployment verification checklist" },
    ],
    templateGenerator: (ctx) => `# Test Strategy & QA Checklist: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Testing Strategy & Scope
Ensures high reliability for ${ctx.projectName} through deterministic automated testing, contract validation, and sandbox isolation checks.

## Test Levels & Automation Matrix
| Level | Framework | Scope | Gate Threshold |
|---|---|---|---|
| Unit Tests | Vitest | Services, validators, helpers | 100% pass, >85% coverage |
| Integration Tests | Vitest + Supertest | REST endpoints, DB transactions | 100% pass |
| UI Component Tests | Vitest + JSDOM | React components, token gates | 100% pass, 0 token violations |
| Sandbox Security | Isolated runner | Out-of-policy filesystem/network blocks | 0 bypasses |

## Release QA Checklist & Criteria
- [ ] All 12 governance documents pass validation with zero missing sections.
- [ ] Token gates pass cleanly (\`pnpm check:token-gates\`).
- [ ] RBAC & tenant isolation verified across all endpoints.
- [ ] Fallback executed successfully during model provider simulation.
`,
  },

  cicd_infra: {
    kind: "cicd_infra",
    title: "CI/CD Pipeline & Infrastructure Specification",
    fileName: "INFRA_SPEC.md",
    authorRole: "devops",
    reviewerRoles: ["cto", "security"],
    requiredSections: [
      { id: "infra_topology", heading: "Infrastructure Topology & Environments", aliases: ["Infrastructure Topology & Environments", "Infrastructure Topology", "Environments"], description: "Staging and production topologies" },
      { id: "cicd_pipeline", heading: "CI/CD Workflow & Build Gates", aliases: ["CI/CD Workflow & Build Gates", "CI/CD Pipeline", "Build Gates"], description: "Continuous integration stages" },
      { id: "container_spec", heading: "Container & Sandbox Specification", aliases: ["Container & Sandbox Specification", "Container Spec", "Sandbox Configuration"], description: "Docker, Compose, and Bubblewrap configuration" },
    ],
    templateGenerator: (ctx) => `# CI/CD Pipeline & Infrastructure Specification: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Infrastructure Topology & Environments
- **Stack**: ${ctx.preferredStack || "Node.js, PostgreSQL, Docker"}
- **Staging Environment**: Isolated VPC with automated ephemeral preview deployments.
- **Production Environment**: High-availability container cluster with automated health checks.

## CI/CD Workflow & Build Gates
1. **Pre-flight**: Node version policy check (\`check:node-version\`), forbidden tokens check.
2. **Compile & Gate**: TypeScript typecheck (\`pnpm -r typecheck\`), token-gates check (\`check:token-gates\`).
3. **Automated Test Suite**: Full server, adapter, and UI test runs.
4. **Artifact Build & Packaging**: Docker image build with signed metadata.

## Container & Sandbox Specification
- Linux: Bubblewrap (\`bwrap\`) sandbox with strictly confined \`filesystemScope: workspace\` and \`networkScope: isolated\`.
- Windows / Host: Isolated containerized dev environments.
`,
  },

  threat_model: {
    kind: "threat_model",
    title: "Threat Model & Security Requirements",
    fileName: "THREAT_MODEL.md",
    authorRole: "security",
    reviewerRoles: ["cto", "ceo"],
    requiredSections: [
      { id: "stride_analysis", heading: "STRIDE Threat Analysis", aliases: ["STRIDE Threat Analysis", "STRIDE Analysis", "Threat Analysis"], description: "Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege" },
      { id: "security_controls", heading: "Security Controls & Mitigations", aliases: ["Security Controls & Mitigations", "Security Controls", "Mitigations"], description: "Encryption, auth, RBAC" },
      { id: "compliance_audit", heading: "Compliance, Secrets & Audit Logging", aliases: ["Compliance, Secrets & Audit Logging", "Audit Logging", "Secrets Management"], description: "Key rotation, secret hashing, audit trail" },
    ],
    templateGenerator: (ctx) => `# Threat Model & Security Requirements: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## STRIDE Threat Analysis
| Threat Category | Potential Vector | Impact | Mitigation Strategy |
|---|---|---|---|
| **Spoofing** | Forged agent identity in REST calls | High | HMAC / Bearer agent API tokens with company scoping |
| **Tampering** | Unsanctioned prompt or document edit | High | Immutable document version logs & audit trail |
| **Repudiation** | Denied mutation of project pack | Medium | Activity log records for every mutating operation |
| **Information Disclosure** | API keys leaked in server logs | Critical | Masked key displays (last 4 chars) & hashed storage |
| **Denial of Service** | Model rate limit exhaustion | High | Automatic OpenCode fallback & exponential backoff |
| **Elevation of Privilege** | Cross-tenant company access | Critical | Company-scoped query gates on every route |

## Security Controls & Mitigations
- AES-256-GCM encryption for stored provider secrets.
- Strict sandbox enforcement preventing unauthorized disk or network traversal.

## Compliance, Secrets & Audit Logging
- All security-relevant actions write to the audit log table.
- Secret keys are never returned in plain text in API responses.
`,
  },

  risk_raci: {
    kind: "risk_raci",
    title: "Risk Register & RACI Matrix",
    fileName: "RISK_RACI.md",
    authorRole: "ceo",
    reviewerRoles: ["pm", "cto", "security"],
    requiredSections: [
      { id: "risk_register", heading: "Project Risk Register & Scoring", aliases: ["Project Risk Register & Scoring", "Risk Register", "Risk Scoring"], description: "Risk matrix with probability and impact" },
      { id: "raci_matrix", heading: "RACI Governance Matrix", aliases: ["RACI Governance Matrix", "RACI Matrix", "RACI"], description: "Responsible, Accountable, Consulted, Informed matrix" },
      { id: "contingency_plans", heading: "Contingency & Escalation Procedures", aliases: ["Contingency & Escalation Procedures", "Contingency Plans", "Escalation"], description: "Escalation paths for blockers" },
    ],
    templateGenerator: (ctx) => `# Risk Register & RACI Matrix: ${ctx.projectName}
${ctx.isDemo ? "> **Notice: Generated in Demo Mode**\n" : ""}
## Project Risk Register & Scoring
| Risk ID | Description | Prob (1-5) | Impact (1-5) | Score | Mitigation |
|---|---|---|---|---|---|
| RISK-01 | Primary model quota exhaustion | 4 | 4 | 16 | Automatic fallback to secondary OpenCode model |
| RISK-02 | Scope creep during document refinement | 3 | 3 | 9 | Strict acceptance criteria and CEO approval gate |
| RISK-03 | Cross-platform sandbox differences | 3 | 4 | 12 | Standardized WSL2 / container deployment guidelines |

## RACI Governance Matrix
| Deliverable / Action | CEO | CTO | PM | QA | DevOps | Security |
|---|---|---|---|---|---|---|
| Project Charter & Vision | **A** | C | C | I | I | I |
| PRD & Requirements | C | C | **A** | C | I | I |
| Architecture & ADRs | I | **A** | C | I | C | C |
| Test Strategy & QA Plan | I | C | C | **A** | I | I |
| CI/CD & Infra Spec | I | C | I | I | **A** | C |
| Threat Model & Security | C | C | I | I | C | **A** |
| Final Pack Sign-off | **A** | C | C | C | C | C |

*Legend: **A** = Accountable, **R** = Responsible, **C** = Consulted, **I** = Informed*

## Contingency & Escalation Procedures
- Critical blockers are escalated directly to the CEO within the task discussion thread.
- Conflicting architectural requirements between Security and CTO trigger an ADR review session.
`,
  },
};

/**
 * Validates that a markdown document contains all required section headings.
 */
export function validateGovernanceDocument(
  kind: GovernanceDocumentKind,
  content: string,
): { valid: boolean; missingSections: string[]; foundSections: string[] } {
  const def = GOVERNANCE_DOC_DEFINITIONS[kind];
  if (!def) {
    return { valid: false, missingSections: [`Unknown document kind: ${kind}`], foundSections: [] };
  }

  const lines = content.split(/\r?\n/);
  const headings = lines
    .filter((l) => /^#{1,4}\s+/.test(l))
    .map((l) => l.replace(/^#{1,4}\s+/, "").trim().toLowerCase());

  const missingSections: string[] = [];
  const foundSections: string[] = [];

  for (const req of def.requiredSections) {
    const candidates = [req.heading, ...(req.aliases || [])].map((c) => c.toLowerCase());
    const matched = headings.some((h) => candidates.some((c) => h.includes(c) || c.includes(h)));

    if (matched) {
      foundSections.push(req.heading);
    } else {
      missingSections.push(req.heading);
    }
  }

  return {
    valid: missingSections.length === 0,
    missingSections,
    foundSections,
  };
}

/**
 * Generates initial markdown content for all 12 documents for a given project context.
 */
export function generateGovernanceDocumentPack(
  context: GovernanceProjectContext,
): Record<GovernanceDocumentKind, { title: string; fileName: string; content: string; authorRole: string }> {
  const result: any = {};
  for (const kind of GOVERNANCE_DOCUMENT_KINDS) {
    const def = GOVERNANCE_DOC_DEFINITIONS[kind];
    result[kind] = {
      title: def.title,
      fileName: def.fileName,
      content: def.templateGenerator(context),
      authorRole: def.authorRole,
    };
  }
  return result;
}
