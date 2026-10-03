#!/usr/bin/env node

/**
 * Master Runner for Auro OpenCode Live Smoke Testing
 * 
 * Rules:
 * 1. Refuses to run without OPENCODE_API_KEY (exits non-zero). Never prints the key.
 * 2. Provides a --dry-check mode that only validates config and static contracts.
 * 3. Does NOT count simulator results as live.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
const isDryCheck = args.includes("--dry-check");
const apiKey = process.env.OPENCODE_API_KEY;

console.log("\n=======================================================");
console.log("   AURO OPENCODE - LIVE SMOKE & INTEGRATION PROBE");
console.log("=======================================================\n");

if (isDryCheck) {
  console.log("[MODE] Running in --dry-check mode (Config & Contract Validation Only).");
  
  // 1. Verify models.yaml existence and structure
  const modelsPath = path.join(rootDir, "config/models.yaml");
  if (!fs.existsSync(modelsPath)) {
    console.error(`[FAIL] config/models.yaml not found at ${modelsPath}`);
    process.exit(1);
  }
  const modelsContent = fs.readFileSync(modelsPath, "utf-8");
  if (!modelsContent.includes("opencode/deepseek-v4-pro") || !modelsContent.includes("opencode/kimi-k2.7-code")) {
    console.error("[FAIL] Approved models missing from config/models.yaml");
    process.exit(1);
  }
  console.log("✔ config/models.yaml verified with approved OpenCode models.");

  // 2. Verify Governance and Sales prompts existence
  const govPrompts = ["ceo.md", "cto.md", "pm.md", "qa.md", "devops.md", "security.md"];
  for (const p of govPrompts) {
    const fullPath = path.join(rootDir, "prompts/governance", p);
    if (!fs.existsSync(fullPath)) {
      console.error(`[FAIL] Governance prompt missing: ${p}`);
      process.exit(1);
    }
  }
  console.log(`✔ All ${govPrompts.length} governance prompts verified.`);

  const salesPrompts = ["ceo.md", "sales_manager.md", "researcher.md", "follow_up.md", "crm_sync.md"];
  for (const p of salesPrompts) {
    const fullPath = path.join(rootDir, "prompts/sales", p);
    if (!fs.existsSync(fullPath)) {
      console.error(`[FAIL] Sales prompt missing: ${p}`);
      process.exit(1);
    }
  }
  console.log(`✔ All ${salesPrompts.length} sales prompts verified.`);

  console.log("\n=======================================================");
  console.log("   --dry-check PASSED: All static configurations valid.");
  console.log("=======================================================\n");
  process.exit(0);
}

// Live Run Gate: Must have OPENCODE_API_KEY
if (!apiKey || apiKey.trim().length === 0) {
  console.error("❌ ERROR: OPENCODE_API_KEY environment variable is required to run live smoke probe.");
  console.error("To run offline validation, use: node scripts/live-smoke/run-live-smoke.mjs --dry-check\n");
  process.exit(1);
}

console.log("[CONFIG] Live OPENCODE_API_KEY present (Key masked for security: [REDACTED])");

const liveSteps = [
  {
    name: "1. Model Verification & Live Fallback Gate",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/model-fallback.test.ts"],
  },
  {
    name: "2. SSRF, Prompt Injection & XSS Sanitization Gates",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/sales-ssrf.test.ts", "server/src/services/xss-sanitizer.test.ts", "server/src/services/prompt-injection-defense.test.ts"],
  },
  {
    name: "3. Formula Injection & CRM AES-256-GCM Encryption Gate",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/formula-injection.test.ts", "server/src/services/sales-crm.test.ts", "server/src/services/key-rotation.test.ts"],
  },
  {
    name: "4. Email Compliance, RFC 8058 & Suppression Gate",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/sales-email.test.ts", "server/src/services/sales-campaign.test.ts"],
  },
  {
    name: "5. Web Hardening & Privacy Controls",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/web-hardening.test.ts", "server/src/services/privacy-retention.test.ts"],
  },
  {
    name: "6. Multi-Tenant Authorization Sweep & Secret Scanning",
    command: "pnpm",
    args: ["vitest", "run", "server/src/__tests__/authorization-sweep.test.ts", "server/src/__tests__/secret-scanning.test.ts"],
  },
  {
    name: "7. 10k Leads Database & Query Performance Benchmark",
    command: "pnpm",
    args: ["vitest", "run", "server/src/services/sales-benchmark.test.ts"],
  },
];

let totalPassed = 0;
let totalFailed = 0;

for (const step of liveSteps) {
  console.log(`\n▶ Running ${step.name}...`);
  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      OPENCODE_API_KEY: apiKey,
    },
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
