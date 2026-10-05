# Auro OpenCode: Autonomous AI-Agent Control Plane & Governance Engine

**Auro OpenCode** is an enterprise-grade AI agent control plane and autonomous organizational orchestration system. Built on top of Paperclip and powered by OpenCode models, Auro provides two production-ready, pre-configured organizations:

1. **Project Governance Organization**: Autonomous C-suite alignment (CEO, CTO, PM, QA, Security, DevOps) that turns high-level product visions into a complete 12-document engineering pack with export to Jira, CSV, and Markdown.
2. **Sales & Lead Generation Organization**: Autonomous outbound pipeline (Sales Manager, Web Researchers, Email Copywriter, SDR) with prompt-injection defense, statutory compliance (CAN-SPAM/GDPR/RFC 8058), human approval queues, and pluggable CRM integrations.

---

## Key Features

- 🏢 **Dual Pre-Configured Organizations**: One-click provisioning for Governance and Sales agent rosters.
- 🛡️ **Hardened Multi-Layer Security**: Strict Content Security Policy, DOMPurify XSS sanitization, anti-SSRF with IP normalization, formula injection prevention, and AES-256-GCM authenticated credential encryption.
- 🤖 **Curated Model Routing**: Automatic role-based model assignments using **DeepSeek V4 Pro**, **Kimi K2.7 Code**, and **DeepSeek V4 Flash** with automatic 429 fallback and quota monitoring.
- ✉️ **Statutory Cold Outbound Compliance**: Mandatory sender verification, RFC 8058 one-click unsubscribe headers, HMAC token verification, per-domain throttling, and local mail sinks.
- 🔒 **Windows Sandbox Default Containment**: Enforces Docker/WSL2 isolation or requires explicit administrative opt-in with security warnings.

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v20.x or v22.x (v24.x supported)
- **pnpm**: v9.x or later
- **Docker & Docker Compose** (optional, recommended for production & Windows sandboxing)

### 2. Installation & Local Development
```bash
# Clone the repository
git clone https://github.com/bharath185/paperclip_sales_auro.git
cd paperclip_sales_auro

# Install dependencies
pnpm install

# (Optional) Set your Gemini or OpenRouter API key for live AI research
# In Windows PowerShell:
$env:GEMINI_API_KEY="your-gemini-api-key"
# In Linux/macOS:
export GEMINI_API_KEY="your-gemini-api-key"

# Build all packages
pnpm build

# Start the full-stack server and UI in dev mode (uses embedded database automatically)
pnpm dev
```

Visit the dashboard at: **`http://localhost:3100`**

### 3. Running with Docker Compose
```bash
# Copy example environment configuration
cp .env.example .env

# Build and launch services
docker compose up -d
```

The application will be accessible at `http://localhost:3100` with automated health checks at `/api/health`.

---

## The Two Autonomous Organizations

### 1. Project Governance Organization
- **Roles**: CEO (Vision), PM (PRD & Sprint Planning), CTO (Architecture), Security Engineer (Threat Model & Compliance), QA Lead (Test Strategy), DevOps Engineer (CI/CD Pipeline).
- **Deliverables**: 12 standardized markdown documents (`CHARTER.md`, `PRD.md`, `ARCHITECTURE.md`, `SECURITY-REVIEW.md`, etc.) rendered in an interactive Document Center with Mermaid diagram preview and Jira/CSV export.

### 2. Sales & Outbound Lead Generation Organization
- **Roles**: Sales Manager (Campaign Strategy), Web Researchers (Enrichment with tool isolation), Copywriter (3-Touch Sequence), SDR (Reply & Meeting Triage).
- **Features**: Bengaluru manufacturing target default, multi-researcher scaling (1-3 instances), lead deduplication, human-in-the-loop review queue, and HubSpot/Webhook CRM synchronization.

---

## Documentation Directory

- 📖 **[Setup & Deployment Guide](docs/SETUP.md)**: Detailed local, Docker, and environment configuration.
- 🏛️ **[Governance User Guide](docs/GOVERNANCE-USER-GUIDE.md)**: Kickoff wizard, prompt customization, and document export.
- 💼 **[Sales User Guide](docs/SALES-USER-GUIDE.md)**: Campaign creation, research, review gates, and CRM sync.
- 🛡️ **[Security Review & Threat Model](docs/security-review.md)**: STRIDE analysis, cryptographic controls, and penetration test coverage.
- ⚠️ **[Known Gaps & Live Verification Status](docs/KNOWN-GAPS.md)**: Real vs simulated components and live upstream requirements.
- 🔧 **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)**: Common errors, sandbox settings, and key management.

---

## Verification & Quality Gates

Run all automated verification test suites:
```bash
# Token design system compliance
pnpm check:token-gates

# Offline static contract & model check
node scripts/live-smoke/run-live-smoke.mjs --dry-check

# Full security, resilience, and business logic tests
pnpm vitest run \
  packages/adapter-utils/src/sandbox-policy-default.test.ts \
  server/src/services/xss-sanitizer.test.ts \
  server/src/services/prompt-injection-defense.test.ts \
  server/src/services/sales-ssrf.test.ts \
  server/src/services/web-hardening.test.ts \
  server/src/__tests__/authorization-sweep.test.ts \
  server/src/services/key-rotation.test.ts \
  server/src/services/sales-resilience.test.ts \
  server/src/services/sales-crm.test.ts \
  server/src/services/formula-injection.test.ts \
  server/src/services/sales-email.test.ts \
  server/src/services/sales-campaign.test.ts
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
