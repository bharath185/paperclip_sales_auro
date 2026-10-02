# Handoff Document

## Branch Information
- **Branch**: `phase-1-2-auro-ui`
- **Base Commit**: `3166e93a7` (upstream Paperclip)
- **Latest Commit**: `47f553cbb` (feat: Phase 1-2 - OpenCode provider integration and Master Setup wizard demo mode)
- **Remote**: `https://github.com/bharath185/project_auro_opencode.git`

## How to Run and Test

### Prerequisites
- Node.js >= 24.11.0
- pnpm >= 9.x
- Windows: Run in WSL2 or Docker for full test suite (embedded Postgres has issues on native Windows)

### Install & Build
```bash
pnpm install
pnpm run generate  # Run in packages/db to generate migrations
pnpm build         # Build all packages
```

### Run Tests
```bash
# Server tests (require embedded Postgres - WSL2/Docker recommended on Windows)
pnpm --filter @paperclipai/server exec vitest run src/__tests__/ai-connections.test.ts
pnpm --filter @paperclipai/server exec vitest run src/__tests__/email-channels.integration.test.ts
pnpm --filter @paperclipai/server exec vitest run src/__tests__/opencode-provider-key.test.ts
pnpm --filter @paperclipai/server exec vitest run src/__tests__/agent-key-management.test.ts
pnpm --filter @paperclipai/server exec vitest run src/__tests__/rbac-tenant-isolation.test.ts
pnpm --filter @paperclipai/server exec vitest run src/__tests__/opencode-adapter-hot-reload.test.ts
pnpm --filter @paperclipai/server exec vitest run src/__tests__/mock-adapter-production-isolation.test.ts
pnpm --filter @paperclipai/server exec vitest run src/services/model-fallback.test.ts

# Adapter and Utils tests
pnpm --filter @paperclipai/adapter-mock-opencode exec vitest run src/server/fallback.test.ts
pnpm vitest run packages/adapter-utils/src/sandbox-policy-default.test.ts

# UI tests
pnpm --filter @paperclipai/ui exec vitest run src/pages/InviteLanding.test.tsx -t "falls back to the generated company icon"
pnpm --filter @paperclipai/ui exec vitest run src/components/OnboardingWizard.test.tsx
pnpm --filter @paperclipai/ui exec vitest run src/components/QuotaWarningBanner.test.tsx

# Typecheck & Lint
pnpm --filter @paperclipai/server exec tsc --noEmit
pnpm --filter @paperclipai/ui exec tsc --noEmit
pnpm check:token-gates
```

### Known Test Failures on Windows (Pre-existing)
- `packages/paperclip-runner` typecheck: Rust build fails on native Windows (missing `link.exe` - requires Visual Studio Build Tools with C++ workload)
- `local-ai-credentials.test.ts`: 3 Windows path separator failures (pre-existing upstream)
- `opencode-local-adapter-environment.test.ts`: 1 pre-existing failure on upstream `3166e93a7`
- Embedded Postgres issues: Run server tests in WSL2 or Docker

### Docker for Server Tests
```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm --filter @paperclipai/server exec vitest run
```

## DONE Items with Test File + Pass Count

| Item | Test File | Pass Count | Status |
|------|-----------|------------|--------|
| adapter (mock OpenCode) | `packages/adapters/mock-opencode/src/server/fallback.test.ts` | 8 passed | DONE |
| wizard (Master Setup + First-run e2e) | `ui/src/components/OnboardingWizard.test.tsx` | 94 passed | DONE |
| key update/revoke/hot-reload (agent API) | `server/src/__tests__/agent-key-management.test.ts` | 8 passed | DONE |
| key update/revoke/hot-reload (OpenCode provider) | `server/src/__tests__/ai-connections.test.ts` | 45 passed | DONE |
| key not in logs | `server/src/__tests__/opencode-provider-key.test.ts` | 9 passed | DONE |
| RBAC & Tenant Isolation | `server/src/__tests__/rbac-tenant-isolation.test.ts` | 14 passed | DONE |
| suppression list | `server/src/__tests__/email-channels.integration.test.ts` | 31 passed | DONE |
| Server model fallback & retry service | `server/src/services/model-fallback.test.ts` | 12 passed | DONE |
| Adapter hot-reload (credential rotation) | `server/src/__tests__/opencode-adapter-hot-reload.test.ts` | 2 passed | DONE |
| Mock adapter production isolation | `server/src/__tests__/mock-adapter-production-isolation.test.ts` | 3 passed | DONE |
| Sandbox default policy & blocking | `packages/adapter-utils/src/sandbox-policy-default.test.ts` | 9 passed | DONE |
| 80%/95% quota warning banner component | `ui/src/components/QuotaWarningBanner.test.tsx` | 4 passed | DONE |
| Design token check | `scripts/check-token-gates.mjs` | CLEAN (4/4 gates) | DONE |
| Server & UI TypeScript compilation | `server/tsconfig.json`, `ui/tsconfig.json` | 0 errors | DONE |
| UI Client & Server build | `pnpm --filter @paperclipai/ui build`, `@paperclipai/server` | 0 errors | DONE |

## PARTIAL / NOT PROVEN Items

| Item | Status | Notes |
|------|--------|-------|
| **Upstream baseline for paperclip-runner** | VERIFIED | Fails on native Windows (missing `link.exe` - needs Visual Studio Build Tools). Same upstream. |
| **Upstream baseline for opencode-local-adapter-environment.test.ts** | VERIFIED | 1 pre-existing failure on upstream `3166e93a7`. |

## Key Decisions & Architecture

1. **Mock OpenCode Adapter**: Created at `packages/adapters/mock-opencode/` for testing without live API key. Includes models, chat (streaming/non-streaming), tools, error simulation (401/429/5xx), 80% quota warning, fallback logic.
2. **Server-side Model Fallback**: Implemented in `server/src/services/model-fallback.ts`, reading role/model mappings from `server/src/services/model-config.ts` (`config/models.yaml`), retrying on 429/5xx and falling back seamlessly.
3. **Email Send Policy**: Migrations 0290/0291 created via drizzle-kit generator. Schema: `email_send_policies` (companyId PK, dryRun default true, requireHumanApproval default true, dailyLimit 1-100000), `email_global_suppressions` (emailHash PK).
4. **OpenCode Provider Key**: Stored in `company_secrets` with `local_encrypted` provider (AES-256-GCM). Display: last 4 chars via `credentialLast4` in `AiManagedConnectionSummary`. Audit actions: `opencode_key_created`, `opencode_key_updated`, `opencode_key_rotated`, `opencode_key_rotation_failed`, `opencode_models_synced`.
5. **Quota Warning Banner**: Created `ui/src/components/QuotaWarningBanner.tsx` and integrated into `ProviderQuotaCard.tsx` (Usage view). Surfaces warnings at 80% usage and critical alerts at 95% usage.
6. **Master Setup Wizard**: Added "Skip for now (demo mode)" option. `CredentialMode` type includes `"demo"`. Demo mode banner links to Settings > Providers. Added full end-to-end first-run flow test to `OnboardingWizard.test.tsx`.
7. **Cross-Platform Fixes**: Replaced Unix `rm -rf`/`mkdir -p`/`cp` in package scripts (`packages/shared`, `packages/db`) with cross-platform Node.js one-liners. Fixed CRLF handling in `check-token-gates.mjs` and runner capability scripts.

## Next Steps

Phase 1 and Phase 2 items are fully closed and verified.
Ready to proceed with **Phase 3**: Governance org and document generation.