# Project Auro Outreach Compliance & Data Privacy Safeguards

> [!IMPORTANT]
> **Notice & Disclaimer**: The technical measures and policies documented below represent **engineering safeguards and automated control mechanisms**, not formal legal advice. Organizations deploying outbound business communications must review applicable statutory regulations with qualified legal counsel.

---

## 1. Statutory Regulatory Alignment

Project Auro embeds proactive engineering controls across three major privacy and commercial messaging frameworks:

### A. Digital Personal Data Protection Act, 2023 (India - DPDP Act)
1. **Public Business Data Limitation**: Researcher agents collect only publicly available commercial directory information and corporate contact channels. Personal confidential identifiers (private phone numbers, personal Gmail/Yahoo accounts, residential addresses) are prohibited and filtered.
2. **Purpose Limitation**: Outreach is strictly confined to B2B commercial context relevant to the prospect's stated corporate function.
3. **Right to Withdraw & Erasure (Opt-Out)**: Every email includes an automated one-click unsubscribe mechanism. Opt-out requests permanently suppress the recipient across all campaigns in under 1 second.
4. **Data Security**: Contact records and API credentials are protected via AES-256-GCM encryption at rest and TLS 1.3 in transit.

### B. CAN-SPAM Act Principles (United States)
1. **No Misleading Header or Subject Information**: The `From:`, `To:`, and `Reply-To:` headers accurately reflect the sender's real corporate domain.
2. **Mandatory Physical Postal Address**: Every outbound email footer includes the sender's physical office postal address.
3. **Conspicuous Opt-Out Link**: Clear, functional unsubscribe URL that remains valid for at least 30 days without requiring user sign-in.
4. **Prompt Opt-Out Processing**: Automated unsubscribe processing is immediate (zero delay, well within CAN-SPAM's 10 business days requirement).

### C. General Data Protection Regulation (EU - GDPR B2B Principles)
1. **Legitimate Interest Assessment (LIA) Principles**: Outreach targets verified decision-makers where a reasonable professional interest exists based on industry role.
2. **Deterministic Cryptographic Suppression**: Suppression list stores SHA-256 hashes (`emailHash`) of opted-out addresses rather than plain text, preventing re-identification while guaranteeing permanent exclusion from future sends.
3. **Human-in-the-Loop Gate**: All outbound batches require human approval by default before dispatch.

---

## 2. Automated Engineering Safeguards Matrix

| Safeguard | Automated Mechanism | Default State |
|-----------|---------------------|---------------|
| **Dry-Run Outbox** | Outbound messages rendered to preview without live network dispatch | **ENABLED (`dryRun: true`)** |
| **Human Approval Gate** | All drafted sequences placed in `pending_approval` state | **ENABLED (`requireHumanApproval: true`)** |
| **Global Suppression Check** | Deterministic SHA-256 lookup in `email_global_suppressions` before every send attempt | **MANDATORY (Non-bypassable)** |
| **Mandatory Compliance Footer** | Body text and HTML validation verifying presence of physical postal address & unsubscribe URL | **MANDATORY (Pre-send check fails if missing)** |
| **Domain-Level Throttling** | Maximum 3 emails per corporate domain per 24-hour window | **ACTIVE** |
| **Warm-Up Schedule Limits** | Daily volume gradually stepped from 10/day (Day 1-3) to 50+/day (Day 14+) | **ACTIVE** |
| **Hard-Bounce Auto-Suppression** | Delivery failure webhook triggers immediate insertion into `email_global_suppressions` | **AUTOMATIC** |
