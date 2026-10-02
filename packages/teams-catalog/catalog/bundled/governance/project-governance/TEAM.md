---
name: Project Governance
description: Autonomous project governance organization consisting of CEO, CTO, PM, QA, DevOps, and Security agents for complete project document generation and review.
schema: agentcompanies/v1
slug: project-governance
category: governance
key: paperclipai/bundled/governance/project-governance
manager: agents/ceo/AGENTS.md
includes:
  - agents/cto/AGENTS.md
  - agents/pm/AGENTS.md
  - agents/qa/AGENTS.md
  - agents/devops/AGENTS.md
  - agents/security/AGENTS.md
  - projects/project-governance/PROJECT.md
defaultInstall: false
recommendedForCompanyTypes:
  - software
  - startup
  - enterprise
  - governance
tags:
  - governance
  - executive
  - architecture
  - security
  - qa
  - devops
requiredSkills:
  - paperclipai/bundled/paperclip-operations/task-planning
  - paperclipai/bundled/paperclip-operations/issue-triage
  - paperclipai/bundled/docs/doc-maintenance
  - paperclipai/bundled/quality/qa-acceptance
---

# Project Governance

The Project Governance team provides comprehensive, autonomous project kickoff, architecture definition, requirements decomposition, quality assurance, infrastructure planning, and security modeling.

## Organization Structure

- `CEO` — Executive lead. Owns high-level strategy, workstream decomposition, dependency tracking, conflict resolution, and final document pack sign-off.
- `CTO` — Technical architecture and design decisions (`docs/ARCHITECTURE.md`, `docs/ADR-*.md`). Reports to CEO.
- `PM` — Product requirements and user stories (`docs/PRD.md`, `docs/USER_STORIES.md`). Reports to CEO.
- `QA` — Quality assurance strategy, test matrix, and acceptance validation (`docs/TEST_PLAN.md`). Reports to CEO.
- `DevOps` — Infrastructure architecture, CI/CD pipelines, and deployment specifications (`docs/INFRA_SPEC.md`). Reports to CEO.
- `Security` — Threat modeling, security baselines, and cross-review validation (`docs/THREAT_MODEL.md`). Reports to CEO.
- `project-governance` project — Backlog for project kickoff, workstreams, and document compilation.
