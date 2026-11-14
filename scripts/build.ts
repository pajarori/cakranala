import { rm } from "node:fs/promises";
import tailwind from "bun-plugin-tailwind";
import pkg from "../package.json";

const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];

async function build(config: Parameters<typeof Bun.build>[0]) {
  const r = await Bun.build({ minify: true, ...config });
  if (!r.success) {
    for (const log of r.logs) console.error(log);
    process.exit(1);
  }
}

await rm("dist", { recursive: true, force: true });
await build({ entrypoints: ["src/index.ts"], outdir: "dist", target: "node", external });
await build({ entrypoints: ["src/collect/index.ts", "src/embed/index.ts", "src/cli/index.ts"], root: "src", outdir: "dist", target: "bun", external });
await build({ entrypoints: ["web/src/index.ts"], outdir: "dist/web", target: "bun", external, plugins: [tailwind], define: { "process.env.NODE_ENV": '"production"' } });

const tsc = Bun.spawnSync(["bunx", "tsc", "src/index.ts", "src/collect/index.ts", "src/embed/index.ts", "--declaration", "--emitDeclarationOnly", "--outDir", "dist", "--rootDir", "src", "--module", "preserve", "--moduleResolution", "bundler", "--target", "esnext", "--skipLibCheck", "--types", "bun", "--resolveJsonModule"], { stdout: "inherit", stderr: "inherit" });
if (tsc.exitCode !== 0) process.exit(1);
