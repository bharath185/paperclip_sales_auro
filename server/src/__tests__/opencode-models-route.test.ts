import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { agentRoutes } from "../routes/agents.js";

vi.mock("../routes/authz.js", () => ({
  assertCompanyAccess: vi.fn(),
  assertBoard: vi.fn(),
  assertAdmin: vi.fn(),
  assertAgentKeyMatch: vi.fn(),
  assertCanRunAsAgent: vi.fn(),
  getAccessibleResource: vi.fn((_req, _res, resource) => resource),
}));

describe("OpenCode & Adapter Models Route (server/src/routes/agents.ts:3236)", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const mockDb: any = {};
    app.use("/api", agentRoutes(mockDb));
  });

  it("lists adapter models from GET /api/companies/:companyId/adapters/:type/models", async () => {
    const res = await request(app).get("/api/companies/comp-1/adapters/opencode_local/models");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const modelIds = res.body.map((m: any) => m.id);
    expect(modelIds).toContain("opencode/deepseek-v4-pro");
    expect(modelIds).toContain("opencode/kimi-k2.7-code");
    expect(modelIds).toContain("opencode/deepseek-v4-flash");
  });

  it("forces live sync/refresh with ?refresh=true", async () => {
    const res = await request(app).get("/api/companies/comp-1/adapters/opencode_local/models?refresh=true");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const modelIds = res.body.map((m: any) => m.id);
    expect(modelIds).toContain("opencode/deepseek-v4-pro");
    expect(modelIds).toContain("opencode/kimi-k2.7-code");
    expect(modelIds).toContain("opencode/deepseek-v4-flash");
  });
});
