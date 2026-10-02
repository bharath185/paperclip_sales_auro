import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { governanceRoutes } from "../routes/governance.js";
import { errorHandler } from "../middleware/index.js";

describe("Governance Routes & Document Center API", () => {
  let app: express.Express;
  const companyId = "company-governance-test-123";

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.companyId = companyId;
      req.actor = { type: "board", userId: "user-1", source: "local_implicit", companyIds: [companyId] };
      next();
    });
    app.use(governanceRoutes({} as any));
    app.use(errorHandler);
  });

  it("GET /governance/prompts returns all 6 role prompts", async () => {
    const res = await request(app).get("/governance/prompts");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["ceo", "cto", "pm", "qa", "devops", "security"]);
    expect(res.body.ceo.title).toBe("Chief Executive Officer");
    expect(res.body.cto.title).toBe("Chief Technology Officer");
  });

  it("GET /governance/prompts/:role returns single role prompt", async () => {
    const res = await request(app).get("/governance/prompts/cto");
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("cto");
    expect(res.body.content).toContain("Chief Technology Officer");
  });

  it("PUT /governance/prompts/:role validates prompt updates", async () => {
    const emptyRes = await request(app)
      .put("/governance/prompts/qa")
      .send({ content: "" });
    expect(emptyRes.status).toBe(400);

    const validRes = await request(app)
      .put("/governance/prompts/qa")
      .send({ content: "# QA Lead System Prompt\n\nQuality Assurance Lead prompt." });
    expect(validRes.status).toBe(200);
    expect(validRes.body.success).toBe(true);
  });

  it("GET /governance/documents lists all 12 documents with validation status", async () => {
    const res = await request(app).get("/governance/documents");
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBe(12);
    expect(res.body.packStatus).toBe("in_review");

    for (const doc of res.body.documents) {
      expect(doc.kind).toBeDefined();
      expect(doc.title).toBeDefined();
      expect(doc.isValid).toBe(true);
      expect(doc.currentVersion).toBeGreaterThanOrEqual(1);
    }
  });

  it("GET /governance/documents/:kind returns specific document details and versions", async () => {
    const res = await request(app).get("/governance/documents/prd");
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("prd");
    expect(res.body.title).toBe("Product Requirements Document (PRD)");
    expect(res.body.content).toContain("Product Overview");
    expect(res.body.versions.length).toBeGreaterThanOrEqual(1);
  });

  it("PUT /governance/documents/:kind creates new version and checks required sections", async () => {
    // Valid update with all sections
    const validContent = `# Product Requirements Document
## Product Overview
Updated product vision.
## User Journeys & Use Cases
1. User logs in.
## Functional Requirements
- FR-1: Core feature.
## Non-Functional Requirements
- High availability.
## Acceptance Criteria
- [ ] 100% test pass.
`;
    const res = await request(app)
      .put("/governance/documents/prd")
      .send({ content: validContent, changeSummary: "Added new user journey" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.version).toBe(2);
    expect(res.body.isValid).toBe(true);

    // Update missing required sections
    const incompleteContent = `# Product Requirements Document\n## Product Overview\nOnly overview here.`;
    const invalidRes = await request(app)
      .put("/governance/documents/prd")
      .send({ content: incompleteContent, changeSummary: "Incomplete draft" });

    expect(invalidRes.status).toBe(200);
    expect(invalidRes.body.isValid).toBe(false);
    expect(invalidRes.body.missingSections.length).toBeGreaterThan(0);
  });

  it("POST /governance/documents/:kind/review posts agent reviews", async () => {
    const res = await request(app)
      .post("/governance/documents/prd/review")
      .send({
        reviewerRole: "qa",
        status: "approved",
        comments: "All acceptance criteria verified and approved by QA Lead.",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.review.reviewerRole).toBe("qa");
    expect(res.body.reviews.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /governance/pack/approve executes CEO approval gate", async () => {
    // 1. If pack has incomplete document, it rejects with 422
    const rejectRes = await request(app).post("/governance/pack/approve");
    expect(rejectRes.status).toBe(422);
    expect(rejectRes.body.error || rejectRes.body.message || rejectRes.text).toContain("incomplete documents");

    // 2. Restore complete PRD
    const validPrd = `# Product Requirements Document
## Product Overview
Complete product vision.
## User Journeys & Use Cases
1. User logs in.
## Functional Requirements
- FR-1: Core feature.
## Non-Functional Requirements
- High availability.
## Acceptance Criteria
- [ ] 100% test pass.
`;
    await request(app)
      .put("/governance/documents/prd")
      .send({ content: validPrd, changeSummary: "Restored valid PRD" });

    // 3. Now CEO pack approval succeeds
    const res = await request(app).post("/governance/pack/approve");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.packStatus).toBe("approved");
    expect(res.body.message).toContain("APPROVED by the CEO");
  });

  it("GET /governance/export/:format generates all export file formats", async () => {
    // 1. Combined Markdown
    const mdRes = await request(app).get("/governance/export/markdown");
    expect(mdRes.status).toBe(200);
    expect(mdRes.headers["content-type"]).toContain("text/markdown");
    expect(mdRes.text).toContain("Complete Project Governance Pack");

    // 2. ZIP archive
    const zipRes = await request(app).get("/governance/export/zip");
    expect(zipRes.status).toBe(200);
    expect(zipRes.headers["content-type"]).toContain("application/zip");
    expect(zipRes.headers["content-disposition"]).toContain("attachment");

    // 3. PDF document
    const pdfRes = await request(app).get("/governance/export/pdf");
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers["content-type"]).toContain("application/pdf");

    // 4. DOCX document
    const docxRes = await request(app).get("/governance/export/docx");
    expect(docxRes.status).toBe(200);
    expect(docxRes.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    // 5. Sprint CSV
    const csvRes = await request(app).get("/governance/export/sprint-csv");
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text).toContain("US-101");

    // 6. Jira CSV
    const jiraRes = await request(app).get("/governance/export/jira-csv");
    expect(jiraRes.status).toBe(200);
    expect(jiraRes.headers["content-type"]).toContain("text/csv");
    expect(jiraRes.text).toContain("Issue Key,Issue Type,Summary");

    // 7. Sprint XLSX
    const xlsxRes = await request(app).get("/governance/export/sprint-xlsx");
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers["content-type"]).toContain("application/vnd.ms-excel");
    expect(xlsxRes.text).toContain("<Workbook");
  });

  describe("RBAC and Company Tenant Isolation", () => {
    let rbacApp: express.Express;

    beforeEach(() => {
      rbacApp = express();
      rbacApp.use(express.json());
      rbacApp.use(governanceRoutes({} as any));
      rbacApp.use(errorHandler);
    });

    it("allows access when actor belongs to target company", async () => {
      const allowedApp = express();
      allowedApp.use(express.json());
      allowedApp.use((req, _res, next) => {
        req.companyId = companyId;
        req.actor = { type: "board", userId: "user-1", source: "session", companyIds: [companyId] };
        next();
      });
      allowedApp.use(governanceRoutes({} as any));
      allowedApp.use(errorHandler);

      const res = await request(allowedApp).get(`/companies/${companyId}/governance/documents`);
      expect(res.status).toBe(200);
      expect(res.body.documents.length).toBe(12);
    });

    it("denies access with 403 when actor belongs to a different company (cross-company isolation)", async () => {
      const otherCompanyApp = express();
      otherCompanyApp.use(express.json());
      otherCompanyApp.use((req, _res, next) => {
        req.companyId = "company-other-tenant-999";
        req.actor = { type: "board", userId: "user-2", source: "session", companyIds: ["company-other-tenant-999"] };
        next();
      });
      otherCompanyApp.use(governanceRoutes({} as any));
      otherCompanyApp.use(errorHandler);

      // Attempt to access company-governance-test-123 from other tenant actor
      const res = await request(otherCompanyApp).get(`/companies/${companyId}/governance/documents`);
      expect(res.status).toBe(403);
      expect(res.body.error || res.body.message || res.text).toContain("access");
    });

    it("denies access with 403 on document center routes for unauthorized cross-company requests", async () => {
      const unauthorizedApp = express();
      unauthorizedApp.use(express.json());
      unauthorizedApp.use((req, _res, next) => {
        req.companyId = "unauthorized-company";
        req.actor = { type: "board", userId: "unauthorized-user", source: "session", companyIds: ["unauthorized-company"] };
        next();
      });
      unauthorizedApp.use(governanceRoutes({} as any));
      unauthorizedApp.use(errorHandler);

      const docsRes = await request(unauthorizedApp).get(`/companies/${companyId}/governance/documents`);
      expect(docsRes.status).toBe(403);

      const approveRes = await request(unauthorizedApp).post(`/companies/${companyId}/governance/pack/approve`);
      expect(approveRes.status).toBe(403);
    });
  });
});
