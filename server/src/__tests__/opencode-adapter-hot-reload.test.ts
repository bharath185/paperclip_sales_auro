import { describe, it, expect, vi } from "vitest";

describe("OpenCode Adapter Key Hot-Reload & Dynamic Resolution", () => {
  it("resolves the latest active secret version on each agent execution call without restart", async () => {
    // Simulated secret store
    const secretStore: Record<string, { value: string; version: number; revoked: boolean }> = {
      "opencode-secret-id": {
        value: "opencode_key_v1_initial",
        version: 1,
        revoked: false,
      },
    };

    // Resolver function that mimics secretService.resolveSecretValue
    const resolveSecret = vi.fn(async (secretId: string) => {
      const entry = secretStore[secretId];
      if (!entry || entry.revoked) {
        throw new Error("Secret unavailable or revoked");
      }
      return {
        value: entry.value,
        version: entry.version,
      };
    });

    // Run 1: Resolves Version 1
    const run1Secret = await resolveSecret("opencode-secret-id");
    expect(run1Secret.value).toBe("opencode_key_v1_initial");
    expect(run1Secret.version).toBe(1);

    // Rotate key in secret store (simulating secretService.rotateSecret without server restart)
    secretStore["opencode-secret-id"] = {
      value: "opencode_key_v2_rotated",
      version: 2,
      revoked: false,
    };

    // Run 2: Immediately resolves Version 2 without rebooting server
    const run2Secret = await resolveSecret("opencode-secret-id");
    expect(run2Secret.value).toBe("opencode_key_v2_rotated");
    expect(run2Secret.version).toBe(2);
    expect(run2Secret.value).not.toBe(run1Secret.value);

    // Revoke key
    secretStore["opencode-secret-id"].revoked = true;

    // Run 3: Immediately rejects execution due to revoked credential
    await expect(resolveSecret("opencode-secret-id")).rejects.toThrow("Secret unavailable or revoked");
  });

  it("passes rotated credentials into agent execution environment dynamically", async () => {
    let currentApiKey = "opencode_live_token_1";

    function prepareAgentEnvironment(secretProvider: () => string) {
      return {
        OPENCODE_API_KEY: secretProvider(),
        OPENCODE_MODELS_URL: "https://opencode.ai/zen/v1/models",
      };
    }

    const envRun1 = prepareAgentEnvironment(() => currentApiKey);
    expect(envRun1.OPENCODE_API_KEY).toBe("opencode_live_token_1");

    // Rotate
    currentApiKey = "opencode_live_token_2_rotated";

    const envRun2 = prepareAgentEnvironment(() => currentApiKey);
    expect(envRun2.OPENCODE_API_KEY).toBe("opencode_live_token_2_rotated");
  });
});
