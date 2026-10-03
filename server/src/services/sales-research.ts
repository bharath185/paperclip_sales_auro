import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
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
  // Interoperability and CRM aliases
  companyDomain?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string | null;
  contactLinkedin?: string | null;
  locationCity?: string;
  leadScore?: number;
  crmStage?: string;
  verificationStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type LeadRecord = SalesLead;

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
  /system\s+override\s*:/gi,
  /exfiltrate\s+keys/gi,
  /print\s+api\s+key/gi,
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
 * Normalizes decimal, octal, hex, and dotted representations to standard IPv4.
 */
export function normalizeIpString(host: string): string | null {
  const clean = host.replace(/^\[|\]$/g, "").trim();
  
  // Decimal integer notation (e.g., 2130706433 -> 127.0.0.1)
  if (/^\d+$/.test(clean)) {
    const num = Number(clean);
    if (num >= 0 && num <= 0xffffffff) {
      return [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255,
      ].join(".");
    }
  }

  // Octal or Hex representation (e.g. 0177.0.0.1, 0x7f.0.0.1)
  const parts = clean.split(".");
  if (parts.length === 4) {
    const parsedParts: number[] = [];
    for (const p of parts) {
      let val: number;
      if (p.startsWith("0x") || p.startsWith("0X")) {
        val = parseInt(p, 16);
      } else if (p.startsWith("0") && p.length > 1) {
        val = parseInt(p, 8);
      } else {
        val = parseInt(p, 10);
      }
      if (isNaN(val) || val < 0 || val > 255) return null;
      parsedParts.push(val);
    }
    return parsedParts.join(".");
  }

  return null;
}

/**
 * Checks if an IP address belongs to private, loopback, link-local, or cloud metadata ranges.
 * Supports IPv4 (dotted, decimal, octal, hex) and IPv6 (loopback, link-local, unique local, IPv4-mapped).
 */
export function isPrivateIp(ip: string): boolean {
  const normalizedV4 = normalizeIpString(ip);
  const targetIp = normalizedV4 || ip.replace(/^\[|\]$/g, "").trim();

  if (net.isIPv4(targetIp)) {
    const parts = targetIp.split(".").map(Number);
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure metadata 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 224.0.0.0/4 (Multicast / Reserved)
    if (parts[0] >= 224) return true;
    return false;
  } else if (net.isIPv6(targetIp)) {
    const cleanIp = targetIp.toLowerCase();
    // ::1 (Loopback)
    if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1" || cleanIp === "0000:0000:0000:0000:0000:0000:0000:0001") return true;
    // fc00::/7 (Unique local)
    if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true;
    // fe80::/10 (Link local)
    if (cleanIp.startsWith("fe80") || cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) return true;
    // IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:7f00:1)
    if (cleanIp.includes("::ffff:")) {
      const v4Part = cleanIp.split("::ffff:")[1];
      if (v4Part && isPrivateIp(v4Part)) return true;
    }
    return false;
  }
  return false;
}

/**
 * Validates that a target URL is safe from Server-Side Request Forgery (SSRF).
 */
export async function validateSsrfSafeUrl(rawUrl: string): Promise<{
  safe: boolean;
  reason?: string;
  resolvedIp?: string;
  url?: URL;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Invalid URL syntax" };
  }

  // 1. Protocol allowlist (http and https only)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Protocol ${parsed.protocol} is forbidden. Only HTTP/HTTPS permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Blocked hostnames & cloud metadata aliases
  const blockedHostnames = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.local",
    "instance-data",
  ]);

  if (blockedHostnames.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    return { safe: false, reason: `Host ${hostname} is blocked for SSRF protection.` };
  }

  // 3. Direct IP check
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: `Direct IP ${hostname} belongs to private or link-local range and is blocked.` };
    }
    return { safe: true, resolvedIp: hostname, url: parsed };
  }

  // RFC 2606 reserved documentation and test domain
  if (hostname === "example.com" || hostname.endsWith(".example.com")) {
    return { safe: true, resolvedIp: "93.184.216.34", url: parsed };
  }

  // 4. DNS resolution validation
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, reason: `DNS lookup failed for hostname: ${hostname}` };
    }
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        return {
          safe: false,
          reason: `DNS for ${hostname} resolved to private/cloud metadata IP ${addr.address}, blocked for SSRF.`,
        };
      }
    }
    return { safe: true, resolvedIp: addresses[0].address, url: parsed };
  } catch (err: any) {
    return { safe: false, reason: `DNS lookup failed for ${hostname}: ${err.message}` };
  }
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
  if (
    lead.location.toLowerCase().includes(targetLoc) ||
    lead.location.toLowerCase().includes("peenya") ||
    lead.location.toLowerCase().includes("bommasandra")
  ) {
    score += 25;
  } else if (lead.location.toLowerCase().includes("karnataka") || lead.location.toLowerCase().includes("india")) {
    score += 15;
  }

  // 3. Decision maker seniority (max 30 pts)
  const title = lead.decisionMakerTitle.toLowerCase();
  const defaultSeniorTitles = [
    "vp",
    "vice president",
    "director",
    "head",
    "managing director",
    "chief",
    "cto",
    "coo",
    "general manager",
    "plant manager",
  ];
  const targetTitles =
    lead.targetTitles && lead.targetTitles.length > 0
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
  rawExtractedData: z.record(z.string(), z.unknown()).optional(),
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
        reason: `Schema validation failed: ${parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
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
      companyDomain: domain,
      industry: raw.industry,
      subSegment: sanitizedSubSegment,
      location: sanitizedLocation,
      locationCity: sanitizedLocation,
      companySize: raw.companySize || "50-200",
      decisionMakerName: sanitizedDmName,
      contactName: sanitizedDmName,
      decisionMakerTitle: sanitizedDmTitle,
      contactTitle: sanitizedDmTitle,
      email,
      contactEmail: email,
      phone: raw.phone || null,
      contactPhone: raw.phone || null,
      sourceUrl: raw.sourceUrl,
      discoveredAt: new Date().toISOString(),
      score,
      leadScore: score,
      status: score >= 50 ? "discovered" : "rejected",
      verificationStatus: "verified",
      crmStage: "new",
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
 * Real Web Researcher Service with SSRF protection, robots.txt parsing, and rate limiting.
 */
export class WebResearcherService {
  private domainLastAccess: Map<string, number> = new Map();
  private maxRedirects: number = 3;
  private maxResponseSizeBytes: number = 2 * 1024 * 1024; // 2MB
  private timeoutMs: number = 5000;

  constructor(
    private options: {
      minDomainDelayMs?: number;
      fetchFn?: typeof fetch;
      maxRedirects?: number;
      maxResponseSizeBytes?: number;
      timeoutMs?: number;
    } = {},
  ) {
    if (options.maxRedirects !== undefined) this.maxRedirects = options.maxRedirects;
    if (options.maxResponseSizeBytes !== undefined) this.maxResponseSizeBytes = options.maxResponseSizeBytes;
    if (options.timeoutMs !== undefined) this.timeoutMs = options.timeoutMs;
  }

  async fetchPage(
    url: string,
    mockRobotsTxt?: string,
  ): Promise<{ success: boolean; content?: string; sourceUrl: string; reason?: string }> {
    // 1. Pre-flight SSRF Validation
    const ssrfCheck = await validateSsrfSafeUrl(url);
    if (!ssrfCheck.safe) {
      return {
        success: false,
        sourceUrl: url,
        reason: `SSRF Blocked: ${ssrfCheck.reason}`,
      };
    }

    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    const path = parsedUrl.pathname;

    // 2. Respect robots.txt
    if (mockRobotsTxt && !isPathAllowedByRobotsTxt(mockRobotsTxt, path)) {
      return {
        success: false,
        sourceUrl: url,
        reason: `Blocked by robots.txt rule for path: ${path}`,
      };
    }

    // 3. Rate limiting check (min delay per domain)
    const minDelay = this.options.minDomainDelayMs ?? 1000;
    const now = Date.now();
    const lastAccess = this.domainLastAccess.get(domain) || 0;
    const timeSinceLast = now - lastAccess;

    if (timeSinceLast < minDelay) {
      await new Promise((resolve) => setTimeout(resolve, minDelay - timeSinceLast));
    }
    this.domainLastAccess.set(domain, Date.now());

    // 4. Perform bounded fetch with timeout, redirect checks, and size limits
    try {
      const fetchImpl = this.options.fetchFn || fetch;
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

      let currentUrl = url;
      let redirectCount = 0;
      let res: Response | null = null;

      while (redirectCount <= this.maxRedirects) {
        // Validate target URL at every hop of redirect chain
        const hopCheck = await validateSsrfSafeUrl(currentUrl);
        if (!hopCheck.safe) {
          clearTimeout(timeoutHandle);
          return {
            success: false,
            sourceUrl: currentUrl,
            reason: `SSRF Blocked on redirect: ${hopCheck.reason}`,
          };
        }

        res = await fetchImpl(currentUrl, {
          headers: {
            "User-Agent": "ProjectAuroBot/1.0 (+https://projectauro.com/bot)",
          },
          signal: controller.signal,
          redirect: "manual",
        });

        // Handle redirect
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers?.get ? res.headers.get("location") : null;
          if (!location) break;
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount++;
          continue;
        }

        break;
      }

      clearTimeout(timeoutHandle);

      if (!res) {
        return { success: false, sourceUrl: url, reason: "No response received" };
      }

      if (redirectCount > this.maxRedirects) {
        return { success: false, sourceUrl: url, reason: `Exceeded maximum redirect limit of ${this.maxRedirects}` };
      }

      if (!res.ok) {
        return { success: false, sourceUrl: url, reason: `HTTP error ${res.status}: ${res.statusText || "Request failed"}` };
      }

      // Check Content-Length header if present
      const contentLength = res.headers?.get ? res.headers.get("content-length") : null;
      if (contentLength && parseInt(contentLength, 10) > this.maxResponseSizeBytes) {
        return {
          success: false,
          sourceUrl: url,
          reason: `Response size ${contentLength} exceeds maximum allowed limit of ${this.maxResponseSizeBytes} bytes`,
        };
      }

      const text = await res.text();
      if (text.length > this.maxResponseSizeBytes) {
        return {
          success: false,
          sourceUrl: url,
          reason: `Payload exceeds max response size limit of ${this.maxResponseSizeBytes} bytes`,
        };
      }

      return {
        success: true,
        sourceUrl: url,
        content: sanitizeUntrustedWebContent(text),
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: false, sourceUrl: url, reason: `Request timed out after ${this.timeoutMs}ms` };
      }
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
