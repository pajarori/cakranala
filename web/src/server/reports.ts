import { plain } from "cakranala";
import { audit, reports, sha256, store, type ReportRow } from "./db";
import { caseEvidence, caseView, reasoner } from "./analysis";

const SEVERITY = { critical: "Kritis", high: "Tinggi", medium: "Sedang", low: "Rendah" } as const;

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

function evidence(members: string[], since: number, until: number) {
  const items = store.rows(members, since, until).map((r) => ({ id: r.id, sha256: sha256(r.json) }));
  return { events: items.length, root: sha256(items.map((i) => i.sha256).join("")), items };
}

function facts(id: string) {
  const ev = caseEvidence(id);
  if (!ev) throw new Error("bukti kasus belum tersedia");
  const c = { ...ev.view, ...(caseView(id) ?? {}) };
  const report = ev.report;
  const window = ev.window;
  const narratives = report.narratives.filter((n) => c.narratives.includes(n.id));
  const clusters = report.clusters.filter((k) => c.clusters.includes(k.id));
  return {
    c,
    narratives,
    clusters,
    evidence: evidence([...new Set(clusters.flatMap((k) => k.members))], window.from, window.to + 1),
    table: [
      { label: "Tingkat ancaman", value: SEVERITY[c.severity] },
      { label: "Pendukung tampak", value: String(c.apparent) },
      { label: "Suara independen efektif", value: c.independent.toFixed(1).replace(".", ",") },
      { label: "Akun terkoordinasi", value: String(clusters.reduce((s, k) => s + k.members.length, 0)) },
      { label: "Cluster", value: clusters.map((k) => k.id).join(", ") },
      { label: "Pertama terlihat", value: new Date(c.firstSeen).toISOString() },
      { label: "Teknik DISARM", value: c.disarm.map((t) => `${t.id} ${t.name}`).join(", ") || "tidak ada" },
    ],
  };
}

export async function createReport(caseId: string, by: string): Promise<ReportRow<ReportContent>> {
  const { c, narratives, clusters, table, evidence } = facts(caseId);
  let content: ReportContent = {
    title: c.title,
    threatLevel: c.severity,
    bluf: c.brief ?? `${c.apparent} akun tampak mendukung narasi ini, tetapi nilainya hanya setara sekitar ${c.independent.toFixed(0)} suara independen.`,
    assessment: "",
    findings: clusters.map((k) => `Cluster ${k.id.slice(0, 8)}: ${k.members.length} akun bergerak dalam ${k.forensics.waves} gelombang, dependensi ${k.rho.toFixed(2)}.`),
    actions: [],
    confidence: "sedang",
    facts: table,
    evidence,
  };
  if (reasoner) {
    const prompt = [
      "Tulis laporan intelijen satu halaman untuk komandan operasi siber TNI AD tentang operasi pengaruh terkoordinasi yang terdeteksi di media sosial.",
      `Kasus: ${c.title}. Tingkat ancaman: ${SEVERITY[c.severity]}.`,
      `Fakta: ${JSON.stringify(table)}`,
      `Narasi yang didorong:\n${narratives.map((n) => `- ${n.sample} (tampak ${n.supporters}, independen ${n.sie.value.toFixed(1)})`).join("\n")}`,
      `Cluster:\n${clusters.map((k) => `- ${k.id.slice(0, 8)}: ${k.members.length} akun, ${k.forensics.waves} gelombang, rotasi ${k.forensics.rotation?.toFixed(2) ?? "n/a"}, kadens ${k.forensics.cadence?.medianSec.toFixed(0) ?? "n/a"} detik, pokok pesan: ${k.forensics.talkingPoints.join(" | ")}`).join("\n")}`,
      c.brief ? `Ringkasan analis: ${c.brief}` : "",
      'Balas HANYA JSON: {"bluf": "pokok persoalan, 2 kalimat", "assessment": "satu paragraf penilaian", "findings": ["3 sampai 5 temuan berbasis bukti"], "actions": ["3 sampai 5 saran tindakan konkret untuk komando, misalnya klarifikasi publik lewat kanal resmi, pelaporan akun ke platform, koordinasi dengan Penerangan, pemantauan lanjutan"], "confidence": "rendah, sedang, atau tinggi, dengan alasan singkat"}',
      "Gunakan Bahasa Indonesia baku yang lugas, bahasa indikatif, dan jangan menuduh individu yang dapat dikenali.",
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
  audit.add("report.created", row.id, { caseId, sha256: hash, evidenceRoot: evidence.root, events: evidence.events, by });
  return { ...row, hash };
}

export async function counterNarrative(reportId: string, by: string) {
  const r = reports.get(reportId) as ReportRow<ReportContent> | undefined;
  if (!r) throw new Error("laporan tidak ditemukan");
  if (!reasoner) throw new Error("model bahasa belum dikonfigurasi");
  const prompt = [
    "Tulis draf pesan publik untuk kanal resmi TNI AD (media sosial) yang merespons narasi menyesatkan berikut.",
    `Ringkasan kasus: ${r.content.bluf}`,
    `Temuan: ${r.content.findings.join(" ")}`,
    "Gunakan teknik prebunking: jelaskan teknik manipulasi yang dipakai (misalnya kesan ramai yang dibuat-buat, urgensi palsu, atau iming-iming), sampaikan fakta dan kanal resmi tanpa menyebut atau menuduh akun tertentu, nada tenang dan meyakinkan, maksimal 120 kata, bahasa Indonesia yang mudah dipahami warga. Jangan memakai tanda pisah panjang.",
    "Balas hanya dengan teks pesannya.",
  ].join("\n\n");
  const text = clean(await reasoner.complete(prompt));
  reports.setCounter(reportId, text);
  audit.add("report.counter", reportId, { sha256: sha256(text), by });
  return text;
}
