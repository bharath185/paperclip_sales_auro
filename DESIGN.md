# Project Auro Design System

**Status:** Auro v1 — source of truth for product visual language and interaction patterns. Project Auro is derived from Paperclip; preserve the original MIT license and acknowledge Paperclip in About/Credits. Brand values live in the token layer only.

The interface is a calm, dense, professional control room: forest-green navigation, bright green primary actions, slate content surfaces, mint workflow states, teal information, and warm gold highlights. Avoid decorative gradients, excessive rounded pills, and oversized empty dashboard chrome.

## What this document is for

Agents and humans modifying `ui/` treat this file as the source of truth for design decisions. Storybook is the verification surface — it documents the system; it does not define it. If a change conflicts with this document, change this document first (with review) or change the code.

## Product stance

Project Auro is an operational control plane: organizations, agents, goals, tasks, runs, budgets, approvals, audit logs, documents, and leads. The user is an operator scanning state and making decisions. Every screen should answer, in order: *what is happening, does it need me, what do I do about it.* Density in service of scanning beats whitespace in service of aesthetics — but density comes from information, never from chrome.

## The token layer (where visual values live)

The single token source is **`ui/src/index.css`** (Tailwind v4; tokens are CSS custom properties consumed via `@theme`). Do NOT create a parallel token source such as `ui/src/tokens/` — that would produce two sources of truth. If index.css grows unwieldy, extracted values may live in a `tokens.css` **imported by index.css** so the pipeline still has one root.

Tailwind v4 gotcha: `@theme inline` bakes literal values at build time. Any token that must be runtime-tunable (theme editor, dark mode overrides) must be defined in a NON-inline block.

The Auro token set is defined in `ui/src/index.css` and includes semantic and palette scales. Core brand values:

| Role | Value |
|---|---|
| Primary / hover / active | `#16A34A` / `#15803D` / `#166534` |
| Forest / raised forest | `#0B2A1E` / `#12372A` |
| Mint / mint strong | `#ECFDF5` / `#D1FAE5` |
| Lime / teal / gold | `#A3E635` / `#14B8A6` / `#F59E0B` |
| Danger | `#DC2626` |
| UI / code type | Inter / JetBrains Mono |

Light and dark themes must use WCAG AA text contrast. Bright primary surfaces use a dark forest foreground; dark-surface CTAs use forest text on lime. Every interactive control has a visible keyboard focus indicator. Spacing uses the 8px grid; standard cards use 12px corners; transitions are tokenized in the 150–200ms range unless reduced motion is requested.

## Principles

1. **One way to say each thing.** One component per job. One Button, one Card, one Badge, one Table, one EmptyState. Variants are props, not new components. Before creating a component, prove no existing one covers the job.
2. **Tokens are the only source of visual values.** All color, spacing, radius, type size/weight, shadow, and motion values come from the token layer. No hex, no raw px, no ad-hoc Tailwind arbitrary values (`p-[13px]`) in components. If a needed value doesn't exist, add a token — don't inline it. Tailwind palette classes (`bg-red-500`, `text-zinc-400`, etc.) ARE hardcoded values in spirit: they name a literal color, not a semantic role. They are in-scope debt scheduled for a dedicated future run (Run 4, cluster-by-cluster mapping to semantic tokens per doc/design/DECISION-SHEET.md B2) and are not currently gated by check-token-gates. Exception (doc/design/DECISION-SHEET.md B1 user ruling): first-party intentional one-off decoration on demo/UX-lab surfaces stays inline and allowlisted rather than minted as singleton tokens.
3. **Spacing routes through tokens.** Use the 8px scale for new Auro work; preserve existing geometry where a migration is not necessary. Vertical rhythm within a container uses one gap value, not per-element margins, and siblings never carry both margin and gap.
4. **Hierarchy through structure, not decoration.** Prefer position, size, and weight over borders, backgrounds, and dividers. Every border, divider, and background fill must justify itself; when in doubt, remove it. A screen should survive the removal of one visual layer.
5. **Status is systematic.** States like running / paused / blocked / awaiting-approval / over-budget map to a single semantic status token set used identically everywhere (badge, row, chart, log). An operator learns the vocabulary once.
6. **Machine values look machine-made.** IDs, costs, token counts, timestamps, and log output use the monospace token and consistent formatting helpers. Never format these ad hoc per screen.
7. **Words are part of the system.** Use Auro's canonical terms: *organization* in product-facing copy and *task* in place of technical issue terminology. Buttons name the action ("Approve hire," not "Submit"). Errors say what happened and what to do. Empty states say what to do first.
8. **Agent-modifiable by design.** The system must be changeable via instructions: single token source, lint rules that enforce it, and this document kept current. A correct change should be expressible as "edit tokens + run checks," not "visit 40 files."

## Form and wizard footers

Keep **Save & exit** (or Cancel/Back) and the primary Continue/Connect/Finish
action in one shared footer row, vertically centered. Put the subdued secondary
action on the left and the primary action on the right. A step owns its whole
footer: do not render Save & exit in a separate parent block below it. Check this
alignment in every step and conditional state, not just the first screen.

## Contextual feedback

Do not show a toast for task or run state already visible on the current screen.
This includes descendant runs represented by the open subtree. Show local action
results in place; keep failures actionable inline. Notifications for other work
remain useful. Repeated delivery of the same run outcome must refresh cached state
without repeating its toast, including after reconnecting. A terminal outcome
delivered more than five minutes after the run finished is historical and should
refresh state silently. Expected cancellation is neutral gray, not an error. The composer's Stop action stops the current response and leaves the composer available for a new message. Pause work is a separate explicit task or subtree action. A paused task replaces the composer with an amber takeover. It says “Task is
paused.” and “Resume this task to send a message.” with a “Resume task” action.
Subtrees use “Subtree is paused.” and “Resume subtree.” The takeover cannot be
dismissed, retains drafts, and hides message inputs until the pause is released.

Pending questions, confirmations, and other task-thread inputs appear in a separate
card directly above the ordinary composer. The composer stays available for new
messages while the card is open. Dismissing a card leaves a pending indicator that
can reopen it; resolving or skipping the input removes that indicator.

## Enforcement

- Redesign is intentional; test representative screens in light/dark and mobile/desktop and keep all interaction states operable.
- Token layer is the single source (`ui/src/index.css`) consumed via CSS variables / Tailwind theme — never values copied into components.
- Lint/grep gates pass: zero hardcoded hex values, zero arbitrary spacing values, zero raw font-size declarations in `ui/src/components/**` and `ui/src/pages/**` outside the token layer and a documented allowlist (third-party overrides, intentional opt-outs commented inline).
- `pnpm check:token-gates`, `pnpm build`, `pnpm typecheck`, and relevant UI tests pass.
- AGENTS.md links here and states the token-only rule.

Aspirational (NOT gating this run): no duplicate components; every component has exactly one story covering its variants; all UI copy says "task".

## Attribution

Project Auro is based on Paperclip, an MIT-licensed project. Preserve the upstream license notice and identify Paperclip as the source in About/Credits.

## Motion tokens (Task Chat Redesign)

The redesigned task thread (flag `enableTaskChatRedesign`) is the first surface to
tokenize motion. Principles — reasoning only; values live in `ui/src/index.css`:

- **One home, and it is `:root`, not `@theme inline`.** `@theme inline` bakes literals
  at build time, so a value placed there cannot be moved at runtime. The dev tweak panel
  tunes motion by writing CSS custom properties live, so every motion token must resolve
  at runtime — hence `:root`.
- **Two tiers.** Primitives (`--motion-duration-*`, `--motion-ease-*`) express the app's
  baseline motion feel; state/component-scoped tokens (`--motion-<state>-*`) reference the
  primitives so the whole thread retunes from a few knobs. Scoped tokens exist so the
  tweak panel can group controls by the state they affect.
- **Reuse the house curves.** New easing defaults point at the two curves already used
  across the app rather than inventing a third feel.
- **No hardcoded timing in components.** Durations, easings, delays, and staggers used by
  the redesigned thread must reference these tokens; a check script rejects raw `ms` /
  `cubic-bezier` values outside `ui/src/index.css`. This discipline is what makes the
  tweak panel structurally possible.
- **Values are placeholders.** The committed numbers are sensible starting points, tuned
  live by a human and pasted back from the tweak panel's export — never treated as final
  during the baseline build.
- **Reduced motion is honored at the token layer.** A `prefers-reduced-motion: reduce`
  block collapses the duration/stagger tokens to zero, cascading to every scoped token,
  in addition to each animation's own component-level guard.
