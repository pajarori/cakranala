import type { Embedder, Reasoner } from "./ports";
import type { Report } from "./detect";
import { centered, cosine, jaccard, shingles } from "./text";

export interface ShieldInput {
  text?: string;
  image?: string;
}

export interface ShieldContext {
  report?: Report;
  officialDomains?: string[];
  library?: { claim: string; verdict: string; source?: string }[];
  embedder?: Embedder;
  reasoner?: Reasoner;
}

export interface UrlFinding {
  url: string;
  host: string;
  flags: string[];
  imitates?: string;
}

export interface Match {
  kind: "narasi" | "klaster" | "pustaka";
  ref: string;
  similarity: number;
  text: string;
  supporters?: number;
  sie?: number;
  iks?: number;
  verdict?: string;
}

export interface ShieldResult {
  text: string;
  risk: "rendah" | "sedang" | "tinggi";
  score: number;
  cues: string[];
  urls: UrlFinding[];
  techniques: { name: string; quote: string; why: string }[];
  matches: Match[];
  summary?: string;
  advice: string[];
}

const fold = (s: string) => s.toLowerCase().replace(/0/g, "o").replace(/[1!|]/g, "l").replace(/3/g, "e").replace(/5/g, "s").replace(/rn/g, "m").replace(/vv/g, "w");

function levenshtein(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

function inspectUrl(raw: string, official: string[]): UrlFinding {
  const url = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    path = u.pathname;
  } catch {
    return { url: raw, host: raw, flags: ["format tautan tidak valid"] };
  }
  const flags: string[] = [];
  if (host.includes("xn--")) flags.push("domain punycode (bisa meniru huruf lain)");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) flags.push("alamat IP mentah, bukan nama domain");
  if (/[^\x00-\x7f]/.test(raw)) flags.push("mengandung karakter non-latin yang mirip huruf biasa");
  if (/\.(apk|exe|scr|bat|msi|jar)$/i.test(path)) flags.push("mengunduh file aplikasi/eksekusi");
  if (host.split(".").length > 4) flags.push("subdomain berlapis");
  if (host.split(".")[0].length <= 6 && /^\/[A-Za-z0-9_-]{4,12}$/.test(path)) flags.push("tautan pendek: tujuan asli tersembunyi");
  const isOfficial = official.some((d) => host === d || host.endsWith(`.${d}`));
  let imitates: string | undefined;
  if (!isOfficial)
    for (const d of official) {
      const tokens = d.split(/[.-]/).filter((t) => t.length >= 3 && !["mil", "com", "org", "net", "www"].includes(t));
      const shared = tokens.filter((t) => fold(host).includes(fold(t)));
      if (levenshtein(fold(host), fold(d)) <= 3 || (tokens.length && shared.length >= Math.min(2, tokens.length))) {
        imitates = d;
        flags.push(`meniru domain resmi ${d}`);
        break;
      }
    }
  return { url: raw, host, flags, imitates };
}

function structuralCues(text: string) {
  const cues: string[] = [];
  if (/\b(rp\.?\s?\d|\d+[.,]?\d*\s?(rb|ribu|jt|juta|k)\b)/i.test(text)) cues.push("menyebut nominal uang");
  if (/(\+?62|0)8\d{7,11}|wa\.me\//i.test(text)) cues.push("mencantumkan nomor kontak pribadi");
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.35) cues.push("banyak huruf kapital (tekanan emosional)");
  if ((text.match(/[!‼️]/g) ?? []).length >= 3) cues.push("banyak tanda seru");
  return cues;
}

async function references(text: string, ctx: ShieldContext) {
  const refs: Omit<Match, "similarity">[] = [];
  for (const n of ctx.report?.narratives ?? []) refs.push({ kind: "narasi", ref: n.id, text: n.sample, supporters: n.supporters, sie: n.sie.value, iks: n.iks });
  for (const c of ctx.report?.clusters ?? []) for (const t of c.forensics.talkingPoints) refs.push({ kind: "klaster", ref: c.id, text: t, supporters: c.members.length });
  for (const l of ctx.library ?? []) refs.push({ kind: "pustaka", ref: l.source ?? "pustaka", text: l.claim, verdict: l.verdict });
  if (!refs.length) return [];
  let sims: number[];
  if (ctx.embedder) {
    const vecs = centered(await ctx.embedder.embed([text, ...refs.map((r) => r.text)]));
    sims = refs.map((_, i) => cosine(vecs[0], vecs[i + 1]));
  } else {
    const s = shingles(text);
    sims = refs.map((r) => jaccard(s, shingles(r.text)));
  }
  const floor = ctx.embedder ? 0.5 : 0.25;
  return refs
    .map((r, i) => ({ ...r, similarity: sims[i] }))
    .filter((m) => m.similarity >= floor)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

async function readImage(image: string, reasoner: Reasoner) {
  return reasoner.complete("Salin seluruh teks yang terlihat pada gambar ini apa adanya (termasuk tautan, nomor, nama akun). Jangan menambahkan komentar.", { images: [image] });
}

async function interpret(text: string, facts: object, reasoner: Reasoner) {
  const prompt = [
    "Kamu adalah Perisai Nalar, pendamping literasi digital untuk warga Indonesia.",
    `Pesan yang diterima warga:\n"""${text}"""`,
    `Temuan otomatis: ${JSON.stringify(facts)}`,
    "Identifikasi teknik manipulasi psikologis yang dipakai pesan (misal: urgensi palsu, otoritas palsu, iming-iming, menakut-nakuti, bukti sosial palsu, kambing hitam, dikotomi palsu, provokasi identitas). Kutip bagian pesan yang tepat.",
    'Balas HANYA JSON: {"techniques":[{"name":string,"quote":string,"why":string}],"summary":string,"advice":[string]} dalam Bahasa Indonesia yang ramah dan singkat. Jangan menuduh individu; fokus pada teknik.',
  ].join("\n\n");
  const raw = await reasoner.complete(prompt, { json: true, system: "Jawab hanya dengan JSON valid." });
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Pick<ShieldResult, "techniques" | "summary" | "advice">;
}

export async function shield(input: ShieldInput, ctx: ShieldContext = {}): Promise<ShieldResult> {
  let text = input.text ?? "";
  if (input.image && ctx.reasoner) text = `${text}\n${await readImage(input.image, ctx.reasoner)}`.trim();
  const found = text.match(/\b(?:https?:\/\/|www\.)[^\s<>"')]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,12}(?:\/[^\s]*)?/gi) ?? [];
  const urls = [...new Set(found.map((u) => u.replace(/[.,;:!?)\]]+$/, "")))].map((u) => inspectUrl(u, ctx.officialDomains ?? []));
  const cues = structuralCues(text);
  const matches = await references(text, ctx);
  const coordinated = matches.find((m) => m.kind !== "pustaka" && (m.iks ?? 0.5) >= 0.5);
  let score = 0;
  score += urls.reduce((s, u) => s + (u.imitates ? 0.5 : 0) + Math.min(0.3, u.flags.length * 0.15), 0);
  score += cues.length * 0.1;
  if (coordinated) score += 0.3;
  if (matches.some((m) => m.kind === "pustaka")) score += 0.4;
  let techniques: ShieldResult["techniques"] = [];
  let summary: string | undefined;
  let advice: string[] = [];
  if (ctx.reasoner && text)
    try {
      const r = await interpret(text, { urls, cues, matches }, ctx.reasoner);
      techniques = r.techniques ?? [];
      summary = r.summary;
      advice = r.advice ?? [];
      score += Math.min(0.4, techniques.length * 0.1);
    } catch {}
  if (!advice.length) {
    if (urls.some((u) => u.imitates)) advice.push(`Jangan buka tautannya. Kunjungi langsung situs resmi: ${urls.find((u) => u.imitates)!.imitates}.`);
    if (cues.includes("menyebut nominal uang")) advice.push("Jangan mentransfer uang sebelum memverifikasi lewat kanal resmi.");
    if (coordinated) advice.push(`Narasi ini terlihat ramai, tetapi suara independennya diperkirakan hanya ±${Math.round(coordinated.sie ?? 0)} dari ${coordinated.supporters} akun.`);
    if (!advice.length) advice.push("Tidak ditemukan tanda bahaya yang kuat. Tetap periksa sumbernya sebelum membagikan.");
  }
  score = Math.min(1, score);
  return { text, risk: score >= 0.6 ? "tinggi" : score >= 0.3 ? "sedang" : "rendah", score, cues, urls, techniques, matches, summary, advice };
}
