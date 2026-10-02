import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatKickoffBriefMarkdown,
  type ProjectKickoffBrief,
} from "./governance-orchestration.js";

describe("Governance Orchestration Service", () => {
  const sampleBrief: ProjectKickoffBrief = {
    projectName: "Autonomous AI Cloud",
    problem: "Need zero-human-intervention cloud infrastructure management",
    targetUsers: "DevOps Engineers and Platform Architects",
    goals: "Auto-provision, auto-scale, and self-heal Kubernetes workloads",
    constraints: "Strict budget of $50k and SOC2 compliance",
    budget: 50000,
    deadline: "2026-Q4",
    preferredStack: "TypeScript, Go, Kubernetes, Terraform",
    integrations: "AWS, Datadog, PagerDuty",
    teamSizeAndSkills: "1 Architect, 2 Systems Engineers",
    attachments: "https://docs.example.com/spec.pdf",
  };

  it("formats kickoff brief markdown with all sections", () => {
    const markdown = formatKickoffBriefMarkdown(sampleBrief);

    expect(markdown).toContain("# Project Kickoff Brief: Autonomous AI Cloud");
    expect(markdown).toContain("## 1. Problem Statement");
    expect(markdown).toContain("Need zero-human-intervention cloud infrastructure management");
    expect(markdown).toContain("## 2. Target Users & Audience");
    expect(markdown).toContain("DevOps Engineers and Platform Architects");
    expect(markdown).toContain("## 3. Goals & Key Deliverables");
    expect(markdown).toContain("Auto-provision, auto-scale, and self-heal Kubernetes workloads");
    expect(markdown).toContain("## 4. Constraints & Boundaries");
    expect(markdown).toContain("Strict budget of $50k and SOC2 compliance");
    expect(markdown).toContain("## 5. Budget & Resources");
    expect(markdown).toContain("$50000");
    expect(markdown).toContain("2026-Q4");
    expect(markdown).toContain("## 6. Technical Stack & Integrations");
    expect(markdown).toContain("TypeScript, Go, Kubernetes, Terraform");
    expect(markdown).toContain("AWS, Datadog, PagerDuty");
    expect(markdown).toContain("## 7. Manual Team & Skills");
    expect(markdown).toContain("1 Architect, 2 Systems Engineers");
    expect(markdown).toContain("## 8. Attachments & References");
    expect(markdown).toContain("https://docs.example.com/spec.pdf");
  });
});
