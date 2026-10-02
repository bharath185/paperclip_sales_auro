/**
 * Project Auro - Human Team Assignment and Ticket Tracking Service
 * 
 * Converts sprint backlog stories into engineering tickets, assigns human team members,
 * tracks status, and exports team allocation sheets.
 */

import { DEFAULT_SPRINT_STORIES, type SprintStoryItem } from "./governance-export.js";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  primarySkills: string[];
  weeklyCapacityHours: number;
  assignedHours: number;
}

export interface AssignedTicket {
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
  branchName?: string;
  prUrl?: string;
}

export interface TeamAssignmentState {
  companyId: string;
  members: TeamMember[];
  tickets: AssignedTicket[];
  updatedAt: string;
}

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  {
    id: "member-1",
    name: "Alice Morgan",
    email: "alice.morgan@example.com",
    role: "Lead Systems Architect",
    primarySkills: ["Node.js", "Systems Architecture", "PostgreSQL", "Drizzle ORM"],
    weeklyCapacityHours: 40,
    assignedHours: 0,
  },
  {
    id: "member-2",
    name: "Bob Chen",
    email: "bob.chen@example.com",
    role: "Senior Frontend Engineer",
    primarySkills: ["React", "Vite", "Tailwind CSS", "TypeScript", "UI Tokens"],
    weeklyCapacityHours: 40,
    assignedHours: 0,
  },
  {
    id: "member-3",
    name: "Carlos Diaz",
    email: "carlos.diaz@example.com",
    role: "QA Automation Lead",
    primarySkills: ["Vitest", "E2E Testing", "JSDOM", "QA Checklists"],
    weeklyCapacityHours: 35,
    assignedHours: 0,
  },
  {
    id: "member-4",
    name: "Diana Vance",
    email: "diana.vance@example.com",
    role: "DevOps & Cloud Engineer",
    primarySkills: ["Docker", "Linux Bubblewrap", "CI/CD", "Infrastructure"],
    weeklyCapacityHours: 35,
    assignedHours: 0,
  },
  {
    id: "member-5",
    name: "Evan Wright",
    email: "evan.wright@example.com",
    role: "Security Officer",
    primarySkills: ["STRIDE Threat Modeling", "RBAC", "Secret Encryption", "Auditing"],
    weeklyCapacityHours: 25,
    assignedHours: 0,
  },
];

const teamStateStore = new Map<string, TeamAssignmentState>();

export function getOrCreateTeamState(companyId: string): TeamAssignmentState {
  let state = teamStateStore.get(companyId);
  if (!state) {
    const initialTickets: AssignedTicket[] = DEFAULT_SPRINT_STORIES.map((s, index) => {
      const defaultMember = DEFAULT_TEAM_MEMBERS[index % DEFAULT_TEAM_MEMBERS.length];
      const estimatedHours = s.storyPoints * 4;
      return {
        id: `TICK-${100 + index + 1}`,
        storyId: s.id,
        summary: s.summary,
        epic: s.epic,
        storyPoints: s.storyPoints,
        estimatedHours,
        assigneeMemberId: defaultMember.id,
        assigneeName: defaultMember.name,
        status: index === 0 ? "done" : index === 1 ? "in_progress" : "backlog",
        requiredSkills: defaultMember.primarySkills.slice(0, 2),
      };
    });

    state = {
      companyId,
      members: JSON.parse(JSON.stringify(DEFAULT_TEAM_MEMBERS)),
      tickets: initialTickets,
      updatedAt: new Date().toISOString(),
    };
    recalculateCapacity(state);
    teamStateStore.set(companyId, state);
  }
  return state;
}

function recalculateCapacity(state: TeamAssignmentState) {
  for (const member of state.members) {
    member.assignedHours = 0;
  }
  for (const ticket of state.tickets) {
    if (ticket.assigneeMemberId && ticket.status !== "done") {
      const member = state.members.find((m) => m.id === ticket.assigneeMemberId);
      if (member) {
        member.assignedHours += ticket.estimatedHours;
      }
    }
  }
}

export const governanceTeamAssignmentService = {
  getState: (companyId: string): TeamAssignmentState => {
    return getOrCreateTeamState(companyId);
  },

  convertSprintToTickets: (
    companyId: string,
    stories: SprintStoryItem[] = DEFAULT_SPRINT_STORIES,
  ): TeamAssignmentState => {
    const state = getOrCreateTeamState(companyId);
    state.tickets = stories.map((s, index) => {
      const defaultMember = state.members[index % state.members.length];
      const estimatedHours = s.storyPoints * 4;
      return {
        id: `TICK-${100 + index + 1}`,
        storyId: s.id,
        summary: s.summary,
        epic: s.epic,
        storyPoints: s.storyPoints,
        estimatedHours,
        assigneeMemberId: defaultMember.id,
        assigneeName: defaultMember.name,
        status: "backlog",
        requiredSkills: defaultMember.primarySkills.slice(0, 2),
      };
    });
    recalculateCapacity(state);
    state.updatedAt = new Date().toISOString();
    return state;
  },

  assignTicket: (
    companyId: string,
    ticketId: string,
    patch: { assigneeMemberId?: string | null; status?: AssignedTicket["status"] },
  ): AssignedTicket => {
    const state = getOrCreateTeamState(companyId);
    const ticket = state.tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    if (patch.assigneeMemberId !== undefined) {
      if (patch.assigneeMemberId === null) {
        ticket.assigneeMemberId = null;
        ticket.assigneeName = "Unassigned";
      } else {
        const member = state.members.find((m) => m.id === patch.assigneeMemberId);
        if (!member) {
          throw new Error(`Team member not found: ${patch.assigneeMemberId}`);
        }
        ticket.assigneeMemberId = member.id;
        ticket.assigneeName = member.name;
      }
    }

    if (patch.status !== undefined) {
      ticket.status = patch.status;
    }

    recalculateCapacity(state);
    state.updatedAt = new Date().toISOString();
    return ticket;
  },

  exportAssignmentSheetCsv: (companyId: string): string => {
    const state = getOrCreateTeamState(companyId);
    const headers = [
      "Ticket ID",
      "Story ID",
      "Summary",
      "Epic",
      "Assignee",
      "Status",
      "Story Points",
      "Estimated Hours",
      "Required Skills",
    ];

    const rows = [headers.join(",")];
    for (const t of state.tickets) {
      rows.push(
        [
          `"${t.id}"`,
          `"${t.storyId}"`,
          `"${t.summary.replace(/"/g, '""')}"`,
          `"${t.epic}"`,
          `"${t.assigneeName || "Unassigned"}"`,
          `"${t.status}"`,
          t.storyPoints,
          t.estimatedHours,
          `"${t.requiredSkills.join(", ")}"`,
        ].join(","),
      );
    }
    return rows.join("\n");
  },
};
