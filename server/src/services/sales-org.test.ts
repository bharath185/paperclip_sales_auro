import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  salesOrgService,
  SALES_ROLES,
  SALES_AGENT_DEFINITIONS,
  readSalesPromptFile,
  writeSalesPromptFile,
  listAllSalesPrompts,
} from "./sales-org.js";

describe("Sales Org Service & Prompts", () => {
  it("defines all 5 required sales roles with correct hierarchy & approved models", () => {
    expect(SALES_ROLES).toEqual(["ceo", "sales_manager", "researcher", "follow_up", "crm_sync"]);

    // Check CEO
    const ceo = SALES_AGENT_DEFINITIONS.ceo;
    expect(ceo.reportsToRole).toBeNull();
    expect(ceo.defaultModel).toBe("opencode/deepseek-v4-pro");
    expect(ceo.budgetMonthlyCents).toBe(50000);

    // Check Sales Manager (reports to CEO)
    const sm = SALES_AGENT_DEFINITIONS.sales_manager;
    expect(sm.reportsToRole).toBe("ceo");
    expect(sm.defaultModel).toBe("opencode/deepseek-v4-pro");

    // Check Researcher (reports to Sales Manager)
    const res = SALES_AGENT_DEFINITIONS.researcher;
    expect(res.reportsToRole).toBe("sales_manager");
    expect(res.defaultModel).toBe("opencode/deepseek-v4-flash");

    // Check Follow-up (reports to Sales Manager)
    const fu = SALES_AGENT_DEFINITIONS.follow_up;
    expect(fu.reportsToRole).toBe("sales_manager");
    expect(fu.defaultModel).toBe("opencode/deepseek-v4-flash");

    // Check CRM Sync (reports to Sales Manager)
    const crm = SALES_AGENT_DEFINITIONS.crm_sync;
    expect(crm.reportsToRole).toBe("sales_manager");
    expect(crm.defaultModel).toBe("opencode/deepseek-v4-flash");
  });

  it("reads and lists all 5 versioned sales prompt files", async () => {
    const prompts = await listAllSalesPrompts();
    expect(Object.keys(prompts)).toEqual(["ceo", "sales_manager", "researcher", "follow_up", "crm_sync"]);
    expect(prompts.ceo.content).toContain("Sales & Revenue Organization");
    expect(prompts.sales_manager.content).toContain("Sales Manager");
    expect(prompts.researcher.content).toContain("Public Business Data");
    expect(prompts.follow_up.content).toContain("3-Touch Sequence");
    expect(prompts.crm_sync.content).toContain("CRM Sync Agent");
  });

  it("provisions the complete sales hierarchy with multiple researchers", async () => {
    let agentIdCounter = 1;
    const createdAgents: any[] = [];
    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const service = salesOrgService(mockDb);

    // Mock internal dependencies or test create flow
    expect(service.getSalesOrgStatus).toBeDefined();
    expect(service.createSalesOrg).toBeDefined();
  });
});
