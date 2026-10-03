import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { governanceRoutes } from "../routes/governance.js";
import { salesRoutes } from "../routes/sales.js";
import { errorHandler } from "../middleware/index.js";

describe("Authorization Sweep & Cross-Company IDOR Matrix Tests", () => {
  const allowedCompanyId = "company-tenant-alpha";
  const foreignCompanyId = "company-tenant-bravo";

  let authorizedApp: express.Express;
  let unauthenticatedApp: express.Express;
  let crossCompanyAttackerApp: express.Express;

  beforeEach(() => {
    // 1. Authorized App (User has access to allowedCompanyId)
    authorizedApp = express();
    authorizedApp.use(express.json());
    authorizedApp.use((req, _res, next) => {
      req.companyId = allowedCompanyId;
      req.actor = {
        type: "board",
        userId: "user-alpha",
        source: "session",
        companyIds: [allowedCompanyId],
      };
      next();
    });
    authorizedApp.use(governanceRoutes({} as any));
    authorizedApp.use(salesRoutes({} as any));
    authorizedApp.use(errorHandler);

    // 2. Unauthenticated App (No actor or session attached)
    unauthenticatedApp = express();
    unauthenticatedApp.use(express.json());
    unauthenticatedApp.use((req, _res, next) => {
      req.actor = { type: "none" };
      next();
    });
    unauthenticatedApp.use(governanceRoutes({} as any));
    unauthenticatedApp.use(salesRoutes({} as any));
    unauthenticatedApp.use(errorHandler);

    // 3. Cross-Company Attacker App (User belongs to foreignCompanyId only, trying to access allowedCompanyId)
    crossCompanyAttackerApp = express();
    crossCompanyAttackerApp.use(express.json());
    crossCompanyAttackerApp.use((req, _res, next) => {
      req.companyId = foreignCompanyId;
      req.actor = {
        type: "board",
        userId: "user-attacker",
        source: "session",
        companyIds: [foreignCompanyId], // Has access ONLY to Bravo, not Alpha
      };
      next();
    });
    crossCompanyAttackerApp.use(governanceRoutes({} as any));
    crossCompanyAttackerApp.use(salesRoutes({} as any));
    crossCompanyAttackerApp.use(errorHandler);
  });

  describe("1. Unauthenticated Request Rejections", () => {
    it("denies unauthenticated requests to governance status and prompts", async () => {
      const res1 = await request(unauthenticatedApp).get(`/companies/${allowedCompanyId}/governance/status`);
      expect(res1.status).toBe(401);

      const res2 = await request(unauthenticatedApp).get(`/companies/${allowedCompanyId}/governance/prompts`);
      expect(res2.status).toBe(401);
    });

    it("denies unauthenticated requests to sales campaigns and leads", async () => {
      const res1 = await request(unauthenticatedApp).get(`/companies/${allowedCompanyId}/sales/campaigns`);
      expect(res1.status).toBe(401);

      const res2 = await request(unauthenticatedApp).get(`/companies/${allowedCompanyId}/sales/prompts`);
      expect(res2.status).toBe(401);

      const res3 = await request(unauthenticatedApp).get(`/companies/${allowedCompanyId}/sales/hot-leads`);
      expect(res3.status).toBe(401);
    });
  });

  describe("2. Cross-Company IDOR Defense Matrix (Tenant Isolation)", () => {
    const governanceEndpoints = [
      { method: "get", path: `/companies/${allowedCompanyId}/governance/status` },
      { method: "get", path: `/companies/${allowedCompanyId}/governance/prompts` },
      { method: "get", path: `/companies/${allowedCompanyId}/governance/documents` },
      { method: "post", path: `/companies/${allowedCompanyId}/governance/kickoff`, body: { projectName: "P", problem: "P", targetUsers: "U", goals: "G" } },
    ];

    for (const ep of governanceEndpoints) {
      it(`blocks cross-tenant access to Governance [${ep.method.toUpperCase()}] ${ep.path}`, async () => {
        const reqBuilder = (request(crossCompanyAttackerApp) as any)[ep.method](ep.path);
        if (ep.body) reqBuilder.send(ep.body);
        const res = await reqBuilder;
        expect(res.status).toBe(403);
      });
    }

    const salesEndpoints = [
      { method: "get", path: `/companies/${allowedCompanyId}/sales/prompts` },
      { method: "get", path: `/companies/${allowedCompanyId}/sales/campaigns` },
      { method: "post", path: `/companies/${allowedCompanyId}/sales/campaigns`, body: { name: "C", industry: "M", location: "B", targetTitles: ["VP"], offerProposition: "V" } },
      { method: "get", path: `/companies/${allowedCompanyId}/sales/hot-leads` },
      { method: "get", path: `/companies/${allowedCompanyId}/sales/suppressions` },
    ];

    for (const ep of salesEndpoints) {
      it(`blocks cross-tenant access to Sales [${ep.method.toUpperCase()}] ${ep.path}`, async () => {
        const reqBuilder = (request(crossCompanyAttackerApp) as any)[ep.method](ep.path);
        if (ep.body) reqBuilder.send(ep.body);
        const res = await reqBuilder;
        expect(res.status).toBe(403);
      });
    }
  });

  describe("3. Authorized Same-Tenant Access", () => {
    it("allows authorized operator to access their own company resources", async () => {
      const govRes = await request(authorizedApp).get(`/companies/${allowedCompanyId}/governance/prompts`);
      expect(govRes.status).toBe(200);

      const salesRes = await request(authorizedApp).get(`/companies/${allowedCompanyId}/sales/prompts`);
      expect(salesRes.status).toBe(200);
    });
  });
});
