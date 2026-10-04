# Auro OpenCode: Known Gaps & Unverified Components

**Document Version**: 1.0.0  
**Phase**: Phase 6 Release Preparation  
**Target Build**: `v0.1.0-demo`

This document provides a transparent, comprehensive inventory of all features, integrations, and performance benchmarks that operate against verified mocks or offline test harnesses and remain **unverified against live third-party production endpoints**.

---

## 1. Third-Party Integration Gaps (Requires Live Credentials)

| Component | Current State | Live Requirement for Full Production Proof |
| :--- | :--- | :--- |
| **OpenCode Live Models** (`deepseek/deepseek-v4-pro`, `kimi/k2.7-code`, `deepseek/deepseek-v4-flash`) | Static contract validated via `--dry-check`; offline simulator tested. | Requires a funded `OPENCODE_API_KEY` to verify upstream latency, streaming SSE tokens, and real tool call formatting against OpenCode servers. |
| **IMAP Inbound Listener** | Unit tested against simulated RFC 822 MIME payloads and fixtures (`sales-inbox.test.ts`). | Requires a live IMAP server connection (host, port 993, SSL, mailbox credentials) to verify TCP TLS sockets and real email parsing. |
| **Gmail API Connector** | Unit tested against mock OAuth adapter and message thread parsing fixtures. | Requires Google Cloud Project OAuth client credentials, refresh token flow, and `https://www.googleapis.com/auth/gmail.readonly` scope approval. |
| **HubSpot CRM Connector** | Unit tested against simulated HubSpot v3 Contacts API responses and error codes (`sales-crm.test.ts`). | Requires a production HubSpot Private App Access Token (`pat-...`) to verify remote CRM properties, custom fields (`auro_lead_score`), and live contact creation. |
| **Real Outbound SMTP / SendGrid** | Unit tested with safe `LocalMailSink` preventing accidental socket opens. | Requires live SMTP / SendGrid / AWS SES credentials and verified DNS records (DKIM, SPF, DMARC) on a custom sending domain. |

---

## 2. Infrastructure & Performance Gaps

| Area | Current State | Recommended Production Step |
| :--- | :--- | :--- |
| **Playwright Full Browser E2E** | UI components verified via Vitest + JSDOM unit tests and production Vite builds. | Headless Playwright browser automation suites in CI across Chromium, Firefox, and WebKit on dedicated runner nodes. |
| **High-Concurrency Load Testing** | In-memory 10,000 leads benchmark tested in **23ms** (`sales-benchmark.test.ts`). | Distributed k6 / Locust load tests against production multi-core server with 1,000+ concurrent agent heartbeats. |
| **Real Database Benchmarks** | Verified on embedded PGlite and SQLite test fixtures. | Dedicated PostgreSQL benchmark on AWS RDS / Aurora under high write load with query plan analysis (`EXPLAIN ANALYZE`). |
| **Route-Wide Authorization Sweep** | Automated multi-tenant isolation tested on 15 core Governance and Sales routes (`authorization-sweep.test.ts`). | Automated AST-based route crawler verifying `assertCompanyAccess` on 100% of internal endpoints across all future plugins. |
| **Database-Level Restart Resume** | State machine recovery and retry idempotency tested in `sales-resilience.test.ts`. | Chaos testing with abrupt `SIGKILL` on Node process mid-transaction and verifying recovery directly from persistent PostgreSQL WAL logs. |

---

## 3. Checklist for Live Production Activation

When you are ready to connect live credentials and launch in production:

- [ ] **1. OpenCode API Key**: Add `OPENCODE_API_KEY="sk-..."` to `.env` and run `node scripts/live-smoke/run-live-smoke.mjs` to confirm live provider handshake.
- [ ] **2. Sending Domain DNS**: Configure SPF (`v=spf1 include:... ~all`), DKIM, and DMARC (`v=DMARC1; p=quarantine;`) for your outbound email domain.
- [ ] **3. Sender Identity**: Fill in legal company name and physical postal address in *Settings > Sales > Sender Identity*.
- [ ] **4. CRM Token**: Add HubSpot Private App Token or Webhook URL in *Settings > Sales > CRM Configuration*.
- [ ] **5. Inbound Mailbox**: Configure IMAP host or connect Gmail OAuth in *Settings > Sales > Inbound*.
- [ ] **6. Master Key**: Generate a 64-char hexadecimal key for `APP_ENCRYPTION_KEY` via `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`.
- [ ] **7. Switch Dry-Run Off**: Set `SALES_EMAIL_DRY_RUN=false` in `.env` to begin live outreach to approved leads.
