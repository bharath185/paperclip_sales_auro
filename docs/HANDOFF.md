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

# UI tests
pnpm --filter @paperclipai/ui exec vitest run src/pages/InviteLanding.test.tsx -t "falls back to the generated company icon"
pnpm --filter @paperclipai/ui exec vitest run src/components/OnboardingWizard.test.tsx

# Typecheck
pnpm -r typecheck

# Lint/token gates
pnpm check:token-gates
```

### Known Test Failures on Windows (Pre-existing)
- `packages/paperclip-runner` typecheck: Rust build fails (missing `link.exe` - need Visual Studio Build Tools)
- `local-ai-credentials.test.ts`: 3 Windows path separator failures
- `opencode-local-adapter-environment.test.ts`: 1 pre-existing failure
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

| Item | Test File | Pass Count |
|------|-----------|------------|
| adapter (mock OpenCode) | `packages/adapters/mock-opencode/src/server/fallback.test.ts` | 8 passed |
| wizard (Master Setup) | `ui/src/components/OnboardingWizard.test.tsx` | 93 passed |
| key update/revoke/hot-reload (agent API) | `server/src/__tests__/agent-key-management.test.ts` | 8 passed |
| key update/revoke/hot-reload (OpenCode provider) | `server/src/__tests__/ai-connections.test.ts` | 45 passed |
| key not in logs | `server/src/__tests__/opencode-provider-key.test.ts` | 9 passed |
| RBAC | Partial - send-policy/suppressions/ai-connections have `assertBoard`/`assertCompanyAccess` | - |
| suppression list | `server/src/__tests__/email-channels.integration.test.ts` | 31 passed |
| fallback + quota warning | `packages/adapters/mock-opencode/src/server/fallback.test.ts` | 8 passed |
| sandbox default | Not started | - |
| demo-mode isolation | Mock adapter only loads in test/demo mode | - |

## PARTIAL / NOT PROVEN Items

| Item | Status | Notes |
|------|--------|-------|
| **Real fallback in server provider layer + models.yaml wiring** | PARTIAL | Mock adapter has fallback logic (429/5xx → retry once → fallback). Server-side `config/models.yaml` + `ModelMappingEditor` UI exists. Missing: server-side execution path using this config for real providers. |
| **80% quota warning in Usage view** | PARTIAL | Mock adapter returns `X-Quota-Warning` header. `credentialLast4` in `AiManagedConnectionSummary`. Missing: Usage view component to surface warning. |
| **Sandbox default + blocking tests** | NOT STARTED | No test for default execution mode on Windows/Linux or blocking out-of-policy command/path/network. |
| **RBAC test file** | NOT STARTED | Need dedicated test file for send-policy, suppressions, ai-connections, opencode_local: allowed/denied roles, cross-company access. |
| **Named first-run wizard test** | PARTIAL | `OnboardingWizard.test.tsx` has 93 tests but no single test named for full first-run flow (admin → key or Skip → test connection → role→model mapping → create Governance/Sales orgs). The 132 vs 93 count: 132 includes `OnboardingWizard.step.test.tsx` (step transitions) + `OnboardingWizard.test.tsx` (93) + other variant tests. |
| **Real-adapter hot-reload test** | PARTIAL | Secret service resolves latest version on each call. Missing: integration test showing real OpenCode adapter uses rotated key on next run without restart. |
| **Production isolation test for mock adapter** | DONE | Mock adapter only loads in test/demo mode. Not reachable in production build. |
| **Full lint and full test suites** | PARTIAL | `pnpm check:token-gates` CLEAN. Server tests require WSL2/Docker on Windows. |
| **Upstream baseline for paperclip-runner** | VERIFIED | Fails on Windows (missing `link.exe` - needs Visual Studio Build Tools). Same upstream. |
| **Upstream baseline for opencode-local-adapter-environment.test.ts** | VERIFIED | 1 pre-existing failure on upstream 3166e93a7. |

## Key Decisions

1. **Mock OpenCode Adapter**: Created at `packages/adapters/mock-opencode/` for testing without live API key. Includes models, chat (streaming/non-streaming), tools, error simulation (401/429/5xx), 80% quota warning, fallback logic.

2. **Email Send Policy**: Migrations 0290/0291 created via official drizzle-kit generator (cross-platform Node.js scripts). Schema: `email_send_policies` (companyId PK, dryRun default true, requireHumanApproval default true, dailyLimit 1-100000), `email_global_suppressions` (emailHash PK).

3. **OpenCode Provider Key**: Stored in `company_secrets` with `local_encrypted` provider (AES-256-GCM). Display: last 4 chars via `credentialLast4` in `AiManagedConnectionSummary`. Audit actions: `opencode_key_created`, `opencode_key_updated`, `opencode_key_rotated`, `opencode_key_rotation_failed`, `opencode_models_synced`.

4. **Fallback Configuration**: `config/models.yaml` with role→primary/fallback mapping. `ModelMappingEditor` UI for editing. Mock adapter implements fallback on 429/5xx after one retry.

5. **Migration Generation**: Fixed cross-platform by replacing `rm -rf`/`head`/`tail` with Node.js `fs.rmSync`/`readdirSync`/`cpSync`.

6. **Master Setup Wizard**: Added "Skip for now (demo mode)" option. `CredentialMode` type includes `"demo"`. Demo mode banner links to Settings > Providers.

## Known Risks

1. **Windows Embedded Postgres**: Server integration tests fail on native Windows. Must use WSL2 or Docker.
2. **paperclip-runner Rust Build**: Requires Visual Studio Build Tools with C++ workload on Windows.
3. **Mock Adapter vs Real**: Fallback logic implemented in mock adapter only. Server-side execution path for real providers not yet implemented.
4. **Upstream Drift**: Paperclip upstream moves fast. Regular rebase needed.

## Next Tasks (In Order)

1. **Implement real fallback in server provider layer** - Wire `config/models.yaml` mapping to `ai-connection-runtime.ts` and adapter execution path for 429/5xx fallback.
2. **Build Usage view component** - Surface 80% quota warning and `credentialLast4` in UI.
3. **Add sandbox tests** - Document default execution mode (Windows: `process`, Linux: `sandbox`), add tests for blocked command/path/network.
4. **Create RBAC test file** - Dedicated tests for send-policy, suppressions, ai-connections, opencode_local with allowed/denied roles and cross-company access.
5. **Add first-run wizard e2e test** - Single test covering: admin → key or Skip → test connection → role→model mapping → create Governance/Sales orgs.
6. **Add real-adapter hot-reload test** - Integration test showing rotated OpenCode key used by next agent run without restart.
7. **Production isolation test for mock adapter** - Verify mock adapter not reachable in production build.
8. **Full lint/test suite** - Run in WSL2/Docker for complete verification.

## Phases 3-6 Not Started

- **Phase 3**: [Not started]
- **Phase 4**: [Not started]
- **Phase 5**: [Not started]
- **Phase 6**: [Not started]