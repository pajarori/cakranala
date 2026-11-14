import { chmod, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install as fetchBrowser } from "@puppeteer/browsers";
import pkg from "../../package.json";
import { CHROME, chromePath } from "../collect/browser";
import { createE5Embedder, modelCached, transformers } from "../embed/embed";
import { TYPST_VERSION, typstPath } from "../features";
import { cacheDir } from "../home";
import { bold, cyan, dim, say, task, type Task } from "./ui";

const TYPST_TARGET: Record<string, string> = {
  "linux-x64": "x86_64-unknown-linux-musl",
  "linux-arm64": "aarch64-unknown-linux-musl",
  "darwin-x64": "x86_64-apple-darwin",
  "darwin-arm64": "aarch64-apple-darwin",
  "win32-x64": "x86_64-pc-windows-msvc",
};

async function download(url: string, file: string, t: Task) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`unduhan gagal: ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  const parts: Uint8Array[] = [];
  let loaded = 0;
  const reader = res.body.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    parts.push(r.value);
    loaded += r.value.length;
    t.progress(loaded, total);
  }
  await writeFile(file, Buffer.concat(parts));
}

async function model(t: Task) {
  if (!(await transformers())) {
    t.note("memasang @huggingface/transformers");
    const deps = join(cacheDir(), "deps");
    await mkdir(deps, { recursive: true });
    await writeFile(join(deps, "package.json"), JSON.stringify({ name: "cakranala-deps", private: true }));
    const p = Bun.spawn(["bun", "add", `@huggingface/transformers@${pkg.peerDependencies["@huggingface/transformers"]}`], { cwd: deps, stdout: "ignore", stderr: "pipe" });
    if ((await p.exited) !== 0) throw new Error((await new Response(p.stderr).text()).trim().split("\n").at(-1) ?? "bun add gagal");
  }
  const cached = modelCached();
  const files = new Map<string, [number, number]>();
  const embedder = await createE5Embedder({
    progress(file, loaded, total) {
      files.set(file, [loaded, total]);
      const sum = [...files.values()].reduce((a, [l, n]) => [a[0] + l, a[1] + n], [0, 0]);
      t.progress(sum[0], sum[1]);
    },
  });
  await embedder.embed(["siap"]);
  return cached ? "sudah ada" : "multilingual-e5-small";
}

async function typst(t: Task) {
  const existing = typstPath();
  if (existing) return existing.startsWith(cacheDir()) ? `${TYPST_VERSION}, sudah ada` : `memakai ${existing}`;
  const target = TYPST_TARGET[`${process.platform}-${process.arch}`];
  if (!target) throw new Error(`Typst tidak tersedia untuk ${process.platform}-${process.arch}`);
  const windows = process.platform === "win32";
  const dir = await mkdtemp(join(tmpdir(), "cakranala-typst-"));
  try {
    const archive = join(dir, windows ? "typst.zip" : "typst.tar.xz");
    await download(`https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${target}.${windows ? "zip" : "tar.xz"}`, archive, t);
    t.note("mengekstrak");
    const p = Bun.spawn(["tar", "-xf", archive, "-C", dir], { stderr: "pipe" });
    if ((await p.exited) !== 0) throw new Error((await new Response(p.stderr).text()).trim() || "ekstrak gagal");
    const bin = join(cacheDir(), "bin");
    await mkdir(bin, { recursive: true });
    const name = windows ? "typst.exe" : "typst";
    await rename(join(dir, `typst-${target}`, name), join(bin, name));
    await chmod(join(bin, name), 0o755);
    return TYPST_VERSION;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function chrome(t: Task) {
  if (chromePath()) return `${CHROME.buildId}, sudah ada`;
  await fetchBrowser({ ...CHROME, downloadProgressCallback: (loaded, total) => t.progress(loaded, total) });
  return CHROME.buildId;
}

const ITEMS = {
  model: { size: "±380 MB", purpose: "layer semantik dan Perisai", run: model },
  typst: { size: "±60 MB", purpose: "laporan PDF", run: typst },
  chrome: { size: "±400 MB", purpose: "Instagram dan Facebook", run: chrome },
};

type Item = keyof typeof ITEMS;

export async function install(args: string[]) {
  const unknown = args.filter((a) => !(a in ITEMS));
  if (unknown.length) {
    say(`Tidak dikenal: ${unknown.join(", ")}. Pilihan: ${Object.keys(ITEMS).join(", ")}`);
    return 2;
  }
  const items = (args.length ? args : Object.keys(ITEMS)) as Item[];
  say(`${bold("Cakra Nala")} ${dim(`menyiapkan fitur di ${cacheDir()}`)}\n`);
  for (const name of items) say(`  ${name.padEnd(9)} ${dim(`${ITEMS[name].purpose}, ${ITEMS[name].size} di disk`)}`);
  say();
  const failed: Item[] = [];
  for (const name of items) {
    const t = task(name);
    try {
      t.done(await ITEMS[name].run(t));
    } catch (e) {
      failed.push(name);
      t.fail(e instanceof Error ? e.message : String(e));
    }
  }
  say();
  if (failed.length) {
    say(`Ulangi yang gagal: ${cyan(`cakranala install ${failed.join(" ")}`)}`);
    return 1;
  }
  say(`Semua siap. Jalankan ${cyan("cakranala serve")}`);
  return 0;
}
