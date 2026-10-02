import { describe, it, expect } from "vitest";
import {
  GOVERNANCE_DOCUMENT_KINDS,
  GOVERNANCE_DOC_DEFINITIONS,
  validateGovernanceDocument,
  generateGovernanceDocumentPack,
  type GovernanceProjectContext,
} from "./governance-documents.js";

describe("Governance Document Pack & Validators", () => {
  const sampleContext: GovernanceProjectContext = {
    projectName: "Project Auro NextGen",
    problem: "Need autonomous AI agent project kickoff, governance, and document pack generation.",
    targetUsers: "Enterprise development teams and project leads",
    goals: "Ship complete 12-document governance pack with cross-reviews and zero errors.",
    constraints: "Must use OpenCode approved models with full audit logging.",
    budget: "$60,000",
    deadline: "2026-11-30",
    preferredStack: "React, Node.js, TypeScript, PostgreSQL",
    integrations: "GitHub, Slack, Jira",
    teamSize: "6 engineers",
    teamSkills: "TypeScript, Architecture, Security Auditing, QA Automation",
    isDemo: false,
  };

  it("defines exactly 12 governance document kinds", () => {
    expect(GOVERNANCE_DOCUMENT_KINDS.length).toBe(12);
    expect(GOVERNANCE_DOCUMENT_KINDS).toEqual([
      "charter",
      "prd",
      "architecture",
      "tech_stack",
      "db_openapi",
      "execution_plan",
      "sprint_plan",
      "team_allocation",
      "test_strategy",
      "cicd_infra",
      "threat_model",
      "risk_raci",
    ]);
  });

  it("generates templates for all 12 documents and all pass section validation", () => {
    const pack = generateGovernanceDocumentPack(sampleContext);
    
    for (const kind of GOVERNANCE_DOCUMENT_KINDS) {
      const doc = pack[kind];
      expect(doc).toBeDefined();
      expect(doc.content).toContain(sampleContext.projectName);
      expect(doc.title).toBe(GOVERNANCE_DOC_DEFINITIONS[kind].title);
      expect(doc.fileName).toBe(GOVERNANCE_DOC_DEFINITIONS[kind].fileName);
      expect(doc.authorRole).toBe(GOVERNANCE_DOC_DEFINITIONS[kind].authorRole);

      const validation = validateGovernanceDocument(kind, doc.content);
      expect(validation.valid).toBe(true);
      expect(validation.missingSections).toEqual([]);
      expect(validation.foundSections.length).toBeGreaterThanOrEqual(
        GOVERNANCE_DOC_DEFINITIONS[kind].requiredSections.length,
      );
    }
  });

  it("labels generated output with Demo notice when isDemo is true", () => {
    const demoPack = generateGovernanceDocumentPack({
      ...sampleContext,
      isDemo: true,
    });
    for (const kind of GOVERNANCE_DOCUMENT_KINDS) {
      expect(demoPack[kind].content).toContain("Notice: Generated in Demo Mode");
    }
  });

  it("rejects incomplete PRD when required sections are missing", () => {
    const incompletePrd = `# Product Requirements Document
## Product Overview
This is an overview.
`;
    const result = validateGovernanceDocument("prd", incompletePrd);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain("User Journeys & Use Cases");
    expect(result.missingSections).toContain("Functional Requirements");
    expect(result.missingSections).toContain("Non-Functional Requirements");
    expect(result.missingSections).toContain("Acceptance Criteria");
  });

  it("rejects incomplete Architecture document when ADRs or diagrams are missing", () => {
    const incompleteArch = `# Architecture
## Architecture Overview
System overview here.
`;
    const result = validateGovernanceDocument("architecture", incompleteArch);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain("System Component Diagram (Mermaid)");
    expect(result.missingSections).toContain("Architectural Decision Records (ADRs)");
  });

  it("rejects incomplete Threat Model when STRIDE analysis is missing", () => {
    const incompleteThreat = `# Threat Model
## Security Controls & Mitigations
Controls here.
`;
    const result = validateGovernanceDocument("threat_model", incompleteThreat);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain("STRIDE Threat Analysis");
  });

  it("rejects invalid/unknown document kind", () => {
    const result = validateGovernanceDocument("unknown_kind" as any, "# Test");
    expect(result.valid).toBe(false);
    expect(result.missingSections[0]).toContain("Unknown document kind");
  });
});
