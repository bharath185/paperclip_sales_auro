import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashEmailAddress,
  generateHmacUnsubscribeToken,
  verifyHmacUnsubscribeToken,
  validateSenderIdentity,
  renderLeadSequence,
  calculateWarmupDailyLimit,
  salesEmailService,
  DomainThrottler,
  LocalMailSink,
  type SenderIdentity,
} from "./sales-email.js";
import type { SalesLead } from "./sales-research.js";

describe("Sales Email Service & Statutory Compliance", () => {
  const validSenderIdentity: SenderIdentity = {
    senderName: "Varun Sharma",
    senderEmail: "varun@apextech.in",
    legalBusinessName: "Apex Industrial Automation Pvt Ltd",
    physicalAddress: "Plot 42, Peenya Industrial Area 2nd Stage, Bengaluru, Karnataka 560058, India",
  };

  const sampleLead: SalesLead = {
    id: "lead-101",
    companyId: "comp-sales-1",
    campaignId: "camp-1",
    companyName: "Bengaluru Precision Gears Pvt Ltd",
    website: "https://bengaluru-gears.com",
    domain: "bengaluru-gears.com",
    industry: "Manufacturing",
    subSegment: "Precision Gears & Transmissions",
    location: "Peenya Industrial Area, Bengaluru",
    companySize: "100-250",
    decisionMakerName: "Karthik Subramanian",
    decisionMakerTitle: "Head of Plant Operations",
    email: "karthik.s@bengaluru-gears.com",
    phone: "+91-80-28391234",
    sourceUrl: "https://bengaluru-gears.com/leadership",
    discoveredAt: new Date().toISOString(),
    score: 95,
    status: "approved",
  };

  let mockDb: any;
  let suppressedSet: Set<string>;

  beforeEach(() => {
    suppressedSet = new Set();
    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async (clause: any) => {
            const rows: any[] = [];
            for (const hash of suppressedSet) {
              rows.push({ emailHash: hash });
            }
            return rows;
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val: any) => {
          suppressedSet.add(val.emailHash);
          return {
            onConflictDoNothing: vi.fn().mockResolvedValue({}),
          };
        }),
      }),
    };
  });

  it("1. validates required sender identity and blocks live sending when incomplete", () => {
    // Incomplete sender identities
    expect(validateSenderIdentity({}).valid).toBe(false);
    expect(validateSenderIdentity({ senderName: "Varun" }).valid).toBe(false);
    expect(
      validateSenderIdentity({
        senderName: "Varun",
        senderEmail: "invalid-email",
        legalBusinessName: "Apex Ltd",
      }).valid
    ).toBe(false);

    // Complete valid sender identity
    const validation = validateSenderIdentity(validSenderIdentity);
    expect(validation.valid).toBe(true);
    expect(validation.missingFields).toHaveLength(0);
  });

  it("2. renders RFC 8058 List-Unsubscribe and List-Unsubscribe-Post one-click headers on EVERY email", () => {
    const sequence = renderLeadSequence(sampleLead, {
      senderIdentity: validSenderIdentity,
    });

    expect(sequence).toHaveLength(3);
    for (const email of sequence) {
      expect(email.from).toBe("Varun Sharma <varun@apextech.in>");
      expect(email.legalBusinessName).toBe(validSenderIdentity.legalBusinessName);
      expect(email.physicalAddress).toBe(validSenderIdentity.physicalAddress);
      expect(email.bodyText).toContain(validSenderIdentity.physicalAddress);
      expect(email.bodyText).toContain(email.unsubscribeUrl);
      expect(email.bodyHtml).toContain(validSenderIdentity.physicalAddress);
      expect(email.bodyHtml).toContain(email.unsubscribeUrl);

      // RFC 8058 Compliance Headers
      expect(email.headers["List-Unsubscribe"]).toContain(`<${email.unsubscribeUrl}>`);
      expect(email.headers["List-Unsubscribe"]).toContain("mailto:optout@apextech.in?subject=unsubscribe");
      expect(email.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    }
  });

  it("3. generates and verifies HMAC-signed non-guessable unsubscribe tokens", () => {
    const email = "karthik.s@bengaluru-gears.com";
    const companyId = "comp-sales-1";
    const secret = "super-secret-key-32-chars-long!!";

    const token = generateHmacUnsubscribeToken(email, companyId, secret);
    expect(token).toMatch(/^unsub_comp-sal_[a-f0-9]{24}$/);

    // Valid verification
    expect(verifyHmacUnsubscribeToken(email, companyId, token, secret)).toBe(true);

    // Rejection on forged token, wrong email, or wrong company
    expect(verifyHmacUnsubscribeToken("attacker@fake.com", companyId, token, secret)).toBe(false);
    expect(verifyHmacUnsubscribeToken(email, "comp-other-9", token, secret)).toBe(false);
    expect(verifyHmacUnsubscribeToken(email, companyId, "unsub_forged_token_123456", secret)).toBe(false);
  });

  it("4. suppression checks are strictly case-insensitive and whitespace-tolerant", async () => {
    const service = salesEmailService(mockDb);
    const rawEmail = "  KARTHIK.S@Bengaluru-Gears.COM  ";
    const normalizedEmail = "karthik.s@bengaluru-gears.com";
    const emailHash = hashEmailAddress(normalizedEmail);

    // Opt out with raw email containing spaces and uppercase
    await service.handleOptOut(rawEmail);
    expect(suppressedSet.has(emailHash)).toBe(true);

    // Both variations are suppressed
    expect(await service.isEmailSuppressed(rawEmail)).toBe(true);
    expect(await service.isEmailSuppressed(normalizedEmail)).toBe(true);
    expect(await service.isEmailSuppressed("Karthik.S@bengaluru-gears.com")).toBe(true);

    // Pre-send validation rejects suppressed recipient even with different casing
    const rendered = renderLeadSequence({ ...sampleLead, email: "  karthik.s@BENGALURU-GEARS.COM " }, { senderIdentity: validSenderIdentity })[0];
    const validation = await service.validatePreSendCompliance(rendered);
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toContain("globally suppressed");
  });

  it("5. blocks live email send if required sender identity is missing", async () => {
    const service = salesEmailService(mockDb);
    const email = renderLeadSequence(sampleLead, {
      senderIdentity: { senderName: "Only Name" } as any, // Missing address, legal name, email
    })[0];

    const result = await service.sendEmailSafely(email, {
      dryRun: false, // Live send attempted
      senderIdentity: { senderName: "Only Name" } as any,
    });

    expect(result.success).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.reason).toContain("Sender identity incomplete for live email sending");
  });

  it("6. calculates progressive warm-up daily limits across ramp schedule", () => {
    expect(calculateWarmupDailyLimit(1, 50)).toBe(10);
    expect(calculateWarmupDailyLimit(3, 50)).toBe(10);
    expect(calculateWarmupDailyLimit(5, 50)).toBe(20);
    expect(calculateWarmupDailyLimit(7, 50)).toBe(20);
    expect(calculateWarmupDailyLimit(10, 50)).toBe(35);
    expect(calculateWarmupDailyLimit(14, 50)).toBe(35);
    expect(calculateWarmupDailyLimit(15, 50)).toBe(50);
  });

  it("7. enforces per-domain throttling to prevent burst-spamming a single target company", async () => {
    const throttler = new DomainThrottler();
    const email1 = "eng1@targetcorp.com";
    const email2 = "eng2@targetcorp.com";
    const email3 = "eng3@targetcorp.com";
    const email4 = "eng4@targetcorp.com";

    // Max 3 per hour
    expect(throttler.isAllowed(email1, 3).allowed).toBe(true);
    expect(throttler.isAllowed(email2, 3).allowed).toBe(true);
    expect(throttler.isAllowed(email3, 3).allowed).toBe(true);

    // 4th send to same domain within hour is throttled
    const fourth = throttler.isAllowed(email4, 3);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSec).toBeGreaterThan(0);

    // Different domain is allowed
    expect(throttler.isAllowed("contact@anothercorp.com", 3).allowed).toBe(true);
  });

  it("8. automatically adds hard-bounced addresses to the global suppression list", async () => {
    const service = salesEmailService(mockDb);
    const bounceEmail = "nonexistent@bengaluru-gears.com";
    const bounceHash = hashEmailAddress(bounceEmail);

    await service.handleHardBounce(bounceEmail);
    expect(suppressedSet.has(bounceHash)).toBe(true);
    expect(await service.isEmailSuppressed(bounceEmail)).toBe(true);
  });

  it("9. prevents real external socket sends in tests/demo via local mail sink isolation", async () => {
    const service = salesEmailService(mockDb);
    const email = renderLeadSequence(sampleLead, { senderIdentity: validSenderIdentity })[0];

    const result = await service.sendEmailSafely(email, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.mailSinkId).toBeDefined();

    const captured = service.mailSink.getCaptured();
    expect(captured).toHaveLength(1);
    expect(captured[0].to).toBe(sampleLead.email);
    expect(captured[0].subject).toContain("Bengaluru Precision Gears Pvt Ltd");
  });
});
