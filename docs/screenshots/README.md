# Auro OpenCode: Visual Design & Responsive Screenshots Inventory

This directory documents the responsive viewport and theme coverage for Auro OpenCode's core application screens across light and dark modes at desktop (1440x900) and mobile (390x844) dimensions.

---

## 1. Verified Screen Coverage Matrix

| Screen / Feature Page | Desktop (Dark) | Desktop (Light) | Mobile (Dark) | Mobile (Light) | Visual Invariants & Token Compliance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **First-Run Master Setup Wizard** | `setup-desktop-dark.png` | `setup-desktop-light.png` | `setup-mobile-dark.png` | `setup-mobile-light.png` | Token-gated surface borders, centered wizard container, single-row footer. |
| **Governance Kickoff & Document Center** | `governance-desktop-dark.png` | `governance-desktop-light.png` | `governance-mobile-dark.png` | `governance-mobile-light.png` | 12-doc split view, live Mermaid diagram rendering, syntax-highlighted editor. |
| **Sales Campaign Lead Center** | `sales-desktop-dark.png` | `sales-desktop-light.png` | `sales-mobile-dark.png` | `sales-mobile-light.png` | Lead score badges (0-100), source citations, filter bar, approval actions. |
| **Sales Approvals Inbox** | `approvals-desktop-dark.png` | `approvals-desktop-light.png` | `approvals-mobile-dark.png` | `approvals-mobile-light.png` | Checkbox multi-select, decision maker cards, approval confirmation modal. |
| **Email Sequence & Footers** | `email-seq-desktop-dark.png` | `email-seq-desktop-light.png` | `email-seq-mobile-dark.png` | `email-seq-mobile-light.png` | 3-touch timeline, CAN-SPAM sender identity footer preview, RFC 8058 header tag. |
| **Hot Leads & Reply Triage** | `hot-leads-desktop-dark.png` | `hot-leads-desktop-light.png` | `hot-leads-mobile-dark.png` | `hot-leads-mobile-light.png` | Sentiment indicator badges (*positive*, *meeting_requested*), CRM sync status. |
| **Quota & Model Usage** | `quota-desktop-dark.png` | `quota-desktop-light.png` | `quota-mobile-dark.png` | `quota-mobile-light.png` | DeepSeek V4 Pro / Kimi K2.7 Code usage meters, QuotaWarningBanner alert state. |

---

## 2. Design System Token Audit

- **Token Enforcement**: All colors, radii, shadows, and font sizes comply with `DESIGN.md` and `ui/src/index.css`.
- **Automated Token Gate Verification**: `pnpm check:token-gates` validates all 4 token gates as **CLEAN** (0 color literals, 0 arbitrary bracket values, 0 raw px font-sizes, 0 legacy hsl vars).
