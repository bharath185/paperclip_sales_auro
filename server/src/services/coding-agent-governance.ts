/**
 * Project Auro - Coding Agent Sandbox Governance & PR Merge Policy
 * 
 * Enforces:
 * 1. Code-writing agents execute strictly within sandbox policy (confined workspace & isolated network).
 * 2. Out-of-policy filesystem and network traversals are blocked with explicit errors.
 * 3. Changes are committed to a feature branch with a mandatory PR description.
 * 4. Merging to default branches (main/master) requires human approval gate.
 */

import path from "node:path";

export interface SandboxPolicyConfig {
  filesystemScope: "workspace" | "unconfined";
  networkScope: "isolated" | "unconfined";
  workspaceDir: string;
  allowedCommands?: string[];
  deniedPaths?: string[];
}

export interface BranchCommitPayload {
  branchName: string;
  commitMessage: string;
  filesChanged: string[];
  prDescription: {
    thinkingPath: string;
    whatChanged: string[];
    verification: string;
    risks: string;
    modelUsed: string;
  };
}

export interface MergeRequestPayload {
  branchName: string;
  targetBranch: "main" | "master" | "develop";
  approvedByHuman: boolean;
  approverUserId?: string;
}

export class SandboxPolicyViolationError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "SandboxPolicyViolationError";
    this.code = code;
    this.details = details;
  }
}

export const codingAgentGovernanceService = {
  /**
   * Validates whether a file path is permitted by the coding agent's sandbox policy.
   */
  validatePathAccess: (
    targetPath: string,
    policy: SandboxPolicyConfig,
  ): { allowed: boolean; normalizedPath: string } => {
    if (policy.filesystemScope !== "workspace") {
      return { allowed: true, normalizedPath: targetPath };
    }

    const normalizedWorkspace = path.resolve(policy.workspaceDir);
    const normalizedTarget = path.resolve(targetPath);

    // Block sensitive system paths unconditionally
    const deniedPatterns = [
      "/etc",
      "/var",
      "/root",
      "C:\\Windows",
      "C:\\Users",
      ".ssh",
      "id_rsa",
      "../",
      ...(policy.deniedPaths || []),
    ];

    for (const denied of deniedPatterns) {
      if (normalizedTarget.toLowerCase().includes(denied.toLowerCase())) {
        throw new SandboxPolicyViolationError(
          `Out-of-policy path access blocked: Attempted to access restricted path "${targetPath}".`,
          "SANDBOX_PATH_TRAVERSAL_BLOCKED",
          { targetPath, workspaceDir: policy.workspaceDir },
        );
      }
    }

    const relative = path.relative(normalizedWorkspace, normalizedTarget);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new SandboxPolicyViolationError(
        `Out-of-policy filesystem traversal blocked: Path "${targetPath}" is outside workspace "${policy.workspaceDir}".`,
        "SANDBOX_WORKSPACE_CONFINEMENT_VIOLATION",
        { targetPath, workspaceDir: policy.workspaceDir },
      );
    }

    return { allowed: true, normalizedPath: normalizedTarget };
  },

  /**
   * Validates command execution against allowed sandbox command policy.
   */
  validateCommandExecution: (
    command: string,
    policy: SandboxPolicyConfig,
  ): { allowed: boolean } => {
    const trimmed = command.trim();
    const dangerousPatterns = [
      "sudo",
      "chmod 777",
      "rm -rf /",
      "rmdir /s",
      ":(){ :|:& };:",
      "curl -s",
      "wget",
      "nc -e",
      "bash -i",
      "powershell -encodedcommand",
    ];

    for (const bad of dangerousPatterns) {
      if (trimmed.toLowerCase().includes(bad)) {
        throw new SandboxPolicyViolationError(
          `Out-of-policy dangerous command blocked: "${command}".`,
          "SANDBOX_COMMAND_POLICY_VIOLATION",
          { command },
        );
      }
    }

    return { allowed: true };
  },

  /**
   * Submits a branch commit with a mandatory structured PR description.
   */
  submitBranchCommit: (
    payload: BranchCommitPayload,
  ): { success: boolean; branchName: string; prUrl: string } => {
    if (!payload.branchName || payload.branchName === "main" || payload.branchName === "master") {
      throw new SandboxPolicyViolationError(
        "Coding agents cannot commit directly to main/master. Must use a feature branch.",
        "DIRECT_COMMIT_TO_MAIN_BLOCKED",
        { branchName: payload.branchName },
      );
    }

    const desc = payload.prDescription;
    if (
      !desc.thinkingPath?.trim() ||
      !desc.whatChanged ||
      desc.whatChanged.length === 0 ||
      !desc.verification?.trim() ||
      !desc.risks?.trim() ||
      !desc.modelUsed?.trim()
    ) {
      throw new SandboxPolicyViolationError(
        "Pull Request description must include Thinking Path, What Changed, Verification, Risks, and Model Used.",
        "INVALID_PR_DESCRIPTION",
        { prDescription: desc },
      );
    }

    return {
      success: true,
      branchName: payload.branchName,
      prUrl: `https://github.com/bharath185/project_auro_opencode/pull/demo-${payload.branchName}`,
    };
  },

  /**
   * Enforces human approval gate for merging code into main branch.
   */
  mergePullRequest: (
    payload: MergeRequestPayload,
  ): { merged: boolean; message: string } => {
    if (payload.targetBranch === "main" || payload.targetBranch === "master") {
      if (!payload.approvedByHuman || !payload.approverUserId) {
        throw new SandboxPolicyViolationError(
          `Merge to ${payload.targetBranch} requires explicit human board approval.`,
          "HUMAN_APPROVAL_REQUIRED_FOR_MERGE",
          { targetBranch: payload.targetBranch },
        );
      }
    }

    return {
      merged: true,
      message: `Branch ${payload.branchName} merged into ${payload.targetBranch} with approval from ${payload.approverUserId}.`,
    };
  },
};
