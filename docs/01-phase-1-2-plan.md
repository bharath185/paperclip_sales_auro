# Project Auro — Phase 1–2 Plan

**Branch:** `phase-1-2-auro-ui`
**Scope:** branded UI and foundational provider/security/demo work; no Governance or Sales workflow implementation.

## Order of work

1. **Auro visual foundation and identity.** Extend the existing token source (`ui/src/index.css`) with semantic light/dark Auro palettes, typography, spacing, surfaces, status colors and focus states. Add JetBrains Mono alongside bundled Inter. Update `DESIGN.md` first, then logo/favicon, document title/metadata and login/About credits. Preserve the MIT license and Paperclip attribution.
2. **Reusable controls and application shell.** Build on existing Radix/Base UI and shared primitives in `ui/src/components/ui/`. Add or adapt Button, Input, Select, Modal, Drawer, Table, Tabs, Badge, Card, Toast, Skeleton, EmptyState, Tooltip and command palette. Rework `Layout` and company context for responsive/collapsible navigation, org switching, search, notifications, profile and theme control. Retain existing routes and API clients.
3. **Screen reskin.** Move existing dashboard, org chart, agents, goals/projects/tasks, activity/audit, costs, approvals, documents and settings onto Auro tokens/components. Preserve route and feature gates; audit old visual literals in component/page styles, replacing only visual debt (not domain/status semantics). Run token gates and focused UI tests after each screen group.
4. **Provider and secret foundation.** Verify OpenCode provider setup, base URL, model IDs and models endpoint against official OpenCode documentation before implementation. Add typed model configuration, server-side encrypted key storage, create/update/test/revoke, health/usage fallback behavior and Settings > Providers. Restrict Auro's model-provider setup to OpenCode while preserving existing Paperclip execution adapters and their data/API compatibility.
5. **Execution safety and authorization.** Add a default-isolated execution option using the repo's existing sandbox/workspace execution boundary, allowlist policy and explicit privileged-mode permission; do not claim host CLI execution is sandboxed. Close specific uncovered authorization/validation/rate-limit/redaction gaps identified in relevant routes and add tenant-denial tests. Avoid weakening or duplicating established route authorization.
6. **Outbound safeguards and demo operations.** Add company-independent global suppression, per-company send quotas, human approval default-on, dry-run default-on, and audited send decisions before adding campaigns. Add deterministic mock/demo seed and zero-send behavior. Add or adapt Docker Compose and `.env.example` so a fresh local demo uses no provider credentials and cannot send real email.
7. **Verification and handoff.** Run token gates, lint/typecheck/tests/build, targeted provider/secret/RBAC/suppression tests, then launch the app and inspect Auro key screens at mobile/desktop in both themes. Fix observed regressions, record actual screen coverage and known gaps, and commit each coherent milestone.

## Primary paths

- **Design/identity:** `DESIGN.md`, `ui/src/index.css`, `ui/public/` fonts/icons, `ui/index.html`, `ui/src/components/Layout*`, `ui/src/pages/Auth*`, About/Credits surface.
- **Components/screens:** `ui/src/components/ui/`, `ui/src/components/`, `ui/src/pages/`, `ui/src/App.tsx`, Storybook stories/tests.
- **Provider:** `packages/shared/src/` model/provider types and validators; `packages/db/src/schema/` and migrations for credentials/config; `server/src/routes/`, `server/src/services/`, `server/src/app.ts`; provider settings UI and API client.
- **Safety:** existing execution target/workspace modules under `server/src/services/` and `packages/adapter-utils/`; authz middleware/routes; secret redaction and logging; additive company-scoped schema only where needed.
- **Email/demo/deploy:** new suppression/limit/approval policy schema and services under `packages/db/`, `packages/shared/`, and `server/`; test adapters/seeds; `docker/`, root Compose entry, `.env.example`, health/config docs.

## Guardrails and exit criteria

- Preserve Paperclip's company boundary, adapter contract, atomic task semantics, activity log, budget hard stops and migrations. No schema/API renames for branding.
- OpenCode is the only Auro **model-provider setup**. Existing execution adapters remain available for compatibility; this phase does not delete their runtimes.
- No provider secret in logs, normal API responses, activity details or client-readable config. Demo/dev email is simulation-only; sending is blocked unless dry-run is explicitly disabled and approval/suppression/limit checks pass.
- Phase exit requires clean token gates, typecheck, lint, relevant tests, build, targeted security tests and a recorded visual inspection matrix. Any gate not run or any remaining security issue is listed in the handoff.

## Main risks

- The existing UI has many routes, experimental gates and branded details; reskinning by tokens may expose inconsistent legacy styling or regress workflows.
- Upstream provider docs/endpoints and license/redistribution terms for font assets must be checked before adding binaries.
- Sandbox coverage differs by execution adapter; only a positively identified isolated target can be called sandboxed.
- A new global suppression policy must be atomic with enqueue and rechecked immediately before delivery to prevent retry/race bypasses.
- A one-command demo must not depend on external keys or accidentally activate live agents, integrations or outbound delivery.
