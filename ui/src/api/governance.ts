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
}

export interface GeneratedDocumentResult {
  title: string;
  path: string;
  authorRole: string;
  content: string;
}

export interface WorkstreamResult {
  role: string;
  taskTitle: string;
  issueId: string;
  status: string;
  documents: GeneratedDocumentResult[];
  reviews: string[];
}

export interface KickoffResponse {
  goalId: string;
  kickoffIssueId: string;
  ceoAgentId: string;
  projectName: string;
  workstreams: WorkstreamResult[];
  projectPackSummary: GeneratedDocumentResult;
  status: "completed" | "in_review" | "in_progress";
}

export const governanceApi = {
  getStatus: (companyId: string) =>
    api.get<GovernanceOrgStatus>(`/companies/${companyId}/governance/status`),

  createOrg: (companyId: string, data?: { adapterType?: string; customModels?: Record<string, string> }) =>
    api.post<{ success: boolean; projectId: string; agents: GovernanceAgentSummary[] }>(
      `/companies/${companyId}/governance/org/create`,
      data ?? {},
    ),

  getPrompts: () => api.get<Record<string, GovernancePrompt>>(`/governance/prompts`),

  getPrompt: (role: string) => api.get<{ role: string; content: string }>(`/governance/prompts/${role}`),

  updatePrompt: (role: string, content: string) =>
    api.put<{ success: boolean; role: string; content: string }>(`/governance/prompts/${role}`, { content }),

  submitKickoff: (companyId: string, brief: ProjectKickoffBriefPayload) =>
    api.post<KickoffResponse>(`/companies/${companyId}/governance/kickoff`, brief),
};
