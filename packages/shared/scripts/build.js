import { mkdirSync, cpSync, rmSync } from "fs";
import { join } from "path";

const distDir = join(process.cwd(), "dist");
const distCliplabDir = join(distDir, "cliplab");
const srcCliplabDir = join(process.cwd(), "src", "cliplab");

// Clean
rmSync(distDir, { recursive: true, force: true });

// Build TypeScript
console.log("Running tsc...");
// Note: tsc is run as a separate step in package.json

// Create cliplab directory
mkdirSync(distCliplabDir, { recursive: true });

// Copy cliplab files
cpSync(join(srcCliplabDir, "LICENSE"), join(distCliplabDir, "LICENSE"));
cpSync(join(srcCliplabDir, "PROVENANCE.md"), join(distCliplabDir, "PROVENANCE.md"));

console.log("Build complete");