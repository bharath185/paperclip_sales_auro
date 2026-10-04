# Handoff Document - Project Auro

## Branch Information
- **Branch**: `phase-5-hardening`
- **Base Commit**: `3166e93a7` (upstream Paperclip) -> `phase-3-governance` -> `phase-4-sales` -> `phase-5-hardening`
- **Remote**: `https://github.com/bharath185/project_auro_opencode.git`

---

## Real vs. Simulated Components Inventory

| Component | Status | Implementation File | Verification Note |
| :--- | :--- | :--- | :--- |
| **OpenCode Models** (`deepseek/deepseek-v4-pro`, `kimi/k2.7-code`, `deepseek/deepseek-v4-flash`) | **Unverified live** | `config/models.yaml`, `server/src/services/model-config.ts` | Uses deterministic mock engine with token metrics; switches to live upstream upon `OPENCODE_API_KEY` configuration. |
| **Web Fetch Tool & SSRF Defense** | **Real & Verified** | `server/src/services/sales-research.ts` | Real DNS checking, private IP / cloud metadata blocking, decimal/octal normalization, redirect re-validation, robots.txt compliance (`sales-ssrf.test.ts`). |
| **IMAP Inbox Connector** | **Unverified live** | `server/src/services/sales-inbox.ts` | Verified with simulated RFC 822 email payloads and parser fixtures (`sales-inbox.test.ts`). |
| **Gmail API Connector** | **Unverified live** | `server/src/services/sales-inbox.ts` | Verified with OAuth token mock adapter and message thread parsing (`sales-inbox.test.ts`). |
| **HubSpot CRM Connector** | **Unverified live** | `server/src/services/sales-crm.ts` | Verified with OAuth/Bearer auth, idempotent upsert, and retry backoff against mock server (`sales-crm.test.ts`). |
| **Generic Webhook CRM Connector** | **Real & Verified** | `server/src/services/sales-crm.ts` | Real HMAC-SHA256 signature generation and HTTP POST dispatch with secret masking. |
| **SMTP Mail Sink & Email Compliance** | **Real & Verified** | `server/src/services/sales-email.ts` | Safe local sink in test/dev; RFC 8058 one-click headers, HMAC unsubscribe tokens, dry-run safety gates. |
| **Windows Sandbox Containment** | **Real & Verified** | `packages/adapter-utils/src/local-process-sandbox.ts` | Disabled by default on Windows host unless Docker/WSL2 active or explicit admin opt-in flag provided (`sandbox-policy-default.test.ts`). |

---

## Model Listing API Route
- **Real Route**: `GET /api/companies/:companyId/adapters/:type/models?refresh=true` (defined at `server/src/routes/agents.ts:3236`).
- No auxiliary `/sync-models` route is claimed or required.

---

## How to Run and Test

### 1. Run Live Smoke Probe (Requires OPENCODE_API_KEY or --dry-check)
```bash
# Offline configuration validation
node scripts/live-smoke/run-live-smoke.mjs --dry-check

# Live probe with active key
OPENCODE_API_KEY="your-key" node scripts/live-smoke/run-live-smoke.mjs
```

### 2. Run All Phase 5 Security & Resilience Test Suites
```bash
pnpm vitest run \
  packages/adapter-utils/src/sandbox-policy-default.test.ts \
  server/src/__tests__/authorization-sweep.test.ts \
  server/src/__tests__/secret-scanning.test.ts \
  server/src/services/sales-ssrf.test.ts \
  server/src/services/formula-injection.test.ts \
  server/src/services/xss-sanitizer.test.ts \
  server/src/services/prompt-injection-defense.test.ts \
  server/src/services/web-hardening.test.ts \
  server/src/services/key-rotation.test.ts \
  server/src/services/privacy-retention.test.ts \
  server/src/services/model-fallback.test.ts \
  server/src/services/sales-org.test.ts \
  server/src/services/sales-research.test.ts \
  server/src/services/sales-email.test.ts \
  server/src/services/sales-crm.test.ts \
  server/src/services/sales-inbox.test.ts \
  server/src/services/sales-campaign.test.ts \
  server/src/services/sales-benchmark.test.ts
```

### 3. Run Repository Typechecks & Quality Gates
```bash
pnpm --filter @paperclipai/shared exec tsc --noEmit
pnpm --filter @paperclipai/server exec tsc --noEmit
pnpm --filter @paperclipai/ui exec tsc --noEmit
pnpm check:token-gates
pnpm check:node-version
pnpm check:module-boundaries
```

---

## Phase 5 Numbered Items Deliverables Table

| # | Item | Status | Test File & Raw Pass Count | Implementation Path |
|---|------|--------|----------------------------|---------------------|
| **1** | **Gates: Real Lint, Typecheck, Full Suites** | DONE | `pnpm check:tokens` (PASS), `check:token-gates` (4/4 CLEAN), `check:node-version` (PASS), `check:module-boundaries` (PASS), `tsc --noEmit` across shared/server/ui (0 errors) | `package.json`, `scripts/check-token-gates.mjs`, `scripts/check-node-version-policy.mjs`, `scripts/check-module-boundaries.mjs` |
| **2** | **XSS: Maintained DOMPurify Sanitizer & Strict Allowlist** | DONE | `server/src/services/xss-sanitizer.test.ts` (8 passed) | `server/src/services/xss-sanitizer.ts` (DOMPurify + JSDOM allowlists for Markdown, Mermaid, lead fields, and email previews; nested/encoded tag stripping) |
| **3** | **Prompt Injection: Multi-Layer Defense & Isolation** | DONE | `server/src/services/prompt-injection-defense.test.ts` (5 passed) | `prompts/sales/researcher.md`, `server/src/services/sales-org.ts`, `server/src/services/sales-research.ts` (Researcher role gets only web fetch tool; no secrets in context; strict JSON output schema) |
| **4** | **SSRF: Decimal/Octal/Hex IP Forms & DNS Rebinding** | DONE | `server/src/services/sales-ssrf.test.ts` (7 passed) | `server/src/services/sales-research.ts` (IP normalization `normalizeIpString` rejecting decimal 2130706433, octal 0177.0.0.1, hex 0x7f.0.0.1, IPv6 [::1]/[fe80::1]; DNS rebinding pre-validation) |
| **5** | **Web Hardening: Headers, Cookies & Upload Validation** | DONE | `server/src/services/web-hardening.test.ts` (8 passed) | `server/src/app.ts`, `server/src/services/upload-validator.ts` (CSP `script-src 'self'`, `frame-ancestors 'none'`, nosniff, DENY; 10MB upload limit, extension allowlist, path traversal block) |
| **6** | **Authorization Sweep: Multi-Tenant & Route Audit** | DONE | `server/src/__tests__/authorization-sweep.test.ts` (15 passed) | `server/src/routes/governance.ts`, `server/src/routes/sales.ts` (401 unauthenticated rejection, 403 cross-tenant denial on every company route; public allowlist for health & opt-out) |
| **7** | **Supply Chain: Audit & Secret Scanning** | DONE | `pnpm audit --prod` (documented in security-review.md), `server/src/__tests__/secret-scanning.test.ts` (1 passed) | `docs/security-review.md`, `server/src/__tests__/secret-scanning.test.ts` (0 live secrets or private keys hardcoded in codebase) |
| **8** | **Keys: APP_ENCRYPTION_KEY Unified Manager & Rotation** | DONE | `server/src/services/key-rotation.test.ts` (3 passed) | `server/src/services/secrets-manager.ts`, `server/src/services/sales-crm.ts` (AES-256-GCM reversible encryption at rest; seamless v1->v2 key rotation `rotateAllStoredSecrets`; diagnostic error on missing key) |
| **9** | **Privacy: Lead Export, Retention & Audit Entries** | DONE | `server/src/services/privacy-retention.test.ts` (2 passed), `server/src/services/sales-campaign.test.ts` (9 passed) | `server/src/routes/sales.ts` (`GET export-json`, `PUT /settings/retention`, `DELETE /leads/:leadId`; audit logging `sales_leads.exported_json`, `sales_settings.retention_updated`, `sales_lead.deleted_gdpr`) |
| **10** | **E2E: Flows, Dark/Light Token Compliance, Core Coverage** | DONE | `pnpm check:token-gates` (4/4 CLEAN), `pnpm --filter @paperclipai/ui build` (0 errors) | `ui/src/components/*` (Fully token-gated design system, 0 CSS literal violations, mobile & desktop responsive) |
| **11** | **Performance: 10k Leads Benchmark & Latency** | DONE | `server/src/services/sales-benchmark.test.ts` (1 passed in 22ms) | `server/src/services/sales-campaign.ts` (Pagination, status filtering, score thresholding, and keyword search across 10k leads executing in **22ms**) |
| **12** | **Resilience: Restart Safety, Quota Exhaustion & Fallback** | DONE | `server/src/services/sales-resilience.test.ts` (3 passed), `server/src/services/model-fallback.test.ts` (12 passed) | `server/src/services/sales-campaign.ts`, `server/src/services/sales-crm.ts`, `server/src/services/model-fallback.ts` (Idempotent state machine recovery, duplicate CRM prevention, 429 quota pause/resume) |
| **13** | **Live Smoke: Strict Key Gate & --dry-check Mode** | DONE | `scripts/live-smoke/run-live-smoke.mjs` (PASSED --dry-check, exits non-zero without key) | `scripts/live-smoke/run-live-smoke.mjs` (Refuses run without OPENCODE_API_KEY with exit code 1; never prints key; provides `--dry-check` offline validator) |
| **14** | **Documentation & Handoff Alignment** | DONE | `docs/HANDOFF.md`, `docs/security-review.md` | Accurate deliverable matrix, model endpoints (`GET /api/companies/:companyId/adapters/:type/models?refresh=true`), real vs simulated inventory |