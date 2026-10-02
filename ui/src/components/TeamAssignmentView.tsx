import React, { useEffect, useState, useCallback } from "react";
import { governanceApi } from "@/api/governance";
import { Users, CheckCircle2, Clock, Download, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  primarySkills: string[];
  weeklyCapacityHours: number;
  assignedHours: number;
}

interface SprintTicket {
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
}

interface TeamAssignmentViewProps {
  companyId: string;
}

export function TeamAssignmentView({ companyId }: TeamAssignmentViewProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tickets, setTickets] = useState<SprintTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadTeamState = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await governanceApi.getTeamState(companyId);
      setMembers(res.members || []);
      setTickets(res.tickets || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load team assignment data.");
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadTeamState();
  }, [loadTeamState]);

  const handleConvertSprint = async () => {
    try {
      setIsConverting(true);
      setError(null);
      await governanceApi.convertSprintToTickets(companyId);
      setStatusMessage("Sprint plan converted to tickets successfully!");
      await loadTeamState();
    } catch (err: any) {
      setError(err?.message || "Failed to convert sprint stories to tickets.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleAssignTicket = async (ticketId: string, memberId: string | null) => {
    try {
      setError(null);
      await governanceApi.assignTicket(companyId, ticketId, {
        assigneeMemberId: memberId || null,
      });
      await loadTeamState();
    } catch (err: any) {
      setError(err?.message || "Failed to update ticket assignment.");
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      setError(null);
      await governanceApi.assignTicket(companyId, ticketId, {
        status: newStatus,
      });
      await loadTeamState();
    } catch (err: any) {
      setError(err?.message || "Failed to update ticket status.");
    }
  };

  if (isLoading && members.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading team assignments...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            Human Team Allocation & Sprint Tickets
          </h2>
          <p className="text-sm text-muted-foreground">
            Convert sprint stories into assignable tickets, track capacity, and export the team sheet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleConvertSprint}
            disabled={isConverting}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isConverting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Convert Sprint to Tickets
          </button>

          <a
            href={governanceApi.getTeamExportUrl(companyId)}
            download="team-allocation.csv"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Export Sheet (CSV)
          </a>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {statusMessage}
        </div>
      )}

      {/* Team Roster & Capacity Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Team Roster & Weekly Capacity
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const utilization = Math.min(100, Math.round((member.assignedHours / (member.weeklyCapacityHours || 1)) * 100));
            const isOverloaded = member.assignedHours > member.weeklyCapacityHours;

            return (
              <div
                key={member.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-card-foreground">{member.name}</h4>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isOverloaded
                        ? "bg-red-500/20 text-red-600 dark:text-red-400"
                        : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {utilization}% Capacity
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Assigned: {member.assignedHours}h</span>
                    <span>Max: {member.weeklyCapacityHours}h / week</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isOverloaded ? "bg-red-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  {member.primarySkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sprint Tickets Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sprint Tickets ({tickets.length})
          </h3>
        </div>

        {tickets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            No sprint tickets created yet. Click "Convert Sprint to Tickets" to generate tasks from the approved sprint plan.
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1 sm:max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {ticket.storyId}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {ticket.epic}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-card-foreground">{ticket.summary}</h4>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {ticket.estimatedHours}h ({ticket.storyPoints} pts)
                    </span>
                    <span>•</span>
                    <div className="flex flex-wrap gap-1">
                      {ticket.requiredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded bg-muted px-1 py-0.5 text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Status Dropdown */}
                  <select
                    value={ticket.status}
                    onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                    className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                  </select>

                  {/* Assignee Dropdown */}
                  <select
                    value={ticket.assigneeMemberId || ""}
                    onChange={(e) => handleAssignTicket(ticket.id, e.target.value || null)}
                    className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
