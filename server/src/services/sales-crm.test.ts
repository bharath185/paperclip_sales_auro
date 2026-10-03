import { describe, it, expect, vi } from 'vitest';
import {
  createCrmConnector,
  HubSpotConnector,
  GenericWebhookConnector,
  CsvExportConnector,
  maskSecret,
  generateLeadIdempotencyKey,
  executeWithRetry,
  encryptCrmCredentials,
  decryptCrmCredentials,
  rotateCrmMasterKey,
  resolveCrmMasterKey,
} from './sales-crm.js';
import type { LeadRecord } from './sales-research.js';

describe('Sales CRM Service & Connectors', () => {
  const sampleLead: LeadRecord = {
    id: 'lead-blr-001',
    companyId: 'comp-101',
    campaignId: 'camp-001',
    companyName: 'Precision Dynamics Pvt Ltd',
    website: 'https://precisiondynamics.in',
    domain: 'precisiondynamics.in',
    companyDomain: 'precisiondynamics.in',
    industry: 'Manufacturing',
    subSegment: 'Auto Components',
    location: 'Bengaluru',
    locationCity: 'Bengaluru',
    companySize: '100-250',
    decisionMakerName: 'Rajesh Kumar',
    decisionMakerTitle: 'VP of Manufacturing Operations',
    contactName: 'Rajesh Kumar',
    contactTitle: 'VP of Manufacturing Operations',
    email: 'rajesh.kumar@precisiondynamics.in',
    contactEmail: 'rajesh.kumar@precisiondynamics.in',
    phone: '+91 80 2839 4001',
    contactPhone: '+91 80 2839 4001',
    sourceUrl: 'https://precisiondynamics.in/about',
    discoveredAt: '2026-10-02T10:00:00Z',
    score: 85,
    leadScore: 85,
    status: 'discovered',
    verificationStatus: 'verified',
    crmStage: 'new',
    dataSource: 'bengaluru_industrial_fixture',
    createdAt: '2026-10-02T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z'
  };

  describe('Secret Masking, Encryption at Rest & Key Rotation', () => {
    const testMasterKey = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const newMasterKey = 'f9e8d7c6b5a4039281706f5e4d3c2b1a0f9e8d7c6b5a4039281706f5e4d3c2b1';

    it('masks secrets securely for logs and never emits raw tokens', () => {
      const sensitiveToken = 'pat-eu1-123456789-abcdef';
      const masked = maskSecret(sensitiveToken);
      expect(masked).toBe('pat-...cdef');
      expect(masked).not.toContain('123456789');
      expect(maskSecret('short')).toBe('****');
      expect(maskSecret(undefined)).toBe('***');
    });

    it('scans connector DTO representation and verifies secret tokens are not leaked', () => {
      const config = {
        provider: 'hubspot' as const,
        apiKey: 'super-secret-hubspot-token-9999',
        isMock: true,
      };
      const serialized = JSON.stringify({
        provider: config.provider,
        maskedApiKey: maskSecret(config.apiKey),
        isMock: config.isMock,
      });

      expect(serialized).not.toContain('super-secret-hubspot-token-9999');
      expect(serialized).toContain('supe...9999');
    });

    it('encrypts CRM credentials reversibly using AES-256-GCM authenticated encryption', () => {
      const plainApiKey = 'mock_hubspot_api_token_val_abcdef123456';
      const encrypted = encryptCrmCredentials(plainApiKey, testMasterKey);

      expect(encrypted.scheme).toBe('aes-256-gcm');
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toHaveLength(24); // 12 bytes hex
      expect(encrypted.tag).toHaveLength(32); // 16 bytes hex
      expect(encrypted.ciphertext).not.toContain(plainApiKey);

      const decrypted = decryptCrmCredentials(encrypted, testMasterKey);
      expect(decrypted).toBe(plainApiKey);
    });

    it('rotates master key and re-encrypts CRM secrets successfully', () => {
      const plainApiKey = 'webhook_hmac_secret_key_prod_99';
      const encryptedV1 = encryptCrmCredentials(plainApiKey, testMasterKey);

      const encryptedV2 = rotateCrmMasterKey(encryptedV1, testMasterKey, newMasterKey);
      expect(encryptedV2.ciphertext).not.toBe(encryptedV1.ciphertext);

      const decryptedV2 = decryptCrmCredentials(encryptedV2, newMasterKey);
      expect(decryptedV2).toBe(plainApiKey);

      // Decrypting with old key fails on auth tag mismatch
      expect(() => decryptCrmCredentials(encryptedV2, testMasterKey)).toThrow();
    });

    it('fails safely with clear error message when master encryption key is missing', () => {
      const savedEnv = process.env.PAPERCLIP_SECRETS_MASTER_KEY;
      const savedAppEnv = process.env.APP_ENCRYPTION_KEY;
      delete process.env.PAPERCLIP_SECRETS_MASTER_KEY;
      delete process.env.APP_ENCRYPTION_KEY;

      try {
        expect(() => resolveCrmMasterKey()).toThrow('Master encryption key is missing');
      } finally {
        if (savedEnv) process.env.PAPERCLIP_SECRETS_MASTER_KEY = savedEnv;
        if (savedAppEnv) process.env.APP_ENCRYPTION_KEY = savedAppEnv;
      }
    });
  });

  describe('Deterministic Idempotency Key & Deduplication', () => {
    it('generates reproducible SHA-256 hash across identical contact emails', () => {
      const key1 = generateLeadIdempotencyKey(sampleLead);
      const key2 = generateLeadIdempotencyKey({
        ...sampleLead,
        contactEmail: '  RAJESH.KUMAR@precisiondynamics.in  '
      });
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64);
    });

    it('guarantees idempotent upsert with identical externalId on repeated syncs', async () => {
      const connector = new HubSpotConnector({ provider: 'hubspot', isMock: true });
      const firstSync = await connector.upsertLead(sampleLead);
      const secondSync = await connector.upsertLead(sampleLead);

      expect(firstSync.success).toBe(true);
      expect(secondSync.success).toBe(true);
      expect(firstSync.externalId).toBe(secondSync.externalId);
      expect(firstSync.idempotencyKey).toBe(secondSync.idempotencyKey);
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

  describe('Per-Lead Sync Status & Error Log', () => {
    it('records syncState and error log when sync fails', async () => {
      const connector = new HubSpotConnector({
        provider: 'hubspot',
        apiKey: 'invalid-key',
        isMock: false
      });

      // Mock global fetch to reject
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as any);

      try {
        const result = await connector.upsertLead(sampleLead);
        expect(result.success).toBe(false);
        expect(result.message).toContain('Unauthorized');

        const status = await connector.getSyncStatus(sampleLead.id);
        expect(status).not.toBeNull();
        expect(status?.syncState).toBe('failed');
        expect(status?.errorLog).toBeDefined();
        expect(status?.errorLog?.length).toBeGreaterThan(0);
        expect(status?.errorLog?.[0].error).toContain('Unauthorized');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Generic Webhook & CSV Connectors', () => {
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
