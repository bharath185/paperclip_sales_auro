import { describe, it, expect, beforeEach } from 'vitest';
import { SalesCampaignService, type CampaignBrief } from './sales-campaign';

describe('Sales Campaign Orchestration Service', () => {
  let service: SalesCampaignService;

  beforeEach(() => {
    service = new SalesCampaignService();
  });

  const validBrief: CampaignBrief = {
    companyId: 'comp-auro-001',
    name: 'Bengaluru Auto CNC Outbound Q4',
    industry: 'Manufacturing',
    subSegment: 'Auto Components',
    location: 'Bengaluru',
    targetTitles: ['VP of Manufacturing Operations', 'Plant Head', 'Director of Engineering'],
    offerProposition: 'AI-driven predictive quality control reducing scrap rate by 34%',
    dailyLeadQuota: 25,
    weeklyLeadQuota: 100,
    researcherInstances: 2,
    isDemo: true,
    complianceSettings: {
      dryRunDefault: true,
      requireHumanApproval: true,
      postalAddress: 'Peenya Industrial Area, Bengaluru, Karnataka 560058',
      dailyLimit: 25
    }
  };

  it('creates and retrieves a campaign brief with company scoping', async () => {
    const campaign = await service.createCampaign(validBrief);
    expect(campaign.id).toBeDefined();
    expect(campaign.status).toBe('draft');
    expect(campaign.brief.researcherInstances).toBe(2);

    const fetched = await service.getCampaign('comp-auro-001', campaign.id);
    expect(fetched?.name).toBe('Bengaluru Auto CNC Outbound Q4');

    // Tenant isolation: foreign company cannot access
    const foreignFetched = await service.getCampaign('comp-foreign-999', campaign.id);
    expect(foreignFetched).toBeNull();
  });

  it('executes the research stage, deduplicates leads, and generates approval batches', async () => {
    const campaign = await service.createCampaign(validBrief);
    const leads = await service.executeResearchStage('comp-auro-001', campaign.id);

    expect(leads.length).toBeGreaterThan(0);
    expect(leads[0].location).toContain('Bengaluru');
    expect(leads[0].score).toBeGreaterThanOrEqual(0);

    const batches = await service.listApprovalBatches('comp-auro-001', campaign.id);
    expect(batches.length).toBe(1);
    expect(batches[0].status).toBe('pending');
    expect(batches[0].leads.length).toBe(leads.length);
  });

  it('supports human batch review and approval gates', async () => {
    const campaign = await service.createCampaign(validBrief);
    const leads = await service.executeResearchStage('comp-auro-001', campaign.id);
    const batches = await service.listApprovalBatches('comp-auro-001', campaign.id);
    const batchId = batches[0].id;

    const approvedIds = [leads[0].id];
    const approvedBatch = await service.approveLeadBatch(
      'comp-auro-001',
      campaign.id,
      batchId,
      approvedIds,
      'user-sales-mgr-01'
    );

    expect(approvedBatch.status).toBe(leads.length === 1 ? 'approved' : 'partially_approved');
    expect(approvedBatch.decidedBy).toBe('user-sales-mgr-01');

    const updatedCampaign = await service.getCampaign('comp-auro-001', campaign.id);
    expect(updatedCampaign?.stats.leadsApproved).toBe(1);
  });

  it('generates a 3-touch sequence tailored for the campaign', async () => {
    const campaign = await service.createCampaign(validBrief);
    const sequence = await service.generateCampaignSequence('comp-auro-001', campaign.id);

    expect(sequence.steps.length).toBe(3);
    expect(sequence.steps[0].subjectTemplate).toContain('operations');
    expect(sequence.steps[0].bodyTemplate).toContain('{{contact_name}}');
  });

  it('syncs leads idempotently to CRM', async () => {
    const campaign = await service.createCampaign(validBrief);
    await service.executeResearchStage('comp-auro-001', campaign.id);

    const { synced, results } = await service.syncLeadsToCrm('comp-auro-001', campaign.id, {
      provider: 'hubspot',
      isMock: true
    });

    expect(synced).toBeGreaterThan(0);
    expect(results[0].success).toBe(true);
    expect(results[0].provider).toBe('hubspot');
  });

  it('records hot lead positive replies and alerts human team', async () => {
    const campaign = await service.createCampaign(validBrief);
    const hotLead = await service.recordHotLead({
      companyId: 'comp-auro-001',
      campaignId: campaign.id,
      leadId: 'lead-001',
      companyName: 'Precision Dynamics Pvt Ltd',
      contactName: 'Rajesh Kumar',
      contactEmail: 'rajesh.kumar@precisiondynamics.in',
      replySnippet: 'Hi, this sounds interesting. Can you do a demo this Thursday at 3 PM?',
      sentiment: 'meeting_requested'
    });

    expect(hotLead.id).toBeDefined();
    expect(hotLead.notifiedHuman).toBe(true);

    const hotLeads = await service.getHotLeads('comp-auro-001');
    expect(hotLeads.length).toBe(1);
    expect(hotLeads[0].sentiment).toBe('meeting_requested');
  });

  it('maintains deterministic SHA-256 global email suppression', async () => {
    const res = await service.addSuppression('OptOut@Example.com');
    expect(res.success).toBe(true);

    const isSuppressed = await service.isSuppressed('optout@example.com');
    expect(isSuppressed).toBe(true);

    const notSuppressed = await service.isSuppressed('active@example.com');
    expect(notSuppressed).toBe(false);
  });
});
