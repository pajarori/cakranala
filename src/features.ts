import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromePath } from "./collect/browser";
import { modelCached, transformers } from "./embed/embed";
import { cacheDir } from "./home";

export const TYPST_VERSION = "0.15.1";

export function typstPath() {
  const cached = join(cacheDir(), "bin", process.platform === "win32" ? "typst.exe" : "typst");
  return process.env.TYPST_BIN ?? (existsSync(cached) ? cached : (Bun.which("typst") ?? undefined));
}

export async function features() {
  const semantic = !!(await transformers());
  return { semantic, model: semantic && modelCached(), pdf: !!typstPath(), chrome: !!chromePath(), unzip: !!Bun.which("unzip") };
}

export type Features = Awaited<ReturnType<typeof features>>;
