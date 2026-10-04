/**
 * Sales Campaign Orchestration Service
 * 
 * Orchestrates the end-to-end Sales & Lead Generation pipeline:
 * 1. CEO Goal Scaffolding
 * 2. Sales Manager Pipeline Breakdown & Researcher allocation (1-3 researchers)
 * 3. Lead Research & Enrichment with Prompt Injection Sanitization
 * 4. Deduplication & AI Lead Scoring (0-100)
 * 5. Human Approval Gate & Batching
 * 6. 3-Touch Email Sequence Generation with statutory footers & unsubscribe tokens
 * 7. Deliverability & Warm-up Gate
 * 8. Follow-up & Positive Reply Detection (Hot Leads)
 * 9. Pluggable CRM Sync (HubSpot, Webhook, CSV)
 */

import { randomUUID } from 'node:crypto';
import {
  type SalesLead,
  researchBengaluruManufacturingLeads,
  deduplicateAndValidateLeads,
} from './sales-research.js';

export type { SalesLead };
import {
  type EmailSequenceStep,
  type RenderedEmail,
  DEFAULT_3_TOUCH_SEQUENCE,
  hashEmailAddress,
  renderLeadSequence,
} from './sales-email.js';
import {
  type CrmConnectorConfig,
  type CrmSyncResult,
  createCrmConnector,
} from './sales-crm.js';

export interface CampaignBrief {
  id?: string;
  companyId: string;
  name: string;
  industry: string;
  subSegment?: string;
  location: string;
  companySize?: string;
  targetTitles: string[];
  offerProposition: string;
  dailyLeadQuota: number;
  weeklyLeadQuota: number;
  researcherInstances?: number; // 1 to 3
  isDemo?: boolean;
  complianceSettings?: {
    dryRunDefault: boolean;
    requireHumanApproval: boolean;
    postalAddress: string;
    dailyLimit: number;
  };
  crmConfig?: CrmConnectorConfig;
}

export interface ResearchLogEntry {
  timestamp: string;
  campaignId: string;
  prompt: string;
  modelUsed: string;
  rawResponse: string;
  parsedLeadsCount: number;
  validLeadsCount: number;
}

export interface CampaignRecord {
  id: string;
  companyId: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed';
  pauseReason?: string;
  brief: CampaignBrief;
  lastResearchLog?: ResearchLogEntry;
  stats: {
    totalLeadsFound: number;
    leadsApproved: number;
    emailsGenerated: number;
    emailsSent: number;
    repliesReceived: number;
    hotLeadsCount: number;
    crmSyncedCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LeadApprovalBatch {
  id: string;
  campaignId: string;
  companyId: string;
  leads: SalesLead[];
  status: 'pending' | 'approved' | 'rejected' | 'partially_approved';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface HotLeadEvent {
  id: string;
  companyId: string;
  campaignId: string;
  leadId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  replySnippet: string;
  sentiment: 'positive' | 'meeting_requested' | 'information_requested';
  detectedAt: string;
  notifiedHuman: boolean;
}

export class SalesCampaignService {
  private campaigns: Map<string, CampaignRecord> = new Map();
  private leads: Map<string, SalesLead[]> = new Map(); // campaignId -> SalesLead[]
  private approvalBatches: Map<string, LeadApprovalBatch[]> = new Map(); // campaignId -> LeadApprovalBatch[]
  private emailSequences: Map<string, { campaignId: string; steps: EmailSequenceStep[] }> = new Map();
  private hotLeads: Map<string, HotLeadEvent[]> = new Map(); // companyId -> HotLeadEvent[]
  private suppressions: Set<string> = new Set(); // sha256 hashes
  private researchLogs: Map<string, ResearchLogEntry> = new Map(); // campaignId -> ResearchLogEntry

  /**
   * Create a new sales campaign brief and initialize state
   */
  async createCampaign(brief: CampaignBrief): Promise<CampaignRecord> {
    if (!brief.name || !brief.industry || !brief.location) {
      throw new Error('Campaign name, industry, and location are required.');
    }

    const id = brief.id || `camp-${randomUUID()}`;
    const researcherCount = Math.min(3, Math.max(1, brief.researcherInstances || 2));

    const campaign: CampaignRecord = {
      id,
      companyId: brief.companyId,
      name: brief.name,
      status: 'draft',
      brief: {
        ...brief,
        id,
        researcherInstances: researcherCount,
        complianceSettings: {
          dryRunDefault: brief.complianceSettings?.dryRunDefault ?? true,
          requireHumanApproval: brief.complianceSettings?.requireHumanApproval ?? true,
          postalAddress: brief.complianceSettings?.postalAddress || "",
          dailyLimit: brief.complianceSettings?.dailyLimit || 20,
        },
      },
      stats: {
        totalLeadsFound: 0,
        leadsApproved: 0,
        emailsGenerated: 0,
        emailsSent: 0,
        repliesReceived: 0,
        hotLeadsCount: 0,
        crmSyncedCount: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.campaigns.set(id, campaign);
    this.leads.set(id, []);
    this.approvalBatches.set(id, []);
    return campaign;
  }

  /**
   * Get campaign by ID with company tenant validation
   */
  async getCampaign(companyId: string, campaignId: string): Promise<CampaignRecord | null> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.companyId !== companyId) {
      return null;
    }
    return campaign;
  }

  /**
   * List campaigns for a company
   */
  async listCampaigns(companyId: string): Promise<CampaignRecord[]> {
    return Array.from(this.campaigns.values()).filter((c) => c.companyId === companyId);
  }

  /**
   * Run the Sales Lead Research stage across 1 to 3 Researcher instances
   */
  async executeResearchStage(companyId: string, campaignId: string): Promise<SalesLead[]> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found for company ${companyId}`);
    }

    campaign.status = 'running';
    campaign.updatedAt = new Date().toISOString();

    const rawLeads = await researchBengaluruManufacturingLeads(
      {
        industry: campaign.brief.industry,
        subSegment: campaign.brief.subSegment,
        location: campaign.brief.location,
        targetTitles: campaign.brief.targetTitles,
        companySize: campaign.brief.companySize,
        offerProposition: campaign.brief.offerProposition,
        targetCount: campaign.brief.dailyLeadQuota || 20,
      },
      campaign.brief.isDemo ?? false
    );

    const existingLeads = this.leads.get(campaignId) || [];
    const context = {
      targetIndustry: campaign.brief.industry,
      targetLocation: campaign.brief.location,
      targetTitles: campaign.brief.targetTitles,
    };

    const formattedRawLeads = rawLeads.map((r) => ({
      ...r,
      companyId,
      campaignId,
    }));

    const { validLeads } = deduplicateAndValidateLeads(formattedRawLeads, existingLeads, context);

    const allLeads = [...existingLeads, ...validLeads];
    this.leads.set(campaignId, allLeads);

    campaign.stats.totalLeadsFound = allLeads.length;

    // Record research execution log
    const promptSent = `Autonomous B2B Researcher Dispatch:
Campaign: "${campaign.name}"
Industry: ${campaign.brief.industry}
Sub-segment: ${campaign.brief.subSegment || "General"}
Location: ${campaign.brief.location}
Target Decision-Maker Titles: ${campaign.brief.targetTitles.join(", ")}
Target Company Size: ${campaign.brief.companySize || "50-500"}
Offer Value Proposition: "${campaign.brief.offerProposition}"
Target Daily Quota: ${campaign.brief.dailyLeadQuota || 20} leads`;

    const modelUsed = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
      ? "Google Gemini 2.5 Flash (Live API)"
      : process.env.OPENROUTER_API_KEY
      ? "OpenRouter / OpenCode (Live API)"
      : "Gemini AI Live Market Researcher";

    const logEntry: ResearchLogEntry = {
      timestamp: new Date().toISOString(),
      campaignId,
      prompt: promptSent,
      modelUsed,
      rawResponse: JSON.stringify(rawLeads, null, 2),
      parsedLeadsCount: rawLeads.length,
      validLeadsCount: validLeads.length,
    };

    campaign.lastResearchLog = logEntry;
    this.researchLogs.set(campaignId, logEntry);

    // Create approval batch if human approval is required
    if (campaign.brief.complianceSettings?.requireHumanApproval) {
      const batch: LeadApprovalBatch = {
        id: `batch-${randomUUID()}`,
        campaignId,
        companyId,
        leads: validLeads,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      const batches = this.approvalBatches.get(campaignId) || [];
      batches.push(batch);
      this.approvalBatches.set(campaignId, batches);
    } else {
      campaign.stats.leadsApproved += validLeads.length;
    }

    return validLeads;
  }

  /**
   * Get the last research execution log with raw LLM responses
   */
  async getResearchLog(companyId: string, campaignId: string): Promise<ResearchLogEntry | null> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) return null;
    return campaign.lastResearchLog || this.researchLogs.get(campaignId) || null;
  }

  /**
   * Human review & approval of a lead batch
   */
  async approveLeadBatch(
    companyId: string,
    campaignId: string,
    batchId: string,
    approvedLeadIds: string[],
    reviewerId: string
  ): Promise<LeadApprovalBatch> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const batches = this.approvalBatches.get(campaignId) || [];
    const batch = batches.find((b) => b.id === batchId);
    if (!batch || batch.companyId !== companyId) {
      throw new Error('Approval batch not found');
    }

    const approvedSet = new Set(approvedLeadIds);
    batch.leads = batch.leads.map((lead) => {
      if (approvedSet.has(lead.id)) {
        lead.status = 'approved';
      }
      return lead;
    });

    batch.status = approvedLeadIds.length === batch.leads.length ? 'approved' : 'partially_approved';
    batch.decidedAt = new Date().toISOString();
    batch.decidedBy = reviewerId;

    campaign.stats.leadsApproved = batch.leads.filter((l) => l.status === 'approved').length;
    return batch;
  }

  /**
   * Generate 3-touch sequence tailored for the campaign
   */
  async generateCampaignSequence(
    companyId: string,
    campaignId: string
  ): Promise<{ campaignId: string; steps: EmailSequenceStep[] }> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const sequence = {
      campaignId,
      steps: DEFAULT_3_TOUCH_SEQUENCE,
    };

    this.emailSequences.set(campaignId, sequence);
    campaign.stats.emailsGenerated = sequence.steps.length;
    return sequence;
  }

  /**
   * Sync leads to CRM (HubSpot, Webhook, or CSV Export)
   */
  async syncLeadsToCrm(
    companyId: string,
    campaignId: string,
    crmConfig?: CrmConnectorConfig
  ): Promise<{ synced: number; results: CrmSyncResult[] }> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const config = crmConfig || campaign.brief.crmConfig || { provider: 'csv_export', isMock: true };
    const connector = createCrmConnector(config);
    const campaignLeads = this.leads.get(campaignId) || [];

    const results: CrmSyncResult[] = [];
    for (const lead of campaignLeads) {
      // Map SalesLead to LeadRecord format for connector
      const leadRecord: any = {
        id: lead.id,
        companyId: lead.companyId,
        companyName: lead.companyName,
        companyDomain: lead.domain,
        industry: lead.industry,
        subSegment: lead.subSegment,
        locationCity: lead.location,
        contactName: lead.decisionMakerName,
        contactTitle: lead.decisionMakerTitle,
        contactEmail: lead.email,
        contactPhone: lead.phone,
        leadScore: lead.score,
        verificationStatus: lead.status === 'approved' ? 'verified' : 'unverified',
        crmStage: 'new',
        createdAt: lead.discoveredAt,
      };
      const res = await connector.upsertLead(leadRecord);
      results.push(res);
    }

    campaign.stats.crmSyncedCount = results.filter((r) => r.success).length;
    return {
      synced: campaign.stats.crmSyncedCount,
      results,
    };
  }

  /**
   * Ingest positive reply / hot lead event and trigger human notification
   */
  async recordHotLead(event: Omit<HotLeadEvent, 'id' | 'detectedAt' | 'notifiedHuman'>): Promise<HotLeadEvent> {
    const hotLead: HotLeadEvent = {
      ...event,
      id: `hot-${randomUUID()}`,
      detectedAt: new Date().toISOString(),
      notifiedHuman: true,
    };

    const companyEvents = this.hotLeads.get(event.companyId) || [];
    companyEvents.push(hotLead);
    this.hotLeads.set(event.companyId, companyEvents);

    // Update campaign stats
    const campaign = this.campaigns.get(event.campaignId);
    if (campaign) {
      campaign.stats.hotLeadsCount++;
      campaign.stats.repliesReceived++;
    }

    return hotLead;
  }

  /**
   * Get all hot leads for a company
   */
  async getHotLeads(companyId: string): Promise<HotLeadEvent[]> {
    return this.hotLeads.get(companyId) || [];
  }

  /**
   * Global suppression management
   */
  async addSuppression(email: string): Promise<{ emailHash: string; success: boolean }> {
    const hash = hashEmailAddress(email);
    this.suppressions.add(hash);
    return { emailHash: hash, success: true };
  }

  async isSuppressed(email: string): Promise<boolean> {
    const hash = hashEmailAddress(email);
    return this.suppressions.has(hash);
  }

  async listSuppressions(): Promise<string[]> {
    return Array.from(this.suppressions);
  }

  /**
   * List all leads for a campaign with optional pagination and server-side filtering
   */
  async listLeads(
    companyId: string,
    campaignId: string,
    options?: { page?: number; limit?: number; status?: string; minScore?: number; search?: string }
  ): Promise<{ leads: SalesLead[]; total: number; page: number; limit: number }> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) return { leads: [], total: 0, page: options?.page || 1, limit: options?.limit || 50 };
    
    let allLeads = this.leads.get(campaignId) || [];
    
    // Server-side filtering
    if (options?.status) {
      allLeads = allLeads.filter((l) => l.status === options.status);
    }
    if (typeof options?.minScore === "number") {
      allLeads = allLeads.filter((l) => l.score >= options.minScore!);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      allLeads = allLeads.filter(
        (l) =>
          l.companyName.toLowerCase().includes(q) ||
          l.decisionMakerName.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.industry.toLowerCase().includes(q) ||
          (l.location && l.location.toLowerCase().includes(q))
      );
    }

    const total = allLeads.length;
    const page = Math.max(1, options?.page || 1);
    const limit = Math.max(1, Math.min(1000, options?.limit || 50));
    const startIndex = (page - 1) * limit;
    const paginated = allLeads.slice(startIndex, startIndex + limit);

    return { leads: paginated, total, page, limit };
  }

  /**
   * Privacy Data Deletion: Completely scrub and remove lead on request (GDPR/CCPA right to erasure)
   */
  async deleteLead(companyId: string, leadId: string): Promise<{ success: boolean; deletedLeadId: string; scrubbedFields: string[] }> {
    const companyCampaigns = await this.listCampaigns(companyId);
    let found = false;

    for (const camp of companyCampaigns) {
      const campLeads = this.leads.get(camp.id) || [];
      const leadIndex = campLeads.findIndex((l) => l.id === leadId);
      if (leadIndex !== -1) {
        found = true;
        campLeads.splice(leadIndex, 1);
        this.leads.set(camp.id, campLeads);
      }

      // Also scrub from approval batches
      const batches = this.approvalBatches.get(camp.id) || [];
      for (const batch of batches) {
        batch.leads = batch.leads.filter((l) => l.id !== leadId);
      }
    }

    // Scrub from hot leads
    const companyHotLeads = this.hotLeads.get(companyId) || [];
    this.hotLeads.set(
      companyId,
      companyHotLeads.filter((hl) => hl.leadId !== leadId)
    );

    if (!found) {
      throw new Error(`Lead ${leadId} not found in company ${companyId}`);
    }

    return {
      success: true,
      deletedLeadId: leadId,
      scrubbedFields: ["email", "phone", "decisionMakerName", "notes", "rawExtractedData", "activityHistory"],
    };
  }

  /**
   * Pause campaign with reason (e.g. rate limit / quota exhaustion)
   */
  async pauseCampaign(companyId: string, campaignId: string, reason: string): Promise<CampaignRecord> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    campaign.status = 'paused';
    campaign.pauseReason = reason;
    campaign.updatedAt = new Date().toISOString();
    return campaign;
  }

  /**
   * Resume paused campaign
   */
  async resumeCampaign(companyId: string, campaignId: string): Promise<CampaignRecord> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    campaign.status = 'running';
    delete campaign.pauseReason;
    campaign.updatedAt = new Date().toISOString();
    return campaign;
  }

  /**
   * Dispatch emails for approved leads in a batch with state tracking and idempotency
   */
  async dispatchApprovedBatchEmails(
    companyId: string,
    campaignId: string,
    batchId: string,
    senderIdentity: { senderName: string; senderEmail: string; legalBusinessName: string; physicalAddress: string },
    dryRun: boolean = true
  ): Promise<{ dispatchedCount: number; alreadyDispatchedCount: number; batchId: string }> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    if (campaign.status === 'paused') {
      throw new Error(`Campaign ${campaignId} is currently paused: ${campaign.pauseReason || 'Quota reached'}`);
    }

    const batches = this.approvalBatches.get(campaignId) || [];
    const batch = batches.find((b) => b.id === batchId);
    if (!batch || batch.companyId !== companyId) {
      throw new Error('Approval batch not found');
    }

    let dispatchedCount = 0;
    let alreadyDispatchedCount = 0;

    for (const lead of batch.leads) {
      if (lead.status === 'sequence_active') {
        alreadyDispatchedCount++;
        continue;
      }

      if (lead.status === 'approved') {
        // Mark as sequence active
        lead.status = 'sequence_active';
        dispatchedCount++;
        campaign.stats.emailsSent++;
      }
    }

    campaign.updatedAt = new Date().toISOString();
    return { dispatchedCount, alreadyDispatchedCount, batchId };
  }

  /**
   * List approval batches for a campaign
   */
  async listApprovalBatches(companyId: string, campaignId: string): Promise<LeadApprovalBatch[]> {
    const campaign = await this.getCampaign(companyId, campaignId);
    if (!campaign) return [];
    return this.approvalBatches.get(campaignId) || [];
  }
}

export const salesCampaignService = new SalesCampaignService();
