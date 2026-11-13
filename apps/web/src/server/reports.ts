import { plain } from "cakranala";
import { audit, reports, sha256, store, type ReportRow } from "./db";
import { caseView, reasoner, snapshot } from "./analysis";

export interface ReportContent {
  title: string;
  threatLevel: string;
  bluf: string;
  assessment: string;
  findings: string[];
  actions: string[];
  confidence: string;
  facts: { label: string; value: string }[];
  evidence: { events: number; root: string; items: { id: string; sha256: string }[] };
}

const clean = (s: unknown) => plain(String(s ?? ""));

function evidence(members: string[], since: number) {
  const items = store.rows(members, since).map((r) => ({ id: r.id, sha256: sha256(r.json) }));
  return { events: items.length, root: sha256(items.map((i) => i.sha256).join("")), items };
}

function facts(id: string) {
  const c = caseView(id);
  const { report, window } = snapshot();
  if (!c || !report) throw new Error("case is not active in the current analysis window");
  const narratives = report.narratives.filter((n) => c.narratives.includes(n.id));
  const clusters = report.clusters.filter((k) => c.clusters.includes(k.id));
  return {
    c,
    narratives,
    clusters,
    evidence: evidence([...new Set(clusters.flatMap((k) => k.members))], window.from),
    table: [
      { label: "Severity", value: c.severity },
      { label: "Apparent supporters", value: String(c.apparent) },
      { label: "Effective independent voices", value: c.independent.toFixed(1) },
      { label: "Coordinated accounts", value: String(clusters.reduce((s, k) => s + k.members.length, 0)) },
      { label: "Clusters", value: clusters.map((k) => k.id).join(", ") },
      { label: "First seen", value: new Date(c.firstSeen).toISOString() },
      { label: "DISARM techniques", value: c.disarm.map((t) => `${t.id} ${t.name}`).join(", ") || "none" },
    ],
  };
}

export async function createReport(caseId: string): Promise<ReportRow<ReportContent>> {
  const { c, narratives, clusters, table, evidence } = facts(caseId);
  let content: ReportContent = {
    title: c.title,
    threatLevel: c.severity,
    bluf: c.brief ?? `${c.apparent} accounts appear to support this narrative, but they amount to about ${c.independent.toFixed(0)} independent voices.`,
    assessment: "",
    findings: clusters.map((k) => `Cluster ${k.id}: ${k.members.length} accounts acting in ${k.forensics.waves} waves, dependence ${k.rho.toFixed(2)}.`),
    actions: [],
    confidence: "moderate",
    facts: table,
    evidence,
  };
  if (reasoner) {
    const prompt = [
      "Write a one page intelligence report for a TNI AD (Indonesian Army) cyber operations commander about a coordinated influence operation detected on social media.",
      `Case: ${c.title}. Severity: ${c.severity}.`,
      `Facts: ${JSON.stringify(table)}`,
      `Narratives pushed:\n${narratives.map((n) => `- ${n.sample} (apparent ${n.supporters}, independent ${n.sie.value.toFixed(1)})`).join("\n")}`,
      `Clusters:\n${clusters.map((k) => `- ${k.id}: ${k.members.length} accounts, ${k.forensics.waves} waves, rotation ${k.forensics.rotation?.toFixed(2) ?? "n/a"}, cadence ${k.forensics.cadence?.medianSec.toFixed(0) ?? "n/a"}s, talking points: ${k.forensics.talkingPoints.join(" | ")}`).join("\n")}`,
      c.brief ? `Analyst brief: ${c.brief}` : "",
      'Reply with JSON only: {"bluf": "bottom line up front, 2 sentences", "assessment": "one paragraph", "findings": ["3 to 5 evidence based findings"], "actions": ["3 to 5 concrete recommended actions for the command, e.g. public clarification via official channels, reporting accounts to the platform, coordination with the information office, continued monitoring"], "confidence": "low, moderate or high, with a short reason"}',
      "Use English, plain sentences, indicative language, and do not accuse identifiable individuals.",
    ].join("\n\n");
    try {
      const raw = await reasoner.complete(prompt, { json: true });
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      content = {
        ...content,
        bluf: clean(j.bluf) || content.bluf,
        assessment: clean(j.assessment),
        findings: Array.isArray(j.findings) ? j.findings.map(clean) : content.findings,
        actions: Array.isArray(j.actions) ? j.actions.map(clean) : content.actions,
        confidence: clean(j.confidence) || content.confidence,
      };
    } catch {}
  }
  const row: ReportRow<ReportContent> = { id: crypto.randomUUID(), caseId, createdAt: Date.now(), content, counter: null };
  const hash = reports.insert(row);
  audit.add("report.created", row.id, { caseId, sha256: hash, evidenceRoot: evidence.root, events: evidence.events });
  return { ...row, hash };
}

export async function counterNarrative(reportId: string) {
  const r = reports.get(reportId) as ReportRow<ReportContent> | undefined;
  if (!r) throw new Error("report not found");
  if (!reasoner) throw new Error("no language model configured");
  const prompt = [
    "Tulis draf pesan publik untuk kanal resmi TNI AD (media sosial) yang merespons narasi menyesatkan berikut.",
    `Ringkasan kasus: ${r.content.bluf}`,
    `Temuan: ${r.content.findings.join(" ")}`,
    "Gunakan teknik prebunking: jelaskan teknik manipulasi yang dipakai (misalnya kesan ramai yang dibuat-buat, urgensi palsu, atau iming-iming), sampaikan fakta dan kanal resmi tanpa menyebut atau menuduh akun tertentu, nada tenang dan meyakinkan, maksimal 120 kata, bahasa Indonesia yang mudah dipahami warga. Jangan memakai tanda pisah panjang.",
    "Balas hanya dengan teks pesannya.",
  ].join("\n\n");
  const text = clean(await reasoner.complete(prompt));
  reports.setCounter(reportId, text);
  audit.add("report.counter", reportId, { sha256: sha256(text) });
  return text;
}
