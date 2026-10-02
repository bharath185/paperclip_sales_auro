import crypto from "node:crypto";
import type { Db } from "@paperclipai/db";
import { emailSendPolicies, emailGlobalSuppressions } from "@paperclipai/db";
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
  headers: Record<string, string>;
  isSuppressed: boolean;
  status: "pending_approval" | "approved" | "sent" | "failed" | "suppressed";
}

export interface EmailSendPolicyConfig {
  companyId: string;
  dryRun: boolean;
  requireHumanApproval: boolean;
  dailyLimit: number;
  senderName: string;
  senderEmail: string;
  physicalAddress: string;
  warmupDayCount: number;
}

export const DEFAULT_PHYSICAL_ADDRESS = "Project Auro Technologies, 4th Floor, Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103, India";

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
Project Auro`,
  },
  {
    stepNumber: 2,
    name: "Relevant Proof Point & Case Study",
    delayDays: 3,
    subjectTemplate: "Case study: 35% cycle time reduction for {{industry}} manufacturers",
    bodyTemplate: `Hi {{contact_name}},

Following up on my previous note. I wanted to share a quick metric:

A precision manufacturing facility in Peenya recently deployed our automated compliance and tooling coordination pipeline, cutting sprint cycle times by 35% within 60 days.

Given {{company_name}}'s focus on {{sub_segment}}, I thought this benchmark might be relevant to your team's current goals.

Do you have 10 minutes this week for a quick walkthrough?

Best regards,
{{sender_name}}
Project Auro`,
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
Project Auro`,
  },
];

export function hashEmailAddress(email: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function generateUnsubscribeToken(email: string, companyId: string): string {
  const hash = hashEmailAddress(email);
  return `unsub_${companyId.slice(0, 8)}_${hash.slice(0, 16)}`;
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
    physicalAddress: string;
    unsubscribeUrl: string;
  },
): string {
  let rendered = template;
  rendered = rendered.replace(/\{\{company_name\}\}/g, data.lead.companyName);
  rendered = rendered.replace(/\{\{contact_name\}\}/g, data.lead.decisionMakerName.split(" ")[0] || data.lead.decisionMakerName);
  rendered = rendered.replace(/\{\{title\}\}/g, data.lead.decisionMakerTitle);
  rendered = rendered.replace(/\{\{industry\}\}/g, data.lead.industry);
  rendered = rendered.replace(/\{\{sub_segment\}\}/g, data.lead.subSegment || data.lead.industry);
  rendered = rendered.replace(/\{\{location\}\}/g, data.lead.location);
  rendered = rendered.replace(/\{\{sender_name\}\}/g, data.senderName);
  rendered = rendered.replace(/\{\{sender_email\}\}/g, data.senderEmail);
  rendered = rendered.replace(/\{\{physical_address\}\}/g, data.physicalAddress);
  rendered = rendered.replace(/\{\{unsubscribe_url\}\}/g, data.unsubscribeUrl);
  return rendered;
}

/**
 * Renders full 3-touch sequence for a single lead with statutory compliance footers.
 */
export function renderLeadSequence(
  lead: SalesLead,
  options?: {
    customSteps?: EmailSequenceStep[];
    senderName?: string;
    senderEmail?: string;
    physicalAddress?: string;
    appBaseUrl?: string;
  },
): RenderedEmail[] {
  const steps = options?.customSteps || DEFAULT_3_TOUCH_SEQUENCE;
  const senderName = options?.senderName || "Varun Sharma";
  const senderEmail = options?.senderEmail || "outreach@projectauro.com";
  const physicalAddress = options?.physicalAddress || DEFAULT_PHYSICAL_ADDRESS;
  const appBaseUrl = options?.appBaseUrl || "https://app.projectauro.com";
  const unsubToken = generateUnsubscribeToken(lead.email, lead.companyId);
  const unsubscribeUrl = `${appBaseUrl}/api/email/unsubscribe?token=${unsubToken}&email=${encodeURIComponent(lead.email)}`;

  return steps.map((step) => {
    const context = {
      lead,
      senderName,
      senderEmail,
      physicalAddress,
      unsubscribeUrl,
    };

    const subject = renderEmailTemplate(step.subjectTemplate, context);
    const bodyText = renderEmailTemplate(step.bodyTemplate, context);

    const statutoryFooterText = `\n\n---\nYou are receiving this email as a business communication for ${lead.companyName}.\n${physicalAddress}\nUnsubscribe: ${unsubscribeUrl}`;
    const fullBodyText = `${bodyText}${statutoryFooterText}`;

    const bodyHtml = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #111;">
  <p>${bodyText.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")}</p>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0 12px 0;" />
  <p style="font-size: 11px; color: #6b7280;">
    You are receiving this email as a commercial communication for ${lead.companyName}.<br/>
    ${physicalAddress}<br/>
    <a href="${unsubscribeUrl}" style="color: #059669; text-decoration: underline;">Unsubscribe from future communications</a>
  </p>
</div>`.trim();

    return {
      stepNumber: step.stepNumber,
      to: lead.email,
      from: `${senderName} <${senderEmail}>`,
      subject,
      bodyText: fullBodyText,
      bodyHtml,
      unsubscribeUrl,
      physicalAddress,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "X-Entity-Ref-ID": `${lead.companyId}:${lead.id}:touch-${step.stepNumber}`,
      },
      isSuppressed: false,
      status: "pending_approval",
    };
  });
}

export function salesEmailService(db: Db) {
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
    companyId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Check global suppression list
    const suppressed = await isEmailSuppressed(email.to);
    if (suppressed) {
      return { allowed: false, reason: `Recipient ${email.to} is globally suppressed (opted out or bounced).` };
    }

    // 2. Validate mandatory statutory footer presence
    if (!email.bodyText.includes("Unsubscribe:") || !email.bodyText.includes(email.unsubscribeUrl)) {
      return { allowed: false, reason: "Email missing required statutory unsubscribe link." };
    }
    if (!email.bodyText.includes(email.physicalAddress)) {
      return { allowed: false, reason: "Email missing required physical postal address." };
    }

    return { allowed: true };
  }

  async function handleHardBounce(email: string): Promise<void> {
    await suppressEmail(email, "hard_bounce");
  }

  return {
    isEmailSuppressed,
    suppressEmail,
    validatePreSendCompliance,
    handleHardBounce,
    renderLeadSequence,
  };
}
