#!/usr/bin/env node

/**
 * Master Runner for Auro OpenCode Live Smoke Testing
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

console.log("\n=======================================================");
console.log("   AURO OPENCODE - LIVE SMOKE & INTEGRATION PROBE");
console.log("=======================================================\n");

const apiKey = process.env.OPENCODE_API_KEY;
if (apiKey) {
  console.log(`[CONFIG] OPENCODE_API_KEY detected (${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)})`);
} else {
  console.log("[CONFIG] No OPENCODE_API_KEY set. Running in Safe Mock / Diagnostic Mode.");
}

const steps = [
  {
    name: "1. Models & Approved Fallback Verification",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/model-fallback.test.ts"],
  },
  {
    name: "2. SSRF & Prompt Injection Security Gates",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/sales-ssrf.test.ts", "server/src/services/xss-sanitizer.test.ts"],
  },
  {
    name: "3. Formula Injection & CRM AES-256-GCM Encryption",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/formula-injection.test.ts", "server/src/services/sales-crm.test.ts"],
  },
  {
    name: "4. Email Compliance, RFC 8058 & Suppression Gate",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/sales-email.test.ts", "server/src/services/sales-campaign.test.ts"],
  },
  {
    name: "5. Multi-Tenant Authorization & Secret Scanning",
    command: "pnpm",
    args: ["vitest", "run", "server/src/__tests__/authorization-sweep.test.ts", "server/src/__tests__/secret-scanning.test.ts"],
  },
  {
    name: "6. 10k Leads Benchmark & Latency Probe",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/sales-benchmark.test.ts"],
  },
];

let totalPassed = 0;
let totalFailed = 0;

for (const step of steps) {
  console.log(`\n▶ Running ${step.name}...`);
  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: true,
  });

  if (result.status === 0) {
    console.log(`✔ ${step.name}: PASS`);
    totalPassed++;
  } else {
    console.error(`✖ ${step.name}: FAIL (exit code ${result.status})`);
    totalFailed++;
  }
}

console.log("\n=======================================================");
console.log(`   LIVE SMOKE SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log("=======================================================\n");

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
