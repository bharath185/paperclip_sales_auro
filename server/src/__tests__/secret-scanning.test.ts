import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".git" ||
        entry.name === "coverage"
      ) {
        continue;
      }
      results.push(...findFiles(fullPath, extensions));
    } else if (entry.isFile()) {
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

describe("Secret Scanning & Credential Safety Gate", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const scanDirs = [
    path.join(rootDir, "server/src"),
    path.join(rootDir, "packages"),
    path.join(rootDir, "ui/src"),
  ];

  const candidateFiles = scanDirs.flatMap((dir) =>
    findFiles(dir, [".ts", ".tsx", ".js", ".json", ".yaml", ".yml"])
  );

  const SECRET_PATTERNS = [
    {
      name: "AWS Access Key ID",
      regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    },
    {
      name: "Private Key Block",
      regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}\r?\n-----END/g,
    },
    {
      name: "OpenAI / Anthropic Live Secret Key",
      regex: /sk-(?:live|ant)-[a-zA-Z0-9]{32,}/g,
    },
    {
      name: "GitHub Personal Access Token",
      regex: /ghp_[a-zA-Z0-9]{36}/g,
    },
    {
      name: "Slack Bot Token",
      regex: /xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}/g,
    },
  ];

  it("ensures no live credentials or private keys are hardcoded in source files", () => {
    const findings: { file: string; patternName: string; match: string }[] = [];

    for (const file of candidateFiles) {
      // Exclude test files, mock fixtures, and markdown docs
      if (
        file.includes(".test.") ||
        file.includes(".spec.") ||
        file.includes("fixtures") ||
        file.includes("__tests__")
      ) {
        continue;
      }

      const content = fs.readFileSync(file, "utf-8");
      for (const pattern of SECRET_PATTERNS) {
        const matches = content.match(pattern.regex);
        if (matches) {
          for (const match of matches) {
            findings.push({
              file: path.relative(rootDir, file),
              patternName: pattern.name,
              match: match.substring(0, 10) + "...",
            });
          }
        }
      }
    }

    if (findings.length > 0) {
      console.log("Secret scan findings:", JSON.stringify(findings, null, 2));
    }
    expect(findings).toHaveLength(0);
  });
});
