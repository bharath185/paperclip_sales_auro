import { describe, it, expect } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  rotateSecret,
  rotateAllStoredSecrets,
  resolveAppEncryptionKey,
  type StoredSecretRecord,
} from "./secrets-manager.js";

describe("Unified Secrets Manager & Key Rotation Suite", () => {
  const v1Key = "1111111111111111111111111111111111111111111111111111111111111111"; // 32 bytes hex
  const v2Key = "2222222222222222222222222222222222222222222222222222222222222222"; // 32 bytes hex

  it("encrypts and decrypts all secret types with AES-256-GCM authenticated encryption", () => {
    const rawSecrets = [
      { id: "opencode-key", category: "provider_key" as const, plain: "sk-live-opencode-secret-token-9999" },
      { id: "hubspot-key", category: "crm_credentials" as const, plain: "pat-live-hubspot-api-token-8888" },
      { id: "smtp-pass", category: "email_credentials" as const, plain: "super-secure-smtp-app-password-7777" },
      { id: "webhook-secret", category: "webhook_secret" as const, plain: "hmac_webhook_signing_secret_6666" },
    ];

    for (const item of rawSecrets) {
      const encrypted = encryptSecret(item.plain, v1Key);
      expect(encrypted.scheme).toBe("aes-256-gcm");
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toHaveLength(24);
      expect(encrypted.tag).toHaveLength(32);
      expect(encrypted.ciphertext).not.toContain(item.plain);

      const decrypted = decryptSecret(encrypted, v1Key);
      expect(decrypted).toBe(item.plain);
    }
  });

  it("rotates stored secrets across OpenCode provider keys, CRM credentials, and email credentials", () => {
    const secretRecords: StoredSecretRecord[] = [
      {
        id: "sec-opencode",
        category: "provider_key",
        encryptedSecret: encryptSecret("sk-live-opencode-key-v1", v1Key),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sec-crm-hubspot",
        category: "crm_credentials",
        encryptedSecret: encryptSecret("pat-live-hubspot-v1", v1Key),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sec-email-smtp",
        category: "email_credentials",
        encryptedSecret: encryptSecret("smtp-password-v1", v1Key),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Batch rotate from v1Key to v2Key
    const { rotatedRecords, count } = rotateAllStoredSecrets(secretRecords, v1Key, v2Key);
    expect(count).toBe(3);

    // Verify all rotated records decrypt with v2Key
    expect(decryptSecret(rotatedRecords[0].encryptedSecret, v2Key)).toBe("sk-live-opencode-key-v1");
    expect(decryptSecret(rotatedRecords[1].encryptedSecret, v2Key)).toBe("pat-live-hubspot-v1");
    expect(decryptSecret(rotatedRecords[2].encryptedSecret, v2Key)).toBe("smtp-password-v1");

    // Verify v1Key now fails to decrypt
    expect(() => decryptSecret(rotatedRecords[0].encryptedSecret, v1Key)).toThrow();
  });

  it("safely throws a clear diagnostic error when master encryption key is missing", () => {
    const prevEnv1 = process.env.APP_ENCRYPTION_KEY;
    const prevEnv2 = process.env.PAPERCLIP_SECRETS_MASTER_KEY;

    delete process.env.APP_ENCRYPTION_KEY;
    delete process.env.PAPERCLIP_SECRETS_MASTER_KEY;

    try {
      expect(() => resolveAppEncryptionKey()).toThrow(/Master encryption key is missing/);
    } finally {
      if (prevEnv1) process.env.APP_ENCRYPTION_KEY = prevEnv1;
      if (prevEnv2) process.env.PAPERCLIP_SECRETS_MASTER_KEY = prevEnv2;
    }
  });
});
