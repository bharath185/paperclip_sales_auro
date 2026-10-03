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
| **Web Fetch Tool & SSRF Defense** | **Real & Verified** | `server/src/services/sales-research.ts` | Real DNS checking, private IP / cloud metadata blocking, redirect re-validation, robots.txt compliance (`sales-ssrf.test.ts`). |
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

### 1. Run Full Hardening & Smoke Test Suites
```bash
# Run Master Live Smoke Probe
node scripts/live-smoke/run-live-smoke.mjs

# Run All Phase 5 Security & Resilience Test Suites
pnpm vitest run \
  packages/adapter-utils/src/sandbox-policy-default.test.ts \
  server/src/__tests__/authorization-sweep.test.ts \
  server/src/__tests__/secret-scanning.test.ts \
  server/src/services/sales-ssrf.test.ts \
  server/src/services/formula-injection.test.ts \
  server/src/services/xss-sanitizer.test.ts \
  server/src/services/model-fallback.test.ts \
  server/src/services/sales-org.test.ts \
  server/src/services/sales-research.test.ts \
  server/src/services/sales-email.test.ts \
  server/src/services/sales-crm.test.ts \
  server/src/services/sales-inbox.test.ts \
  server/src/services/sales-campaign.test.ts \
  server/src/services/sales-benchmark.test.ts
```

### 2. Run Repository Typechecks & Quality Gates
```bash
pnpm --filter @paperclipai/shared exec tsc --noEmit
pnpm --filter @paperclipai/server exec tsc --noEmit
pnpm --filter @paperclipai/ui exec tsc --noEmit
pnpm check:token-gates
pnpm check:node-version
pnpm check:module-boundaries
```

---

## Phase 5 Verification & Deliverables Report Table

| # | Item | Status | Test File & Raw Pass Count | Implementation Details |
|---|------|--------|----------------------------|------------------------|
| **1** | **Batch 0: Sender Identity & RFC 8058** | DONE | `server/src/services/sales-email.test.ts` (9 passed) | Mandatory org sender identity validation; RFC 8058 one-click unsubscribe headers (`List-Unsubscribe`, `List-Unsubscribe-Post`); HMAC-SHA256 tokens; case/whitespace normalized suppression checks. |
| **2** | **Batch 0 & 1: CRM AES-256-GCM Encryption & Key Rotation** | DONE | `server/src/services/sales-crm.test.ts` (13 passed) | Reversible AES-256-GCM encryption at rest; key rotation versioning (`rotateCrmMasterKey`); secret masking in API responses and logs. |
| **3** | **Batch 1: SSRF Defense & Prompt Injection** | DONE | `server/src/services/sales-ssrf.test.ts` (7 passed), `server/src/services/sales-research.test.ts` (7 passed) | Strict IP filtering (`isPrivateIp` blocking 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.169.254, IPv6 ::1/::ffff:127.0.0.1); 3-hop redirect re-validation; prompt injection neutralization. |
| **4** | **Batch 1: Formula Injection Neutralization** | DONE | `server/src/services/formula-injection.test.ts` (6 passed) | Single-quote prefixing on `=`, `+`, `-`, `@`, `\t`, `\r` across Leads CSV, Sprint Backlog CSV, Jira CSV, and XLSX exports. |
| **5** | **Batch 1: XSS Sanitization** | DONE | `server/src/services/xss-sanitizer.test.ts` (6 passed) | Stripping `<script>`, `<iframe>`, `<object>`, inline event handlers (`onerror`, `onload`), and `javascript:` URIs. |
| **6** | **Batch 1: Authorization & IDOR Matrix Sweep** | DONE | `server/src/__tests__/authorization-sweep.test.ts` (12 passed) | Multi-tenant isolation and 401/403 rejection sweep across Governance and Sales REST routes. |
| **7** | **Batch 1: Secret Scanning Gate** | DONE | `server/src/__tests__/secret-scanning.test.ts` (1 passed) | Automated codebase scan ensuring 0 live private keys, AWS tokens, or model keys are hardcoded in source. |
| **8** | **Batch 1: Privacy Deletion (GDPR Right to Erasure)** | DONE | `server/src/services/sales-campaign.test.ts` (9 passed) | `DELETE /api/companies/:companyId/sales/leads/:leadId` scrubs PII across active campaigns, batches, and hot lead repositories; preserves suppression as SHA-256 hash only. |
| **9** | **Batch 1: STRIDE Threat Model & Security Review** | DONE | `docs/security-review.md` | Comprehensive STRIDE threat model, findings, mitigations, and operational guidance. |
| **10** | **Batch 3: 10k Leads Benchmark & Latency** | DONE | `server/src/services/sales-benchmark.test.ts` (1 passed) | 10,000 leads pagination, status filtering, score thresholding, and keyword search running in under 25ms. |
| **11** | **Batch 4: Live Smoke Runner & Fallback Probe** | DONE | `scripts/live-smoke/run-live-smoke.mjs` (6/6 probes passed) | Automated master live smoke probe suite with model verification and 429 quota exhaustion fallback. |
| **12** | **Repo Quality Gates & Token Layer** | DONE | `pnpm check:token-gates` (4/4 gates clean), `check:node-version` (PASS), `check:module-boundaries` (PASS) | Clean design system tokens, 0 raw styling violations, proper package boundaries. |

---

## Production Activation & Key Management

1. **Environment Key Configuration**:
   ```bash
   export OPENCODE_API_KEY="sk-live-opencode-..."
   export APP_ENCRYPTION_KEY="32-byte-hex-encoded-secret-key"
   ```
2. **Model Endpoints Check**:
   Query `GET /api/companies/:companyId/adapters/opencode_local/models?refresh=true` to fetch active model manifests.
3. **Trigger Live Outbound**:
   Ensure **Settings > Sales > Sender Identity** is completed before running live campaigns with `dryRun: false`.