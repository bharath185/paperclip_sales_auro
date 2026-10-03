import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInboxConnector,
  classifyReplyIntent,
  extractSenderEmail,
  ImapInboxConnector,
  GmailApiInboxConnector,
  type IncomingEmailMessage,
} from "./sales-inbox.js";
import { HubSpotConnector } from "./sales-crm.js";
import { salesEmailService } from "./sales-email.js";

describe("Sales Inbox Connectors & Reply Detection", () => {
  let mockEmailService: any;
  let suppressedEmails: string[];
  let crmConnector: HubSpotConnector;

  beforeEach(() => {
    suppressedEmails = [];
    mockEmailService = {
      handleHardBounce: vi.fn(async (email: string) => {
        suppressedEmails.push(email);
      }),
      handleOptOut: vi.fn(async (email: string) => {
        suppressedEmails.push(email);
      }),
    };
    crmConnector = new HubSpotConnector({ provider: "hubspot", isMock: true });
  });

  describe("Intent Classification", () => {
    it("classifies meeting requests accurately", () => {
      const msg: IncomingEmailMessage = {
        id: "msg-1",
        from: "Karthik Subramanian <karthik.s@bengaluru-gears.com>",
        to: "outreach@projectauro.com",
        subject: "Re: Quick question",
        bodyText: "Yes, let's connect next Tuesday at 3 PM for a demo.",
        receivedAt: new Date().toISOString(),
      };
      expect(classifyReplyIntent(msg)).toBe("meeting_requested");
    });

    it("classifies unsubscribe and opt-out requests", () => {
      const msg: IncomingEmailMessage = {
        id: "msg-2",
        from: "User <user@target.com>",
        to: "outreach@projectauro.com",
        subject: "Re: Info",
        bodyText: "Please unsubscribe me from your outreach.",
        receivedAt: new Date().toISOString(),
      };
      expect(classifyReplyIntent(msg)).toBe("unsubscribe");
    });

    it("classifies delivery status notifications as hard bounces", () => {
      const msg: IncomingEmailMessage = {
        id: "msg-3",
        from: "Mailer-Daemon <mailer-daemon@target.com>",
        to: "outreach@projectauro.com",
        subject: "Delivery Status Notification (Failure)",
        bodyText: "550 5.1.1 <invalid@target.com>: User unknown in virtual mailbox table.",
        receivedAt: new Date().toISOString(),
      };
      expect(classifyReplyIntent(msg)).toBe("hard_bounce");
    });
  });

  describe("IMAP Inbox Connector (Simulated / Demo Mode)", () => {
    it("polls and processes positive reply, updating lead and CRM stage", async () => {
      const imap = createInboxConnector({ type: "imap", isDemo: true });
      expect(imap).toBeInstanceOf(ImapInboxConnector);

      const messages = await imap.pollNewMessages();
      expect(messages.length).toBeGreaterThan(0);

      const positiveMsg = messages[0]; // Meeting request from Karthik
      const result = await imap.processMessage(positiveMsg, crmConnector, mockEmailService);

      expect(result.classification).toBe("meeting_requested");
      expect(result.leadStatusUpdated).toBe("replied");
      expect(result.crmStageUpdated).toBe("meeting_scheduled");
      expect(result.crmUpdated).toBe(true);
      expect(result.suppressedImmediately).toBe(false);
    });

    it("processes hard bounce and immediately triggers suppression and status update", async () => {
      const imap = createInboxConnector({ type: "imap", isDemo: true });
      const bounceMsg: IncomingEmailMessage = {
        id: "bounce-msg",
        from: "Mailer-Daemon <mailer-daemon@bengaluru-gears.com>",
        to: "outreach@projectauro.com",
        subject: "Delivery Status Notification (Failure)",
        bodyText: "550 5.1.1 <karthik.s@bengaluru-gears.com>: Recipient address rejected: User unknown.",
        receivedAt: new Date().toISOString(),
      };

      const result = await imap.processMessage(bounceMsg, crmConnector, mockEmailService);

      expect(result.classification).toBe("hard_bounce");
      expect(result.leadStatusUpdated).toBe("bounced");
      expect(result.suppressedImmediately).toBe(true);
      expect(mockEmailService.handleHardBounce).toHaveBeenCalledWith("mailer-daemon@bengaluru-gears.com");
    });

    it("processes unsubscribe reply and immediately adds sender to suppression list", async () => {
      const imap = createInboxConnector({ type: "imap", isDemo: true });
      const unsubMsg: IncomingEmailMessage = {
        id: "unsub-msg",
        from: "Rajesh Kumar <rajesh.k@precisiondynamics.in>",
        to: "outreach@projectauro.com",
        subject: "Re: Automation enquiry",
        bodyText: "Please stop sending emails and remove me immediately.",
        receivedAt: new Date().toISOString(),
      };

      const result = await imap.processMessage(unsubMsg, crmConnector, mockEmailService);

      expect(result.classification).toBe("unsubscribe");
      expect(result.leadStatusUpdated).toBe("unsubscribed");
      expect(result.suppressedImmediately).toBe(true);
      expect(mockEmailService.handleOptOut).toHaveBeenCalledWith("rajesh.k@precisiondynamics.in");
    });
  });

  describe("Gmail API Inbox Connector", () => {
    it("instantiates GmailApiInboxConnector and processes interested inbound email", async () => {
      const gmail = createInboxConnector({ type: "gmail_api", isDemo: true });
      expect(gmail).toBeInstanceOf(GmailApiInboxConnector);

      const messages = await gmail.pollNewMessages();
      expect(messages.length).toBeGreaterThan(0);

      const result = await gmail.processMessage(messages[0], crmConnector, mockEmailService);
      expect(result.classification).toBe("interested");
      expect(result.leadStatusUpdated).toBe("replied");
      expect(result.crmStageUpdated).toBe("opportunity_warm");
      expect(result.crmUpdated).toBe(true);
    });
  });
});
