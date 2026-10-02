import { api } from "./client";

export interface GovernanceAgentSummary {
  id: string;
  name: string;
  role: string;
  title: string | null;
  reportsTo: string | null;
  budgetMonthlyCents: number;
}

export interface GovernanceOrgStatus {
  isComplete: boolean;
  count: number;
  agents: GovernanceAgentSummary[];
}

export interface GovernancePrompt {
  role: string;
  title: string;
  content: string;
}

export interface ProjectKickoffBriefPayload {
  companyId?: string;
  projectName: string;
  problem: string;
  targetUsers: string;
  goals: string;
  constraints?: string;
  budget?: string | number;
  deadline?: string;
  preferredStack?: string;
  integrations?: string;
  teamSizeAndSkills?: string;
  attachments?: string;
  isDemo?: boolean;
}

export interface GeneratedDocumentResult {
  kind: string;
  title: string;
  fileName: string;
  authorRole: string;
  content: string;
  isValid: boolean;
  missingSections: string[];
}

export interface WorkstreamResult {
  role: string;
  taskTitle: string;
  issueId: string;
  status: string;
  dependsOnIssueIds?: string[];
  documents: GeneratedDocumentResult[];
  reviews: any[];
}

export interface KickoffResponse {
  goalId: string;
  kickoffIssueId: string;
  ceoAgentId: string;
  projectName: string;
  executionMode: "demo" | "live";
  documents: Record<string, GeneratedDocumentResult>;
  workstreams: WorkstreamResult[];
  projectPackSummary: GeneratedDocumentResult;
  status: "completed" | "in_review" | "in_progress";
}

export interface GovernanceDocSummary {
  kind: string;
  title: string;
  fileName: string;
  authorRole: string;
  currentVersion: number;
  versionCount: number;
  reviewCount: number;
  isValid: boolean;
  missingSections: string[];
  foundSections: string[];
}

export interface GovernanceDocDetail {
  kind: string;
  title: string;
  fileName: string;
  authorRole: string;
  currentVersion: number;
  content: string;
  isValid: boolean;
  missingSections: string[];
  foundSections: string[];
  versions: Array<{
    version: number;
    content: string;
    authorRole: string;
    changeSummary: string;
    createdAt: string;
  }>;
  reviews: Array<{
    reviewerRole: string;
    status: string;
    comments: string;
    createdAt: string;
  }>;
}

export const governanceApi = {
  getStatus: (companyId: string) =>
    api.get<GovernanceOrgStatus>(`/companies/${companyId}/governance/status`),

  createOrg: (
    companyId: string,
    data?: {
      adapterType?: string;
      customModels?: Record<string, string>;
    },
  ) =>
    api.post<{
      success: boolean;
      projectId: string;
      agents: GovernanceAgentSummary[];
    }>(`/companies/${companyId}/governance/org/create`, data || {}),

  getPrompts: () =>
    api.get<Record<string, GovernancePrompt>>("/governance/prompts"),

  getPrompt: (role: string) =>
    api.get<{ role: string; content: string }>(`/governance/prompts/${role}`),

  updatePrompt: (role: string, content: string) =>
    api.put<{ success: boolean; role: string; content: string }>(
      `/governance/prompts/${role}`,
      { content },
    ),

  submitKickoff: (companyId: string, brief: ProjectKickoffBriefPayload) =>
    api.post<KickoffResponse>(`/companies/${companyId}/governance/kickoff`, brief),

  listDocuments: (companyId: string) =>
    api.get<{
      projectName: string;
      packStatus: "draft" | "in_review" | "approved";
      documents: GovernanceDocSummary[];
    }>(`/companies/${companyId}/governance/documents`),

  getDocument: (companyId: string, kind: string) =>
    api.get<GovernanceDocDetail>(`/companies/${companyId}/governance/documents/${kind}`),

  updateDocument: (companyId: string, kind: string, content: string, changeSummary?: string) =>
    api.put<{
      success: boolean;
      kind: string;
      version: number;
      isValid: boolean;
      missingSections: string[];
      document: GovernanceDocDetail;
    }>(`/companies/${companyId}/governance/documents/${kind}`, { content, changeSummary }),

  reviewDocument: (
    companyId: string,
    kind: string,
    data: {
      reviewerRole: string;
      status: "approved" | "changes_requested";
      comments: string;
    },
  ) =>
    api.post<{
      success: boolean;
      review: any;
      reviews: any[];
    }>(`/companies/${companyId}/governance/documents/${kind}/review`, data),

  approvePack: (companyId: string) =>
    api.post<{
      success: boolean;
      packStatus: "approved";
      message: string;
      projectName: string;
      approvedAt: string;
    }>(`/companies/${companyId}/governance/pack/approve`, {}),

  getExportUrl: (companyId: string, format: string) =>
    `/api/companies/${companyId}/governance/export/${format}`,

  getTeamState: (companyId: string) =>
    api.get<{
      companyId: string;
      members: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        primarySkills: string[];
        weeklyCapacityHours: number;
        assignedHours: number;
      }>;
      tickets: Array<{
        id: string;
        storyId: string;
        summary: string;
        epic: string;
        storyPoints: number;
        estimatedHours: number;
        assigneeMemberId: string | null;
        assigneeName: string | null;
        status: "backlog" | "in_progress" | "in_review" | "done";
        requiredSkills: string[];
      }>;
      updatedAt: string;
    }>(`/companies/${companyId}/governance/team`),

  convertSprintToTickets: (companyId: string) =>
    api.post<any>(`/companies/${companyId}/governance/team/convert`, {}),

  assignTicket: (
    companyId: string,
    ticketId: string,
    patch: { assigneeMemberId?: string | null; status?: string },
  ) =>
    api.put<{ success: boolean; ticket: any }>(
      `/companies/${companyId}/governance/team/tickets/${ticketId}`,
      patch,
    ),

  getTeamExportUrl: (companyId: string) =>
    `/api/companies/${companyId}/governance/team/export`,
};
