import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { governanceRoutes } from "../routes/governance.js";
import {
  GOVERNANCE_AGENT_DEFINITIONS,
  GOVERNANCE_ROLES,
} from "../services/governance-org.js";

import { errorHandler } from "../middleware/index.js";

// Mock DB and services for isolated route contract testing
describe("Governance Routes & Orchestration Flow", () => {
  let app: express.Express;
  const companyId = "company-governance-test-123";

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Middleware to simulate authenticated company context
    app.use((req, _res, next) => {
      req.companyId = companyId;
      req.actor = { type: "board", userId: "user-1" };
      next();
    });
    // Mount governance routes
    app.use(governanceRoutes({} as any));
    app.use(errorHandler);
  });

  it("GET /governance/prompts returns all 6 role prompts", async () => {
    const res = await request(app).get("/governance/prompts");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["ceo", "cto", "pm", "qa", "devops", "security"]);
    expect(res.body.ceo.title).toBe("Chief Executive Officer");
    expect(res.body.cto.title).toBe("Chief Technology Officer");
    expect(res.body.pm.title).toBe("Product Manager");
    expect(res.body.qa.title).toBe("Quality Assurance Lead");
    expect(res.body.devops.title).toBe("DevOps Engineer");
    expect(res.body.security.title).toBe("Security Officer");
  });

  it("GET /governance/prompts/:role returns single role prompt", async () => {
    const res = await request(app).get("/governance/prompts/cto");
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("cto");
    expect(res.body.content).toContain("Chief Technology Officer");
  });

  it("PUT /governance/prompts/:role validates non-empty prompt content", async () => {
    const originalPromptRes = await request(app).get("/governance/prompts/qa");
    const originalContent = originalPromptRes.body.content;

    try {
      const emptyRes = await request(app)
        .put("/governance/prompts/qa")
        .send({ content: "" });
      expect(emptyRes.status).toBe(400);

      const validRes = await request(app)
        .put("/governance/prompts/qa")
        .send({ content: "# QA System Prompt\nUpdated test plan strategy." });
      expect(validRes.status).toBe(200);
      expect(validRes.body.success).toBe(true);
      expect(validRes.body.role).toBe("qa");
    } finally {
      // Restore original prompt content
      if (originalContent) {
        await request(app)
          .put("/governance/prompts/qa")
          .send({ content: originalContent });
      }
    }
  });

  it("POST /companies/:companyId/governance/kickoff validates required brief fields", async () => {
    const res = await request(app)
      .post(`/companies/${companyId}/governance/kickoff`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
