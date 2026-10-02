// @vitest-environment jsdom

import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectKickoffWizard } from "./ProjectKickoffWizard";
import { governanceApi } from "@/api/governance";

vi.mock("@/api/governance", () => ({
  governanceApi: {
    submitKickoff: vi.fn(),
  },
}));

function setNativeValue(element: HTMLElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    (element as any).value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("ProjectKickoffWizard Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;
  const companyId = "company-auro-test";

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      flushSync(() => {
        root!.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  it("renders all required kickoff form fields", () => {
    flushSync(() => {
      root!.render(<ProjectKickoffWizard companyId={companyId} />);
    });

    expect(container!.textContent).toContain("Project Kickoff Wizard");
    expect(container!.querySelector("#projectName")).not.toBeNull();
    expect(container!.querySelector("#problem")).not.toBeNull();
    expect(container!.querySelector("#targetUsers")).not.toBeNull();
    expect(container!.querySelector("#goals")).not.toBeNull();
    expect(container!.querySelector("#budget")).not.toBeNull();
    expect(container!.querySelector("#deadline")).not.toBeNull();
    expect(container!.querySelector("#constraints")).not.toBeNull();
    expect(container!.querySelector("#preferredStack")).not.toBeNull();
    expect(container!.querySelector("#integrations")).not.toBeNull();
    expect(container!.querySelector("#teamSizeAndSkills")).not.toBeNull();
    expect(container!.querySelector("#attachments")).not.toBeNull();
    expect(container!.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it("shows validation error when required fields are empty", async () => {
    flushSync(() => {
      root!.render(<ProjectKickoffWizard companyId={companyId} />);
    });

    const form = container!.querySelector("form");
    expect(form).not.toBeNull();

    flushSync(() => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container!.textContent).toContain("Project Name is required.");
    expect(governanceApi.submitKickoff).not.toHaveBeenCalled();
  });

  it("submits kickoff brief and displays orchestrated results", async () => {
    const mockResponse: any = {
      goalId: "goal-123",
      kickoffIssueId: "issue-456",
      ceoAgentId: "agent-ceo",
      projectName: "Auro Governance Engine",
      executionMode: "demo" as const,
      documents: {},
      workstreams: [
        {
          role: "pm",
          taskTitle: "[PM] Author PRD & User Stories",
          issueId: "issue-pm-1",
          status: "done",
          documents: [
            {
              kind: "prd",
              title: "Product Requirements Document",
              fileName: "PRD.md",
              authorRole: "pm",
              content: "PRD content",
              isValid: true,
              missingSections: [],
            },
          ],
          reviews: ["QA Review: Verified"],
        },
        {
          role: "cto",
          taskTitle: "[CTO] Technical Architecture & ADRs",
          issueId: "issue-cto-1",
          status: "done",
          documents: [
            {
              kind: "architecture",
              title: "System Architecture Specification",
              fileName: "ARCHITECTURE.md",
              authorRole: "cto",
              content: "Architecture content",
              isValid: true,
              missingSections: [],
            },
          ],
          reviews: ["Security Review: Approved"],
        },
      ],
      projectPackSummary: {
        kind: "summary",
        title: "Project Pack Executive Summary",
        fileName: "PROJECT_PACK_SUMMARY.md",
        authorRole: "ceo",
        content: "Executive summary details",
        isValid: true,
        missingSections: [],
      },
      status: "in_review" as const,
    };

    vi.mocked(governanceApi.submitKickoff).mockResolvedValue(mockResponse);

    flushSync(() => {
      root!.render(<ProjectKickoffWizard companyId={companyId} />);
    });

    const projectNameInput = container!.querySelector<HTMLInputElement>("#projectName");
    const problemInput = container!.querySelector<HTMLTextAreaElement>("#problem");
    const targetUsersInput = container!.querySelector<HTMLTextAreaElement>("#targetUsers");
    const goalsInput = container!.querySelector<HTMLTextAreaElement>("#goals");

    flushSync(() => {
      setNativeValue(projectNameInput!, "Auro Governance Engine");
      setNativeValue(problemInput!, "Need autonomous governance orchestration");
      setNativeValue(targetUsersInput!, "Developers and Engineering Leadership");
      setNativeValue(goalsInput!, "Ship PRD, Architecture, Threat Model, and Test Plan");
    });

    const form = container!.querySelector("form");
    flushSync(() => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await vi.waitFor(() => {
      expect(governanceApi.submitKickoff).toHaveBeenCalledWith(
        companyId,
        expect.objectContaining({
          projectName: "Auro Governance Engine",
          problem: "Need autonomous governance orchestration",
          targetUsers: "Developers and Engineering Leadership",
          goals: "Ship PRD, Architecture, Threat Model, and Test Plan",
        }),
      );
    });

    await vi.waitFor(() => {
      expect(container!.textContent).toContain("Project Kickoff Orchestrated Successfully");
      expect(container!.textContent).toContain("goal-123");
      expect(container!.textContent).toContain("issue-456");
      expect(container!.textContent).toContain("PRD.md");
    });
  });
});
