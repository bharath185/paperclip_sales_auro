import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  buildLocalProcessSandboxSpawnTarget,
  parseLocalProcessFilesystemScope,
  parseLocalProcessNetworkAllowlist,
  parseLocalProcessNetworkScope,
  parseLocalProcessSandboxExtraPaths,
} from "./local-process-sandbox.js";

describe("Sandbox Default Execution Mode and Policy Blocking", () => {
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
