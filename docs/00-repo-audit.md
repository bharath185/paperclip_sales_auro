# Project Auro — Phase 0 Repository Audit

**Status:** Phase 0 complete; no product or UI implementation started
**Audit date:** 2026-09-29
**Upstream:** [`paperclipai/paperclip`](https://github.com/paperclipai/paperclip)
**Audited revision:** `3166e93a7eee315e3bfbda622e080044ec5c343d` (`master`)
**License:** MIT; original `LICENSE` copyright is `Copyright (c) 2025 Paperclip AI`.

## 1. Executive summary

Paperclip is a substantial TypeScript monorepo implementing the core Auro control plane already: multi-company organization, reporting trees, provider/runtime adapters, goals, projects, task threads, durable heartbeats, approvals, costs and budgets, audit activity, secrets, documents/revisions, work products, workspaces, imports/exports, and authenticated human memberships. Replacing this foundation would add risk without closing Auro's main product gaps.

The Auro work is principally additive product development plus a brand/UI replacement:

1. Preserve Paperclip's control-plane data, APIs, transactional execution/governance rules, adapters, and existing security boundaries.
2. Ship two Auro organization templates and a local demo mode with mock execution and no outbound email by default.
3. Add a project kickoff/document-pack workflow and document/backlog export formats.
4. Add a sales campaign, compliant lead lifecycle, human-approved email sequences, suppression, and CRM synchronization.
5. Add a useful human-team assignment/handoff surface on the existing user-assignee model.
6. Replace the Paperclip application brand and UI visual system while keeping its API/data contracts and critical operator surfaces intact.

The most important risks are scope, changing broad and security-sensitive existing behavior while rebranding, public-contact-data and outbound-email compliance, and treating local agent execution as sandboxed when it is not inherently so. The migration plan below deliberately keeps new product domains additive and keeps email sending disabled/simulated in development and demo mode.

## 2. Repository and architecture

### 2.1 Monorepo layout

| Area | Responsibility | Main paths |
|---|---|---|
| `server/` | Express REST API, auth, domain services, scheduler, plugin host, runtime coordination | `server/src/app.ts`, `server/src/index.ts`, `server/src/routes/`, `server/src/services/` |
| `ui/` | React operator application, API client, routing, reusable components and Storybook | `ui/src/App.tsx`, `ui/src/pages/`, `ui/src/components/`, `ui/src/index.css` |
| `packages/db/` | Drizzle/PostgreSQL schema, migrations, DB lifecycle, seed support | `packages/db/src/schema/`, `packages/db/src/migrations/` |
| `packages/shared/` | Shared TypeScript contracts, Zod validation, API constants, permissions and types | `packages/shared/src/` |
| `packages/adapter-utils/`, `packages/adapters/*` | Shared execution contracts and provider/runtime-specific adapters | `packages/adapter-utils/`, `packages/adapters/` |
| `packages/plugins/*` | Plugin SDK, runtime and examples | `packages/plugins/` |
| `packages/teams-catalog/`, `packages/skills-catalog/` | Importable organization/team and skill content | `packages/teams-catalog/`, `packages/skills-catalog/` |
| `cli/` | `paperclipai` setup, admin and agent-facing commands | `cli/` |
| `docs/`, `doc/` | Mintlify product/API/operator docs and internal implementation specs | `docs/`, `doc/` |
| `docker/`, `.github/` | Docker targets/Compose, release and CI workflows | `docker/`, `.github/` |

### 2.2 Technology stack

- Node.js 24.11+; TypeScript; pnpm 9 workspaces.
- Server: Express 5, Zod validation, Pino structured logging, Better Auth, WebSockets and selected SSE endpoints.
- UI: React 19, Vite 8, React Router 7, Tailwind CSS 4, Radix/Base UI, TanStack Query, Storybook, Vitest, Playwright, Mermaid, Markdown/document editing and dnd-kit.
- Persistence: PostgreSQL 17-compatible database through Drizzle ORM and `postgres`; embedded PostgreSQL for local/quickstart use. No Redis is required for the current app.
- Storage: local disk or S3-compatible object storage for attachments/artifacts; local encrypted secret provider is available.
- Background work: server-process scheduler and reconcilers use durable PostgreSQL records/outboxes for wakeups, runs, delivery, recovery and plugin jobs. Agent heartbeats are not an external job-queue service.
- Deployment: Dockerfile, embedded-database quickstart Compose, full PostgreSQL Compose, environment-based settings, health endpoints, migration/backup tooling, CI and release workflows exist.

The stack matches the Auro preference. Keep it. Introduce an external broker only if measured sales/email/agent job throughput or independent worker scaling requires it; implement Auro delivery with persisted idempotent work/outbox records first.

## 3. Existing product capabilities and data model

### 3.1 Core entities

The deployment is single-tenant at the instance level and multi-company (Auro organization) at the product level. Company-scoped rows are the tenant boundary. Major schema families include:

- **Identity and organization:** `companies`, agents, `company_memberships`, instance roles, invitations, join requests, permission grants, user/session/account/verification tables, API keys.
- **Work planning:** `goals`, projects, project-goal links, issues/tasks, parent/child hierarchy, labels, blocker relations, human or agent assignee, comments, thread interactions, approvals and review policies.
- **Agent execution:** `heartbeat_runs`, wakeup requests, run events, task sessions, runtime state, completion/finalization evidence, recovery/watchdog records, workspace/runtime leases and operation history.
- **Governance and visibility:** approvals, execution decisions, budget policies/incidents, activity log, audit/event history, membership and permission checks.
- **Costs and credentials:** cost events and rollups, company/user secrets and versions/bindings, access records, tool connections/grants and adapter authentication sessions.
- **Outputs and files:** Markdown `documents`, append-only `document_revisions`, issue-document associations, annotation threads/comments, assets, attachments and work products.
- **Extensions/automation:** plugins and plugin jobs, routines, pipelines/cases, chat channel/email inbox integrations, tool gateway and skill catalog data.

The schema is mature and already has migration discipline. Add Auro-owned schemas via Drizzle and additive migrations; do not rename or repurpose core tables to fit new UI vocabulary. Audit every new table and foreign key for `company_id` scoping and cross-company rejection.

### 3.2 Work and agent model

- A strict acyclic org tree uses one `reports_to` parent per agent.
- Issues are the canonical task object and support goal/project/parent links, blockers, a single agent or human assignee, comments, attachments, documents, work products, approval/review states and status transitions.
- Atomic task checkout and execution locks prevent double work. Agent and user actions are attributed and mutating operations are audited.
- The control plane schedules and observes heartbeats; adapters run configured agents. Built-ins cover Claude, Codex, Cursor, Gemini, Grok, Kimi, OpenCode, Pi, OpenClaw, Hermes, HTTP and process-style integrations, with a plugin path for more.
- Execution includes sessions, durable wake queues, event logs, workspace setup, cancellation, budget checks, retry/recovery and live-event delivery.
- **Sandbox caveat:** local CLI/process adapters can execute with host privileges unless an isolated execution target is selected/configured. The Auro UI must describe effective isolation accurately; policy prompts alone are not a sandbox.

### 3.3 Documents, exports and templates

- Text-first Markdown documents already have revisions, locking and issue associations; file artifacts can be stored and attached to work.
- Company configuration can be exported/imported as a markdown-first package, including agents, projects, tasks and skills; secrets are excluded. A bundled teams catalog can provide reusable agent-team structure.
- These facilities are a good basis for organization templates and versioned project outputs, but do **not** constitute Auro's project deliverable pack: the required charter/PRD/architecture/ADR/schema/OpenAPI/roadmap/sprint/team allocation/test/security/DevOps/risk/RACI generation contracts, format conversion, ZIP packaging and backlog export are not present as one workflow.

## 4. API, auth, and security baseline

### 4.1 API and live updates

- JSON REST endpoints live under `/api`; routes are mounted in `server/src/app.ts` and domain behavior is primarily implemented in services.
- API contracts/validators/constants are shared from `packages/shared`; `server/src/routes/openapi.ts` provides OpenAPI output. Product docs cover companies, agents, goals/projects, issues, approvals, activity, costs and authentication.
- Main surfaces include companies, org chart/agents, projects, goals, issues/comments, approvals, runs, costs/budgets, activity, documents/assets, workspaces, secrets, integrations/tools, routines, plugins and settings.
- Company live events are available over WebSockets; task and plugin flows also have SSE endpoints. Reuse these for Auro progress and campaign status rather than adding a second uncoordinated event model.
- Mutations use route/service checks, shared validation and activity/audit recording. Preserve established error and access-denial contracts.

### 4.2 Human and agent auth

- Better Auth persists human users, sessions, accounts and verifications. Email/password is enabled. The current Better Auth setup does not configure a social OAuth provider; an accounts table is not proof that Google/GitHub OAuth login is enabled.
- Runtime modes are `local_trusted` for loopback local use and `authenticated` with `private`/`public` exposure. Authenticated mode has bootstrap/claim flows, secure-cookie and origin handling, and mode-dependent auth rate limiting.
- Humans have company memberships and instance roles; the current human company roles include `owner`, `admin`, `operator`, `viewer`. General membership types also include `member`. To meet Auro's Owner/Admin/Member/Viewer product language, decide and implement an explicit, tested mapping (e.g. Auro Member to current Operator) instead of silently broadening permissions.
- Agents use company-bound API keys with hashed-at-rest credentials and short-lived run identity. Authorization checks bind runs and company membership and enforce approval, budget, assignment, trust and execution gates.
- Company secrets support encrypted-at-rest storage and secret references; config reads redact values. Keep secrets out of activity records, generated documents, logs, exports and templates.

### 4.3 Security posture and work still required

Existing strengths to retain: scoped company access, server-derived identity, hashed agent keys, encrypted secret provider, input schemas, audit trail, approval/workflow gates, budget hard stops, execution isolation options, file serving protections, public/private deployment modes, health reporting and CI security/release workflows.

Security work for Auro remains necessary:

- OAuth provider onboarding and Auro role mapping.
- Cross-route RBAC/tenant-isolation verification for every new campaign, lead, document export, integration and human-assignment endpoint.
- Product-level lead provenance, deduplication, opt-out/suppression and deletion/retention rules.
- Untrusted web content handling as data (never instructions); provenance and source URL tracking; respect site rules/robots signals, data minimization and reviewable lead source.
- Email campaign consent/identity/unsubscribe semantics, sending limits, warm-up, idempotent delivery, webhook verification, bounce/reply/opt-out handling and a hard default dry-run mode. Current email support is a task-bound AgentMail-style inbox/delivery integration, not a compliant marketing-campaign system.
- Explicit confirmation that a merge/PR requires a human; sandbox and Git credentials remain separately authorized.
- Auro-specific threat model, dependency/build review, rate limiting on public/high-risk endpoints, secure production Compose defaults and restore/backup coverage for DB plus storage/secrets keys.

These controls are product acceptance requirements, not a legal-compliance certification. Counsel should review jurisdiction-specific outbound-contact and privacy policies before real campaigns are enabled.

## 5. UI and design-system audit

The existing app is a mature responsive operator UI with company switching, dashboards, agent management/detail, org chart, goals/projects/tasks, threaded task work, approvals, activity/audit, costs/budgets, documents/artifacts, search, integrations, secrets, import/export and settings. It includes keyboard and mobile work, loading/error states, Storybook, and multiple feature-gated/production UI variants. Preserve the working information architecture and accessibility behaviors as implementation references.

Current source of truth is root `DESIGN.md` plus `ui/src/index.css`. Values in UI components/pages must route through token variables and `pnpm check:token-gates`; do not add inline palette/spacing/type values. Existing fonts are Inter and system monospace; Auro's JetBrains Mono, green/forest/lime/teal/gold palette, light/dark surfaces, spacing/radius and transition values need to be defined as token values. Current tokens and public-facing product logo/colors are Paperclip, not Auro.

The UI request is a full Auro rebrand and new product-level surfaces (kickoff, lead campaign, lead center, email sequence, human assignment/handoff, richer document center), not evidence that the existing React stack must be replaced. Keep React/Vite, API clients, auth/runtime gates, accessibility, error handling and reusable components. Update `DESIGN.md`, token definitions, logo/favicon/title/onboarding/copy and branded docs/assets coherently; then replace shell/visual language and add screens in controlled increments. Remove only superseded Paperclip presentation assets/surfaces after their behavior is either preserved or explicitly retired.

## 6. Auro gap analysis

| Auro requirement | Existing baseline | Gap / recommended treatment |
|---|---|---|
| Multiple organizations, switcher, custom orgs | Companies are first-class, user memberships and company switcher/import exist | Strong fit. Present as Auro organizations, preserve company boundaries and test active membership on every request. |
| Governance and Sales preconfigured orgs | Bundled team/agent catalog plus company import/export | Add first-class Auro templates with complete org hierarchy, explicit human gates and safe demo adapter configuration. Do not assume importable agent files implement end-to-end workflows. |
| CEO kickoff with full project brief and delegation | Goals/projects/tasks, agent instructions, heartbeats and delegation are core | Add a persisted kickoff/campaign request and workflow that creates linked project/goals/tasks and starts only the intended demo/approved runs. |
| Full versioned project document set | Documents/revisions, issue docs, artifact storage already exist | Add output templates/generation tasks and pack manifest; add rendered/ZIP/CSV/XLSX/Jira exports; verify links/revisions and partial-failure recovery. |
| Project execution/sprint planning | Projects, task hierarchies, blocker relations and assignments provide foundations | Story points/estimates and import-specific backlog shape are not established as first-class task fields; add narrowly scoped typed fields/exports after checking decomposition support rather than a replacement ticket system. |
| Human team assignment/handoff | Human users, company memberships, issue `assignee_user_id`, shared task status | Add human assignment view, member invitation/assignment UX, exports/notifications and make agent/human ownership transitions explicit. |
| Agent providers/models/permissions/budgets | Adapter/model configuration, permissions, secrets, cost tracking, agent budgets | Provider selection is adapter-centric; first-class hosted Anthropic/OpenAI and local Ollama setup may need polish/catalog additions. Preserve adapter contract. |
| Owner/Admin/Member/Viewer RBAC; email/password + OAuth | Sessions/password auth and company roles exist | OAuth providers need configuration; Auro Member semantics need a deliberate mapping from existing `operator`/`member` roles. |
| Governance agents scaffold/code/PR with human merge approval | Repository-backed project workspaces, local/sandbox targets, GitHub connections, review policies/work products | No Auro-specific safe coding-to-human-merge workflow guarantee. Reuse execution workspaces and Git integration; enforce branch scope and review/approval before merge. |
| Sales lead discovery with public source, dedupe, validation, score | Generic web/MCP/tool connections and agent tasks exist | No lead/campaign schema, first-party permitted-source research pipeline, provenance/dedupe/scoring or lead center. Create an isolated Sales domain and enforce prompt-injection boundaries. |
| Approved initial + two follow-up sequence; delivery tracking | Task-bound email inbox/send delivery infrastructure exists | Not campaign automation: SMTP/Gmail campaign connector, sequence state, open/reply/bounce/unsubscribe tracking, identity footer, approval gates and rate policy are missing. Implement dry-run-first. |
| CRM sync; REST/webhook, HubSpot, CSV | Generic app definitions/tool connections may be used for arbitrary integration actions | No dedicated CRM connector contract, sync state/outbox, HubSpot lead lifecycle or CSV/XLSX export workflow. Add adapter interface and per-company scoped credential bindings. |
| Global suppression and DPDP/CAN-SPAM/GDPR principles | No sales suppression/consent model found in core email schema | Add durable opt-out/suppression checked at enqueue and immediately before send, audit changes, and ensure retry/webhook paths cannot bypass it. |
| Usage/cost, alerts, auto-pause, activity and run logs | Existing core capability is extensive | Rebrand, expose campaign/doc generation costs and approvals, and verify all Auro effects produce audit records. |
| In-app/email/webhook notifications | Existing activity/live events and connector infrastructure | Reuse in-app/realtime; add/configure user notifications for new workflow events as needed. Do not conflate existing notifications with campaign mail. |
| Light/dark Auro design and responsive accessible shell | Responsive React app, theme tokens, existing accessibility checks and extensive UI tests | Rebrand shell and all visible legacy marks; add Auro token palette/font/logo; keep token-gate and keyboard/accessibility checks. |
| `docker compose up` with seeded, zero-key demo | Dockerfile and Compose quickstarts exist; Compose currently needs configuration and no Auro demo company pack is guaranteed | Add root-friendly Auro Compose/demo profile, deterministic demo seed, mock LLM/CRM/email, no outbound network/email side effects, documented upgrade to production configuration. |
| Docs, tests, CI, coverage target | Extensive docs, OpenAPI, Vitest/Playwright, CI/build/migration gates | Add Auro setup/architecture/API/user/contribution docs, core flow E2E for both templates, compliance/security review, and an explicit meaningful coverage target for new core domain logic. |

## 7. What to keep, refactor, add and retire

### Keep

- TypeScript/pnpm monorepo, Express/React/Drizzle/PostgreSQL architecture and shared contract pattern.
- Company data boundary, users/memberships, agent org chart/adapters, heartbeats, durable run/recovery logic, issue/task comments, approval/audit/cost/budget controls.
- Secret handling, assets/documents/revisions, project/execution workspaces, Git/tool integrations and template/catalog mechanism.
- Existing production auth/deployment modes, API conventions, health checks, migrations, backups, tests, CI, Docker and user-facing setup docs as the foundation.

### Refactor/add

- Auro vocabulary, templates, company creation/onboarding and demo seeding.
- Design tokens, Auro mark/favicon, login/shell/navigation, dashboard and branded product screens.
- Product-specific `governance` and `sales` modules with typed shared schemas, validation, company-scoped DB changes, services, routes, activity records, UI/API clients, and tests.
- Durable doc-generation/export, lead-campaign, email-sequence and CRM-sync state machines/outboxes with replay-safe IDs and clear approval states.
- Organization-level and cross-organization workspace UX, human assignment/handoff, safe external-connection settings, and Auro guides/deployment instructions.

### Retire only after equivalent behavior is accounted for

- Paperclip logo/mascot/product title and brand-colored presentation in the application and Auro-specific public documentation.
- Redundant legacy visual shell/components/feature variants only when routes and user capabilities have replacement coverage. Do not remove unrequested integrations or database history as part of a visual rewrite.
- Do not remove or overwrite `LICENSE`, original copyright, upstream notices, third-party license files, or provenance. Preserve MIT terms and attribute the Paperclip-derived base.

## 8. Migration and implementation plan

All database work should be additive, migration-backed, and company-scoped. Keep existing API field/state semantics stable. If a required invariant changes, record an ADR and provide an expand/migrate/contract path; do not perform destructive table or data renames for branding.

| Phase | Plan and principal outputs | Exit checks / key risk |
|---|---|---|
| **0 — Audit (this phase)** | Record upstream revision, architecture, data/runtime/API/auth/license, gaps, decisions and migration order in this document. No UI work. | Audit committed before Phase 1. Existing application left untouched. |
| **1 — Auro design system + shell** | Update `DESIGN.md` with approved Auro rules; add token values in `ui/src/index.css`, JetBrains Mono asset/loading, geometric mark/favicon, app metadata and branded responsive shell; retain routes and operator functions while replacing presentation. | `pnpm check:token-gates`, focused UI tests, keyboard/theme/mobile checks and visual review. Main risk: broad existing UI/feature-flag surface causes mixed brand or regressions. |
| **2 — Product backend foundation** | Add domain boundaries and migrations for template/workflow/demo support plus shared API contracts. Decide role mapping and OAuth provider configuration. Add sample organizations/agents in explicit demo mode. | DB migration checks, tenant/RBAC negative tests, auth and demo startup tests. Main risk: role or data-boundary mismatch. |
| **3 — Governance flow** | Kickoff wizard/API → durable work graph and approvals → linked document generation/revisions → document center, diff/comments and PDF/DOCX/MD/ZIP exports → sprint CSV/XLSX/Jira exports → human team assignment. | End-to-end demo project produces required document set, audit/revision trail, human handoff, and downloadable outputs without external keys. |
| **4 — Sales flow** | Campaign brief and workflow → permitted-source leads/provenance/dedupe/score → human lead review → sequence editor/approval/send outbox/suppression/tracking → pluggable REST/webhook, HubSpot and CSV CRM sinks → hot-lead handoff. | Dry-run demo completes chain with no real send; opt-out/approval/sending-limit adversarial tests. Real-send mode remains disabled absent explicit production configuration. |
| **5 — Security, testing, reliability, performance** | Threat-model scraped content/credentials/email/webhooks; verify tenant isolation, roles, rate limits, idempotency, retry/recovery, backup/restore, sandbox boundary, dependency scan, telemetry/log redaction and performance. Add core-flow E2E and measured coverage for Auro domain logic. | Required typecheck/tests/build, Auro security checklist evidence, production-readiness issues resolved or recorded. Main risk: feature surface exceeds practical release validation. |
| **6 — Docs and deployment** | Root Compose experience, `.env.example`, seeded demo mode, production setup and migration/backup/restore instructions; Auro README, architecture, API and both-org user guides, contribution guide; CI/release update. | Fresh clean-machine `docker compose up` acceptance, both organization demo walkthroughs and CI green. |

Before each phase, publish a phase-specific plan; after each phase, record delivered work, remaining scope and risks. The request mandates a commit per phase. Phase 1 must not begin until this Phase 0 document is committed.

## 9. ADR-level recommendations

1. **Retain the Paperclip control plane; do not rewrite the backend.** The existing hard parts match Auro and have important concurrency, governance, recovery and compatibility semantics.
2. **Treat Auro organizations as existing companies.** Preserve `company_id` and expose Auro vocabulary at product/config/template boundaries instead of renaming stored concepts.
3. **Use existing documents and tasks as the durable workflow substrate.** Add workflow-specific records/links and typed output templates; do not invent parallel threads or a second task engine.
4. **Add Sales as a first-party domain, not a loose set of agent prompts.** Leads, sources, suppression, campaign approvals, message deliveries and CRM sync need auditable, idempotent server-side state machines.
5. **Default demo/development to simulated side effects.** Mock LLM, email and CRM; actual email sending requires explicit production configuration and policy checks. Scraped material is untrusted input.
6. **Rebrand through design tokens and application chrome first.** Keep React/Vite and the UI token-only rule; retire Paperclip visual assets after equivalent screens are verified.
7. **Keep external job infrastructure optional initially.** PostgreSQL-backed durable jobs/outboxes plus current worker/scheduler satisfy an initial self-hosted release; add a separate queue only with operational/scale evidence.

## 10. License and attribution obligations

The repository root `LICENSE` is the MIT license and must remain in the derived repository/distribution. MIT permits modification, distribution and sale subject to retaining the copyright notice and license text in copies or substantial portions. Keep Paperclip's existing copyright/license text intact, add an Auro attribution/derivative notice without implying Paperclip authors endorse Auro, and retain all third-party component notices/licenses and upstream notices already included. Rebrand does not transfer upstream copyright or grant rights to use upstream trademarks as the Auro mark.

## 11. Audit basis and limits

This audit is anchored to the checked-out source revision and verified against the repository's governing/product docs (`AGENTS.md`, `doc/GOAL.md`, `doc/PRODUCT.md`, `doc/SPEC-implementation.md`, `doc/DEVELOPING.md`, `doc/DATABASE.md`), package manifests, root license, key DB exports/schema, server app/routes/auth/runtime, UI entry/tokens, adapter/runtime documentation, and Compose/docs. Relevant code entry points are linked inline above. This is an architecture and scope audit, not a line-by-line security certification or dependency/license scan; Phase 5 must execute the specified focused security and dependency reviews.

## 12. Phase 0 completion record

- **Done:** cloned the official upstream, recorded source/revision/license, reviewed the product/implementation/development/database contracts, mapped existing architecture and capabilities, compared Auro requirements, and recorded the migration plan and decisions above.
- **Not started by design:** UI, schema, API, runtime, or product implementation.
- **Remaining:** phase-specific implementation and verification work listed in §8.
- **Phase 0 risk:** this is a broad product with contact-data and outbound-email implications; no real outreach should be enabled until the Auro suppression/approval/sending policy is enforced and tested.
