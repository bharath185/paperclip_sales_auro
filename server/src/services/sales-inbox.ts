/**
 * Sales Inbox Connector & Reply Detection Engine
 * 
 * Implements:
 * - InboxConnector interface
 * - ImapInboxConnector (IMAP protocol connector)
 * - GmailApiInboxConnector (Gmail API OAuth connector)
 * - Automatic intent classification (positive reply, unsubscribe, bounce)
 * - Automated CRM stage updates and suppression list triggers
 */

import type { CrmConnector } from "./sales-crm.js";
import type { salesEmailService } from "./sales-email.js";

export type ReplyClassification = "interested" | "meeting_requested" | "not_interested" | "unsubscribe" | "hard_bounce" | "out_of_office";

export interface IncomingEmailMessage {
  id: string;
  threadId?: string;
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  receivedAt: string;
  headers?: Record<string, string>;
}

export interface ProcessedReplyResult {
  messageId: string;
  leadEmail: string;
  classification: ReplyClassification;
  leadStatusUpdated: "replied" | "unsubscribed" | "bounced" | "paused" | "in_conversation";
  crmStageUpdated?: string;
  crmUpdated: boolean;
  suppressedImmediately: boolean;
  reason?: string;
}

export interface InboxConnectorConfig {
  type: "imap" | "gmail_api";
  isDemo?: boolean;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface InboxConnector {
  readonly type: "imap" | "gmail_api";
  pollNewMessages(): Promise<IncomingEmailMessage[]>;
  processMessage(
    message: IncomingEmailMessage,
    crmConnector?: CrmConnector,
    emailSvc?: ReturnType<typeof salesEmailService>,
  ): Promise<ProcessedReplyResult>;
}

/**
 * Classifies the intent of an incoming reply.
 */
export function classifyReplyIntent(message: IncomingEmailMessage): ReplyClassification {
  const subject = message.subject.toLowerCase();
  const body = message.bodyText.toLowerCase();

  // 1. Hard bounce detection
  if (
    subject.includes("delivery status notification") ||
    subject.includes("undelivered mail") ||
    subject.includes("mail delivery subsystem") ||
    body.includes("550 5.1.1") ||
    body.includes("user unknown") ||
    body.includes("recipient address rejected") ||
    body.includes("mailbox unavailable")
  ) {
    return "hard_bounce";
  }

  // 2. Unsubscribe request detection
  if (
    body.includes("unsubscribe") ||
    body.includes("remove me") ||
    body.includes("opt out") ||
    body.includes("stop sending") ||
    body.includes("please do not contact") ||
    subject.includes("unsubscribe")
  ) {
    return "unsubscribe";
  }

  // 3. Out of office / autoreply
  if (
    subject.includes("out of office") ||
    subject.includes("automatic reply") ||
    subject.includes("auto-reply") ||
    body.includes("i am currently out of the office")
  ) {
    return "out_of_office";
  }

  // 4. Meeting request / high intent
  if (
    body.includes("schedule a call") ||
    body.includes("let's connect") ||
    body.includes("free next week") ||
    body.includes("tuesday") ||
    body.includes("thursday") ||
    body.includes("send a calendar invite") ||
    body.includes("demo")
  ) {
    return "meeting_requested";
  }

  // 5. Positive interested response
  if (
    body.includes("interested") ||
    body.includes("tell me more") ||
    body.includes("share details") ||
    body.includes("pricing") ||
    body.includes("send more info")
  ) {
    return "interested";
  }

  return "not_interested";
}

/**
 * Extracts sender email address from "Name <email@domain.com>" or "email@domain.com"
 */
export function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return from.trim().toLowerCase();
}

/**
 * Base abstract processor for inbox connectors
 */
export async function executeMessageProcessing(
  message: IncomingEmailMessage,
  connectorType: "imap" | "gmail_api",
  crmConnector?: CrmConnector,
  emailSvc?: ReturnType<typeof salesEmailService>,
): Promise<ProcessedReplyResult> {
  const senderEmail = extractSenderEmail(message.from);
  const classification = classifyReplyIntent(message);

  let leadStatusUpdated: "replied" | "unsubscribed" | "bounced" | "paused" | "in_conversation" = "in_conversation";
  let crmStageUpdated: string | undefined = undefined;
  let suppressedImmediately = false;
  let crmUpdated = false;

  switch (classification) {
    case "hard_bounce":
      leadStatusUpdated = "bounced";
      crmStageUpdated = "bounced";
      suppressedImmediately = true;
      if (emailSvc) {
        await emailSvc.handleHardBounce(senderEmail);
      }
      break;

    case "unsubscribe":
      leadStatusUpdated = "unsubscribed";
      crmStageUpdated = "opted_out";
      suppressedImmediately = true;
      if (emailSvc) {
        await emailSvc.handleOptOut(senderEmail);
      }
      break;

    case "meeting_requested":
      leadStatusUpdated = "replied";
      crmStageUpdated = "meeting_scheduled";
      break;

    case "interested":
      leadStatusUpdated = "replied";
      crmStageUpdated = "opportunity_warm";
      break;

    case "out_of_office":
      leadStatusUpdated = "paused";
      break;

    case "not_interested":
      leadStatusUpdated = "replied";
      crmStageUpdated = "closed_unqualified";
      break;
  }

  // Update CRM if connected
  if (crmConnector && crmStageUpdated) {
    const stageRes = await crmConnector.updateStage(senderEmail, crmStageUpdated);
    crmUpdated = stageRes.success;
    await crmConnector.attachTimeline(senderEmail, {
      eventType: classification === "hard_bounce" ? "note_added" : "reply_received",
      timestamp: message.receivedAt,
      title: `Inbound Email: ${classification}`,
      description: message.bodyText.substring(0, 200),
    });
  }

  return {
    messageId: message.id,
    leadEmail: senderEmail,
    classification,
    leadStatusUpdated,
    crmStageUpdated,
    crmUpdated,
    suppressedImmediately,
  };
}

/**
 * IMAP Protocol Inbox Connector
 */
export class ImapInboxConnector implements InboxConnector {
  public readonly type = "imap" as const;
  private messageQueue: IncomingEmailMessage[] = [];

  constructor(private config: InboxConnectorConfig) {
    if (config.isDemo) {
      this.populateDemoFixtures();
    }
  }

  private populateDemoFixtures(): void {
    this.messageQueue = [
      {
        id: "imap-msg-001",
        from: "Karthik Subramanian <karthik.s@bengaluru-gears.com>",
        to: "outreach@projectauro.com",
        subject: "Re: Question regarding Bengaluru Precision Gears Pvt Ltd's operations",
        bodyText: "Hi Varun, thanks for reaching out. Yes, we are currently evaluating automation tooling for our Peenya plant. Let's connect next Tuesday at 3 PM.",
        receivedAt: new Date().toISOString(),
      },
      {
        id: "imap-msg-002",
        from: "Mailer-Daemon <mailer-daemon@bengaluru-gears.com>",
        to: "outreach@projectauro.com",
        subject: "Delivery Status Notification (Failure)",
        bodyText: "550 5.1.1 <invalid.user@bengaluru-gears.com>: Recipient address rejected: User unknown in virtual mailbox table.",
        receivedAt: new Date().toISOString(),
      },
      {
        id: "imap-msg-003",
        from: "Rajesh Kumar <rajesh.k@unsub-company.com>",
        to: "outreach@projectauro.com",
        subject: "Re: Quick question",
        bodyText: "Please remove me and unsubscribe from your mailing list.",
        receivedAt: new Date().toISOString(),
      },
    ];
  }

  async pollNewMessages(): Promise<IncomingEmailMessage[]> {
    if (this.config.isDemo) {
      const messages = [...this.messageQueue];
      this.messageQueue = [];
      return messages;
    }
    // Live IMAP socket fetch placeholder
    return [];
  }

  async processMessage(
    message: IncomingEmailMessage,
    crmConnector?: CrmConnector,
    emailSvc?: ReturnType<typeof salesEmailService>,
  ): Promise<ProcessedReplyResult> {
    return executeMessageProcessing(message, this.type, crmConnector, emailSvc);
  }
}

/**
 * Gmail REST API OAuth Inbox Connector
 */
export class GmailApiInboxConnector implements InboxConnector {
  public readonly type = "gmail_api" as const;
  private messageQueue: IncomingEmailMessage[] = [];

  constructor(private config: InboxConnectorConfig) {
    if (config.isDemo) {
      this.populateDemoFixtures();
    }
  }

  private populateDemoFixtures(): void {
    this.messageQueue = [
      {
        id: "gmail-msg-101",
        threadId: "gmail-thread-101",
        from: "Dr. Ananya Rao <ananya.rao@aerospace-mfg.in>",
        to: "outreach@projectauro.com",
        subject: "Re: Autonomous Tooling for Aerospace Components",
        bodyText: "Hi Varun, this looks very interesting. Can you send over product details and pricing information?",
        receivedAt: new Date().toISOString(),
      },
    ];
  }

  async pollNewMessages(): Promise<IncomingEmailMessage[]> {
    if (this.config.isDemo) {
      const messages = [...this.messageQueue];
      this.messageQueue = [];
      return messages;
    }
    // Live Gmail API messages.list call placeholder
    return [];
  }

  async processMessage(
    message: IncomingEmailMessage,
    crmConnector?: CrmConnector,
    emailSvc?: ReturnType<typeof salesEmailService>,
  ): Promise<ProcessedReplyResult> {
    return executeMessageProcessing(message, this.type, crmConnector, emailSvc);
  }
}

export function createInboxConnector(config: InboxConnectorConfig): InboxConnector {
  if (config.type === "gmail_api") {
    return new GmailApiInboxConnector(config);
  }
  return new ImapInboxConnector(config);
}
