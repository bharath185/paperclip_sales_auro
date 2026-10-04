# Auro OpenCode: Troubleshooting & Operational Guide

This document lists common operational scenarios, diagnostic commands, and resolutions.

---

## 1. OpenCode API Key & Model Upstream

**Symptom**: Model calls use simulated responses or return demo metrics.  
**Cause**: `OPENCODE_API_KEY` is unset or empty in the environment.  
**Resolution**:
1. Obtain an API key from OpenCode / provider dashboard.
2. Export `OPENCODE_API_KEY="your-actual-key"` or add it to `.env`.
3. Verify live connection by running:
   ```bash
   OPENCODE_API_KEY="your-key" node scripts/live-smoke/run-live-smoke.mjs
   ```

---

## 2. Windows Agent Sandbox Warnings

**Symptom**: Agent tool execution is disabled or shows *Sandbox isolation unavailable on Windows host*.  
**Cause**: Linux namespace sandboxing (`bwrap`) is unavailable on Windows native host processes.  
**Resolution**:
- **Option A (Recommended)**: Run the application inside Docker Desktop or WSL2.
- **Option B (Admin Opt-in)**: Add `SANDBOX_OVERRIDE_UNCONFINED=true` to `.env` if you explicitly trust the agent scripts running on your machine.

---

## 3. Database Migrations & PGlite Reset

**Symptom**: Database schema errors or relation mismatch after switching branches.  
**Resolution**:
- If using embedded PGlite, clear the local data directory and re-migrate:
  ```bash
  rm -rf data/pglite
  pnpm db:migrate
  pnpm dev
  ```
- If using external PostgreSQL (`DATABASE_URL`), execute:
  ```bash
  pnpm db:migrate
  ```

---

## 4. 429 Quota Exhaustion & Campaign Pausing

**Symptom**: Sales campaign status displays `paused` with *HTTP 429: Outbound provider daily quota reached*.  
**Cause**: Daily email send limit or LLM provider token rate limit was reached.  
**Resolution**:
1. Check the **Quota Warning Banner** in the Usage / Dashboard view.
2. In the campaign view, click **Resume Campaign** once the provider rate limit window resets or daily quota increments.
3. The fallback service will automatically route lightweight operations to `deepseek/deepseek-v4-flash`.

---

## 5. Cold Email Sender Identity Requirement

**Symptom**: Live email sending fails with *Sender identity incomplete: physicalAddress, legalBusinessName required*.  
**Cause**: Statutory compliance gate prevents sending live outbound emails without physical business address and verified company name.  
**Resolution**:
1. Go to **Settings > Sales > Sender Identity**.
2. Complete all required fields: Sender Name, Sender Email, Legal Business Name, Physical Postal Address.
3. Save changes and re-trigger batch send.
