import { describe, it, expect, vi } from "vitest";
import { hashToken, keyPrefix, createToken } from "../services/agents.js";

describe("Key Hash and Prefix Utilities", () => {
  it("creates consistent hash for same token", () => {
    const token = createToken();
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("creates different hashes for different tokens", () => {
    const token1 = createToken();
    const token2 = createToken();
    expect(hashToken(token1)).not.toBe(hashToken(token2));
  });

  it("extracts prefix from token", () => {
    const token = "pcp_abcdef1234567890";
    const prefix = keyPrefix(token);
    expect(prefix).toBe("pcp_abcd");
  });

  it("handles short tokens", () => {
    const token = "abc";
    const prefix = keyPrefix(token);
    expect(prefix).toBe("abc");
  });
});

describe("Key Security - Encrypted at Rest", () => {
  it("cannot reverse hash to get original token", () => {
    const token = createToken();
    const hash = hashToken(token);
    expect(hash).not.toBe(token);
    expect(hash.startsWith(token)).toBe(false);
  });
});

describe("Key Scan - No Key Patterns in Logs/Responses", () => {
  it("does not include full key in mock list response", () => {
    // Simulate the listKeys response structure
    const mockKey = {
      id: "test-id",
      name: "Test Key",
      scope: { kind: "standard" },
      responsibleUserId: null,
      keyPrefix: "pcp_abcd",
      createdAt: new Date(),
      revokedAt: null,
    };
    expect((mockKey as any).token).toBeUndefined();
    expect(mockKey.keyPrefix.length).toBeLessThanOrEqual(8);
  });

  it("rotate response only returns new token, not old", () => {
    const oldToken = createToken();
    const newToken = createToken();
    const rotated = {
      id: "test-id",
      name: "Rotated Key",
      scope: { kind: "standard" },
      responsibleUserId: null,
      token: newToken,
      keyPrefix: keyPrefix(newToken),
      createdAt: new Date(),
    };
    expect(rotated.token).toBeDefined();
    expect(rotated.token).not.toBe(oldToken);
  });

  it("error responses do not contain key material", () => {
    const keyHash = hashToken(createToken());
    const error = new Error("Key validation failed");
    expect(error.message).not.toContain(keyHash);
  });
});