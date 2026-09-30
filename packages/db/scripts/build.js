import { rmSync, mkdirSync, cpSync, readdirSync } from "fs";
import { join } from "path";

const distDir = join(process.cwd(), "dist");
const srcMigrationsDir = join(process.cwd(), "src", "migrations");
const distMigrationsDir = join(distDir, "migrations");
const distMigrationsMetaDir = join(distMigrationsDir, "meta");
const srcMigrationsMetaDir = join(srcMigrationsDir, "meta");

// Clean
rmSync(distDir, { recursive: true, force: true });

// Build
mkdirSync(distMigrationsDir, { recursive: true });
mkdirSync(distMigrationsMetaDir, { recursive: true });

// Copy migration SQL files
for (const file of readdirSync(srcMigrationsDir)) {
  if (file.endsWith(".sql")) {
    cpSync(join(srcMigrationsDir, file), join(distMigrationsDir, file));
  }
}

// Copy journal
cpSync(join(srcMigrationsMetaDir, "_journal.json"), join(distMigrationsMetaDir, "_journal.json"));

console.log("Build complete");