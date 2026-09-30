# Project Auro Specification

## Overview

Project Auro is a control plane for AI-agent companies. This specification covers Phase 1 and 2 implementation targeting OpenCode provider integration and Master Setup wizard with demo mode.

## Phase 1: Auro Shell & Branding

### 1.1 Design System
- **Tokens**: Auro design tokens in `ui/src/index.css` (colors, spacing, radius, type, shadows, motion)
- **Themes**: Light/dark mode via CSS variables
- **Mark**: Auro logomark (SVG) with dark/light variants
- **Favicon**: Auro-branded favicon
- **Metadata**: Updated title, description, Open Graph tags

### 1.2 Layout Components
- **Sidebar**: Responsive (collapsed on mobile), theme-aware
- **Header**: Brand, navigation, user menu
- **Footer**: Attribution to Paperclip
- **Routes**: Protected routes with company context

### 1.3 Verification
- Light/dark at mobile (375px) and desktop (1440px)
- Token gates clean (`pnpm check:token-gates`)

## Phase 2: OpenCode Provider Integration

### 2.1 Provider Registration
- **AI_PROVIDERS**: Added `"opencode"` to provider list
- **OpenCode Zen Models**: `listOpenCodeZenModels` server function fetches public catalog from `https://opencode.ai/zen/v1/models`
- **Route**: `/opencode_local` for local OpenCode CLI connections

### 2.2 UI Integration
- **Onboarding**: ModelSourceTiles includes OpenCode option
- **Managed Details**: OpenCode connection management
- **Credential Step**: API key + subscription methods
- **Agent Config Form**: OpenCode model selection

### 2.3 Email Send Policy System
- **Tables**: 
  - `email_send_policies` (companyId PK, dryRun default true, requireHumanApproval default true, dailyLimit 1-100000)
  - `email_global_suppressions` (emailHash PK, reason, source, createdByUserId, createdAt)
- **Migrations**: 0290/0291 via official drizzle-kit generator
- **Services**: `getSendPolicy`, `updateSendPolicy`, `listGlobalSuppressions`, `addGlobalSuppression`, `removeGlobalSuppression`, `assertRecipientsNotSuppressed`, `enforceQuotaBeforeSend`, `lockQuota`
- **API Routes**: `/api/email/send-policy`, `/api/email/global-suppressions`
- **UI**: `EmailEndpointSetup.tsx` panel

### 2.4 Mock OpenCode Adapter
- **Location**: `packages/adapters/mock-opencode/`
- **Endpoints**:
  - `GET /api/opencode/models` - Models list
  - `POST /api/opencode/chat` - Chat completions (streaming + non-streaming)
  - `POST /api/opencode/tools` - Tool calls
- **Error Simulation**: 401 (invalid/exhausted key), 429 (quota), 5xx (server error)
- **Quota Warning**: 80% threshold via `X-Quota-Warning` header
- **Fallback Logic**: On 429/5xx, retry once with fallback model from `config/models.yaml`
- **Test Coverage**: 8 tests in `fallback.test.ts`

### 2.5 Master Setup Wizard Demo Mode
- **CredentialMode**: Extended with `"demo"` option
- **CredentialModeLink**: "Skip for now (demo mode)" option
- **Demo Mode State**: `demoMode` boolean, banner "Demo mode: no OpenCode key"
- **Banner Link**: Links to Settings > Providers to add real key
- **Switch**: Adding key later switches to live mode without restart

### 2.6 Key Management (Agent API Tokens)
- **Schema**: `agent_api_keys` with `keyPrefix` (last 4), `previousKeyHash` (rotation audit)
- **Operations**: 
  - `rotateKey` (test-before-save, keeps old on failure)
  - `revokeKey`
  - `testKey`
  - `listKeys` (returns keyPrefix only, never full token)
- **Audit**: Logs action without key material

### 2.7 OpenCode Provider Key Security
- **Storage**: `company_secrets` with `local_encrypted` provider (AES-256-GCM)
- **Display**: Last 4 chars via `credentialLast4` in `AiManagedConnectionSummary`
- **Audit Actions**: `opencode_key_created`, `opencode_key_updated`, `opencode_key_rotated`, `opencode_key_rotation_failed`, `opencode_models_synced`
- **Routes**: 
  - `POST /ai-connections/:id/keys/:keyId/rotate` (test-before-save)
  - `POST /ai-connections/:id/keys/:keyId/test`
  - `POST /ai-connections/:id/sync-models`
- **Hot-reload**: Secret service resolves latest version on each call
- **Key Scan**: `opencode-provider-key.test.ts` (9 tests) - no key in logs/API responses/prompts/errors

### 2.7 Fallback Configuration
- **File**: `config/models.yaml` with role→primary/fallback mapping
- **Roles**: `default`, `governance`, `sales`, `developer`
- **Quota Warning**: 80% threshold
- **Retry**: 1 retry on 429/500/502/503/504
- **UI Editor**: `ModelMappingEditor` component at `/apps/model-mapping`

### 2.8 Migration Generation Cross-Platform
- **Scripts**: `packages/db/scripts/build.js`, `prune-snapshots.js`
- **Commands**: Node.js `fs.rmSync`/`readdirSync`/`cpSync` instead of `rm`/`head`/`tail`
- **Migration Generation**: `pnpm run generate` in `packages/db`

## Test Coverage

| Test File | Pass Count |
|-----------|------------|
| `InviteLanding.test.tsx` | 1 |
| `OnboardingWizard.test.tsx` | 93 |
| `OnboardingWizard.step.test.tsx` | 14 |
| `ai-connections.test.ts` | 45 |
| `email-channels.integration.test.ts` | 31 |
| `agent-key-management.test.ts` | 8 |
| `opencode-provider-key.test.ts` | 9 |
| `opencode-local-adapter.test.ts` | 5 |
| `secrets-routes.test.ts` | 42 |
| `mock-opencode fallback.test.ts` | 8 |

## Quality Gates

- **Typecheck**: `pnpm -r typecheck` (35/36 packages pass - paperclip-runner fails on Windows linker)
- **Token Gates**: `pnpm check:token-gates` CLEAN
- **Lint**: Token gates serve as lint

## Known Limitations

1. **Windows**: Embedded Postgres fails on native Windows. Use WSL2 or Docker.
2. **paperclip-runner**: Requires Visual Studio Build Tools for Rust compilation.
3. **Fallback**: Only implemented in mock adapter. Server-side execution path for real providers pending.
4. **Sandbox**: Default execution mode and blocking tests not implemented.
5. **RBAC Tests**: No dedicated test file for role-based access control.

## Upstream Baseline (3166e93a7)

| Check | Result |
|-------|--------|
| packages/plugins/sdk typecheck | PASS (Windows build script issue was in shared package) |
| paperclip-runner typecheck | FAIL (missing `link.exe` - same upstream) |
| opencode-local-adapter-environment.test.ts | 1 pre-existing failure |
| local-ai-credentials.test.ts | 3 Windows path separator failures |

## Future Phases (Not Started)

- **Phase 3**: [TBD]
- **Phase 4**: [TBD]
- **Phase 5**: [TBD]
- **Phase 6**: [TBD]