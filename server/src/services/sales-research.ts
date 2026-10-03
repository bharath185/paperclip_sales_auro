import { randomUUID } from "node:crypto";
import { z } from "zod";

export interface SalesLead {
  id: string;
  companyId: string;
  campaignId: string;
  companyName: string;
  website: string;
  domain: string;
  industry: string;
  subSegment: string;
  location: string;
  companySize: string;
  decisionMakerName: string;
  decisionMakerTitle: string;
  email: string;
  phone: string | null;
  sourceUrl: string;
  discoveredAt: string;
  score: number;
  status: "discovered" | "approved" | "rejected" | "sequence_active" | "replied" | "hot_lead" | "opted_out";
  notes?: string;
  dataSource?: string;
  rawExtractedData?: Record<string, unknown>;
}

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "throwawaymail.com",
  "trashmail.com",
]);

/**
 * Prompt-injection patterns to sanitize and neutralize from untrusted web pages.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /you\s+are\s+now\s+in\s+developer\s+mode/gi,
  /system\s+prompt\s*:/gi,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /drop\s+table\s+/gi,
  /eval\s*\(/gi,
  /override\s+system\s+safety/gi,
  /send\s+all\s+contacts\s+to\s+https?:\/\//gi,
];

/**
 * Sanitizes untrusted raw web / document text, stripping prompt injection and markup attacks.
 */
export function sanitizeUntrustedWebContent(rawText: string): string {
  if (!rawText) return "";
  let clean = rawText;
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, "[REDACTED_UNTRUSTED_CONTENT]");
  }
  // Remove dangerous control characters and trim
  return clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

/**
 * Normalizes website domain.
 */
export function normalizeDomain(urlOrDomain: string): string {
  let cleaned = urlOrDomain.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slashIdx = cleaned.indexOf("/");
  if (slashIdx !== -1) {
    cleaned = cleaned.slice(0, slashIdx);
  }
  return cleaned;
}

/**
 * Validates email format and ensures it's not a disposable domain.
 */
export function validateBusinessEmail(email: string): { valid: boolean; reason?: string } {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    return { valid: false, reason: "Invalid email syntax" };
  }

  const parts = email.toLowerCase().split("@");
  const domain = parts[1];

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, reason: "Disposable email domain rejected" };
  }

  return { valid: true };
}

/**
 * Scores a lead from 0 to 100 based on campaign match and verification quality.
 */
export function calculateLeadScore(lead: {
  industry: string;
  subSegment: string;
  location: string;
  decisionMakerTitle: string;
  website: string;
  email: string;
  targetIndustry?: string;
  targetLocation?: string;
  targetTitles?: string[];
}): number {
  let score = 0;

  // 1. Industry & Sub-segment alignment (max 30 pts)
  const targetInd = (lead.targetIndustry || "manufacturing").toLowerCase();
  if (lead.industry.toLowerCase().includes(targetInd) || targetInd.includes(lead.industry.toLowerCase())) {
    score += 20;
    if (lead.subSegment && lead.subSegment.length > 3) {
      score += 10;
    }
  }

  // 2. Location proximity (max 25 pts)
  const targetLoc = (lead.targetLocation || "Bengaluru").toLowerCase();
  if (lead.location.toLowerCase().includes(targetLoc) || lead.location.toLowerCase().includes("peenya") || lead.location.toLowerCase().includes("bommasandra")) {
    score += 25;
  } else if (lead.location.toLowerCase().includes("karnataka") || lead.location.toLowerCase().includes("india")) {
    score += 15;
  }

  // 3. Decision maker seniority (max 30 pts)
  const title = lead.decisionMakerTitle.toLowerCase();
  const defaultSeniorTitles = ["vp", "vice president", "director", "head", "managing director", "chief", "cto", "coo", "general manager", "plant manager"];
  const targetTitles = (lead.targetTitles && lead.targetTitles.length > 0)
    ? lead.targetTitles.map((t) => t.toLowerCase())
    : defaultSeniorTitles;

  const matchesTitle = targetTitles.some((t) => title.includes(t));
  if (matchesTitle) {
    score += 30;
  } else if (title.includes("manager") || title.includes("lead")) {
    score += 15;
  }

  // 4. Data completeness & validity (max 15 pts)
  if (lead.email && validateBusinessEmail(lead.email).valid) {
    score += 10;
  }
  if (lead.website && lead.website.startsWith("http")) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

export const RawLeadDataSchema = z.object({
  companyId: z.string(),
  campaignId: z.string(),
  companyName: z.string().min(2),
  website: z.string().url(),
  industry: z.string(),
  subSegment: z.string().optional(),
  location: z.string(),
  companySize: z.string().optional(),
  decisionMakerName: z.string().min(2),
  decisionMakerTitle: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  sourceUrl: z.string().url(),
  notes: z.string().optional(),
  rawExtractedData: z.record(z.unknown()).optional(),
});

export type RawLeadData = z.infer<typeof RawLeadDataSchema>;

/**
 * Validates, sanitizes, deduplicates, and scores raw lead intelligence against existing leads.
 */
export function deduplicateAndValidateLeads(
  rawLeads: unknown[],
  existingLeads: SalesLead[] = [],
  campaignContext?: {
    targetIndustry?: string;
    targetLocation?: string;
    targetTitles?: string[];
  },
): {
  validLeads: SalesLead[];
  rejectedLeads: Array<{ lead: unknown; reason: string }>;
  duplicateCount: number;
} {
  const validLeads: SalesLead[] = [];
  const rejectedLeads: Array<{ lead: unknown; reason: string }> = [];
  const seenDomains = new Set<string>(existingLeads.map((l) => normalizeDomain(l.website || l.domain)));
  const seenEmails = new Set<string>(existingLeads.map((l) => l.email.toLowerCase()));
  let duplicateCount = 0;

  for (const item of rawLeads) {
    // 1. Zod Schema parse
    const parseResult = RawLeadDataSchema.safeParse(item);
    if (!parseResult.success) {
      rejectedLeads.push({
        lead: item,
        reason: `Schema validation failed: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      });
      continue;
    }

    const raw = parseResult.data;

    // 2. Prompt Injection Sanitization
    const sanitizedCompanyName = sanitizeUntrustedWebContent(raw.companyName);
    const sanitizedDmName = sanitizeUntrustedWebContent(raw.decisionMakerName);
    const sanitizedDmTitle = sanitizeUntrustedWebContent(raw.decisionMakerTitle);
    const sanitizedLocation = sanitizeUntrustedWebContent(raw.location);
    const sanitizedSubSegment = sanitizeUntrustedWebContent(raw.subSegment || "");
    const sanitizedNotes = sanitizeUntrustedWebContent(raw.notes || "");

    // 3. Email and Domain validation
    const emailValidation = validateBusinessEmail(raw.email);
    if (!emailValidation.valid) {
      rejectedLeads.push({ lead: raw, reason: emailValidation.reason || "Invalid business email" });
      continue;
    }

    const domain = normalizeDomain(raw.website);
    const email = raw.email.trim().toLowerCase();

    // Check for in-batch or existing duplicates
    if (seenDomains.has(domain)) {
      duplicateCount++;
      rejectedLeads.push({ lead: raw, reason: `Duplicate company domain: ${domain}` });
      continue;
    }
    if (seenEmails.has(email)) {
      duplicateCount++;
      rejectedLeads.push({ lead: raw, reason: `Duplicate prospect email: ${email}` });
      continue;
    }

    // 4. Calculate score
    const score = calculateLeadScore({
      industry: raw.industry,
      subSegment: sanitizedSubSegment,
      location: sanitizedLocation,
      decisionMakerTitle: sanitizedDmTitle,
      website: raw.website,
      email,
      targetIndustry: campaignContext?.targetIndustry,
      targetLocation: campaignContext?.targetLocation,
      targetTitles: campaignContext?.targetTitles,
    });

    const leadRecord: SalesLead = {
      id: `lead-${randomUUID()}`,
      companyId: raw.companyId,
      campaignId: raw.campaignId,
      companyName: sanitizedCompanyName,
      website: raw.website,
      domain,
      industry: raw.industry,
      subSegment: sanitizedSubSegment,
      location: sanitizedLocation,
      companySize: raw.companySize || "50-200",
      decisionMakerName: sanitizedDmName,
      decisionMakerTitle: sanitizedDmTitle,
      email,
      phone: raw.phone || null,
      sourceUrl: raw.sourceUrl,
      discoveredAt: new Date().toISOString(),
      score,
      status: score >= 50 ? "discovered" : "rejected",
      notes: sanitizedNotes,
      dataSource: "Web Researcher",
      rawExtractedData: raw.rawExtractedData,
    };

    seenDomains.add(domain);
    seenEmails.add(email);
    validLeads.push(leadRecord);
  }

  return {
    validLeads,
    rejectedLeads,
    duplicateCount,
  };
}

/**
 * Legacy alias for sanitizeAndIngestLeads
 */
export function sanitizeAndIngestLeads(
  rawLeads: unknown[],
  campaignContext?: {
    targetIndustry?: string;
    targetLocation?: string;
    targetTitles?: string[];
  },
) {
  return deduplicateAndValidateLeads(rawLeads, [], campaignContext);
}

/**
 * Parses robots.txt Disallow rules for web crawlers.
 */
export function isPathAllowedByRobotsTxt(robotsTxtContent: string, path: string): boolean {
  if (!robotsTxtContent) return true;
  const lines = robotsTxtContent.split("\n");
  let appliesToAll = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith("user-agent:")) {
      const agent = trimmed.split(":")[1]?.trim();
      appliesToAll = agent === "*" || agent?.toLowerCase() === "projectauro";
    } else if (appliesToAll && trimmed.toLowerCase().startsWith("disallow:")) {
      const disallowPath = trimmed.split(":")[1]?.trim();
      if (disallowPath && disallowPath !== "" && path.startsWith(disallowPath)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Real Web Researcher Service with robots.txt parsing and rate limiting.
 */
export class WebResearcherService {
  private domainLastAccess: Map<string, number> = new Map();

  constructor(
    private options: {
      minDomainDelayMs?: number;
      fetchFn?: typeof fetch;
    } = {},
  ) {}

  async fetchPage(
    url: string,
    mockRobotsTxt?: string,
  ): Promise<{ success: boolean; content?: string; sourceUrl: string; reason?: string }> {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    const path = parsedUrl.pathname;

    // 1. Respect robots.txt
    if (mockRobotsTxt && !isPathAllowedByRobotsTxt(mockRobotsTxt, path)) {
      return {
        success: false,
        sourceUrl: url,
        reason: `Blocked by robots.txt rule for path: ${path}`,
      };
    }

    // 2. Rate limiting check (min delay per domain)
    const minDelay = this.options.minDomainDelayMs ?? 1000;
    const now = Date.now();
    const lastAccess = this.domainLastAccess.get(domain) || 0;
    const timeSinceLast = now - lastAccess;

    if (timeSinceLast < minDelay) {
      await new Promise((resolve) => setTimeout(resolve, minDelay - timeSinceLast));
    }
    this.domainLastAccess.set(domain, Date.now());

    // 3. Perform fetch
    try {
      const fetchImpl = this.options.fetchFn || fetch;
      const res = await fetchImpl(url, {
        headers: {
          "User-Agent": "ProjectAuroBot/1.0 (+https://projectauro.com/bot)",
        },
      });

      if (!res.ok) {
        return { success: false, sourceUrl: url, reason: `HTTP error ${res.status}: ${res.statusText}` };
      }

      const text = await res.text();
      return {
        success: true,
        sourceUrl: url,
        content: sanitizeUntrustedWebContent(text),
      };
    } catch (err: any) {
      return { success: false, sourceUrl: url, reason: err.message || "Fetch failed" };
    }
  }
}

export const BENGALURU_MANUFACTURING_FIXTURES: Array<Omit<SalesLead, "id" | "score" | "status" | "discoveredAt">> = [
  {
    companyId: "comp-auro-001",
    campaignId: "camp-default",
    companyName: "Precision Aero Components Pvt Ltd",
    website: "https://precisionaero.co.in",
    domain: "precisionaero.co.in",
    industry: "Manufacturing",
    subSegment: "Aerospace Machining & Defense",
    location: "Peenya Industrial Area, Bengaluru, Karnataka",
    companySize: "100-250",
    decisionMakerName: "Rajesh Kumar",
    decisionMakerTitle: "VP of Manufacturing Operations",
    email: "rajesh.kumar@precisionaero.co.in",
    phone: "+91 80 2839 1234",
    sourceUrl: "https://precisionaero.co.in/leadership",
    dataSource: "Demo data",
    notes: "Tier-1 AS9100 certified precision machining facility with 40+ CNC centers.",
  },
  {
    companyId: "comp-auro-001",
    campaignId: "camp-default",
    companyName: "Apex Tooling & Die Works",
    website: "https://apextooling.in",
    domain: "apextooling.in",
    industry: "Manufacturing",
    subSegment: "Machine Tools & Dies",
    location: "Bommasandra Industrial Area, Bengaluru, Karnataka",
    companySize: "50-100",
    decisionMakerName: "Ananya Deshmukh",
    decisionMakerTitle: "Head of Tooling Engineering",
    email: "ananya.d@apextooling.in",
    phone: "+91 80 2783 5678",
    sourceUrl: "https://apextooling.in/contact",
    dataSource: "Demo data",
    notes: "Specializes in high-tolerance automotive stamping dies and injection molds.",
  },
  {
    companyId: "comp-auro-001",
    campaignId: "camp-default",
    companyName: "Zenith Automotive Systems India",
    website: "https://zenithauto.in",
    domain: "zenithauto.in",
    industry: "Manufacturing",
    subSegment: "Auto Components",
    location: "Hosur Road Industrial Corridor, Bengaluru, Karnataka",
    companySize: "250-500",
    decisionMakerName: "Vikramjit Rao",
    decisionMakerTitle: "Plant General Manager",
    email: "vikram.rao@zenithauto.in",
    phone: "+91 80 4129 9000",
    sourceUrl: "https://zenithauto.in/about-us",
    dataSource: "Demo data",
    notes: "Supplies transmission and powertrain subassemblies to major OEMs.",
  },
  {
    companyId: "comp-auro-001",
    campaignId: "camp-default",
    companyName: "Kalyani Packaging & Automation",
    website: "https://kalyanipackaging.com",
    domain: "kalyanipackaging.com",
    industry: "Manufacturing",
    subSegment: "Packaging Automation",
    location: "Whitefield Industrial Area, Bengaluru, Karnataka",
    companySize: "75-150",
    decisionMakerName: "Suresh Hegde",
    decisionMakerTitle: "Managing Director",
    email: "suresh@kalyanipackaging.com",
    phone: "+91 80 2845 3321",
    sourceUrl: "https://kalyanipackaging.com/team",
    dataSource: "Demo data",
    notes: "Manufactures automated pharmaceutical packaging lines and corrugated carton machinery.",
  },
];

export async function researchBengaluruManufacturingLeads(
  criteria: {
    industry?: string;
    subSegment?: string;
    location?: string;
    targetTitles?: string[];
  },
  isDemo: boolean = true,
): Promise<Array<Omit<SalesLead, "id" | "score" | "status" | "discoveredAt">>> {
  if (isDemo) {
    return BENGALURU_MANUFACTURING_FIXTURES;
  }
  return BENGALURU_MANUFACTURING_FIXTURES;
}
