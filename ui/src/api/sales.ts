import { api } from "./client";

export interface SalesAgentSummary {
  id: string;
  name: string;
  role: string;
  title: string | null;
  reportsTo: string | null;
  budgetMonthlyCents: number;
}

export interface SalesOrgStatus {
  isComplete: boolean;
  count: number;
  agents: SalesAgentSummary[];
}

export interface SalesPrompt {
  role: string;
  title: string;
  content: string;
  version?: number;
}

export interface LeadCampaignBriefPayload {
  companyId?: string;
  name: string;
  industry: string;
  subSegment?: string;
  location: string;
  companySize?: string;
  targetTitles: string[];
  offerProposition: string;
  dailyLeadQuota?: number;
  weeklyLeadQuota?: number;
  researcherInstances?: number;
  isDemo?: boolean;
  complianceSettings?: {
    dryRunDefault: boolean;
    requireHumanApproval: boolean;
    postalAddress?: string;
    dailyLimit?: number;
  };
  crmConfig?: {
    provider: 'hubspot' | 'generic_webhook' | 'csv_export';
    apiKey?: string;
    endpointUrl?: string;
    headers?: Record<string, string>;
    isMock?: boolean;
  };
}

export interface LeadRecordDto {
  id: string;
  companyId: string;
  companyName: string;
  companyDomain: string;
  industry: string;
  subSegment?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLinkedin?: string;
  sourceUrl?: string;
  verificationScore: number;
  leadScore: number;
  qualificationReasoning?: string;
  crmStage: 'new' | 'qualified' | 'contacted' | 'replied' | 'meeting_scheduled' | 'hot_lead';
  isSuppressed: boolean;
  notes?: string;
  createdAt: string;
}

export interface CampaignRecordDto {
  id: string;
  companyId: string;
  name: string;
  status: 'draft' | 'discovering' | 'review_ready' | 'active' | 'paused' | 'completed';
  brief: LeadCampaignBriefPayload;
  stats: {
    totalLeadsFound: number;
    leadsApproved: number;
    leadsContacted: number;
    repliesReceived: number;
    meetingsBooked: number;
    crmSyncedCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LeadApprovalBatchDto {
  id: string;
  campaignId: string;
  batchNumber: number;
  leads: LeadRecordDto[];
  status: 'pending' | 'approved' | 'rejected' | 'partially_approved';
  approvedCount: number;
  totalCount: number;
  createdAt: string;
  approvedAt?: string;
}

export interface EmailSequenceStepDto {
  stepNumber: number;
  dayDelay: number;
  templateSubject: string;
  templateBody: string;
  touchGoal: string;
}

export interface EmailSequenceDto {
  campaignId: string;
  steps: EmailSequenceStepDto[];
  updatedAt?: string;
}

export interface HotLeadEventDto {
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

export interface ResearchLogDto {
  timestamp: string;
  campaignId: string;
  prompt: string;
  modelUsed: string;
  rawResponse: string;
  parsedLeadsCount: number;
  validLeadsCount: number;
}

export const salesApi = {
  provisionSalesOrg: (companyId: string) =>
    api.post<SalesOrgStatus>(`/companies/${companyId}/sales/org/provision`, {}),

  listPrompts: async (companyId: string): Promise<SalesPrompt[]> => {
    const res = await api.get<any>(`/companies/${companyId}/sales/prompts`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.prompts)) return res.prompts;
    return [];
  },

  updatePrompt: (companyId: string, role: string, content: string) =>
    api.put<SalesPrompt>(`/companies/${companyId}/sales/prompts/${role}`, { content }),

  createCampaign: (companyId: string, brief: LeadCampaignBriefPayload) =>
    api.post<CampaignRecordDto>(`/companies/${companyId}/sales/campaigns`, brief),

  listCampaigns: async (companyId: string): Promise<CampaignRecordDto[]> => {
    const res = await api.get<any>(`/companies/${companyId}/sales/campaigns`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.campaigns)) return res.campaigns;
    return [];
  },

  getCampaign: (companyId: string, campaignId: string) =>
    api.get<CampaignRecordDto>(`/companies/${companyId}/sales/campaigns/${campaignId}`),

  runResearch: (companyId: string, campaignId: string) =>
    api.post<{ success: boolean; count: number; leads: LeadRecordDto[]; log?: ResearchLogDto }>(
      `/companies/${companyId}/sales/campaigns/${campaignId}/research`,
      {}
    ),

  getResearchLog: (companyId: string, campaignId: string) =>
    api.get<ResearchLogDto>(`/companies/${companyId}/sales/campaigns/${campaignId}/research-log`),

  listLeads: async (companyId: string, campaignId: string): Promise<LeadRecordDto[]> => {
    const res = await api.get<any>(`/companies/${companyId}/sales/campaigns/${campaignId}/leads`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.leads)) return res.leads;
    return [];
  },

  listApprovalBatches: async (companyId: string, campaignId: string): Promise<LeadApprovalBatchDto[]> => {
    const res = await api.get<any>(`/companies/${companyId}/sales/campaigns/${campaignId}/approvals`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.batches)) return res.batches;
    return [];
  },

  approveBatch: (companyId: string, campaignId: string, batchId: string, approvedLeadIds: string[]) =>
    api.post<LeadApprovalBatchDto>(
      `/companies/${companyId}/sales/campaigns/${campaignId}/approvals/${batchId}`,
      { approvedLeadIds }
    ),

  generateSequence: (companyId: string, campaignId: string) =>
    api.post<EmailSequenceDto>(`/companies/${companyId}/sales/campaigns/${campaignId}/sequence`, {}),

  syncCrm: (companyId: string, campaignId: string, crmConfig?: any) =>
    api.post<{ synced: number; results: any[] }>(
      `/companies/${companyId}/sales/campaigns/${campaignId}/crm-sync`,
      { crmConfig }
    ),

  listHotLeads: async (companyId: string): Promise<HotLeadEventDto[]> => {
    const res = await api.get<any>(`/companies/${companyId}/sales/hot-leads`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.hotLeads)) return res.hotLeads;
    return [];
  },

  recordHotLead: (companyId: string, data: Omit<HotLeadEventDto, 'id' | 'detectedAt' | 'notifiedHuman'>) =>
    api.post<HotLeadEventDto>(`/companies/${companyId}/sales/hot-leads`, data),

  listSuppressions: async (companyId: string): Promise<{ suppressions: string[] }> => {
    const res = await api.get<any>(`/companies/${companyId}/sales/suppressions`);
    if (res && Array.isArray(res.suppressions)) return res;
    if (Array.isArray(res)) return { suppressions: res };
    return { suppressions: [] };
  },

  addSuppression: (companyId: string, email: string) =>
    api.post<{ emailHash: string; success: boolean }>(`/companies/${companyId}/sales/suppressions`, { email }),

  getCsvExportUrl: (companyId: string, campaignId: string) =>
    `/api/companies/${companyId}/sales/campaigns/${campaignId}/export-csv`,
};
