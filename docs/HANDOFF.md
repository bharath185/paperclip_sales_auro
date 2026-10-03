# Handoff Document - Project Auro

## Branch Information
- **Branch**: `phase-4-sales`
- **Base Commit**: `3166e93a7` (upstream Paperclip) -> `phase-3-governance` -> `phase-4-sales`
- **Remote**: `https://github.com/bharath185/project_auro_opencode.git`

## How to Run and Test

### Prerequisites
- Node.js >= 24.11.0
- pnpm >= 9.x
- Windows: Native Windows supported with cross-platform scripts and token verification.

### Run Phase 4 Sales Test Suites
```bash
# Full Sales & Governance Targeted Vitest Suite (111/111 tests passing across 17 suites)
npx vitest run \
  packages/adapter-utils/src/sandbox-policy-default.test.ts \
  server/src/__tests__/opencode-models-route.test.ts \
  server/src/__tests__/sales-routes.test.ts \
  server/src/services/sales-org.test.ts \
  server/src/services/sales-research.test.ts \
  server/src/services/sales-email.test.ts \
  server/src/services/sales-crm.test.ts \
  server/src/services/sales-inbox.test.ts \
  server/src/services/sales-campaign.test.ts \
  ui/src/components/LeadCampaignWizard.test.tsx \
  ui/src/components/LeadCenter.test.tsx \
  ui/src/components/EmailSequenceEditor.test.tsx \
  ui/src/components/HotLeadsView.test.tsx \
  ui/src/components/SuppressionManager.test.tsx \
  ui/src/components/SalesApprovalsInbox.test.tsx \
  ui/src/pages/Sales.test.tsx \
  ui/src/components/Sidebar.test.tsx

# Typechecks & Repo Quality Gates
pnpm --filter @paperclipai/shared exec tsc --noEmit
pnpm --filter @paperclipai/server exec tsc --noEmit
pnpm --filter @paperclipai/ui exec tsc --noEmit
pnpm check:token-gates
pnpm check:node-version
pnpm check:module-boundaries
```

---

## Phase 4 Verification & Deliverables Report Table

| # | Item | Status | Test File & Raw Pass Count | Implementation Files |
|---|------|--------|----------------------------|----------------------|
| **1** | **Step 0 Loose Ends & Baseline** | DONE | `packages/adapter-utils/src/sandbox-policy-default.test.ts` (13 passed), `pnpm check:token-gates` (4/4 gates clean), `check:node-version` (PASS), `check:module-boundaries` (PASS) | Windows sandbox disabled by default unless Docker/WSL2 or explicit `ALLOW_UNCONFINED_WINDOWS_HOST=true` (`packages/adapter-utils/src/local-process-sandbox.ts`), RBAC & isolation tests on governance routes (`server/src/__tests__/governance-routes.test.ts`), Markdown editor in Document Center (`ui/src/components/DocumentCenter.tsx`), mock upstream live orchestration (`server/src/services/governance-orchestration.test.ts`) |
| **2** | **Sync-Models Real Route & Approved Models** | DONE | `server/src/__tests__/opencode-models-route.test.ts` (2 passed), `server/src/services/sales-org.test.ts` (3 passed) | Real server route: `server/src/routes/agents.ts:3236` (`GET /api/companies/:companyId/adapters/:type/models?refresh=true`), `config/models.yaml`, `server/src/services/model-config.ts` (DeepSeek V4 Pro for CEO & Sales Manager; DeepSeek V4 Flash for Researcher, Follow-up, CRM Sync) |
| **3** | **Sales Org Template & Versioned Prompts** | DONE | `server/src/services/sales-org.test.ts` (3 passed) | `server/src/services/sales-org.ts`, `prompts/sales/ceo.md`, `sales_manager.md`, `researcher.md`, `follow_up.md`, `crm_sync.md` |
| **4** | **Lead Campaign Wizard (Auro Design)** | DONE | `ui/src/components/LeadCampaignWizard.test.tsx` (2 passed) | `ui/src/components/LeadCampaignWizard.tsx` (Target industries/segments, location, company size, titles, value prop, daily/weekly quotas, email cadence) |
| **5** | **Lead Research & Injection Sanitization** | DONE | `server/src/services/sales-research.test.ts` (7 passed) | `server/src/services/sales-research.ts` (Structured JSON schema, Bengaluru manufacturing fixtures, 0-100 ICP scoring, prompt injection sanitization, robots.txt compliance, rate-limiting, source URL tracking) |
| **6** | **Email Compliance & Deliverability** | DONE | `server/src/services/sales-email.test.ts` (7 passed) | `server/src/services/sales-email.ts` (3-touch sequence, dry-run safety default, human approval gate default, statutory postal address in footer, 1-click unsubscribe URL, immediate SHA-256 suppression, warm-up schedule, hard-bounce auto-suppression, domain throttling, local mail sink), `docs/compliance-notes.md`, `docs/email-deliverability.md` |
| **7** | **Pluggable CRM Connectors Layer** | DONE | `server/src/services/sales-crm.test.ts` (10 passed) | `server/src/services/sales-crm.ts` (HubSpot connector with token/refresh auth, Generic Webhook connector with HMAC-SHA256 signature, CSV export connector, exponential backoff retry, idempotency keys, secret masking) |
| **8** | **Reply Detection Engine & Hot Leads** | DONE | `server/src/services/sales-inbox.test.ts` (7 passed), `ui/src/components/HotLeadsView.test.tsx` (2 passed) | `server/src/services/sales-inbox.ts` (IMAP & Gmail API connectors behind unified interface, intent classification for meeting requests / positive replies / unsubscribes / hard bounces, CRM stage triggers), `ui/src/components/HotLeadsView.tsx` |
| **9** | **Sales Campaign Orchestration & REST API** | DONE | `server/src/services/sales-campaign.test.ts` (7 passed), `server/src/__tests__/sales-routes.test.ts` (14 passed) | `server/src/services/sales-campaign.ts`, `server/src/routes/sales.ts` (Company isolation, RBAC permissions, campaign lifecycle, review loops) |
| **10** | **Lead Center UI & Privacy/Approvals Gates** | DONE | `ui/src/components/LeadCenter.test.tsx` (2 passed), `ui/src/components/EmailSequenceEditor.test.tsx` (2 passed), `ui/src/components/SuppressionManager.test.tsx` (2 passed), `ui/src/components/SalesApprovalsInbox.test.tsx` (2 passed), `ui/src/pages/Sales.test.tsx` (2 passed), `ui/src/components/Sidebar.test.tsx` (27 passed) | `ui/src/pages/Sales.tsx`, `ui/src/components/LeadCenter.tsx`, `ui/src/components/EmailSequenceEditor.tsx`, `ui/src/components/SalesApprovalsInbox.tsx`, `ui/src/components/HotLeadsView.tsx`, `ui/src/components/SuppressionManager.tsx`, `ui/src/api/sales.ts` |

---

## Approved Model Inventory & Live Verification Status

All role assignments in `config/models.yaml` strictly use the approved models:
1. `opencode/deepseek-v4-pro` - **Unverified live** (Roles: Governance CEO, PM, CTO, QA, DevOps; Sales CEO, Sales Manager)
2. `opencode/kimi-k2.7-code` - **Unverified live** (Roles: Security Officer, Coding Agents, CRM Integration Tasks)
3. `opencode/deepseek-v4-flash` - **Unverified live** (Roles: Sales Researcher, Follow-up, CRM Sync, light role fallback)

### Manual Checklist for Live OpenCode Key Activation
When a real OpenCode API key is provided:
- [ ] Set `OPENCODE_API_KEY` in environment or navigate to **Settings > Providers > OpenCode** and enter key.
- [ ] Run live verification probe against OpenCode models endpoint (`GET /api/companies/:companyId/adapters/opencode_local/models?refresh=true` defined at `server/src/routes/agents.ts:3236`).
- [ ] Execute a live kickoff run with `{ isDemo: false }` to stream responses from DeepSeek V4 Pro and Kimi K2.7 Code.
- [ ] Confirm token usage and latency metrics in the Provider Quota dashboard.
- [ ] Verify automatic fallback from DeepSeek V4 Pro to DeepSeek V4 Flash upon simulating 429 rate limits.

---

## Next Step
Phase 4 is complete and verified. Awaiting user command for next project phase.