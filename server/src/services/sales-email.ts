import crypto from "node:crypto";
import type { Db } from "@paperclipai/db";
import { emailGlobalSuppressions } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import type { SalesLead } from "./sales-research.js";

export interface EmailSequenceStep {
  stepNumber: 1 | 2 | 3;
  name: string;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface RenderedEmail {
  stepNumber: number;
  to: string;
  from: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  physicalAddress: string;
  legalBusinessName: string;
  headers: Record<string, string>;
  isSuppressed: boolean;
  status: "pending_approval" | "approved" | "sent" | "failed" | "suppressed";
}

export interface SenderIdentity {
  senderName: string;
  senderEmail: string;
  legalBusinessName: string;
  physicalAddress: string;
}

export interface EmailSendPolicyConfig {
  companyId: string;
  dryRun: boolean;
  requireHumanApproval: boolean;
  dailyLimit: number;
  senderIdentity: SenderIdentity;
  warmupDayCount: number;
  maxPerDomainPerHour: number;
}

export function validateSenderIdentity(identity?: Partial<SenderIdentity>): {
  valid: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];
  if (!identity?.senderName?.trim()) missing.push("senderName");
  if (!identity?.senderEmail?.trim() || !identity.senderEmail.includes("@")) missing.push("senderEmail");
  if (!identity?.legalBusinessName?.trim()) missing.push("legalBusinessName");
  if (!identity?.physicalAddress?.trim()) missing.push("physicalAddress");
  return { valid: missing.length === 0, missingFields: missing };
}

export const DEFAULT_3_TOUCH_SEQUENCE: EmailSequenceStep[] = [
  {
    stepNumber: 1,
    name: "Initial Contextual Introduction",
    delayDays: 0,
    subjectTemplate: "Question regarding {{company_name}}'s {{sub_segment}} operations",
    bodyTemplate: `Hi {{contact_name}},

I noticed {{company_name}}'s recent work in {{sub_segment}} across the {{location}} industrial corridor.

Many engineering and plant leaders in {{industry}} we speak with are looking to streamline tooling turnaround times, reduce procurement overhead, and ensure 100% component traceability.

We've built an autonomous workflow engine that helps precision manufacturers accelerate project delivery by 40% while keeping quality governance strict.

Would you be open to a brief 10-minute introductory conversation next Tuesday or Thursday?

Best regards,
{{sender_name}}
{{legal_business_name}}`,
  },
  {
    stepNumber: 2,
    name: "Relevant Proof Point & Case Study",
    delayDays: 3,
    subjectTemplate: "Case study: 35% cycle time reduction for {{industry}} manufacturers",
    bodyTemplate: `Hi {{contact_name}},

Following up on my previous note. I wanted to share a quick metric:

A precision manufacturing facility recently deployed our automated compliance and tooling coordination pipeline, cutting sprint cycle times by 35% within 60 days.

Given {{company_name}}'s focus on {{sub_segment}}, I thought this benchmark might be relevant to your team's current goals.

Do you have 10 minutes this week for a quick walkthrough?

Best regards,
{{sender_name}}
{{legal_business_name}}`,
  },
  {
    stepNumber: 3,
    name: "Polite Check-in / Door Open",
    delayDays: 7,
    subjectTemplate: "Closing the loop / {{company_name}}",
    bodyTemplate: `Hi {{contact_name}},

I know you are very busy managing plant operations at {{company_name}}. I won't follow up further, but wanted to leave the door open.

If optimizing your engineering operations or automation pipelines becomes a priority later this quarter, feel free to reach out anytime.

Wishing you and {{company_name}} continued success.

Best regards,
{{sender_name}}
{{legal_business_name}}`,
  },
];

export function hashEmailAddress(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function generateHmacUnsubscribeToken(
  email: string,
  companyId: string,
  secret: string = process.env.APP_ENCRYPTION_KEY || "auro-unsubscribe-hmac-salt"
): string {
  const normalized = email.trim().toLowerCase();
  const hmac = crypto.createHmac("sha256", secret).update(`${companyId}:${normalized}`).digest("hex");
  return `unsub_${companyId.slice(0, 8)}_${hmac.slice(0, 24)}`;
}

export function verifyHmacUnsubscribeToken(
  email: string,
  companyId: string,
  token: string,
  secret: string = process.env.APP_ENCRYPTION_KEY || "auro-unsubscribe-hmac-salt"
): boolean {
  if (!token || !email || !companyId) return false;
  const expected = generateHmacUnsubscribeToken(email, companyId, secret);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

// Legacy alias for compatibility
export function generateUnsubscribeToken(email: string, companyId: string): string {
  return generateHmacUnsubscribeToken(email, companyId);
}

export function calculateWarmupDailyLimit(dayNumber: number, baseDailyLimit: number = 50): number {
  if (dayNumber <= 3) return 10;
  if (dayNumber <= 7) return 20;
  if (dayNumber <= 14) return 35;
  return baseDailyLimit;
}

/**
 * Replaces merge tags in email templates with lead and sender details.
 */
export function renderEmailTemplate(
  template: string,
  data: {
    lead: SalesLead;
    senderName: string;
    senderEmail: string;
    legalBusinessName: string;
    physicalAddress: string;
    unsubscribeUrl: string;
  },
): string {
  let rendered = template;
  rendered = rendered.replace(/\{\{company_name\}\}/g, data.lead.companyName);
  rendered = rendered.replace(/\{\{contact_name\}\}/g, (data.lead.contactName || data.lead.decisionMakerName || "").split(" ")[0] || "there");
  rendered = rendered.replace(/\{\{title\}\}/g, data.lead.contactTitle || data.lead.decisionMakerTitle || "");
  rendered = rendered.replace(/\{\{industry\}\}/g, data.lead.industry);
  rendered = rendered.replace(/\{\{sub_segment\}\}/g, data.lead.subSegment || data.lead.industry);
  rendered = rendered.replace(/\{\{location\}\}/g, data.lead.locationCity || data.lead.location);
  rendered = rendered.replace(/\{\{sender_name\}\}/g, data.senderName);
  rendered = rendered.replace(/\{\{sender_email\}\}/g, data.senderEmail);
  rendered = rendered.replace(/\{\{legal_business_name\}\}/g, data.legalBusinessName);
  rendered = rendered.replace(/\{\{physical_address\}\}/g, data.physicalAddress);
  rendered = rendered.replace(/\{\{unsubscribe_url\}\}/g, data.unsubscribeUrl);
  return rendered;
}

/**
 * Renders full 3-touch sequence for a single lead with statutory compliance footers and RFC 8058 headers.
 */
export function renderLeadSequence(
  lead: SalesLead,
  options?: {
    customSteps?: EmailSequenceStep[];
    senderIdentity?: Partial<SenderIdentity>;
    senderName?: string;
    senderEmail?: string;
    legalBusinessName?: string;
    physicalAddress?: string;
    appBaseUrl?: string;
  },
): RenderedEmail[] {
  const steps = options?.customSteps || DEFAULT_3_TOUCH_SEQUENCE;
  const senderName = options?.senderIdentity?.senderName || options?.senderName || "Campaign Lead";
  const senderEmail = options?.senderIdentity?.senderEmail || options?.senderEmail || "sales@company.org";
  const legalBusinessName = options?.senderIdentity?.legalBusinessName || options?.legalBusinessName || "Organization";
  const physicalAddress = options?.senderIdentity?.physicalAddress || options?.physicalAddress || "Organization Address";
  const appBaseUrl = options?.appBaseUrl || "https://app.projectauro.com";
  
  const unsubToken = generateHmacUnsubscribeToken(lead.email || lead.contactEmail || "", lead.companyId);
  const recipientEmail = (lead.email || lead.contactEmail || "").trim();
  const unsubscribeUrl = `${appBaseUrl}/api/companies/${lead.companyId}/sales/opt-out?token=${unsubToken}&email=${encodeURIComponent(recipientEmail)}`;
  
  const senderDomain = senderEmail.includes("@") ? senderEmail.split("@")[1] : "example.com";

  return steps.map((step) => {
    const context = {
      lead,
      senderName,
      senderEmail,
      legalBusinessName,
      physicalAddress,
      unsubscribeUrl,
    };

    const subject = renderEmailTemplate(step.subjectTemplate, context);
    const bodyText = renderEmailTemplate(step.bodyTemplate, context);

    const statutoryFooterText = `\n\n---\nYou are receiving this email as a business communication for ${lead.companyName}.\n${legalBusinessName}\n${physicalAddress}\nUnsubscribe: ${unsubscribeUrl}`;
    const fullBodyText = `${bodyText}${statutoryFooterText}`;

    const bodyHtml = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111;">
  <p>${bodyText.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")}</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0 12px 0;" />
  <p style="font-size: 11px; color: #6b7280;">
    You are receiving this commercial communication for ${lead.companyName}.<br/>
    <strong>${legalBusinessName}</strong> &bull; ${physicalAddress}<br/>
    <a href="${unsubscribeUrl}" style="color: #059669; text-decoration: underline;">Unsubscribe (1-click)</a>
  </p>
</div>`.trim();

    return {
      stepNumber: step.stepNumber,
      to: recipientEmail,
      from: `${senderName} <${senderEmail}>`,
      subject,
      bodyText: fullBodyText,
      bodyHtml,
      unsubscribeUrl,
      physicalAddress,
      legalBusinessName,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:optout@${senderDomain}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Entity-Ref-ID": `${lead.companyId}:${lead.id}:touch-${step.stepNumber}`,
      },
      isSuppressed: false,
      status: "pending_approval",
    };
  });
}

/**
 * Domain-level rate limiter to prevent spamming multiple contacts at the same company.
 */
export class DomainThrottler {
  private domainTimestamps: Map<string, number[]> = new Map();

  isAllowed(email: string, maxPerHour: number = 3): { allowed: boolean; retryAfterSec?: number } {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return { allowed: true };

    const now = Date.now();
    const windowStart = now - 3600000; // 1 hour window
    const timestamps = (this.domainTimestamps.get(domain) || []).filter((t) => t > windowStart);

    if (timestamps.length >= maxPerHour) {
      const oldestInWindow = timestamps[0];
      const retryAfterSec = Math.ceil((oldestInWindow + 3600000 - now) / 1000);
      return { allowed: false, retryAfterSec };
    }

    timestamps.push(now);
    this.domainTimestamps.set(domain, timestamps);
    return { allowed: true };
  }

  reset(): void {
    this.domainTimestamps.clear();
  }
}

/**
 * Local mail sink for test and demo isolation (never opens external sockets).
 */
export class LocalMailSink {
  private capturedEmails: RenderedEmail[] = [];

  send(email: RenderedEmail): { success: boolean; sinkId: string; isLocalSink: boolean } {
    const sinkId = `sink_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.capturedEmails.push({ ...email, status: "sent" });
    return { success: true, sinkId, isLocalSink: true };
  }

  getCaptured(): RenderedEmail[] {
    return [...this.capturedEmails];
  }

  clear(): void {
    this.capturedEmails = [];
  }
}

export function salesEmailService(db: Db) {
  const domainThrottler = new DomainThrottler();
  const mailSink = new LocalMailSink();

  async function isEmailSuppressed(email: string): Promise<boolean> {
    const hash = hashEmailAddress(email);
    const [row] = await db
      .select({ emailHash: emailGlobalSuppressions.emailHash })
      .from(emailGlobalSuppressions)
      .where(eq(emailGlobalSuppressions.emailHash, hash));
    return Boolean(row);
  }

  async function suppressEmail(email: string, reason: string = "user_unsubscribe"): Promise<void> {
    const emailHash = hashEmailAddress(email);
    await db
      .insert(emailGlobalSuppressions)
      .values({
        emailHash,
        reason,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }

  async function validatePreSendCompliance(
    email: RenderedEmail,
    options?: {
      maxPerDomainPerHour?: number;
      dryRun?: boolean;
      senderIdentity?: Partial<SenderIdentity>;
    },
  ): Promise<{ allowed: boolean; reason?: string }> {
    const isDryRun = options?.dryRun ?? true;

    // 1. In live mode, validate sender identity completeness
    if (!isDryRun) {
      const identityValidation = validateSenderIdentity(options?.senderIdentity || {
        senderName: email.from.split("<")[0]?.trim(),
        senderEmail: email.from.includes("<") ? email.from.split("<")[1]?.replace(">", "").trim() : email.from,
        legalBusinessName: email.legalBusinessName,
        physicalAddress: email.physicalAddress,
      });

      if (!identityValidation.valid) {
        return {
          allowed: false,
          reason: `Sender identity incomplete for live email sending. Missing required fields: ${identityValidation.missingFields.join(", ")}. Configure under Settings > Sales > Sender Identity.`,
        };
      }
    }

    // 2. Check global suppression list (opted out or bounced) - case-insensitive and trimmed
    const suppressed = await isEmailSuppressed(email.to);
    if (suppressed) {
      return { allowed: false, reason: `Recipient ${email.to} is globally suppressed (opted out or bounced).` };
    }

    // 3. Validate mandatory statutory footer and RFC 8058 header presence
    if (!email.bodyText.includes("Unsubscribe:") || !email.bodyText.includes(email.unsubscribeUrl)) {
      return { allowed: false, reason: "Email missing required statutory unsubscribe link." };
    }
    if (!email.bodyText.includes(email.physicalAddress)) {
      return { allowed: false, reason: "Email missing required physical postal address." };
    }
    if (!email.headers["List-Unsubscribe"] || !email.headers["List-Unsubscribe-Post"]) {
      return { allowed: false, reason: "Email missing RFC 8058 List-Unsubscribe headers." };
    }

    // 4. Per-domain throttling check
    const maxPerHour = options?.maxPerDomainPerHour || 3;
    const throttleCheck = domainThrottler.isAllowed(email.to, maxPerHour);
    if (!throttleCheck.allowed) {
      return {
        allowed: false,
        reason: `Domain throttle exceeded. Max ${maxPerHour} sends per domain per hour. Retry after ${throttleCheck.retryAfterSec}s.`,
      };
    }

    return { allowed: true };
  }

  async function handleHardBounce(email: string): Promise<void> {
    await suppressEmail(email, "hard_bounce");
  }

  async function handleOptOut(email: string): Promise<void> {
    await suppressEmail(email, "user_unsubscribe");
  }

  async function sendEmailSafely(
    email: RenderedEmail,
    config: Partial<EmailSendPolicyConfig> = {},
  ): Promise<{ success: boolean; dryRun: boolean; mailSinkId?: string; reason?: string }> {
    const isDryRun = config.dryRun ?? true;

    // Strict compliance validation
    const compliance = await validatePreSendCompliance(email, {
      maxPerDomainPerHour: config.maxPerDomainPerHour || 3,
      dryRun: isDryRun,
      senderIdentity: config.senderIdentity,
    });
    if (!compliance.allowed) {
      return { success: false, dryRun: isDryRun, reason: compliance.reason };
    }

    // In dry-run mode or test environment, route to local mail sink
    if (isDryRun || process.env.NODE_ENV === "test") {
      const sinkResult = mailSink.send(email);
      return { success: true, dryRun: true, mailSinkId: sinkResult.sinkId };
    }

    // In production live mode (requires human approval gate passed)
    if (config.requireHumanApproval && email.status !== "approved") {
      return { success: false, dryRun: false, reason: "Human approval required before dispatch." };
    }

    // Capture in mail sink
    const result = mailSink.send(email);
    return { success: true, dryRun: false, mailSinkId: result.sinkId };
  }

  return {
    isEmailSuppressed,
    suppressEmail,
    validatePreSendCompliance,
    handleHardBounce,
    handleOptOut,
    sendEmailSafely,
    renderLeadSequence,
    domainThrottler,
    mailSink,
  };
}
