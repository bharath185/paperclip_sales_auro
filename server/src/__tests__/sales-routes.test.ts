import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { salesRoutes } from '../routes/sales';
import { errorHandler } from '../middleware/index.js';

describe('Sales REST Routes & RBAC Isolation', () => {
  let app: express.Express;
  let mockDb: any;
  const companyId = 'comp-auro-001';

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const sampleAgents = [
      { id: 'agent-1', companyId, name: 'CEO', role: 'ceo', title: 'Chief Executive Officer', reportsTo: null, status: 'idle', budgetMonthlyCents: 50000 },
      { id: 'agent-2', companyId, name: 'Sales Manager', role: 'sales_manager', title: 'Head of Outbound', reportsTo: 'agent-1', status: 'idle', budgetMonthlyCents: 35000 },
      { id: 'agent-3', companyId, name: 'Researcher 1', role: 'researcher_1', title: 'Researcher', reportsTo: 'agent-2', status: 'idle', budgetMonthlyCents: 20000 },
      { id: 'agent-4', companyId, name: 'Follow-up Specialist', role: 'follow_up', title: 'Follow-up Specialist', reportsTo: 'agent-2', status: 'idle', budgetMonthlyCents: 20000 },
      { id: 'agent-5', companyId, name: 'CRM Sync Specialist', role: 'crm_sync', title: 'CRM Sync Specialist', reportsTo: 'agent-2', status: 'idle', budgetMonthlyCents: 20000 },
    ];

    mockDb = {
      query: {
        agents: {
          findFirst: vi.fn().mockImplementation(() => Promise.resolve({ id: 'agent-1', companyId, status: 'idle' })),
          findMany: vi.fn().mockResolvedValue(sampleAgents),
        },
        companies: {
          findFirst: vi.fn().mockResolvedValue({ id: companyId, name: 'Auro Labs' }),
        },
      },
      select: vi.fn().mockImplementation((fields: any) => ({
        from: vi.fn().mockImplementation((table: any) => ({
          where: vi.fn().mockImplementation(() => {
            const isProj = fields?.id || (table && table._ && table._.name === 'projects');
            const data = isProj
              ? [{ id: 'proj-1', companyId, name: 'Sales & Lead Generation' }]
              : sampleAgents;
            const p: any = Promise.resolve(data);
            p.orderBy = vi.fn().mockResolvedValue(data);
            p.groupBy = vi.fn().mockResolvedValue([]);
            return p;
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })),
      })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val: any) => ({
          returning: vi.fn().mockResolvedValue([{ id: 'agent-1', companyId, ...(Array.isArray(val) ? val[0] : val) }]),
        })),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
      transaction: vi.fn().mockImplementation((cb: any) => cb(mockDb)),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'agent-1', companyId }]),
          }),
        }),
      }),
    };

    app.use((req: any, res: any, next: any) => {
      req.companyId = companyId;
      req.actor = {
        type: 'board',
        userId: 'user-001',
        source: req.path.includes('comp-foreign-999') ? 'session' : 'local_implicit',
        companyIds: [companyId],
        isInstanceAdmin: false,
      };
      next();
    });

    app.use('/api', salesRoutes(mockDb));
    app.use(errorHandler);
  });

  const validBrief = {
    name: 'Bengaluru CNC Manufacturers Q4',
    industry: 'Manufacturing',
    subSegment: 'Auto Components',
    location: 'Bengaluru',
    targetTitles: ['VP of Manufacturing Operations', 'Plant Head'],
    offerProposition: 'AI-driven computer vision quality inspection',
    dailyLeadQuota: 20,
    weeklyLeadQuota: 100,
    researcherInstances: 2,
    isDemo: true,
  };

  describe('Organization Provisioning', () => {
    it('provisions 5 sales roles for the target company', async () => {
      const res = await request(app)
        .post(`/api/companies/${companyId}/sales/org/provision`)
        .send();

      expect(res.status).toBe(201);
      expect(res.body.agents.length).toBeGreaterThanOrEqual(5);
      expect(res.body.agents.map((a: any) => a.role)).toEqual(
        expect.arrayContaining(['ceo', 'sales_manager', 'follow_up', 'crm_sync'])
      );
    });

    it('denies cross-company org provisioning (tenant isolation)', async () => {
      const res = await request(app)
        .post('/api/companies/comp-foreign-999/sales/org/provision')
        .send();

      expect(res.status).toBe(403);
    });
  });

  describe('Prompt Management', () => {
    it('lists sales role prompts', async () => {
      const res = await request(app)
        .get(`/api/companies/${companyId}/sales/prompts`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(5);
    });

    it('updates a specific sales role prompt', async () => {
      const res = await request(app)
        .put(`/api/companies/${companyId}/sales/prompts/sales_manager`)
        .send({ content: 'Updated custom system prompt for Sales Manager.' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('sales_manager');
      expect(res.body.content).toBe('Updated custom system prompt for Sales Manager.');
      expect(res.body.version).toBeGreaterThanOrEqual(2);
    });

    it('rejects invalid sales role prompt update', async () => {
      const res = await request(app)
        .put(`/api/companies/${companyId}/sales/prompts/invalid_role`)
        .send({ content: 'test' });

      expect(res.status).toBe(422);
    });
  });

  describe('Campaign Lifecycle & Pipeline', () => {
    let createdCampaignId: string;

    it('creates a new campaign brief and rejects invalid fields', async () => {
      const badRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns`)
        .send({ name: 'Incomplete Brief' });
      expect(badRes.status).toBe(400);

      const res = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns`)
        .send(validBrief);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(validBrief.name);
      createdCampaignId = res.body.id;
    });

    it('lists and retrieves campaigns with tenant isolation', async () => {
      const createRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns`)
        .send(validBrief);
      const campId = createRes.body.id;

      const listRes = await request(app)
        .get(`/api/companies/${companyId}/sales/campaigns`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);

      const getRes = await request(app)
        .get(`/api/companies/${companyId}/sales/campaigns/${campId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(campId);

      // Foreign company tenant isolation
      const foreignRes = await request(app)
        .get(`/api/companies/comp-foreign-999/sales/campaigns/${campId}`);
      expect(foreignRes.status).toBe(403);
    });

    it('executes research stage and retrieves discovered leads', async () => {
      const createRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns`)
        .send(validBrief);
      const campId = createRes.body.id;

      const researchRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns/${campId}/research`)
        .send();

      expect(researchRes.status).toBe(200);
      expect(researchRes.body.count).toBeGreaterThan(0);

      const leadsRes = await request(app)
        .get(`/api/companies/${companyId}/sales/campaigns/${campId}/leads`);
      expect(leadsRes.status).toBe(200);
      expect(leadsRes.body.length).toBeGreaterThan(0);
    });

    it('manages human approval batches', async () => {
      const createRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns`)
        .send(validBrief);
      const campId = createRes.body.id;

      await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns/${campId}/research`)
        .send();

      const batchesRes = await request(app)
        .get(`/api/companies/${companyId}/sales/campaigns/${campId}/approvals`);
      expect(batchesRes.status).toBe(200);
      expect(batchesRes.body.length).toBeGreaterThan(0);

      const batch = batchesRes.body[0];
      const leadIdsToApprove = [batch.leads[0].id];

      const approveRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns/${campId}/approvals/${batch.id}`)
        .send({ approvedLeadIds: leadIdsToApprove });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBeDefined();
    });

    it('generates 3-touch sequence', async () => {
      const createRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns`)
        .send(validBrief);
      const campId = createRes.body.id;

      const seqRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns/${campId}/sequence`)
        .send();

      expect(seqRes.status).toBe(200);
      expect(seqRes.body.steps).toHaveLength(3);
    });

    it('syncs leads to CRM', async () => {
      const createRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns`)
        .send(validBrief);
      const campId = createRes.body.id;

      await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns/${campId}/research`)
        .send();

      const syncRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns/${campId}/crm-sync`)
        .send({ crmConfig: { provider: 'hubspot', isMock: true } });

      expect(syncRes.status).toBe(200);
      expect(syncRes.body.synced).toBeGreaterThan(0);
    });

    it('exports leads to CSV', async () => {
      const createRes = await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns`)
        .send(validBrief);
      const campId = createRes.body.id;

      await request(app)
        .post(`/api/companies/${companyId}/sales/campaigns/${campId}/research`)
        .send();

      const csvRes = await request(app)
        .get(`/api/companies/${companyId}/sales/campaigns/${campId}/export-csv`);

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('Lead ID,Company Name');
    });
  });

  describe('Hot Leads & Positive Replies', () => {
    it('ingests hot lead event and lists for company', async () => {
      const postRes = await request(app)
        .post(`/api/companies/${companyId}/sales/hot-leads`)
        .send({
          campaignId: 'camp-001',
          leadId: 'lead-blr-001',
          companyName: 'Precision Dynamics Pvt Ltd',
          contactName: 'Rajesh Kumar',
          contactEmail: 'rajesh.kumar@precisiondynamics.in',
          replySnippet: 'We would like to see a demo next Tuesday.',
          sentiment: 'meeting_requested',
        });

      expect(postRes.status).toBe(201);
      expect(postRes.body.id).toBeDefined();

      const listRes = await request(app)
        .get(`/api/companies/${companyId}/sales/hot-leads`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBeGreaterThan(0);
    });
  });

  describe('Global Email Suppression', () => {
    it('adds email to suppression list and returns SHA-256 hash', async () => {
      const addRes = await request(app)
        .post(`/api/companies/${companyId}/sales/suppressions`)
        .send({ email: 'unsubscribe.user@example.com' });

      expect(addRes.status).toBe(201);
      expect(addRes.body.emailHash).toHaveLength(64);

      const listRes = await request(app)
        .get(`/api/companies/${companyId}/sales/suppressions`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.suppressions).toContain(addRes.body.emailHash);
    });
  });
});
