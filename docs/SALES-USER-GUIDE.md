# User Guide: Sales & Lead Generation Organization

The **Sales & Lead Generation Organization** automates targeted B2B market research, lead qualification, multi-touch email sequence authoring, and CRM handoffs while enforcing statutory compliance.

---

## 1. The Sales Agent Team

| Role | Default Model | Primary Responsibility | Isolation / Tools |
| :--- | :--- | :--- | :--- |
| **Sales Manager** | `deepseek/deepseek-v4-pro` | Campaign brief structuring, researcher task breakdown, approval gate triage | Orchestration, CRM sync |
| **Web Researchers (1-3)** | `kimi/k2.7-code` / `deepseek-v4-pro` | Web enrichment, contact discovery, company qualification | **Restricted tool**: `web_fetch` only; no email/CRM permissions |
| **Email Copywriter** | `deepseek/deepseek-v4-pro` | 3-touch sequence authoring, value proposition tailoring | Sequence generation |
| **SDR / Inbox Triage** | `deepseek/deepseek-v4-flash` | Reply monitoring, sentiment classification, hot lead escalation | Inbound parsing |

---

## 2. Setting Up an Outbound Campaign

1. Navigate to **Sales > New Campaign**.
2. Define campaign parameters:
   - **Campaign Name**: e.g., *Bengaluru Auto Component Operations Outbound*
   - **Target Industry & Location**: *Manufacturing / Auto Components*, *Bengaluru*
   - **Target Titles**: *Plant Head, VP Manufacturing Operations, Director of Engineering*
   - **Offer Value Proposition**: *AI predictive quality control reducing scrap rate by 34%*
   - **Researcher Concurrency**: Choose 1, 2, or 3 concurrent researcher agents.
3. Click **Launch Lead Research**.

---

## 3. Human Approval Gate & Review Workflow

Auro strictly enforces **Human-in-the-Loop** approval before any emails can be sent:

1. As researchers find and score leads (0-100 score based on ICP fit), they appear in the **Approvals Inbox**.
2. Review leads individually or in bulk:
   - View company name, decision maker contact, email, and confidence score.
   - Click **Approve Selected** or **Reject**.
3. Only approved leads advance to the sequence generation and dispatch queue.

---

## 4. Cold Outbound Statutory Compliance & Footers

Every outbound email strictly enforces CAN-SPAM, GDPR, and RFC 8058 compliance:

- **Required Organization Sender Identity**: Before live sending, you must configure **Sender Name**, **Sender Email**, **Legal Business Name**, and **Physical Postal Address** in *Settings > Sales > Sender Identity*. Sending is blocked if any field is missing.
- **RFC 8058 One-Click Headers**: Generates standard `List-Unsubscribe` and `List-Unsubscribe-Post` headers.
- **HMAC Opt-Out Tokens**: Unsubscribe links use cryptographic HMAC-SHA256 tokens that immediately place opt-outs on the SHA-256 suppression list.
- **Domain Throttling**: Limits dispatch to maximum 3 emails per recipient company domain per hour.
- **Safe Dry-Run Default**: Outbound campaigns default to **Dry-Run mode** (capturing emails in the local mail sink) unless explicitly switched to live.

---

## 5. Hot Lead Triage & Pluggable CRM Sync

1. **Hot Lead Escalation**: When an inbound reply is detected with positive sentiment (*"Let's schedule a call"*, *"Send pricing"*), it is flagged immediately in **Hot Leads** with full conversation snippets.
2. **Pluggable CRM Sync**:
   - **HubSpot**: Synchronize contacts, company records, lead scores, and custom notes directly via HubSpot Contacts API v3.
   - **Generic Webhook**: Dispatches HMAC-signed JSON payloads to Zapier, Make.com, or custom webhooks.
   - **CSV Export**: Neutralized CSV export with formula injection protection.
