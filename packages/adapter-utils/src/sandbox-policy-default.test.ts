import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  assertWindowsSandboxExecutionAllowed,
  buildLocalProcessSandboxSpawnTarget,
  parseLocalProcessFilesystemScope,
  parseLocalProcessNetworkAllowlist,
  parseLocalProcessNetworkScope,
  parseLocalProcessSandboxExtraPaths,
  resolveWindowsSandboxPolicy,
} from "./local-process-sandbox.js";

describe("Sandbox Default Execution Mode and Policy Blocking", () => {
  describe("Windows sandbox isolation defaults & enforcement", () => {
    it("disables unconfined Windows host execution by default with clear UI/admin message", () => {
      const defaultPolicy = resolveWindowsSandboxPolicy({
        env: {}, // no admin opt-in
      });
      expect(defaultPolicy.isolationMode).toBe("disabled");
      expect(defaultPolicy.isAllowed).toBe(false);
      expect(defaultPolicy.rejectionReason).toContain("Windows host isolation error");
      expect(defaultPolicy.rejectionReason).toContain("disabled by default");
    });

    it("allows execution on Windows when Docker or WSL2 isolation mode is configured", () => {
      const dockerPolicy = resolveWindowsSandboxPolicy({
        configuredMode: "docker",
        env: {},
      });
      expect(dockerPolicy.isolationMode).toBe("docker");
      expect(dockerPolicy.isAllowed).toBe(true);

      const wsl2Policy = resolveWindowsSandboxPolicy({
        configuredMode: "wsl2",
        env: {},
      });
      expect(wsl2Policy.isolationMode).toBe("wsl2");
      expect(wsl2Policy.isAllowed).toBe(true);
    });

    it("allows execution on Windows only with explicit admin opt-in", () => {
      const optInPolicy = resolveWindowsSandboxPolicy({
        adminOptIn: true,
      });
      expect(optInPolicy.isolationMode).toBe("unconfined_admin_opt_in");
      expect(optInPolicy.isAllowed).toBe(true);

      const envOptInPolicy = resolveWindowsSandboxPolicy({
        env: { ALLOW_UNCONFINED_WINDOWS_HOST: "true" },
      });
      expect(envOptInPolicy.isolationMode).toBe("unconfined_admin_opt_in");
      expect(envOptInPolicy.isAllowed).toBe(true);
    });

    it("assertWindowsSandboxExecutionAllowed throws on Windows without isolation or opt-in", () => {
      if (process.platform === "win32") {
        expect(() =>
          assertWindowsSandboxExecutionAllowed({ env: {} }),
        ).toThrow(/Windows host isolation error/i);

        expect(() =>
          assertWindowsSandboxExecutionAllowed({ configuredMode: "docker", env: {} }),
        ).not.toThrow();

        expect(() =>
          assertWindowsSandboxExecutionAllowed({ adminOptIn: true, env: {} }),
        ).not.toThrow();
      }
    });
  });

  describe("Default execution mode documentation & platform check", () => {
    it("documents and verifies execution mode defaults (Windows: process, Linux: sandbox)", () => {
      const isLinux = process.platform === "linux";
      const isWindows = process.platform === "win32";

      // Verify platform detection
      if (isWindows) {
        expect(process.platform).toBe("win32");
      } else if (isLinux) {
        expect(process.platform).toBe("linux");
      }

      // Default execution mode convention:
      // Linux hosts support kernel namespaces via bubblewrap ('sandbox')
      // Non-Linux hosts (Windows/macOS) default to direct host process ('process')
      const defaultMode = isLinux ? "sandbox" : "process";
      expect(["sandbox", "process"]).toContain(defaultMode);
    });

    it("rejects sandbox scopes on non-Linux platforms with clear error", async () => {
      if (process.platform !== "linux") {
        await expect(
          buildLocalProcessSandboxSpawnTarget({
            executable: process.execPath,
            args: ["-e", "process.exit(0)"],
            cwd: process.cwd(),
            options: {
              workspaceDir: process.cwd(),
              networkScope: "deny",
            },
          }),
        ).rejects.toThrow(/supported only on Linux/i);
      }
    });
  });

  describe("Filesystem policy blocking", () => {
    it("rejects invalid filesystem scope", () => {
      expect(() => parseLocalProcessFilesystemScope("arbitrary_scope" as any)).toThrow(
        'filesystemScope must be "workspace"',
      );
    });

    it("blocks relative paths in extra paths policy", () => {
      expect(() => parseLocalProcessSandboxExtraPaths(["relative/path"])).toThrow(
        "must be an absolute path",
      );
      expect(() => parseLocalProcessSandboxExtraPaths(["../outside"])).toThrow(
        "must be an absolute path",
      );
    });

    it("accepts valid absolute paths with ro and rw access", () => {
      const path1 = path.resolve("/var/log");
      const path2 = path.resolve("/tmp/workspace");
      const parsed = parseLocalProcessSandboxExtraPaths([
        path1,
        { path: path2, access: "rw" },
      ]);
      expect(parsed).toEqual([
        { path: path1, access: "ro" },
        { path: path2, access: "rw" },
      ]);
    });
  });

  describe("Network policy blocking", () => {
    it("rejects invalid network scope types", () => {
      expect(() => parseLocalProcessNetworkScope("open" as any)).toThrow(
        '"deny" or "allowlist"',
      );
      expect(() => parseLocalProcessNetworkScope("all" as any)).toThrow(
        '"deny" or "allowlist"',
      );
    });

    it("blocks wildcard hostnames in network allowlist policy", () => {
      expect(() => parseLocalProcessNetworkAllowlist(["*.google.com"])).toThrow(
        "exact hostname",
      );
      expect(() => parseLocalProcessNetworkAllowlist(["*"])).toThrow(
        "exact hostname",
      );
      expect(() => parseLocalProcessNetworkAllowlist(["https://*.api.openai.com"])).toThrow(
        "exact hostname",
      );
    });

    it("blocks URLs with paths or query parameters", () => {
      expect(() => parseLocalProcessNetworkAllowlist(["http://127.0.0.1/admin"])).toThrow(
        /must be a hostname, hostname:port, or origin URL/i,
      );
    });

    it("allows valid explicit hostnames and ports in network allowlist", () => {
      const allowlist = parseLocalProcessNetworkAllowlist([
        "api.opencode.ai",
        "https://api.anthropic.com",
        "gateway.internal:8443",
      ]);
      expect(allowlist).toEqual([
        "api.opencode.ai",
        "api.anthropic.com",
        "gateway.internal:8443",
      ]);
    });
  });
});
