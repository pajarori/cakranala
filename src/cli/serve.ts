import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import pkg from "../../package.json";
import { features } from "../features";
import { cacheDir, dataDir } from "../home";
import { bold, cyan, dim, green, red, say } from "./ui";

export async function serve(args: string[]) {
  const { values } = parseArgs({ args, options: { port: { type: "string", short: "p" }, data: { type: "string", short: "d" }, demo: { type: "boolean" } } });
  if (values.port) process.env.PORT = values.port;
  if (values.data) process.env.CAKRANALA_DATA = values.data;
  if (values.demo) process.env.DEMO_MODE = "1";
  process.env.NODE_ENV ??= "production";
  const started = performance.now();
  process.env.CAKRANALA_DATA = dataDir();
  process.env.CAKRANALA_CACHE = cacheDir();
  const web = new URL("../web/", import.meta.url);
  process.chdir(fileURLToPath(web));
  const { server, firstRun } = (await import(new URL("index.js", web).href)) as { server: { url: URL }; firstRun: boolean };
  const f = await features();
  const mark = (on: boolean, label: string) => (on ? green(label) : dim(`${red("✗")} ${label}`));
  say(`\n  ${bold("Cakra Nala")} ${dim(`v${pkg.version}`)}  ${dim(`siap dalam ${Math.round(performance.now() - started)} ms`)}\n`);
  say(`  ${"Dashboard".padEnd(11)}${cyan(server.url.href)}`);
  say(`  ${"Data".padEnd(11)}${dim(dataDir())}`);
  say(`  ${"Fitur".padEnd(11)}${[mark(f.semantic, "semantik"), mark(f.pdf, "PDF"), mark(f.chrome, "Instagram/Facebook")].join("  ")}`);
  if (!f.semantic || !f.pdf || !f.chrome) say(`  ${"".padEnd(11)}${dim(`lengkapi dengan ${cyan("cakranala install")}`)}`);
  if (process.env.DEMO_MODE) say(`  ${"Demo".padEnd(11)}${dim("replay skenario Pulau Seruni")}`);
  if (firstRun) say(`\n  Buka dashboard untuk membuat akun pertama.`);
  say();
  return new Promise<number>(() => undefined);
}
