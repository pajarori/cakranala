import pkg from "../../package.json";
import { doctor } from "./doctor";
import { install } from "./install";
import { serve } from "./serve";
import { bold, cyan, dim, say } from "./ui";

const HELP = `${bold("Cakra Nala")} ${dim(`v${pkg.version}`)}  deteksi operasi pengaruh terkoordinasi

  ${cyan("cakranala install")}            siapkan semua fitur: model e5, Typst, Chrome
  ${cyan("cakranala serve")}              jalankan dashboard di http://localhost:3000
  ${cyan("cakranala doctor")}             cek fitur yang siap dan yang kurang

  serve  --port 3000  --data .cakranala  --demo
  install [model] [typst] [chrome]

  Library: import { analyze } from "cakranala"
  Docs:    ${pkg.homepage}`;

const [command, ...rest] = process.argv.slice(2);
const commands: Record<string, (args: string[]) => Promise<number>> = { install, serve, doctor };

if (command === "--version" || command === "-v") console.log(pkg.version);
else if (!command || command === "--help" || command === "-h" || command === "help") say(HELP);
else if (!commands[command]) {
  say(`Perintah tidak dikenal: ${command}\n`);
  say(HELP);
  process.exitCode = 2;
} else
  process.exitCode = await commands[command](rest).catch((e: Error) => {
    say(e.message);
    return 1;
  });
