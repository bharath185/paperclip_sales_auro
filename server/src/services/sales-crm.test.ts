import { describe, it, expect, vi } from 'vitest';
import {
  createCrmConnector,
  HubSpotConnector,
  GenericWebhookConnector,
  CsvExportConnector,
  maskSecret,
  generateLeadIdempotencyKey,
  executeWithRetry
} from './sales-crm';
import type { LeadRecord } from './sales-research';

describe('Sales CRM Service & Connectors', () => {
  const sampleLead: LeadRecord = {
    id: 'lead-blr-001',
    companyId: 'comp-101',
    companyName: 'Precision Dynamics Pvt Ltd',
    companyDomain: 'precisiondynamics.in',
    industry: 'Manufacturing',
    subSegment: 'Auto Components',
    locationCity: 'Bengaluru',
    contactName: 'Rajesh Kumar',
    contactTitle: 'VP of Manufacturing Operations',
    contactEmail: 'rajesh.kumar@precisiondynamics.in',
    contactPhone: '+91 80 2839 4001',
    leadScore: 85,
    verificationStatus: 'verified',
    crmStage: 'new',
    dataSource: 'bengaluru_industrial_fixture',
    createdAt: '2026-10-02T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z'
  };

  describe('Secret Masking', () => {
    it('masks secrets securely for logs', () => {
      expect(maskSecret('pat-eu1-123456789-abcdef')).toBe('pat-...cdef');
      expect(maskSecret('short')).toBe('****');
      expect(maskSecret(undefined)).toBe('***');
    });
  });

  describe('Deterministic Idempotency Key', () => {
    it('generates reproducible SHA-256 hash across identical contact emails', () => {
      const key1 = generateLeadIdempotencyKey(sampleLead);
      const key2 = generateLeadIdempotencyKey({
        ...sampleLead,
        contactEmail: '  RAJESH.KUMAR@precisiondynamics.in  '
      });
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64);
    });
  });

  describe('Retry with Exponential Backoff', () => {
    it('succeeds after transient failures', async () => {
      let callCount = 0;
      const unstableOperation = async () => {
        callCount++;
        if (callCount < 3) {
          const err: any = new Error('503 Service Unavailable');
          err.statusCode = 503;
          throw err;
        }
        return 'success';
      };

      const { result, attempts } = await executeWithRetry(unstableOperation, {
        maxRetries: 3,
        initialDelayMs: 10
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('fails fast on non-retryable 4xx client errors', async () => {
      let callCount = 0;
      const badRequestOperation = async () => {
        callCount++;
        const err: any = new Error('400 Bad Request');
        err.statusCode = 400;
        throw err;
      };

      await expect(executeWithRetry(badRequestOperation, { maxRetries: 3, initialDelayMs: 10 }))
        .rejects.toThrow('400 Bad Request');
      expect(callCount).toBe(1);
    });
  });

  describe('HubSpot Connector', () => {
    it('upserts a lead in mock mode and tracks sync status', async () => {
      const connector = new HubSpotConnector({
        provider: 'hubspot',
        apiKey: 'mock-key',
        isMock: true
      });

      const result = await connector.upsertLead(sampleLead);
      expect(result.success).toBe(true);
      expect(result.provider).toBe('hubspot');
      expect(result.externalId).toMatch(/^hs_/);

      const status = await connector.getSyncStatus(sampleLead.id);
      expect(status).not.toBeNull();
      expect(status?.stage).toBe('new');

      const stageResult = await connector.updateStage(sampleLead.id, 'contacted');
      expect(stageResult.success).toBe(true);
      const updatedStatus = await connector.getSyncStatus(sampleLead.id);
      expect(updatedStatus?.stage).toBe('contacted');
    });

    it('attaches timeline events to the lead', async () => {
      const connector = new HubSpotConnector({ provider: 'hubspot', isMock: true });
      const timelineResult = await connector.attachTimeline(sampleLead.id, {
        eventType: 'email_sent',
        timestamp: '2026-10-02T12:00:00Z',
        title: 'Initial Outreach Sent',
        description: 'Sent email Touch 1 to Rajesh Kumar'
      });
      expect(timelineResult.success).toBe(true);
    });
  });

  describe('Generic Webhook Connector', () => {
    it('executes mock webhook payload delivery with idempotency header', async () => {
      const connector = new GenericWebhookConnector({
        provider: 'generic_webhook',
        endpointUrl: 'https://crm.internal.example.com/api/v1/leads',
        isMock: true
      });

      const result = await connector.upsertLead(sampleLead);
      expect(result.success).toBe(true);
      expect(result.provider).toBe('generic_webhook');
      expect(result.externalId).toMatch(/^webhook_/);

      const status = await connector.getSyncStatus(sampleLead.id);
      expect(status?.provider).toBe('generic_webhook');
    });
  });

  describe('CSV Export Connector', () => {
    it('formats lead dataset into well-formed CSV with header and escaping', async () => {
      const connector = new CsvExportConnector();
      await connector.upsertLead(sampleLead);

      const csv = connector.exportCsvString();
      expect(csv).toContain('Lead ID,Company Name,Domain,Contact Name');
      expect(csv).toContain('"Precision Dynamics Pvt Ltd"');
      expect(csv).toContain('"rajesh.kumar@precisiondynamics.in"');
      expect(csv).toContain('"Manufacturing"');
    });
  });

  describe('Connector Factory', () => {
    it('instantiates appropriate connector by type', () => {
      expect(createCrmConnector({ provider: 'hubspot', isMock: true })).toBeInstanceOf(HubSpotConnector);
      expect(createCrmConnector({ provider: 'generic_webhook', isMock: true })).toBeInstanceOf(GenericWebhookConnector);
      expect(createCrmConnector({ provider: 'csv_export' })).toBeInstanceOf(CsvExportConnector);
    });
  });
});
