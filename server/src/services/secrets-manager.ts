/**
 * Unified Cryptographic Secrets Service
 * 
 * Provides AES-256-GCM authenticated encryption, key rotation, and secret masking
 * across all system credentials (OpenCode provider keys, CRM API keys, SMTP credentials, Webhook secrets).
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export interface EncryptedSecret {
  scheme: "aes-256-gcm";
  ciphertext: string;
  iv: string; // 12 bytes hex
  tag: string; // 16 bytes hex
  version?: number;
}

export interface StoredSecretRecord {
  id: string;
  category: "provider_key" | "crm_credentials" | "email_credentials" | "webhook_secret";
  encryptedSecret: EncryptedSecret;
  updatedAt: string;
}

/**
 * Resolves the 32-byte master encryption key from environment or explicit override.
 */
export function resolveAppEncryptionKey(overrideKey?: Buffer | string): Buffer {
  if (overrideKey) {
    if (Buffer.isBuffer(overrideKey)) return overrideKey;
    if (overrideKey.length === 64 && /^[0-9a-fA-F]+$/.test(overrideKey)) {
      return Buffer.from(overrideKey, "hex");
    }
    return Buffer.from(overrideKey.padEnd(32, "0").slice(0, 32), "utf8");
  }

  const fromEnv = process.env.APP_ENCRYPTION_KEY || process.env.PAPERCLIP_SECRETS_MASTER_KEY;
  if (!fromEnv || fromEnv.trim().length === 0) {
    throw new Error(
      "Master encryption key is missing (set APP_ENCRYPTION_KEY or PAPERCLIP_SECRETS_MASTER_KEY in environment)"
    );
  }

  const trimmed = fromEnv.trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed.padEnd(32, "0").slice(0, 32), "utf8");
}

/**
 * Encrypts sensitive secret using AES-256-GCM authenticated encryption.
 */
export function encryptSecret(plaintext: string, masterKey?: Buffer | string): EncryptedSecret {
  if (!plaintext || plaintext.trim().length === 0) {
    throw new Error("Cannot encrypt empty secret");
  }

  const key = resolveAppEncryptionKey(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    scheme: "aes-256-gcm",
    ciphertext,
    iv: iv.toString("hex"),
    tag,
    version: 1,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 */
export function decryptSecret(secret: EncryptedSecret, masterKey?: Buffer | string): string {
  if (!secret?.ciphertext || !secret?.iv || !secret?.tag) {
    throw new Error("Invalid encrypted secret payload: missing ciphertext, iv, or auth tag");
  }

  const key = resolveAppEncryptionKey(masterKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "hex"));
  decipher.setAuthTag(Buffer.from(secret.tag, "hex"));

  let decrypted = decipher.update(secret.ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Rotates an individual secret from an old master key to a new master key.
 */
export function rotateSecret(
  secret: EncryptedSecret,
  oldMasterKey: Buffer | string,
  newMasterKey: Buffer | string
): EncryptedSecret {
  const plain = decryptSecret(secret, oldMasterKey);
  return encryptSecret(plain, newMasterKey);
}

/**
 * Batch rotates all stored secret records (OpenCode keys, CRM credentials, email credentials).
 */
export function rotateAllStoredSecrets(
  records: StoredSecretRecord[],
  oldMasterKey: Buffer | string,
  newMasterKey: Buffer | string
): { rotatedRecords: StoredSecretRecord[]; count: number } {
  const rotatedRecords: StoredSecretRecord[] = records.map((rec) => {
    const rotated = rotateSecret(rec.encryptedSecret, oldMasterKey, newMasterKey);
    return {
      ...rec,
      encryptedSecret: rotated,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    rotatedRecords,
    count: rotatedRecords.length,
  };
}

/**
 * Masks sensitive tokens for logs and client responses (e.g. "sk-l...9999").
 */
export function maskSecret(secret?: string): string {
  if (!secret) return "***";
  if (secret.length <= 8) return "****";
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
}
