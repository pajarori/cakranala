#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../dist/cli/index.js", import.meta.url));

if (process.versions.bun) await import(entry);
else {
  const r = spawnSync("bun", [entry, ...process.argv.slice(2)], { stdio: "inherit" });
  if (r.error) {
    console.error("Cakra Nala CLI berjalan di Bun. Pasang dulu: curl -fsSL https://bun.sh/install | bash");
    process.exit(1);
  }
  process.exit(r.status ?? 1);
}
