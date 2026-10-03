import { describe, it, expect } from "vitest";
import {
  encryptCrmCredentials,
  decryptCrmCredentials,
  rotateCrmMasterKey,
  resolveCrmMasterKey,
} from "./sales-crm.js";

describe("APP_ENCRYPTION_KEY Rotation & Missing Key Safety Gate", () => {
  const v1Key = "1111111111111111111111111111111111111111111111111111111111111111"; // 32 bytes hex
  const v2Key = "2222222222222222222222222222222222222222222222222222222222222222"; // 32 bytes hex

  it("rotates stored credentials from v1 key to v2 key without data loss", () => {
    const secrets = [
      { id: "opencode-provider-key", plain: "sk-live-opencode-secret-token-9999" },
      { id: "hubspot-crm-key", plain: "pat-live-hubspot-api-token-8888" },
      { id: "sales-webhook-hmac", plain: "webhook_secret_signing_key_7777" },
    ];

    // 1. Encrypt with V1 Key
    const v1Encrypted = secrets.map((s) => ({
      id: s.id,
      plain: s.plain,
      encrypted: encryptCrmCredentials(s.plain, v1Key),
    }));

    // Verify V1 decryption
    for (const item of v1Encrypted) {
      expect(decryptCrmCredentials(item.encrypted, v1Key)).toBe(item.plain);
    }

    // 2. Perform Key Rotation to V2
    const v2Encrypted = v1Encrypted.map((item) => ({
      id: item.id,
      plain: item.plain,
      encrypted: rotateCrmMasterKey(item.encrypted, v1Key, v2Key),
    }));

    // 3. Verify V2 decryption succeeds and V1 key fails
    for (const item of v2Encrypted) {
      expect(decryptCrmCredentials(item.encrypted, v2Key)).toBe(item.plain);
      expect(() => decryptCrmCredentials(item.encrypted, v1Key)).toThrow();
    }
  });

  it("safely throws a clear diagnostic error when encryption key is missing", () => {
    const prevEnv1 = process.env.APP_ENCRYPTION_KEY;
    const prevEnv2 = process.env.PAPERCLIP_SECRETS_MASTER_KEY;

    delete process.env.APP_ENCRYPTION_KEY;
    delete process.env.PAPERCLIP_SECRETS_MASTER_KEY;

    try {
      expect(() => resolveCrmMasterKey()).toThrow(
        /Master encryption key is missing/
      );
    } finally {
      if (prevEnv1) process.env.APP_ENCRYPTION_KEY = prevEnv1;
      if (prevEnv2) process.env.PAPERCLIP_SECRETS_MASTER_KEY = prevEnv2;
    }
  });
});
