// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import React from "react";
import { TeamAssignmentView } from "./TeamAssignmentView";
import { governanceApi } from "@/api/governance";

vi.mock("@/api/governance", () => ({
  governanceApi: {
    getTeamState: vi.fn(),
    convertSprintToTickets: vi.fn(),
    assignTicket: vi.fn(),
    getTeamExportUrl: vi.fn().mockReturnValue("/api/companies/company-1/governance/team/export"),
  },
}));

describe("TeamAssignmentView Component", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  const mockTeamState = {
    companyId: "company-1",
    members: [
      {
        id: "mem-1",
        name: "Alice Morgan",
        email: "alice@example.com",
        role: "Lead Full-Stack Engineer",
        primarySkills: ["TypeScript", "React", "Node.js"],
        weeklyCapacityHours: 40,
        assignedHours: 16,
      },
      {
        id: "mem-2",
        name: "Bob Chen",
        email: "bob@example.com",
        role: "Backend & Systems Engineer",
        primarySkills: ["Go", "PostgreSQL", "Docker"],
        weeklyCapacityHours: 40,
        assignedHours: 48, // overloaded
      },
    ],
    tickets: [
      {
        id: "tkt-1",
        storyId: "STORY-101",
        summary: "Setup PostgreSQL Schema and Migrations",
        epic: "Foundation",
        storyPoints: 5,
        estimatedHours: 16,
        assigneeMemberId: "mem-1",
        assigneeName: "Alice Morgan",
        status: "in_progress" as const,
        requiredSkills: ["PostgreSQL", "Node.js"],
      },
      {
        id: "tkt-2",
        storyId: "STORY-102",
        summary: "Build Authentication & RBAC API",
        epic: "Security",
        storyPoints: 8,
        estimatedHours: 24,
        assigneeMemberId: null,
        assigneeName: null,
        status: "backlog" as const,
        requiredSkills: ["TypeScript", "Security"],
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  it("renders team roster, utilization badges, and tickets", async () => {
    vi.mocked(governanceApi.getTeamState).mockResolvedValueOnce(mockTeamState);

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<TeamAssignmentView companyId="company-1" />);
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Alice Morgan");
      expect(container.textContent).toContain("Bob Chen");
      expect(container.textContent).toContain("40% Capacity");
      expect(container.textContent).toContain("100% Capacity");
      expect(container.textContent).toContain("STORY-101");
      expect(container.textContent).toContain("Setup PostgreSQL Schema and Migrations");
      expect(container.textContent).toContain("STORY-102");
      expect(container.textContent).toContain("Build Authentication & RBAC API");
    });
  });

  it("converts sprint stories to tickets on button click", async () => {
    vi.mocked(governanceApi.getTeamState).mockResolvedValue(mockTeamState);
    vi.mocked(governanceApi.convertSprintToTickets).mockResolvedValueOnce({
      success: true,
      ticketCount: 2,
    } as any);

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<TeamAssignmentView companyId="company-1" />);
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Convert Sprint to Tickets");
    });

    const convertBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Convert Sprint to Tickets"),
    );
    expect(convertBtn).toBeDefined();

    await flushSync(async () => {
      convertBtn?.click();
    });

    await vi.waitFor(() => {
      expect(governanceApi.convertSprintToTickets).toHaveBeenCalledWith("company-1");
      expect(container.textContent).toContain("Sprint plan converted to tickets successfully!");
    });
  });

  it("allows reassigning and changing status on a ticket", async () => {
    vi.mocked(governanceApi.getTeamState).mockResolvedValue(mockTeamState);
    vi.mocked(governanceApi.assignTicket).mockResolvedValue({
      success: true,
      ticket: { ...mockTeamState.tickets[1], assigneeMemberId: "mem-2" },
    });

    const root = createRoot(container);
    await flushSync(async () => {
      root.render(<TeamAssignmentView companyId="company-1" />);
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Build Authentication & RBAC API");
    });

    const selects = container.querySelectorAll("select");
    expect(selects.length).toBe(4);

    // Change status of ticket 1
    await flushSync(async () => {
      selects[0].value = "done";
      selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(governanceApi.assignTicket).toHaveBeenCalledWith("company-1", "tkt-1", {
        status: "done",
      });
    });

    // Assign ticket 2 to Bob Chen (mem-2)
    await flushSync(async () => {
      selects[3].value = "mem-2";
      selects[3].dispatchEvent(new Event("change", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(governanceApi.assignTicket).toHaveBeenCalledWith("company-1", "tkt-2", {
        assigneeMemberId: "mem-2",
      });
    });
  });
});
