import { describe, it, expect, vi } from "vitest";
import {
  hashEmailAddress,
  generateUnsubscribeToken,
  renderEmailTemplate,
  renderLeadSequence,
  calculateWarmupDailyLimit,
  salesEmailService,
  DEFAULT_PHYSICAL_ADDRESS,
} from "./sales-email.js";
import type { SalesLead } from "./sales-research.js";

describe("Sales Email Service & Compliance", () => {
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

  it("hashes email deterministically using SHA-256 for privacy and suppression lookup", () => {
    const hash1 = hashEmailAddress("karthik.s@bengaluru-gears.com");
    const hash2 = hashEmailAddress("  KARTHIK.S@bengaluru-gears.com ");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("generates structured unsubscribe token with company and email hash components", () => {
    const token = generateUnsubscribeToken(sampleLead.email, sampleLead.companyId);
    expect(token).toContain("unsub_comp-sal_");
  });

  it("renders 3-touch sequence with dynamic merge tags and compliance footers", () => {
    const sequence = renderLeadSequence(sampleLead, {
      senderName: "Varun Sharma",
      senderEmail: "varun@projectauro.com",
    });

    expect(sequence).toHaveLength(3);

    // Touch 1
    const touch1 = sequence[0];
    expect(touch1.stepNumber).toBe(1);
    expect(touch1.to).toBe("karthik.s@bengaluru-gears.com");
    expect(touch1.from).toContain("Varun Sharma <varun@projectauro.com>");
    expect(touch1.subject).toContain("Bengaluru Precision Gears Pvt Ltd");
    expect(touch1.bodyText).toContain("Hi Karthik");
    expect(touch1.bodyText).toContain("Precision Gears & Transmissions");
    expect(touch1.bodyText).toContain("Peenya Industrial Area, Bengaluru");
    expect(touch1.bodyText).toContain(DEFAULT_PHYSICAL_ADDRESS);
    expect(touch1.bodyText).toContain("Unsubscribe: https://app.projectauro.com/api/email/unsubscribe");
    expect(touch1.headers["List-Unsubscribe"]).toBeDefined();

    // Touch 2
    const touch2 = sequence[1];
    expect(touch2.stepNumber).toBe(2);
    expect(touch2.subject).toContain("Case study");
    expect(touch2.bodyText).toContain("Peenya");

    // Touch 3
    const touch3 = sequence[2];
    expect(touch3.stepNumber).toBe(3);
    expect(touch3.subject).toContain("Closing the loop");
  });

  it("calculates progressive warm-up daily limits across ramp schedule", () => {
    expect(calculateWarmupDailyLimit(1, 50)).toBe(10);
    expect(calculateWarmupDailyLimit(3, 50)).toBe(10);
    expect(calculateWarmupDailyLimit(5, 50)).toBe(20);
    expect(calculateWarmupDailyLimit(10, 50)).toBe(35);
    expect(calculateWarmupDailyLimit(15, 50)).toBe(50);
  });

  it("validates pre-send compliance and rejects suppressed or non-compliant emails", async () => {
    const suppressedHash = hashEmailAddress("suppressed@target.com");
    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async () => {
            // Mock matching row for suppressed email
            return [{ emailHash: suppressedHash }];
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    const service = salesEmailService(mockDb);

    const isSuppressed = await service.isEmailSuppressed("suppressed@target.com");
    expect(isSuppressed).toBe(true);

    const sequence = renderLeadSequence({ ...sampleLead, email: "suppressed@target.com" });
    const checkResult = await service.validatePreSendCompliance(sequence[0], "comp-sales-1");
    expect(checkResult.allowed).toBe(false);
    expect(checkResult.reason).toContain("globally suppressed");
  });
});
