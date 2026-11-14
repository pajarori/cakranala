import { CHROME } from "../collect/browser";
import { features, TYPST_VERSION, typstPath } from "../features";
import { cacheDir, dataDir } from "../home";
import { dim, missing, ok, optional, say } from "./ui";

export async function doctor() {
  const f = await features();
  say(`${dim(`bun ${Bun.version}, ${process.platform}-${process.arch}`)}\n`);
  ok("engine", "5 layer deteksi");
  if (!f.semantic) missing("semantik", "belum terpasang", "cakranala install model");
  else if (!f.model) missing("semantik", "model belum diunduh", "cakranala install model");
  else ok("semantik", "multilingual-e5-small");
  if (f.pdf) ok("PDF", typstPath()!.startsWith(cacheDir()) ? `typst ${TYPST_VERSION}` : typstPath());
  else missing("PDF", "Typst belum terpasang", "cakranala install typst");
  if (f.chrome) ok("chrome", `${CHROME.buildId}, untuk Instagram dan Facebook`);
  else missing("chrome", "belum terpasang", "cakranala install chrome");
  if (f.unzip) ok("unzip", "impor arsip zip");
  else optional("unzip", "tidak ada, impor arsip zip nonaktif");
  if (process.env.LLM_BASE_URL && process.env.LLM_MODEL) ok("LLM", `${process.env.LLM_MODEL} di ${new URL(process.env.LLM_BASE_URL).host}`);
  else optional("LLM", "LLM_BASE_URL dan LLM_MODEL tidak diatur, judul dan ringkasan memakai template");
  if (process.env.TIKTOK_SIDECAR_URL) ok("tiktok", process.env.TIKTOK_SIDECAR_URL);
  else optional("tiktok", "TIKTOK_SIDECAR_URL tidak diatur");
  say(`\n  ${"data".padEnd(11)}${dim(dataDir())}\n  ${"cache".padEnd(11)}${dim(cacheDir())}`);
  return 0;
}
