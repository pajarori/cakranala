import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuditEntry, ReportRow } from "./db";
import type { ReportContent } from "./reports";

const TEMPLATE = new URL("../../report/report.typ", import.meta.url).pathname;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WIB = 7 * 3_600_000;

const short = (s: string) => s.replace(/\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "$1");
const two = (n: number) => String(n).padStart(2, "0");

function local(ts: number) {
  const d = new Date(ts + WIB);
  return { day: two(d.getUTCDate()), hm: `${two(d.getUTCHours())}${two(d.getUTCMinutes())}`, month: d.getUTCMonth(), year: d.getUTCFullYear() };
}

const dtg = (ts: number) => {
  const t = local(ts);
  return `${t.day}${t.hm}G ${MONTHS[t.month]} ${String(t.year).slice(2)}`;
};

const stamp = (ts: number) => {
  const t = local(ts);
  return `${t.day} ${MONTHS[t.month].charAt(0)}${MONTHS[t.month].slice(1).toLowerCase()} ${t.year}, ${t.hm.slice(0, 2)}:${t.hm.slice(2)} WIB`;
};

export async function reportPdf(r: ReportRow<ReportContent> & { hash?: string }, custody: AuditEntry[]) {
  const c = r.content;
  const data = {
    title: short(c.title),
    short: r.id.slice(0, 8).toUpperCase(),
    caseShort: r.caseId.slice(0, 8).toUpperCase(),
    classification: process.env.REPORT_CLASSIFICATION ?? "RESTRICTED",
    dtg: dtg(r.createdAt),
    issued: stamp(r.createdAt),
    preparedBy: String(custody.find((a) => a.action === "report.created")?.detail.by ?? "Cakra Nala"),
    threatLevel: c.threatLevel,
    confidence: short(c.confidence),
    bluf: short(c.bluf),
    assessment: short(c.assessment),
    facts: c.facts.map((f) => ({ label: f.label, value: f.label === "First seen" ? stamp(Date.parse(f.value)) : short(f.value) })),
    findings: c.findings.map(short),
    actions: c.actions.map(short),
    disarm: (c.facts.find((f) => f.label === "DISARM techniques")?.value ?? "")
      .split(", ")
      .filter((x) => /^T\d/.test(x))
      .map((x) => ({ id: x.split(" ")[0], name: x.split(" ").slice(1).join(" ") })),
    counter: r.counter ? short(r.counter) : null,
    hash: r.hash ?? "",
    evidence: c.evidence ?? { events: 0, root: "" },
    custody: custody.map((a) => ({ time: stamp(a.ts), action: a.action, by: String(a.detail.by ?? "system"), hash: a.hash.slice(0, 16) })),
  };
  data.facts = data.facts.filter((f) => f.label !== "DISARM techniques");
  const dir = await mkdtemp(join(tmpdir(), "report-"));
  try {
    await Bun.write(join(dir, "report.typ"), Bun.file(TEMPLATE));
    await Bun.write(join(dir, "data.json"), JSON.stringify(data));
    const p = Bun.spawn([process.env.TYPST_BIN ?? "typst", "compile", "--ignore-system-fonts", "--root", dir, "--input", "data=data.json", join(dir, "report.typ"), join(dir, "report.pdf")], { stderr: "pipe" });
    if ((await p.exited) !== 0) throw new Error(`typst failed: ${(await new Response(p.stderr).text()).slice(0, 300)}`);
    return new Uint8Array(await Bun.file(join(dir, "report.pdf")).arrayBuffer());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
