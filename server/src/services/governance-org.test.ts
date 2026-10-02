import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GOVERNANCE_ROLES,
  GOVERNANCE_AGENT_DEFINITIONS,
  readGovernancePromptFile,
  writeGovernancePromptFile,
  listAllGovernancePrompts,
} from "./governance-org.js";

describe("Governance Org Service & Prompts", () => {
  it("defines all 6 required governance roles with reporting lines", () => {
    expect(GOVERNANCE_ROLES).toEqual(["ceo", "cto", "pm", "qa", "devops", "security"]);

    const ceo = GOVERNANCE_AGENT_DEFINITIONS.ceo;
    expect(ceo.reportsToRole).toBeNull();
    expect(ceo.defaultModel).toContain("opencode/");
    expect(ceo.budgetMonthlyCents).toBeGreaterThan(0);

    const reports = ["cto", "pm", "qa", "devops", "security"] as const;
    for (const role of reports) {
      const def = GOVERNANCE_AGENT_DEFINITIONS[role];
      expect(def.reportsToRole).toBe("ceo");
      expect(def.defaultModel).toContain("opencode/");
      expect(def.budgetMonthlyCents).toBeGreaterThan(0);
      expect(def.permissions).toBeDefined();
    }
  });

  it("reads and lists all 6 versioned governance prompt files", async () => {
    const prompts = await listAllGovernancePrompts();
    expect(Object.keys(prompts)).toEqual(["ceo", "cto", "pm", "qa", "devops", "security"]);

    for (const role of GOVERNANCE_ROLES) {
      const prompt = prompts[role];
      expect(prompt.role).toBe(role);
      expect(prompt.title).toBeTruthy();
      expect(prompt.content.length).toBeGreaterThan(50);
      expect(prompt.content).toContain(GOVERNANCE_AGENT_DEFINITIONS[role].title);
    }
  });

  it("reads role-specific system prompt contents accurately", async () => {
    const ceoPrompt = await readGovernancePromptFile("ceo");
    expect(ceoPrompt).toContain("Chief Executive Officer");
    expect(ceoPrompt).toContain("Strategic Decomposition");

    const ctoPrompt = await readGovernancePromptFile("cto");
    expect(ctoPrompt).toContain("Chief Technology Officer");
    expect(ctoPrompt).toContain("ARCHITECTURE.md");

    const pmPrompt = await readGovernancePromptFile("pm");
    expect(pmPrompt).toContain("Product Manager");
    expect(pmPrompt).toContain("PRD.md");

    const qaPrompt = await readGovernancePromptFile("qa");
    expect(qaPrompt).toContain("Quality Assurance Lead");
    expect(qaPrompt).toContain("TEST_PLAN.md");

    const devopsPrompt = await readGovernancePromptFile("devops");
    expect(devopsPrompt).toContain("DevOps");
    expect(devopsPrompt).toContain("INFRA_SPEC.md");

    const secPrompt = await readGovernancePromptFile("security");
    expect(secPrompt).toContain("Security");
    expect(secPrompt).toContain("THREAT_MODEL.md");
  });
});
