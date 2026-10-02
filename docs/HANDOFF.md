# Handoff Document - Project Auro

## Branch Information
- **Branch**: `phase-3-governance`
- **Base Commit**: `3166e93a7` (upstream Paperclip)
- **Remote**: `https://github.com/bharath185/project_auro_opencode.git`

## How to Run and Test

### Prerequisites
- Node.js >= 24.11.0
- pnpm >= 9.x
- Windows: Native Windows supported with cross-platform scripts and token verification.

### Run Phase 3 Governance Test Suites
```bash
# Server Phase 3 Suite (57/57 tests passing)
pnpm --filter @paperclipai/server exec vitest run \
  src/services/governance-documents.test.ts \
  src/services/governance-orchestration.test.ts \
  src/services/governance-export.test.ts \
  src/__tests__/governance-routes.test.ts \
  src/services/coding-agent-governance.test.ts \
  src/services/governance-org.test.ts \
  src/services/model-fallback.test.ts

# UI Phase 3 Suite (14/14 tests passing)
pnpm --filter @paperclipai/ui exec vitest run \
  src/components/DocumentCenter.test.tsx \
  src/components/TeamAssignmentView.test.tsx \
  src/components/ProjectKickoffWizard.test.tsx \
  src/components/GovernancePromptEditor.test.tsx \
  src/components/GovernanceOrgCard.test.tsx

# Typechecks & Repo Quality Gates
pnpm --filter @paperclipai/shared exec tsc --noEmit
pnpm --filter @paperclipai/server exec tsc --noEmit
pnpm --filter @paperclipai/ui exec tsc --noEmit
pnpm check:tokens
pnpm check:token-gates
pnpm check:node-version
pnpm check:module-boundaries
```

---

## Phase 3 Verification & Deliverables Report Table

| # | Item | Status | Test File & Raw Pass Count | Implementation Files |
|---|------|--------|----------------------------|----------------------|
| **1** | **Step 0 Loose Ends & Baseline** | DONE | `pnpm check:token-gates` (4/4 gates clean), `check:node-version` (PASS), `check:module-boundaries` (PASS) | Citations: Bubblewrap sandbox (`packages/adapter-utils/src/local-process-sandbox.ts:347`), `QuotaWarningBanner` (`ui/src/components/ProviderQuotaCard.tsx:163`), model-fallback call (`server/src/services/model-fallback.ts:55` & `packages/adapters/mock-opencode/src/server/index.ts:168`) |
| **2** | **Approved Model Mappings** | DONE | `server/src/services/model-fallback.test.ts` (12 passed) | `config/models.yaml`, `server/src/services/model-config.ts`, `packages/adapters/mock-opencode/src/server/index.ts` |
| **3** | **12-Document Governance Pack** | DONE | `server/src/services/governance-documents.test.ts` (7 passed) | `server/src/services/governance-documents.ts` |
| **4** | **Document Templates & Section Validators** | DONE | `server/src/services/governance-documents.test.ts` (7 passed) | `server/src/services/governance-documents.ts` (12 schemas, section structure validation, version diffs) |
| **5** | **Orchestration DAG & Cross-Review Feedback Loops** | DONE | `server/src/services/governance-orchestration.test.ts` (5 passed) | `server/src/services/governance-orchestration.ts` (Dependency ordering, Demo/Live mode tags, Security->Architecture, QA->PRD, DevOps->Infra reviews) |
| **6** | **Document Center UI & CEO Approval Gate** | DONE | `ui/src/components/DocumentCenter.test.tsx` (3 passed), `server/src/__tests__/governance-routes.test.ts` (9 passed) | `ui/src/components/DocumentCenter.tsx`, `server/src/routes/governance.ts` |
| **7** | **Multi-Format Document & Backlog Exporters** | DONE | `server/src/services/governance-export.test.ts` (7 passed) | `server/src/services/governance-export.ts` (Markdown, ZIP, PDF, DOCX, Sprint CSV, Jira CSV, Sprint XLSX) |
| **8** | **Assign to Team View & Capacity Tracking** | DONE | `ui/src/components/TeamAssignmentView.test.tsx` (3 passed), `server/src/__tests__/governance-routes.test.ts` (9 passed) | `ui/src/components/TeamAssignmentView.tsx`, `server/src/services/governance-team-assignment.ts` |
| **9** | **Coding Agent Sandbox Governance & Merge Gate** | DONE | `server/src/services/coding-agent-governance.test.ts` (14 passed) | `server/src/services/coding-agent-governance.ts` (Workspace confinement, dangerous command blocker, PR template validator, human merge approval) |

---

## Generated Export Sample Artifacts

The following sample files were generated and verified during export test execution:
- **Full ZIP Pack**: `server/exports/sample-pack/project-auro-governance-pack.zip`
- **Consolidated PDF**: `server/exports/sample-pack/project-auro-governance-pack.pdf`
- **Consolidated DOCX**: `server/exports/sample-pack/project-auro-governance-pack.docx`
- **Sprint Backlog CSV**: `server/exports/sample-pack/sprint-backlog.csv`
- **Jira-Importable CSV**: `server/exports/sample-pack/jira-import-backlog.csv`
- **Sprint Backlog XLSX**: `server/exports/sample-pack/sprint-backlog.xlsx`
- **Individual Markdown Specs**: `server/exports/sample-pack/CHARTER.md`, `PRD.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, `DB_OPENAPI.md`, `EXECUTION_PLAN.md`, `SPRINT_PLAN.md`, `TEAM_ALLOCATION.md`, `TEST_STRATEGY.md`, `INFRA_SPEC.md`, `THREAT_MODEL.md`, `RISK_RACI.md`

---

## Approved Model Inventory & Live Verification Status

All role assignments in `config/models.yaml` strictly use the approved models:
1. `opencode/deepseek-v4-pro` - **Unverified live** (Roles: CEO, PM, CTO, QA, DevOps; primary and fallback)
2. `opencode/kimi-k2.7-code` - **Unverified live** (Roles: Security Officer, Coding Agents)
3. `opencode/deepseek-v4-flash` - **Unverified live** (Roles: Fallback for light roles / general fallback)

### Manual Checklist for Live OpenCode Key Activation
When a real OpenCode API key is provided:
- [ ] Set `OPENCODE_API_KEY` in environment or navigate to **Settings > Providers > OpenCode** and enter key.
- [ ] Run live verification probe against OpenCode models endpoint (`POST /api/ai/connections/opencode/sync-models`).
- [ ] Execute a live kickoff run with `{ isDemo: false }` to stream responses from DeepSeek V4 Pro and Kimi K2.7 Code.
- [ ] Confirm token usage and latency metrics in the Provider Quota dashboard.
- [ ] Verify automatic fallback from DeepSeek V4 Pro to DeepSeek V4 Flash upon simulating 429 rate limits.

---

## Next Step
Phase 3 is complete and verified. Awaiting user command: **"Start Phase 4"** (Sales Organization & Outreach Pipeline).