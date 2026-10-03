# Auro Live Smoke & Integration Probe Suite

This suite verifies live-key connectivity, model mappings, 429 rate-limit fallback behavior, and end-to-end Governance and Sales agent workflows against active API endpoints.

---

## Prerequisites

Set your environment variables before running:

```bash
export OPENCODE_API_KEY="your-opencode-api-key"
export API_BASE_URL="http://localhost:3100"
```

If no key is provided, the test suite automatically enters **Simulation & Mock Diagnostic Mode** to validate pipeline integrity without failing ungracefully.

---

## Probes Included

1. **Model ID & Catalog Verification**:
   - Queries `GET /api/adapters/opencode/models`
   - Verifies canonical model IDs:
     - `deepseek/deepseek-v4-pro` (Primary)
     - `kimi/k2.7-code` (Security / Hard Coding)
     - `deepseek/deepseek-v4-flash` (Fallback / Light Roles)

2. **429 Rate-Limit Fallback Verification**:
   - Triggers simulated 429 / 402 quota exhaustion error on primary model.
   - Proves seamless fallback transition to `deepseek/deepseek-v4-flash` and quota warning telemetry logging.

3. **Governance Pack Probe**:
   - Provisions 6-agent Governance organization.
   - Generates full 12-document pack.
   - Validates document section headers and exports.

4. **Sales & Lead Generation Probe**:
   - Provisions 7-agent Sales team.
   - Executes lead research stage.
   - Validates email compliance (RFC 8058 headers, HMAC unsubscribe token, dry-run safety).
   - Syncs lead batch to mock CRM with AES-256-GCM encrypted credentials.

---

## Running the Smoke Suite

```bash
node scripts/live-smoke/run-live-smoke.mjs
```
