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
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLinkedin?: string;
  employeeCount?: string;
  annualRevenue?: string;
  leadScore: number;
  verificationStatus: 'verified' | 'unverified' | 'rejected';
  crmStage: 'new' | 'qualified' | 'contacted' | 'replied' | 'hot_lead' | 'unsubscribed';
  dataSource?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecordDto {
  id: string;
  companyId: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed';
  brief: LeadCampaignBriefPayload;
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

export interface LeadApprovalBatchDto {
  id: string;
  campaignId: string;
  companyId: string;
  leads: LeadRecordDto[];
  status: 'pending' | 'approved' | 'rejected' | 'partially_approved';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
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
  campaignName: string;
  steps: EmailSequenceStepDto[];
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

export const salesApi = {
  provisionSalesOrg: (companyId: string) =>
    api.post<SalesOrgStatus>(`/companies/${companyId}/sales/org/provision`, {}),

  listPrompts: (companyId: string) =>
    api.get<SalesPrompt[]>(`/companies/${companyId}/sales/prompts`),

  updatePrompt: (companyId: string, role: string, content: string) =>
    api.put<SalesPrompt>(`/companies/${companyId}/sales/prompts/${role}`, { content }),

  createCampaign: (companyId: string, brief: LeadCampaignBriefPayload) =>
    api.post<CampaignRecordDto>(`/companies/${companyId}/sales/campaigns`, brief),

  listCampaigns: (companyId: string) =>
    api.get<CampaignRecordDto[]>(`/companies/${companyId}/sales/campaigns`),

  getCampaign: (companyId: string, campaignId: string) =>
    api.get<CampaignRecordDto>(`/companies/${companyId}/sales/campaigns/${campaignId}`),

  runResearch: (companyId: string, campaignId: string) =>
    api.post<{ success: boolean; count: number; leads: LeadRecordDto[] }>(
      `/companies/${companyId}/sales/campaigns/${campaignId}/research`,
      {}
    ),

  listLeads: (companyId: string, campaignId: string) =>
    api.get<LeadRecordDto[]>(`/companies/${companyId}/sales/campaigns/${campaignId}/leads`),

  listApprovalBatches: (companyId: string, campaignId: string) =>
    api.get<LeadApprovalBatchDto[]>(`/companies/${companyId}/sales/campaigns/${campaignId}/approvals`),

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

  listHotLeads: (companyId: string) =>
    api.get<HotLeadEventDto[]>(`/companies/${companyId}/sales/hot-leads`),

  recordHotLead: (companyId: string, data: Omit<HotLeadEventDto, 'id' | 'detectedAt' | 'notifiedHuman'>) =>
    api.post<HotLeadEventDto>(`/companies/${companyId}/sales/hot-leads`, data),

  listSuppressions: (companyId: string) =>
    api.get<{ suppressions: string[] }>(`/companies/${companyId}/sales/suppressions`),

  addSuppression: (companyId: string, email: string) =>
    api.post<{ emailHash: string; success: boolean }>(`/companies/${companyId}/sales/suppressions`, { email }),

  getCsvExportUrl: (companyId: string, campaignId: string) =>
    `/api/companies/${companyId}/sales/campaigns/${campaignId}/export-csv`,
};
