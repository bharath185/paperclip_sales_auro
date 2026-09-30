import { rmSync, readdirSync, statSync } from "fs";
import { join } from "path";

const metaDir = join(process.cwd(), "src", "migrations", "meta");

const snapshots = readdirSync(metaDir)
  .filter(f => f.endsWith("_snapshot.json"))
  .map(f => ({ file: f, mtime: statSync(join(metaDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

// Keep 5 most recent, delete the rest
for (const snap of snapshots.slice(5)) {
  rmSync(join(metaDir, snap.file));
  console.log(`Pruned: ${snap.file}`);
}

console.log("Prune complete");