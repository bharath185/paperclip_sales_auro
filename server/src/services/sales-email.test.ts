import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashEmailAddress,
  generateUnsubscribeToken,
  renderLeadSequence,
  calculateWarmupDailyLimit,
  salesEmailService,
  DEFAULT_PHYSICAL_ADDRESS,
  DEFAULT_SALES_EMAIL_CONFIG,
  DomainThrottler,
  LocalMailSink,
} from "./sales-email.js";
import type { SalesLead } from "./sales-research.js";

describe("Sales Email Service & Statutory Compliance", () => {
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
            // Find if hash is in suppressedSet
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

  it("1. includes unsubscribe link, sender identity, and physical business address on EVERY email", () => {
    const sequence = renderLeadSequence(sampleLead, {
      senderName: "Varun Sharma",
      senderEmail: "varun@projectauro.com",
    });

    expect(sequence).toHaveLength(3);
    for (const email of sequence) {
      expect(email.from).toBe("Varun Sharma <varun@projectauro.com>");
      expect(email.unsubscribeUrl).toContain("api/email/unsubscribe");
      expect(email.physicalAddress).toBe(DEFAULT_PHYSICAL_ADDRESS);
      expect(email.bodyText).toContain(DEFAULT_PHYSICAL_ADDRESS);
      expect(email.bodyText).toContain(email.unsubscribeUrl);
      expect(email.headers["List-Unsubscribe"]).toBe(`<${email.unsubscribeUrl}>`);
      expect(email.bodyHtml).toContain(DEFAULT_PHYSICAL_ADDRESS);
      expect(email.bodyHtml).toContain(email.unsubscribeUrl);
    }
  });

  it("2. opt-out goes to suppression list immediately and is checked before every send", async () => {
    const service = salesEmailService(mockDb);
    const email = "optout@example.com";
    const emailHash = hashEmailAddress(email);

    // Initially not suppressed
    expect(await service.isEmailSuppressed(email)).toBe(false);

    // User opts out
    await service.handleOptOut(email);
    expect(suppressedSet.has(emailHash)).toBe(true);

    // Re-check suppression
    expect(await service.isEmailSuppressed(email)).toBe(true);

    // Pre-send validation rejects suppressed recipient
    const rendered = renderLeadSequence({ ...sampleLead, email })[0];
    const validation = await service.validatePreSendCompliance(rendered);
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toContain("globally suppressed");
  });

  it("3. calculates progressive warm-up daily limits across ramp schedule", () => {
    expect(calculateWarmupDailyLimit(1, 50)).toBe(10);
    expect(calculateWarmupDailyLimit(3, 50)).toBe(10);
    expect(calculateWarmupDailyLimit(5, 50)).toBe(20);
    expect(calculateWarmupDailyLimit(7, 50)).toBe(20);
    expect(calculateWarmupDailyLimit(10, 50)).toBe(35);
    expect(calculateWarmupDailyLimit(14, 50)).toBe(35);
    expect(calculateWarmupDailyLimit(15, 50)).toBe(50);
  });

  it("4. enforces per-domain throttling to prevent burst-spamming a single target company", async () => {
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

  it("5. automatically adds hard-bounced addresses to the global suppression list", async () => {
    const service = salesEmailService(mockDb);
    const bounceEmail = "nonexistent@bengaluru-gears.com";
    const bounceHash = hashEmailAddress(bounceEmail);

    await service.handleHardBounce(bounceEmail);
    expect(suppressedSet.has(bounceHash)).toBe(true);
    expect(await service.isEmailSuppressed(bounceEmail)).toBe(true);
  });

  it("6. defaults dry-run ON and human approval ON for all sales outreach", () => {
    expect(DEFAULT_SALES_EMAIL_CONFIG.dryRun).toBe(true);
    expect(DEFAULT_SALES_EMAIL_CONFIG.requireHumanApproval).toBe(true);
  });

  it("7. prevents real external socket sends in tests/demo via local mail sink isolation", async () => {
    const service = salesEmailService(mockDb);
    const email = renderLeadSequence(sampleLead)[0];

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
